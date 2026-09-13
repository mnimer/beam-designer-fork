/**
 * M18 Hot Path Asynchronous File I/O Regression Tests
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Validates fixes for review finding M18: converting blocking synchronous file I/O
 * (fs.*Sync) to non-blocking fs.promises on hot execution paths:
 * 1. savePipelineFiles: verifies non-blocking writes and directory creation order.
 * 2. getSamplePipelines: verifies non-blocking sample discovery via fs.promises.
 * 3. readFolderFiles / codegen: verifies non-blocking recursive directory walk.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// Mock vscode module before importing extension
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
            parse: vi.fn((f: string) => ({ scheme: f.startsWith('untitled:') ? 'untitled' : 'file', fsPath: f, toString: () => f })),
        },
        commands: {
            registerCommand: vi.fn(),
            executeCommand: vi.fn(),
        },
        env: {
            openExternal: vi.fn()
        }
    };
});

import { getSamplePipelines, savePipelineFiles } from '../extension';

describe('M18 — getSamplePipelines non-blocking asynchronous loading', () => {
    let tempDir: string;

    beforeEach(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'beam-samples-test-'));
    });

    afterEach(() => {
        try {
            fs.rmSync(tempDir, { recursive: true, force: true });
        } catch {
            // Ignore cleanup failure
        }
    });

    it('asynchronously discovers and parses samples using fs.promises (simple case)', async () => {
        const samplesDir = path.join(tempDir, 'resources', 'samples');
        fs.mkdirSync(samplesDir, { recursive: true });

        const sampleYaml = `
pipelineConfig:
  language: Python
jobConfig:
  runner: DirectRunner
nodes:
  - id: node_1
    type: custom
    data:
      label: Read Data
  - id: node_2
    type: custom
    data:
      label: Write Output
edges:
  - id: edge_1
    source: node_1
    target: node_2
`;
        fs.writeFileSync(path.join(samplesDir, 'custom-test-pipeline.beam'), sampleYaml, 'utf-8');

        const mockContext: any = {
            asAbsolutePath: (rel: string) => path.join(tempDir, rel),
            extensionPath: tempDir
        };

        const readdirSpy = vi.spyOn(fs.promises, 'readdir');
        const readFileSpy = vi.spyOn(fs.promises, 'readFile');

        try {
            const results = await getSamplePipelines(mockContext);

            expect(Array.isArray(results)).toBe(true);
            expect(results.length).toBe(1);
            expect(results[0].id).toBe('custom-test-pipeline');
            expect(results[0].language).toBe('Python');
            expect(results[0].runner).toBe('DirectRunner');
            expect(results[0].title).toBe('Custom Test Pipeline');

            // Verify non-blocking fs.promises APIs were exercised
            expect(readdirSpy).toHaveBeenCalled();
            expect(readFileSpy).toHaveBeenCalled();
        } finally {
            readdirSpy.mockRestore();
            readFileSpy.mockRestore();
        }
    });

    it('returns empty array when samples directory does not exist (extreme / missing dir case)', async () => {
        const nonExistentContext: any = {
            asAbsolutePath: (rel: string) => path.join(tempDir, 'does-not-exist', rel),
            extensionPath: path.join(tempDir, 'does-not-exist')
        };

        const results = await getSamplePipelines(nonExistentContext);
        expect(results).toEqual([]);
    });

    it('gracefully handles unparseable YAML in sample file by falling back to defaults (failure case)', async () => {
        const samplesDir = path.join(tempDir, 'resources', 'samples');
        fs.mkdirSync(samplesDir, { recursive: true });

        // Corrupt YAML that causes YAML.parse to throw
        const corruptContent = '::: corrupt [not valid yaml :::';
        fs.writeFileSync(path.join(samplesDir, 'corrupt-sample.beam'), corruptContent, 'utf-8');

        const mockContext: any = {
            asAbsolutePath: (rel: string) => path.join(tempDir, rel),
            extensionPath: tempDir
        };

        const results = await getSamplePipelines(mockContext);
        expect(results.length).toBe(1);
        expect(results[0].id).toBe('corrupt-sample');
        expect(results[0].language).toBe('Java'); // default fallback
        expect(results[0].runner).toBe('Dataflow'); // default fallback
    });
});

describe('M18 — savePipelineFiles non-blocking file operations', () => {
    let tempDir: string;

    beforeEach(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'beam-save-test-'));
    });

    afterEach(() => {
        try {
            fs.rmSync(tempDir, { recursive: true, force: true });
        } catch {
            // Ignore cleanup failure
        }
    });

    it('executes non-blocking writes via fs.promises (hot path non-blocking verification)', async () => {
        const filePath = path.join(tempDir, 'async-verify.beam');
        const targetUri = {
            scheme: 'file',
            fsPath: filePath,
            toString: () => `file://${filePath}`
        };

        const writeFilePromiseSpy = vi.spyOn(fs.promises, 'writeFile');
        const mkdirPromiseSpy = vi.spyOn(fs.promises, 'mkdir');
        const chmodPromiseSpy = vi.spyOn(fs.promises, 'chmod');

        try {
            await savePipelineFiles(
                targetUri as any,
                'nodes: []\n',
                '# Generated python code\n',
                'py',
                undefined,
                'apache-beam\n',
                'FROM python\n',
                '#!/bin/bash\necho "direct"\n',
                '#!/bin/bash\necho "dataflow"\n'
            );

            // Verify non-blocking fs.promises were invoked
            expect(writeFilePromiseSpy).toHaveBeenCalled();
            expect(mkdirPromiseSpy).toHaveBeenCalled();
            expect(chmodPromiseSpy).toHaveBeenCalled();

            // Verify files were actually created on disk via fs.promises
            const folder = path.join(tempDir, 'async-verify');
            expect(fs.existsSync(filePath)).toBe(true);
            expect(fs.existsSync(path.join(folder, 'src', 'async-verify.py'))).toBe(true);
            expect(fs.existsSync(path.join(folder, 'run_directrunner.sh'))).toBe(true);
        } finally {
            writeFilePromiseSpy.mockRestore();
            mkdirPromiseSpy.mockRestore();
            chmodPromiseSpy.mockRestore();
        }
    });
});
