/**
 * Lead Arbiter & Synthesizer Evaluator Agent.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Synthesizes reports from the deterministic pre-flight gate and specialized sub-agents.
 * Validates findings against ground-truth line-numbered code, reconciles false positives,
 * produces a multi-dimensional scorecard, checks hard veto rules, and generates
 * actionable Prompt Remediation Directives targeting the prompt files
 * (code-gen-prompt-python.txt / code-gen-prompt-java.txt) whenever an evaluation fails.
 *
 * Architectural decisions:
 * - Does NOT patch the generated code when a test fails. Integration tests validate
 *   the LLM Code Generator itself; therefore, remediation consists of formulating
 *   exact prompt rules to update the prompt templates so the generator ceases
 *   making the error.
 * - Inspects full line-numbered generated source files to verify or reject sub-agent claims.
 * - Filters rejected false-positive findings and recalculates the baseline scorecard
 *   and hard vetoes on confirmed findings only, resolving the false-positive veto trap.
 * - Receives the full generator prompt template (without artificial truncation) so
 *   remediation directives cite real prompt sections and existing rules accurately.
 */

import { GoogleGenAI } from '@google/genai';
import { DEFAULT_GEMINI_MODEL } from '../../../constants';
import {
    DeterministicGateResult,
    SpecialistAgentResult,
    EvaluatorFinding,
    MultiAgentEvaluationResult,
    EvaluationScorecard,
    RejectedFinding,
    generateContentWithRetry
} from './types';
import { GeneratedFileCandidate } from './deterministic-gate';
import { formatFilesWithLineNumbers } from './format-utils';

/**
 * Calculates rule-based baseline scores and vetoes from findings.
 *
 * @param deterministic - Result of the deterministic pre-flight gate.
 * @param subAgentFindings - Consolidated findings from all sub-agents.
 * @returns Scorecard, veto status, and veto reasons.
 */
export function calculateBaselineScorecard(
    deterministic: DeterministicGateResult,
    subAgentFindings: EvaluatorFinding[]
): { scorecard: EvaluationScorecard; hardVetoTriggered: boolean; hardVetoReasons: string[] } {
    let architectureScore = 100;
    let specificationScore = 100;
    let securityScore = 100;
    let packagingScore = 100;
    let maintainabilityScore = 100;

    const hardVetoReasons: string[] = [];

    // Deterministic gate penalties & vetoes
    if (!deterministic.syntaxValid) {
        packagingScore = Math.max(0, packagingScore - 50);
        hardVetoReasons.push(...deterministic.syntaxErrors);
    }

    if (!deterministic.secretScanPassed) {
        securityScore = 0;
        deterministic.secretFindings.forEach(f => {
            if (f.severity === 'CRITICAL') {
                hardVetoReasons.push(`Deterministic Secret Leak: ${f.description} (${f.file})`);
            }
        });
    }

    // Sub-agent findings deductions
    for (const f of subAgentFindings) {
        const deduction = f.severity === 'CRITICAL' ? 35 : f.severity === 'MAJOR' ? 15 : 5;

        switch (f.category) {
            case 'ARCHITECTURE':
            case 'IDIOMATIC_BEAM':
                architectureScore = Math.max(0, architectureScore - deduction);
                if (f.severity === 'CRITICAL') {
                    hardVetoReasons.push(`Critical Architecture Defect: ${f.description} (${f.file})`);
                }
                break;
            case 'SPECIFICATION':
                specificationScore = Math.max(0, specificationScore - deduction);
                if (f.severity === 'CRITICAL') {
                    hardVetoReasons.push(`Critical Specification Defect: ${f.description} (${f.file})`);
                }
                break;
            case 'SECURITY':
                securityScore = Math.max(0, securityScore - deduction);
                if (f.severity === 'CRITICAL') {
                    hardVetoReasons.push(`Critical Security Defect: ${f.description} (${f.file})`);
                }
                break;
            case 'PACKAGING':
            case 'SYNTAX':
                packagingScore = Math.max(0, packagingScore - deduction);
                if (f.severity === 'CRITICAL') {
                    hardVetoReasons.push(`Critical Packaging Defect: ${f.description} (${f.file})`);
                }
                break;
            default:
                maintainabilityScore = Math.max(0, maintainabilityScore - deduction);
        }
    }

    const overallScore = Math.round(
        architectureScore * 0.35 +
        specificationScore * 0.25 +
        securityScore * 0.20 +
        packagingScore * 0.15 +
        maintainabilityScore * 0.05
    );

    const hardVetoTriggered = hardVetoReasons.length > 0 || overallScore < 80;

    return {
        scorecard: {
            architectureScore,
            specificationScore,
            securityScore,
            packagingScore,
            maintainabilityScore,
            overallScore
        },
        hardVetoTriggered,
        hardVetoReasons
    };
}

