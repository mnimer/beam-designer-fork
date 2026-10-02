/**
 * @fileoverview Unit tests for the PipelineRunner helpers extracted from handleRunPipeline.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

import { describe, it, expect, vi } from 'vitest';
import * as path from 'path';

// gcloudClient pulls in the vscode API; the tests inject their own project lookup.
vi.mock('../../cli/gcloudClient', () => ({ getGcloudProject: vi.fn() }));
import {
    DEFAULT_RUN_REGION,
    PLACEHOLDER_PROJECT_ID,
    buildRunnerEnvironment,
    createJobIdTracker,
    describeRunner,
    findRunnerScript,
    resolveRunTarget,
    runnerScriptCandidates,
} from '../../execution/PipelineRunner';

describe('runnerScriptCandidates', () => {
    it('lists scripts per runner in priority order', () => {
        expect(runnerScriptCandidates('DirectRunner')).toEqual(['run_directrunner.sh']);
        expect(runnerScriptCandidates('Dataflow')).toEqual(['run_dataflowrunner.sh', 'run_dataflow.sh']);
        expect(runnerScriptCandidates('Spark')).toEqual(['run_sparkrunner.sh', 'run_spark.sh']);
        expect(runnerScriptCandidates('Flink')).toEqual([]);
    });
});

describe('findRunnerScript', () => {
    it('returns the first existing candidate', () => {
        const existing = new Set([path.join('/p', 'run_dataflow.sh')]);
        expect(findRunnerScript('/p', runnerScriptCandidates('Dataflow'), (p) => existing.has(p))).toBe('run_dataflow.sh');
    });

    it('prefers the earlier candidate when both exist', () => {
        expect(findRunnerScript('/p', runnerScriptCandidates('Dataflow'), () => true)).toBe('run_dataflowrunner.sh');
    });

    it('returns null when no candidate exists', () => {
        expect(findRunnerScript('/p', runnerScriptCandidates('Spark'), () => false)).toBeNull();
    });
});

describe('describeRunner', () => {
    it('describes each runner', () => {
        expect(describeRunner('DirectRunner')).toContain('Direct Runner');
        expect(describeRunner('Dataflow')).toContain('Dataflow');
        expect(describeRunner('Spark')).toContain('Spark');
    });
});

describe('buildRunnerEnvironment', () => {
    it('prepends existing tool dirs to PATH and forces unbuffered, uncolored output', () => {
        const { env } = buildRunnerEnvironment({
            baseEnv: { HOME: '/home/u', PATH: ['/usr/bin', '/custom'].join(path.delimiter) },
            exists: (d) => d === '/opt/homebrew/bin' || d === '/usr/bin',
        });
        expect(env.PATH.split(path.delimiter)).toEqual(['/opt/homebrew/bin', '/usr/bin', '/custom']);
        expect(env.PYTHONUNBUFFERED).toBe('1');
        expect(env.FORCE_COLOR).toBe('0');
        expect(env.HOME).toBe('/home/u');
    });

    it('applies safe runtime variables and reports rejected keys', () => {
        const { env, rejectedKeys } = buildRunnerEnvironment({
            baseEnv: {},
            exists: () => false,
            runtimeVariables: [{ key: 'MY_VAR', value: 'x' }, { key: 'LD_PRELOAD', value: 'evil.so' }],
        });
        expect(env.MY_VAR).toBe('x');
        expect(env.LD_PRELOAD).toBeUndefined();
        expect(rejectedKeys).toEqual(['LD_PRELOAD']);
    });

    it('exports staging path and subnetwork from the job config', () => {
        const { env } = buildRunnerEnvironment({
            baseEnv: {},
            exists: () => false,
            jobConfig: { gcsStagingPath: 'gs://b/stage', subnetwork: 'sub-1' },
        });
        expect(env.GCS_STAGING_PATH).toBe('gs://b/stage');
        expect(env.SUBNETWORK).toBe('sub-1');
    });
});

describe('resolveRunTarget', () => {
    it('keeps an explicit projectId without calling gcloud', async () => {
        let called = false;
        const target = await resolveRunTarget({ projectId: 'explicit', region: 'europe-west1' }, async () => {
            called = true;
            return 'gcloud-default';
        });
        expect(target).toEqual({ project: 'explicit', region: 'europe-west1' });
        expect(called).toBe(false);
    });

    it('falls back to the gcloud default project and default region', async () => {
        expect(await resolveRunTarget(undefined, async () => 'gcloud-default'))
            .toEqual({ project: 'gcloud-default', region: DEFAULT_RUN_REGION });
    });

    it('keeps the placeholder when gcloud fails or has no default', async () => {
        expect((await resolveRunTarget({}, async () => { throw new Error('no gcloud'); })).project).toBe(PLACEHOLDER_PROJECT_ID);
        expect((await resolveRunTarget({}, async () => undefined)).project).toBe(PLACEHOLDER_PROJECT_ID);
    });
});

describe('createJobIdTracker', () => {
    const target = { project: 'p1', region: 'r1' };

    it('reports a Dataflow job once, using the default target', () => {
        const track = createJobIdTracker(target);
        expect(track('noise')).toBeNull();
        expect(track('Submitted job: 2026-01-01_00_00_00-1234567890123\n')).toEqual({
            jobId: '2026-01-01_00_00_00-1234567890123', runner: 'Dataflow', projectId: 'p1', region: 'r1',
        });
        expect(track('Submitted job: 2026-01-02_00_00_00-9999999999999\n')).toBeNull();
    });

    it('prefers project/region parsed from a Console URL', () => {
        const job = createJobIdTracker(target)(
            'https://console.cloud.google.com/dataflow/jobs/europe-west4/2026-09-30_02_00_00-1234567890123456?project=url-proj'
        );
        expect(job).toMatchObject({ runner: 'Dataflow', projectId: 'url-proj', region: 'europe-west4' });
    });

    it('reports a Spark batch ID but ignores status words', () => {
        const track = createJobIdTracker(target);
        expect(track('Batch [running]')).toBeNull();
        expect(track('Batch ID: batch-abc123')).toEqual({ jobId: 'batch-abc123', runner: 'Spark', projectId: 'p1', region: 'r1' });
    });
});
