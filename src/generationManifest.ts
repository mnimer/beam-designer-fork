/**
 * Generation Manifest & Cleanup Planning
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Owns the "what are we allowed to delete" decision for code generation (finding C3).
 * The designer regenerates a pipeline's source into a user-chosen output folder. Before
 * this module existed, regeneration called `deleteCodeFiles()` which read the directory
 * and removed *everything* non-hidden except `*.beam` -- and did so BEFORE calling Gemini,
 * so a timeout, rate-limit or unparseable response left the user with nothing.
 *
 * Architectural decisions (read before changing any of this):
 *
 * 1. DENYLIST -> ALLOWLIST. The old strategy enumerated the folder and excluded a few
 *    known names. That is wrong in both directions: it *under*-deleted dependency dirs
 *    (`.venv`, `.gradle` are dot-prefixed and were skipped) while *over*-deleting
 *    hand-written user files (README.md, metadata.json, *.tf). We now only ever remove
 *    (a) files we recorded creating, and (b) an explicit build-artifact allowlist.
 *    Unknown files survive by default. That property is the actual fix -- it bounds the
 *    blast radius even when every other layer is bypassed.
 *
 * 2. A MANIFEST ALONE IS NOT ENOUGH. A manifest says *which files* we created; it does
 *    not say *whose folder this is*. If the user retargets output at an existing project
 *    directory, a manifest offers no protection because there isn't one yet. Hence the
 *    ownership marker plus the classification gate in `classifyFolder`.
 *
 * 3. DELETE LATE. Callers must classify and plan before the model call, but only execute
 *    the deletion once a validated payload is in memory. A temp-dir-and-swap was
 *    considered and rejected: plain reordering gives the same atomicity without
 *    cross-device rename or partial-swap failure modes.
 *
 * 4. KEEP DEPENDENCIES ON SAME-LANGUAGE REGEN. Wiping `.venv`/`target` on every
 *    generation costs the user a full reinstall for no benefit. They are removed only on
 *    a language switch, which is the one case where they are genuinely stale.
 *
 * Residual risk this cannot eliminate: once a folder is designer-owned, a user who later
 * stores their own work in that same folder is still exposed. Layer 4 contains the blast
 * radius -- we never remove "everything in the directory" -- so unknown user files
 * survive. That is the guarantee this module provides, and it is exactly what a manifest
 * on its own does not give you.
 */

import * as crypto from 'crypto';
import * as path from 'path';

/** Current on-disk schema version for `.beamgen.json`. Bump on breaking shape changes. */
export const MANIFEST_SCHEMA_VERSION = 1;

/** Filename of the ownership marker written into every designer-owned output folder. */
export const MANIFEST_FILENAME = '.beamgen.json';

/**
 * Build artifacts and dependency directories that may be removed on a language switch.
 * Exact basenames only -- no globbing except the `*.egg-info` suffix handled in
 * `isBuildArtifact`. Deliberately conservative: anything not named here is user data.
 */
export const BUILD_ARTIFACT_ALLOWLIST: readonly string[] = [
    '.venv', 'venv', 'env',
    '__pycache__', '.pytest_cache', '.mypy_cache',
    'target', '.gradle', 'build', 'out',
    'node_modules',
];

/**
 * Descriptor files that identify a language's project layout. Removed only when switching
 * *away* from that language, so a Python regen never touches Java descriptors and vice versa.
 */
export const LANGUAGE_DESCRIPTORS: Readonly<Record<string, readonly string[]>> = {
    python: ['requirements.txt', 'setup.py', 'pyproject.toml', 'Pipfile'],
    java: ['pom.xml', 'build.gradle', 'build.gradle.kts', 'settings.gradle'],
};

/** One generated file recorded in the manifest, with the hash we wrote it at. */
export interface ManifestFileEntry {
    /** Path relative to the output folder, POSIX separators. */
    path: string;
    /** sha256 of the exact bytes we wrote, used to detect later hand-edits. */
    sha256: string;
}

/** The `.beamgen.json` ownership marker. */
export interface GenerationManifest {
    schemaVersion: number;
    /** Stable identity of the pipeline that owns this folder. */
    pipelineId: string;
    /** Language this folder was last generated for, e.g. 'python' | 'java'. */
    language: string;
    /** ISO-8601 timestamp of the last successful generation. */
    generatedAt: string;
    files: ManifestFileEntry[];
}

/**
 * How a candidate output folder relates to the pipeline requesting generation.
 * Drives whether we may clean it, must ask first, or may proceed freely.
 */
export type FolderOwnership =
    /** No marker, folder empty or absent -- safe to generate into. */
    | 'fresh'
    /** No marker but the folder has contents -- never auto-delete; ask the user. */
    | 'unowned-nonempty'
    /** Marker present but belongs to a different pipeline -- ask the user. */
    | 'foreign'
    /** Marker present and matches this pipeline -- cleanup is permitted. */
    | 'owned';

