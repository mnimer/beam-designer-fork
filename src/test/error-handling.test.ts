/**
 * Global Error Handling Unit Tests
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Unit tests validating uncaughtException and unhandledRejection handling,
 * ensuring complete coverage across standard, extreme, and failure conditions.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as vscode from 'vscode';
import {
    handleUncaughtException,
    handleUnhandledRejection,
    registerGlobalErrorHandlers
} from '../extension';

// Mock vscode module
vi.mock('vscode', () => {
    return {
        window: {
            createOutputChannel: vi.fn().mockReturnValue({
                appendLine: vi.fn(),
                show: vi.fn(),
                dispose: vi.fn()
            }),
            registerTreeDataProvider: vi.fn(),
            registerCustomEditorProvider: vi.fn()
        },
        workspace: {
            workspaceFolders: [],
            findFiles: vi.fn().mockResolvedValue([]),
            onDidRenameFiles: vi.fn().mockReturnValue({ dispose: vi.fn() })
        },
        commands: {
            registerCommand: vi.fn().mockReturnValue({ dispose: vi.fn() }),
            executeCommand: vi.fn()
        },
        TreeItem: class MockTreeItem {
            constructor(public label: string, public collapsibleState: number = 0) {}
        },
        TreeItemCollapsibleState: {
            None: 0,
            Collapsed: 1,
            Expanded: 2
        },
        EventEmitter: class MockEventEmitter {
            public fire = vi.fn();
            public event = vi.fn();
        },
        ThemeIcon: class MockThemeIcon {
            constructor(public id: string, public color?: any) {}
        },
        ThemeColor: class MockThemeColor {
            constructor(public id: string) {}
        },
        MarkdownString: class MockMarkdownString {
            constructor(public value: string) {}
        },
        Uri: {
            file: (f: string) => ({ fsPath: f, path: f, scheme: 'file' }),
            parse: (s: string) => ({ fsPath: s, path: s, scheme: 'https' })
        }
    };
});

describe('Global Error Handling', () => {
    let consoleErrorSpy: any;

    beforeEach(() => {
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('handleUncaughtException', () => {
        it('handles standard Error objects and logs to console.error', () => {
            const testErr = new Error('Database connection failed');
            handleUncaughtException(testErr);

            expect(consoleErrorSpy).toHaveBeenCalled();
            const logged = consoleErrorSpy.mock.calls[0][0];
            expect(logged).toContain('[CRITICAL][UncaughtException]');
            expect(logged).toContain('Database connection failed');
        });

        it('logs to a provided OutputChannel when available', () => {
            const mockChannel: any = { appendLine: vi.fn() };
            const testErr = new Error('Test channel output');
            handleUncaughtException(testErr, mockChannel as vscode.OutputChannel);

            expect(mockChannel.appendLine).toHaveBeenCalledTimes(1);
            expect(mockChannel.appendLine.mock.calls[0][0]).toContain('[CRITICAL][UncaughtException]');
            expect(mockChannel.appendLine.mock.calls[0][0]).toContain('Test channel output');
        });

        it('handles non-Error objects (strings, numbers, null, undefined) gracefully under extreme conditions', () => {
            // String error
            handleUncaughtException('Fatal unexpected string error');
            expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Fatal unexpected string error'));

            // Null error
            handleUncaughtException(null);
            expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('null'));

            // Undefined error
            handleUncaughtException(undefined);
            expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('undefined'));

            // Plain object
            handleUncaughtException({ code: 'ERR_FAIL', codeNum: 500 });
            expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('[object Object]'));
        });
    });

    describe('handleUnhandledRejection', () => {
        it('handles standard Error rejection reason and logs reason and promise', () => {
            const testReason = new Error('Async timeout occurred');
            const fakePromise = Promise.reject(testReason).catch(() => {});

            handleUnhandledRejection(testReason, fakePromise);

            expect(consoleErrorSpy).toHaveBeenCalled();
            const logged = consoleErrorSpy.mock.calls[0][0];
            expect(logged).toContain('[CRITICAL][UnhandledRejection]');
            expect(logged).toContain('Async timeout occurred');
            expect(consoleErrorSpy.mock.calls[0][1]).toBe(fakePromise);
        });

        it('logs to a provided OutputChannel when available', () => {
            const mockChannel: any = { appendLine: vi.fn() };
            const testReason = new Error('Network socket disconnected');
            handleUnhandledRejection(testReason, 'dummyPromise', mockChannel as vscode.OutputChannel);

            expect(mockChannel.appendLine).toHaveBeenCalledTimes(1);
            expect(mockChannel.appendLine.mock.calls[0][0]).toContain('[CRITICAL][UnhandledRejection]');
            expect(mockChannel.appendLine.mock.calls[0][0]).toContain('Network socket disconnected');
        });

        it('handles non-Error rejection values (string, null, undefined) under extreme conditions', () => {
            handleUnhandledRejection('Promise rejected with custom message', null);
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                expect.stringContaining('Promise rejected with custom message'),
                null
            );

            handleUnhandledRejection(null, undefined);
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                expect.stringContaining('null'),
                undefined
            );
        });
    });

    describe('registerGlobalErrorHandlers', () => {
        it('registers uncaughtException and unhandledRejection event listeners on process', () => {
            const processOnSpy = vi.spyOn(process, 'on');
            registerGlobalErrorHandlers();

            expect(processOnSpy).toHaveBeenCalledWith('uncaughtException', expect.any(Function));
            expect(processOnSpy).toHaveBeenCalledWith('unhandledRejection', expect.any(Function));
        });
    });
});

