/** @fileoverview Provides folder gating, ownership classification, and scoped cleanup for pipeline generation.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import {
    MANIFEST_FILENAME,
    GenerationManifest,
    FolderOwnership,
    parseManifest,
    classifyFolder,
    planCleanup,
    resolveDeletablePath,
    buildManifest,
    sha256,
} from '../generationManifest';
import { tryGetDesignerOutputChannel } from '../core/outputChannel';

/**
 * Derives a stable identifier for a pipeline so that subsequent generations into the
 * same output folder recognise this design as the folder's owner, rather than prompting
 * the user with a foreign-pipeline warning.
 *
 * PRECEDENCE:
 * 1. `pipelineConfig.pipelineId` if present and non-empty (written to new pipelines).
 * 2. Deterministic hash of the `.beam` file's workspace-relative path (stable fallback
 *    for older pipelines that predate the pipelineId field).
 * 3. Deterministic hash of the absolute path if outside any workspace folder.
 *
 * This ensures that saving a pipeline and then immediately generating into an existing
 * target folder classifies the folder as `owned`, while opening a second `.beam` file
 * and generating into the first pipeline's folder classifies it as `foreign` and prompts
 * before touching anything (finding C3).
 *
 * @param pipelineConfig The pipeline configuration from the webview
 * @param documentPath Absolute path of the .beam document
 * @returns A stable pipeline identifier
 */
export function resolvePipelineId(pipelineConfig: any, documentPath: string): string {
    const explicit = pipelineConfig?.pipelineId;
    if (typeof explicit === 'string' && explicit.trim()) {
        return explicit.trim();
    }
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    const key = workspaceFolder
        ? path.relative(workspaceFolder, documentPath)
        : documentPath;
    return `bp_path_${sha256(key).slice(0, 24)}`;
}

/**
 * Reads and validates the `.beamgen.json` ownership marker from an output folder.
 *
 * @param folderPath Absolute output folder
 * @returns The parsed manifest, or null when absent, unreadable or malformed
 */
function readGenerationManifest(folderPath: string): GenerationManifest | null {
    const markerPath = path.join(folderPath, MANIFEST_FILENAME);
    if (!fs.existsSync(markerPath)) {
        return null;
    }
    try {
        return parseManifest(JSON.parse(fs.readFileSync(markerPath, 'utf-8')));
    } catch (err) {
        // NOTE: an unreadable marker degrades to "no marker", which routes into the more
        // cautious unowned-nonempty branch rather than authorising a delete.
        console.warn(`[generation] Ignoring unreadable ${MANIFEST_FILENAME} in ${folderPath}`, err);
        return null;
    }
}

/**
 * Decides whether generation may proceed into the target folder, prompting the user when
 * the folder is not demonstrably ours.
 *
 * This is the answer to "what if the user points Target Folder at an existing project?".
 * We never auto-delete a folder we did not create.
 *
 * @param targetFolderPath Absolute output folder
 * @param pipelineId Stable identity of the pipeline requesting generation
 * @returns The ownership classification plus whether the caller may clean, or null if the
 *          user cancelled
 */
export async function gateOutputFolder(
    targetFolderPath: string,
    pipelineId: string
): Promise<{ ownership: FolderOwnership; manifest: GenerationManifest | null; mayClean: boolean } | null> {
    const manifest = readGenerationManifest(targetFolderPath);

    let entries: string[] = [];
    if (fs.existsSync(targetFolderPath)) {
        try {
            entries = fs.readdirSync(targetFolderPath);
        } catch {
            entries = [];
        }
    }
    // The marker and the design file itself do not make a folder "non-empty" for the
    // purposes of this decision.
    const meaningful = entries.filter(e => e !== MANIFEST_FILENAME && !e.endsWith('.beam'));
    const ownership = classifyFolder(manifest, meaningful.length === 0, pipelineId);

    if (ownership === 'fresh') {
        return { ownership, manifest, mayClean: false };
    }
    if (ownership === 'owned') {
        return { ownership, manifest, mayClean: true };
    }

    // 'unowned-nonempty' or 'foreign': never delete silently. Ask.
    // NOTE: VS Code's { modal: true } automatically provides a built-in "Cancel" dismiss button.
    const detail = ownership === 'foreign'
        ? `This folder was generated for a different pipeline. Continuing may overwrite its files.`
        : `This folder was not created by the designer and contains ${meaningful.length} item(s).`;
    const choice = await vscode.window.showWarningMessage(
        `${detail}\n\n${targetFolderPath}`,
        { modal: true },
        'Generate without cleaning'
    );
    if (choice !== 'Generate without cleaning') {
        return null;
    }
    // Proceed, but explicitly without deletion rights.
    return { ownership, manifest, mayClean: false };
}

