/** @fileoverview Custom text editor provider for visual .beam pipeline editing.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { buildWebviewHtml, getNonce } from '../webviewHtml';
import { computePipelineLocation } from './pipelineLocation';
import {
    DocumentSyncState,
    createSafePostMessage,
    shouldPushDocumentUpdate
} from './documentSync';
import { EditorSession } from './EditorSession';
import { handleMessages } from '../ipc/messageRouter';

/**
 * BeamEditorProvider
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Custom Text Editor provider for `.beam` visual pipeline design files in VS Code.
 * Coordinates bidirectional IPC message passing between the React Webview canvas
 * and host CLI tools (gcloud, bq), filesystem persistence, and Gemini code generation.
 * 
 * Architectural Decisions:
 * - Implements vscode.CustomTextEditorProvider for .beam YAML file synchronization.
 * - Handles CLI queries (BigQuery datasets/tables, PubSub topics/subscriptions, Secret Manager secrets, VPC networks/subnetworks).
 * - Dispatches 'getSecrets' via gcloud secrets list to support safe credential selection for streaming nodes like KinesisIO.
 * - Dispatches Gemini code generation requests and writes structured pipeline artifacts to disk.
 */
export class BeamEditorProvider implements vscode.CustomTextEditorProvider {
    /**
     * Creates an instance of BeamEditorProvider.
     *
     * @param context The extension context used for resource and subscription management.
     */
    constructor(private readonly context: vscode.ExtensionContext) { }

    /**
     * Resolves the custom text editor for a `.beam` document.
     * Initializes webview options, Content-Security-Policy (CSP) headers, asset URI resolution,
     * and bidirectional message handling between webview and extension host.
     * 
     * @param document The backing VS Code TextDocument.
     * @param webviewPanel The webview panel representing the editor.
     * @param _token Cancellation token.
     */
    public async resolveCustomTextEditor(
        document: vscode.TextDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken
    ): Promise<void> {
        const webview = webviewPanel.webview;
        const extensionPath = this.context.extensionPath;
        const distPath = path.join(extensionPath, 'webview', 'dist');

        const htmlPath = path.join(distPath, 'index.html');
        let htmlContent = '';
        if (fs.existsSync(htmlPath)) {
            const rawHtml = fs.readFileSync(htmlPath, 'utf-8');

            // Resolve paths to webview bundle assets
            const jsUri = webview.asWebviewUri(vscode.Uri.file(path.join(distPath, 'assets', 'index.js')));
            const cssUri = webview.asWebviewUri(vscode.Uri.file(path.join(distPath, 'assets', 'index.css')));
            const nonce = getNonce();

            // NOTE: buildWebviewHtml injects Content-Security-Policy with script nonce and asset paths (finding M2)
            // `webview.cspSource` is non-optional in the VS Code API. It is passed through
            // unguarded on purpose: buildWebviewHtml throws on an empty value, which is far
            // easier to diagnose than a silently substituted origin that would make every
            // stylesheet and image in the panel fail to load for no visible reason.
            htmlContent = buildWebviewHtml(rawHtml, {
                jsUri: jsUri.toString(),
                cssUri: cssUri.toString(),
                cspSource: webview.cspSource,
                nonce
            });
        }

        webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.file(path.join(this.context.extensionPath, 'webview', 'dist'))
            ]
        };

        webview.html = htmlContent;

        // M5: Track disposed state and collect subscriptions in disposables array for cleanup on panel dispose
        let isDisposed = false;
        const disposables: vscode.Disposable[] = [];

        // M4: Shared synchronization state to prevent echo loops between webview and document model
        const syncState: DocumentSyncState = {
            isApplyingEdit: false,
            lastSavedContent: null
        };

        // Dispose all registered subscriptions when the panel is closed
        webviewPanel.onDidDispose(() => {
            isDisposed = true;
            while (disposables.length > 0) {
                const item = disposables.pop();
                try {
                    item?.dispose();
                } catch (err) {
                    console.error('Error disposing webview resource:', err);
                }
            }
        });

        // Safe webview poster that drops messages once panel is disposed
        const postToWebview = createSafePostMessage(webview, () => isDisposed);

        // M4: Two-way synchronization - listen to external changes to the document and notify webview
        disposables.push(
            vscode.workspace.onDidChangeTextDocument((e) => {
                if (e.document.uri.toString() === document.uri.toString()) {
                    const currentText = e.document.getText();
                    if (shouldPushDocumentUpdate(syncState.isApplyingEdit, currentText, syncState.lastSavedContent)) {
                        // NOTE: Record pushed content so identical echo changes from canvas auto-save are ignored
                        syncState.lastSavedContent = currentText;

                        const { relativeFolder, defaultOutputFolder } = computePipelineLocation(
                            document.uri.fsPath,
                            vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
                        );

                        postToWebview({
                            command: 'loadPipeline',
                            data: currentText,
                            filename: path.basename(document.uri.fsPath),
                            relativeFolder,
                            defaultOutputFolder
                        });
                    }
                }
            })
        );

        // F1/F4: per-panel runner process and generation state. Disposed with the
        // panel so closing a tab stops its run and aborts its Gemini request.
        const session = new EditorSession();
        disposables.push(session);

        // M5: Store message listener disposable so it is cleaned up on panel dispose
        disposables.push(
            webview.onDidReceiveMessage(
                handleMessages(webview, this.context, document, undefined, undefined, () => isDisposed, syncState, session)
            )
        );
    }
}
