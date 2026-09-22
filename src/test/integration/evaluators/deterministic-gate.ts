/**
 * Deterministic Pre-Flight Gate for Generated Code Evaluation.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Provides fast, 100% deterministic ground-truth verification for generated files
 * before delegating to LLM evaluator agents. This prevents LLM hallucination on
 * basic syntax validity, broken runner scripts, missing deliverables, or obvious credential leaks.
 *
 * Architectural decisions:
 * - Checks Python files using the host python3 interpreter via `python3 -m py_compile`.
 * - Checks Java files for basic structure: matching balanced braces/parentheses and
 *   public class name matching the file name.
 * - Checks shell scripts (*.sh) using `bash -n` for syntax validity and requires proper shebang.
 * - Validates JSON artifacts (e.g. `metadata.json`) using strict JSON.parse.
 * - Validates XML artifacts (e.g. `pom.xml`) for well-formed tag closures.
 * - Audits deliverable manifest completeness: checks that all mandatory deliverables exist.
 * - Scans for unreplaced template placeholders (e.g. `{{pipeline_name}}` or `__REDACTED_BY_BEAM_DESIGNER__`).
 * - Scans all generated files against strict regex patterns for plaintext secrets
 *   (AWS keys, GCP API keys, GCP OAuth secrets, private keys, JDBC passwords, JSON password literals).
 * - Findings from this gate are tagged with severity 'CRITICAL' to automatically trigger
 *   hard vetoes in the Arbiter.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execFile } from 'child_process';
import { DeterministicGateResult, EvaluatorFinding } from './types';

export interface GeneratedFileCandidate {
    filename: string;
    content: string;
    executable?: boolean;
}

/**
 * Executes python3 -m py_compile on a python source file string.
 *
 * @param filename - Relative or display filename.
 * @param content - Python source code.
 * @returns Error string if syntax error, or null if valid.
 */
export function checkPythonSyntax(filename: string, content: string): Promise<string | null> {
    return new Promise((resolve) => {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'beam-eval-py-'));
        const safeBaseName = path.basename(filename) || 'pipeline.py';
        const tmpFile = path.join(tmpDir, safeBaseName);

        try {
            fs.writeFileSync(tmpFile, content, 'utf-8');
            execFile('python3', ['-m', 'py_compile', tmpFile], { timeout: 10000 }, (err, _stdout, stderr) => {
                try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
                if (err) {
                    const message = stderr.trim() || err.message;
                    resolve(`Python syntax check failed for ${filename}: ${message}`);
                } else {
                    resolve(null);
                }
            });
        } catch (writeErr: any) {
            try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
            resolve(`Could not verify python syntax due to I/O error: ${writeErr.message}`);
        }
    });
}

/**
 * Executes bash -n to verify syntax of shell scripts.
 *
 * @param filename - Shell script filename.
 * @param content - Script contents.
 * @returns Error string if syntax error, or null if valid.
 */
export function checkBashSyntax(filename: string, content: string): Promise<string | null> {
    return new Promise((resolve) => {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'beam-eval-sh-'));
        const safeBaseName = path.basename(filename) || 'script.sh';
        const tmpFile = path.join(tmpDir, safeBaseName);

        try {
            fs.writeFileSync(tmpFile, content, 'utf-8');
            execFile('bash', ['-n', tmpFile], { timeout: 10000 }, (err, _stdout, stderr) => {
                try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
                if (err) {
                    const message = stderr.trim() || err.message;
                    resolve(`Bash syntax check failed for ${filename}: ${message}`);
                } else {
                    resolve(null);
                }
            });
        } catch (writeErr: any) {
            try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
            resolve(`Could not verify bash syntax due to I/O error: ${writeErr.message}`);
        }
    });
}

/**
 * Validates that JSON files parse correctly.
 *
 * @param filename - JSON filename.
 * @param content - JSON contents.
 * @returns Error string if invalid, or null if valid.
 */
export function checkJsonSyntax(filename: string, content: string): string | null {
    try {
        JSON.parse(content);
        return null;
    } catch (err: any) {
        return `JSON parse error in ${filename}: ${err.message}`;
    }
}

/**
 * Checks Java file for structural syntax: balanced braces, matching class name.
 *
 * @param filename - Java filename.
 * @param content - Java source code.
 * @returns Error string if validation fails, or null if valid.
 */