/**
 * Removes directories that became empty once their generated contents were deleted.
 *
 * `planCleanup` can only emit paths it was handed -- the manifest's file list plus the
 * TOP-LEVEL folder entries -- so it has no way to know that a nested directory such as
 * `src/main/java/com/example` exists at all. Without this pass, switching a pipeline
 * from Java to Python deleted every `.java` file but left the whole directory skeleton
 * standing, and the user saw Java folders intermingled with the new Python output.
 *
 * BLAST RADIUS: a directory is removed only when it is completely empty. Anything the
 * user owns -- a hand-written source file, an unrelated subfolder -- keeps its parent
 * chain alive, which preserves the "never delete unknown user files" guarantee that the
 * rest of the cleanup design rests on. `fs.rmdirSync` is used rather than a recursive
 * remove precisely so that guarantee is enforced by the filesystem, not by our own
 * bookkeeping: a non-empty directory simply cannot be removed this way.
 *
 * @param targetFolderPath Absolute output folder; never itself removed
 * @param deletedRelPaths Relative paths that were just deleted
 * @returns Number of directories pruned
 */
function pruneEmptyDirectories(targetFolderPath: string, deletedRelPaths: string[]): number {
    // Collect every ancestor directory of every deleted path. A file at
    // `src/main/java/com/example/P.java` contributes five candidates, because deleting
    // that one file can cascade all the way back up to `src`.
    const candidates = new Set<string>();
    for (const rel of deletedRelPaths) {
        // Manifest paths may use Windows separators; normalise before splitting.
        let dir = path.posix.dirname(rel.replace(/\\/g, '/'));
        while (dir && dir !== '.' && dir !== '/' && !dir.startsWith('..')) {
            candidates.add(dir);
            dir = path.posix.dirname(dir);
        }
    }

    // Deepest first, so a child is gone by the time its parent is tested for emptiness.
    // Without this ordering `src/main` would still contain `src/main/java` and survive.
    const ordered = Array.from(candidates).sort(
        (a, b) => b.split('/').length - a.split('/').length
    );

    let pruned = 0;
    for (const rel of ordered) {
        // Same defence-in-depth containment check applied to file deletions. Manifest
        // paths are attacker-influenced, and dirname() of a hostile entry is equally so.
        // This also refuses '.' outright, which is what stops us removing the output
        // folder itself when the manifest owned everything in it.
        const abs = resolveDeletablePath(targetFolderPath, rel);
        if (!abs) {
            continue;
        }
        try {
            if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) {
                continue;
            }
            if (fs.readdirSync(abs).length > 0) {
                // Still holds something we do not own. Stop; its parents are non-empty
                // too and will fail this same check when their turn comes.
                continue;
            }
            fs.rmdirSync(abs);
            pruned++;
        } catch (err) {
            // Never fatal: a leftover empty directory is cosmetic, whereas aborting the
            // generation here would cost the user the payload we already hold.
            console.warn(`[generation] Could not prune empty directory ${abs}`, err);
        }
    }
    return pruned;
}

/**
 * Executes a scoped cleanup of a designer-owned output folder.
 *
 * MUST be called only after a validated generation payload is in memory -- deleting
 * before the model call is what made a timeout or unparseable response unrecoverable
 * (finding C3). Every path is re-checked for containment immediately before removal.
 *
 * @param targetFolderPath Absolute output folder
 * @param manifest The owning manifest
 * @param requestedLanguage Language being generated now
 * @returns Number of entries removed, and any hand-edited files detected
 */
