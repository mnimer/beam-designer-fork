/**
 * Regression tests for empty-directory pruning during scoped cleanup.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Bug: generating a Java pipeline and then re-generating the same pipeline as Python
 * left the Java directory skeleton behind. The user saw
 * `src/main/java/com/example` and `src/test/java/com/example` sitting alongside the
 * freshly generated `src/generate_mock_data_pipeline.py`, i.e. two languages
 * intermingled in one tree.
 *
 * Root cause: `planCleanup` can only ever emit paths it was handed -- the manifest's
 * file list plus the TOP-LEVEL folder entries. It never walks the tree, so it cannot
 * know a nested directory exists. `executeScopedCleanup` duly unlinked every Java
 * *file* but nothing removed the now-empty directories those files had lived in.
 *
 * Fix: after the deletion loop, prune ancestor directories of deleted paths, deepest
 * first, removing only those that are genuinely empty.
 *
 * BLAST RADIUS: pruning is restricted to directories that contain nothing at all. A
 * directory holding any surviving user file is left alone, which preserves the
 * "never delete unknown user files" property asserted in generation-manifest.test.ts.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

vi.mock('vscode', () => {
    class MockTreeItem {
        constructor(public label: string, public collapsibleState: number = 0) {}
    }
    class MockEventEmitter {
        public fire = vi.fn();
        public event = vi.fn();
    }
    return {
        TreeItem: MockTreeItem,
        TreeItemCollapsibleState: { None: 0, Collapsed: 1, Expanded: 2 },
        EventEmitter: MockEventEmitter,
        ThemeIcon: class { constructor(public id: string) {} },
        ThemeColor: class { constructor(public id: string) {} },
        MarkdownString: class { constructor(public value: string) {} },
        Position: class { constructor(public line: number, public character: number) {} },
        Range: class { constructor(public start: any, public end: any) {} },
        WorkspaceEdit: class { public replace = vi.fn(); },
        workspace: {
            textDocuments: [],
            openTextDocument: vi.fn(),
            applyEdit: vi.fn().mockResolvedValue(true),
            workspaceFolders: [{ uri: { fsPath: '/workspace' }, name: 'workspace' }],
            findFiles: vi.fn().mockResolvedValue([]),
            onDidChangeTextDocument: vi.fn().mockReturnValue({ dispose: vi.fn() }),
            getConfiguration: vi.fn(() => ({ get: vi.fn() }))
        },
        window: {
            showTextDocument: vi.fn(),
            showErrorMessage: vi.fn(),
            showInformationMessage: vi.fn(),
            setStatusBarMessage: vi.fn(),
            registerTreeDataProvider: vi.fn(),
            showSaveDialog: vi.fn(),
            showOpenDialog: vi.fn(),
            createOutputChannel: vi.fn(() => ({ appendLine: vi.fn(), show: vi.fn() })),
            registerCustomEditorProvider: vi.fn()
        },
        Uri: {
            file: vi.fn((f: string) => ({ scheme: 'file', fsPath: f, toString: () => `file://${f}` })),
            parse: vi.fn((f: string) => ({ scheme: 'file', fsPath: f, toString: () => f })),
        },
        commands: { registerCommand: vi.fn(), executeCommand: vi.fn() },
        env: { openExternal: vi.fn() }
    };
});

import { executeScopedCleanup } from '../../extension';
import { GenerationManifest, sha256 } from '../../generationManifest';

describe('executeScopedCleanup — empty directory pruning', () => {
    let tempDir: string;

    /** Creates a file, making any missing parent directories first. */
    const write = (rel: string, content = 'x') => {
        const full = path.join(tempDir, rel);
        fs.mkdirSync(path.dirname(full), { recursive: true });
        fs.writeFileSync(full, content, 'utf-8');
    };

    /** True when `rel` exists inside the temp dir, file or directory. */
    const exists = (rel: string) => fs.existsSync(path.join(tempDir, rel));

    /**
     * Builds a manifest describing a generated Java project, hashing whatever is
     * currently on disk so no entry is falsely reported as hand-edited.
     */
    const javaManifest = (files: string[]): GenerationManifest => ({
        schemaVersion: 1,
        pipelineId: 'bp_pipeline_1',
        language: 'java',
        generatedAt: '2026-09-12T00:00:00.000Z',
        files: files.map(p => ({
            path: p,
            sha256: sha256(fs.readFileSync(path.join(tempDir, p), 'utf-8')),
        })),
    });

    // The exact tree the user reported, as produced by JAVA_STRATEGY.routeFilename.
    const JAVA_FILES = [
        'pom.xml',
        'README.md',
        'src/main/java/com/example/GenerateMockDataPipeline.java',
        'src/test/java/com/example/GenerateMockDataPipelineTest.java',
    ];

    beforeEach(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'beam-cleanup-'));
        for (const f of JAVA_FILES) {
            write(f);
        }
    });

    afterEach(() => {
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    /**
     * Non-vacuity guard: if the fixture were not actually built, every assertion
     * below would pass trivially. Prove the Java skeleton exists before we clean it.
     */
    it('fixture actually contains the nested Java skeleton', () => {
        expect(exists('src/main/java/com/example/GenerateMockDataPipeline.java')).toBe(true);
        expect(exists('src/test/java/com/example/GenerateMockDataPipelineTest.java')).toBe(true);
    });

    // --- THE REPORTED BUG -------------------------------------------------------

    it('removes the entire Java source skeleton when switching Java -> Python', () => {
        const result = executeScopedCleanup(tempDir, javaManifest(JAVA_FILES), 'python');

        // The files themselves were already being deleted before the fix.
        expect(result.removed).toBeGreaterThan(0);
        expect(exists('src/main/java/com/example/GenerateMockDataPipeline.java')).toBe(false);

        // THIS is what regressed: the empty directory husks survived and the user
        // saw Java folders intermingled with the new Python files.
        expect(exists('src/main/java/com/example')).toBe(false);
        expect(exists('src/main/java/com')).toBe(false);
        expect(exists('src/main/java')).toBe(false);
        expect(exists('src/main')).toBe(false);
        expect(exists('src/test')).toBe(false);

        // `src` held nothing but generated Java, so it goes too. The Python run that
        // follows recreates it -- cleanup always runs before any file is written.
        expect(exists('src')).toBe(false);
    });

    it('prunes empty directories on a same-language regen too', () => {
        // Not switch-specific: a regen that no longer emits a nested file should not
        // leave its directory behind either.
        const result = executeScopedCleanup(tempDir, javaManifest(JAVA_FILES), 'java');

        expect(result.removed).toBeGreaterThan(0);
        expect(exists('src/main/java/com/example')).toBe(false);
        expect(exists('src')).toBe(false);
    });

    // --- BLAST RADIUS BOUNDS ----------------------------------------------------

    it('keeps a directory that still holds a user file the manifest does not own', () => {
        // A hand-written helper the designer never generated, living inside a
        // directory that is otherwise entirely generated.
        write('src/main/java/com/example/MyHandwrittenHelper.java', 'public class X {}');

        executeScopedCleanup(tempDir, javaManifest(JAVA_FILES), 'python');

        // The user's file and every directory required to reach it must survive.
        expect(exists('src/main/java/com/example/MyHandwrittenHelper.java')).toBe(true);
        expect(exists('src/main/java/com/example')).toBe(true);
        expect(exists('src/main')).toBe(true);
        expect(exists('src')).toBe(true);

        // The fully-generated sibling branch is still pruned.
        expect(exists('src/test')).toBe(false);
    });

    it('never removes the output folder itself, even when it ends up empty', () => {
        // Manifest owns every single file in the folder.
        const all = [...JAVA_FILES];
        executeScopedCleanup(tempDir, javaManifest(all), 'python');

        expect(fs.existsSync(tempDir)).toBe(true);
        expect(fs.readdirSync(tempDir)).toEqual([]);
    });

    it('leaves unrelated top-level user directories untouched', () => {
        write('terraform/main.tf', 'resource "x" "y" {}');
        write('notes/todo.md', '- ship it');

        executeScopedCleanup(tempDir, javaManifest(JAVA_FILES), 'python');

        expect(exists('terraform/main.tf')).toBe(true);
        expect(exists('notes/todo.md')).toBe(true);
    });

    it('does not throw when the output folder does not exist', () => {
        const missing = path.join(tempDir, 'no-such-folder');
        expect(() =>
            executeScopedCleanup(missing, {
                schemaVersion: 1,
                pipelineId: 'bp_pipeline_1',
                language: 'java',
                generatedAt: '2026-09-12T00:00:00.000Z',
                files: [{ path: 'a/b/c.java', sha256: 'deadbeef' }],
            }, 'python')
        ).not.toThrow();
    });
});
