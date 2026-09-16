/**
 * Unit Tests for the Multi-Agent Evaluation Harness.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Tests the deterministic pre-flight gate, baseline scoring engine, hard veto rules,
 * report formatting, and prompt remediation directive generation under simple,
 * extreme, and failure conditions.
 */

import { describe, it, expect, vi } from 'vitest';
import {
    checkPythonSyntax,
    checkJavaStructure,
    scanForPlaintextSecrets,
    runDeterministicGate
} from '../integration/evaluators/deterministic-gate';
import {
    calculateBaselineScorecard,
    synthesizeEvaluation
} from '../integration/evaluators/arbiter-evaluator';
import {
    formatEvaluationReport,
    runMultiAgentEvaluation
} from '../integration/evaluators/multi-agent-evaluator';
import {
    DeterministicGateResult,
    EvaluatorFinding,
    MultiAgentEvaluationResult,
    SpecialistAgentResult
} from '../integration/evaluators/types';

describe('Deterministic Pre-Flight Gate', () => {
    describe('checkPythonSyntax', () => {
        it('identifies valid Python code without syntax errors (simple condition)', async () => {
            const validPy = `
import apache_beam as beam

def run():
    with beam.Pipeline() as p:
        lines = p | 'Create' >> beam.Create(['hello', 'world'])
        lines | 'Print' >> beam.Map(print)
`;
            const error = await checkPythonSyntax('pipeline.py', validPy);
            expect(error).toBeNull();
        });

        it('detects syntax errors in Python code with error details (failure condition)', async () => {
            const invalidPy = `
def run(
    print("missing closing paren and colon"
`;
            const error = await checkPythonSyntax('broken.py', invalidPy);
            expect(error).not.toBeNull();
            expect(error).toContain('broken.py');
        });

        it('handles empty files gracefully (extreme condition)', async () => {
            const error = await checkPythonSyntax('empty.py', '');
            expect(error).toBeNull();
        });
    });

    describe('checkJavaStructure', () => {
        it('validates matching braces and class name in Java code (simple condition)', () => {
            const validJava = `
package com.example;

public class MyPipeline {
    public static void main(String[] args) {
        System.out.println("Hello Beam");
    }
}
`;
            const error = checkJavaStructure('MyPipeline.java', validJava);
            expect(error).toBeNull();
        });

        it('detects unbalanced closing braces (failure condition)', () => {
            const unbalancedJava = `
public class MyPipeline {
    public static void main(String[] args) {
    }}
}
`;
            const error = checkJavaStructure('MyPipeline.java', unbalancedJava);
            expect(error).not.toBeNull();
            expect(error).toContain('Unmatched closing brace');
        });

        it('detects unclosed opening braces (failure condition)', () => {
            const unclosedJava = `
public class MyPipeline {
    public static void main(String[] args) {
`;
            const error = checkJavaStructure('MyPipeline.java', unclosedJava);
            expect(error).not.toBeNull();
            expect(error).toContain('Unclosed brace');
        });

        it('detects class name mismatch with file name (failure condition)', () => {
            const mismatchedJava = `
public class OtherPipeline {
}
`;
            const error = checkJavaStructure('ExpectedPipeline.java', mismatchedJava);
            expect(error).not.toBeNull();
            expect(error).toContain("Public class 'OtherPipeline' does not match filename 'ExpectedPipeline.java'");
        });

        it('ignores braces inside strings and comments (extreme condition)', () => {
            const trickyJava = `
public class MyTrickyPipeline {
    // Single line with {
    /* Multi line with
       { and } */
    String test = "{ this is a string with braces }";
}
`;
            const error = checkJavaStructure('MyTrickyPipeline.java', trickyJava);
            expect(error).toBeNull();
        });
    });

    describe('scanForPlaintextSecrets', () => {
        it('flags hardcoded AWS access key IDs (failure condition)', () => {
            const files = [
                {
                    filename: 'pipeline.py',
                    content: 'aws_access_key = "AKIAIOSFODNN7EXAMPLE"'
                }
            ];
            const findings = scanForPlaintextSecrets(files);
            expect(findings.length).toBe(1);
            expect(findings[0].category).toBe('SECURITY');
            expect(findings[0].severity).toBe('CRITICAL');
            expect(findings[0].description).toContain('AWS Access Key ID');
        });

        it('flags hardcoded private keys (failure condition)', () => {
            const files = [
                {
                    filename: 'cert.pem',
                    content: '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA0...'
                }
            ];
            const findings = scanForPlaintextSecrets(files);
            expect(findings.length).toBe(1);
            expect(findings[0].severity).toBe('CRITICAL');
        });

        it('flags plaintext JDBC passwords in URLs (failure condition)', () => {
            const files = [
                {
                    filename: 'config.properties',
                    content: 'url=jdbc:postgresql://localhost:5432/mydb?password=supersecretpassword'
                }
            ];
            const findings = scanForPlaintextSecrets(files);
            expect(findings.length).toBe(1);
            expect(findings[0].description).toContain('Plaintext password embedded in JDBC connection URL');
        });

        it('allows parameterised or Secret Manager placeholders without false positives (simple condition)', () => {
            const files = [
                {
                    filename: 'pipeline.py',
                    content: 'url = "jdbc:postgresql://localhost:5432/mydb?password=${DB_PASSWORD}"'
                },
                {
                    filename: 'run.sh',
                    content: 'PASSWORD=$(gcloud secrets versions access latest --secret=my-secret)'
                }
            ];
            const findings = scanForPlaintextSecrets(files);
            expect(findings.length).toBe(0);
        });
    });

    describe('runDeterministicGate', () => {
        it('combines syntax and secret checks for Python pipelines', async () => {
            const files = [
                {
                    filename: 'main.py',
                    content: 'print("clean python code")'
                }
            ];
            const res = await runDeterministicGate(files, 'Python');
            expect(res.syntaxValid).toBe(true);
            expect(res.secretScanPassed).toBe(true);
        });
    });
});

