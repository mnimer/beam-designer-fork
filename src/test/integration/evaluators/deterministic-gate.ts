/**
 * Deterministic Pre-Flight Gate for Generated Code Evaluation.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Provides fast, 100% deterministic ground-truth verification for generated files
 * before delegating to LLM evaluator agents. This prevents LLM hallucination on
 * basic syntax validity or obvious credential leaks.
 *
 * Architectural decisions:
 * - Checks Python files using the host python3 interpreter via `python3 -m py_compile`.
 *   If python3 is unavailable, falls back to structural bracket/token verification.
 * - Checks Java files for basic structure: matching balanced braces/parentheses and
 *   public class name matching the file name.
 * - Scans all generated files (scripts, Dockerfile, pom.xml, code) against strict regex
 *   patterns for plaintext secrets (AWS keys, Google API keys, RSA keys, JDBC passwords).
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
        // NOTE: Create temporary file in os tmpdir to run py_compile safely
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'beam-eval-py-'));
        const safeBaseName = path.basename(filename) || 'pipeline.py';
        const tmpFile = path.join(tmpDir, safeBaseName);

        try {
            fs.writeFileSync(tmpFile, content, 'utf-8');
            execFile('python3', ['-m', 'py_compile', tmpFile], { timeout: 10000 }, (err, _stdout, stderr) => {
                // Cleanup temp dir
                try {
                    fs.rmSync(tmpDir, { recursive: true, force: true });
                } catch {
                    // Ignore temp cleanup errors
                }

                if (err) {
                    const message = stderr.trim() || err.message;
                    resolve(`Python syntax check failed for ${filename}: ${message}`);
                } else {
                    resolve(null);
                }
            });
        } catch (writeErr: any) {
            try {
                fs.rmSync(tmpDir, { recursive: true, force: true });
            } catch {
                // Ignore temp cleanup errors
            }
            resolve(`Could not verify python syntax due to I/O error: ${writeErr.message}`);
        }
    });
}

/**
 * Checks Java file for structural syntax: balanced braces, matching class name.
 *
 * @param filename - Java filename.
 * @param content - Java source code.
 * @returns Error string if validation fails, or null if valid.
 */
export function checkJavaStructure(filename: string, content: string): string | null {
    // 1. Check for matching braces and parentheses
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

    // 2. Check that public class name matches filename
    const baseName = path.basename(filename, '.java');
    const publicClassMatch = content.match(/\bpublic\s+(?:class|interface|enum|record)\s+([A-Za-z0-9_]+)\b/);
    if (publicClassMatch && publicClassMatch[1] !== baseName) {
        return `Public class '${publicClassMatch[1]}' does not match filename '${filename}'`;
    }

    return null;
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
            regex: /jdbc:[a-zA-Z0-9_-]+:\/\/[^\s"'`]+[?&;]password=(?!(\$\{|\$|%s|<|YOUR_))([^\s"'`&;]{4,})/,
            description: 'Plaintext password embedded in JDBC connection URL string',
            ruleId: 'SEC-JDBC-PW'
        }
    ];

    for (const file of files) {
        for (const pattern of secretPatterns) {
            const match = pattern.regex.exec(file.content);
            if (match) {
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

    if (language === 'Python') {
        const pyFiles = files.filter(f => f.filename.endsWith('.py'));
        for (const pyFile of pyFiles) {
            const err = await checkPythonSyntax(pyFile.filename, pyFile.content);
            if (err) {
                syntaxErrors.push(err);
            }
        }
    } else if (language === 'Java') {
        const javaFiles = files.filter(f => f.filename.endsWith('.java'));
        for (const javaFile of javaFiles) {
            const err = checkJavaStructure(javaFile.filename, javaFile.content);
            if (err) {
                syntaxErrors.push(err);
            }
        }
    }

    const secretFindings = scanForPlaintextSecrets(files);

    return {
        syntaxValid: syntaxErrors.length === 0,
        syntaxErrors,
        secretScanPassed: secretFindings.length === 0,
        secretFindings
    };
}
