/**
 * Pipeline Specification & Property Conformance Evaluator Sub-Agent.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Audits generated Apache Beam code, runner scripts, build manifests, and deployment
 * artifacts against the visual DAG specification (YAML) to ensure that all user-configured
 * node properties, custom transform instructions, runtime variables, and job configurations
 * are faithfully incorporated and utilized in the generated codebase.
 *
 * Architectural decisions:
 * - Parses the YAML pipeline definition into a structured specification checklist
 *   (nodes, properties, custom instructions, runtime variables, job configurations).
 * - Instructs the sub-agent to cross-reference every defined property against generated source files,
 *   catching silently ignored properties, arbitrary fallback values, or missing custom prompt logic.
 * - Emits structured findings with category 'SPECIFICATION' and severities:
 *   - CRITICAL: A configured property or user specification required for pipeline behavior
 *     is completely missing/ignored, or custom logic in system_instructions was omitted.
 *   - MAJOR: A property was partially configured, replaced with an unintended default value,
 *     or runtime variables / jobConfig settings were omitted.
 *   - MINOR: Non-blocking cosmetic differences or minor unused optional parameter.
 */

import * as yaml from 'yaml';
import { GoogleGenAI } from '@google/genai';
import { DEFAULT_GEMINI_MODEL } from '../../../constants';
import { SpecialistAgentResult } from './types';
import { GeneratedFileCandidate } from './deterministic-gate';

/**
 * Structured representation of a parsed pipeline node for specification audit.
 */
export interface ParsedPipelineNode {
    id: string;
    label: string;
    type: 'SOURCE' | 'STEP' | 'SINK';
    beamTransform?: string;
    properties: Record<string, any>;
    systemInstructions?: string;
    codeGenerationPrompt?: string;
}

/**
 * Structured representation of the full pipeline specification parsed from YAML.
 */
export interface ParsedPipelineSpec {
    nodes: ParsedPipelineNode[];
    runtimeVariables: { key: string; value: any }[];
    jobConfig: Record<string, any>;
    pipelineConfig: Record<string, any>;
    edges: { id?: string; source: string; target: string; sourceHandle?: string; targetHandle?: string }[];
}

/**
 * Safely parses the pipeline YAML string into a structured specification model.
 * Handles corrupt, empty, or partial YAML gracefully.
 *
 * @param yamlContent - Raw pipeline YAML content.
 * @returns Structured ParsedPipelineSpec object.
 */
export function parsePipelineSpec(yamlContent: string): ParsedPipelineSpec {
    // NOTE: If YAML content is empty or only whitespace, return safe defaults immediately.
    if (!yamlContent || !yamlContent.trim()) {
        return {
            nodes: [],
            runtimeVariables: [],
            jobConfig: {},
            pipelineConfig: {},
            edges: []
        };
    }

    try {
        const parsed = yaml.parse(yamlContent);
        if (!parsed || typeof parsed !== 'object') {
            return {
                nodes: [],
                runtimeVariables: [],
                jobConfig: {},
                pipelineConfig: {},
                edges: []
            };
        }

        // Extract nodes and their configured properties
        const rawNodes = Array.isArray(parsed.nodes) ? parsed.nodes : [];
        const nodes: ParsedPipelineNode[] = rawNodes.map((n: any) => {
            const data = n.data || {};
            const props = typeof data.properties === 'object' && data.properties !== null ? data.properties : {};
            return {
                id: String(n.id || ''),
                label: String(data.label || 'Unnamed Node'),
                type: (data.type === 'SOURCE' || data.type === 'SINK') ? data.type : 'STEP',
                beamTransform: data.beam_transform || data.beamTransform,
                properties: props,
                systemInstructions: data.system_instructions || data.systemInstructions || props.system_instructions || props.systemInstructions,
                codeGenerationPrompt: data.codeGenerationPrompt || props.codeGenerationPrompt
            };
        });

        // Extract runtime variables
        const rawVars = Array.isArray(parsed.runtimeVariables) ? parsed.runtimeVariables : [];
        const runtimeVariables = rawVars.map((v: any) => ({
            key: String(v.key || ''),
            value: v.value
        })).filter((v: any) => v.key.length > 0);

        // Extract job and pipeline configs
        const jobConfig = typeof parsed.jobConfig === 'object' && parsed.jobConfig !== null ? parsed.jobConfig : {};
        const pipelineConfig = typeof parsed.pipelineConfig === 'object' && parsed.pipelineConfig !== null ? parsed.pipelineConfig : {};

        // Extract edges
        const rawEdges = Array.isArray(parsed.edges) ? parsed.edges : [];
        const edges = rawEdges.map((e: any) => ({
            id: e.id,
            source: String(e.source || ''),
            target: String(e.target || ''),
            sourceHandle: e.sourceHandle,
            targetHandle: e.targetHandle
        }));

        return {
            nodes,
            runtimeVariables,
            jobConfig,
            pipelineConfig,
            edges
        };
    } catch {
        // HACK: On YAML parse failure, return empty specification to allow downstream agents to proceed
        return {
            nodes: [],
            runtimeVariables: [],
            jobConfig: {},
            pipelineConfig: {},
            edges: []
        };
    }
}

