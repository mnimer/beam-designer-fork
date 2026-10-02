/**
 * @fileoverview Pipeline runner: locates the generated runner script, builds the
 * sanitized child environment, resolves the target project/region, spawns the
 * script as a process-group leader, and tracks Dataflow/Spark job IDs in its output.
 *
 * Extracted from `handleRunPipeline` so the IPC handler only orchestrates
 * validation and webview messaging, while the process mechanics here are
 * individually unit-testable. Behavior is unchanged from the inline version.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

import * as fs from 'fs';
import * as path from 'path';
import { spawn, type ChildProcess } from 'child_process';
import { getGcloudProject } from '../cli/gcloudClient';
import { applyRuntimeVariables, type RuntimeVariable } from '../security/envSanitizer';
import { detectDataflowJob } from './jobIdDetector';

/** Project placeholder used by generated configs before a real project is chosen. */
export const PLACEHOLDER_PROJECT_ID = 'YOUR_PROJECT_ID';

/** Region used when the job config does not specify one. */
export const DEFAULT_RUN_REGION = 'us-central1';

/** Job configuration fields the runner reads from the webview's run request. */
export interface RunnerJobConfig {
    /** Runner name: 'DirectRunner' | 'Dataflow' | 'Spark'. */
    runner?: string;
    /** Explicit GCP project; wins over the gcloud default (F6). */
    projectId?: string;
    /** GCP region for job links. */
    region?: string;
    /** Exported to the script as GCS_STAGING_PATH. */
    gcsStagingPath?: string;
    /** Exported to the script as SUBNETWORK. */
    subnetwork?: string;
}

/**
 * Returns the runner script filenames to look for, in priority order.
 *
 * @param runner Runner name from the job config.
 * @returns Candidate script names (empty for unknown runners).
 */
export function runnerScriptCandidates(runner: string): string[] {
    if (runner === 'DirectRunner') {
        return ['run_directrunner.sh'];
    }
    if (runner === 'Dataflow') {
        return ['run_dataflowrunner.sh', 'run_dataflow.sh'];
    }
    if (runner === 'Spark') {
        return ['run_sparkrunner.sh', 'run_spark.sh'];
    }
    return [];
}

/**
 * Finds the first candidate runner script that exists in `folderPath`.
 *
 * @param folderPath Generated pipeline output folder.
 * @param candidates Script names from {@link runnerScriptCandidates}.
 * @param exists Existence check (injectable for tests).
 * @returns The script filename, or null when none exists.
 */
export function findRunnerScript(
    folderPath: string,
    candidates: readonly string[],
    exists: (p: string) => boolean = (p) => fs.existsSync(p)
): string | null {
    for (const name of candidates) {
        if (exists(path.join(folderPath, name))) {
            return name;
        }
    }
    return null;
}

/**
 * Human-readable comment line describing how the runner executes, shown in the
 * execution log header.
 *
 * @param runner Runner name.
 * @returns A shell-comment description line.
 */
export function describeRunner(runner: string): string {
    if (runner === 'DirectRunner') {
        return '# Using Python / Java Direct Runner (Local Machine)';
    }
    if (runner === 'Dataflow') {
        return '# Submitting Apache Beam Flex Template Job to Google Cloud Dataflow';
    }
    return '# Submitting Apache Beam Job to Serverless Spark (Dataproc)';
}

/** Options for {@link buildRunnerEnvironment}. */
export interface RunnerEnvironmentOptions {
    /** Base environment, normally `process.env`. */
    baseEnv: Record<string, string | undefined>;
    /** Runtime variables from the `.beam` document (sanitized, S1). */
    runtimeVariables?: readonly RuntimeVariable[];
    /** Job config supplying staging path and subnetwork exports. */
    jobConfig?: RunnerJobConfig;
    /** Existence check for candidate PATH directories (injectable for tests). */
    exists?: (p: string) => boolean;
}

/** Result of {@link buildRunnerEnvironment}. */
export interface RunnerEnvironment {
    /** Environment passed to `spawn`. */
    env: Record<string, string>;
    /** Runtime variable keys refused by the env sanitizer (S1). */
    rejectedKeys: string[];
}

/**
 * Builds the child-process environment: prepends common tool directories
 * (Homebrew, gcloud SDK, pyenv, sdkman…) that exist on disk to PATH, forces
 * unbuffered/uncolored output, applies sanitized runtime variables, and exports
 * the staging path and subnetwork from the job config.
 *
 * @param options Environment inputs.
 * @returns The environment and any rejected runtime variable keys.
 */
export function buildRunnerEnvironment(options: RunnerEnvironmentOptions): RunnerEnvironment {
    const { baseEnv, runtimeVariables, jobConfig } = options;
    const exists = options.exists ?? ((p: string) => fs.existsSync(p));
    const home = baseEnv.HOME || '';
    const extraPathDirs = [
        '/opt/homebrew/bin',
        '/opt/homebrew/sbin',
        '/usr/local/bin',
        '/usr/bin',
        '/bin',
        '/usr/sbin',
        '/sbin',
        path.join(home, 'google-cloud-sdk/bin'),
        path.join(home, '.local/bin'),
        path.join(home, '.pyenv/shims'),
        path.join(home, '.sdkman/candidates/maven/current/bin'),
        path.join(home, '.sdkman/candidates/java/current/bin')
    ];
    const existingPaths = (baseEnv.PATH || '').split(path.delimiter);
    const mergedPaths = Array.from(new Set([...extraPathDirs.filter(d => exists(d)), ...existingPaths]));

    const env: Record<string, string> = {
        ...baseEnv as Record<string, string>,
        PATH: mergedPaths.join(path.delimiter),
        PYTHONUNBUFFERED: '1',
        FORCE_COLOR: '0'
    };

    // S1: runtime variables come from the .beam file; refuse keys that
    // would let it hijack bash, the dynamic loader or the JVM/Python runtime.
    const rejectedKeys = applyRuntimeVariables(env, runtimeVariables);
    if (jobConfig) {
        if (jobConfig.gcsStagingPath) {
            env['GCS_STAGING_PATH'] = jobConfig.gcsStagingPath;
        }
        if (jobConfig.subnetwork) {
            env['SUBNETWORK'] = jobConfig.subnetwork;
        }
    }
    return { env, rejectedKeys };
}

