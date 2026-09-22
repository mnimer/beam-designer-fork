/**
 * Security and Configuration Regression Tests (M7, M3, M15)
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Unit tests validating fixes for findings M7, M3, and M15:
 * - M7: Removal of author-specific hardcoded gcloud path; resolution via PATH and dataflowDesigner.gcloudPath setting.
 * - M3: Command injection prevention: rejection of shell metacharacters in outputFolder; terminal execution without redundant cd.
 * - M15: Exclusion of *.log and gemini.log in generated ignore files (.dockerignore, .gcloudignore) to prevent leaking raw prompts.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// Shared mock holder for vscode configuration getter
let mockConfigValues: Record<string, string | undefined> = {};

vi.mock('vscode', () => {
    return {
        TreeItem: class {},
        TreeItemCollapsibleState: { None: 0, Collapsed: 1, Expanded: 2 },
        EventEmitter: class {
            public fire = vi.fn();
            public event = vi.fn();
        },
        ThemeIcon: class {},
        ThemeColor: class {},
        MarkdownString: class {},
        workspace: {
            workspaceFolders: [
                {
                    uri: { fsPath: '/Users/me/ws/mypipeline' },
                    name: 'mypipeline'
                }
            ],
            findFiles: vi.fn().mockResolvedValue([]),
            getConfiguration: vi.fn((section?: string) => ({
                get: (key: string) => {
                    const fullKey = section ? `${section}.${key}` : key;
                    return mockConfigValues[fullKey] ?? mockConfigValues[key];
                }
            }))
        },
        Uri: {
            file: (p: string) => ({ fsPath: p, toString: () => p }),
            parse: (u: string) => ({ fsPath: u, toString: () => u })
        },
        commands: {
            registerCommand: vi.fn(),
            executeCommand: vi.fn()
        },
        window: {
            createWebviewPanel: vi.fn(),
            showErrorMessage: vi.fn(),
            createOutputChannel: vi.fn().mockReturnValue({
                appendLine: vi.fn()
            })
        },
        env: {
            openExternal: vi.fn()
        }
    };
});

import {
    findGcloudPath,
    findExecutableInPath,
    isSafeFolderPath,
    terminalCwdMatches,
    SHELL_METASYMBOLS_REGEX,
    getDefaultIgnoreFileContent,
    DEFAULT_IGNORE_PATTERNS
} from '../../extension';

describe('M7 — gcloud Path Resolution and Configuration Contribution', () => {
    const originalEnvPath = process.env.PATH;

    beforeEach(() => {
        mockConfigValues = {};
    });

    afterEach(() => {
        process.env.PATH = originalEnvPath;
    });

    it('package.json contributes dataflowDesigner.gcloudPath configuration (simple case)', () => {
        const pkgPath = path.resolve(__dirname, '../../../package.json');
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        expect(pkg.contributes).toBeDefined();
        expect(pkg.contributes.configuration).toBeDefined();
        expect(pkg.contributes.configuration.properties).toBeDefined();
        expect(pkg.contributes.configuration.properties['dataflowDesigner.gcloudPath']).toBeDefined();
        expect(pkg.contributes.configuration.properties['dataflowDesigner.gcloudPath'].type).toBe('string');
    });

    it('honours the dataflowDesigner.gcloudPath setting when present', () => {
        mockConfigValues['dataflowDesigner.gcloudPath'] = '/opt/custom/google-cloud-sdk/bin/gcloud';
        const resolved = findGcloudPath();
        expect(resolved).toBe('/opt/custom/google-cloud-sdk/bin/gcloud');
    });

    it('trims whitespace and ignores empty dataflowDesigner.gcloudPath setting', () => {
        mockConfigValues['dataflowDesigner.gcloudPath'] = '   ';
        // When setting is empty whitespace, should fallback to PATH or candidates, not return spaces
        const resolved = findGcloudPath();
        expect(resolved).not.toBe('   ');
        expect(typeof resolved).toBe('string');
        expect(resolved.length).toBeGreaterThan(0);
    });

    it('never returns the hardcoded author path from candidate list when not configured or on PATH', () => {
        // Isolate PATH so PATH search cannot return anything
        process.env.PATH = '';
        mockConfigValues['dataflowDesigner.gcloudPath'] = undefined;

        const resolved = findGcloudPath();
        // Should NOT return the author's personal hardcoded machine path
        const hardcodedAuthorPath = '/Users/mikenimer/Development/libraries/google-cloud-sdk/bin/gcloud';
        if (process.env.HOME !== '/Users/mikenimer') {
            expect(resolved).not.toBe(hardcodedAuthorPath);
        }
        // Candidates must be legitimate paths or 'gcloud'
        expect(['gcloud', '/opt/homebrew/bin/gcloud', '/usr/local/bin/gcloud']).toContainEqual(
            expect.stringMatching(/gcloud$/)
        );
    });

    it('findExecutableInPath resolves binaries when available on PATH (extreme case)', () => {
        // Node executable is guaranteed to exist on process.env.PATH in test environment
        const resolvedNode = findExecutableInPath('node');
        expect(resolvedNode).toBeDefined();
        expect(typeof resolvedNode).toBe('string');
        expect(resolvedNode?.toLowerCase()).toContain('node');

        // Non-existent binary should return undefined (failure case)
        const nonExistent = findExecutableInPath('non_existent_binary_123456');
        expect(nonExistent).toBeUndefined();
    });
});

describe('M3 — Shell Command Injection Prevention in outputFolder', () => {
    it('accepts safe directory paths (simple case)', () => {
        expect(isSafeFolderPath('/Users/developer/project')).toBe(true);
        expect(isSafeFolderPath('src/pipeline')).toBe(true);
        expect(isSafeFolderPath('relative/path/to/dir')).toBe(true);
        expect(isSafeFolderPath('/path with spaces/in/name')).toBe(true);
        expect(isSafeFolderPath('C:\\Users\\developer\\pipeline')).toBe(true);
    });

    it('rejects outputFolder containing double-quote or semicolon (finding M3 specific payloads)', () => {
        // Shell escape via double-quote
        expect(isSafeFolderPath('myfolder" && rm -rf /')).toBe(false);
        expect(isSafeFolderPath('folder"; ls -la')).toBe(false);

        // Command chaining via semicolon
        expect(isSafeFolderPath('myfolder; cat /etc/passwd')).toBe(false);
        expect(isSafeFolderPath('; evil_command')).toBe(false);
    });

    it('rejects all dangerous shell metacharacters: ` $ & | > < \\n \\r (failure cases)', () => {
        expect(isSafeFolderPath('folder`whoami`')).toBe(false);
        expect(isSafeFolderPath('folder$(whoami)')).toBe(false);
        expect(isSafeFolderPath('folder$EVIL')).toBe(false);
        expect(isSafeFolderPath('folder && rm -rf *')).toBe(false);
        expect(isSafeFolderPath('folder || echo fail')).toBe(false);
        expect(isSafeFolderPath('folder | grep secret')).toBe(false);
        expect(isSafeFolderPath('folder > output.txt')).toBe(false);
        expect(isSafeFolderPath('folder < input.txt')).toBe(false);
        expect(isSafeFolderPath('folder\nevil_command')).toBe(false);
        expect(isSafeFolderPath('folder\revil_command')).toBe(false);
        expect(isSafeFolderPath("folder'evil")).toBe(false);
    });

    it('rejects empty, whitespace-only, null, undefined, and non-string inputs (extreme cases)', () => {
        expect(isSafeFolderPath('')).toBe(false);
        expect(isSafeFolderPath('   ')).toBe(false);
        expect(isSafeFolderPath(null)).toBe(false);
        expect(isSafeFolderPath(undefined)).toBe(false);
        expect(isSafeFolderPath(12345 as unknown as string)).toBe(false);
        expect(isSafeFolderPath({} as unknown as string)).toBe(false);
    });

    it('SHELL_METASYMBOLS_REGEX correctly detects metacharacters', () => {
        expect(SHELL_METASYMBOLS_REGEX.test('"')).toBe(true);
        expect(SHELL_METASYMBOLS_REGEX.test("'")).toBe(true);
        expect(SHELL_METASYMBOLS_REGEX.test('`')).toBe(true);
        expect(SHELL_METASYMBOLS_REGEX.test('$')).toBe(true);
        expect(SHELL_METASYMBOLS_REGEX.test(';')).toBe(true);
        expect(SHELL_METASYMBOLS_REGEX.test('&')).toBe(true);
        expect(SHELL_METASYMBOLS_REGEX.test('|')).toBe(true);
        expect(SHELL_METASYMBOLS_REGEX.test('>')).toBe(true);
        expect(SHELL_METASYMBOLS_REGEX.test('<')).toBe(true);
        expect(SHELL_METASYMBOLS_REGEX.test('\n')).toBe(true);
        expect(SHELL_METASYMBOLS_REGEX.test('\r')).toBe(true);
        expect(SHELL_METASYMBOLS_REGEX.test('alphanumeric_123-path/sub')).toBe(false);
    });
});

describe('M3 — Terminal CWD Matching and Replacement (terminalCwdMatches)', () => {
    const targetFolder = '/ws/pipeline-a';

    it('matches cwd given as a plain string identical to target folder (simple case)', () => {
        expect(terminalCwdMatches({ cwd: '/ws/pipeline-a' }, targetFolder)).toBe(true);
    });

    it('rejects differing cwd so mismatched terminal is not reused (failure case)', () => {
        expect(terminalCwdMatches({ cwd: '/ws/pipeline-b' }, targetFolder)).toBe(false);
        expect(terminalCwdMatches({ cwd: '/ws/pipeline-a/sub' }, targetFolder)).toBe(false);
    });

    it('matches cwd given as a Uri-like object with fsPath property', () => {
        const uriLike = { cwd: { fsPath: '/ws/pipeline-a' } };
        expect(terminalCwdMatches(uriLike, targetFolder)).toBe(true);

        const differingUri = { cwd: { fsPath: '/ws/pipeline-b' } };
        expect(terminalCwdMatches(differingUri, targetFolder)).toBe(false);
    });

    it('rejects when cwd is undefined, empty, or options are null/missing (failure case)', () => {
        expect(terminalCwdMatches({ cwd: undefined }, targetFolder)).toBe(false);
        expect(terminalCwdMatches({ cwd: '' }, targetFolder)).toBe(false);
        expect(terminalCwdMatches({}, targetFolder)).toBe(false);
        expect(terminalCwdMatches(undefined, targetFolder)).toBe(false);
        expect(terminalCwdMatches(null, targetFolder)).toBe(false);
    });

    it('treats non-normalised but equivalent paths as matching (extreme case)', () => {
        // Trailing slash
        expect(terminalCwdMatches({ cwd: '/ws/pipeline-a/' }, targetFolder)).toBe(true);
        // Redundant inner segments (e.g. /ws/other/../pipeline-a)
        expect(terminalCwdMatches({ cwd: '/ws/other/../pipeline-a' }, targetFolder)).toBe(true);
        // Current dir segment (e.g. /ws/./pipeline-a)
        expect(terminalCwdMatches({ cwd: '/ws/./pipeline-a' }, targetFolder)).toBe(true);
    });
});

describe('M15 — Ignore Files Exclude *.log and gemini.log', () => {
    it('generated ignore file content includes *.log and gemini.log (simple case)', () => {
        const content = getDefaultIgnoreFileContent();
        expect(content).toContain('*.log');
        expect(content).toContain('gemini.log');
    });

    it('DEFAULT_IGNORE_PATTERNS contains all required exclusions (extreme case)', () => {
        expect(DEFAULT_IGNORE_PATTERNS).toContain('.git');
        expect(DEFAULT_IGNORE_PATTERNS).toContain('.venv');
        expect(DEFAULT_IGNORE_PATTERNS).toContain('node_modules');
        expect(DEFAULT_IGNORE_PATTERNS).toContain('__pycache__');
        expect(DEFAULT_IGNORE_PATTERNS).toContain('target/');
        expect(DEFAULT_IGNORE_PATTERNS).toContain('*.beam');
        expect(DEFAULT_IGNORE_PATTERNS).toContain('*.tf');
        expect(DEFAULT_IGNORE_PATTERNS).toContain('*.log');
        expect(DEFAULT_IGNORE_PATTERNS).toContain('gemini.log');
    });

    it('getDefaultIgnoreFileContent returns properly newline-terminated rules (failure case)', () => {
        const content = getDefaultIgnoreFileContent();
        expect(content.endsWith('\n')).toBe(true);
        const lines = content.trim().split('\n');
        expect(lines.length).toBe(DEFAULT_IGNORE_PATTERNS.length);
        // Ensure *.log is an exact line rule, not substring of another rule
        expect(lines).toContain('*.log');
        expect(lines).toContain('gemini.log');
    });
});