/**
 * Formats a parsed pipeline specification into a human-readable checklist for the evaluator model.
 *
 * @param spec - Structured ParsedPipelineSpec.
 * @returns Formatted checklist string.
 */
export function formatSpecChecklist(spec: ParsedPipelineSpec): string {
    const lines: string[] = [];

    lines.push(`Total Nodes: ${spec.nodes.length}`);
    for (const [idx, node] of spec.nodes.entries()) {
        lines.push(`\n[Node ${idx + 1}] ID: "${node.id}" | Label: "${node.label}" | Type: ${node.type} | Transform: ${node.beamTransform || 'N/A'}`);

        const propKeys = Object.keys(node.properties);
        if (propKeys.length > 0) {
            lines.push(`  Configured Properties (${propKeys.length}):`);
            for (const key of propKeys) {
                const val = JSON.stringify(node.properties[key]);
                lines.push(`    - ${key}: ${val}`);
            }
        } else {
            lines.push(`  Configured Properties: (none)`);
        }

        if (node.systemInstructions) {
            lines.push(`  Custom System Instructions: "${node.systemInstructions}"`);
        }
        if (node.codeGenerationPrompt) {
            lines.push(`  Custom Code Generation Prompt: "${node.codeGenerationPrompt}"`);
        }
    }

    if (spec.runtimeVariables.length > 0) {
        lines.push(`\nRuntime Variables (${spec.runtimeVariables.length}):`);
        for (const rv of spec.runtimeVariables) {
            lines.push(`  - ${rv.key}: ${JSON.stringify(rv.value)}`);
        }
    }

    const jobKeys = Object.keys(spec.jobConfig);
    if (jobKeys.length > 0) {
        lines.push(`\nJob Configuration:`);
        for (const k of jobKeys) {
            lines.push(`  - ${k}: ${JSON.stringify(spec.jobConfig[k])}`);
        }
    }

    if (spec.edges.length > 0) {
        lines.push(`\nEdges / Connections (${spec.edges.length}):`);
        for (const edge of spec.edges) {
            const handleInfo = edge.sourceHandle ? ` [handle: ${edge.sourceHandle}]` : '';
            lines.push(`  - Source "${edge.source}" -> Target "${edge.target}"${handleInfo}`);
        }
    }

    return lines.join('\n');
}

/**
 * Runs the Pipeline Specification & Property Conformance Evaluator sub-agent.
 *
 * @param ai - Initialized GoogleGenAI client.
 * @param language - Target language ('Java' | 'Python').
 * @param yamlContent - Original pipeline YAML.
 * @param files - All generated files.
 * @returns Specialist evaluation result with category 'SPECIFICATION'.
 */
