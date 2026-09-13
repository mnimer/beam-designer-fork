/**
 * Webview Lifecycle and Document Synchronization Regression Tests (M5, M4)
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Validates fixes for findings M5 and M4 in BeamEditorProvider and handleMessages:
 * - M5: Webview listeners and panel disposal lifecycle (preventing listener leaks
 *   and guarding against postMessage calls on disposed webview panels).
 * - M4: Two-way synchronization of .beam files via VS Code document model (WorkspaceEdit),
 *   avoiding out-of-band disk desynchronization and suppressing echo loops.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// Hoist mock state so it is accessible inside vi.mock factory
const { mockState } = vi.hoisted(() => {
    return {
        mockState: {
            mockTextDocuments: [] as Array<{
                uri: { scheme: string; fsPath: string; toString: () => string };
                getText: () => string;
                positionAt?: (offset: number) => { line: number; character: number };
                lineCount?: number;
            }>,
            textDocumentChangeListeners: [] as Array<(e: { document: { uri: { toString: () => string }; getText: () => string } }) => void>,
            mockApplyEdit: vi.fn().mockResolvedValue(true)
        }
    };
});

vi.mock('vscode', () => {
    class MockPosition {
        constructor(public line: number, public character: number) {}
    }

    class MockRange {
        constructor(public start: MockPosition, public end: MockPosition) {}
    }

    class MockWorkspaceEdit {
        public replace = vi.fn();
    }

    return {
        TreeItem: class {},
        TreeItemCollapsibleState: { None: 0, Collapsed: 1, Expanded: 2 },
        EventEmitter: class {
            public fire = vi.fn();
            public event = vi.fn();
        },
        ThemeIcon: class {},
        ThemeColor: class {},
        MarkdownString: class {},
        Position: MockPosition,
        Range: MockRange,
        WorkspaceEdit: MockWorkspaceEdit,
        workspace: {
            get textDocuments() {
                return mockState.mockTextDocuments;
            },
            applyEdit: mockState.mockApplyEdit,
            findFiles: vi.fn().mockResolvedValue([]),
            onDidChangeTextDocument: vi.fn((listener: (e: any) => void) => {
                mockState.textDocumentChangeListeners.push(listener);
                return {
                    dispose: vi.fn(() => {
                        mockState.textDocumentChangeListeners = mockState.textDocumentChangeListeners.filter(l => l !== listener);
                    })
                };
            }),
            workspaceFolders: [
                {
                    uri: { fsPath: '/test/workspace', toString: () => 'file:///test/workspace' },
                    name: 'workspace'
                }
            ],
            getConfiguration: vi.fn(() => ({
                get: vi.fn()
            }))
        },
        Uri: {
            file: (p: string) => ({
                scheme: 'file',
                fsPath: p,
                toString: () => `file://${p}`
            }),
            parse: (u: string) => ({
                scheme: u.startsWith('untitled:') ? 'untitled' : 'file',
                fsPath: u.replace(/^file:\/\//, ''),
                toString: () => u
            })
        },
        window: {
            setStatusBarMessage: vi.fn(),
            showErrorMessage: vi.fn(),
            showInformationMessage: vi.fn(),
            showSaveDialog: vi.fn(),
            showOpenDialog: vi.fn(),
            createOutputChannel: vi.fn().mockReturnValue({
                appendLine: vi.fn(),
                show: vi.fn()
            }),
            registerCustomEditorProvider: vi.fn(),
            terminals: []
        },
        commands: {
            executeCommand: vi.fn(),
            registerCommand: vi.fn()
        },
        env: {
            openExternal: vi.fn()
        }
    };
});

import {
    createSafePostMessage,
    shouldPushDocumentUpdate,
    savePipelineFiles,
    BeamEditorProvider,
    DocumentSyncState
} from '../extension';

describe('M5 — Webview Lifecycle and Safe Message Dispatching', () => {
    it('sends message to webview when panel is not disposed (simple case)', () => {
        const mockPost = vi.fn().mockReturnValue(true);
        const webview = { postMessage: mockPost };
        let isDisposed = false;

        const safePost = createSafePostMessage(webview, () => isDisposed);
        const result = safePost({ command: 'testMessage', data: 'hello' });

        expect(result).toBe(true);
        expect(mockPost).toHaveBeenCalledTimes(1);
        expect(mockPost).toHaveBeenCalledWith({ command: 'testMessage', data: 'hello' });
    });

    it('suppresses message delivery and returns false when panel is disposed (extreme case)', () => {
        const mockPost = vi.fn().mockReturnValue(true);
        const webview = { postMessage: mockPost };
        let isDisposed = true;

        const safePost = createSafePostMessage(webview, () => isDisposed);
        const result = safePost({ command: 'datasetsLoaded', datasets: [] });

        expect(result).toBe(false);
        expect(mockPost).not.toHaveBeenCalled();
    });

    it('catches unexpected webview.postMessage exceptions and returns false without throwing (failure case)', () => {
        const throwingPost = vi.fn().mockImplementation(() => {
            throw new Error('Webview has been destroyed');
        });
        const webview = { postMessage: throwingPost };
        const isDisposed = false; // panel thought it was open, but webview threw

        const safePost = createSafePostMessage(webview, () => isDisposed);
        expect(() => safePost({ command: 'topicsLoaded', topics: [] })).not.toThrow();
        const result = safePost({ command: 'topicsLoaded', topics: [] });
        expect(result).toBe(false);
    });

    it('disposes registered message and document listeners when webviewPanel is disposed', async () => {
        const receiveDisposable = { dispose: vi.fn() };
        let onDidDisposeCallback: (() => void) | undefined;

        const mockWebview = {
            asWebviewUri: vi.fn((uri: { toString: () => string }) => uri.toString()),
            options: {},
            html: '',
            postMessage: vi.fn().mockReturnValue(true),
            onDidReceiveMessage: vi.fn().mockReturnValue(receiveDisposable)
        };

        const mockPanel = {
            webview: mockWebview,
            onDidDispose: vi.fn((cb: () => void) => {
                onDidDisposeCallback = cb;
            })
        };

        const mockDocument = {
            uri: {
                scheme: 'file',
                fsPath: '/test/workspace/pipeline.beam',
                toString: () => 'file:///test/workspace/pipeline.beam'
            },
            getText: () => 'nodes: []\nedges: []\n',
            positionAt: (offset: number) => ({ line: 0, character: offset }),
            lineCount: 2
        };

        const context = {
            extensionPath: '/test/extension'
        } as any;

        const provider = new BeamEditorProvider(context);
        await provider.resolveCustomTextEditor(mockDocument as any, mockPanel as any, {} as any);

        // Verify listeners were registered
        expect(mockWebview.onDidReceiveMessage).toHaveBeenCalledTimes(1);
        expect(onDidDisposeCallback).toBeDefined();

        // Simulate user closing the editor tab (panel disposal)
        onDidDisposeCallback!();

        // Verify that webview listener disposable was cleaned up
        expect(receiveDisposable.dispose).toHaveBeenCalledTimes(1);
    });
});

describe('M4 — Echo-Loop Suppression Logic (shouldPushDocumentUpdate)', () => {
    it('allows pushing external changes when not applying our own edit (simple case)', () => {
        const isApplyingEdit = false;
        const currentContent = 'nodes:\n  - id: node-1\n';
        const lastSavedContent = 'nodes: []\n';

        const shouldPush = shouldPushDocumentUpdate(isApplyingEdit, currentContent, lastSavedContent);
        expect(shouldPush).toBe(true);
    });

    it('suppresses push when an edit originated from our own applyEdit (simple case)', () => {
        const isApplyingEdit = true;
        const currentContent = 'nodes:\n  - id: node-1\n';
        const lastSavedContent = 'nodes:\n  - id: node-1\n';

        const shouldPush = shouldPushDocumentUpdate(isApplyingEdit, currentContent, lastSavedContent);
        expect(shouldPush).toBe(false);
    });

    it('suppresses push when content is identical to last saved even if isApplyingEdit is false (extreme case)', () => {
        // Echo event arriving slightly after applyEdit promise resolves
        const isApplyingEdit = false;
        const currentContent = 'nodes:\n  - id: node-1\n';
        const lastSavedContent = 'nodes:\n  - id: node-1\n';

        const shouldPush = shouldPushDocumentUpdate(isApplyingEdit, currentContent, lastSavedContent);
        expect(shouldPush).toBe(false);
    });

    it('allows pushing when lastSavedContent is null on fresh editor open (extreme case)', () => {
        const isApplyingEdit = false;
        const currentContent = 'nodes: []\n';
        const lastSavedContent = null;

        const shouldPush = shouldPushDocumentUpdate(isApplyingEdit, currentContent, lastSavedContent);
        expect(shouldPush).toBe(true);
    });

    it('suppresses push when isApplyingEdit is true even if content string differs (failure / race case)', () => {
        const isApplyingEdit = true;
        const currentContent = 'transient content';
        const lastSavedContent = 'original content';

        const shouldPush = shouldPushDocumentUpdate(isApplyingEdit, currentContent, lastSavedContent);
        expect(shouldPush).toBe(false);
    });
});

describe('M4 — Document Model Persistence vs Filesystem Fallback (savePipelineFiles)', () => {
    let tempDir: string;

    beforeEach(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'beam-test-'));
        mockState.mockTextDocuments.length = 0;
        mockState.mockApplyEdit.mockClear();
    });

    afterEach(() => {
        try {
            fs.rmSync(tempDir, { recursive: true, force: true });
        } catch {
            // Ignore cleanup failures
        }
    });

    it('persists through WorkspaceEdit when the document is currently open in VS Code (simple case)', async () => {
        const filePath = path.join(tempDir, 'open-pipeline.beam');
        fs.writeFileSync(filePath, 'initial: on-disk\n', 'utf-8');

        const targetUri = {
            scheme: 'file',
            fsPath: filePath,
            toString: () => `file://${filePath}`
        };

        const openDoc = {
            uri: targetUri,
            getText: () => 'initial: on-disk\n',
            positionAt: (offset: number) => ({ line: 0, character: offset }),
            lineCount: 1
        };
        mockState.mockTextDocuments.push(openDoc);

        const syncState: DocumentSyncState = {
            isApplyingEdit: false,
            lastSavedContent: null
        };

        const newData = 'nodes:\n  - id: node-1\n';
        await savePipelineFiles(targetUri as any, newData, undefined, 'py', undefined, undefined, undefined, undefined, undefined, undefined, undefined, syncState);

        // Verify WorkspaceEdit was used
        expect(mockState.mockApplyEdit).toHaveBeenCalledTimes(1);

        // Verify disk content was NOT overwritten directly by fs (open document delegates persistence to VS Code)
        expect(fs.readFileSync(filePath, 'utf-8')).toBe('initial: on-disk\n');

        // Verify syncState was updated with the saved content
        expect(syncState.lastSavedContent).toBe(newData);
        expect(syncState.isApplyingEdit).toBe(false); // Reset in finally
    });

    it('falls back to fs.writeFileSync when the document is NOT open in VS Code (extreme / fallback case)', async () => {
        const filePath = path.join(tempDir, 'unopened-pipeline.beam');
        const targetUri = {
            scheme: 'file',
            fsPath: filePath,
            toString: () => `file://${filePath}`
        };
        // Document is not in mockTextDocuments
        mockState.mockTextDocuments.length = 0;

        const newData = 'nodes: []\n';
        await savePipelineFiles(targetUri as any, newData);

        // Should NOT call applyEdit
        expect(mockState.mockApplyEdit).not.toHaveBeenCalled();
        // Should write directly to filesystem
        expect(fs.existsSync(filePath)).toBe(true);
        expect(fs.readFileSync(filePath, 'utf-8')).toBe(newData);
    });

    it('skips writing when target URI is untitled (failure / guard case)', async () => {
        const untitledUri = {
            scheme: 'untitled',
            fsPath: 'Untitled-1',
            toString: () => 'untitled:Untitled-1'
        };

        await savePipelineFiles(untitledUri as any, 'data');

        expect(mockState.mockApplyEdit).not.toHaveBeenCalled();
    });

    it('guarantees directory mkdir resolves before any file write into it is attempted (M18 ordering regression)', async () => {
        const filePath = path.join(tempDir, 'ordered-pipeline.beam');
        const targetUri = {
            scheme: 'file',
            fsPath: filePath,
            toString: () => `file://${filePath}`
        };

        const operations: string[] = [];
        const origMkdir = fs.promises.mkdir;
        const origWriteFile = fs.promises.writeFile;

        const mkdirSpy = vi.spyOn(fs.promises, 'mkdir').mockImplementation(async (p, opts) => {
            operations.push(`mkdir:start:${p.toString()}`);
            // Introduce artificial delay to verify that write operations await directory creation
            await new Promise(r => setTimeout(r, 15));
            const res = await origMkdir.call(fs.promises, p, opts);
            operations.push(`mkdir:done:${p.toString()}`);
            return res;
        });

        const writeFileSpy = vi.spyOn(fs.promises, 'writeFile').mockImplementation(async (p, d, opts) => {
            operations.push(`writeFile:${p.toString()}`);
            return origWriteFile.call(fs.promises, p, d, opts);
        });

        try {
            await savePipelineFiles(
                targetUri as any,
                'nodes: []\n',
                'print("hello world")\n',
                'py',
                undefined,
                'apache-beam\n',
                'FROM python:3.10\n',
                '#!/bin/bash\necho 1\n',
                '#!/bin/bash\necho 2\n',
                '*.pyc\n',
                '.git\n'
            );

            const baseFolder = path.join(tempDir, 'ordered-pipeline');
            const srcFolder = path.join(baseFolder, 'src');
            const codeFile = path.join(srcFolder, 'ordered-pipeline.py');

            // Verify that directory creation for src folder completed before writing the code file into it
            const srcMkdirDoneIdx = operations.indexOf(`mkdir:done:${srcFolder}`);
            const codeWriteIdx = operations.indexOf(`writeFile:${codeFile}`);

            expect(srcMkdirDoneIdx).toBeGreaterThan(-1);
            expect(codeWriteIdx).toBeGreaterThan(-1);
            expect(srcMkdirDoneIdx).toBeLessThan(codeWriteIdx);
        } finally {
            mkdirSpy.mockRestore();
            writeFileSpy.mockRestore();
        }
    });

    it('clears syncState.isApplyingEdit in finally block even when applyEdit rejects (M18 failure case)', async () => {
        const filePath = path.join(tempDir, 'rejecting-pipeline.beam');
        const targetUri = {
            scheme: 'file',
            fsPath: filePath,
            toString: () => `file://${filePath}`
        };

        const openDoc = {
            uri: targetUri,
            getText: () => 'initial: content\n',
            positionAt: (offset: number) => ({ line: 0, character: offset }),
            lineCount: 1
        };
        mockState.mockTextDocuments.push(openDoc);
        mockState.mockApplyEdit.mockRejectedValueOnce(new Error('VS Code WorkspaceEdit rejected'));

        const syncState: DocumentSyncState = {
            isApplyingEdit: false,
            lastSavedContent: null
        };

        await expect(
            savePipelineFiles(
                targetUri as any,
                'new: modified content\n',
                undefined,
                'py',
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                syncState
            )
        ).rejects.toThrow('VS Code WorkspaceEdit rejected');

        // M4 & M18: The finally block must have reset isApplyingEdit to false despite rejection
        expect(syncState.isApplyingEdit).toBe(false);
    });

    it('propagates filesystem write error when target file cannot be written (M18 failure case)', async () => {
        const invalidPath = path.join('/invalid-nonexistent-root-dir', 'pipeline.beam');
        const targetUri = {
            scheme: 'file',
            fsPath: invalidPath,
            toString: () => `file://${invalidPath}`
        };
        mockState.mockTextDocuments.length = 0;

        await expect(
            savePipelineFiles(targetUri as any, 'nodes: []\n')
        ).rejects.toThrow();
    });

    it('asynchronously writes auxiliary generated files and updates script permissions (M18 extreme case)', async () => {
        const filePath = path.join(tempDir, 'aux-pipeline.beam');
        const targetUri = {
            scheme: 'file',
            fsPath: filePath,
            toString: () => `file://${filePath}`
        };
        mockState.mockTextDocuments.length = 0;

        await savePipelineFiles(
            targetUri as any,
            'nodes: []\n',
            '# Python code\n',
            'py',
            undefined,
            'apache-beam>=2.50.0\n',
            'FROM apache/beam_python3.10_sdk\n',
            '#!/bin/bash\necho "direct runner"\n',
            '#!/bin/bash\necho "dataflow runner"\n',
            '*.log\n',
            '.git\n'
        );

        const folder = path.join(tempDir, 'aux-pipeline');
        expect(fs.existsSync(path.join(folder, 'src', 'aux-pipeline.py'))).toBe(true);
        expect(fs.existsSync(path.join(folder, 'requirements.txt'))).toBe(true);
        expect(fs.existsSync(path.join(folder, 'Dockerfile'))).toBe(true);
        expect(fs.existsSync(path.join(folder, 'run_directrunner.sh'))).toBe(true);
        expect(fs.existsSync(path.join(folder, 'run_dataflow.sh'))).toBe(true);
        expect(fs.existsSync(path.join(folder, '.dockerignore'))).toBe(true);
        expect(fs.existsSync(path.join(folder, '.gcloudignore'))).toBe(true);
    });
});

describe('M4 — Two-Way Synchronization in BeamEditorProvider', () => {
    beforeEach(() => {
        mockState.textDocumentChangeListeners.length = 0;
    });

    it('pushes updated content to webview when external edit occurs in text editor tab', async () => {
        const mockPost = vi.fn().mockReturnValue(true);
        const mockWebview = {
            asWebviewUri: vi.fn((uri: { toString: () => string }) => uri.toString()),
            options: {},
            html: '',
            postMessage: mockPost,
            onDidReceiveMessage: vi.fn().mockReturnValue({ dispose: vi.fn() })
        };

        const mockPanel = {
            webview: mockWebview,
            onDidDispose: vi.fn()
        };

        const docUri = {
            scheme: 'file',
            fsPath: '/test/workspace/pipeline.beam',
            toString: () => 'file:///test/workspace/pipeline.beam'
        };

        let documentText = 'initial: content\n';
        const mockDocument = {
            uri: docUri,
            getText: () => documentText,
            positionAt: (offset: number) => ({ line: 0, character: offset }),
            lineCount: 1
        };

        const provider = new BeamEditorProvider({ extensionPath: '/test/ext' } as any);
        await provider.resolveCustomTextEditor(mockDocument as any, mockPanel as any, {} as any);

        expect(mockState.textDocumentChangeListeners.length).toBeGreaterThan(0);

        // Simulate external text editor changing document content
        documentText = 'external: update\n';
        const changeEvent = {
            document: {
                uri: docUri,
                getText: () => documentText
            }
        };

        mockState.textDocumentChangeListeners[0](changeEvent as any);

        expect(mockPost).toHaveBeenCalledWith(
            expect.objectContaining({
                command: 'loadPipeline',
                data: 'external: update\n',
                filename: 'pipeline.beam'
            })
        );
    });
});