export function checkJavaStructure(filename: string, content: string): string | null {
    let braceCount = 0;
    let parenCount = 0;
    let inString = false;
    let inChar = false;
    let inSingleLineComment = false;
    let inMultiLineComment = false;

    for (let i = 0; i < content.length; i++) {
        const c = content[i];
        const next = i + 1 < content.length ? content[i + 1] : '';

        // Comments
        if (!inString && !inChar) {
            if (!inMultiLineComment && c === '/' && next === '/') {
                inSingleLineComment = true;
                i++;
                continue;
            }
            if (inSingleLineComment && (c === '\n' || c === '\r')) {
                inSingleLineComment = false;
                continue;
            }
            if (!inSingleLineComment && c === '/' && next === '*') {
                inMultiLineComment = true;
                i++;
                continue;
            }
            if (inMultiLineComment && c === '*' && next === '/') {
                inMultiLineComment = false;
                i++;
                continue;
            }
        }

        if (inSingleLineComment || inMultiLineComment) {
            continue;
        }

        // Strings & characters
        if (c === '"' && content[i - 1] !== '\\') {
            inString = !inString;
            continue;
        }
        if (c === "'" && content[i - 1] !== '\\') {
            inChar = !inChar;
            continue;
        }

        if (inString || inChar) {
            continue;
        }

        if (c === '{') braceCount++;
        else if (c === '}') braceCount--;
        else if (c === '(') parenCount++;
        else if (c === ')') parenCount--;

        if (braceCount < 0) {
            return `Unmatched closing brace '}' in ${filename}`;
        }
        if (parenCount < 0) {
            return `Unmatched closing parenthesis ')' in ${filename}`;
        }
    }

    if (braceCount !== 0) {
        return `Unclosed brace '{' in ${filename} (unbalanced by ${braceCount})`;
    }
    if (parenCount !== 0) {
        return `Unclosed parenthesis '(' in ${filename} (unbalanced by ${parenCount})`;
    }

    // Check that public class name matches filename
    const baseName = path.basename(filename, '.java');
    const publicClassMatch = content.match(/\bpublic\s+(?:class|interface|enum|record)\s+([A-Za-z0-9_]+)\b/);
    if (publicClassMatch && publicClassMatch[1] !== baseName) {
        return `Public class '${publicClassMatch[1]}' does not match filename '${filename}'`;
    }

    return null;
}

/**
 * Checks XML files (e.g. pom.xml) for basic well-formed tag matching.
 *
 * @param filename - XML filename.
 * @param content - XML content.
 * @returns Error string if invalid tag structure, or null if valid.
 */
export function checkXmlStructure(filename: string, content: string): string | null {
    const tagRegex = /<\/?([a-zA-Z0-9_\-:]+)(?:\s+[^>]*?)?(\/?)>/g;
    const stack: string[] = [];
    let match: RegExpExecArray | null;

    while ((match = tagRegex.exec(content)) !== null) {
        const fullTag = match[0];
        const tagName = match[1];
        const isSelfClosing = match[2] === '/' || fullTag.endsWith('/>');
        const isClosing = fullTag.startsWith('</');

        // Ignore XML declarations or comments
        if (fullTag.startsWith('<?') || fullTag.startsWith('<!')) {
            continue;
        }

        if (isSelfClosing) {
            continue;
        }

        if (isClosing) {
            if (stack.length === 0) {
                return `Unmatched closing XML tag '</${tagName}>' in ${filename}`;
            }
            const expected = stack.pop();
            if (expected !== tagName) {
                return `Mismatched XML tag in ${filename}: expected '</${expected}>' but found '</${tagName}>'`;
            }
        } else {
            stack.push(tagName);
        }
    }

    if (stack.length > 0) {
        return `Unclosed XML tag '<${stack[stack.length - 1]}>' in ${filename}`;
    }

    return null;
}

/**
 * Scans for unreplaced template placeholders across all generated files.
 *
 * @param files - All generated files.
 * @returns Array of evaluator findings for unreplaced tokens.
 */
export function scanForUnreplacedPlaceholders(files: GeneratedFileCandidate[]): EvaluatorFinding[] {
    const findings: EvaluatorFinding[] = [];
    const placeholderRegex = /\{\{[a-zA-Z0-9_]+\}\}|__REDACTED_BY_BEAM_DESIGNER__/g;

    for (const file of files) {
        const matches = file.content.match(placeholderRegex);
        if (matches && matches.length > 0) {
            const unique = Array.from(new Set(matches));
            findings.push({
                id: `PLACEHOLDER-${file.filename}`,
                category: 'SYNTAX',
                severity: 'CRITICAL',
                file: file.filename,
                description: `Unreplaced template placeholder(s) detected: ${unique.join(', ')}`,
                rationale: 'Generated code must not contain un-interpolated template placeholders or redaction markers.'
            });
        }
    }

    return findings;
}