/** Project and region that detected job IDs are reported against. */
export interface RunTarget {
    /** GCP project ID (may remain the placeholder when gcloud has no default). */
    project: string;
    /** GCP region. */
    region: string;
}

/**
 * Resolves the project and region for a run BEFORE spawning (F6), so a job ID
 * emitted early is never reported against the placeholder project. An explicit
 * projectId always wins over the gcloud default.
 *
 * @param jobConfig Job config from the run request.
 * @param getProject gcloud default-project lookup (injectable for tests).
 * @returns The resolved run target.
 */
export async function resolveRunTarget(
    jobConfig: RunnerJobConfig | undefined,
    getProject: () => Promise<string | undefined> = getGcloudProject
): Promise<RunTarget> {
    let project = jobConfig?.projectId || PLACEHOLDER_PROJECT_ID;
    if (project === PLACEHOLDER_PROJECT_ID) {
        const resolvedProject = await getProject().catch(() => undefined);
        if (resolvedProject) {
            project = resolvedProject;
        }
    }
    return { project, region: jobConfig?.region || DEFAULT_RUN_REGION };
}

/** A job ID detected in runner output. */
export interface DetectedRunnerJob {
    /** Dataflow job ID or Spark batch ID. */
    jobId: string;
    /** Which service the job belongs to. */
    runner: 'Dataflow' | 'Spark';
    /** Project to link the job against. */
    projectId: string;
    /** Region to link the job against. */
    region: string;
}

/** Spark/Dataproc batch ID patterns in gcloud output. */
const SPARK_BATCH_PATTERN = /(?:batches\/|Batch\s*\[|Batch ID:\s*)([a-zA-Z0-9_-]{4,})/i;

/** Words that follow "Batch" in status lines and must not be mistaken for IDs. */
const SPARK_STATUS_WORDS = ['created', 'running', 'pending', 'failed'];

/**
 * Creates a stateful detector that reports the FIRST Dataflow job or Spark
 * batch ID seen across output chunks, then ignores all further chunks.
 * Region/project parsed from a Dataflow Console URL take precedence over `target`.
 *
 * @param target Default project/region for reported jobs.
 * @returns A function to feed each output chunk; returns the job once, else null.
 */
export function createJobIdTracker(target: RunTarget): (chunk: string) => DetectedRunnerJob | null {
    let detected = false;
    return (chunk: string) => {
        if (detected) return null;

        const dataflowJob = detectDataflowJob(chunk);
        if (dataflowJob) {
            detected = true;
            return {
                jobId: dataflowJob.jobId,
                runner: 'Dataflow',
                projectId: dataflowJob.projectId || target.project,
                region: dataflowJob.region || target.region
            };
        }

        const sparkMatch = chunk.match(SPARK_BATCH_PATTERN);
        if (sparkMatch && sparkMatch[1] && !SPARK_STATUS_WORDS.includes(sparkMatch[1].toLowerCase())) {
            detected = true;
            return { jobId: sparkMatch[1], runner: 'Spark', projectId: target.project, region: target.region };
        }
        return null;
    };
}

/** Callbacks wired to the spawned runner process. */
export interface RunnerProcessCallbacks {
    /** A stdout/stderr chunk was produced. */
    onOutput: (text: string, stream: 'stdout' | 'stderr') => void;
    /** The process could not be started or crashed at the OS level. */
    onError: (err: Error) => void;
    /** The process exited. */
    onClose: (code: number | null, signal: string | null) => void;
}

/**
 * Spawns the runner script. On POSIX it runs via `bash` as a detached
 * process-group leader so Stop can signal the whole tree (bash plus the
 * JVM/python it launched); on Windows the script is executed directly.
 *
 * @param folderPath Working directory (the generated pipeline folder).
 * @param scriptFullPath Absolute path of the runner script.
 * @param env Environment from {@link buildRunnerEnvironment}.
 * @param callbacks Output, error and exit callbacks.
 * @returns The spawned child process.
 */
export function spawnRunnerScript(
    folderPath: string,
    scriptFullPath: string,
    env: Record<string, string>,
    callbacks: RunnerProcessCallbacks
): ChildProcess {
    const isWindows = process.platform === 'win32';
    const spawnCmd = isWindows ? scriptFullPath : 'bash';
    const spawnArgs = isWindows ? [] : [scriptFullPath];

    const child = spawn(spawnCmd, spawnArgs, {
        cwd: folderPath,
        env,
        detached: !isWindows
    });

    child.stdout?.on('data', (data: Buffer | string) => callbacks.onOutput(data.toString(), 'stdout'));
    child.stderr?.on('data', (data: Buffer | string) => callbacks.onOutput(data.toString(), 'stderr'));
    child.on('error', (err: Error) => callbacks.onError(err));
    child.on('close', (code: number | null, signal: string | null) => callbacks.onClose(code, signal));
    return child;
}
