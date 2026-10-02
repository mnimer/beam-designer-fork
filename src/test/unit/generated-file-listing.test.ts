/**
 * Regression tests for the Source Code tab's generated-file listing.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Bug: after running a generated Python pipeline once, the Source Code tab listed 4000+
 * files. The generated `run_directrunner.sh` creates its virtualenv as `venv` -- with NO
 * leading dot -- and the recursive walker in `handleReadFolderFiles` only skipped entries
 * beginning with '.'. So `.venv` was filtered but the `venv` that is actually created was
 * walked in full.
 *
 * The same gap existed in DEFAULT_IGNORE_PATTERNS, which is written into the generated
 * .dockerignore / .gcloudignore, meaning the virtualenv was also being uploaded to
 * Cloud Build.
 *
 * These tests drive the real handler against a real temporary directory laid out like a
 * generated project that has been run once.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

vi.mock('vscode', async () => (await import('./helpers/vscodeMock')).createVscodeMock());

import {
    handleReadFolderFiles,
    DEFAULT_IGNORE_PATTERNS,
    GENERATED_FILE_LIST_EXCLUDE_DIRS,
} from '../../extension';

describe('Source Code tab file listing — dependency directories are excluded', () => {
    let tempDir: string;

    /** Creates a file, making any missing parent directories first. */
    const write = (rel: string, content = 'x') => {
        const full = path.join(tempDir, rel);
        fs.mkdirSync(path.dirname(full), { recursive: true });
        fs.writeFileSync(full, content, 'utf-8');
    };

    beforeEach(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'beam-filelist-'));

        // The files the generator actually produced.
        write('requirements.txt');
        write('Dockerfile');
        write('README.md');
        write('run_directrunner.sh');
        write('src/__init__.py');
        write('src/generate_mock_data_pipeline.py');

        // What running the pipeline once leaves behind. `venv` has NO leading dot --
        // this is the exact directory that caused the reported bug.
        write('venv/pyvenv.cfg');
        write('venv/bin/activate');
        write('venv/lib/python3.11/site-packages/apache_beam/__init__.py');
        write('venv/lib/python3.11/site-packages/numpy/core/_methods.py');

        // Java equivalents, plus a dot-prefixed venv for good measure.
        write('target/classes/com/example/Pipeline.class');
        write('.venv/bin/activate');
        write('node_modules/left-pad/index.js');
    });

    afterEach(() => {
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    /** Invokes the real handler and returns the file list it posted to the webview. */
    const listFiles = async (): Promise<string[]> => {
        const postToWebview = vi.fn();
        const ctx: any = {
            context: {},
            document: undefined,
            uri: undefined,
            webview: {},
            postToWebview,
            outputChannel: { appendLine: vi.fn(), show: vi.fn() },
        };
        await handleReadFolderFiles(ctx, { folderPath: tempDir });

        const call = postToWebview.mock.calls
            .map(c => c[0])
            .find((m: any) => m && m.command === 'folderFilesRead');
        expect(call, 'handler should post a folderFilesRead message').toBeDefined();
        return call.files as string[];
    };

    it('non-vacuity guard: the fixture really does contain a large venv on disk', () => {
        // Without this, an assertion that "no venv files are listed" could pass simply
        // because the fixture never created any.
        const venvFiles = fs.readdirSync(path.join(tempDir, 'venv'), { recursive: true } as any);
        expect((venvFiles as string[]).length).toBeGreaterThan(0);
    });

    it('lists the generated project files', async () => {
        const files = await listFiles();
        expect(files).toContain('requirements.txt');
        expect(files).toContain('Dockerfile');
        expect(files).toContain('README.md');
        expect(files).toContain('src/generate_mock_data_pipeline.py');
    });

    it('excludes the dot-less venv directory that the run script creates', async () => {
        const files = await listFiles();
        const leaked = files.filter(f => f.startsWith('venv/'));
        expect(leaked, `venv files leaked into the listing: ${leaked.slice(0, 5).join(', ')}`).toEqual([]);
    });

    it('excludes target/ and node_modules/ as well', async () => {
        const files = await listFiles();
        expect(files.filter(f => f.startsWith('target/'))).toEqual([]);
        expect(files.filter(f => f.startsWith('node_modules/'))).toEqual([]);
    });

    it('keeps the listing small enough to be usable', async () => {
        const files = await listFiles();
        // The fixture has 6 generated files. The bug produced 4000+.
        expect(files.length).toBe(6);
    });

    it('DEFAULT_IGNORE_PATTERNS covers the venv name the run script actually creates', () => {
        // This list is written into .dockerignore / .gcloudignore. Missing `venv` meant the
        // whole virtualenv was uploaded to Cloud Build.
        expect(DEFAULT_IGNORE_PATTERNS).toContain('venv');
        expect(DEFAULT_IGNORE_PATTERNS).toContain('.venv');
    });

    it('the exclude list covers every venv spelling run_directrunner.sh probes for', () => {
        // The generated script checks `venv` first, then `.venv`; both must be excluded.
        expect(GENERATED_FILE_LIST_EXCLUDE_DIRS).toContain('venv');
        expect(GENERATED_FILE_LIST_EXCLUDE_DIRS).toContain('.venv');
        expect(GENERATED_FILE_LIST_EXCLUDE_DIRS).toContain('target');
        expect(GENERATED_FILE_LIST_EXCLUDE_DIRS).toContain('node_modules');
    });
});
