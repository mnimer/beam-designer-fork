/**
 * Integration Test Markdown Reporter
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Accumulates and persists test results, multi-agent evaluation scorecards,
 * defect findings, and prompt remediation directives into a comprehensive,
 * human-readable markdown report (`src/test/integration/test-report.md`).
 *
 * Architectural decisions:
 * - Persists run history in a localized JSON cache (`.test-report.json`) keyed
 *   by `${testName}::${language}` so running individual test files in Vitest
 *   incrementally updates the master report without losing results from prior suites.
 * - Highlights failed jobs prominently at the top with severity-coded findings
 *   (🔴 CRITICAL, 🟠 MAJOR, 🟡 MINOR) and hard veto reasons.
 * - Formats actionable Prompt Remediation Directives into ready-to-use code blocks
 *   targeting `resources/code-gen-prompt-python.txt` and `resources/code-gen-prompt-java.txt`.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
    EvaluationScorecard,
    EvaluatorFinding,
    PromptRemediationDirective,
} from './evaluators/types';

export interface TestReportEntry {
    testName: string;
    language: 'Java' | 'Python';
    timestamp: string;
    passed: boolean;
    durationMs?: number;
    scorecard?: EvaluationScorecard;
    hardVetoTriggered?: boolean;
    hardVetoReasons?: string[];
    explanation: string;
    findings: EvaluatorFinding[];
    promptRemediationDirectives: PromptRemediationDirective[];
    generatedFiles: { filename: string; lines: number }[];
    error?: string;
}

/**
 * Resolves the directory path where test reports and caches should be stored.
 *
 * @returns Absolute directory path for test reports.
 */
export function getReportDirectory(): string {
    if (__dirname.includes(`${path.sep}out${path.sep}`)) {
        return __dirname.replace(`${path.sep}out${path.sep}`, `${path.sep}src${path.sep}`);
    }
    return __dirname;
}

/**
 * Resolves the file path for the Markdown test report.
 *
 * @returns Absolute file path to `test-report.md`.
 */
export function getReportFilePath(): string {
    return path.join(getReportDirectory(), 'test-report.md');
}

/**
 * Resolves the file path for the JSON test report cache.
 *
 * @returns Absolute file path to `.test-report.json`.
 */
export function getReportCacheFilePath(): string {
    return path.join(getReportDirectory(), '.test-report.json');
}

/**
 * Loads cached test report entries from the filesystem.
 */
export function loadReportCache(): Record<string, TestReportEntry> {
    const cachePath = getReportCacheFilePath();
    try {
        if (fs.existsSync(cachePath)) {
            const raw = fs.readFileSync(cachePath, 'utf-8');
            return JSON.parse(raw);
        }
    } catch {
        // Fallback on corrupt or unreadable cache
    }
    return {};
}

/**
 * Saves report entries cache to the filesystem.
 */
export function saveReportCache(cache: Record<string, TestReportEntry>): void {
    const cachePath = getReportCacheFilePath();
    try {
        fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2), 'utf-8');
    } catch (err) {
        console.warn('Failed to save test report cache:', err);
    }
}

/**
 * Clears the test report cache and removes the generated markdown file.
 */
export function clearReportCache(): void {
    const cachePath = getReportCacheFilePath();
    const reportPath = getReportFilePath();
    if (fs.existsSync(cachePath)) {
        try { fs.unlinkSync(cachePath); } catch { /* ignore */ }
    }
    if (fs.existsSync(reportPath)) {
        try { fs.unlinkSync(reportPath); } catch { /* ignore */ }
    }
}

export interface ConsolidatedDirective {
    targetSection: string;
    recommendedRuleText: string;
    rationale: string;
    sources: string[];
}

/**
 * Detects the normalized topic/theme of a prompt remediation directive to allow
 * grouping and deduplicating repetitive recommendations across test suites.
 */
