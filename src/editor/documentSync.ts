/** @fileoverview Document synchronization helpers for the custom Beam pipeline editor.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

import * as vscode from 'vscode';

/**
 * Synchronization state shared between BeamEditorProvider and handleMessages.
 * Tracks in-flight workspace edits to prevent echo loops when saving from canvas (Finding M4).
 */
export interface DocumentSyncState {
    isApplyingEdit: boolean;
    lastSavedContent: string | null;
}

/**
 * Safe wrapper around webview.postMessage (Finding M5).
 * 
 * Prevents throwing unhandled exceptions when late-returning async callbacks
 * (e.g. gcloud, bq CLI executions) attempt to post messages to a webview
 * whose panel has already been disposed.
 * 
 * @param webview Webview instance to post messages to
 * @param isDisposed Predicate returning boolean indicating if the panel has been disposed
 * @returns Safe post function that returns false when disposed instead of throwing
 */
export function createSafePostMessage(
    webview: { postMessage: (msg: any) => ReturnType<vscode.Webview['postMessage']> | boolean },
    isDisposed: () => boolean
): (msg: any) => boolean {
    return (msg: any): boolean => {
        // NOTE: Guard against posting to disposed panel to prevent unhandled exceptions
        if (isDisposed()) {
            return false;
        }
        try {
            webview.postMessage(msg);
            return true;
        } catch (err) {
            console.warn('[postToWebview] Failed to post message to webview:', err);
            return false;
        }
    };
}

/**
 * Pure decision helper for finding M4 echo suppression.
 * 
 * Determines whether an onDidChangeTextDocument event should trigger a push to the webview.
 * Returns false if:
 * 1. The extension itself is actively applying a WorkspaceEdit originating from the webview canvas.
 * 2. The current document content matches the last content written from the webview canvas.
 * Returns true if the change originated from an external edit (e.g. user editing in text editor tab).
 * 
 * @param isApplyingEdit Flag indicating if an edit initiated by the canvas is currently being applied
 * @param currentContent The latest text content of the TextDocument
 * @param lastSavedContent The last content written or received from the canvas
 * @returns boolean indicating whether the content should be pushed to the webview
 */
export function shouldPushDocumentUpdate(
    isApplyingEdit: boolean,
    currentContent: string,
    lastSavedContent: string | null
): boolean {
    // Suppress if the change originated from our own active WorkspaceEdit
    if (isApplyingEdit) {
        return false;
    }
    // Suppress if the document content is identical to what we last saved
    if (lastSavedContent !== null && currentContent === lastSavedContent) {
        return false;
    }
    return true;
}