export async function evaluatePipelineSpecification(
    ai: GoogleGenAI,
    language: 'Java' | 'Python',
    yamlContent: string,
    files: GeneratedFileCandidate[]
): Promise<SpecialistAgentResult> {
    // 1. Parse YAML into structured specification
    const spec = parsePipelineSpec(yamlContent);
    const checklistText = formatSpecChecklist(spec);

    // 2. Build evaluator prompt
    const prompt = `You are the Principal Pipeline Specification & Property Conformance Evaluator Agent.
Your responsibility is auditing generated Apache Beam code to verify that it FAITHFULLY IMPLEMENTS THE EXACT PIPELINE DEFINED IN THE YAML SPECIFICATION.
You must ensure that ALL user-configured node properties, custom instructions, runtime variables, and job configurations are properly incorporated and used.

=== TARGET LANGUAGE ===
${language}
=======================

=== PARSED SPECIFICATION CHECKLIST ===
${checklistText}
======================================

=== FULL INPUT PIPELINE YAML ===
${yamlContent}
================================

=== GENERATED SOURCE FILES & ARTIFACTS ===
${files.map(f => `--- FILE: ${f.filename} ---\n${f.content}\n`).join('\n')}
=========================================

Audit the code against the following Specification Conformance Checklist:
1. **Node Properties Completeness & Utilization:**
   - Inspect every node and its declared properties in the checklist (e.g. driverClassName, url, username, password, tableName, statement, selectType, outputParallelization, autosharding, bootstrapServers, topics, groupId, maxNumRecords, maxReadTime, keyDeserializer, valueDeserializer, keySerializer, useEOS, etc.).
   - Verify that EVERY property explicitly set in the YAML is actually configured, referenced, or applied in the generated code or configuration files.
   - Flag any property that was set by the user in the YAML but is MISSING, SILENTLY OMITTED, or REPLACED with an arbitrary default value.
2. **Custom Instructions & Transform Logic:**
   - If a node defines \`system_instructions\` or \`codeGenerationPrompt\` (e.g. "Wrap the generated code in a try/catch, returning all errors to a separate pcollection", "Convert byteArray to json"), verify that the generated DoFn or transform actually implements that required behavior.
3. **Runtime Variables & Job Configuration:**
   - Verify that declared \`runtimeVariables\` (e.g. JOB_ID) are declared in PipelineOptions or utilized in the pipeline.
   - Verify that \`jobConfig\` settings (e.g. runner, machineType, minInstances, maxInstances, network, subnetwork) are reflected in PipelineOptions or execution runner scripts (\`run_directrunner.sh\`, \`run_dataflowrunner.sh\`).
4. **Transform Types & Topological Fidelity:**
   - Verify that the designated \`beam_transform\` connectors (e.g. JdbcIO, KafkaIO, PubSubIO, ParDo) match what is used in the pipeline code.
   - Verify that error branches (handles with \`error\`) route to their respective DLQ error sinks/steps.

Severity Guidelines:
- CRITICAL: A configured property or user specification required for pipeline execution is completely missing/ignored (e.g. tableName ignored, SQL statement omitted, topic not configured), or custom logic specified in system_instructions was omitted.
- MAJOR: A configured property was replaced with an unintended default value, or runtimeVariables / jobConfig were omitted from pipeline options or runner scripts.
- MINOR: Naming discrepancies or non-blocking unused optional configuration parameters.`;

    const schema = {
        type: "object",
        properties: {
            passed: {
                type: "boolean",
                description: "True if all configured properties and specification requirements are faithfully implemented"
            },
            summary: {
                type: "string",
                description: "Specification conformance assessment summary"
            },
            findings: {
                type: "array",
                items: {
                    type: "object",
                    properties: {
                        id: { type: "string" },
                        category: { type: "string", enum: ["SPECIFICATION"] },
                        severity: { type: "string", enum: ["CRITICAL", "MAJOR", "MINOR"] },
                        file: { type: "string" },
                        description: { type: "string" },
                        rationale: { type: "string" }
                    },
                    required: ["id", "category", "severity", "file", "description", "rationale"]
                }
            }
        },
        required: ["passed", "summary", "findings"]
    };

    // 3. Invoke Gemini model
    const response = await ai.models.generateContent({
        model: DEFAULT_GEMINI_MODEL,
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: schema
        }
    });

    if (!response.text) {
        throw new Error('Empty response from PipelineSpecificationAgent');
    }

    const parsed = JSON.parse(response.text);
    return {
        agentName: 'PipelineSpecificationAgent',
        passed: parsed.passed,
        summary: parsed.summary,
        findings: parsed.findings || []
    };
}
