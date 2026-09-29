/**
 * Unit Tests for Integration Test Markdown Reporter
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Tests:
 * - generateReportMarkdown: verifies table formatting, severity icons, scorecards,
 *   prompt remediation directives grouping (Python vs Java), and passing/failing states.
 * - recordAndSaveTestReport: verifies filesystem persistence of .test-report.json
 *   and test-report.md, incremental updates, and sorting.
 * - clearReportCache & loadReportCache: verifies resilience to missing or corrupted files.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import {
    TestReportEntry,
    generateReportMarkdown,
    recordAndSaveTestReport,
    loadReportCache,
    clearReportCache,
    getReportFilePath,
    getReportCacheFilePath,
    detectDirectiveTopic,
    consolidateDirectives,
} from '../integration/test-reporter';

describe('Integration Test Reporter (test-reporter.ts)', () => {
    const reportPath = getReportFilePath();
    const cachePath = getReportCacheFilePath();

    // Backup existing report & cache if present
    let originalReport: string | null = null;
    let originalCache: string | null = null;

    beforeEach(() => {
        if (fs.existsSync(reportPath)) {
            originalReport = fs.readFileSync(reportPath, 'utf-8');
        }
        if (fs.existsSync(cachePath)) {
            originalCache = fs.readFileSync(cachePath, 'utf-8');
        }
        clearReportCache();
    });

    afterEach(() => {
        clearReportCache();
        if (originalReport !== null) {
            fs.writeFileSync(reportPath, originalReport, 'utf-8');
        }
        if (originalCache !== null) {
            fs.writeFileSync(cachePath, originalCache, 'utf-8');
        }
    });

    it('generates clean report when all tests pass with no directives', () => {
        const entries: TestReportEntry[] = [
            {
                testName: 'JdbcIO-to-JdbcIO',
                language: 'Java',
                timestamp: '2026-09-15T12:00:00.000Z',
                passed: true,
                durationMs: 14200,
                scorecard: {
                    architectureScore: 95,
                    securityScore: 100,
                    packagingScore: 90,
                    maintainabilityScore: 95,
                    overallScore: 95,
                },
                hardVetoTriggered: false,
                explanation: 'Excellent pipeline with robust parameterization.',
                findings: [
                    {
                        id: 'F1',
                        category: 'SYNTAX',
                        severity: 'MINOR',
                        file: 'Pipeline.java',
                        description: 'Unused import statement',
                        rationale: 'Clean up imports',
                    }
                ],
                promptRemediationDirectives: [],
                generatedFiles: [
                    { filename: 'Pipeline.java', lines: 120 },
                    { filename: 'pom.xml', lines: 85 }
                ]
            }
        ];

        const md = generateReportMarkdown(entries);
        expect(md).toContain('# Apache Beam Codegen Integration Test Report');
        expect(md).toContain('| **JdbcIO-to-JdbcIO** | Java | ✅ PASSED | 95/100 | No | 0 / 0 / 1 | 0 |');
        expect(md).toContain('All recorded pipeline generation tests passed!');
        expect(md).toContain('No prompt adjustments recommended at this time.');
        expect(md).toContain('`Pipeline.java` (120 lines)');
    });

    it('formats failed jobs with hard vetoes, severity icons, and prompt remediation directives', () => {
        const entries: TestReportEntry[] = [
            {
                testName: 'KafkaIO-to-KafkaIO',
                language: 'Python',
                timestamp: '2026-09-15T12:05:00.000Z',
                passed: false,
                durationMs: 18500,
                scorecard: {
                    architectureScore: 50,
                    securityScore: 60,
                    packagingScore: 70,
                    maintainabilityScore: 60,
                    overallScore: 60,
                },
                hardVetoTriggered: true,
                hardVetoReasons: ['Silent element drop: TaggedOutput collection was never referenced.'],
                explanation: 'Tagged output branch was dropped by the pipeline DoFn.',
                findings: [
                    {
                        id: 'F1',
                        category: 'ARCHITECTURE',
                        severity: 'CRITICAL',
                        file: 'pipeline.py',
                        description: 'Dead letter collection dropped',
                        rationale: 'Tag error was never attached to a sink.',
                    },
                    {
                        id: 'F2',
                        category: 'SECURITY',
                        severity: 'MAJOR',
                        file: 'pipeline.py',
                        description: 'Hardcoded bootstrap server host',
                        rationale: 'Use pipeline options.',
                    }
                ],
                promptRemediationDirectives: [
                    {
                        targetPromptFile: 'code-gen-prompt-python.txt',
                        targetSection: 'Tagged Output & DLQ Routing',
                        recommendedRuleText: 'When a ParDo produces tagged outputs, ALWAYS consume both the main output AND error output collections.',
                        rationale: 'Prevents silent drops.',
                    },
                    {
                        targetPromptFile: 'code-gen-prompt-java.txt',
                        targetSection: 'TupleTag Declarations',
                        recommendedRuleText: 'Declare TupleTags as static final fields.',
                        rationale: 'Beam type erasure safety.',
                    }
                ],
                generatedFiles: [
                    { filename: 'pipeline.py', lines: 95 }
                ]
            }
        ];

        const md = generateReportMarkdown(entries);
        expect(md).toContain('❌ FAILED');
        expect(md).toContain('🚨 YES');
        expect(md).toContain('### ❌ KafkaIO-to-KafkaIO (Python)');
        expect(md).toContain('Hard Veto Triggered:');
        expect(md).toContain('🚨 Silent element drop: TaggedOutput collection was never referenced.');
        expect(md).toContain('🔴 **[ARCHITECTURE] CRITICAL**: Dead letter collection dropped');
        expect(md).toContain('🟠 **[SECURITY] MAJOR**: Hardcoded bootstrap server host');

        // Directives sections
        expect(md).toContain('### Directives for `resources/code-gen-prompt-python.txt`');
        expect(md).toContain('When a ParDo produces tagged outputs, ALWAYS consume both the main output AND error output collections.');
        expect(md).toContain('### Directives for `resources/code-gen-prompt-java.txt`');
        expect(md).toContain('Declare TupleTags as static final fields.');
    });

    it('persists and updates entries incrementally via recordAndSaveTestReport', () => {
        // Record first test entry (Java)
        recordAndSaveTestReport({
            testName: 'JdbcIO-to-JdbcIO',
            language: 'Java',
            timestamp: '2026-09-15T12:00:00.000Z',
            passed: true,
            explanation: 'Java passed',
            findings: [],
            promptRemediationDirectives: [],
            generatedFiles: [{ filename: 'Main.java', lines: 100 }],
        });

        expect(fs.existsSync(reportPath)).toBe(true);
        expect(fs.existsSync(cachePath)).toBe(true);

        let content = fs.readFileSync(reportPath, 'utf-8');
        expect(content).toContain('JdbcIO-to-JdbcIO');
        expect(content).toContain('Java');
        expect(content).not.toContain('Python');

        // Record second test entry (Python for same test)
        recordAndSaveTestReport({
            testName: 'JdbcIO-to-JdbcIO',
            language: 'Python',
            timestamp: '2026-09-15T12:01:00.000Z',
            passed: true,
            explanation: 'Python passed',
            findings: [],
            promptRemediationDirectives: [],
            generatedFiles: [{ filename: 'main.py', lines: 80 }],
        });

        content = fs.readFileSync(reportPath, 'utf-8');
        expect(content).toContain('Java');
        expect(content).toContain('Python');
        expect(content).toContain('**Suites Recorded:** 2');

        // Verify cache loading
        const cache = loadReportCache();
        expect(cache['JdbcIO-to-JdbcIO::Java']).toBeDefined();
        expect(cache['JdbcIO-to-JdbcIO::Python']).toBeDefined();
        expect(cache['JdbcIO-to-JdbcIO::Java'].passed).toBe(true);
    });

    it('gracefully handles corrupt cache file on load', () => {
        fs.writeFileSync(cachePath, 'INVALID JSON {[[', 'utf-8');
        const cache = loadReportCache();
        expect(cache).toEqual({});
    });

    it('discards stale .test-report.json entries when test-report.md has been deleted before a run', () => {
        // Seed an old entry in both .test-report.json and test-report.md
        recordAndSaveTestReport({
            testName: 'Stale-Source-Test',
            language: 'Java',
            timestamp: '2026-09-10T00:00:00.000Z',
            passed: true,
            explanation: 'Old cached run',
            findings: [],
            promptRemediationDirectives: [],
            generatedFiles: [],
        });
        expect(fs.existsSync(reportPath)).toBe(true);
        expect(fs.existsSync(cachePath)).toBe(true);

        // User deletes test-report.md while .test-report.json still exists
        fs.unlinkSync(reportPath);
        expect(fs.existsSync(reportPath)).toBe(false);
        expect(fs.existsSync(cachePath)).toBe(true);

        // Next test run records a new entry
        recordAndSaveTestReport({
            testName: 'Fresh-Step-Test',
            language: 'Python',
            timestamp: '2026-09-29T00:00:00.000Z',
            passed: true,
            explanation: 'Fresh run',
            findings: [],
            promptRemediationDirectives: [],
            generatedFiles: [],
        });

        const content = fs.readFileSync(reportPath, 'utf-8');
        expect(content).toContain('Fresh-Step-Test');
        expect(content).not.toContain('Stale-Source-Test');
        expect(content).toContain('**Suites Recorded:** 1');
    });

    it('clears both .test-report.json and test-report.md via globalSetup hook at test run start', async () => {
        recordAndSaveTestReport({
            testName: 'Prior-Run-Test',
            language: 'Java',
            timestamp: '2026-09-10T00:00:00.000Z',
            passed: true,
            explanation: 'Prior run',
            findings: [],
            promptRemediationDirectives: [],
            generatedFiles: [],
        });
        expect(fs.existsSync(reportPath)).toBe(true);
        expect(fs.existsSync(cachePath)).toBe(true);

        const { default: globalSetup } = await import('../integration/global-setup');
        globalSetup();

        expect(fs.existsSync(reportPath)).toBe(false);
        expect(fs.existsSync(cachePath)).toBe(false);
    });

    describe('Directive Deduplication & Consolidation', () => {
        it('detects topics correctly for container tagging, hardening, DLQ logging, and shell quoting (simple condition)', () => {
            expect(detectDirectiveTopic('Deployment Scripts', 'avoid mutable :latest image tags')).toBe('Deterministic Container Image Tagging (Cloud Build & Runner Scripts)');
            expect(detectDirectiveTopic('Dockerfile Template', 'ensure a non-root USER beam is specified')).toBe('Container Hardening & Non-Root Execution (Dockerfile)');
            expect(detectDirectiveTopic('DLQ Rules', 'do not log unredacted raw message payloads to log aggregators')).toBe('Dead-Letter Queue (DLQ) vs Application Logging Redaction');
            expect(detectDirectiveTopic('Shell Hardening', 'double-quote "$PYTHON_CMD" to avoid word-splitting')).toBe('Shell Script Variable Quoting');
            expect(detectDirectiveTopic('Custom Transform', 'unique custom section rule')).toBe('Custom Transform');
        });

        it('consolidates duplicate directives across multiple test suites into a single directive listing all sources (extreme condition)', () => {
            const entries: TestReportEntry[] = [
                {
                    testName: 'Pipeline-Alpha',
                    language: 'Python',
                    timestamp: '2026-09-15T12:00:00.000Z',
                    passed: false,
                    explanation: 'Tagging defect',
                    findings: [],
                    promptRemediationDirectives: [
                        {
                            targetPromptFile: 'code-gen-prompt-python.txt',
                            targetSection: 'Deployment Scripts',
                            recommendedRuleText: 'Avoid using mutable :latest tags; use ${IMAGE_TAG:-latest}.',
                            rationale: 'Build reproducibility.',
                        }
                    ],
                    generatedFiles: []
                },
                {
                    testName: 'Pipeline-Beta',
                    language: 'Python',
                    timestamp: '2026-09-15T12:01:00.000Z',
                    passed: false,
                    explanation: 'Tagging defect repeated',
                    findings: [],
                    promptRemediationDirectives: [
                        {
                            targetPromptFile: 'code-gen-prompt-python.txt',
                            targetSection: 'Cloud Build Packaging',
                            recommendedRuleText: 'Avoid using mutable :latest tags; use ${IMAGE_TAG:-latest} or ${SHORT_SHA} for deterministic builds.',
                            rationale: 'Build reproducibility and artifact provenance.',
                        }
                    ],
                    generatedFiles: []
                }
            ];

            const md = generateReportMarkdown(entries);
            // Must contain only ONE directive header for Python, not two
            expect(md).toContain('#### Directive P1: Deterministic Container Image Tagging (Cloud Build & Runner Scripts) (from Pipeline-Alpha, Pipeline-Beta)');
            expect(md).not.toContain('#### Directive P2');
            // Must select the more comprehensive recommended text
            expect(md).toContain('${SHORT_SHA}');
        });

        it('handles empty directive arrays gracefully without errors (failure condition)', () => {
            const consolidated = consolidateDirectives([]);
            expect(consolidated).toEqual([]);
        });
    });
});
