/**
 * Safe Output Path and Executable Allowlist Security Tests
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Unit tests validating path containment and script execution gating for finding C1:
 * - Prevents arbitrary file write outside target folder via directory traversal or absolute paths.
 * - Prevents arbitrary chmod 755 execution via LLM-controlled filename/executable flag.
 */

import { describe, it, expect, vi } from 'vitest';
import * as path from 'path';
import {
    resolveSafeOutputPath,
    isAllowedExecutableScript,
    ALLOWED_EXECUTABLE_SCRIPTS
} from '../../extension';

// Mock vscode module because extension.ts imports vscode at the top level
vi.mock('vscode', async () => (await import('./helpers/vscodeMock')).createVscodeMock({
    workspace: {
        workspaceFolders: [
            {
                uri: { fsPath: '/Users/me/ws/mypipeline' },
                name: 'mypipeline'
            }
        ]
    }
}));

describe('resolveSafeOutputPath - Path Traversal Containment', () => {
    const targetDir = '/Users/me/ws/mypipeline';

    // Verify the three escape payloads specifically identified in finding C1 are blocked
    it('rejects the verified directory traversal escape payloads', () => {
        // Payload 1: Leading traversal
        const payload1 = '../../../../tmp/pwned.sh';
        expect(resolveSafeOutputPath(targetDir, payload1)).toBeNull();

        // Payload 2: Mid-path traversal segment
        const payload2 = 'src/../../../../tmp/pwned.sh';
        expect(resolveSafeOutputPath(targetDir, payload2)).toBeNull();

        // Payload 3: Deep nested mid-path traversal
        const payload3 = 'a/b/../../../../../../tmp/pwned.sh';
        expect(resolveSafeOutputPath(targetDir, payload3)).toBeNull();
    });

    it('rejects backslash-based traversal payloads on all platforms', () => {
        const backslashPayload = 'src\\..\\..\\..\\..\\tmp\\pwned.sh';
        expect(resolveSafeOutputPath(targetDir, backslashPayload)).toBeNull();
    });

    it('accepts legitimate relative files within the target folder', () => {
        // Plain root-level source file
        const pythonResult = resolveSafeOutputPath(targetDir, 'main.py');
        expect(pythonResult).toBe(path.resolve(targetDir, 'main.py'));

        // Nested Java package hierarchy
        const javaResult = resolveSafeOutputPath(targetDir, 'src/main/java/App.java');
        expect(javaResult).toBe(path.resolve(targetDir, 'src/main/java/App.java'));

        // Legitimate inner directory navigation that stays contained
        const containedInnerResult = resolveSafeOutputPath(targetDir, 'src/foo/../main.py');
        expect(containedInnerResult).toBe(path.resolve(targetDir, 'src/main.py'));
    });

    it('rejects absolute paths and external references', () => {
        // POSIX absolute paths
        expect(resolveSafeOutputPath(targetDir, '/etc/passwd')).toBeNull();
        expect(resolveSafeOutputPath(targetDir, '/tmp/pwned.sh')).toBeNull();

        // Windows drive-letter paths (backslash and forward slash)
        expect(resolveSafeOutputPath(targetDir, 'C:\\Windows\\System32\\cmd.exe')).toBeNull();
        expect(resolveSafeOutputPath(targetDir, 'C:/evil.sh')).toBeNull();
        expect(resolveSafeOutputPath(targetDir, 'D:foo.txt')).toBeNull();

        // UNC network paths
        expect(resolveSafeOutputPath(targetDir, '\\\\server\\share\\evil.sh')).toBeNull();
    });

    it('rejects filenames resolving to the target directory itself', () => {
        // Direct target folder references
        expect(resolveSafeOutputPath(targetDir, '.')).toBeNull();
        expect(resolveSafeOutputPath(targetDir, './')).toBeNull();
        expect(resolveSafeOutputPath(targetDir, '')).toBeNull();
        expect(resolveSafeOutputPath(targetDir, '   ')).toBeNull();

        // Subdirectory reference resolving back to root
        expect(resolveSafeOutputPath(targetDir, 'subfolder/..')).toBeNull();
        expect(resolveSafeOutputPath(targetDir, 'subfolder/../')).toBeNull();
    });

    it('fails fast on invalid argument types', () => {
        expect(resolveSafeOutputPath('', 'main.py')).toBeNull();
        expect(resolveSafeOutputPath(null as any, 'main.py')).toBeNull();
        expect(resolveSafeOutputPath(targetDir, null as any)).toBeNull();
        expect(resolveSafeOutputPath(undefined as any, undefined as any)).toBeNull();
    });
});

