/**
 * Discovery Handler Tests (IO68 Bigtable, IO74 Cloud SQL, projects)
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Exercises the gcloud-backed discovery handlers added for the Community &
 * Cross-Language connectors end to end with a mocked `execFile`: the exact CLI
 * arguments each handler builds (including the optional `--project` derived from a
 * fully-qualified instance identifier), the response command/key posted back to the
 * webview, the mapped values, and error propagation from the CLI.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { execFile, ExecFileException } from 'child_process';

let mockConfigValues: Record<string, string | undefined> = {};

vi.mock('vscode', async () => (await import('./helpers/vscodeMock')).createVscodeMock({
    workspace: {
        workspaceFolders: [],
        getConfiguration: vi.fn((section?: string) => ({
            get: (key: string) => {
                const fullKey = section ? `${section}.${key}` : key;
                return mockConfigValues[fullKey] ?? mockConfigValues[key];
            }
        }))
    }
}));

vi.mock('child_process', () => {
    return {
        execFile: vi.fn()
    };
});

import {
    MessageContext,
    handleGetBigtableInstances,
    handleGetBigtableTables,
    handleGetSqlInstances,
    handleGetSqlDatabases,
    handleGetProjects
} from '../../extension';

type Posted = Record<string, any>;

/** Configures execFile to succeed with the given JSON and records the invoked args. */
function mockCliSuccess(output: unknown): { calls: string[][] } {
    const calls: string[][] = [];
    (execFile as any).mockImplementation((_bin: string, args: string[], opts: any, cb: any) => {
        calls.push(args);
        const callback = typeof opts === 'function' ? opts : cb;
        callback(null, JSON.stringify(output), '');
    });
    return { calls };
}

/**
 * Creates a mock MessageContext and an array collecting posted messages.
 *
 * @returns An object containing the mock context and the posted message list.
 */
function makeCtx(): { ctx: MessageContext; posted: Posted[] } {
    const posted: Posted[] = [];
    const ctx: MessageContext = {
        context: {} as any,
        webview: {} as any,
        postToWebview: (msg: Posted) => { posted.push(msg); return true; }
    };
    return { ctx, posted };
}

