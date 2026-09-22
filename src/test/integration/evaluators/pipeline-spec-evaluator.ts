/**
 * Pipeline Specification & Property Conformance Evaluator Sub-Agent.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Audits generated Apache Beam code, runner scripts, build manifests, and deployment
 * artifacts against the visual DAG specification (YAML) using a formal
 * Requirement Traceability Matrix (RTM).
 *
 * Architectural decisions:
 * - Generates explicit requirement IDs (`REQ-NODE-*`, `REQ-INSTR-*`, `REQ-VAR-*`, `REQ-CONFIG-*`, `REQ-EDGE-*`).
 * - Mandates that the evaluator output a verification record for every requirement ID
 *   with status (`VERIFIED` | `PARTIAL` | `MISSING`) and verbatim line-numbered code evidence.
 * - Any `MISSING` requirement automatically produces a CRITICAL or MAJOR finding.
 * - Formats all generated files with 1-indexed line numbers.
 */

import * as yaml from 'yaml';
import { GoogleGenAI } from '@google/genai';
import { DEFAULT_GEMINI_MODEL } from '../../../constants';
import { SpecialistAgentResult, RequirementVerification } from './types';
import { GeneratedFileCandidate } from './deterministic-gate';
import { formatFilesWithLineNumbers } from './format-utils';

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

export interface SpecRequirementItem {
    reqId: string;
    category: string;
    description: string;
    expected: string;
}

/**
 * Safely parses the pipeline YAML string into a structured specification model.
 *
 * @param yamlContent - Raw pipeline YAML content.
 * @returns Structured ParsedPipelineSpec object.
 */