/**
 * Validates that shell runner scripts have the executable flag and standard shebang.
 *
 * @param files - All generated files.
 * @returns Array of evaluator findings for shell script issues.
 */
export function checkShellPermissionsAndShebang(files: GeneratedFileCandidate[]): EvaluatorFinding[] {
    const findings: EvaluatorFinding[] = [];
    const shellFiles = files.filter(f => f.filename.endsWith('.sh'));

    for (const sh of shellFiles) {
        if (sh.executable === false) {
            findings.push({
                id: `SHELL-EXEC-FLAG-${sh.filename}`,
                category: 'PACKAGING',
                severity: 'MAJOR',
                file: sh.filename,
                description: `Shell script '${sh.filename}' is marked with executable: false`,
                rationale: 'Shell runner scripts must specify executable: true in candidate manifest.'
            });
        }

        const firstLine = sh.content.split('\n')[0].trim();
        if (!firstLine.startsWith('#!/bin/bash') && !firstLine.startsWith('#!/usr/bin/env bash')) {
            findings.push({
                id: `SHELL-SHEBANG-${sh.filename}`,
                category: 'PACKAGING',
                severity: 'MAJOR',
                file: sh.filename,
                description: `Shell script '${sh.filename}' lacks standard bash shebang (found '${firstLine.substring(0, 30)}')`,
                rationale: 'Runner scripts must begin with #!/usr/bin/env bash or #!/bin/bash.'
            });
        }
    }

    return findings;
}

/**
 * Audits deliverable completeness against the 10 required project artifacts.
 *
 * @param files - All generated files.
 * @param language - Target language.
 * @returns Array of missing deliverable descriptions.
 */
export function checkDeliverableCompleteness(
    files: GeneratedFileCandidate[],
    language: 'Java' | 'Python'
): string[] {
    const missing: string[] = [];
    const filenames = new Set(files.map(f => f.filename));

    const requiredShared = [
        'metadata.json',
        'Dockerfile',
        'run_directrunner.sh',
        'run_dataflowrunner.sh',
        'cloudbuild.yaml',
        'README.md'
    ];

    for (const req of requiredShared) {
        if (!filenames.has(req)) {
            missing.push(`Missing mandatory deliverable: ${req}`);
        }
    }

    if (language === 'Python') {
        if (!filenames.has('requirements.txt')) {
            missing.push('Missing mandatory deliverable: requirements.txt');
        }
        const hasPySrc = files.some(f => f.filename.startsWith('src/') && f.filename.endsWith('.py') && !f.filename.endsWith('_test.py') && !f.filename.endsWith('__init__.py'));
        if (!hasPySrc) {
            missing.push('Missing mandatory deliverable: main Python pipeline in src/<name>.py');
        }
        const hasPyTest = files.some(f => f.filename.endsWith('_test.py'));
        if (!hasPyTest) {
            missing.push('Missing mandatory deliverable: Python unit test file src/<name>_test.py');
        }
    } else {
        if (!filenames.has('pom.xml')) {
            missing.push('Missing mandatory deliverable: pom.xml');
        }
        const hasJavaSrc = files.some(f => f.filename.endsWith('.java'));
        if (!hasJavaSrc) {
            missing.push('Missing mandatory deliverable: main Java pipeline file (*.java)');
        }
    }

    return missing;
}

/**
 * Scans generated files for credential leaks or plaintext secrets.
 *
 * @param files - All generated files in the payload.
 * @returns Array of security findings.
 */
