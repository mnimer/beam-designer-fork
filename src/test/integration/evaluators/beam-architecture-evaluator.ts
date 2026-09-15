/**
 * Beam Architecture Evaluator Sub-Agent.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Evaluates generated Apache Beam pipeline code against core distributed processing
 * architectural invariants, topological fidelity, and known SDK pitfalls.
 *
 * Architectural decisions:
 * - Focuses strictly on Beam DAG semantics: Windowing on unbounded collections,
 *   correct DoFn output tagging (e.g. avoiding silent element drops), DLQ error
 *   routing, and appropriate timer/sequence generator selection.
 * - Adheres to the prompt engineering rules established in TASK.md (e.g. PeriodicImpulse
 *   for Python tick sources rather than cross-language GenerateSequence).
 */

import { GoogleGenAI } from '@google/genai';
import { DEFAULT_GEMINI_MODEL } from '../../../constants';
import { SpecialistAgentResult } from './types';
import { GeneratedFileCandidate } from './deterministic-gate';

/**
 * Runs the Beam Architecture Evaluator sub-agent.
 *
 * @param ai - Initialized GoogleGenAI client.
 * @param language - Target language ('Java' | 'Python').
 * @param yamlContent - Original pipeline YAML.
 * @param files - All generated files.
 * @returns Specialist evaluation result.
 */
export async function evaluateBeamArchitecture(
    ai: GoogleGenAI,
    language: 'Java' | 'Python',
    yamlContent: string,
    files: GeneratedFileCandidate[]
): Promise<SpecialistAgentResult> {
    const prompt = `You are the Principal Beam Architecture Evaluator Agent.
Your responsibility is auditing the generated Apache Beam code for strict DAG fidelity, correct distributed stream processing semantics, and Beam SDK best practices.

=== TARGET LANGUAGE ===
${language}
=======================

=== INPUT PIPELINE DAG SPECIFICATION (YAML) ===
${yamlContent}
================================================

=== GENERATED SOURCE FILES ===
${files.map(f => `--- FILE: ${f.filename} ---\n${f.content}\n`).join('\n')}
===============================

Evaluate the code against the following Beam Architecture Invariants:
1. **DAG Fidelity:** Does the code correctly wire every Source, Transform/Step, and Sink defined in the YAML? Are names and transform logic aligned?
2. **Streaming & Windowing Semantics:** If the pipeline processes streaming/unbounded sources (Pub/Sub, Kafka, SQS, SNS, PeriodicImpulse), is windowing explicitly applied before any GroupByKey, Combine, or aggregation transform?
3. **Output Routing & Tagging Integrity:**
   - In Python: Does any DoFn declaring \`.with_outputs(..., main=...)\` yield bare elements for the main output instead of wrapping in TaggedOutput(main_tag)? (Wrapping main output in TaggedOutput causes Beam to route it to a null receiver, silently dropping all records!).
   - In Java: Are TupleTags declared and matched properly on MultiOutputReceivers?
4. **Timer & Sequence Selection:**
   - In Python: When a periodic trigger or tick source is needed, does it use native \`PeriodicImpulse\` instead of \`ExternalTransform('beam:external:java:generate_sequence:v1')\`?
5. **Dead-Letter Queue (DLQ) & Error Handling:** If the pipeline defines an error branch/DLQ, are exceptions caught in DoFns and routed to the error output collection?

Severity Guidelines:
- CRITICAL: Silent element dropping (e.g. main output TaggedOutput bug), missing windowing on unbounded aggregations, missing pipeline nodes that break execution.
- MAJOR: Inefficient transform patterns (e.g. unnecessary cross-language expansion), incorrect trigger configurations.
- MINOR: Non-idiomatic transform naming or style.`;

    const schema = {
        type: "object",
        properties: {
            passed: {
                type: "boolean",
                description: "True if no CRITICAL or blocking architectural flaws are found"
            },
            summary: {
                type: "string",
                description: "Executive architectural assessment summary"
            },
            findings: {
                type: "array",
                items: {
                    type: "object",
                    properties: {
                        id: { type: "string" },
                        category: { type: "string", enum: ["ARCHITECTURE", "IDIOMATIC_BEAM"] },
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

    const response = await ai.models.generateContent({
        model: DEFAULT_GEMINI_MODEL,
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: schema
        }
    });

    if (!response.text) {
        throw new Error('Empty response from BeamArchitectureAgent');
    }

    const parsed = JSON.parse(response.text);
    return {
        agentName: 'BeamArchitectureAgent',
        passed: parsed.passed,
        summary: parsed.summary,
        findings: parsed.findings || []
    };
}
