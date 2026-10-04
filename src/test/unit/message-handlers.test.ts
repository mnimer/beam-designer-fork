/**
 * Unit tests for webview message handler registry and dispatching (Refactor A1).
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Validates that:
 * 1. The message handler registry (MESSAGE_HANDLERS) contains all 29 webview commands.
 * 2. handleMessages dispatches known commands to their registered handlers.
 * 3. handleMessages silently ignores unknown commands matching previous switch default behaviour.
 * 4. Individual handlers (showOutputChannel, openExternal, getTables) function correctly in isolation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('vscode', async () => (await import('./helpers/vscodeMock')).createVscodeMock({
    workspace: {
        workspaceFolders: []
    }
}));

vi.mock('child_process', () => {
    return {
        execFile: vi.fn((_bin: string, _args: string[], _opts: any, cb: any) => {
            const callback = typeof _opts === 'function' ? _opts : cb;
            callback(
                null,
                JSON.stringify([
                    { name: 'projects/test-project/locations/us-central1/datasets/fhir-dataset' }
                ]),
                ''
            );
        })
    };
});

import * as vscode from 'vscode';
import {
    MESSAGE_HANDLERS,
    MessageContext,
    handleMessages,
    handleShowOutputChannel,
    handleOpenExternal,
    handleGetTables,
    handleStopPipeline,
    handleGetBigtableTables,
    handleGetSqlDatabases,
    handleGetRunningJobs,
    mapBigtableInstances,
    mapBigtableTables,
    mapSqlInstances,
    mapSqlDatabases,
    mapProjects,
    parseBigtableInstanceParam,
    parseSqlInstanceParam
} from '../../extension';

describe('A1 — Message Handler Registry & Dispatcher', () => {
    const EXPECTED_COMMANDS = [
        'getAwsQueues',
        'getBigtableInstances',
        'getBigtableTables',
        'getComputeInstances',
        'getDatasets',
        'getHealthcareDatasets',
        'getNetworks',
        'getProjects',
        'getRunningJobs',
        'getSamples',
        'getSecrets',
        'getSqlDatabases',
        'getSqlInstances',
        'getStorageBuckets',
        'getSubnetworks',
        'getSubscriptions',
        'getTables',
        'getTopics',
        'openExternal',
        'openSample',
        'pickFolder',
        'readFolderFiles',
        'readFileContent',
        'ready',
        'regenerateCode',
        'runPipeline',
        'savePipeline',
        'showOutputChannel',
        'stopCodeGeneration',
        'stopPipeline',
    ].sort();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Registry completeness and structure', () => {
        it('exposes exactly the 30 expected webview commands (simple case)', () => {
            const actualCommands = Object.keys(MESSAGE_HANDLERS).sort();
            expect(actualCommands).toEqual(EXPECTED_COMMANDS);
            expect(actualCommands).toHaveLength(30);
        });

        it('every registered entry is a callable handler function (extreme case)', () => {
            for (const command of EXPECTED_COMMANDS) {
                const handler = MESSAGE_HANDLERS[command];
                expect(typeof handler).toBe('function');
                // Handler functions accept (ctx, message)
                expect(handler.length).toBeGreaterThanOrEqual(1);
            }
        });
    });

    describe('Dispatcher (handleMessages)', () => {
        const createMockContext = () => {
            const posted: any[] = [];
            const mockWebview: any = {
                postMessage: vi.fn((msg) => {
                    posted.push(msg);
                    return true;
                }),
                onDidReceiveMessage: vi.fn()
            };
            const mockExtensionContext: any = {
                subscriptions: [],
                extensionPath: '/mock/ext/path'
            };
            return {
                webview: mockWebview,
                extensionContext: mockExtensionContext,
                posted
            };
        };

        it('dispatches a known command to its corresponding handler (simple case)', async () => {
            const { webview, extensionContext } = createMockContext();
            const dispatch = handleMessages(webview, extensionContext);

            // Spy on openExternal handler
            const mockOpenExternal = vi.spyOn(vscode.env, 'openExternal');

            await dispatch({ command: 'openExternal', url: 'https://beam.apache.org' });

            expect(mockOpenExternal).toHaveBeenCalledTimes(1);
        });

        it('silently ignores an unknown command without throwing (simple case)', async () => {
            // NOTE: Preserves the pre-existing behaviour where unknown commands hit no switch case
            // and quietly return undefined without logging or throwing.
            const { webview, extensionContext, posted } = createMockContext();
            const dispatch = handleMessages(webview, extensionContext);

            await expect(dispatch({ command: 'someCompletelyUnknownCommand123' })).resolves.toBeUndefined();
            expect(posted).toHaveLength(0);
        });

        it('handles undefined, null, or empty message payloads gracefully without throwing (extreme case)', async () => {
            const { webview, extensionContext, posted } = createMockContext();
            const dispatch = handleMessages(webview, extensionContext);

            await expect(dispatch(undefined)).resolves.toBeUndefined();
            await expect(dispatch(null)).resolves.toBeUndefined();
            await expect(dispatch({})).resolves.toBeUndefined();
            await expect(dispatch({ foo: 'bar' })).resolves.toBeUndefined();
            expect(posted).toHaveLength(0);
        });
    });

    describe('Direct handler execution: handleShowOutputChannel', () => {
        it('shows output channel and logs request when ctx.outputChannel is provided (simple case)', () => {
            const mockChannel: any = {
                show: vi.fn(),
                appendLine: vi.fn()
            };
            const ctx: MessageContext = {
                context: {} as any,
                webview: {} as any,
                postToWebview: vi.fn(),
                outputChannel: mockChannel
            };

            handleShowOutputChannel(ctx, { command: 'showOutputChannel' });

            expect(mockChannel.show).toHaveBeenCalledTimes(1);
            expect(mockChannel.show).toHaveBeenCalledWith(true);
            expect(mockChannel.appendLine).toHaveBeenCalledTimes(1);
            expect(mockChannel.appendLine).toHaveBeenCalledWith(
                expect.stringContaining('Log channel requested from Webview.')
            );
        });

        it('falls back to getDesignerOutputChannel when ctx.outputChannel is omitted (extreme case)', () => {
            const ctx: MessageContext = {
                context: {} as any,
                webview: {} as any,
                postToWebview: vi.fn(),
                outputChannel: undefined
            };

            handleShowOutputChannel(ctx, { command: 'showOutputChannel' });

            expect(vscode.window.createOutputChannel).toHaveBeenCalledWith('Dataflow Designer');
        });
    });

    describe('Direct handler execution: handleOpenExternal', () => {
        it('opens external URL via vscode.env.openExternal (simple case)', () => {
            const mockOpen = vi.spyOn(vscode.env, 'openExternal');
            const ctx: MessageContext = {
                context: {} as any,
                webview: {} as any,
                postToWebview: vi.fn()
            };

            handleOpenExternal(ctx, { command: 'openExternal', url: 'https://cloud.google.com/dataflow' });

            expect(mockOpen).toHaveBeenCalledTimes(1);
        });

        it('does nothing when url is missing from message (extreme case)', () => {
            const mockOpen = vi.spyOn(vscode.env, 'openExternal');
            const ctx: MessageContext = {
                context: {} as any,
                webview: {} as any,
                postToWebview: vi.fn()
            };

            handleOpenExternal(ctx, { command: 'openExternal' });
            handleOpenExternal(ctx, { command: 'openExternal', url: '' });

            expect(mockOpen).not.toHaveBeenCalled();
        });

        it('catches and logs errors if URI parsing throws (failure case)', () => {
            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
            const ctx: MessageContext = {
                context: {} as any,
                webview: {} as any,
                postToWebview: vi.fn()
            };

            expect(() => {
                handleOpenExternal(ctx, { command: 'openExternal', url: 'https://throw-parse-error.com' });
            }).not.toThrow();

            expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to open URL', expect.any(Error));
            consoleErrorSpy.mockRestore();
        });

        it('does not open disallowed URI schemes like command: and opens allowed HTTPS URIs', () => {
            const mockOpen = vi.spyOn(vscode.env, 'openExternal');
            const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
            const ctx: MessageContext = {
                context: {} as any,
                webview: {} as any,
                postToWebview: vi.fn()
            };

            handleOpenExternal(ctx, { command: 'openExternal', url: 'command:workbench.action.quit' });
            expect(mockOpen).not.toHaveBeenCalled();

            handleOpenExternal(ctx, { command: 'openExternal', url: 'https://console.cloud.google.com' });
            expect(mockOpen).toHaveBeenCalledTimes(1);

            consoleWarnSpy.mockRestore();
        });
    });

    describe('Direct handler execution: handleGetTables', () => {
        it('posts error when dataset identifier is missing or contains invalid characters (failure case)', async () => {
            const postToWebviewMock = vi.fn();
            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
            const ctx: MessageContext = {
                context: {} as any,
                webview: {} as any,
                postToWebview: postToWebviewMock
            };

            // Test injection attempt / invalid characters
            await handleGetTables(ctx, { command: 'getTables', dataset: 'bad;dataset`name' });

            expect(postToWebviewMock).toHaveBeenCalledWith(expect.objectContaining({
                command: 'tablesLoaded',
                tables: [],
                error: expect.stringContaining("Invalid or missing dataset identifier: 'bad;dataset`name'")
            }));

            // Test missing dataset
            await handleGetTables(ctx, { command: 'getTables' });
            expect(postToWebviewMock).toHaveBeenCalledWith(expect.objectContaining({
                command: 'tablesLoaded',
                tables: [],
                error: expect.stringContaining('Invalid or missing dataset identifier')
            }));

            consoleErrorSpy.mockRestore();
        });
    });

    describe('Direct handler execution: handleStopPipeline', () => {
        it('safely handles stopPipeline when no execution process is active (simple case)', async () => {
            const postToWebviewMock = vi.fn();
            const ctx: MessageContext = {
                context: {} as any,
                webview: {} as any,
                postToWebview: postToWebviewMock
            };

            await expect(handleStopPipeline(ctx, { command: 'stopPipeline' })).resolves.toBeUndefined();
            expect(postToWebviewMock).not.toHaveBeenCalled();
        });
    });

    describe('Direct handler execution: handleGetBigtableTables (validation)', () => {
        it('posts an error without running gcloud for missing or unsafe instance identifiers (failure case)', async () => {
            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
            for (const instance of [undefined, 'a,b', 'bad;inst', '--project=x', '']) {
                const postToWebviewMock = vi.fn();
                const ctx: MessageContext = { context: {} as any, webview: {} as any, postToWebview: postToWebviewMock };
                await handleGetBigtableTables(ctx, { command: 'getBigtableTables', instance });
                expect(postToWebviewMock).toHaveBeenCalledTimes(1);
                expect(postToWebviewMock).toHaveBeenCalledWith(expect.objectContaining({
                    command: 'bigtableTablesLoaded',
                    bigtableTables: [],
                    error: expect.stringContaining('Invalid or missing Bigtable instance identifier')
                }));
            }
            consoleErrorSpy.mockRestore();
        });
    });

    describe('Direct handler execution: handleGetSqlDatabases (validation)', () => {
        it('posts an error without running gcloud for missing or unsafe instance identifiers (failure case)', async () => {
            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
            for (const instance of [undefined, 'inst;rm', '-i x', '', 42]) {
                const postToWebviewMock = vi.fn();
                const ctx: MessageContext = { context: {} as any, webview: {} as any, postToWebview: postToWebviewMock };
                await handleGetSqlDatabases(ctx, { command: 'getSqlDatabases', instance });
                expect(postToWebviewMock).toHaveBeenCalledTimes(1);
                expect(postToWebviewMock).toHaveBeenCalledWith(expect.objectContaining({
                    command: 'sqlDatabasesLoaded',
                    sqlDatabases: [],
                    error: expect.stringContaining('Invalid or missing Cloud SQL instance identifier')
                }));
            }
            consoleErrorSpy.mockRestore();
        });
    });

    describe('Direct handler execution: handleGetRunningJobs (validation)', () => {
        it('posts an error without running gcloud for unsafe region identifiers (failure case)', async () => {
            const postToWebviewMock = vi.fn();
            const ctx: MessageContext = {
                context: {} as any,
                webview: {} as any,
                postToWebview: postToWebviewMock
            };

            await handleGetRunningJobs(ctx, { command: 'getRunningJobs', region: 'us-central1;rm' });

            expect(postToWebviewMock).toHaveBeenCalledTimes(1);
            expect(postToWebviewMock).toHaveBeenCalledWith(expect.objectContaining({
                command: 'runningJobsLoaded',
                jobs: [],
                error: expect.stringContaining('Invalid region')
            }));
        });

        it('permits sentinel region "ALL" without producing an Invalid region error', async () => {
            const postToWebviewMock = vi.fn();
            const ctx: MessageContext = {
                context: {} as any,
                webview: {} as any,
                postToWebview: postToWebviewMock
            };

            await handleGetRunningJobs(ctx, { command: 'getRunningJobs', region: 'ALL' });

            expect(postToWebviewMock).toHaveBeenCalledTimes(1);
            const callArg = postToWebviewMock.mock.calls[0][0];
            expect(callArg.command).toBe('runningJobsLoaded');
            expect(callArg.error).toBeUndefined();
        });
    });

    describe('Discovery mappers', () => {
        it('mapBigtableInstances returns short instance IDs and drops unusable entries', () => {
            expect(mapBigtableInstances([{ name: 'projects/p/instances/inst-a' }, { name: '' }, {}, null])).toEqual(['inst-a']);
            expect(mapBigtableInstances({ not: 'an array' })).toEqual([]);
        });

        it('mapBigtableTables returns short table IDs', () => {
            expect(mapBigtableTables([{ name: 'projects/p/instances/i/tables/orders' }, { name: 42 }])).toEqual(['orders']);
            expect(mapBigtableTables(undefined)).toEqual([]);
        });

        it('mapSqlInstances prefers connectionName and falls back to project:region:name', () => {
            expect(mapSqlInstances([
                { connectionName: 'p:us-central1:db1' },
                { project: 'p', region: 'r', name: 'db2' },
                { name: 'x' }
            ])).toEqual(['p:us-central1:db1', 'p:r:db2']);
            expect(mapSqlInstances(null)).toEqual([]);
        });

        it('mapSqlDatabases returns database names', () => {
            expect(mapSqlDatabases([{ name: 'postgres' }, { name: 'app' }, {}])).toEqual(['postgres', 'app']);
            expect(mapSqlDatabases('nope')).toEqual([]);
        });

        it('mapProjects returns project IDs, not display names', () => {
            expect(mapProjects([{ projectId: 'a', name: 'A' }, { name: 'nope' }])).toEqual(['a']);
            expect(mapProjects({})).toEqual([]);
        });
    });

    describe('Discovery param parsers', () => {
        it('parseBigtableInstanceParam accepts short and full instance names', () => {
            expect(parseBigtableInstanceParam('my-inst')).toEqual({ instance: 'my-inst' });
            expect(parseBigtableInstanceParam(' my-inst ')).toEqual({ instance: 'my-inst' });
            expect(parseBigtableInstanceParam('projects/p1/instances/my-inst')).toEqual({ project: 'p1', instance: 'my-inst' });
        });

        it('parseBigtableInstanceParam rejects lists, bad charsets and non-strings', () => {
            for (const raw of ['a,b', '1abc', 'projects/p1/instances/a,b', 42, null, '']) {
                expect(parseBigtableInstanceParam(raw)).toBeNull();
            }
        });

        it('parseSqlInstanceParam accepts instance names and (domain-scoped) connection names', () => {
            expect(parseSqlInstanceParam('db1')).toEqual({ instance: 'db1' });
            expect(parseSqlInstanceParam('p:us-central1:db1')).toEqual({ project: 'p', instance: 'db1' });
            expect(parseSqlInstanceParam('example.com:p:us-central1:db1')).toEqual({ project: 'example.com:p', instance: 'db1' });
        });

        it('parseSqlInstanceParam rejects injection attempts and non-strings', () => {
            for (const raw of ['db1;x', '', undefined, '--instance=x', 'p:r:db 1']) {
                expect(parseSqlInstanceParam(raw)).toBeNull();
            }
        });
    });
});
