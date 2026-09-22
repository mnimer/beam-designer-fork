/**
 * Type definitions and contracts for the Multi-Agent Code Evaluation Harness.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Defines domain models, sub-agent result structures, scoring rubrics, and
 * prompt remediation guidance types used during integration testing of the
 * Apache Beam code generation pipeline.
 *
 * Architectural decisions:
 * - Sub-agents output structured findings with severity levels: 'CRITICAL' (hard veto),
 *   'MAJOR' (potential bug or anti-pattern), and 'MINOR' (readability or stylistic improvement).
 * - Findings support 1-indexed line numbers and verbatim code evidence to eliminate hallucinated locations.
 * - Supports Requirement Traceability Matrix (RTM) verifications for 100% specification coverage audit.
 * - The Lead Arbiter calculates category-specific rubric scores (0-100) on confirmed findings
 *   (after filtering out false positives with recorded justification), and produces
 *   actionable Prompt Remediation Directives targeting the generator prompts
 *   (code-gen-prompt-python.txt and code-gen-prompt-java.txt).
 */

export type FindingSeverity = 'CRITICAL' | 'MAJOR' | 'MINOR';

export interface EvaluatorFinding {
    id: string;
    category: 'ARCHITECTURE' | 'SECURITY' | 'PACKAGING' | 'SYNTAX' | 'IDIOMATIC_BEAM' | 'SPECIFICATION';
    severity: FindingSeverity;
    file: string;
    line?: number;
    evidence?: string;
    description: string;
    rationale: string;
}

export interface RequirementVerification {
    reqId: string;
    category: string;
    description: string;
    status: 'VERIFIED' | 'PARTIAL' | 'MISSING';
    evidence?: string;
}

export interface SpecialistAgentResult {
    agentName: string;
    passed: boolean;
    findings: EvaluatorFinding[];
    summary: string;
    requirementVerifications?: RequirementVerification[];
}

export interface DeterministicGateResult {
    syntaxValid: boolean;
    syntaxErrors: string[];
    secretScanPassed: boolean;
    secretFindings: EvaluatorFinding[];
    placeholderErrors?: string[];
    jsonErrors?: string[];
    shellErrors?: string[];
    missingDeliverables?: string[];
}

export interface PromptRemediationDirective {
    targetPromptFile: 'code-gen-prompt-python.txt' | 'code-gen-prompt-java.txt' | 'both';
    targetSection: string;
    recommendedRuleText: string;
    rationale: string;
}

export interface EvaluationScorecard {
    architectureScore: number;    // 0-100
    specificationScore?: number;  // 0-100 (YAML specification & property conformance)
    securityScore: number;        // 0-100
    packagingScore: number;       // 0-100
    maintainabilityScore: number; // 0-100
    overallScore: number;         // 0-100
}

export interface RejectedFinding {
    id: string;
    reason: string;
}

export interface MultiAgentEvaluationResult {
    isGood: boolean;
    scorecard: EvaluationScorecard;
    hardVetoTriggered: boolean;
    hardVetoReasons: string[];
    allFindings: EvaluatorFinding[];
    confirmedFindings?: EvaluatorFinding[];
    rejectedFindings?: RejectedFinding[];
    specialistResults: Record<string, SpecialistAgentResult>;
    promptRemediationDirectives: PromptRemediationDirective[];
    explanation: string;
}
