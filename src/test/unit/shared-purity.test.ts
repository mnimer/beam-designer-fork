/**
 * Purity Test for src/shared Modules
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Asserts that all files under src/shared are pure TypeScript modules with zero dependencies
 * on host-only or environment-specific libraries (vscode, fs, path, child_process, os, react, node:*).
 * These modules must remain portable across the extension host (Node/CommonJS) and webview (Browser/ESM).
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('src/shared purity', () => {
    const sharedDir = path.resolve(__dirname, '../../shared');

    /**
     * Recursively traverses a directory to find all TypeScript files.
     *
     * @param dir Directory to traverse.
     * @returns Array of absolute paths to TypeScript files.
     */
    function getTsFilesRecursively(dir: string): string[] {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        const files: string[] = [];
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                files.push(...getTsFilesRecursively(fullPath));
            } else if (entry.isFile() && entry.name.endsWith('.ts')) {
                files.push(fullPath);
            }
        }
        return files;
    }

    const forbiddenModules = ['vscode', 'fs', 'path', 'child_process', 'os', 'react'];

    it('finds at least one shared TypeScript module', () => {
        const files = getTsFilesRecursively(sharedDir);
        expect(files.length).toBeGreaterThan(0);
    });

    it('ensures no file in src/shared imports or requires forbidden modules', () => {
        const files = getTsFilesRecursively(sharedDir);
        const violations: { file: string; match: string }[] = [];

        // Matches: import ... from 'mod', import('mod'), require('mod'), export ... from 'mod'
        const importPattern = /(?:from\s+|import\s*\(|require\s*\()\s*['"]([^'"]+)['"]/g;

        for (const file of files) {
            const content = fs.readFileSync(file, 'utf-8');
            let match: RegExpExecArray | null;
            while ((match = importPattern.exec(content)) !== null) {
                const importedModule = match[1];
                const isForbidden =
                    forbiddenModules.includes(importedModule) ||
                    importedModule.startsWith('node:');

                if (isForbidden) {
                    violations.push({
                        file: path.relative(sharedDir, file),
                        match: match[0],
                    });
                }
            }
        }

        expect(violations).toEqual([]);
    });
});