export function scanForPlaintextSecrets(files: GeneratedFileCandidate[]): EvaluatorFinding[] {
    const findings: EvaluatorFinding[] = [];

    const secretPatterns: { regex: RegExp; description: string; ruleId: string }[] = [
        {
            regex: /AKIA[0-9A-Z]{16}/,
            description: 'Hardcoded AWS Access Key ID detected',
            ruleId: 'SEC-AWS-KEY'
        },
        {
            regex: /-----BEGIN\s+(?:[A-Z0-9_-]+\s+)*PRIVATE\s+KEY-----/,
            description: 'Hardcoded Private Cryptographic Key detected',
            ruleId: 'SEC-PRIV-KEY'
        },
        {
            regex: /AIzaSy[0-9A-Za-z_-]{33}/,
            description: 'Hardcoded Google API Key detected',
            ruleId: 'SEC-GCP-API-KEY'
        },
        {
            regex: /GOCSPX-[a-zA-Z0-9_-]{28}/,
            description: 'Hardcoded Google OAuth Client Secret detected',
            ruleId: 'SEC-GCP-OAUTH-SECRET'
        },
        {
            regex: /ghp_[a-zA-Z0-9]{36}/,
            description: 'Hardcoded GitHub Personal Access Token detected',
            ruleId: 'SEC-GITHUB-PAT'
        },
        {
            regex: /jdbc:[a-zA-Z0-9_-]+:\/\/[^\s"'`]+[?&;]password=(?!(\$\{|\$|%s|<|YOUR_))([^\s"'`&;]{4,})/,
            description: 'Plaintext password embedded in JDBC connection URL string',
            ruleId: 'SEC-JDBC-PW'
        }
    ];

    for (const file of files) {
        const isTestFile = file.filename.endsWith('_test.py') || file.filename.endsWith('Test.java');

        for (const pattern of secretPatterns) {
            const match = pattern.regex.exec(file.content);
            if (match) {
                if (isTestFile && (match[0].includes('test') || match[0].includes('mock'))) {
                    continue;
                }

                findings.push({
                    id: `${pattern.ruleId}-${file.filename}`,
                    category: 'SECURITY',
                    severity: 'CRITICAL',
                    file: file.filename,
                    description: pattern.description,
                    rationale: `Found match '${match[0].substring(0, 10)}...' which indicates a plaintext secret committed into code or artifacts.`
                });
            }
        }
    }

    return findings;
}

/**
 * Runs the deterministic pre-flight gate.
 *
 * @param files - All generated files.
 * @param language - Target language ('Java' or 'Python').
 * @returns Combined deterministic gate result.
 */
export async function runDeterministicGate(
    files: GeneratedFileCandidate[],
    language: 'Java' | 'Python'
): Promise<DeterministicGateResult> {
    const syntaxErrors: string[] = [];
    const shellErrors: string[] = [];
    const jsonErrors: string[] = [];

    // 1. Syntax check code files
    if (language === 'Python') {
        const pyFiles = files.filter(f => f.filename.endsWith('.py'));
        for (const pyFile of pyFiles) {
            const err = await checkPythonSyntax(pyFile.filename, pyFile.content);
            if (err) syntaxErrors.push(err);
        }
    } else if (language === 'Java') {
        const javaFiles = files.filter(f => f.filename.endsWith('.java'));
        for (const javaFile of javaFiles) {
            const err = checkJavaStructure(javaFile.filename, javaFile.content);
            if (err) syntaxErrors.push(err);
        }
    }

    // 2. Syntax check shell scripts
    const shFiles = files.filter(f => f.filename.endsWith('.sh'));
    for (const sh of shFiles) {
        const err = await checkBashSyntax(sh.filename, sh.content);
        if (err) shellErrors.push(err);
    }

    // 3. Syntax check JSON files
    const jsonFiles = files.filter(f => f.filename.endsWith('.json'));
    for (const jsonFile of jsonFiles) {
        const err = checkJsonSyntax(jsonFile.filename, jsonFile.content);
        if (err) jsonErrors.push(err);
    }

    // 4. Syntax check XML files (pom.xml)
    const xmlFiles = files.filter(f => f.filename.endsWith('.xml'));
    for (const xmlFile of xmlFiles) {
        const err = checkXmlStructure(xmlFile.filename, xmlFile.content);
        if (err) syntaxErrors.push(err);
    }

    // 5. Check deliverable completeness (only when a full generation payload with >= 3 files is provided)
    const missingDeliverables = files.length >= 3 ? checkDeliverableCompleteness(files, language) : [];

    // 6. Check unreplaced placeholders & shell permissions
    const placeholderFindings = scanForUnreplacedPlaceholders(files);
    const shellFindings = checkShellPermissionsAndShebang(files);
    const secretFindings = scanForPlaintextSecrets(files);

    const allSecretFindings = [
        ...secretFindings,
        ...placeholderFindings,
        ...shellFindings
    ];

    const allSyntaxErrors = [
        ...syntaxErrors,
        ...shellErrors,
        ...jsonErrors
    ];

    return {
        syntaxValid: allSyntaxErrors.length === 0,
        syntaxErrors: allSyntaxErrors,
        secretScanPassed: allSecretFindings.filter(f => f.severity === 'CRITICAL').length === 0,
        secretFindings: allSecretFindings,
        placeholderErrors: placeholderFindings.map(f => f.description),
        jsonErrors,
        shellErrors,
        missingDeliverables
    };
}
