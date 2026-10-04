/**
 * Multi-Agent Evaluation Orchestrator.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Coordinates the full end-to-end evaluation lifecycle:
 * 1. Runs the Deterministic Pre-Flight Gate (syntax, bash -n, JSON, XML, placeholders, secret scan).
 * 2. Concurrently invokes the 4 specialized sub-agents:
 *    - BeamArchitectureAgent
 *    - PipelineSpecificationAgent (with Requirement Traceability Matrix)
 *    - SecurityAndHardeningAgent (with gemini-3.8-flash-cyber / fallback)
 *    - PackagingAndDeployabilityAgent
 * 3. Dispatches results to the Lead Arbiter Agent with full code visibility for scoring,
 *    false-positive reconciliation, hard veto enforcement, and prompt remediation.
 *
 * Architectural decisions:
 * - Subagent catch blocks do NOT inject synthetic MAJOR code-defect findings into the code
 *   quality scorecard for network/503/timeout errors.
 * - Passes full line-numbered files to Lead Arbiter to enable accurate verification.
 * - Formats rich terminal reports including scorecard, confirmed findings, rejected false positives,
 *   and actionable prompt remediation directives.
 */

import { GoogleGenAI } from '@google/genai';
import { GeneratedFileCandidate, runDeterministicGate } from './deterministic-gate';
import { evaluateBeamArchitecture } from './beam-architecture-evaluator';
import { evaluatePipelineSpecification } from './pipeline-spec-evaluator';
import { evaluateSecurityAndHardening } from './security-evaluator';
import { evaluatePackagingAndDeployability } from './packaging-evaluator';
import { synthesizeEvaluation } from './arbiter-evaluator';
import { MultiAgentEvaluationResult, SpecialistAgentResult } from './types';

/**
 * Runs the comprehensive multi-agent code evaluation harness.
 *
 * @param ai - Initialized GoogleGenAI client.
 * @param language - Target language ('Java' | 'Python').
 * @param yamlContent - Original pipeline YAML content.
 * @param codeGenPrompt - Full prompt template string used for generation.
 * @param files - All generated files.
 * @returns Complete evaluation result with scorecard and prompt recommendations.
 */
export async function runMultiAgentEvaluation(
    ai: GoogleGenAI,
    language: 'Java' | 'Python',
    yamlContent: string,
    codeGenPrompt: string,
    files: GeneratedFileCandidate[]
): Promise<MultiAgentEvaluationResult> {
    console.log(`   [MultiAgentEvaluator] 1. Running Deterministic Gate + 4 Specialist Sub-Agents in parallel...`);
    const [deterministic, beamArch, pipelineSpec, security, packaging] = await Promise.all([
        runDeterministicGate(files, language),
        evaluateBeamArchitecture(ai, language, yamlContent, files).catch((err): SpecialistAgentResult => {
            console.error(`   [MultiAgentEvaluator] ⚠️ BeamArchitectureAgent error: ${err.message}`);
            return {
                agentName: 'BeamArchitectureAgent',
                passed: false,
                summary: `Subagent infrastructure/API error: ${err.message}`,
                findings: [] // NOTE: Do not dock code quality points for subagent API errors
            };
        }),
        evaluatePipelineSpecification(ai, language, yamlContent, files).catch((err): SpecialistAgentResult => {
            console.error(`   [MultiAgentEvaluator] ⚠️ PipelineSpecificationAgent error: ${err.message}`);
            return {
                agentName: 'PipelineSpecificationAgent',
                passed: false,
                summary: `Subagent infrastructure/API error: ${err.message}`,
                findings: []
            };
        }),
        evaluateSecurityAndHardening(ai, language, files).catch((err): SpecialistAgentResult => {
            console.error(`   [MultiAgentEvaluator] ⚠️ SecurityAndHardeningAgent error: ${err.message}`);
            return {
                agentName: 'SecurityAndHardeningAgent',
                passed: false,
                summary: `Subagent infrastructure/API error: ${err.message}`,
                findings: []
            };
        }),
        evaluatePackagingAndDeployability(ai, language, files).catch((err): SpecialistAgentResult => {
            console.error(`   [MultiAgentEvaluator] ⚠️ PackagingAndDeployabilityAgent error: ${err.message}`);
            return {
                agentName: 'PackagingAndDeployabilityAgent',
                passed: false,
                summary: `Subagent infrastructure/API error: ${err.message}`,
                findings: []
            };
        })
    ]);

    if (!deterministic.syntaxValid) {
        console.warn(`   [DeterministicGate] ⚠️ Syntax errors detected:`, deterministic.syntaxErrors);
    }
    if (!deterministic.secretScanPassed) {
        console.warn(`   [DeterministicGate] ⚠️ Secret scan failed with ${deterministic.secretFindings.length} issues`);
    }

    const specialistResults: Record<string, SpecialistAgentResult> = {
        BeamArchitectureAgent: beamArch,
        PipelineSpecificationAgent: pipelineSpec,
        SecurityAndHardeningAgent: security,
        PackagingAndDeployabilityAgent: packaging
    };

    console.log(`   [MultiAgentEvaluator] 3. Running Lead Arbiter & Synthesizer Agent...`);
    const result = await synthesizeEvaluation(
        ai,
        language,
        yamlContent,
        files,
        deterministic,
        specialistResults,
        codeGenPrompt
    );

    return result;
}

