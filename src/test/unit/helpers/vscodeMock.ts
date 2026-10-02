/**
 * @fileoverview Shared mock factory for the 'vscode' API in unit tests.
 * Provides a fresh vscode mock object with standard stubs, classes, and deep-merged overrides.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

import { vi } from 'vitest';

/**
 * Mock implementation of vscode.TreeItem.
 */
export class MockTreeItem {
    public description?: string;
    public tooltip?: unknown;
    public iconPath?: unknown;
    public command?: unknown;

    /**
     * Initializes a new MockTreeItem.
     * @param label The tree item label.
     * @param collapsibleState The collapsible state (None, Collapsed, Expanded).
     */
    constructor(
        public label: string,
        public collapsibleState: number = 0
    ) {}
}

/**
 * Mock implementation of vscode.EventEmitter.
 */
export class MockEventEmitter<T = unknown> {
    public fire = vi.fn((_data?: T) => {
        return;
    });
    public event = vi.fn();
}

/**
 * Mock implementation of vscode.ThemeIcon.
 */
export class MockThemeIcon {
    /**
     * Initializes a new MockThemeIcon.
     * @param id The icon identifier.
     * @param color Optional theme color.
     */
    constructor(public id: string, public color?: unknown) {}
}

/**
 * Mock implementation of vscode.ThemeColor.
 */
export class MockThemeColor {
    /**
     * Initializes a new MockThemeColor.
     * @param id The theme color identifier.
     */
    constructor(public id: string) {}
}

/**
 * Mock implementation of vscode.MarkdownString.
 */
export class MockMarkdownString {
    public isTrusted?: boolean;
    public supportThemeIcons?: boolean;

    /**
     * Initializes a new MockMarkdownString.
     * @param value The initial markdown string value.
     */
    constructor(public value: string = '') {}
}

/**
 * Mock implementation of vscode.Position.
 */
export class MockPosition {
    /**
     * Initializes a new MockPosition.
     * @param line 0-based line index.
     * @param character 0-based character offset.
     */
    constructor(public line: number = 0, public character: number = 0) {}
}

/**
 * Mock implementation of vscode.Range.
 */
export class MockRange {
    /**
     * Initializes a new MockRange.
     * @param start The start position.
     * @param end The end position.
     */
    constructor(public start?: unknown, public end?: unknown) {}
}

/**
 * Mock implementation of vscode.WorkspaceEdit.
 */
export class MockWorkspaceEdit {
    public replace = vi.fn();
    public delete = vi.fn();
    public insert = vi.fn();
}

/**
 * Mock implementation of vscode.CancellationTokenSource.
 */
export class MockCancellationTokenSource {
    public token = {
        isCancellationRequested: false,
        onCancellationRequested: vi.fn()
    };
    public cancel = vi.fn();
    public dispose = vi.fn();
}

/**
 * Collapsible state enumeration for tree items.
 */
export const TreeItemCollapsibleState = {
    None: 0,
    Collapsed: 1,
    Expanded: 2
};

/**
 * Progress location enumeration for withProgress.
 */
export const ProgressLocation = {
    SourceControl: 1,
    Window: 10,
    Notification: 15
};

/**
 * Recursively merges two objects, applying property descriptors or values key by key.
 *
 * @param target The base target object.
 * @param source The source object containing overrides.
 * @returns The merged object.
 */
function deepMerge<T extends Record<string, unknown>>(target: T, source?: Record<string, unknown>): T {
    if (!source) {
        return target;
    }
    const result: Record<string, unknown> = { ...target };
    for (const key of Object.keys(source)) {
        const desc = Object.getOwnPropertyDescriptor(source, key);
        if (desc && (desc.get || desc.set)) {
            Object.defineProperty(result, key, desc);
            continue;
        }
        const srcVal = source[key];
        const tgtVal = result[key];
        if (
            srcVal !== null &&
            typeof srcVal === 'object' &&
            !Array.isArray(srcVal) &&
            tgtVal !== null &&
            typeof tgtVal === 'object' &&
            !Array.isArray(tgtVal)
        ) {
            result[key] = deepMerge(
                tgtVal as Record<string, unknown>,
                srcVal as Record<string, unknown>
            );
        } else {
            result[key] = srcVal;
        }
    }
    return result as T;
}

/**
 * Creates a fresh vscode mock object with standard stubs and deep-merged overrides.
 *
 * @param overrides Optional partial or full overrides to merge into the mock object.
 * @returns A fresh vscode mock object.
 */
export function createVscodeMock(overrides?: Record<string, unknown>): Record<string, unknown> {
    const baseMock: Record<string, unknown> = {
        TreeItem: MockTreeItem,
        TreeItemCollapsibleState: {
            None: 0,
            Collapsed: 1,
            Expanded: 2
        },
        EventEmitter: MockEventEmitter,
        ThemeIcon: MockThemeIcon,
        ThemeColor: MockThemeColor,
        MarkdownString: MockMarkdownString,
        Position: MockPosition,
        Range: MockRange,
        WorkspaceEdit: MockWorkspaceEdit,
        CancellationTokenSource: MockCancellationTokenSource,
        ProgressLocation: {
            SourceControl: 1,
            Window: 10,
            Notification: 15
        },
        Uri: {
            file: vi.fn((p: string) => ({
                scheme: 'file',
                fsPath: p,
                toString: () => p
            })),
            parse: vi.fn((u: string) => {
                if (typeof u === 'string' && u.includes('throw-parse-error')) {
                    throw new Error('URI parse error');
                }
                return {
                    scheme: typeof u === 'string' && u.startsWith('untitled:') ? 'untitled' : 'file',
                    fsPath: typeof u === 'string' ? u.replace(/^file:\/\//, '') : u,
                    toString: () => u
                };
            })
        },
        commands: {
            registerCommand: vi.fn(),
            executeCommand: vi.fn()
        },
        window: {
            createWebviewPanel: vi.fn(),
            showErrorMessage: vi.fn(),
            showWarningMessage: vi.fn(),
            showInformationMessage: vi.fn(),
            showTextDocument: vi.fn(),
            setStatusBarMessage: vi.fn(),
            registerTreeDataProvider: vi.fn(),
            showSaveDialog: vi.fn(),
            showOpenDialog: vi.fn(),
            createOutputChannel: vi.fn(() => ({
                appendLine: vi.fn(),
                show: vi.fn(),
                dispose: vi.fn()
            })),
            registerCustomEditorProvider: vi.fn(),
            withProgress: vi.fn(),
            terminals: []
        },
        workspace: {
            workspaceFolders: [
                {
                    uri: { fsPath: '/workspace', toString: () => '/workspace' },
                    name: 'workspace'
                }
            ],
            textDocuments: [],
            openTextDocument: vi.fn(),
            applyEdit: vi.fn().mockResolvedValue(true),
            findFiles: vi.fn().mockResolvedValue([]),
            onDidChangeTextDocument: vi.fn().mockReturnValue({ dispose: vi.fn() }),
            getConfiguration: vi.fn(() => ({
                get: vi.fn(),
                has: vi.fn(),
                inspect: vi.fn(),
                update: vi.fn()
            }))
        },
        env: {
            openExternal: vi.fn()
        }
    };

    return deepMerge(baseMock, overrides);
}