export function detectDirectiveTopic(section: string, text: string): string {
    const combined = `${section} ${text}`.toLowerCase();
    if (combined.includes('latest') || combined.includes('image tag') || combined.includes('commit_sha') || combined.includes('build_id') || combined.includes('immutable tag') || combined.includes('mutable tag')) {
        return 'Deterministic Container Image Tagging (Cloud Build & Runner Scripts)';
    }
    if (combined.includes('non-root') || combined.includes('user beam') || combined.includes('user 1000') || combined.includes('least privilege') || combined.includes('addgroup') || combined.includes('adduser')) {
        return 'Container Hardening & Non-Root Execution (Dockerfile)';
    }
    if (combined.includes('unredacted') || combined.includes('pii') || (combined.includes('dlq') && combined.includes('log')) || (combined.includes('dead-letter') && combined.includes('log'))) {
        return 'Dead-Letter Queue (DLQ) vs Application Logging Redaction';
    }
    if (combined.includes('python_cmd') || combined.includes('word-splitting') || combined.includes('double-quoted') || combined.includes('double-quote') || combined.includes('shell variable')) {
        return 'Shell Script Variable Quoting';
    }
    if (combined.includes('parameteriz') || combined.includes('pipelineoptions') || combined.includes('hardcoded string') || combined.includes('default values') || combined.includes('yaml propert')) {
        return 'IO Parameterization via PipelineOptions';
    }
    if (combined.includes('groupintobatches') || combined.includes('shard') || combined.includes('unkeyed')) {
        return 'GroupIntoBatches Sharding';
    }
    if (combined.includes('sourcequeue') || combined.includes('targetqueue') || (combined.includes('sqs') && combined.includes('sns') && combined.includes('distinct'))) {
        return 'Distinct Queue Parameters (AWS IO)';
    }
    if (combined.includes('batchsize') || combined.includes('withbatchsize') || combined.includes('specification conformance')) {
        return 'Transform Property Binding & Conformance';
    }
    return section.trim();
}

/**
 * Groups and consolidates overlapping or repetitive directives across multiple test suites.
 */
export function consolidateDirectives(
    items: { entry: TestReportEntry; directive: PromptRemediationDirective }[]
): ConsolidatedDirective[] {
    const groups = new Map<string, ConsolidatedDirective>();

    for (const item of items) {
        const topic = detectDirectiveTopic(item.directive.targetSection, item.directive.recommendedRuleText);
        const existing = groups.get(topic);
        if (!existing) {
            groups.set(topic, {
                targetSection: topic,
                recommendedRuleText: item.directive.recommendedRuleText.trim(),
                rationale: item.directive.rationale.trim(),
                sources: [item.entry.testName]
            });
        } else {
            if (!existing.sources.includes(item.entry.testName)) {
                existing.sources.push(item.entry.testName);
            }
            if (item.directive.recommendedRuleText.trim().length > existing.recommendedRuleText.length) {
                existing.recommendedRuleText = item.directive.recommendedRuleText.trim();
            }
            if (item.directive.rationale.trim().length > existing.rationale.length) {
                existing.rationale = item.directive.rationale.trim();
            }
        }
    }

    return Array.from(groups.values());
}

/**
 * Formats a list of TestReportEntries into a structured markdown document.
 */
