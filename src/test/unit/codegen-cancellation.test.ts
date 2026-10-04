/**
 * Unit tests for code-generation cancellation (F1) and private log handling (S6).
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Tests:
 * - executeCodeGeneration forwards an AbortSignal to the Gemini SDK call.
 * - A cancellation that lands while the model call is in flight prevents ANY cleanup or
 *   file write, suppresses the error toast, and reports `cancelled: true` to the webview.
 * - gemini.log is written owner-read/write only (0o600) and a .gitignore excluding it is
 *   created in the output folder when none exists.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const generateContentMock = vi.fn();

vi.mock('@google/genai', () => ({
    GoogleGenAI: class {
        public models = { generateContent: generateContentMock };
    },
}));

vi.mock('../../beamVersion', () => ({
    getLatestBeamVersion: async () => '2.76.0',
    FALLBACK_BEAM_VERSION: '2.76.0',
}));

const showErrorMessage = vi.fn();

vi.mock('vscode', async () => (await import('./helpers/vscodeMock')).createVscodeMock({
    workspace: {
        workspaceFolders: []
    },
    window: {
        showErrorMessage: (...args: unknown[]) => showErrorMessage(...args)
    }
}));

import { executeCodeGeneration } from '../../codeGeneration';

const REPO_ROOT = path.resolve(__dirname, '../../..');

/** Minimal ExtensionContext stand-in: only asAbsolutePath is used by readResourceFile. */
const fakeContext = { asAbsolutePath: (p: string) => path.join(REPO_ROOT, p) } as any;

/** A valid structured Gemini response containing one Python pipeline file. */
const VALID_RESPONSE = {
    text: JSON.stringify({ files: [{ filename: 'src/pipe.py', content: 'print("hi")\n' }] }),
    candidates: [{ finishReason: 'STOP' }],
    usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20 },
};

describe('F1 — code generation cancellation', () => {
    let tempDir: string;

    beforeEach(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'beam-cancel-'));
        generateContentMock.mockReset();
        showErrorMessage.mockReset();
    });

    afterEach(() => {
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    /** Builds the options object shared by every test, with the given signal. */
    const buildOptions = (post: (m: any) => boolean, abortSignal?: AbortSignal) => ({
        targetFolderPath: tempDir,
        yamlData: 'nodes: []\nedges: []\n',
        languageVal: 'Python',
        baseName: 'pipe',
        generationPipelineId: 'test-pipeline',
        folderGate: { ownership: 'fresh', manifest: null, mayClean: false },
        context: fakeContext,
        postToWebview: post,
        getGcloudProjectFn: async () => undefined,
        abortSignal,
    });

    it('forwards the abort signal to the Gemini SDK call', async () => {
        generateContentMock.mockResolvedValue(VALID_RESPONSE);
        const controller = new AbortController();
        await executeCodeGeneration(buildOptions(() => true, controller.signal));

        expect(generateContentMock).toHaveBeenCalledTimes(1);
        const request = generateContentMock.mock.calls[0][0];
        expect(request.config.abortSignal).toBe(controller.signal);
    });

    it('writes no files and reports cancelled when aborted while the model call is in flight', async () => {
        const controller = new AbortController();
        // Simulate the user pressing Stop while the request is outstanding: the SDK call
        // still resolves (AbortSignal is client-side only) but the signal is now aborted.
        generateContentMock.mockImplementation(async () => {
            controller.abort();
            return VALID_RESPONSE;
        });
        const posted: any[] = [];

        await executeCodeGeneration(buildOptions((m) => { posted.push(m); return true; }, controller.signal));

        expect(fs.existsSync(path.join(tempDir, 'src', 'pipe.py'))).toBe(false);
        expect(fs.existsSync(path.join(tempDir, '.dockerignore'))).toBe(false);
        expect(fs.existsSync(path.join(tempDir, '.beamgen.json'))).toBe(false);
        expect(showErrorMessage).not.toHaveBeenCalled();
        expect(posted).toContainEqual(expect.objectContaining({
            command: 'codeRegenerated', success: false, cancelled: true,
        }));
    });

    it('treats an SDK AbortError as a cancellation, not a failure', async () => {
        const controller = new AbortController();
        generateContentMock.mockImplementation(async () => {
            controller.abort();
            const err = new Error('This operation was aborted');
            err.name = 'AbortError';
            throw err;
        });
        const posted: any[] = [];

        await executeCodeGeneration(buildOptions((m) => { posted.push(m); return true; }, controller.signal));

        expect(showErrorMessage).not.toHaveBeenCalled();
        expect(posted).toContainEqual(expect.objectContaining({ cancelled: true }));
    });

    it('still generates normally when no signal is supplied', async () => {
        generateContentMock.mockResolvedValue(VALID_RESPONSE);
        const posted: any[] = [];

        await executeCodeGeneration(buildOptions((m) => { posted.push(m); return true; }));

        expect(fs.existsSync(path.join(tempDir, 'src', 'pipe.py'))).toBe(true);
        expect(posted).toContainEqual(expect.objectContaining({ command: 'codeRegenerated', success: true }));
    });
});

describe('S6 — gemini.log privacy', () => {
    let tempDir: string;

    beforeEach(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'beam-log-'));
        generateContentMock.mockReset();
        generateContentMock.mockResolvedValue(VALID_RESPONSE);
    });

    afterEach(() => {
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    /** Runs a successful generation into tempDir. */
    const runGeneration = () => executeCodeGeneration({
        targetFolderPath: tempDir,
        yamlData: 'nodes: []\nedges: []\n',
        languageVal: 'Python',
        baseName: 'pipe',
        generationPipelineId: 'test-pipeline',
        folderGate: { ownership: 'fresh', manifest: null, mayClean: false },
        context: fakeContext,
        postToWebview: () => true,
        getGcloudProjectFn: async () => undefined,
    });

    it.skipIf(process.platform === 'win32')('writes gemini.log with 0600 permissions, even over an existing 0644 file', async () => {
        const logPath = path.join(tempDir, 'gemini.log');
        fs.writeFileSync(logPath, '{}', { mode: 0o644 });

        await runGeneration();

        expect(fs.statSync(logPath).mode & 0o777).toBe(0o600);
    });

    it('creates a .gitignore that excludes gemini.log when none exists', async () => {
        await runGeneration();

        const gitignore = fs.readFileSync(path.join(tempDir, '.gitignore'), 'utf-8');
        expect(gitignore.split(/\r?\n/)).toContain('gemini.log');
    });

    it('does not overwrite an existing user .gitignore', async () => {
        const gitignorePath = path.join(tempDir, '.gitignore');
        fs.writeFileSync(gitignorePath, 'my-custom-entry\n');

        await runGeneration();

        expect(fs.readFileSync(gitignorePath, 'utf-8')).toBe('my-custom-entry\n');
    });
});