/**
 * Runs the Lead Arbiter agent to synthesize the final evaluation and generate
 * prompt remediation directives targeting prompt templates.
 */
export async function synthesizeEvaluation(
    ai: GoogleGenAI,
    language: 'Java' | 'Python',
    yamlContent: string,
    files: GeneratedFileCandidate[],
    deterministic: DeterministicGateResult,
    specialistResults: Record<string, SpecialistAgentResult>,
    codeGenPromptTemplate: string
): Promise<MultiAgentEvaluationResult> {
    const allFindings: EvaluatorFinding[] = [
        ...deterministic.secretFindings,
        ...Object.values(specialistResults).flatMap(r => r.findings)
    ];

    const initialBaseline = calculateBaselineScorecard(deterministic, allFindings);

    const prompt = `You are the Lead Arbiter & Quality Assurance Synthesizer Agent for the Apache Beam Code Generator Integration Test Suite.

Your tasks:
1. Synthesize the reports from the Deterministic Gate and Specialist Sub-Agents:
   - BeamArchitectureAgent (DAG semantics, windowing, DoFn tagged output routing, DLQ, serialization)
   - PipelineSpecificationAgent (YAML property completeness, custom instructions, runtime variables, jobConfig)
   - SecurityAndHardeningAgent (Secret Manager, container hardening, shell quoting)
   - PackagingAndDeployabilityAgent (dependencies, manifest syntax, runner scripts)
2. Ground-Truth Validation & False-Positive Reconciliation:
   - Carefully cross-reference each specialist finding against the generated line-numbered code below.
   - If a finding is a FALSE POSITIVE (e.g. the sub-agent claimed a property was omitted or insecure, but the line-numbered code actually implements it correctly), list its ID in \`rejectedFindingIds\` with a clear explanation in \`rejectedFindings\`.
3. Actionable Prompt Remediation Directives:
   - When the test fails or exhibits real defects, DO NOT patch or rewrite the generated code.
   - Formulate actionable **Prompt Remediation Directives** targeting the generator prompt template:
     - DEDUPLICATION & CONSOLIDATION: Group and summarize all recommendations before creating directives. If multiple specialist findings stem from the same root issue (e.g. container tag determinism, Dockerfile non-root permissions, shell variable quoting, or DLQ payload logging), synthesize them into a SINGLE cohesive, actionable rule directive rather than generating duplicate tips.
     - Target files: 'code-gen-prompt-python.txt' and/or 'code-gen-prompt-java.txt'
     - Specify the exact section and concrete instruction wording to add or modify in the prompt template so that the generator model avoids this error in future generations.

=== TARGET LANGUAGE ===
${language}
=======================

=== INPUT PIPELINE YAML ===
${yamlContent}

=== GENERATED SOURCE CODE & ARTIFACTS (LINE NUMBERED) ===
${formatFilesWithLineNumbers(files)}
==========================================================

=== DETERMINISTIC PRE-FLIGHT RESULTS ===
Syntax Valid: ${deterministic.syntaxValid}
Syntax Errors: ${JSON.stringify(deterministic.syntaxErrors)}
Secret Scan Passed: ${deterministic.secretScanPassed}
Secret Findings: ${JSON.stringify(deterministic.secretFindings)}

=== SPECIALIST SUB-AGENT REPORTS ===
${JSON.stringify(specialistResults, null, 2)}

=== CURRENT CODE GENERATION PROMPT TEMPLATE ===
${codeGenPromptTemplate}
===============================================

=== INITIAL RAW BASELINE SCORES & VETOES ===
Hard Veto Triggered: ${initialBaseline.hardVetoTriggered}
Hard Veto Reasons: ${JSON.stringify(initialBaseline.hardVetoReasons)}
Scorecard: ${JSON.stringify(initialBaseline.scorecard)}

Provide your synthesis in JSON.`;

    const schema = {
        type: "object",
        properties: {
            isGood: {
                type: "boolean",
                description: "Final verdict: true only if code satisfies all requirements and has no unaddressed critical defects"
            },
            explanation: {
                type: "string",
                description: "Executive synthesis summarizing why the test passed or failed"
            },
            rejectedFindingIds: {
                type: "array",
                description: "IDs of any specialist findings determined to be false positives",
                items: { type: "string" }
            },
            rejectedFindings: {
                type: "array",
                description: "Detailed justifications for each rejected false-positive finding",
                items: {
                    type: "object",
                    properties: {
                        id: { type: "string" },
                        reason: { type: "string" }
                    },
                    required: ["id", "reason"]
                }
            },
            promptRemediationDirectives: {
                type: "array",
                description: "Actionable directives to update the code-gen-prompt-python.txt or code-gen-prompt-java.txt prompt files to prevent repeated failures",
                items: {
                    type: "object",
                    properties: {
                        targetPromptFile: {
                            type: "string",
                            enum: ["code-gen-prompt-python.txt", "code-gen-prompt-java.txt", "both"]
                        },
                        targetSection: {
                            type: "string",
                            description: "The prompt section to modify (e.g. Common Pitfalls, Security, Windowing Rules)"
                        },
                        recommendedRuleText: {
                            type: "string",
                            description: "Exact rule text or constraint to add to the prompt"
                        },
                        rationale: {
                            type: "string",
                            description: "Why this prompt adjustment will prevent the generator from repeating the mistake"
                        }
                    },
                    required: ["targetPromptFile", "targetSection", "recommendedRuleText", "rationale"]
                }
            }
        },
        required: ["isGood", "explanation", "promptRemediationDirectives"]
    };

    const response = await generateContentWithRetry(ai, {
        model: DEFAULT_GEMINI_MODEL,
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: schema,
            temperature: 0.1
        }
    });

    if (!response.text) {
        throw new Error('Empty response from Lead Arbiter Agent');
    }

    const parsed = JSON.parse(response.text);

    // Filter out rejected false-positive findings
    const rejectedIds = new Set<string>(parsed.rejectedFindingIds || []);
    const confirmedFindings = allFindings.filter(f => !rejectedIds.has(f.id));

    // Recalculate scorecard and hard vetoes on confirmed findings only
    const finalBaseline = calculateBaselineScorecard(deterministic, confirmedFindings);
    const finalIsGood = !finalBaseline.hardVetoTriggered && parsed.isGood;

    const rejectedFindings: RejectedFinding[] = parsed.rejectedFindings || [];

    return {
        isGood: finalIsGood,
        scorecard: finalBaseline.scorecard,
        hardVetoTriggered: finalBaseline.hardVetoTriggered,
        hardVetoReasons: finalBaseline.hardVetoReasons,
        allFindings,
        confirmedFindings,
        rejectedFindings,
        specialistResults,
        promptRemediationDirectives: parsed.promptRemediationDirectives || [],
        explanation: parsed.explanation
    };
}
