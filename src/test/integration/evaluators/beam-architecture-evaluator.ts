/**
 * Beam Architecture Evaluator Sub-Agent.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Evaluates generated Apache Beam pipeline code against core distributed processing
 * architectural invariants, topological fidelity, serialization safety, and unit test quality.
 *
 * Architectural decisions:
 * - Focuses strictly on Beam DAG semantics: Windowing on unbounded collections,
 *   correct DoFn output tagging (e.g. avoiding silent element drops), DLQ error
 *   routing, and appropriate timer/sequence generator selection.
 * - Audits DoFn serialization invariants: client and connection instantiation in setup(),
 *   not in __init__ or class definition.
 * - Audits generated unit test files (*_test.py / *Test.java) for TestPipeline and assert_that usage.
 * - Injects 1-indexed line numbers to ground all findings.
 */

import { GoogleGenAI } from '@google/genai';
import { DEFAULT_GEMINI_MODEL } from '../../../constants';
import { SpecialistAgentResult } from './types';
import { GeneratedFileCandidate } from './deterministic-gate';
import { formatFilesWithLineNumbers } from './format-utils';

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
Your responsibility is auditing the generated Apache Beam code for strict DAG fidelity, correct distributed stream processing semantics, DoFn serialization safety, and unit test quality.

=== TARGET LANGUAGE ===
${language}
=======================

=== INPUT PIPELINE DAG SPECIFICATION (YAML) ===
${yamlContent}
================================================

=== GENERATED SOURCE FILES & ARTIFACTS (LINE NUMBERED) ===
${formatFilesWithLineNumbers(files)}
==========================================================

Evaluate the code against the following Beam Architecture Invariants:
1. **DAG Fidelity:** Does the code correctly wire every Source, Transform/Step, and Sink defined in the YAML? Are names and transform logic aligned?
2. **Streaming & Windowing Semantics:** If the pipeline processes streaming/unbounded sources (Pub/Sub, Kafka, SQS, SNS, PeriodicImpulse), is windowing explicitly applied before any GroupByKey, Combine, or aggregation transform?
3. **Output Routing & Tagging Integrity:**
   - In Python: Does any DoFn declaring \`.with_outputs(..., main=...)\` yield bare elements for the main output instead of wrapping in TaggedOutput(main_tag)? (Wrapping main output in TaggedOutput causes Beam to route it to a null receiver, silently dropping all records!).
   - In Java: Are TupleTags declared and matched properly on MultiOutputReceivers?
4. **Serialization & Lifecycle Invariants:**
   - Are external connections, database clients, and Secret Manager clients instantiated inside \`setup()\` or \`open()\`, NEVER in \`__init__\` or class definitions (which causes serialization errors during distributed worker staging)?
5. **Dead-Letter Queue (DLQ) & Error Handling:** If the pipeline defines an error branch/DLQ, are exceptions caught in DoFns and routed to the error output collection?
6. **Generated Unit Test Quality (*_test.py / *Test.java):**
   - Does the unit test use Beam's \`TestPipeline\` rather than standard \`Pipeline\`?
   - Does it inject mock test data using \`beam.Create\` / \`Create.of\`?
   - Does it assert output correctness using \`assert_that\` and Beam matchers (e.g. \`equal_to\`), rather than dummy pass statements?

Severity Guidelines:
- CRITICAL: Silent element dropping (e.g. main output TaggedOutput bug), missing windowing on unbounded aggregations, missing pipeline nodes that break execution, un-serializable connection objects in __init__.
- MAJOR: Inefficient transform patterns, missing unit test assertions, dummy unit test functions.
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
                        line: { type: "integer" },
                        evidence: { type: "string" },
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
            responseSchema: schema,
            temperature: 0.1
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