/** What a planned cleanup will remove, and why. */
export interface CleanupPlan {
    /** Paths relative to the output folder that may be deleted. */
    paths: string[];
    /** True when the requested language differs from the manifest's. */
    isLanguageSwitch: boolean;
    /** Manifest files whose on-disk hash no longer matches -- user hand-edits. */
    modifiedFiles: string[];
}

/**
 * Computes the sha256 of file content, used to record what we wrote and to detect
 * later hand-edits to generated files.
 *
 * @param content File content as written to disk
 * @returns Lowercase hex sha256 digest
 */
export function sha256(content: string): string {
    return crypto.createHash('sha256').update(content, 'utf-8').digest('hex');
}

/**
 * Generates a stable identifier for a new pipeline.
 *
 * NOTE: `pipelineConfig` historically carried no stable ID at all, which is why folder
 * ownership could not be established. New pipelines get one at creation; existing ones
 * are backfilled on first save by the caller.
 *
 * @returns An opaque unique pipeline identifier
 */
export function generatePipelineId(): string {
    return `bp_${crypto.randomBytes(12).toString('hex')}`;
}

/**
 * Validates and normalises a parsed `.beamgen.json`.
 *
 * Returns null for anything malformed rather than throwing or guessing: an unreadable
 * marker must degrade to "no marker", which routes into the *more* cautious
 * `unowned-nonempty` branch rather than silently authorising a delete.
 *
 * @param raw Parsed JSON of the manifest file, or null if unreadable
 * @returns A valid manifest, or null
 */
export function parseManifest(raw: unknown): GenerationManifest | null {
    if (!raw || typeof raw !== 'object') {
        return null;
    }
    const m = raw as Partial<GenerationManifest>;
    if (typeof m.pipelineId !== 'string' || !m.pipelineId) {
        return null;
    }
    if (typeof m.language !== 'string' || !m.language) {
        return null;
    }
    // NOTE: `typeof NaN === 'number'` and `NaN > X` is false, so a plain typeof check lets
    // { schemaVersion: NaN } through and it would be treated as a readable manifest --
    // i.e. as permission to delete. Require a real integer. (Caught in review by the
    // test suite for this module.)
    if (!Number.isInteger(m.schemaVersion as number)) {
        return null;
    }
    // NOTE: a future schemaVersion means a newer extension wrote this folder. Treat it as
    // unreadable rather than risk deleting by stale rules.
    if ((m.schemaVersion as number) > MANIFEST_SCHEMA_VERSION) {
        return null;
    }
    const schemaVersion = m.schemaVersion as number;
    const files = Array.isArray(m.files) ? m.files : [];
    const validFiles: ManifestFileEntry[] = files
        .filter((f: any) => f && typeof f.path === 'string' && typeof f.sha256 === 'string')
        .map((f: any) => ({ path: f.path, sha256: f.sha256 }));
    return {
        schemaVersion,
        pipelineId: m.pipelineId,
        language: m.language,
        generatedAt: typeof m.generatedAt === 'string' ? m.generatedAt : '',
        files: validFiles,
    };
}

/**
 * Classifies an output folder so the caller knows whether cleanup is permitted.
 *
 * This is the answer to "can't the user still wreck things by pointing the output folder
 * at an existing project?" -- yes, unless retargeting is explicitly detected, which is
 * what this does.
 *
 * | Marker  | Folder    | Result             | Caller action              |
 * |---------|-----------|--------------------|----------------------------|
 * | absent  | empty     | 'fresh'            | proceed                    |
 * | absent  | non-empty | 'unowned-nonempty' | prompt, never auto-delete  |
 * | present | id differs| 'foreign'          | prompt                     |
 * | present | id matches| 'owned'            | clean per planCleanup      |
 *
 * @param manifest Parsed manifest from the folder, or null if absent/unreadable
 * @param folderIsEmpty Whether the folder has no entries (or does not exist)
 * @param requestedPipelineId The pipeline asking to generate here
 * @returns The ownership classification
 */
export function classifyFolder(
    manifest: GenerationManifest | null,
    folderIsEmpty: boolean,
    requestedPipelineId: string
): FolderOwnership {
    if (!manifest) {
        return folderIsEmpty ? 'fresh' : 'unowned-nonempty';
    }
    if (!requestedPipelineId || manifest.pipelineId !== requestedPipelineId) {
        return 'foreign';
    }
    return 'owned';
}

/**
 * Returns true if a folder entry is a known build artifact eligible for removal on a
 * language switch.
 *
 * @param name A single directory entry basename
 * @returns Whether the entry is an allowlisted build artifact
 */
export function isBuildArtifact(name: string): boolean {
    if (!name) {
        return false;
    }
    if (BUILD_ARTIFACT_ALLOWLIST.includes(name)) {
        return true;
    }
    // NOTE: *.egg-info is the one pattern entry; everything else is an exact name.
    return name.endsWith('.egg-info');
}