describe('Lead Arbiter Baseline Scoring & Hard Veto Rules', () => {
    it('awards 100/100 and no hard veto on completely clean findings (simple condition)', () => {
        const cleanGate: DeterministicGateResult = {
            syntaxValid: true,
            syntaxErrors: [],
            secretScanPassed: true,
            secretFindings: []
        };
        const baseline = calculateBaselineScorecard(cleanGate, []);
        expect(baseline.hardVetoTriggered).toBe(false);
        expect(baseline.hardVetoReasons.length).toBe(0);
        expect(baseline.scorecard.overallScore).toBe(100);
        expect(baseline.scorecard.architectureScore).toBe(100);
        expect(baseline.scorecard.specificationScore).toBe(100);
        expect(baseline.scorecard.securityScore).toBe(100);
        expect(baseline.scorecard.packagingScore).toBe(100);
        expect(baseline.scorecard.maintainabilityScore).toBe(100);
    });

    it('triggers a hard veto when deterministic syntax checks fail (failure condition)', () => {
        const brokenSyntaxGate: DeterministicGateResult = {
            syntaxValid: false,
            syntaxErrors: ['SyntaxError: invalid syntax at line 5'],
            secretScanPassed: true,
            secretFindings: []
        };
        const baseline = calculateBaselineScorecard(brokenSyntaxGate, []);
        expect(baseline.hardVetoTriggered).toBe(true);
        expect(baseline.hardVetoReasons).toContain('SyntaxError: invalid syntax at line 5');
        expect(baseline.scorecard.packagingScore).toBe(50);
    });

    it('triggers a hard veto and resets security score to 0 on secret leak (failure condition)', () => {
        const secretLeakGate: DeterministicGateResult = {
            syntaxValid: true,
            syntaxErrors: [],
            secretScanPassed: false,
            secretFindings: [
                {
                    id: 'SEC-1',
                    category: 'SECURITY',
                    severity: 'CRITICAL',
                    file: 'pipeline.py',
                    description: 'AWS key found',
                    rationale: 'Secret leak'
                }
            ]
        };
        const baseline = calculateBaselineScorecard(secretLeakGate, []);
        expect(baseline.hardVetoTriggered).toBe(true);
        expect(baseline.scorecard.securityScore).toBe(0);
        expect(baseline.hardVetoReasons[0]).toContain('Deterministic Secret Leak');
    });

    it('triggers hard veto on CRITICAL architectural flaws (e.g. silent drop bug)', () => {
        const cleanGate: DeterministicGateResult = {
            syntaxValid: true,
            syntaxErrors: [],
            secretScanPassed: true,
            secretFindings: []
        };
        const criticalArchFinding: EvaluatorFinding = {
            id: 'ARCH-1',
            category: 'ARCHITECTURE',
            severity: 'CRITICAL',
            file: 'pipeline.py',
            description: 'Main output wrapped in TaggedOutput causes silent element drop',
            rationale: 'Unrecognised tag routed to null receiver'
        };
        const baseline = calculateBaselineScorecard(cleanGate, [criticalArchFinding]);
        expect(baseline.hardVetoTriggered).toBe(true);
        expect(baseline.scorecard.architectureScore).toBe(65);
        expect(baseline.hardVetoReasons[0]).toContain('Critical Architecture Defect');
    });

    it('triggers hard veto on CRITICAL specification defects (e.g. missing configured property)', () => {
        const cleanGate: DeterministicGateResult = {
            syntaxValid: true,
            syntaxErrors: [],
            secretScanPassed: true,
            secretFindings: []
        };
        const criticalSpecFinding: EvaluatorFinding = {
            id: 'SPEC-1',
            category: 'SPECIFICATION',
            severity: 'CRITICAL',
            file: 'Pipeline.java',
            description: 'Configured tableName "users" completely omitted from JdbcIO read transform',
            rationale: 'Pipeline will fail execution due to missing table name'
        };
        const baseline = calculateBaselineScorecard(cleanGate, [criticalSpecFinding]);
        expect(baseline.hardVetoTriggered).toBe(true);
        expect(baseline.scorecard.specificationScore).toBe(65);
        expect(baseline.hardVetoReasons[0]).toContain('Critical Specification Defect');
    });

    it('deducts points from specificationScore for MAJOR specification findings', () => {
        const cleanGate: DeterministicGateResult = {
            syntaxValid: true,
            syntaxErrors: [],
            secretScanPassed: true,
            secretFindings: []
        };
        const majorSpecFinding: EvaluatorFinding = {
            id: 'SPEC-2',
            category: 'SPECIFICATION',
            severity: 'MAJOR',
            file: 'pipeline.py',
            description: 'System instructions for DLQ error handling were partially ignored',
            rationale: 'Transform does not match requested specification'
        };
        const baseline = calculateBaselineScorecard(cleanGate, [majorSpecFinding]);
        expect(baseline.hardVetoTriggered).toBe(false);
        expect(baseline.scorecard.specificationScore).toBe(85);
        expect(baseline.scorecard.overallScore).toBeGreaterThanOrEqual(80);
    });

    it('deducts proportional points for MAJOR and MINOR findings without hard veto if score >= 80', () => {
        const cleanGate: DeterministicGateResult = {
            syntaxValid: true,
            syntaxErrors: [],
            secretScanPassed: true,
            secretFindings: []
        };
        const findings: EvaluatorFinding[] = [
            {
                id: 'F-1',
                category: 'ARCHITECTURE',
                severity: 'MAJOR',
                file: 'pipeline.py',
                description: 'Unneeded cross-language expansion',
                rationale: 'Better to use native transform'
            },
            {
                id: 'F-2',
                category: 'PACKAGING',
                severity: 'MINOR',
                file: 'pom.xml',
                description: 'Non-standard groupId',
                rationale: 'Cosmetic style'
            }
        ];
        const baseline = calculateBaselineScorecard(cleanGate, findings);
        expect(baseline.hardVetoTriggered).toBe(false);
        expect(baseline.scorecard.architectureScore).toBe(85);
        expect(baseline.scorecard.packagingScore).toBe(95);
        expect(baseline.scorecard.overallScore).toBeGreaterThanOrEqual(80);
    });
});

