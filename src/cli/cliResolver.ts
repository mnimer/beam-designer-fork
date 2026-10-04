/** @fileoverview Provides cross-platform CLI resolution and PATH lookup for gcloud and related tools.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Searches process.env.PATH for an executable binary.
 *
 * @param executable The name of the binary to search for
 * @returns The resolved absolute path if found as a regular file on PATH; otherwise undefined
 */
export function findExecutableInPath(executable: string): string | undefined {
    const envPath = process.env.PATH;
    if (!envPath) {
        return undefined;
    }
    const dirs = envPath.split(path.delimiter);
    const extensions = process.platform === 'win32' ? ['.cmd', '.bat', '.exe', ''] : [''];
    for (const dir of dirs) {
        if (!dir) {
            continue;
        }
        for (const ext of extensions) {
            const candidate = path.join(dir, `${executable}${ext}`);
            try {
                if (fs.existsSync(candidate)) {
                    const stat = fs.statSync(candidate);
                    if (stat.isFile()) {
                        return candidate;
                    }
                }
            } catch {
                // Ignore filesystem read/stat errors
            }
        }
    }
    return undefined;
}

/**
 * Resolves the path to a CLI executable across supported platforms and installation modes.
 * 
 * Resolution order:
 * 1. User configuration setting `dataflowDesigner.gcloudPath` (for gcloud or sibling tools bq/gsutil)
 * 2. System PATH environment lookup via findExecutableInPath
 * 3. Platform standard candidate directories (Homebrew, /usr/local/bin, /usr/bin, user home)
 * 
 * @param cli CLI command name ('gcloud' | 'bq' | 'gsutil' | 'aws' | string)
 * @returns The resolved absolute path to the binary, or undefined if not found
 */
export function resolveCli(cli: 'gcloud' | 'bq' | 'gsutil' | 'aws' | string): string | undefined {
    // 1. Consult user configuration setting if explicitly set
    const configuredGcloud = vscode.workspace.getConfiguration('dataflowDesigner')?.get<string>('gcloudPath')?.trim();
    if (cli === 'gcloud') {
        if (configuredGcloud) {
            return configuredGcloud;
        }
    } else if (configuredGcloud && (cli === 'bq' || cli === 'gsutil')) {
        // Look for sibling CLI tool in the same directory as configured gcloud binary
        const dir = path.dirname(configuredGcloud);
        const extensions = process.platform === 'win32' ? ['.cmd', '.bat', '.exe', ''] : [''];
        for (const ext of extensions) {
            const candidate = path.join(dir, `${cli}${ext}`);
            try {
                if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
                    return candidate;
                }
            } catch {
                // Ignore filesystem read/stat errors
            }
        }
    }

    // 2. Consult system PATH lookup
    const pathCandidate = findExecutableInPath(cli);
    if (pathCandidate) {
        return pathCandidate;
    }

    // 3. Fallback to generic candidate directories
    const candidateDirs: string[] = [];
    if (cli === 'gcloud' || cli === 'bq' || cli === 'gsutil') {
        if (process.env.HOME) {
            candidateDirs.push(path.join(process.env.HOME, 'google-cloud-sdk/bin'));
        }
    } else if (cli === 'aws') {
        if (process.env.HOME) {
            candidateDirs.push(path.join(process.env.HOME, '.local/bin'));
        }
    }
    candidateDirs.push('/opt/homebrew/bin');
    candidateDirs.push('/usr/local/bin');
    candidateDirs.push('/usr/bin');

    const extensions = process.platform === 'win32' ? ['.cmd', '.bat', '.exe', ''] : [''];
    for (const dir of candidateDirs) {
        for (const ext of extensions) {
            const candidate = path.join(dir, `${cli}${ext}`);
            try {
                if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
                    return candidate;
                }
            } catch {
                // Ignore filesystem read/stat errors
            }
        }
    }

    return undefined;
}

/**
 * Resolves the path to the Google Cloud SDK (gcloud) executable.
 * 
 * Resolution order:
 * 1. User configuration setting `dataflowDesigner.gcloudPath`
 * 2. System PATH environment lookup
 * 3. Generic standard installation locations
 * 4. Fallback executable name 'gcloud'
 * 
 * @returns The resolved path or command name for the gcloud binary
 */
export function findGcloudPath(): string {
    return resolveCli('gcloud') || 'gcloud';
}
