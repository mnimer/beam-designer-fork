/**
 * Multi-Agent Evaluation Orchestrator.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Coordinates the full end-to-end evaluation lifecycle:
 * 1. Runs the Deterministic Pre-Flight Gate (syntax compilation + regex secret scan).
 * 2. Concurrently invokes the 3 specialized sub-agents:
 *    - BeamArchitectureAgent
 *    - SecurityAndHardeningAgent
 *    - PackagingAndDeployabilityAgent
 * 3. Dispatches results to the Lead Arbiter Agent for scoring, hard veto enforcement,
 *    and automated Prompt Remediation Directive generation for the prompt templates.
 *
 * Architectural decisions:
 * - Runs specialist evaluations concurrently via Promise.all to minimize evaluation latency.
 * - Formats rich markdown scorecards and explicit prompt remediation guidance in test output.
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
    console.log(`   [MultiAgentEvaluator] 1. Running Deterministic Pre-flight Gate...`);
    const deterministic = await runDeterministicGate(files, language);
    if (!deterministic.syntaxValid) {
        console.warn(`   [DeterministicGate] ⚠️ Syntax errors detected:`, deterministic.syntaxErrors);
    }
    if (!deterministic.secretScanPassed) {
        console.warn(`   [DeterministicGate] ⚠️ Secret scan failed with ${deterministic.secretFindings.length} issues`);
    }

    console.log(`   [MultiAgentEvaluator] 2. Spawning Specialist Sub-Agents concurrently...`);
    const [beamArch, pipelineSpec, security, packaging] = await Promise.all([
        evaluateBeamArchitecture(ai, language, yamlContent, files).catch((err): SpecialistAgentResult => ({
            agentName: 'BeamArchitectureAgent',
            passed: false,
            summary: `Error invoking BeamArchitectureAgent: ${err.message}`,
            findings: [{
                id: 'ERR-ARCH-SUBAGENT',
                category: 'ARCHITECTURE',
                severity: 'MAJOR',
                file: 'system',
                description: `BeamArchitectureAgent invocation failed: ${err.message}`,
                rationale: 'Subagent runtime error'
            }]
        })),
        evaluatePipelineSpecification(ai, language, yamlContent, files).catch((err): SpecialistAgentResult => ({
            agentName: 'PipelineSpecificationAgent',
            passed: false,
            summary: `Error invoking PipelineSpecificationAgent: ${err.message}`,
            findings: [{
                id: 'ERR-SPEC-SUBAGENT',
                category: 'SPECIFICATION',
                severity: 'MAJOR',
                file: 'system',
                description: `PipelineSpecificationAgent invocation failed: ${err.message}`,
                rationale: 'Subagent runtime error'
            }]
        })),
        evaluateSecurityAndHardening(ai, language, files).catch((err): SpecialistAgentResult => ({
            agentName: 'SecurityAndHardeningAgent',
            passed: false,
            summary: `Error invoking SecurityAndHardeningAgent: ${err.message}`,
            findings: [{
                id: 'ERR-SEC-SUBAGENT',
                category: 'SECURITY',
                severity: 'MAJOR',
                file: 'system',
                description: `SecurityAndHardeningAgent invocation failed: ${err.message}`,
                rationale: 'Subagent runtime error'
            }]
        })),
        evaluatePackagingAndDeployability(ai, language, files).catch((err): SpecialistAgentResult => ({
            agentName: 'PackagingAndDeployabilityAgent',
            passed: false,
            summary: `Error invoking PackagingAndDeployabilityAgent: ${err.message}`,
            findings: [{
                id: 'ERR-PKG-SUBAGENT',
                category: 'PACKAGING',
                severity: 'MAJOR',
                file: 'system',
                description: `PackagingAndDeployabilityAgent invocation failed: ${err.message}`,
                rationale: 'Subagent runtime error'
            }]
        }))
    ]);

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

    if (result.allFindings.length > 0) {
        lines.push(`\n🔍 Findings (${result.allFindings.length}):`);
        result.allFindings.forEach((f, idx) => {
            const icon = f.severity === 'CRITICAL' ? '🔴' : f.severity === 'MAJOR' ? '🟠' : '🟡';
            lines.push(`   ${idx + 1}. [${f.category}] ${icon} ${f.severity}: ${f.description} (${f.file})`);
            lines.push(`      Rationale: ${f.rationale}`);
        });
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