describe('Report Formatting and Prompt Remediation Directives', () => {
    it('formats a clean report with scorecard, findings, and prompt directives', () => {
        const sampleResult: MultiAgentEvaluationResult = {
            isGood: false,
            scorecard: {
                overallScore: 68,
                architectureScore: 65,
                securityScore: 100,
                packagingScore: 85,
                maintainabilityScore: 90
            },
            hardVetoTriggered: true,
            hardVetoReasons: ['Critical Architecture Defect: TaggedOutput used on main output'],
            allFindings: [
                {
                    id: 'ARCH-1',
                    category: 'ARCHITECTURE',
                    severity: 'CRITICAL',
                    file: 'pipeline.py',
                    description: 'TaggedOutput on main output drops elements silently',
                    rationale: 'Beam routing drops unmapped tags'
                }
            ],
            specialistResults: {},
            promptRemediationDirectives: [
                {
                    targetPromptFile: 'code-gen-prompt-python.txt',
                    targetSection: '### 3. DoFn Output Tagging Rules',
                    recommendedRuleText: 'DO NOT wrap main output in TaggedOutput(main_tag); yield bare element instead.',
                    rationale: 'Prevents silent data loss in Python Beam pipelines.'
                }
            ],
            explanation: 'Pipeline fails due to silent drop defect in DoFn output routing.'
        };

        const report = formatEvaluationReport(sampleResult, 'Python');
        expect(report).toContain('EVALUATION SCORECARD (Python)');
        expect(report).toContain('Status:       ❌ FAILED');
        expect(report).toContain('Overall:      68 / 100');
        expect(report).toContain('HARD VETO TRIGGERED:');
        expect(report).toContain('Critical Architecture Defect: TaggedOutput used on main output');
        expect(report).toContain('PROMPT REMEDIATION DIRECTIVES (Targeting Generator Prompts)');
        expect(report).toContain('Directive #1 for code-gen-prompt-python.txt');
        expect(report).toContain('Target Section: ### 3. DoFn Output Tagging Rules');
        expect(report).toContain('DO NOT wrap main output in TaggedOutput(main_tag)');
    });
});

