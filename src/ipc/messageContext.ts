/** @fileoverview Type definitions for IPC message context and handlers.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

import * as vscode from 'vscode';
import { DocumentSyncState } from '../editor/documentSync';
import { EditorSession } from '../editor/EditorSession';
import type { HostToWebviewMessage } from '../shared/protocol';

/**
 * Context object holding dependencies and shared state passed to IPC message handlers.
 */
export interface MessageContext {
    context: vscode.ExtensionContext;
    document?: vscode.TextDocument;
    uri?: vscode.Uri;
    webview: vscode.Webview;
    /** Posts a typed protocol message to this panel's webview (no-op once disposed). */
    postToWebview: (msg: HostToWebviewMessage) => boolean | Promise<boolean>;
    syncState?: DocumentSyncState;
    pipelineName?: string;
    outputChannel?: vscode.OutputChannel;
    /**
     * Lifecycle state (runner process, generation abort) owned by the editor
     * panel that sent the message. Optional for callers that predate per-panel
     * sessions; those share a single fallback session.
     */
    session?: EditorSession;
}

/**
 * Handler function signature for webview IPC message dispatching.
 */
export type MessageHandler = (ctx: MessageContext, message: any) => Promise<void> | void;
