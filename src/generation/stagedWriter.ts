/**
 * @fileoverview Two-phase (stage, then commit) writer for generated project files (F7).
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Code generation used to delete the previously generated files and then write the new ones
 * one by one. A failure part-way through (disk full, permission error, an unwritable
 * directory) left the output folder half-cleaned: old files gone, new ones only partly
 * written. Staging every file next to its destination first means a failure is detected
 * before anything existing is touched, and the only work left afterwards is a sequence of
 * same-directory renames, which are atomic per file.
 */

import * as fs from 'fs';
import * as path from 'path';

/** Suffix appended to a destination path to form its staging path. */
export const STAGING_SUFFIX = '.beamgen-tmp';

/** A file that should end up at {@link StagedFile.filePath} with {@link StagedFile.content}. */
export interface StagedFile {
    /** Absolute, already containment-checked destination path. */
    filePath: string;
    /** UTF-8 file content. */
    content: string;
}

/**
 * Returns the staging path used for a destination path.
 *
 * @param filePath Absolute destination path.
 * @returns The sibling path the content is staged at before commit.
 */
export function stagingPathFor(filePath: string): string {
    return `${filePath}${STAGING_SUFFIX}`;
}

/**
 * Writes every entry to its staging path (creating parent directories as needed).
 *
 * All-or-nothing: if any write fails, every staging file written so far is removed and the
 * original error is rethrown. Destination files are never touched by this function.
 *
 * @param entries Files to stage.
 * @returns Resolves once every entry is staged.
 * @throws The first write error, after rolling back partial staging.
 */
export async function stageFiles(entries: readonly StagedFile[]): Promise<void> {
    const staged: string[] = [];
    try {
        for (const entry of entries) {
            const tmpPath = stagingPathFor(entry.filePath);
            await fs.promises.mkdir(path.dirname(tmpPath), { recursive: true });
            await fs.promises.writeFile(tmpPath, entry.content, 'utf-8');
            staged.push(tmpPath);
        }
    } catch (err) {
        await discardStagedPaths(staged);
        throw err;
    }
}

/**
 * Removes the staging files for the given entries, ignoring files that do not exist.
 *
 * @param entries Entries whose staging files should be removed.
 * @returns Resolves once removal has been attempted for every entry.
 */
export async function discardStagedFiles(entries: readonly StagedFile[]): Promise<void> {
    await discardStagedPaths(entries.map(e => stagingPathFor(e.filePath)));
}

/**
 * Best-effort removal of staging paths.
 *
 * @param tmpPaths Staging paths to remove.
 * @returns Resolves once removal has been attempted for every path.
 */
async function discardStagedPaths(tmpPaths: readonly string[]): Promise<void> {
    for (const tmpPath of tmpPaths) {
        await fs.promises.rm(tmpPath, { force: true }).catch(() => undefined);
    }
}

/**
 * Moves every staged file onto its destination with a same-directory rename.
 *
 * Call only after {@link stageFiles} resolved. Each rename atomically replaces the
 * destination, so a reader never observes a partially written file.
 *
 * @param entries Entries previously passed to {@link stageFiles}.
 * @returns Resolves once every entry has been committed.
 */
export async function commitStagedFiles(entries: readonly StagedFile[]): Promise<void> {
    for (const entry of entries) {
        await fs.promises.rename(stagingPathFor(entry.filePath), entry.filePath);
    }
}
