/**
 * @fileoverview Helpers for resolving pipeline output folders and generating collision-free .beam filenames.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

import * as path from 'path';
import * as fs from 'fs';

/**
 * Resolves the output folder path for a pipeline, falling back to a default folder next to the .beam file.
 *
 * @param beamFsPath Filesystem path to the active .beam file, if any.
 * @param outputFolder Explicit output folder override configured on the pipeline, if any.
 * @param workspaceFolder Root workspace folder path, if any.
 * @returns The resolved output folder path, or empty string if it cannot be determined.
 */
export function resolveOutputFolder(
    beamFsPath: string | undefined,
    outputFolder: string | undefined,
    workspaceFolder: string | undefined
): string {
    const defaultFolder = beamFsPath
        ? path.join(path.dirname(beamFsPath), path.basename(beamFsPath, '.beam'))
        : '';

    if (outputFolder && outputFolder.trim()) {
        if (path.isAbsolute(outputFolder)) {
            return outputFolder;
        } else if (workspaceFolder) {
            return path.join(workspaceFolder, outputFolder);
        } else {
            return defaultFolder;
        }
    }

    return defaultFolder;
}

/**
 * Generates the next available collision-free filename with a .beam extension in a directory.
 *
 * @param dir Directory where the candidate filename will reside.
 * @param baseName Preferred base filename (with or without .beam suffix).
 * @param exists Optional filesystem existence checker, defaulting to fs.existsSync.
 * @returns The candidate filename with a .beam extension that does not currently exist.
 */
export function nextAvailableBeamFilename(
    dir: string,
    baseName: string,
    exists: (p: string) => boolean = fs.existsSync
): string {
    const base = baseName.replace(/\.beam$/, '');
    let candidate = `${base}.beam`;
    let counter = 1;
    while (exists(path.join(dir, candidate))) {
        candidate = `${base}-${counter}.beam`;
        counter++;
    }
    return candidate;
}