/**
 * Formats a MultiAgentEvaluationResult into a readable terminal/log string.
 *
 * @param result - The evaluation result.
 * @param language - Target language.
 * @returns Human-readable formatted report.
 */
export function formatEvaluationReport(result: MultiAgentEvaluationResult, language: string): string {
    const lines: string[] = [];

    lines.push(`\n======================================================`);
    lines.push(`📊 EVALUATION SCORECARD (${language})`);
    lines.push(`======================================================`);
    lines.push(`   Status:       ${result.isGood ? '✅ PASSED' : '❌ FAILED'}`);
    lines.push(`   Overall:      ${result.scorecard.overallScore} / 100`);
    lines.push(`   Architecture: ${result.scorecard.architectureScore} / 100`);
    if (result.scorecard.specificationScore !== undefined) {
        lines.push(`   Specification:${result.scorecard.specificationScore} / 100`);
    }
    lines.push(`   Security:     ${result.scorecard.securityScore} / 100`);
    lines.push(`   Packaging:    ${result.scorecard.packagingScore} / 100`);
    lines.push(`   Maintainability: ${result.scorecard.maintainabilityScore} / 100`);

    if (result.hardVetoTriggered) {
        lines.push(`\n🚨 HARD VETO TRIGGERED:`);
        result.hardVetoReasons.forEach(r => lines.push(`   - ${r}`));
    }

    lines.push(`\n📝 Executive Explanation:`);
    lines.push(`   ${result.explanation}`);

    // Confirmed findings
    const confirmed = result.confirmedFindings || result.allFindings;
    if (confirmed.length > 0) {
        lines.push(`\n🔍 Confirmed Findings (${confirmed.length}):`);
        confirmed.forEach((f, idx) => {
            const icon = f.severity === 'CRITICAL' ? '🔴' : f.severity === 'MAJOR' ? '🟠' : '🟡';
            const loc = f.line ? ` (${f.file}:${f.line})` : ` (${f.file})`;
            lines.push(`   ${idx + 1}. [${f.category}] ${icon} ${f.severity}: ${f.description}${loc}`);
            if (f.evidence) {
                lines.push(`      Evidence: ${f.evidence}`);
            }
            lines.push(`      Rationale: ${f.rationale}`);
        });
    }

    // Rejected false-positive findings
    if (result.rejectedFindings && result.rejectedFindings.length > 0) {
        lines.push(`\n🛡️ Reconciled False Positives (${result.rejectedFindings.length}):`);
        result.rejectedFindings.forEach((rf, idx) => {
            lines.push(`   ${idx + 1}. [REJECTED: ${rf.id}] ${rf.reason}`);
        });
    }

    // RTM Verifications
    const specResult = result.specialistResults?.PipelineSpecificationAgent;
    if (specResult?.requirementVerifications && specResult.requirementVerifications.length > 0) {
        const verified = specResult.requirementVerifications.filter(v => v.status === 'VERIFIED').length;
        const total = specResult.requirementVerifications.length;
        lines.push(`\n📋 Requirement Traceability: ${verified}/${total} requirements verified (${Math.round((verified / total) * 100)}%)`);
    }

    if (result.promptRemediationDirectives.length > 0) {
        lines.push(`\n💡 PROMPT REMEDIATION DIRECTIVES (Targeting Generator Prompts):`);
        lines.push(`   NOTE: Integration tests test the generator prompts. Do not patch test code.`);
        lines.push(`   Update the corresponding prompt file(s) with these directives:`);
        result.promptRemediationDirectives.forEach((dir, idx) => {
            lines.push(`\n   --- Directive #${idx + 1} for ${dir.targetPromptFile} ---`);
            lines.push(`   Target Section: ${dir.targetSection}`);
            lines.push(`   Recommended Rule:`);
            lines.push(`   ${dir.recommendedRuleText.split('\n').map(l => '     ' + l).join('\n')}`);
            lines.push(`   Rationale: ${dir.rationale}`);
        });
    }

    lines.push(`======================================================\n`);
    return lines.join('\n');
}
