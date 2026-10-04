/**
 * Unit tests for file read security guards and webview error reporting.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Tests:
 * - readFileContent of a normal file posts fileContentLoaded
 * - symlink inside the folder pointing to a file outside it posts fileContentError and never fileContentLoaded
 * - '../x' posts fileContentError
 * - missing file posts fileContentError
 * - readFolderFiles does not list a symlink, and does not recurse into a symlinked directory
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
    handleReadFileContent,
    handleReadFolderFiles,
    MessageContext,
} from '../../extension';

vi.mock('vscode', () => {
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
        workspace: {
            workspaceFolders: [],
            findFiles: vi.fn().mockResolvedValue([]),
            getConfiguration: vi.fn(() => ({ get: vi.fn() }))
        },
        Uri: {
            file: (p: string) => ({ fsPath: p, toString: () => p }),
            parse: (u: string) => {
                if (u.includes('throw-parse-error')) {
                    throw new Error('URI parse error');
                }
                return { fsPath: u, toString: () => u };
            }
        },
        commands: {
            registerCommand: vi.fn(),
            executeCommand: vi.fn()
        },
        window: {
            createWebviewPanel: vi.fn(),
            showErrorMessage: vi.fn(),
            showInformationMessage: vi.fn(),
            createOutputChannel: vi.fn(() => ({
                show: vi.fn(),
                appendLine: vi.fn(),
                dispose: vi.fn()
            })),
            showSaveDialog: vi.fn(),
            showOpenDialog: vi.fn(),
            terminals: []
        },
        env: {
            openExternal: vi.fn()
        }
    };
});

describe('File Read Security Guards and Error Reporting', () => {
    let tempDir: string;
    let folderPath: string;
    let outsideFilePath: string;
    let normalFilePath: string;

    const createMockContext = () => {
        const posted: any[] = [];
        const postToWebviewMock = vi.fn((msg: any) => {
            posted.push(msg);
            return true;
        });
        const ctx: MessageContext = {
            context: {} as any,
            webview: {} as any,
            postToWebview: postToWebviewMock,
        };
        return { ctx, posted, postToWebviewMock };
    };

    beforeEach(() => {
        vi.clearAllMocks();
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'file-read-guards-'));
        folderPath = path.join(tempDir, 'output');
        fs.mkdirSync(folderPath);

        outsideFilePath = path.join(tempDir, 'secret.txt');
        fs.writeFileSync(outsideFilePath, 'SECRET_KEY_123');

        normalFilePath = path.join(folderPath, 'pipeline.py');
        fs.writeFileSync(normalFilePath, 'print("hello beam")');
    });

    afterEach(() => {
        try {
            fs.rmSync(tempDir, { recursive: true, force: true });
        } catch {
            // Ignore cleanup failure
        }
    });

    it('readFileContent of a normal file posts fileContentLoaded', async () => {
        const { ctx, postToWebviewMock } = createMockContext();

        await handleReadFileContent(ctx, {
            command: 'readFileContent',
            filePath: 'pipeline.py',
            folderPath: folderPath,
        });

        expect(postToWebviewMock).toHaveBeenCalledWith({
            command: 'fileContentLoaded',
            filePath: 'pipeline.py',
            content: 'print("hello beam")',
        });
    });

    it.skipIf(process.platform === 'win32')('symlink inside the folder pointing to a file outside it posts fileContentError and never fileContentLoaded', async () => {
        const { ctx, posted } = createMockContext();
        const symlinkPath = path.join(folderPath, 'leak.txt');
        fs.symlinkSync(outsideFilePath, symlinkPath);

        await handleReadFileContent(ctx, {
            command: 'readFileContent',
            filePath: 'leak.txt',
            folderPath: folderPath,
        });

        expect(posted.some(m => m.command === 'fileContentLoaded')).toBe(false);
        expect(posted).toContainEqual(expect.objectContaining({
            command: 'fileContentError',
            filePath: 'leak.txt',
        }));
    });

    it('\'../x\' posts fileContentError', async () => {
        const { ctx, posted } = createMockContext();

        await handleReadFileContent(ctx, {
            command: 'readFileContent',
            filePath: '../secret.txt',
            folderPath: folderPath,
        });

        expect(posted.some(m => m.command === 'fileContentLoaded')).toBe(false);
        expect(posted).toContainEqual(expect.objectContaining({
            command: 'fileContentError',
            filePath: '../secret.txt',
        }));
    });

    it('missing file posts fileContentError', async () => {
        const { ctx, posted } = createMockContext();

        await handleReadFileContent(ctx, {
            command: 'readFileContent',
            filePath: 'nonexistent.py',
            folderPath: folderPath,
        });

        expect(posted.some(m => m.command === 'fileContentLoaded')).toBe(false);
        expect(posted).toContainEqual(expect.objectContaining({
            command: 'fileContentError',
            filePath: 'nonexistent.py',
        }));
    });

    it.skipIf(process.platform === 'win32')('readFolderFiles does not list a symlink, and does not recurse into a symlinked directory', async () => {
        const { ctx, postToWebviewMock } = createMockContext();

        // Symlink to external file
        const symlinkFile = path.join(folderPath, 'symlink-file.txt');
        fs.symlinkSync(outsideFilePath, symlinkFile);

        // External directory with a file
        const outsideDir = path.join(tempDir, 'outside-dir');
        fs.mkdirSync(outsideDir);
        fs.writeFileSync(path.join(outsideDir, 'external.py'), 'print("external")');

        // Symlinked directory inside folderPath pointing to outsideDir
        const symlinkDir = path.join(folderPath, 'symlink-dir');
        fs.symlinkSync(outsideDir, symlinkDir, 'dir');

        // Legitimate subfolder with a file
        const legitSubDir = path.join(folderPath, 'sub');
        fs.mkdirSync(legitSubDir);
        fs.writeFileSync(path.join(legitSubDir, 'subfile.py'), 'print("sub")');

        await handleReadFolderFiles(ctx, {
            command: 'readFolderFiles',
            folderPath: folderPath,
        });

        expect(postToWebviewMock).toHaveBeenCalledTimes(1);
        const resultMsg = postToWebviewMock.mock.calls[0][0];
        expect(resultMsg.command).toBe('folderFilesRead');
        expect(resultMsg.files).toContain('pipeline.py');
        expect(resultMsg.files).toContain('sub/subfile.py');
        expect(resultMsg.files).not.toContain('symlink-file.txt');
        expect(resultMsg.files).not.toContain('symlink-dir');
        expect(resultMsg.files).not.toContain('symlink-dir/external.py');
        expect(resultMsg.files.some((f: string) => f.includes('external'))).toBe(false);
    });
});