describe('Discovery handlers (Bigtable, Cloud SQL, projects)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockConfigValues = { 'dataflowDesigner.gcloudPath': '/mock/bin/gcloud' };
        vi.spyOn(console, 'log').mockImplementation(() => undefined);
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
    });

    it('getBigtableInstances lists instances and posts short IDs', async () => {
        const { calls } = mockCliSuccess([
            { name: 'projects/p/instances/inst-a', displayName: 'A' },
            { name: 'projects/p/instances/inst-b' }
        ]);
        const { ctx, posted } = makeCtx();

        await handleGetBigtableInstances(ctx, { command: 'getBigtableInstances' });

        expect(calls).toEqual([['bigtable', 'instances', 'list', '--format=json']]);
        expect(posted).toHaveLength(1);
        expect(posted[0].command).toBe('bigtableInstancesLoaded');
        expect(posted[0].bigtableInstances).toEqual(['inst-a', 'inst-b']);
        expect(posted[0].error).toBeUndefined();
    });

    it('getBigtableTables passes a short instance via --instances=', async () => {
        const { calls } = mockCliSuccess([{ name: 'projects/p/instances/my-inst/tables/orders' }]);
        const { ctx, posted } = makeCtx();

        await handleGetBigtableTables(ctx, { command: 'getBigtableTables', instance: 'my-inst' });

        expect(calls).toEqual([['bigtable', 'instances', 'tables', 'list', '--instances=my-inst', '--format=json']]);
        expect(posted[0]).toEqual(expect.objectContaining({ command: 'bigtableTablesLoaded', bigtableTables: ['orders'] }));
    });

    it('getBigtableTables derives --project from a fully-qualified instance name', async () => {
        const { calls } = mockCliSuccess([]);
        const { ctx, posted } = makeCtx();

        await handleGetBigtableTables(ctx, { command: 'getBigtableTables', instance: 'projects/p1/instances/my-inst' });

        expect(calls).toEqual([
            ['bigtable', 'instances', 'tables', 'list', '--instances=my-inst', '--format=json', '--project=p1']
        ]);
        expect(posted[0].bigtableTables).toEqual([]);
    });

    it('getSqlInstances posts instance connection names', async () => {
        const { calls } = mockCliSuccess([
            { name: 'db1', project: 'p', region: 'us-central1', connectionName: 'p:us-central1:db1' },
            { name: 'db2', project: 'p', region: 'europe-west1' }
        ]);
        const { ctx, posted } = makeCtx();

        await handleGetSqlInstances(ctx, { command: 'getSqlInstances' });

        expect(calls).toEqual([['sql', 'instances', 'list', '--format=json']]);
        expect(posted[0]).toEqual(expect.objectContaining({
            command: 'sqlInstancesLoaded',
            sqlInstances: ['p:us-central1:db1', 'p:europe-west1:db2']
        }));
    });

    it('getSqlDatabases accepts a connection name and splits it into --instance/--project', async () => {
        const { calls } = mockCliSuccess([{ name: 'postgres' }, { name: 'app' }]);
        const { ctx, posted } = makeCtx();

        await handleGetSqlDatabases(ctx, { command: 'getSqlDatabases', instance: 'p:us-central1:db1' });

        expect(calls).toEqual([['sql', 'databases', 'list', '--instance=db1', '--format=json', '--project=p']]);
        expect(posted[0]).toEqual(expect.objectContaining({ command: 'sqlDatabasesLoaded', sqlDatabases: ['postgres', 'app'] }));
    });

    it('getSqlDatabases accepts a bare instance name without --project', async () => {
        const { calls } = mockCliSuccess([{ name: 'app' }]);
        const { ctx } = makeCtx();

        await handleGetSqlDatabases(ctx, { command: 'getSqlDatabases', instance: 'db1' });

        expect(calls).toEqual([['sql', 'databases', 'list', '--instance=db1', '--format=json']]);
    });

    it('getSqlDatabases rejects an unsafe identifier without invoking gcloud', async () => {
        const { calls } = mockCliSuccess([]);
        const { ctx, posted } = makeCtx();

        await handleGetSqlDatabases(ctx, { command: 'getSqlDatabases', instance: 'db1 --impersonate-service-account=x' });

        expect(calls).toEqual([]);
        expect(posted[0].error).toContain('Invalid or missing Cloud SQL instance identifier');
    });

    it('getProjects posts project IDs', async () => {
        const { calls } = mockCliSuccess([
            { projectId: 'proj-a', name: 'Project A', projectNumber: '1' },
            { projectId: 'proj-b', name: 'Project B', projectNumber: '2' }
        ]);
        const { ctx, posted } = makeCtx();

        await handleGetProjects(ctx, { command: 'getProjects' });

        expect(calls).toEqual([['projects', 'list', '--format=json']]);
        expect(posted[0]).toEqual(expect.objectContaining({ command: 'projectsLoaded', projects: ['proj-a', 'proj-b'] }));
    });

    it('surfaces gcloud stderr as an error with an empty list under the handler key', async () => {
        (execFile as any).mockImplementation((_bin: string, _args: string[], opts: any, cb: any) => {
            const callback = typeof opts === 'function' ? opts : cb;
            const err: ExecFileException = new Error('Command failed');
            err.code = 1;
            callback(err, '', 'ERROR: (gcloud.sql.instances.list) PERMISSION_DENIED');
        });
        const { ctx, posted } = makeCtx();

        await handleGetSqlInstances(ctx, { command: 'getSqlInstances' });

        expect(posted).toHaveLength(1);
        expect(posted[0].command).toBe('sqlInstancesLoaded');
        expect(posted[0].sqlInstances).toEqual([]);
        expect(posted[0].error).toContain('Failed to list sqlInstances via gcloud');
        expect(posted[0].error).toContain('PERMISSION_DENIED');
    });
});
