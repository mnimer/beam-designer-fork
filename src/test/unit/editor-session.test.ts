/**
 * @fileoverview Tests for per-panel session state (findings F1/F4), runtime
 * variable sanitizing in handleRunPipeline (S1), Workspace Trust gating (S2)
 * and project resolution before spawn (F6).
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const vscodeState = vi.hoisted(() => ({ isTrusted: true as boolean | undefined }));

vi.mock('vscode', () => ({
    TreeItem: class {},
    TreeItemCollapsibleState: { None: 0, Collapsed: 1, Expanded: 2 },
    EventEmitter: class {
        public fire = vi.fn();
        public event = vi.fn();
    },
    ThemeIcon: class {},
    ThemeColor: class {},
    MarkdownString: class {},
    CancellationTokenSource: class {
        public token = { isCancellationRequested: false };
        public cancel = vi.fn();
        public dispose = vi.fn();
    },
    workspace: {
        get isTrusted() {
            return vscodeState.isTrusted;
        },
        workspaceFolders: [],
        findFiles: vi.fn().mockResolvedValue([]),
        getConfiguration: vi.fn(() => ({ get: vi.fn() })),
    },
    Uri: {
        file: (p: string) => ({ fsPath: p, toString: () => p }),
        parse: (u: string) => ({ fsPath: u, toString: () => u }),
    },
    commands: { registerCommand: vi.fn(), executeCommand: vi.fn() },
    window: {
        showErrorMessage: vi.fn(),
        showWarningMessage: vi.fn(),
        showInformationMessage: vi.fn(),
        createOutputChannel: vi.fn(() => ({
            show: vi.fn(),
            append: vi.fn(),
            appendLine: vi.fn(),
            dispose: vi.fn(),
        })),
    },
    env: { openExternal: vi.fn() },
}));

const spawned = vi.hoisted(() => ({ calls: [] as Array<{ cmd: string; args: string[]; opts: any; child: any }> }));

vi.mock('child_process', async () => {
    const { EventEmitter: EE } = await import('events');
    return {
        execFile: vi.fn((_bin: string, _args: string[], _opts: any, cb: any) => {
            const callback = typeof _opts === 'function' ? _opts : cb;
            callback(null, 'resolved-project\n', '');
        }),
        spawn: vi.fn((cmd: string, args: string[], opts: any) => {
            const child: any = new EE();
            child.stdout = new EE();
            child.stderr = new EE();
            child.pid = undefined;
            child.kill = vi.fn();
            spawned.calls.push({ cmd, args, opts, child });
            return child;
        }),
    };
});

const regen = vi.hoisted(() => ({ fn: vi.fn() }));
vi.mock('../../codeGeneration', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../codeGeneration')>();
    return { ...actual, handleRegenerateCode: regen.fn };
});

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { EditorSession } from '../../editor/EditorSession';
import {
    MessageContext,
    handleRegenerateCodeCommand,
    handleStopCodeGeneration,
    handleRunPipeline,
    handleStopPipeline,
} from '../../extension';

/**
 * Builds a minimal MessageContext bound to `session`.
 *
 * @param session Session the context should use.
 * @param extra Extra context fields.
 * @returns Context plus the postToWebview spy.
 */
function makeCtx(session: EditorSession, extra: Partial<MessageContext> = {}) {
    const postToWebview = vi.fn(() => true);
    const ctx = {
        context: {} as any,
        webview: {} as any,
        postToWebview,
        session,
        outputChannel: { show: vi.fn(), append: vi.fn(), appendLine: vi.fn() } as any,
        ...extra,
    } as MessageContext;
    return { ctx, postToWebview };
}

describe('EditorSession', () => {
    it('beginGeneration aborts the previous controller', () => {
        const s = new EditorSession();
        const first = s.beginGeneration();
        const second = s.beginGeneration();
        expect(first.signal.aborted).toBe(true);
        expect(second.signal.aborted).toBe(false);
    });

    it('endGeneration ignores stale controllers', () => {
        const s = new EditorSession();
        const first = s.beginGeneration();
        const second = s.beginGeneration();
        s.endGeneration(first);
        expect(s.cancelGeneration()).toBe(true);
        expect(second.signal.aborted).toBe(true);
    });

    it('clearProcessIf only clears the matching process', () => {
        const s = new EditorSession();
        const a: any = { kill: vi.fn() };
        const b: any = { kill: vi.fn() };
        s.setProcess(a);
        s.setProcess(b);
        s.clearProcessIf(a);
        expect(s.activeProcess).toBe(b);
    });

    it('dispose aborts generation and stops the process', () => {
        const s = new EditorSession();
        const controller = s.beginGeneration();
        const proc: any = { kill: vi.fn(), pid: undefined };
        s.setProcess(proc);
        s.dispose();
        expect(controller.signal.aborted).toBe(true);
        expect(proc.kill).toHaveBeenCalledWith('SIGINT');
        expect(s.activeProcess).toBeNull();
        expect(s.isDisposed).toBe(true);
    });
});

