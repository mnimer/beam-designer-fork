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
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// Shared mock holder for vscode configuration getter
let mockConfigValues: Record<string, string | undefined> = {};

vi.mock('vscode', async () => (await import('./helpers/vscodeMock')).createVscodeMock({
    workspace: {
        workspaceFolders: [
            {
                uri: { fsPath: '/Users/me/ws/mypipeline' },
                name: 'mypipeline'
            }
        ],
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
    listAssets,
    resolveCli,
    findGcloudPath,
    handleGetHealthcareDatasets,
    mapHealthcareDatasetItems
} from '../../extension';

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

        // When setting is not configured, should resolve via PATH: put a fake
        // gcloud on an isolated PATH so this branch is always exercised.
        mockConfigValues['dataflowDesigner.gcloudPath'] = undefined;
        const binDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fake-gcloud-'));
        const exeName = process.platform === 'win32' ? 'gcloud.cmd' : 'gcloud';
        const fakeGcloud = path.join(binDir, exeName);
        fs.writeFileSync(fakeGcloud, '#!/bin/sh\n', { mode: 0o755 });
        try {
            process.env.PATH = binDir;
            expect(resolveCli('gcloud')).toBe(fakeGcloud);
        } finally {
            fs.rmSync(binDir, { recursive: true, force: true });
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

    // 8. getHealthcareDatasets happy path, location argument forwarding, and error fallback
    it('handleGetHealthcareDatasets lists Cloud Healthcare datasets and forwards optional location argument', async () => {
        const mockHealthcareOutput = JSON.stringify([
            { name: 'projects/med-proj/locations/us-central1/datasets/clinical-fhir-ds' },
            { name: 'projects/med-proj/locations/us-central1/datasets/imaging-dicom-ds' }
        ]);

        let capturedArgs: string[] = [];
        (execFile as any).mockImplementation((_bin: string, args: string[], _opts: any, cb: any) => {
            capturedArgs = args;
            const callback = typeof _opts === 'function' ? _opts : cb;
            callback(null, mockHealthcareOutput, '');
        });

        mockConfigValues['dataflowDesigner.gcloudPath'] = '/mock/bin/gcloud';

        const postedMessages: any[] = [];
        await handleGetHealthcareDatasets(
            {
                context: {} as any,
                webview: {} as any,
                postToWebview: (msg) => { postedMessages.push(msg); return true; }
            },
            { command: 'getHealthcareDatasets', location: 'us-central1' }
        );

        expect(capturedArgs).toEqual([
            'healthcare',
            'datasets',
            'list',
            '--location=us-central1',
            '--format=json'
        ]);
        expect(postedMessages).toHaveLength(1);
        expect(postedMessages[0].command).toBe('healthcareDatasetsLoaded');
        expect(postedMessages[0].datasets).toEqual([
            'projects/med-proj/locations/us-central1/datasets/clinical-fhir-ds',
            'projects/med-proj/locations/us-central1/datasets/imaging-dicom-ds'
        ]);
        expect(postedMessages[0].error).toBeUndefined();
    });

    it('handleGetHealthcareDatasets handles non-array/empty JSON and surfaces CLI errors', async () => {
        expect(mapHealthcareDatasetItems(null)).toEqual([]);
        expect(mapHealthcareDatasetItems([{ name: '  ' }, {}])).toEqual([]);

        (execFile as any).mockImplementation((_bin: string, _args: string[], _opts: any, cb: any) => {
            const callback = typeof _opts === 'function' ? _opts : cb;
            const err: ExecFileException = new Error('Command failed');
            err.code = 1;
            callback(err, '', 'ERROR: (gcloud.healthcare.datasets.list) API healthcare.googleapis.com not enabled.');
        });

        mockConfigValues['dataflowDesigner.gcloudPath'] = '/mock/bin/gcloud';

        const postedMessages: any[] = [];
        await handleGetHealthcareDatasets(
            {
                context: {} as any,
                webview: {} as any,
                postToWebview: (msg) => { postedMessages.push(msg); return true; }
            },
            { command: 'getHealthcareDatasets', location: 'invalid;injection' }
        );

        expect(postedMessages).toHaveLength(1);
        expect(postedMessages[0].command).toBe('healthcareDatasetsLoaded');
        expect(postedMessages[0].datasets).toEqual([]);
        expect(postedMessages[0].error).toContain('API healthcare.googleapis.com not enabled');
    });
});