export function parsePipelineSpec(yamlContent: string): ParsedPipelineSpec {
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

        const rawVars = Array.isArray(parsed.runtimeVariables) ? parsed.runtimeVariables : [];
        const runtimeVariables = rawVars.map((v: any) => ({
            key: String(v.key || ''),
            value: v.value
        })).filter((v: any) => v.key.length > 0);

        const jobConfig = typeof parsed.jobConfig === 'object' && parsed.jobConfig !== null ? parsed.jobConfig : {};
        const pipelineConfig = typeof parsed.pipelineConfig === 'object' && parsed.pipelineConfig !== null ? parsed.pipelineConfig : {};

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
 * Extracts a flattened Requirement Traceability Matrix (RTM) from the specification.
 *
 * @param spec - Parsed pipeline specification.
 * @returns Array of explicit requirement items with deterministic IDs.
 */
export function generateRequirementMatrix(spec: ParsedPipelineSpec): SpecRequirementItem[] {
    const items: SpecRequirementItem[] = [];

    // 1. Node properties
    spec.nodes.forEach((node, nodeIdx) => {
        const nodeNum = nodeIdx + 1;
        const transformDesc = node.beamTransform ? ` (${node.beamTransform})` : '';

        Object.entries(node.properties).forEach(([k, v]) => {
            items.push({
                reqId: `REQ-NODE-${nodeNum}-${k.toUpperCase()}`,
                category: 'NODE_PROPERTY',
                description: `Node "${node.label}"${transformDesc} property: ${k}`,
                expected: JSON.stringify(v)
            });
        });

        if (node.systemInstructions) {
            items.push({
                reqId: `REQ-INSTR-${nodeNum}`,
                category: 'CUSTOM_INSTRUCTIONS',
                description: `Node "${node.label}" custom system instructions`,
                expected: node.systemInstructions
            });
        }

        if (node.codeGenerationPrompt) {
            items.push({
                reqId: `REQ-PROMPT-${nodeNum}`,
                category: 'CUSTOM_PROMPT',
                description: `Node "${node.label}" custom code generation prompt`,
                expected: node.codeGenerationPrompt
            });
        }
    });

    // 2. Runtime variables
    spec.runtimeVariables.forEach(rv => {
        items.push({
            reqId: `REQ-VAR-${rv.key.toUpperCase()}`,
            category: 'RUNTIME_VARIABLE',
            description: `Runtime variable ${rv.key}`,
            expected: JSON.stringify(rv.value)
        });
    });

    // 3. Job configuration
    Object.entries(spec.jobConfig).forEach(([k, v]) => {
        if (v !== '' && v !== null && v !== undefined) {
            items.push({
                reqId: `REQ-CONFIG-${k.toUpperCase()}`,
                category: 'JOB_CONFIG',
                description: `Job configuration ${k}`,
                expected: JSON.stringify(v)
            });
        }
    });

    // 4. Edges and DLQ routing
    spec.edges.forEach((edge, edgeIdx) => {
        const handle = edge.sourceHandle ? ` via handle '${edge.sourceHandle}'` : '';
        items.push({
            reqId: `REQ-EDGE-${edgeIdx + 1}`,
            category: 'TOPOLOGY_EDGE',
            description: `Edge from ${edge.source} to ${edge.target}${handle}`,
            expected: `Connects output to input${edge.sourceHandle ? ` with output tag '${edge.sourceHandle}'` : ''}`
        });
    });

    return items;
}

/**
 * Formats a parsed pipeline specification into a human-readable checklist and RTM table.
 *
 * @param spec - Structured ParsedPipelineSpec.
 * @returns Formatted checklist string.
 */
export function formatSpecChecklist(spec: ParsedPipelineSpec): string {
    const lines: string[] = [];
    const rtm = generateRequirementMatrix(spec);

    lines.push(`Total Nodes: ${spec.nodes.length}`);
    if (spec.nodes.length === 0 && rtm.length === 0) {
        return lines.join('\n');
    }

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

    lines.push(`\nTotal Traceable Requirements: ${rtm.length}`);
    lines.push('');
    lines.push('| Requirement ID | Category | Description | Expected Value / Behavior |');
    lines.push('| :--- | :--- | :--- | :--- |');

    for (const item of rtm) {
        const cleanExpected = item.expected.replace(/\n/g, ' ').substring(0, 100);
        lines.push(`| \`${item.reqId}\` | ${item.category} | ${item.description} | ${cleanExpected} |`);
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
    const spec = parsePipelineSpec(yamlContent);
    const rtm = generateRequirementMatrix(spec);
    const checklistText = formatSpecChecklist(spec);

    const prompt = `You are the Principal Pipeline Specification & Property Conformance Evaluator Agent.
Your responsibility is auditing generated Apache Beam code to verify that it FAITHFULLY IMPLEMENTS 100% OF THE SPECIFICATION.
You must verify each requirement in the Requirement Traceability Matrix (RTM) below against the line-numbered code.

=== TARGET LANGUAGE ===
${language}
=======================

=== REQUIREMENT TRACEABILITY MATRIX (RTM) ===
${checklistText}
=============================================

=== FULL INPUT PIPELINE YAML ===
${yamlContent}
================================

=== GENERATED SOURCE FILES & ARTIFACTS (LINE NUMBERED) ===
${formatFilesWithLineNumbers(files)}
==========================================================

Instructions:
1. Verify EVERY requirement in the RTM. For each \`reqId\`, determine whether it is:
   - \`VERIFIED\`: Fully implemented and faithfully utilized.
   - \`PARTIAL\`: Partially implemented or substituted with an unintended default value.
   - \`MISSING\`: Completely omitted or silently ignored in the generated code.
2. Provide verbatim line-numbered code evidence for each verification.
3. For any requirement marked \`MISSING\` or \`PARTIAL\`, emit a corresponding finding in \`findings[]\`.
   - CRITICAL: Omission of functional transform parameters (e.g. tableName, topic, SQL statement, custom system_instructions logic, or DLQ routing).
   - MAJOR: Substitution of configured property with arbitrary default, missing runtime variable, or omitted jobConfig parameter.
   - MINOR: Optional cosmetic discrepancy.`;

    const schema = {
        type: "object",
        properties: {
            passed: {
                type: "boolean",
                description: "True if all requirements are VERIFIED without any CRITICAL or MAJOR omissions"
            },
            summary: {
                type: "string",
                description: "Specification conformance assessment summary"
            },
            requirementVerifications: {
                type: "array",
                description: "Full audit record verifying each requirement in the RTM",
                items: {
                    type: "object",
                    properties: {
                        reqId: { type: "string" },
                        category: { type: "string" },
                        description: { type: "string" },
                        status: { type: "string", enum: ["VERIFIED", "PARTIAL", "MISSING"] },
                        evidence: { type: "string" }
                    },
                    required: ["reqId", "category", "description", "status"]
                }
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
                        line: { type: "integer" },
                        evidence: { type: "string" },
                        description: { type: "string" },
                        rationale: { type: "string" }
                    },
                    required: ["id", "category", "severity", "file", "description", "rationale"]
                }
            }
        },
        required: ["passed", "summary", "findings", "requirementVerifications"]
    };

    const response = await ai.models.generateContent({
        model: DEFAULT_GEMINI_MODEL,
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: schema,
            temperature: 0.1
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
        findings: parsed.findings || [],
        requirementVerifications: parsed.requirementVerifications || []
    };
}