export function generateReportMarkdown(entries: TestReportEntry[]): string {
    const lines: string[] = [];
    const now = new Date().toISOString();

    const passedCount = entries.filter(e => e.passed).length;
    const failedCount = entries.filter(e => !e.passed).length;
    const totalCount = entries.length;

    // 1. Header & Metadata
    lines.push('# Apache Beam Codegen Integration Test Report');
    lines.push('');
    lines.push(`> **Last Updated:** ${now}  `);
    lines.push(`> **Evaluator Model:** \`gemini-3.7-flash\` (Vertex AI \`global\`)  `);
    lines.push(`> **Suites Recorded:** ${totalCount} (${passedCount} Passed, ${failedCount} Failed)`);
    lines.push('');

    // 2. Executive Summary Table
    lines.push('## 1. Executive Summary');
    lines.push('');
    lines.push('| Pipeline Test | Language | Status | Score | Hard Veto | Findings (Crit / Maj / Min) | Directives |');
    lines.push('| :--- | :---: | :---: | :---: | :---: | :---: | :---: |');

    for (const entry of entries) {
        const status = entry.passed ? '✅ PASSED' : '❌ FAILED';
        const score = entry.scorecard ? `${entry.scorecard.overallScore}/100` : 'N/A';
        const veto = entry.hardVetoTriggered ? '🚨 YES' : 'No';

        const critCount = entry.findings.filter(f => f.severity === 'CRITICAL').length;
        const majCount = entry.findings.filter(f => f.severity === 'MAJOR').length;
        const minCount = entry.findings.filter(f => f.severity === 'MINOR').length;
        const findingsStr = `${critCount} / ${majCount} / ${minCount}`;

        const directiveCount = entry.promptRemediationDirectives.length;

        lines.push(`| **${entry.testName}** | ${entry.language} | ${status} | ${score} | ${veto} | ${findingsStr} | ${directiveCount} |`);
    }
    lines.push('');

    // 3. Failed Jobs & Defect Analysis
    const failedEntries = entries.filter(e => !e.passed);
    lines.push('---');
    lines.push('');
    lines.push('## 2. Failed Jobs & Remediation Required');
    lines.push('');

    if (failedEntries.length === 0) {
        lines.push('🎉 **All recorded pipeline generation tests passed! No active defects detected.**');
        lines.push('');
    } else {
        for (const failed of failedEntries) {
            lines.push(`### ❌ ${failed.testName} (${failed.language})`);
            lines.push(`- **Status:** FAILED`);
            if (failed.durationMs) {
                lines.push(`- **Duration:** ${(failed.durationMs / 1000).toFixed(1)}s`);
            }
            if (failed.scorecard) {
                const specPart = failed.scorecard.specificationScore !== undefined ? ` | Spec: ${failed.scorecard.specificationScore}` : '';
                lines.push(`- **Score Breakdown:** Overall: ${failed.scorecard.overallScore} | Arch: ${failed.scorecard.architectureScore}${specPart} | Sec: ${failed.scorecard.securityScore} | Pack: ${failed.scorecard.packagingScore} | Maint: ${failed.scorecard.maintainabilityScore}`);
            }
            if (failed.hardVetoTriggered && failed.hardVetoReasons && failed.hardVetoReasons.length > 0) {
                lines.push(`- **Hard Veto Triggered:**`);
                failed.hardVetoReasons.forEach(r => lines.push(`  - 🚨 ${r}`));
            }
            if (failed.error) {
                lines.push(`- **Execution Error:** \`${failed.error}\``);
            }
            lines.push(`- **Explanation:** ${failed.explanation}`);
            lines.push('');

            if (failed.findings.length > 0) {
                lines.push(`#### Findings (${failed.findings.length}):`);
                lines.push('');
                failed.findings.forEach((f, idx) => {
                    const icon = f.severity === 'CRITICAL' ? '🔴' : f.severity === 'MAJOR' ? '🟠' : '🟡';
                    lines.push(`${idx + 1}. ${icon} **[${f.category}] ${f.severity}**: ${f.description}`);
                    lines.push(`   - **File:** \`${f.file}\``);
                    lines.push(`   - **Rationale:** ${f.rationale}`);
                });
                lines.push('');
            }
        }
    }

    // 4. Actionable Prompt Remediation Directives
    const allDirectives: { entry: TestReportEntry; directive: PromptRemediationDirective }[] = [];
    for (const entry of entries) {
        for (const dir of entry.promptRemediationDirectives) {
            allDirectives.push({ entry, directive: dir });
        }
    }

    lines.push('---');
    lines.push('');
    lines.push('## 3. Actionable Prompt Remediation Directives');
    lines.push('');

    if (allDirectives.length === 0) {
        lines.push('✅ **No prompt adjustments recommended at this time.**');
        lines.push('');
    } else {
        lines.push('> [!IMPORTANT]');
        lines.push('> Integration tests test the **Code Generator prompts**, not the test assertions.');
        lines.push('> Do not patch test code. Instead, update the prompt files in `resources/` using the');
        lines.push('> recommended rules below so the LLM does not repeat these mistakes in future generations.');
        lines.push('');

        const pythonDirectives = consolidateDirectives(allDirectives.filter(d => d.directive.targetPromptFile === 'code-gen-prompt-python.txt' || d.directive.targetPromptFile === 'both'));
        const javaDirectives = consolidateDirectives(allDirectives.filter(d => d.directive.targetPromptFile === 'code-gen-prompt-java.txt' || d.directive.targetPromptFile === 'both'));

        if (pythonDirectives.length > 0) {
            lines.push('### Directives for `resources/code-gen-prompt-python.txt`');
            lines.push('');
            pythonDirectives.forEach((item, idx) => {
                const sourceStr = item.sources.join(', ');
                lines.push(`#### Directive P${idx + 1}: ${item.targetSection} (from ${sourceStr})`);
                lines.push('');
                lines.push('```text');
                lines.push(item.recommendedRuleText);
                lines.push('```');
                lines.push(`- **Rationale:** ${item.rationale}`);
                lines.push('');
            });
        }

        if (javaDirectives.length > 0) {
            lines.push('### Directives for `resources/code-gen-prompt-java.txt`');
            lines.push('');
            javaDirectives.forEach((item, idx) => {
                const sourceStr = item.sources.join(', ');
                lines.push(`#### Directive J${idx + 1}: ${item.targetSection} (from ${sourceStr})`);
                lines.push('');
                lines.push('```text');
                lines.push(item.recommendedRuleText);
                lines.push('```');
                lines.push(`- **Rationale:** ${item.rationale}`);
                lines.push('');
            });
        }
    }

    // 5. Detailed Test Run Breakdown
    lines.push('---');
    lines.push('');
    lines.push('## 4. Test Run Details & File Generation');
    lines.push('');

    for (const entry of entries) {
        const status = entry.passed ? '✅ PASS' : '❌ FAIL';
        lines.push(`### ${entry.testName} — ${entry.language} (${status})`);
        lines.push(`- **Timestamp:** ${entry.timestamp}`);
        if (entry.scorecard) {
            lines.push(`- **Rubric Scores:**`);
            lines.push(`  - Architecture: \`${entry.scorecard.architectureScore}/100\``);
            lines.push(`  - Security: \`${entry.scorecard.securityScore}/100\``);
            lines.push(`  - Packaging: \`${entry.scorecard.packagingScore}/100\``);
            lines.push(`  - Maintainability: \`${entry.scorecard.maintainabilityScore}/100\``);
            lines.push(`  - **Overall Score:** \`${entry.scorecard.overallScore}/100\``);
        }
        if (entry.generatedFiles && entry.generatedFiles.length > 0) {
            lines.push(`- **Generated Repository Files (${entry.generatedFiles.length}):**`);
            entry.generatedFiles.forEach(f => {
                lines.push(`  - \`${f.filename}\` (${f.lines} lines)`);
            });
        }
        lines.push('');
    }

    return lines.join('\n');
}

/**
 * Records a test entry, updates the cache, and writes the updated markdown report.
 *
 * @param entry - The test result entry to record.
 * @returns The absolute path to the generated test report file.
 */
export function recordAndSaveTestReport(entry: TestReportEntry): string {
    const reportPath = getReportFilePath();
    if (!fs.existsSync(reportPath)) {
        clearReportCache();
    }
    const cache = loadReportCache();
    const key = `${entry.testName}::${entry.language}`;
    cache[key] = entry;
    saveReportCache(cache);

    // Sort entries by testName, then language
    const sortedEntries = Object.values(cache).sort((a, b) => {
        if (a.testName !== b.testName) {
            return a.testName.localeCompare(b.testName);
        }
        return a.language.localeCompare(b.language);
    });

    const markdown = generateReportMarkdown(sortedEntries);
    fs.writeFileSync(reportPath, markdown, 'utf-8');
    return reportPath;
}

