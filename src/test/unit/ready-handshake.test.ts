/**
 * @fileoverview Unit tests for the P9 `ready` handshake ordering and the cached gcloud
 * project lookup.
 *
 * Contract under test:
 * - `handleReady` posts `loadPipeline` synchronously, BEFORE gcloud resolves, so the
 *   canvas never waits on a CLI spawn.
 * - `handleReady` no longer posts `samplesLoaded` (the webview requests `getSamples`
 *   separately; doing both was redundant disk I/O on the startup path).
 * - The resolved project arrives afterwards as `projectIdResolved`.
 * - `getGcloudProjectCached` dedupes concurrent lookups and reuses results within the TTL.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('vscode', async () => (await import('./helpers/vscodeMock')).createVscodeMock());

// Capture execFile callbacks so each test decides exactly when (and how) gcloud "responds".
type ExecCallback = (error: Error | null, stdout: string, stderr: string) => void;
const execCalls: Array<{ bin: string; args: string[]; cb: ExecCallback }> = [];
vi.mock('child_process', () => ({
    execFile: vi.fn((bin: string, args: string[], _opts: unknown, cb: ExecCallback) => {
        execCalls.push({ bin, args, cb });
        return {} as any;
    })
}));

vi.mock('../../cli/cliResolver', () => ({
    findGcloudPath: () => 'gcloud',
    resolveCli: () => 'gcloud'
}));

import { handleReady } from '../../ipc/handlers/workspaceHandlers';
import {
    GCLOUD_PROJECT_CACHE_TTL_MS,
    getGcloudProjectCached,
    resetGcloudProjectCache
} from '../../cli/gcloudClient';
import type { MessageContext } from '../../ipc/messageContext';

/** Resolves the oldest pending gcloud invocation with the given stdout. */
function answerGcloud(stdout: string, error: Error | null = null): void {
    const call = execCalls.shift();
    if (!call) {
        throw new Error('No pending gcloud invocation to answer');
    }
    call.cb(error, stdout, '');
}

/** Lets already-queued promise continuations run. */
const flushMicrotasks = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** Builds a MessageContext with an in-memory document and a recording post function. */
function makeContext(text = '{"nodes":[],"edges":[]}'): MessageContext & { posted: any[] } {
    const posted: any[] = [];
    const ctx = {
        context: { extensionPath: '/ext' } as any,
        webview: {} as any,
        document: {
            uri: { fsPath: '/ws/pipelines/demo.beam' },
            getText: () => text
        } as any,
        syncState: { lastSavedContent: '' } as any,
        postToWebview: vi.fn((msg: any) => {
            posted.push(msg);
            return true;
        }),
        posted
    };
    return ctx as unknown as MessageContext & { posted: any[] };
}

beforeEach(() => {
    execCalls.length = 0;
    resetGcloudProjectCache();
});

describe('handleReady (P9 ordering)', () => {
    it('posts loadPipeline synchronously before gcloud has answered', async () => {
        const ctx = makeContext('{"nodes":[{"id":"1"}],"edges":[]}');

        const pending = handleReady(ctx, { command: 'ready' });

        // loadPipeline must already be posted even though gcloud has not responded yet.
        expect(execCalls).toHaveLength(1);
        expect(execCalls[0].args).toEqual(['config', 'get-value', 'project']);
        expect(ctx.posted.map((m) => m.command)).toEqual(['loadPipeline']);
        expect(ctx.posted[0]).toMatchObject({
            command: 'loadPipeline',
            data: '{"nodes":[{"id":"1"}],"edges":[]}',
            filename: 'demo.beam'
        });
        expect(ctx.posted[0]).not.toHaveProperty('projectId');

        answerGcloud('my-gcp-project\n');
        await pending;

        expect(ctx.posted.map((m) => m.command)).toEqual(['loadPipeline', 'projectIdResolved']);
        expect(ctx.posted[1]).toEqual({ command: 'projectIdResolved', projectId: 'my-gcp-project' });
    });

    it('does not post samplesLoaded (samples are fetched via the separate getSamples request)', async () => {
        const ctx = makeContext();
        const pending = handleReady(ctx, { command: 'ready' });
        answerGcloud('p\n');
        await pending;

        expect(ctx.posted.some((m) => m.command === 'samplesLoaded')).toBe(false);
    });

    it('still posts projectIdResolved (with undefined) when gcloud fails', async () => {
        const ctx = makeContext();
        const pending = handleReady(ctx, { command: 'ready' });
        answerGcloud('', new Error('spawn gcloud ENOENT'));
        await pending;

        expect(ctx.posted[1]).toEqual({ command: 'projectIdResolved', projectId: undefined });
    });

    it('records the document text as lastSavedContent before posting', async () => {
        const ctx = makeContext('abc');
        const pending = handleReady(ctx, { command: 'ready' });
        expect(ctx.syncState?.lastSavedContent).toBe('abc');
        answerGcloud('p\n');
        await pending;
    });
});

describe('getGcloudProjectCached', () => {
    it('shares one in-flight gcloud call between concurrent callers', async () => {
        const a = getGcloudProjectCached();
        const b = getGcloudProjectCached();
        expect(execCalls).toHaveLength(1);

        answerGcloud('shared-project\n');
        await expect(a).resolves.toBe('shared-project');
        await expect(b).resolves.toBe('shared-project');
    });

    it('reuses the cached value within the TTL without spawning gcloud again', async () => {
        let t = 1_000;
        const now = () => t;

        const first = getGcloudProjectCached(now);
        answerGcloud('cached-project\n');
        await expect(first).resolves.toBe('cached-project');

        t += GCLOUD_PROJECT_CACHE_TTL_MS - 1;
        await expect(getGcloudProjectCached(now)).resolves.toBe('cached-project');
        expect(execCalls).toHaveLength(0);
    });

    it('re-queries gcloud once the TTL has elapsed', async () => {
        let t = 1_000;
        const now = () => t;

        const first = getGcloudProjectCached(now);
        answerGcloud('old-project\n');
        await first;

        t += GCLOUD_PROJECT_CACHE_TTL_MS;
        const second = getGcloudProjectCached(now);
        expect(execCalls).toHaveLength(1);
        answerGcloud('new-project\n');
        await expect(second).resolves.toBe('new-project');
    });

    it('caches a negative result so an unavailable gcloud is not re-spawned on every open', async () => {
        const first = getGcloudProjectCached();
        answerGcloud('', new Error('ENOENT'));
        await expect(first).resolves.toBeUndefined();

        await expect(getGcloudProjectCached()).resolves.toBeUndefined();
        expect(execCalls).toHaveLength(0);
    });

    it('resetGcloudProjectCache forces a fresh lookup', async () => {
        const first = getGcloudProjectCached();
        answerGcloud('p1\n');
        await first;

        resetGcloudProjectCache();
        const second = getGcloudProjectCached();
        expect(execCalls).toHaveLength(1);
        answerGcloud('p2\n');
        await expect(second).resolves.toBe('p2');
        await flushMicrotasks();
    });
});