export function executeScopedCleanup(
    targetFolderPath: string,
    manifest: GenerationManifest,
    requestedLanguage: string
): { removed: number; modifiedFiles: string[] } {
    const designerOutputChannel = tryGetDesignerOutputChannel();
    let entries: string[] = [];
    try {
        entries = fs.readdirSync(targetFolderPath);
    } catch {
        return { removed: 0, modifiedFiles: [] };
    }

    // Hash the manifest's files as they currently stand so we can report hand-edits.
    const currentHashes: Record<string, string> = {};
    for (const entry of manifest.files) {
        const abs = resolveDeletablePath(targetFolderPath, entry.path);
        if (abs && fs.existsSync(abs)) {
            try {
                currentHashes[entry.path] = sha256(fs.readFileSync(abs, 'utf-8'));
            } catch {
                // Binary or unreadable; skip hash comparison for this entry.
            }
        }
    }

    const plan = planCleanup(manifest, requestedLanguage, entries, currentHashes);

    let removed = 0;
    // Records what actually left the disk so we know which directories to re-test for
    // emptiness. Paths we skipped or failed to delete must not trigger a prune.
    const deletedRelPaths: string[] = [];
    for (const rel of plan.paths) {
        // Defence in depth: the manifest is on-disk data and therefore attacker-influenced
        // if a malicious folder is shared. Re-validate containment for every single path.
        const abs = resolveDeletablePath(targetFolderPath, rel);
        if (!abs) {
            console.warn(`[generation] Refusing to delete out-of-bounds manifest entry: ${rel}`);
            continue;
        }
        if (!fs.existsSync(abs)) {
            // Already gone -- the user may have deleted it by hand. Its parent can still
            // be empty as a result, so it remains a prune candidate.
            deletedRelPaths.push(rel);
            continue;
        }
        try {
            const stat = fs.statSync(abs);
            if (stat.isDirectory()) {
                fs.rmSync(abs, { recursive: true, force: true });
            } else {
                fs.unlinkSync(abs);
            }
            removed++;
            deletedRelPaths.push(rel);
        } catch (err) {
            console.error(`[generation] Failed to delete ${abs}`, err);
        }
    }

    // Deleting the files is not enough: the directories they lived in would otherwise
    // survive as empty husks and appear to be leftover code from the previous language.
    const prunedDirs = pruneEmptyDirectories(targetFolderPath, deletedRelPaths);
    if (prunedDirs > 0) {
        designerOutputChannel?.appendLine(
            `[generation] Pruned ${prunedDirs} empty director${prunedDirs === 1 ? 'y' : 'ies'} left by the previous generation.`
        );
    }

    if (plan.isLanguageSwitch) {
        designerOutputChannel?.appendLine(
            `[generation] Language switch ${manifest.language} -> ${requestedLanguage}: removed ${removed} entries including build artifacts.`
        );
    }
    return { removed, modifiedFiles: plan.modifiedFiles };
}

/**
 * Writes the `.beamgen.json` ownership marker recording what this generation produced.
 *
 * @param targetFolderPath Absolute output folder
 * @param pipelineId Owning pipeline identifier
 * @param language Language generated
 * @param written Files written in this run, relative path plus content
 */
export function writeGenerationManifest(
    targetFolderPath: string,
    pipelineId: string,
    language: string,
    written: Array<{ path: string; content: string }>
): void {
    try {
        const manifest = buildManifest(pipelineId, language, written);
        fs.writeFileSync(
            path.join(targetFolderPath, MANIFEST_FILENAME),
            JSON.stringify(manifest, null, 2),
            'utf-8'
        );
    } catch (err) {
        // A missing marker degrades safely: the next run classifies the folder as
        // unowned-nonempty and prompts rather than deleting.
        console.error(`[generation] Failed to write ${MANIFEST_FILENAME}`, err);
    }
}
