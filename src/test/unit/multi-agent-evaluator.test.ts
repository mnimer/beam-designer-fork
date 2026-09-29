/**
 * Unit Tests for the Multi-Agent Evaluation Harness.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Tests the deterministic pre-flight gate, bash/json/xml syntax checkers,
 * deliverable manifests, placeholder scanner, baseline scoring engine,
 * hard veto rules, false-positive reconciliation, security model fallback,
 * language synchronization, report formatting, and prompt remediation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    checkPythonSyntax,
    checkJavaStructure,
    checkBashSyntax,
    checkJsonSyntax,
    checkXmlStructure,
    scanForUnreplacedPlaceholders,
    checkShellPermissionsAndShebang,
    checkDeliverableCompleteness,
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
    resolveSecurityModel,
    resetResolvedSecurityModelForTesting
} from '../integration/evaluators/security-evaluator';
import { formatFilesWithLineNumbers } from '../integration/evaluators/format-utils';
import { synchronizePipelineLanguage, parseGcloudProjectFromIni } from '../integration/codegen-runner';
import {
    DeterministicGateResult,
    EvaluatorFinding,
    MultiAgentEvaluationResult,
    SpecialistAgentResult
} from '../integration/evaluators/types';
import { DEFAULT_GEMINI_MODEL } from '../../constants';

describe('Format Utils (formatFilesWithLineNumbers)', () => {
    it('prefixes source code with 1-indexed line numbers (simple condition)', () => {
        const files = [
            {
                filename: 'test.py',
                content: 'line one\nline two\nline three'
            }
        ];
        const formatted = formatFilesWithLineNumbers(files);
        expect(formatted).toContain('--- FILE: test.py ---');
        expect(formatted).toContain('1: line one');
        expect(formatted).toContain('2: line two');
        expect(formatted).toContain('3: line three');
    });

    it('handles empty content gracefully (extreme condition)', () => {
        const files = [{ filename: 'empty.txt', content: '' }];
        const formatted = formatFilesWithLineNumbers(files);
        expect(formatted).toContain('1: ');
    });
});

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

        it('correctly handles regex with escaped backslashes without corrupting string state (regression test)', () => {
            const regexJava = `
public class WordCountPipelineTest {
    public void testRegex() {
        String regex = "[^\\\\p{L}]+";
        String s = "\\\\";
        int a = 1;
    }
}
`;
            const error = checkJavaStructure('WordCountPipelineTest.java', regexJava);
            expect(error).toBeNull();
        });
    });

    describe('checkBashSyntax', () => {
        it('passes valid bash script (simple condition)', async () => {
            const validBash = `#!/bin/bash\nset -euo pipefail\necho "Running pipeline"\n`;
            const error = await checkBashSyntax('run_directrunner.sh', validBash);
            expect(error).toBeNull();
        });

        it('catches bash syntax error (failure condition)', async () => {
            const brokenBash = `#!/bin/bash\nif [ $foo == 1; then\necho "missing bracket"\n`;
            const error = await checkBashSyntax('broken.sh', brokenBash);
            expect(error).not.toBeNull();
            expect(error).toContain('broken.sh');
        });
    });

    describe('checkJsonSyntax', () => {
        it('validates correct JSON structure (simple condition)', () => {
            const validJson = JSON.stringify({ image: "gcr.io/my-proj/img", parameters: [] });
            expect(checkJsonSyntax('metadata.json', validJson)).toBeNull();
        });

        it('flags invalid JSON (failure condition)', () => {
            const invalidJson = `{ "image": "missing-quote, }`;
            const err = checkJsonSyntax('metadata.json', invalidJson);
            expect(err).not.toBeNull();
            expect(err).toContain('JSON parse error');
        });
    });

    describe('checkXmlStructure', () => {
        it('validates well-formed XML (simple condition)', () => {
            const validXml = `<project><modelVersion>4.0.0</modelVersion><dependencies><dependency><groupId>org.apache.beam</groupId></dependency></dependencies></project>`;
            expect(checkXmlStructure('pom.xml', validXml)).toBeNull();
        });

        it('detects mismatched XML tags (failure condition)', () => {
            const brokenXml = `<project><dependencies></project></dependencies>`;
            const err = checkXmlStructure('pom.xml', brokenXml);
            expect(err).not.toBeNull();
            expect(err).toContain('Mismatched XML tag');
        });

        it('detects unclosed XML tags (failure condition)', () => {
            const unclosedXml = `<project><dependencies>`;
            const err = checkXmlStructure('pom.xml', unclosedXml);
            expect(err).not.toBeNull();
            expect(err).toContain('Unclosed XML tag');
        });
    });

    describe('scanForUnreplacedPlaceholders', () => {
        it('detects template placeholders and redaction tokens (failure condition)', () => {
            const files = [
                { filename: 'pipeline.py', content: 'pipeline_name = "{{pipeline_name}}"' },
                { filename: 'run.sh', content: 'SECRET=__REDACTED_BY_BEAM_DESIGNER__' }
            ];
            const findings = scanForUnreplacedPlaceholders(files);
            expect(findings.length).toBe(2);
            expect(findings[0].description).toContain('{{pipeline_name}}');
            expect(findings[1].description).toContain('__REDACTED_BY_BEAM_DESIGNER__');
        });

        it('passes clean files without placeholders (simple condition)', () => {
            const files = [{ filename: 'pipeline.py', content: 'x = 10\ny = 20' }];
            expect(scanForUnreplacedPlaceholders(files).length).toBe(0);
        });

        it('does not falsely flag Python f-string escaped braces {{{driver}}} as Mustache placeholders (Directive P14)', () => {
            const files = [
                {
                    filename: 'src/pyodbc_sink.py',
                    content: 'conn_str = f"DRIVER={{{driver}}};SERVER={server};PORT={port};"\n'
                }
            ];
            expect(scanForUnreplacedPlaceholders(files)).toEqual([]);
        });
    });

    describe('checkShellPermissionsAndShebang', () => {
        it('flags scripts lacking executable flag or valid shebang (failure condition)', () => {
            const files = [
                {
                    filename: 'run_directrunner.sh',
                    content: 'echo "No shebang"',
                    executable: false
                }
            ];
            const findings = checkShellPermissionsAndShebang(files);
            expect(findings.length).toBe(2);
            expect(findings.some(f => f.id.includes('SHELL-EXEC-FLAG'))).toBe(true);
            expect(findings.some(f => f.id.includes('SHELL-SHEBANG'))).toBe(true);
        });

        it('accepts valid shebang and executable flag (simple condition)', () => {
            const files = [
                {
                    filename: 'run_directrunner.sh',
                    content: '#!/usr/bin/env bash\necho "Good"',
                    executable: true
                }
            ];
            const findings = checkShellPermissionsAndShebang(files);
            expect(findings.length).toBe(0);
        });
    });

    describe('checkDeliverableCompleteness', () => {
        it('flags missing deliverables for Python (failure condition)', () => {
            const files = [
                { filename: 'metadata.json', content: '{}' },
                { filename: 'Dockerfile', content: 'FROM python' }
            ];
            const missing = checkDeliverableCompleteness(files, 'Python');
            expect(missing.some(m => m.includes('requirements.txt'))).toBe(true);
            expect(missing.some(m => m.includes('run_directrunner.sh'))).toBe(true);
        });

        it('verifies complete deliverable set for Python (simple condition)', () => {
            const files = [
                { filename: 'metadata.json', content: '{}' },
                { filename: 'Dockerfile', content: 'FROM python' },
                { filename: 'run_directrunner.sh', content: '#!/bin/bash' },
                { filename: 'run_dataflowrunner.sh', content: '#!/bin/bash' },
                { filename: 'cloudbuild.yaml', content: 'steps: []' },
                { filename: 'README.md', content: '# Doc' },
                { filename: 'requirements.txt', content: 'apache-beam' },
                { filename: 'src/pipeline.py', content: 'import beam' },
                { filename: 'src/pipeline_test.py', content: 'def test(): pass' }
            ];
            const missing = checkDeliverableCompleteness(files, 'Python');
            expect(missing.length).toBe(0);
        });
    });

    describe('checkBashSyntax', () => {
        it('passes valid bash script (simple condition)', async () => {
            const validBash = `#!/bin/bash\nset -euo pipefail\necho "Running pipeline"\n`;
            const error = await checkBashSyntax('run_directrunner.sh', validBash);
            expect(error).toBeNull();
        });

        it('catches bash syntax error (failure condition)', async () => {
            const brokenBash = `#!/bin/bash\nif [ $foo == 1; then\necho "missing bracket"\n`;
            const error = await checkBashSyntax('broken.sh', brokenBash);
            expect(error).not.toBeNull();
            expect(error).toContain('broken.sh');
        });
    });

    describe('checkJsonSyntax', () => {
        it('validates correct JSON structure (simple condition)', () => {
            const validJson = JSON.stringify({ image: "gcr.io/my-proj/img", parameters: [] });
            expect(checkJsonSyntax('metadata.json', validJson)).toBeNull();
        });

        it('flags invalid JSON (failure condition)', () => {
            const invalidJson = `{ "image": "missing-quote, }`;
            const err = checkJsonSyntax('metadata.json', invalidJson);
            expect(err).not.toBeNull();
            expect(err).toContain('JSON parse error');
        });
    });

    describe('checkXmlStructure', () => {
        it('validates well-formed XML (simple condition)', () => {
            const validXml = `<project><modelVersion>4.0.0</modelVersion><dependencies><dependency><groupId>org.apache.beam</groupId></dependency></dependencies></project>`;
            expect(checkXmlStructure('pom.xml', validXml)).toBeNull();
        });

        it('detects mismatched XML tags (failure condition)', () => {
            const brokenXml = `<project><dependencies></project></dependencies>`;
            const err = checkXmlStructure('pom.xml', brokenXml);
            expect(err).not.toBeNull();
            expect(err).toContain('Mismatched XML tag');
        });

        it('detects unclosed XML tags (failure condition)', () => {
            const unclosedXml = `<project><dependencies>`;
            const err = checkXmlStructure('pom.xml', unclosedXml);
            expect(err).not.toBeNull();
            expect(err).toContain('Unclosed XML tag');
        });
    });

    describe('scanForUnreplacedPlaceholders', () => {
        it('detects template placeholders and redaction tokens (failure condition)', () => {
            const files = [
                { filename: 'pipeline.py', content: 'pipeline_name = "{{pipeline_name}}"' },
                { filename: 'run.sh', content: 'SECRET=__REDACTED_BY_BEAM_DESIGNER__' }
            ];
            const findings = scanForUnreplacedPlaceholders(files);
            expect(findings.length).toBe(2);
            expect(findings[0].description).toContain('{{pipeline_name}}');
            expect(findings[1].description).toContain('__REDACTED_BY_BEAM_DESIGNER__');
        });

        it('passes clean files without placeholders (simple condition)', () => {
            const files = [{ filename: 'pipeline.py', content: 'x = 10\ny = 20' }];
            expect(scanForUnreplacedPlaceholders(files).length).toBe(0);
        });
    });

    describe('checkShellPermissionsAndShebang', () => {
        it('flags scripts lacking executable flag or valid shebang (failure condition)', () => {
            const files = [
                {
                    filename: 'run_directrunner.sh',
                    content: 'echo "No shebang"',
                    executable: false
                }
            ];
            const findings = checkShellPermissionsAndShebang(files);
            expect(findings.length).toBe(2);
            expect(findings.some(f => f.id.includes('SHELL-EXEC-FLAG'))).toBe(true);
            expect(findings.some(f => f.id.includes('SHELL-SHEBANG'))).toBe(true);
        });

        it('accepts valid shebang and executable flag (simple condition)', () => {
            const files = [
                {
                    filename: 'run_directrunner.sh',
                    content: '#!/usr/bin/env bash\necho "Good"',
                    executable: true
                }
            ];
            const findings = checkShellPermissionsAndShebang(files);
            expect(findings.length).toBe(0);
        });
    });

    describe('checkDeliverableCompleteness', () => {
        it('flags missing deliverables for Python (failure condition)', () => {
            const files = [
                { filename: 'metadata.json', content: '{}' },
                { filename: 'Dockerfile', content: 'FROM python' }
            ];
            const missing = checkDeliverableCompleteness(files, 'Python');
            expect(missing.some(m => m.includes('requirements.txt'))).toBe(true);
            expect(missing.some(m => m.includes('run_directrunner.sh'))).toBe(true);
        });

        it('verifies complete deliverable set for Python (simple condition)', () => {
            const files = [
                { filename: 'metadata.json', content: '{}' },
                { filename: 'Dockerfile', content: 'FROM python' },
                { filename: 'run_directrunner.sh', content: '#!/bin/bash' },
                { filename: 'run_dataflowrunner.sh', content: '#!/bin/bash' },
                { filename: 'cloudbuild.yaml', content: 'steps: []' },
                { filename: 'README.md', content: '# Doc' },
                { filename: 'requirements.txt', content: 'apache-beam' },
                { filename: 'src/pipeline.py', content: 'import beam' },
                { filename: 'src/pipeline_test.py', content: 'def test(): pass' }
            ];
            const missing = checkDeliverableCompleteness(files, 'Python');
            expect(missing.length).toBe(0);
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
            expect(findings[0].description).toContain('Private Cryptographic Key');
        });

        it('flags hardcoded Google OAuth Client Secrets (failure condition)', () => {
            const files = [
                {
                    filename: 'config.py',
                    content: 'client_secret = "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"'
                }
            ];
            const findings = scanForPlaintextSecrets(files);
            expect(findings.length).toBe(1);
            expect(findings[0].description).toContain('Google OAuth Client Secret');
        });

        it('flags plaintext JDBC passwords in URLs (failure condition)', () => {
            const files = [
                {
                    filename: 'pipeline.java',
                    content: 'String url = "jdbc:postgresql://localhost:5432/mydb?user=postgres&password=SuperSecretPassword123";'
                }
            ];
            const findings = scanForPlaintextSecrets(files);
            expect(findings.length).toBe(1);
            expect(findings[0].severity).toBe('CRITICAL');
            expect(findings[0].description).toContain('Plaintext password embedded in JDBC connection URL');
        });

        it('allows parameterised or Secret Manager placeholders without false positives (simple condition)', () => {
            const files = [
                {
                    filename: 'pipeline.py',
                    content: 'url = "jdbc:postgresql://localhost:5432/mydb?user=admin&password=${DB_PASSWORD}"'
                },
                {
                    filename: 'Pipeline.java',
                    content: 'String url = "jdbc:postgresql://localhost:5432/mydb?user=admin&password=" + secretManagerPassword;'
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
                    filename: 'src/pipeline.py',
                    content: 'import apache_beam as beam\nprint("test")'
                }
            ];
            const res = await runDeterministicGate(files, 'Python');
            expect(res.syntaxValid).toBe(true);
            expect(res.secretScanPassed).toBe(true);
        });
    });
});

describe('Baseline Scoring Engine & Hard Veto Rules (calculateBaselineScorecard)', () => {
    it('awards 100/100 and no hard veto on completely clean findings (simple condition)', () => {
        const cleanGate: DeterministicGateResult = {
            syntaxValid: true,
            syntaxErrors: [],
            secretScanPassed: true,
            secretFindings: []
        };
        const baseline = calculateBaselineScorecard(cleanGate, []);
        expect(baseline.scorecard.overallScore).toBe(100);
        expect(baseline.hardVetoTriggered).toBe(false);
        expect(baseline.hardVetoReasons.length).toBe(0);
    });

    it('triggers a hard veto when deterministic syntax checks fail (failure condition)', () => {
        const brokenGate: DeterministicGateResult = {
            syntaxValid: false,
            syntaxErrors: ['Syntax error in pipeline.py: line 4'],
            secretScanPassed: true,
            secretFindings: []
        };
        const baseline = calculateBaselineScorecard(brokenGate, []);
        expect(baseline.hardVetoTriggered).toBe(true);
        expect(baseline.hardVetoReasons).toContain('Syntax error in pipeline.py: line 4');
        expect(baseline.scorecard.packagingScore).toBe(50);
    });

    it('triggers a hard veto and resets security score to 0 on secret leak (failure condition)', () => {
        const secretGate: DeterministicGateResult = {
            syntaxValid: true,
            syntaxErrors: [],
            secretScanPassed: false,
            secretFindings: [
                {
                    id: 'SEC-1',
                    category: 'SECURITY',
                    severity: 'CRITICAL',
                    file: 'pipeline.py',
                    description: 'Plaintext secret leaked',
                    rationale: 'Secret key detected'
                }
            ]
        };
        const baseline = calculateBaselineScorecard(secretGate, secretGate.secretFindings);
        expect(baseline.hardVetoTriggered).toBe(true);
        expect(baseline.scorecard.securityScore).toBe(0);
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
            description: 'TaggedOutput wrapped main output silently drops elements',
            rationale: 'Beam routing bug'
        };
        const baseline = calculateBaselineScorecard(cleanGate, [criticalArchFinding]);
        expect(baseline.hardVetoTriggered).toBe(true);
        expect(baseline.hardVetoReasons[0]).toContain('Critical Architecture Defect');
        expect(baseline.scorecard.architectureScore).toBe(65);
    });
});

describe('Security Model Fallback (resolveSecurityModel)', () => {
    beforeEach(() => {
        resetResolvedSecurityModelForTesting();
        delete process.env.SECURITY_EVALUATOR_MODEL;
    });

    it('resolves preferred gemini-3.8-flash-cyber model when probing succeeds', async () => {
        const mockAi: any = {
            models: {
                generateContent: vi.fn().mockResolvedValue({ text: 'pong' })
            }
        };
        const model = await resolveSecurityModel(mockAi);
        expect(model).toBe('gemini-3.8-flash-cyber');
    });

    it('falls back to gemini-3.8-flash when cyber model throws 404/403', async () => {
        const mockAi: any = {
            models: {
                generateContent: vi.fn()
                    .mockRejectedValueOnce(new Error('Model not found: 404'))
                    .mockResolvedValueOnce({ text: 'pong' })
            }
        };
        const model = await resolveSecurityModel(mockAi);
        expect(model).toBe('gemini-3.8-flash');
    });

    it('falls back to DEFAULT_GEMINI_MODEL when both cyber and flash fail', async () => {
        const mockAi: any = {
            models: {
                generateContent: vi.fn()
                    .mockRejectedValueOnce(new Error('Model not found: 404'))
                    .mockRejectedValueOnce(new Error('Rate limit exceeded: 429'))
            }
        };
        const model = await resolveSecurityModel(mockAi);
        expect(model).toBe(DEFAULT_GEMINI_MODEL);
    });
});

describe('Pipeline Language Synchronization (synchronizePipelineLanguage)', () => {
    it('updates pipelineConfig.language to target language in YAML', () => {
        const javaYaml = `
pipelineConfig:
  name: test-pipe
  language: Java
nodes: []
`;
        const pythonYaml = synchronizePipelineLanguage(javaYaml, 'Python');
        expect(pythonYaml).toContain('language: Python');
        expect(pythonYaml).not.toContain('language: Java');
    });

    it('extracts project ID synchronously from gcloud config_default INI content', () => {
        const iniContent = `[core]\naccount = user@google.com\nproject = my-gcp-vertex-project\n\n[compute]\nregion = us-central1\n`;
        expect(parseGcloudProjectFromIni(iniContent)).toBe('my-gcp-vertex-project');
        expect(parseGcloudProjectFromIni('[core]\naccount = user@google.com\n')).toBeUndefined();
    });
});

describe('Arbiter False-Positive Reconciliation', () => {
    it('clears hard veto when Arbiter rejects a specialist finding as false positive', async () => {
        const mockAi: any = {
            models: {
                generateContent: vi.fn().mockResolvedValue({
                    text: JSON.stringify({
                        isGood: true,
                        explanation: 'Specialist reported missing Secret Manager, but code verified at lines 15-20.',
                        rejectedFindingIds: ['SPEC-FP-1'],
                        rejectedFindings: [
                            {
                                id: 'SPEC-FP-1',
                                reason: 'False positive: Secret Manager is initialized in setup() on line 18.'
                            }
                        ],
                        promptRemediationDirectives: []
                    })
                })
            }
        };

        const cleanGate: DeterministicGateResult = {
            syntaxValid: true,
            syntaxErrors: [],
            secretScanPassed: true,
            secretFindings: []
        };

        const falsePositiveFinding: EvaluatorFinding = {
            id: 'SPEC-FP-1',
            category: 'SPECIFICATION',
            severity: 'CRITICAL',
            file: 'src/pipeline.py',
            description: 'Missing Secret Manager integration',
            rationale: 'Specialist did not see dynamic resolution'
        };

        const specialistResults: Record<string, SpecialistAgentResult> = {
            PipelineSpecificationAgent: {
                agentName: 'PipelineSpecificationAgent',
                passed: false,
                summary: 'Failed due to missing secret manager',
                findings: [falsePositiveFinding]
            }
        };

        const files = [{ filename: 'src/pipeline.py', content: 'def setup():\n  client = secretmanager.Client()' }];

        const result = await synthesizeEvaluation(
            mockAi,
            'Python',
            'nodes: []',
            files,
            cleanGate,
            specialistResults,
            'Prompt'
        );

        expect(result.isGood).toBe(true);
        expect(result.hardVetoTriggered).toBe(false);
        expect(result.rejectedFindings?.length).toBe(1);
        expect(result.confirmedFindings?.length).toBe(0);
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
                    line: 42,
                    evidence: 'yield TaggedOutput(main_tag, elem)',
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
        expect(report).toContain('pipeline.py:42');
        expect(report).toContain('Evidence: yield TaggedOutput');
        expect(report).toContain('PROMPT REMEDIATION DIRECTIVES (Targeting Generator Prompts)');
        expect(report).toContain('Directive #1 for code-gen-prompt-python.txt');
    });
});

describe('End-to-End Orchestration with Mocked Model Calls', () => {
    beforeEach(() => {
        resetResolvedSecurityModelForTesting();
    });

    it('runs runMultiAgentEvaluation concurrently across subagents', async () => {
        const mockAi: any = {
            models: {
                generateContent: vi.fn().mockImplementation((args: any) => {
                    const promptText = args.contents;
                    if (promptText === 'ping') {
                        return Promise.resolve({ text: 'pong' });
                    }
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
        // Only the 4 specialist sub-agents should be invoked in parallel on a clean pass (no ping calls, no redundant 5th arbiter LLM call)
        expect(mockAi.models.generateContent).toHaveBeenCalledTimes(4);
    });

    it('invokes Lead Arbiter LLM when a specialist reports findings', async () => {
        const mockAi: any = {
            models: {
                generateContent: vi.fn().mockImplementation((args: any) => {
                    const promptText = args.contents;
                    if (promptText.includes('Beam Architecture Evaluator Agent')) {
                        return Promise.resolve({
                            text: JSON.stringify({
                                passed: false,
                                summary: 'Missing windowing',
                                findings: [
                                    {
                                        id: 'ARCH-WIN-1',
                                        category: 'ARCHITECTURE',
                                        severity: 'CRITICAL',
                                        file: 'pipeline.py',
                                        description: 'Missing windowing before GroupByKey',
                                        rationale: 'Unbounded aggregation requires window'
                                    }
                                ]
                            })
                        });
                    }
                    if (promptText.includes('Pipeline Specification & Property Conformance')) {
                        return Promise.resolve({
                            text: JSON.stringify({
                                passed: true,
                                summary: 'Spec clean',
                                requirementVerifications: [],
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
                                isGood: false,
                                explanation: 'Critical missing windowing confirmed.',
                                rejectedFindingIds: [],
                                rejectedFindings: [],
                                promptRemediationDirectives: [
                                    {
                                        targetPromptFile: 'code-gen-prompt-python.txt',
                                        targetSection: 'Windowing',
                                        recommendedRuleText: 'Apply windowing before GroupByKey.',
                                        rationale: 'Prevents unbounded aggregation errors.'
                                    }
                                ]
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

        expect(result.isGood).toBe(false);
        expect(result.hardVetoTriggered).toBe(true);
        expect(result.promptRemediationDirectives.length).toBe(1);
        // 4 specialist sub-agents + 1 Lead Arbiter call = 5 calls total
        expect(mockAi.models.generateContent).toHaveBeenCalledTimes(5);
    });
});