describe('handleRegenerateCodeCommand / handleStopCodeGeneration', () => {
    beforeEach(() => {
        regen.fn.mockReset();
        vscodeState.isTrusted = true;
    });

    it('passes an AbortSignal that Stop aborts', async () => {
        let captured: AbortSignal | undefined;
        let release!: () => void;
        regen.fn.mockImplementation((opts: any) => {
            captured = opts.abortSignal;
            return new Promise<void>((r) => { release = r; });
        });
        const session = new EditorSession();
        const { ctx, postToWebview } = makeCtx(session);

        const running = handleRegenerateCodeCommand(ctx, { command: 'regenerateCode' });
        await Promise.resolve();
        expect(captured).toBeDefined();
        expect(captured!.aborted).toBe(false);

        await handleStopCodeGeneration(ctx, { command: 'stopCodeGeneration' });
        expect(captured!.aborted).toBe(true);
        expect(postToWebview).toHaveBeenCalledWith({ command: 'codeGenerationStopped' });

        release();
        await running;
    });

    it('stopping one panel does not abort another panel', async () => {
        const signals: AbortSignal[] = [];
        const releases: Array<() => void> = [];
        regen.fn.mockImplementation((opts: any) => {
            signals.push(opts.abortSignal);
            return new Promise<void>((r) => releases.push(r));
        });
        const a = makeCtx(new EditorSession());
        const b = makeCtx(new EditorSession());
        const pa = handleRegenerateCodeCommand(a.ctx, {});
        const pb = handleRegenerateCodeCommand(b.ctx, {});
        await Promise.resolve();

        await handleStopCodeGeneration(a.ctx, {});
        expect(signals[0].aborted).toBe(true);
        expect(signals[1].aborted).toBe(false);

        releases.forEach((r) => r());
        await Promise.all([pa, pb]);
    });

    it('refuses to generate in an untrusted workspace', async () => {
        vscodeState.isTrusted = false;
        const { ctx, postToWebview } = makeCtx(new EditorSession());
        await handleRegenerateCodeCommand(ctx, {});
        expect(regen.fn).not.toHaveBeenCalled();
        expect(postToWebview).toHaveBeenCalledWith(
            expect.objectContaining({ command: 'codeRegenerated', success: false })
        );
    });
});

describe('handleRunPipeline', () => {
    let tmpDir: string;

    beforeEach(() => {
        spawned.calls.length = 0;
        vscodeState.isTrusted = true;
        vi.mocked(vscode.window.showErrorMessage).mockClear();
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'beam-run-'));
        fs.mkdirSync(path.join(tmpDir, 'demo'));
        fs.writeFileSync(path.join(tmpDir, 'demo', 'run_directrunner.sh'), '#!/bin/bash\necho hi\n');
    });

    /**
     * Context whose document lives at `<tmpDir>/demo.beam`.
     *
     * @param session Session to bind.
     * @returns Context and poster spy.
     */
    function runCtx(session: EditorSession) {
        return makeCtx(session, { uri: vscode.Uri.file(path.join(tmpDir, 'demo.beam')) as any });
    }

    it('drops dangerous runtime variables and keeps safe ones', async () => {
        const { ctx } = runCtx(new EditorSession());
        await handleRunPipeline(ctx, {
            jobConfig: { runner: 'DirectRunner', projectId: 'p' },
            runtimeVariables: [
                { key: 'DB_HOST', value: 'db' },
                { key: 'BASH_ENV', value: '/tmp/evil.sh' },
                { key: 'LD_PRELOAD', value: '/tmp/evil.so' },
            ],
        });
        expect(spawned.calls).toHaveLength(1);
        const env = spawned.calls[0].opts.env;
        expect(env.DB_HOST).toBe('db');
        expect(env.BASH_ENV).toBe(process.env.BASH_ENV);
        expect(env.LD_PRELOAD).toBe(process.env.LD_PRELOAD);
    });

    it('refuses to run in an untrusted workspace', async () => {
        vscodeState.isTrusted = false;
        const { ctx, postToWebview } = runCtx(new EditorSession());
        await handleRunPipeline(ctx, { jobConfig: { runner: 'DirectRunner' } });
        expect(spawned.calls).toHaveLength(0);
        expect(postToWebview).toHaveBeenCalledWith(
            expect.objectContaining({ command: 'pipelineFinished', status: 'failed' })
        );
    });

    it('resolves the gcloud project before spawn and reports it with the job id', async () => {
        const { ctx, postToWebview } = runCtx(new EditorSession());
        await handleRunPipeline(ctx, { jobConfig: { runner: 'DirectRunner' } });
        const child = spawned.calls[0].child;
        child.stdout.emit('data', 'Submitted job: 2026-01-01_00_00_00-1234567890123\n');
        expect(postToWebview).toHaveBeenCalledWith(
            expect.objectContaining({ command: 'pipelineJobIdDetected', projectId: 'resolved-project' })
        );
    });

    it('keeps an explicit projectId instead of overwriting it with gcloud config', async () => {
        const { ctx, postToWebview } = runCtx(new EditorSession());
        await handleRunPipeline(ctx, { jobConfig: { runner: 'DirectRunner', projectId: 'explicit' } });
        spawned.calls[0].child.stdout.emit('data', 'Submitted job: 2026-01-01_00_00_00-1234567890123\n');
        expect(postToWebview).toHaveBeenCalledWith(
            expect.objectContaining({ command: 'pipelineJobIdDetected', projectId: 'explicit' })
        );
    });

    it('runs in two sessions without killing each other; stop only affects its own', async () => {
        const a = runCtx(new EditorSession());
        const b = runCtx(new EditorSession());
        await handleRunPipeline(a.ctx, { jobConfig: { runner: 'DirectRunner', projectId: 'p' } });
        await handleRunPipeline(b.ctx, { jobConfig: { runner: 'DirectRunner', projectId: 'p' } });
        const [childA, childB] = spawned.calls.map((c) => c.child);
        expect(childA.kill).not.toHaveBeenCalled();

        await handleStopPipeline(a.ctx, {});
        expect(childA.kill).toHaveBeenCalledWith('SIGINT');
        expect(childB.kill).not.toHaveBeenCalled();
        expect(b.ctx.session!.activeProcess).toBe(childB);
    });
});

