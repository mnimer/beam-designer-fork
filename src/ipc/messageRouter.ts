/** @fileoverview IPC message router and command dispatching for designer webview.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

import * as vscode from 'vscode';
import { DocumentSyncState, createSafePostMessage } from '../editor/documentSync';
import { EditorSession } from '../editor/EditorSession';
import { getDesignerOutputChannel } from '../core/outputChannel';
import { MessageContext, MessageHandler } from './messageContext';
import { extractRequestParams, REQUEST_PARAMS_FIELD } from '../shared/requestParams';
import type { HostToWebviewMessage, WebviewToHostCommand } from '../shared/protocol';
import {
    handleGetDatasets,
    handleGetTables,
    handleGetTopics,
    handleGetSubscriptions,
    handleGetNetworks,
    handleGetSubnetworks,
    handleGetStorageBuckets,
    handleGetSecrets,
    handleGetHealthcareDatasets,
    handleGetAwsQueues,
    handleGetComputeInstances,
    handleGetBigtableInstances,
    handleGetBigtableTables,
    handleGetSqlInstances,
    handleGetSqlDatabases,
    handleGetProjects,
    handleGetRunningJobs,
} from './handlers/discoveryHandlers';
import {
    handleReady,
    handleGetSamples,
    handleOpenSample,
    handleSavePipeline,
    handlePickFolder,
    handleReadFolderFiles,
    handleReadFileContent,
    handleShowOutputChannel,
    handleOpenExternal,
} from './handlers/workspaceHandlers';
import {
    handleRunPipeline,
    handleStopPipeline,
    handleStopCodeGeneration,
    handleRegenerateCodeCommand,
} from './handlers/executionHandlers';

/**
 * Registry mapping command strings to individual message handlers.
 */
export const MESSAGE_HANDLERS: Record<string, MessageHandler> = {
    getDatasets: handleGetDatasets,
    getTables: handleGetTables,
    getTopics: handleGetTopics,
    getSubscriptions: handleGetSubscriptions,
    getNetworks: handleGetNetworks,
    getSubnetworks: handleGetSubnetworks,
    getStorageBuckets: handleGetStorageBuckets,
    getSecrets: handleGetSecrets,
    getHealthcareDatasets: handleGetHealthcareDatasets,
    getAwsQueues: handleGetAwsQueues,
    getComputeInstances: handleGetComputeInstances,
    getBigtableInstances: handleGetBigtableInstances,
    getBigtableTables: handleGetBigtableTables,
    getSqlInstances: handleGetSqlInstances,
    getSqlDatabases: handleGetSqlDatabases,
    getProjects: handleGetProjects,
    ready: handleReady,
    getSamples: handleGetSamples,
    openSample: handleOpenSample,
    savePipeline: handleSavePipeline,
    pickFolder: handlePickFolder,
    readFolderFiles: handleReadFolderFiles,
    readFileContent: handleReadFileContent,
    showOutputChannel: handleShowOutputChannel,
    getRunningJobs: handleGetRunningJobs,
    openExternal: handleOpenExternal,
    runPipeline: handleRunPipeline,
    stopPipeline: handleStopPipeline,
    stopCodeGeneration: handleStopCodeGeneration,
    regenerateCode: handleRegenerateCodeCommand,
    // M4: the compiler rejects a missing or extra command relative to the protocol.
} satisfies Record<WebviewToHostCommand, MessageHandler>;

/**
 * Asset discovery commands whose responses carry the originating request's
 * parameters (F11), so a listener can ignore responses to a different request.
 */
export const ASSET_REQUEST_COMMANDS: ReadonlySet<string> = new Set([
    'getDatasets',
    'getTables',
    'getTopics',
    'getSubscriptions',
    'getNetworks',
    'getSubnetworks',
    'getStorageBuckets',
    'getSecrets',
    'getHealthcareDatasets',
    'getAwsQueues',
    'getComputeInstances',
    'getBigtableInstances',
    'getBigtableTables',
    'getSqlInstances',
    'getSqlDatabases',
    'getProjects',
]);

/**
 * Returns a context whose `postToWebview` adds the request's parameters to
 * every posted message under `requestParams`. The original context is left
 * as is; the wrapper inherits its other members (including lazy getters)
 * through the prototype chain.
 *
 * @param ctx The panel's message context.
 * @param message The request message being handled.
 * @returns A derived context for this single request.
 */
export function withRequestParamsEcho(ctx: MessageContext, message: unknown): MessageContext {
    const requestParams = extractRequestParams(message);
    const wrapped: MessageContext = Object.create(ctx);
    wrapped.postToWebview = (msg: HostToWebviewMessage) =>
        ctx.postToWebview({ ...msg, [REQUEST_PARAMS_FIELD]: requestParams } as HostToWebviewMessage);
    return wrapped;
}

/**
 * Handles incoming IPC messages from the Webview frontend.
 * Dispatches commands through the MESSAGE_HANDLERS registry.
 * Provides safe parameter handling, non-blocking shell executions, and lifecycle-safe messaging.
 * 
 * @param webview Webview instance to post messages to
 * @param context Extension context
 * @param document Active TextDocument for .beam file if open in CustomTextEditor
 * @param uri URI of the .beam file
 * @param pipelineName Pipeline name
 * @param isDisposed Callback returning whether the panel has been disposed (M5)
 * @param syncState Shared edit synchronization state for echo suppression (M4)
 * @param session Per-panel lifecycle state; owned and disposed by the caller.
 *     When omitted, handlers share a fallback session.
 */
export function handleMessages(
    webview: vscode.Webview,
    context: vscode.ExtensionContext,
    document?: vscode.TextDocument,
    uri?: vscode.Uri,
    pipelineName?: string,
    isDisposed: () => boolean = () => false,
    syncState?: DocumentSyncState,
    session?: EditorSession
) {
    const postToWebview = createSafePostMessage(webview, isDisposed);

    const ctx: MessageContext = {
        context,
        document,
        uri,
        webview,
        postToWebview,
        syncState,
        pipelineName,
        session,
        get outputChannel() {
            return getDesignerOutputChannel();
        }
    };

    return async (message: any) => {
        // NOTE: this guard is new in the A1 refactor. The previous code read
        // `message.command` directly, so a null/undefined message threw a TypeError
        // inside an async handler and surfaced as an unhandled rejection. Malformed
        // input on an IPC boundary should not be able to do that, so it is ignored
        // here instead. A non-object message already behaved as a no-op before (no
        // case matched), so only the null/undefined path changes.
        if (!message || typeof message !== 'object') {
            return;
        }
        const handler = MESSAGE_HANDLERS[message.command];
        if (handler) {
            // F11: asset responses echo their request parameters so the webview
            // can drop out-of-order responses meant for a different request.
            const handlerCtx = ASSET_REQUEST_COMMANDS.has(message.command)
                ? withRequestParamsEcho(ctx, message)
                : ctx;
            await handler(handlerCtx, message);
        }
    };
}
