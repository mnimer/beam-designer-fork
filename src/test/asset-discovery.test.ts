/**
 * Asset Discovery, CLI Resolution, and Error Surfacing Regression Tests (A2, M6, M8)
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Unit tests validating fixes for findings A2, M6, and M8:
 * - A2: Collapsed duplicated CLI asset discovery handlers into generic listAssets helper.
 * - M6: Error propagation in listAssets (surfaces stderr and CLI errors instead of silent empty arrays).
 * - M8: Consistent CLI resolution via resolveCli routing across configured paths, PATH, and candidates.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { execFile, ExecFileException } from 'child_process';

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

vi.mock('child_process', () => {
    return {
        execFile: vi.fn()
    };
});

import {
    listAssets,
    resolveCli,
    findGcloudPath
} from '../extension';

describe('A2, M6, M8 — Asset Discovery, CLI Resolution, and Error Surfacing', () => {
    const originalEnvPath = process.env.PATH;

    beforeEach(() => {
        mockConfigValues = {};
        vi.clearAllMocks();
    });

    afterEach(() => {
        process.env.PATH = originalEnvPath;
    });

    // 1. listAssets posts mapped items on success (simple case)
    it('listAssets posts mapped items on success (simple case)', async () => {
        const mockGcloudOutput = JSON.stringify([
            { name: 'projects/test-project/topics/topic-a' },
            { name: 'projects/test-project/topics/topic-b' }
        ]);

        (execFile as any).mockImplementation((_bin: string, _args: string[], _opts: any, cb: any) => {
            const callback = typeof _opts === 'function' ? _opts : cb;
            callback(null, mockGcloudOutput, '');
        });

        // Ensure CLI resolves
        mockConfigValues['dataflowDesigner.gcloudPath'] = '/mock/bin/gcloud';

        const postedMessages: any[] = [];
        await listAssets(
            'gcloud',
            ['pubsub', 'topics', 'list', '--format=json'],
            (json: any) => (Array.isArray(json) ? json.map((t: any) => t.name) : []),
            'topicsLoaded',
            'topics',
            (msg) => { postedMessages.push(msg); }
        );

        expect(postedMessages).toHaveLength(1);
        const msg = postedMessages[0];
        expect(msg.command).toBe('topicsLoaded');
        expect(msg.topics).toEqual([
            'projects/test-project/topics/topic-a',
            'projects/test-project/topics/topic-b'
        ]);
        expect(msg.error).toBeUndefined();
        expect(msg.debugLog).toContain('Retrieved 2 items');
    });

    // 2. listAssets posts an error (not a silent empty array) when CLI exits non-zero (includes stderr)
    it('listAssets posts an error (not a silent empty array) when the CLI exits non-zero, and the message includes stderr (failure case)', async () => {
        const stderrOutput = 'ERROR: (gcloud.pubsub.topics.list) PERMISSION_DENIED: Service account lacks pubsub.topics.list permission.';
        (execFile as any).mockImplementation((_bin: string, _args: string[], _opts: any, cb: any) => {
            const callback = typeof _opts === 'function' ? _opts : cb;
            const err: ExecFileException = new Error('Command failed: gcloud pubsub topics list');
            err.code = 1;
            callback(err, '', stderrOutput);
        });

        mockConfigValues['dataflowDesigner.gcloudPath'] = '/mock/bin/gcloud';

        const postedMessages: any[] = [];
        await listAssets(
            'gcloud',
            ['pubsub', 'topics', 'list', '--format=json'],
            (json: any) => json.map((t: any) => t.name),
            'topicsLoaded',
            'topics',
            (msg) => { postedMessages.push(msg); }
        );

        expect(postedMessages).toHaveLength(1);
        const msg = postedMessages[0];
        expect(msg.command).toBe('topicsLoaded');
        expect(msg.topics).toEqual([]);
        // Crucial M6 requirement: error must be present, non-empty, and include stderr
        expect(msg.error).toBeDefined();
        expect(typeof msg.error).toBe('string');
        expect(msg.error).toContain('PERMISSION_DENIED');
        expect(msg.error).toContain('Failed to list topics via gcloud');
        expect(msg.debugLog).toContain(stderrOutput);
    });

    // 3. listAssets posts an error when the CLI is missing (ENOENT)
    it('listAssets posts an error when the CLI is missing (ENOENT) from execFile', async () => {
        (execFile as any).mockImplementation((_bin: string, _args: string[], _opts: any, cb: any) => {
            const callback = typeof _opts === 'function' ? _opts : cb;
            const err: ExecFileException = new Error('spawn gcloud ENOENT');
            err.code = 'ENOENT';
            callback(err, '', '');
        });

        mockConfigValues['dataflowDesigner.gcloudPath'] = '/mock/bin/gcloud';

        const postedMessages: any[] = [];
        await listAssets(
            'gcloud',
            ['pubsub', 'topics', 'list', '--format=json'],
            (json: any) => json.map((t: any) => t.name),
            'topicsLoaded',
            'topics',
            (msg) => { postedMessages.push(msg); }
        );

        expect(postedMessages).toHaveLength(1);
        const msg = postedMessages[0];
        expect(msg.command).toBe('topicsLoaded');
        expect(msg.topics).toEqual([]);
        expect(msg.error).toBeDefined();
        expect(msg.error).toContain('CLI not found');
        expect(msg.error).toContain('ENOENT');
    });

    it('listAssets posts an error when the CLI cannot be resolved at all (ENOENT / missing CLI)', async () => {
        // Isolate PATH so resolver cannot find unconfigured unknown binary
        process.env.PATH = '';
        mockConfigValues['dataflowDesigner.gcloudPath'] = undefined;

        const postedMessages: any[] = [];
        await listAssets(
            'completely_unknown_cli_binary_xyz',
            ['list'],
            (json: any) => json,
            'unknownLoaded',
            'items',
            (msg) => { postedMessages.push(msg); }
        );

        expect(postedMessages).toHaveLength(1);
        const msg = postedMessages[0];
        expect(msg.command).toBe('unknownLoaded');
        expect(msg.items).toEqual([]);
        expect(msg.error).toBeDefined();
        expect(msg.error).toContain('CLI not found');
        expect(msg.error).toContain('completely_unknown_cli_binary_xyz');
    });

    // 4. listAssets posts an error on unparseable JSON rather than throwing
    it('listAssets posts an error on unparseable JSON rather than throwing (failure case)', async () => {
        const invalidJsonOutput = '<html><body>502 Bad Gateway</body></html>';
        (execFile as any).mockImplementation((_bin: string, _args: string[], _opts: any, cb: any) => {
            const callback = typeof _opts === 'function' ? _opts : cb;
            callback(null, invalidJsonOutput, '');
        });

        mockConfigValues['dataflowDesigner.gcloudPath'] = '/mock/bin/gcloud';

        const postedMessages: any[] = [];
        // Must NOT throw exception
        await expect(
            listAssets(
                'gcloud',
                ['pubsub', 'topics', 'list', '--format=json'],
                (json: any) => json.map((t: any) => t.name),
                'topicsLoaded',
                'topics',
                (msg) => { postedMessages.push(msg); }
            )
        ).resolves.not.toThrow();

        expect(postedMessages).toHaveLength(1);
        const msg = postedMessages[0];
        expect(msg.command).toBe('topicsLoaded');
        expect(msg.topics).toEqual([]);
        expect(msg.error).toBeDefined();
        expect(msg.error).toContain('Failed to parse gcloud JSON output');
        expect(msg.debugLog).toContain(invalidJsonOutput);
    });

    // 5. An empty result set is reported as genuinely empty and is distinguishable from an error
    it('an empty result set is reported as genuinely empty and is distinguishable from an error (extreme case)', async () => {
        (execFile as any).mockImplementation((_bin: string, _args: string[], _opts: any, cb: any) => {
            const callback = typeof _opts === 'function' ? _opts : cb;
            callback(null, '[]', '');
        });

        mockConfigValues['dataflowDesigner.gcloudPath'] = '/mock/bin/gcloud';

        const postedMessages: any[] = [];
        await listAssets(
            'gcloud',
            ['pubsub', 'topics', 'list', '--format=json'],
            (json: any) => (Array.isArray(json) ? json.map((t: any) => t.name) : []),
            'topicsLoaded',
            'topics',
            (msg) => { postedMessages.push(msg); }
        );

        expect(postedMessages).toHaveLength(1);
        const msg = postedMessages[0];
        expect(msg.command).toBe('topicsLoaded');
        expect(msg.topics).toEqual([]);
        // Error MUST NOT be set on a valid empty discovery result
        expect(msg.error).toBeUndefined();
        expect(msg.debugLog).toContain('Retrieved 0 items');
    });

    // 6. resolveCli returns configured path for gcloud when setting is set, and falls back correctly
    it('resolveCli returns the configured path for gcloud when the setting is set, and falls back correctly', () => {
        // When setting is explicitly configured
        mockConfigValues['dataflowDesigner.gcloudPath'] = '/custom/tools/gcloud';
        expect(resolveCli('gcloud')).toBe('/custom/tools/gcloud');
        expect(findGcloudPath()).toBe('/custom/tools/gcloud');

        // When setting is whitespace, should ignore and fall back
        mockConfigValues['dataflowDesigner.gcloudPath'] = '   ';
        const fallback = resolveCli('gcloud');
        expect(fallback).not.toBe('   ');

        // When setting is not configured, should resolve via PATH or candidate directories
        mockConfigValues['dataflowDesigner.gcloudPath'] = undefined;
        const resolvedDefault = resolveCli('gcloud');
        if (resolvedDefault) {
            expect(resolvedDefault).toMatch(/gcloud(\.cmd|\.exe)?$/);
        }

        // findGcloudPath falls back to 'gcloud' string even if not present on disk
        process.env.PATH = '';
        expect(findGcloudPath()).toMatch(/gcloud/);
    });

    // 7. Extra fields extractor support (e.g. datasetsLoaded projectId)
    it('supports extra fields extraction such as BigQuery projectId', async () => {
        const mockBqOutput = JSON.stringify([
            { datasetReference: { datasetId: 'analytics_prod', projectId: 'corp-gcp-project' } },
            { datasetReference: { datasetId: 'analytics_staging', projectId: 'corp-gcp-project' } }
        ]);

        (execFile as any).mockImplementation((_bin: string, _args: string[], _opts: any, cb: any) => {
            const callback = typeof _opts === 'function' ? _opts : cb;
            callback(null, mockBqOutput, '');
        });

        mockConfigValues['dataflowDesigner.gcloudPath'] = '/mock/bin/gcloud';

        const postedMessages: any[] = [];
        await listAssets(
            'bq',
            ['ls', '--format=json'],
            (json: any) => (Array.isArray(json) ? json.map((d: any) => d.datasetReference?.datasetId).filter(Boolean) : []),
            'datasetsLoaded',
            'datasets',
            (msg) => { postedMessages.push(msg); },
            (json: any) => ({
                projectId: Array.isArray(json) && json.length > 0 && json[0]?.datasetReference?.projectId
                    ? json[0].datasetReference.projectId
                    : 'DEFAULT_PROJECT'
            })
        );

        expect(postedMessages).toHaveLength(1);
        const msg = postedMessages[0];
        expect(msg.command).toBe('datasetsLoaded');
        expect(msg.datasets).toEqual(['analytics_prod', 'analytics_staging']);
        expect(msg.projectId).toBe('corp-gcp-project');
        expect(msg.error).toBeUndefined();
    });
});