describe('isAllowedExecutableScript - Chmod 755 Allowlist Gating', () => {
    it('accepts all expected runner script templates and execution scripts', () => {
        // Direct basenames
        expect(isAllowedExecutableScript('run_directrunner.sh')).toBe(true);
        expect(isAllowedExecutableScript('run_dataflowrunner.sh')).toBe(true);
        expect(isAllowedExecutableScript('run_dataflow.sh')).toBe(true);
        expect(isAllowedExecutableScript('run_sparkrunner.sh')).toBe(true);
        expect(isAllowedExecutableScript('run_spark.sh')).toBe(true);

        // Full paths containing allowlisted basenames
        expect(isAllowedExecutableScript('/Users/me/ws/mypipeline/run_directrunner.sh')).toBe(true);
        expect(isAllowedExecutableScript('src/run_dataflowrunner.sh')).toBe(true);
    });

    it('rejects unapproved script names not in the allowlist', () => {
        // Arbitrary attacker scripts
        expect(isAllowedExecutableScript('evil.sh')).toBe(false);
        expect(isAllowedExecutableScript('run_evil.sh')).toBe(false);
        expect(isAllowedExecutableScript('exploit.sh')).toBe(false);
        expect(isAllowedExecutableScript('malicious.sh')).toBe(false);
        expect(isAllowedExecutableScript('/tmp/evil.sh')).toBe(false);
    });

    it('rejects non-.sh files even if they share similar runner names', () => {
        expect(isAllowedExecutableScript('run_directrunner.py')).toBe(false);
        expect(isAllowedExecutableScript('run_directrunner.bat')).toBe(false);
        expect(isAllowedExecutableScript('run_directrunner.sh.exe')).toBe(false);
        expect(isAllowedExecutableScript('main.py')).toBe(false);
        expect(isAllowedExecutableScript('src/main/java/App.java')).toBe(false);
        expect(isAllowedExecutableScript('Dockerfile')).toBe(false);
        expect(isAllowedExecutableScript('pom.xml')).toBe(false);
    });

    it('rejects empty, whitespace, and null/undefined values', () => {
        expect(isAllowedExecutableScript('')).toBe(false);
        expect(isAllowedExecutableScript('   ')).toBe(false);
        expect(isAllowedExecutableScript(null as any)).toBe(false);
        expect(isAllowedExecutableScript(undefined as any)).toBe(false);
    });

    it('verifies the set of allowlisted scripts contains expected entries', () => {
        expect(ALLOWED_EXECUTABLE_SCRIPTS.has('run_directrunner.sh')).toBe(true);
        expect(ALLOWED_EXECUTABLE_SCRIPTS.has('run_dataflowrunner.sh')).toBe(true);
        expect(ALLOWED_EXECUTABLE_SCRIPTS.has('run_dataflow.sh')).toBe(true);
        expect(ALLOWED_EXECUTABLE_SCRIPTS.has('run_sparkrunner.sh')).toBe(true);
        expect(ALLOWED_EXECUTABLE_SCRIPTS.has('run_spark.sh')).toBe(true);
        expect(ALLOWED_EXECUTABLE_SCRIPTS.size).toBe(5);
    });
});