describe('End-to-End Orchestration with Mocked Model Calls', () => {
    it('synthesizes sub-agent results and enforces hard veto when Arbiter runs', async () => {
        const mockAi: any = {
            models: {
                generateContent: vi.fn().mockResolvedValue({
                    text: JSON.stringify({
                        isGood: true, // Arbiter tries to pass, but hard veto will override!
                        explanation: 'Model says ok, but veto takes precedence',
                        promptRemediationDirectives: [
                            {
                                targetPromptFile: 'code-gen-prompt-python.txt',
                                targetSection: '### Common Pitfalls',
                                recommendedRuleText: 'Ensure all syntax is verified.',
                                rationale: 'Avoid broken code.'
                            }
                        ]
                    })
                })
            }
        };

        const failingGate: DeterministicGateResult = {
            syntaxValid: false,
            syntaxErrors: ['SyntaxError: unexpected EOF'],
            secretScanPassed: true,
            secretFindings: []
        };

        const specialistResults: Record<string, SpecialistAgentResult> = {
            BeamArchitectureAgent: {
                agentName: 'BeamArchitectureAgent',
                passed: true,
                summary: 'DAG looks okay',
                findings: []
            }
        };

        const res = await synthesizeEvaluation(
            mockAi,
            'Python',
            'nodes: []',
            failingGate,
            specialistResults,
            'Prompt template'
        );

        // Even though Arbiter's isGood was true, deterministic syntax failure forces isGood: false
        expect(res.isGood).toBe(false);
        expect(res.hardVetoTriggered).toBe(true);
        expect(res.hardVetoReasons).toContain('SyntaxError: unexpected EOF');
        expect(res.promptRemediationDirectives.length).toBe(1);
        expect(res.promptRemediationDirectives[0].targetPromptFile).toBe('code-gen-prompt-python.txt');
    });

    it('runs runMultiAgentEvaluation concurrently across subagents', async () => {
        const mockAi: any = {
            models: {
                generateContent: vi.fn().mockImplementation((args: any) => {
                    const promptText = args.contents;
                    if (promptText.includes('Beam Architecture Evaluator Agent')) {
                        return Promise.resolve({
                            text: JSON.stringify({
                                passed: true,
                                summary: 'Beam architecture clean',
                                findings: []
                            })
                        });
                    }
                    if (promptText.includes('Pipeline Specification & Property Conformance')) {
                        return Promise.resolve({
                            text: JSON.stringify({
                                passed: true,
                                summary: 'Specification and properties clean',
                                findings: []
                            })
                        });
                    }
                    if (promptText.includes('Security & Container Hardening')) {
                        return Promise.resolve({
                            text: JSON.stringify({
                                passed: true,
                                summary: 'Security clean',
                                findings: []
                            })
                        });
                    }
                    if (promptText.includes('Packaging & Runtime Deployability')) {
                        return Promise.resolve({
                            text: JSON.stringify({
                                passed: true,
                                summary: 'Packaging clean',
                                findings: []
                            })
                        });
                    }
                    if (promptText.includes('Lead Arbiter')) {
                        return Promise.resolve({
                            text: JSON.stringify({
                                isGood: true,
                                explanation: 'All criteria satisfied.',
                                promptRemediationDirectives: []
                            })
                        });
                    }
                    return Promise.resolve({ text: '{}' });
                })
            }
        };

        const files = [
            {
                filename: 'pipeline.py',
                content: 'print("hello world")'
            }
        ];

        const result = await runMultiAgentEvaluation(
            mockAi,
            'Python',
            'nodes: []',
            'system prompt',
            files
        );

        expect(result.isGood).toBe(true);
        expect(result.hardVetoTriggered).toBe(false);
        expect(result.scorecard.overallScore).toBe(100);
        expect(result.specialistResults.BeamArchitectureAgent).toBeDefined();
        expect(result.specialistResults.PipelineSpecificationAgent).toBeDefined();
        expect(result.specialistResults.SecurityAndHardeningAgent).toBeDefined();
        expect(result.specialistResults.PackagingAndDeployabilityAgent).toBeDefined();
        expect(mockAi.models.generateContent).toHaveBeenCalledTimes(5); // 4 specialist subagents + 1 arbiter
    });
});
