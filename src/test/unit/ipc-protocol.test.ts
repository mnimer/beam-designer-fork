/**
 * @fileoverview Tests for the typed host↔webview protocol (M4): the runtime
 * command list matches the handler registry, and the compiler rejects
 * malformed host→webview messages (checked by `tsc` via @ts-expect-error).
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

import { describe, it, expect, vi } from 'vitest';

vi.mock('vscode', async () => (await import('./helpers/vscodeMock')).createVscodeMock());

import { WEBVIEW_TO_HOST_COMMANDS, type HostToWebviewMessage } from '../../shared/protocol';
import { MESSAGE_HANDLERS, ASSET_REQUEST_COMMANDS } from '../../ipc/messageRouter';

describe('M4 — typed IPC protocol', () => {
    it('lists exactly the commands registered in MESSAGE_HANDLERS', () => {
        expect([...WEBVIEW_TO_HOST_COMMANDS].sort()).toEqual(Object.keys(MESSAGE_HANDLERS).sort());
    });

    it('lists each command once', () => {
        expect(new Set(WEBVIEW_TO_HOST_COMMANDS).size).toBe(WEBVIEW_TO_HOST_COMMANDS.length);
    });

    it('includes every asset request command', () => {
        const commands: readonly string[] = WEBVIEW_TO_HOST_COMMANDS;
        for (const command of ASSET_REQUEST_COMMANDS) {
            expect(commands).toContain(command);
        }
    });

    it('accepts well-formed messages and rejects malformed ones at compile time', () => {
        const ok: HostToWebviewMessage[] = [
            { command: 'pipelineLog', text: 'hello', stream: 'stdout' },
            { command: 'pipelineFinished', exitCode: 0, status: 'completed' },
            { command: 'tablesLoaded', tables: ['t1'], requestParams: { dataset: 'd' } },
            { command: 'codeGenerationStopped' },
        ];

        const bad: HostToWebviewMessage[] = [
            // @ts-expect-error misspelt command is not part of the protocol
            { command: 'pipelineLogg', text: 'x', stream: 'stdout' },
            // @ts-expect-error stream must be 'stdout' | 'stderr'
            { command: 'pipelineLog', text: 'x', stream: 'console' },
            // @ts-expect-error pipelineFinished requires a known status
            { command: 'pipelineFinished', exitCode: 1, status: 'crashed' },
            // @ts-expect-error fileContentLoaded requires content
            { command: 'fileContentLoaded', filePath: 'a.py' },
        ];

        expect(ok).toHaveLength(4);
        expect(bad).toHaveLength(4);
    });
});
