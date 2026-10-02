/** @fileoverview Provides resource loading and default ignore pattern helpers for templates and runtime configs.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Default ignore patterns for .dockerignore and .gcloudignore files.
 * 
 * Prevents sensitive logs (including gemini.log with raw prompt text),
 * build targets, dependencies, and environment artifacts from leaking to Cloud Build / Docker.
 */
export const DEFAULT_IGNORE_PATTERNS: readonly string[] = [
    '.git',
    '.venv',
    // NOTE: `run_directrunner.sh` creates the virtualenv as `venv` (no leading dot), so the
    // dot-prefixed entry above does not match it. Both spellings are listed because the
    // script probes for `venv` first and `.venv` second, and a user may have either.
    // Without these, a ~4000-file virtualenv is uploaded to Cloud Build and Docker.
    'venv',
    'env',
    'node_modules',
    '__pycache__',
    'target/',
    '*.beam',
    '*.tf',
    '*.log',
    'gemini.log',
];

/**
 * Returns default content for generated ignore files (.dockerignore and .gcloudignore).
 * 
 * @returns Formatted newline-terminated ignore rules string
 */
export function getDefaultIgnoreFileContent(): string {
    return DEFAULT_IGNORE_PATTERNS.join('\n') + '\n';
}

/**
 * Reads resource template or schema files, checking resources/ and src/ directories.
 * Supports both development environment execution and packaged VSIX execution.
 */
export function readResourceFile(context: vscode.ExtensionContext, fileName: string): string {
    const possiblePaths = [
        context.asAbsolutePath(path.join('resources', fileName)),
        context.asAbsolutePath(path.join('src', fileName)),
        path.join(__dirname, '..', 'resources', fileName),
        path.join(__dirname, '..', 'src', fileName)
    ];
    for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
            return fs.readFileSync(p, 'utf-8');
        }
    }
    throw new Error(`Resource file not found: ${fileName}. Checked paths: ${possiblePaths.join(', ')}`);
}
