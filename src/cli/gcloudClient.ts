/** @fileoverview Provides gcloud and CLI command execution helpers for asset discovery.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

import { execFile, ExecFileException } from 'child_process';
import { resolveCli, findGcloudPath } from './cliResolver';
import { tryGetDesignerOutputChannel } from '../core/outputChannel';
import type { AssetListResponse, AssetResponseCommand } from '../shared/protocol';

/**
 * Generic helper to discover cloud assets by executing a CLI command, parsing JSON,
 * and dispatching results or actionable error messages to the webview.
 * 
 * @param cli The CLI command to execute ('gcloud', 'bq', 'aws', etc.)
 * @param args Arguments to pass to the CLI command
 * @param map Mapping function to transform parsed JSON items into the target asset type
 * @param responseCommand The command name of the IPC message dispatched to the webview
 * @param key The payload key name containing the array of items (e.g. 'topics', 'datasets')
 * @param postMessage Message posting callback to the webview
 * @param extraFields Optional extractor for additional fields from JSON to include in the message
 */
export async function listAssets<T>(
    cli: string,
    args: string[],
    map: (json: any) => T[],
    responseCommand: string,
    key: string,
    postMessage?: (message: AssetListResponse) => unknown,
    extraFields?: (json: any) => Record<string, any>
): Promise<void> {
    const resolvedCli = resolveCli(cli);
    if (!resolvedCli) {
        const notFoundErr = `CLI not found: '${cli}' (ENOENT). Please ensure ${cli} is installed and available in PATH or configured in settings.`;
        console.error(`[@extension.ts] ${notFoundErr}`);
        tryGetDesignerOutputChannel()?.appendLine(`[${new Date().toLocaleTimeString()}] ERROR: ${notFoundErr}`);
        postMessage?.({
            command: responseCommand as AssetResponseCommand,
            [key]: [],
            error: notFoundErr,
            debugLog: `Command: ${cli} ${args.join(' ')}\nError: ENOENT: CLI '${cli}' could not be resolved in PATH or standard locations.`
        });
        return;
    }

    const logMsg = `[${new Date().toLocaleTimeString()}] Executing CLI: ${resolvedCli} ${args.join(' ')}`;
    console.log('[@extension.ts]', logMsg);
    tryGetDesignerOutputChannel()?.appendLine(logMsg);

    return new Promise((resolve) => {
        execFile(resolvedCli, args, { timeout: 15000, maxBuffer: 1024 * 1024 * 10 }, (err: ExecFileException | null, stdout: string, stderr: string) => {
            if (err) {
                const isNotFound = err.code === 'ENOENT' || (err.message && err.message.includes('ENOENT'));
                const errMsg = isNotFound
                    ? `CLI not found: '${cli}' (ENOENT). Please ensure ${cli} is installed and available in PATH.`
                    : (err.killed ? `Request timed out waiting for ${cli} CLI response.` : (stderr ? stderr.trim() : err.message));
                const errText = `Failed to list ${key} via ${cli}: ${errMsg}`;
                console.error(`[@extension.ts] ${errText}`);
                tryGetDesignerOutputChannel()?.appendLine(`[${new Date().toLocaleTimeString()}] ERROR: ${errText}`);

                postMessage?.({
                    command: responseCommand as AssetResponseCommand,
                    [key]: [],
                    error: errText,
                    debugLog: `Command: ${resolvedCli} ${args.join(' ')}\nError: ${err.message}\nStderr: ${stderr || ''}`
                });
                resolve();
                return;
            }

            try {
                const parsed = JSON.parse(stdout || '[]');
                const items = map(parsed);
                const extra = extraFields ? extraFields(parsed) : {};
                const successMsg = `${cli} ${key} retrieved successfully (${Array.isArray(items) ? items.length : 0} items).`;
                console.log('[@extension.ts]', successMsg);
                tryGetDesignerOutputChannel()?.appendLine(`[${new Date().toLocaleTimeString()}] SUCCESS: ${successMsg}`);

                postMessage?.({
                    command: responseCommand as AssetResponseCommand,
                    [key]: Array.isArray(items) ? items : [],
                    ...extra,
                    debugLog: `Command: ${resolvedCli} ${args.join(' ')}\nRetrieved ${Array.isArray(items) ? items.length : 0} items.`
                });
            } catch (e: any) {
                const parseErrMsg = `Failed to parse ${cli} JSON output: ${e.message}`;
                console.error('[@extension.ts]', parseErrMsg);
                tryGetDesignerOutputChannel()?.appendLine(`[${new Date().toLocaleTimeString()}] ERROR: ${parseErrMsg}`);

                postMessage?.({
                    command: responseCommand as AssetResponseCommand,
                    [key]: [],
                    error: parseErrMsg,
                    debugLog: `Command: ${resolvedCli} ${args.join(' ')}\nOutput: ${stdout}`
                });
            }
            resolve();
        });
    });
}

/**
 * Asynchronously retrieves the active GCP project ID from gcloud CLI.
 * Returns undefined if gcloud is unavailable or fails.
 */
export function getGcloudProject(): Promise<string | undefined> {
    return new Promise((resolve) => {
        const gcloudBin = findGcloudPath();
        execFile(gcloudBin, ['config', 'get-value', 'project'], { timeout: 5000 }, (error, stdout) => {
            if (error || !stdout) {
                resolve(undefined);
            } else {
                resolve(stdout.trim() || undefined);
            }
        });
    });
}

/** How long a resolved default project is reused before gcloud is consulted again. */
export const GCLOUD_PROJECT_CACHE_TTL_MS = 60_000;

let cachedProject: { value: string | undefined; expiresAt: number } | undefined;
let inflightProject: Promise<string | undefined> | undefined;

/**
 * Cached variant of {@link getGcloudProject} (P9).
 *
 * `gcloud config get-value project` boots the Python CLI and routinely takes 1–3 s (up to the
 * 5 s timeout), so every editor open used to pay that cost. Results -- including a negative
 * result when gcloud is unavailable -- are reused for {@link GCLOUD_PROJECT_CACHE_TTL_MS}, and
 * concurrent callers share one in-flight lookup. The short TTL keeps `gcloud config set project`
 * changes visible within a minute without a reload.
 *
 * @param now Clock override for tests.
 * @returns The default project ID, or undefined when unknown.
 */
export function getGcloudProjectCached(now: () => number = Date.now): Promise<string | undefined> {
    if (cachedProject && cachedProject.expiresAt > now()) {
        return Promise.resolve(cachedProject.value);
    }
    if (!inflightProject) {
        inflightProject = getGcloudProject()
            .then((value) => {
                cachedProject = { value, expiresAt: now() + GCLOUD_PROJECT_CACHE_TTL_MS };
                return value;
            })
            .finally(() => {
                inflightProject = undefined;
            });
    }
    return inflightProject;
}

/**
 * Clears the cached default project. Intended for tests and for callers that know the
 * gcloud configuration has just changed.
 */
export function resetGcloudProjectCache(): void {
    cachedProject = undefined;
    inflightProject = undefined;
}
