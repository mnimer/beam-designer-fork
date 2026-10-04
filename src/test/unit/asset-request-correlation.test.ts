/**
 * @fileoverview Tests for F11 asset request/response correlation: the shared
 * requestParams helpers and the router echoing request parameters on asset
 * discovery responses.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

import { describe, it, expect, vi } from 'vitest';

vi.mock('vscode', async () => (await import('./helpers/vscodeMock')).createVscodeMock({
    workspace: {
        workspaceFolders: []
    }
}));

import {
    extractRequestParams,
    requestParamsKey,
    isResponseForParams,
    REQUEST_PARAMS_FIELD
} from '../../shared/requestParams';
import { handleMessages, ASSET_REQUEST_COMMANDS, withRequestParamsEcho } from '../../ipc/messageRouter';
import type { MessageContext } from '../../ipc/messageContext';

describe('F11 — shared requestParams helpers', () => {
    it('extracts every field except command', () => {
        expect(extractRequestParams({ command: 'getTables', dataset: 'ds1' })).toEqual({ dataset: 'ds1' });
        expect(extractRequestParams({ command: 'getTopics' })).toEqual({});
    });

    it('returns an empty object for non-object input', () => {
        expect(extractRequestParams(null)).toEqual({});
        expect(extractRequestParams(undefined)).toEqual({});
        expect(extractRequestParams('getTables')).toEqual({});
    });

    it('builds an order-independent key that ignores undefined values', () => {
        expect(requestParamsKey({ a: 1, b: 'x' })).toBe(requestParamsKey({ b: 'x', a: 1 }));
        expect(requestParamsKey({ a: 1, b: undefined })).toBe(requestParamsKey({ a: 1 }));
        expect(requestParamsKey({ dataset: 'ds1' })).not.toBe(requestParamsKey({ dataset: 'ds2' }));
    });

    it('accepts responses without an echo (legacy senders)', () => {
        expect(isResponseForParams({ command: 'tablesLoaded', tables: [] }, { dataset: 'ds1' })).toBe(true);
        expect(isResponseForParams(null, { dataset: 'ds1' })).toBe(true);
    });

    it('accepts a matching echo and rejects a different one', () => {
        const response = { command: 'tablesLoaded', tables: [], [REQUEST_PARAMS_FIELD]: { dataset: 'ds1' } };
        expect(isResponseForParams(response, { dataset: 'ds1' })).toBe(true);
        expect(isResponseForParams(response, { dataset: 'ds2' })).toBe(false);
    });

    it('treats an empty echo as matching an empty parameter set', () => {
        const response = { command: 'topicsLoaded', topics: [], [REQUEST_PARAMS_FIELD]: {} };
        expect(isResponseForParams(response, {})).toBe(true);
    });
});

describe('F11 — router echoes request parameters on asset responses', () => {
    const makeCtx = () => {
        const posted: any[] = [];
        const ctx = {
            postToWebview: (msg: any) => {
                posted.push(msg);
                return true;
            }
        } as unknown as MessageContext;
        return { ctx, posted };
    };

    it('adds requestParams to every message posted by the wrapped context', () => {
        const { ctx, posted } = makeCtx();
        const wrapped = withRequestParamsEcho(ctx, { command: 'getTables', dataset: 'ds1' });
        wrapped.postToWebview({ command: 'tablesLoaded', tables: ['t1'] });
        expect(posted).toEqual([
            { command: 'tablesLoaded', tables: ['t1'], requestParams: { dataset: 'ds1' } }
        ]);
    });

    it('does not mutate the original context', () => {
        const { ctx, posted } = makeCtx();
        withRequestParamsEcho(ctx, { command: 'getTables', dataset: 'ds1' });
        ctx.postToWebview({ command: 'tablesLoaded', tables: [] });
        expect(posted).toEqual([{ command: 'tablesLoaded', tables: [] }]);
    });

    it('covers exactly the asset discovery commands', () => {
        expect([...ASSET_REQUEST_COMMANDS].sort()).toEqual([
            'getAwsQueues',
            'getBigtableInstances',
            'getBigtableTables',
            'getComputeInstances',
            'getDatasets',
            'getHealthcareDatasets',
            'getNetworks',
            'getProjects',
            'getSecrets',
            'getSqlDatabases',
            'getSqlInstances',
            'getStorageBuckets',
            'getSubnetworks',
            'getSubscriptions',
            'getTables',
            'getTopics',
        ]);
    });

    it('echoes parameters end-to-end through handleMessages for a validation error response', async () => {
        const posted: any[] = [];
        const webview: any = {
            postMessage: vi.fn((msg) => {
                posted.push(msg);
                return true;
            }),
            onDidReceiveMessage: vi.fn()
        };
        const dispatch = handleMessages(webview, { subscriptions: [], extensionPath: '/mock' } as any);

        // An invalid dataset name is rejected before any CLI call, so the
        // response is posted synchronously by the handler.
        await dispatch({ command: 'getTables', dataset: 'bad name; rm -rf /' });

        expect(posted).toHaveLength(1);
        expect(posted[0].command).toBe('tablesLoaded');
        expect(posted[0].requestParams).toEqual({ dataset: 'bad name; rm -rf /' });
    });

    it('does not echo on non-asset commands', async () => {
        const posted: any[] = [];
        const webview: any = {
            postMessage: vi.fn((msg) => {
                posted.push(msg);
                return true;
            }),
            onDidReceiveMessage: vi.fn()
        };
        const dispatch = handleMessages(webview, { subscriptions: [], extensionPath: '/mock' } as any);
        await dispatch({ command: 'stopCodeGeneration' });
        for (const msg of posted) {
            expect(msg).not.toHaveProperty('requestParams');
        }
    });
});