/**
 * Returns descriptor filenames belonging to languages OTHER than the requested one.
 * These are removed on a language switch so a Python regen does not leave a stale pom.xml.
 *
 * @param requestedLanguage The language being generated now
 * @returns Descriptor basenames belonging to other languages
 */
export function foreignLanguageDescriptors(requestedLanguage: string): string[] {
    const lang = (requestedLanguage || '').toLowerCase();
    const out: string[] = [];
    for (const [key, descriptors] of Object.entries(LANGUAGE_DESCRIPTORS)) {
        if (key !== lang) {
            out.push(...descriptors);
        }
    }
    return out;
}

/**
 * Builds the list of paths that may be deleted, scoped by scenario.
 *
 * Same-language regen removes only files we recorded creating. A language switch
 * additionally removes build artifacts and the other language's descriptors -- that is
 * the only path that touches dependency directories, which is precisely when they are
 * stale.
 *
 * Callers MUST have classified the folder as 'owned' first. This function assumes that
 * check has already passed and does not repeat it.
 *
 * @param manifest The owning manifest for this folder
 * @param requestedLanguage Language being generated now
 * @param folderEntries Basenames currently present in the output folder
 * @param currentHashes Map of manifest-relative path -> current on-disk sha256; a missing
 *                      entry means the file is gone, which is not a modification
 * @returns The cleanup plan
 */
export function planCleanup(
    manifest: GenerationManifest,
    requestedLanguage: string,
    folderEntries: string[],
    currentHashes: Record<string, string> = {}
): CleanupPlan {
    const isLanguageSwitch =
        (manifest.language || '').toLowerCase() !== (requestedLanguage || '').toLowerCase();

    // Layer 4a: always remove what we recorded creating.
    const paths = new Set<string>();
    for (const entry of manifest.files) {
        paths.add(entry.path);
    }

    // Layer 4b: on a language switch only, remove build artifacts and foreign descriptors.
    if (isLanguageSwitch) {
        const foreign = new Set(foreignLanguageDescriptors(requestedLanguage));
        for (const name of folderEntries) {
            if (isBuildArtifact(name) || foreign.has(name)) {
                paths.add(name);
            }
        }
    }

    // Hash check: a differing hash means the user hand-edited generated code. Overwriting
    // is documented behaviour so we proceed, but the caller surfaces the list so the user
    // can recover from git.
    const modifiedFiles: string[] = [];
    for (const entry of manifest.files) {
        const current = currentHashes[entry.path];
        if (current && current !== entry.sha256) {
            modifiedFiles.push(entry.path);
        }
    }

    return {
        paths: Array.from(paths),
        isLanguageSwitch,
        modifiedFiles,
    };
}

/**
 * Final containment check applied to every planned deletion path immediately before it is
 * executed. Mirrors the write-side guard used for generated files.
 *
 * Defence in depth: a manifest is on-disk data and therefore attacker-influenced if a
 * malicious `.beam`/folder is shared. A crafted manifest entry of `../../.ssh/id_rsa`
 * must never escape the output folder.
 *
 * @param folderPath Absolute output folder
 * @param relativePath Candidate path from the cleanup plan
 * @returns Absolute resolved path, or null if it escapes the folder
 */
export function resolveDeletablePath(folderPath: string, relativePath: string): string | null {
    if (!folderPath || !relativePath || typeof relativePath !== 'string') {
        return null;
    }
    const trimmed = relativePath.trim();
    if (!trimmed || path.isAbsolute(trimmed) || path.win32.isAbsolute(trimmed) || /^[a-zA-Z]:/.test(trimmed)) {
        return null;
    }
    const resolvedFolder = path.resolve(folderPath);
    const resolved = path.resolve(resolvedFolder, trimmed.replace(/\\/g, '/'));
    const rel = path.relative(resolvedFolder, resolved);
    if (!rel || rel === '.' || rel.startsWith('..') || path.isAbsolute(rel)) {
        return null;
    }
    // The marker itself is rewritten, never deleted as part of a plan.
    if (rel === MANIFEST_FILENAME) {
        return null;
    }
    // `.beam` design files are never removed under any scenario.
    if (rel.endsWith('.beam')) {
        return null;
    }
    return resolved;
}

/**
 * Builds a manifest describing a completed generation.
 *
 * @param pipelineId Owning pipeline identifier
 * @param language Language generated
 * @param files Relative path -> written content, used to record hashes
 * @returns A manifest ready to serialise to `.beamgen.json`
 */
export function buildManifest(
    pipelineId: string,
    language: string,
    files: Array<{ path: string; content: string }>
): GenerationManifest {
    return {
        schemaVersion: MANIFEST_SCHEMA_VERSION,
        pipelineId,
        language,
        generatedAt: new Date().toISOString(),
        files: files.map(f => ({ path: f.path, sha256: sha256(f.content) })),
    };
}
