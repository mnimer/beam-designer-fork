import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ensureSystemCaBundle } from './codeGeneration';
import { getGcloudProject } from './cli/gcloudClient';
import { DataFlowTreeProvider } from './tree/dataflowTree';
import { BeamEditorProvider } from './editor/BeamEditorProvider';
import { promptForBeamSaveLocation } from './editor/beamSaveDialog';

export type { WebviewHtmlOptions } from './webviewHtml';
export {
    buildWebviewHtml,
    getNonce,
} from './webviewHtml';

/**
 * Apache Beam Designer Extension Main Entry Point
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Activates the VS Code extension for Apache Beam pipeline visual authoring.
 * Registers tree view providers, custom editor providers, commands, and IPC handlers
 * between the VS Code extension host and the webview designer canvas.
 * 
 * Architectural Decisions:
 * - Uses CustomTextEditorProvider (BeamEditorProvider) for two-way synchronization of .beam files.
 * - Bridges gcloud and bq CLI commands for real-time asset discovery (BigQuery datasets/tables,
 *   Pub/Sub topics/subscriptions, VPC networks/subnets, Cloud Storage buckets).
 * - Executes AI code generation via Google GenAI SDK (@google/genai).
 * - Provides non-blocking asynchronous IPC message dispatch to webview.
 * 
 * @param context The extension context provided by VS Code
 */
import { getDesignerOutputChannel } from './core/outputChannel';

export {
    BEAM_EDITOR_VIEW_TYPE,
    getInitialPipelineContent,
    PIPELINE_SEARCH_EXCLUDE_DIRS,
    PIPELINE_SEARCH_EXCLUDE_PATTERN,
    GENERATED_FILE_LIST_EXCLUDE_DIRS,
} from './core/constants';
import {
    BEAM_EDITOR_VIEW_TYPE,
    getInitialPipelineContent,
    PIPELINE_SEARCH_EXCLUDE_PATTERN,
} from './core/constants';

export {
    DEFAULT_IGNORE_PATTERNS,
    getDefaultIgnoreFileContent,
    readResourceFile
} from './resources/resourceLoader';

/**
 * Activates the Apache Beam Designer extension.
 *
 * @param context The extension context used to register providers and subscriptions.
 */
export function activate(context: vscode.ExtensionContext) {
    // Ensure both https.globalAgent and native fetch (tls.createSecureContext) trust the system CA bundle
    ensureSystemCaBundle();

    console.log('Apache Beam Pipeline Builder is now active!');
    const outputChannel = getDesignerOutputChannel();
    context.subscriptions.push(outputChannel);
    outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] Apache Beam Designer initialized.`);

    const treeDataProvider = new DataFlowTreeProvider();
    vscode.window.registerTreeDataProvider('dataflowExplorer', treeDataProvider);

    context.subscriptions.push(
        vscode.window.registerCustomEditorProvider(
            BEAM_EDITOR_VIEW_TYPE,
            new BeamEditorProvider(context),
            {
                webviewOptions: {
                    retainContextWhenHidden: true
                },
                supportsMultipleEditorsPerDocument: false
            }
        )
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('dataflow-pipeline-builder.openWithDesigner', async (uri?: vscode.Uri) => {
            const targetUri = uri || vscode.window.activeTextEditor?.document.uri;
            if (targetUri) {
                await vscode.commands.executeCommand('vscode.openWith', targetUri, 'dataflow-pipeline-builder.beamEditor');
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('dataflow-pipeline-builder.createNewPipeline', async () => {
            const fileUri = await promptForBeamSaveLocation('Create New Apache Beam Pipeline', 'pipeline');

            if (!fileUri) {
                return; // User cancelled
            }

            const initialContent = getInitialPipelineContent();

            fs.writeFileSync(fileUri.fsPath, initialContent, 'utf-8');
            treeDataProvider.refresh();
            await vscode.commands.executeCommand('vscode.openWith', fileUri, BEAM_EDITOR_VIEW_TYPE);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('dataflow-pipeline-builder.refreshPipelines', () => {
            treeDataProvider.refresh();
        })
    );

    /*
     * `DataFlow: Show Editor` opens a pipeline in the custom editor.
     *
     * FIXME(history): this used to dispatch to 'dataflow-pipeline-builder.openPipeline',
     * which is never registered anywhere in this extension. The command is advertised in
     * the Command Palette, so invoking it always failed with "command not found". It now
     * resolves a real .beam file and opens it through the same `vscode.openWith` path the
     * tree view uses.
     */
    context.subscriptions.push(
        vscode.commands.registerCommand('dataflow-pipeline-builder.showEditor', async () => {
            // Prefer whatever the user is already looking at.
            const activeUri = vscode.window.activeTextEditor?.document.uri;
            if (activeUri?.fsPath.endsWith('.beam')) {
                await vscode.commands.executeCommand('vscode.openWith', activeUri, BEAM_EDITOR_VIEW_TYPE);
                return;
            }

            // Otherwise look for pipelines in the workspace, honouring the same exclude
            // pattern the tree view uses so we do not surface files from node_modules.
            const files = await vscode.workspace.findFiles('**/*.beam', PIPELINE_SEARCH_EXCLUDE_PATTERN);
            if (files.length === 0) {
                vscode.window.showInformationMessage(
                    'No .beam pipelines found in this workspace. Use "Beam: New Pipeline" to create one.'
                );
                return;
            }

            if (files.length === 1) {
                await vscode.commands.executeCommand('vscode.openWith', files[0], BEAM_EDITOR_VIEW_TYPE);
                return;
            }

            // More than one candidate: let the user choose rather than guessing.
            const picked = await vscode.window.showQuickPick(
                files.map(f => ({
                    label: path.basename(f.fsPath),
                    description: vscode.workspace.asRelativePath(f),
                    uri: f,
                })),
                { title: 'Open Beam Pipeline', placeHolder: 'Select a pipeline to open' }
            );
            if (picked) {
                await vscode.commands.executeCommand('vscode.openWith', picked.uri, BEAM_EDITOR_VIEW_TYPE);
            }
        })
    );

    // Refresh tree view on file rename or move
    context.subscriptions.push(
        vscode.workspace.onDidRenameFiles(_e => {
            treeDataProvider.refresh();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('dataflow-pipeline-builder.openJobInConsole', async (job: any, project?: string) => {
            if (!job || !job.id) return;
            const loc = job.location || 'us-central1';
            let proj = project;
            if (!proj || proj === 'YOUR_PROJECT_ID') {
                proj = await getGcloudProject();
            }
            const url = `https://console.cloud.google.com/dataflow/jobs/${loc}/${job.id}${proj ? `?project=${proj}` : ''}`;
            vscode.env.openExternal(vscode.Uri.parse(url));
        })
    );
}

export type { DataflowJob } from './tree/dataflowTree';
export {
    categorizeJobStatus,
    getJobStartTime,
    DataFlowTreeProvider,
    DataItem,
} from './tree/dataflowTree';

/**
 * Deactivates the Apache Beam Designer extension and disposes resources.
 */
export function deactivate() { }

export { findLastCompleteFileEndOffset, parseOrRepairJson } from './codegen/jsonRepair';

export { findExecutableInPath, resolveCli, findGcloudPath } from './cli/cliResolver';
export type { SecretManagerItem } from './cli/resourceMappers';
export {
    toShortSecretId,
    mapSecretManagerItems,
    parseSecretManagerOutput,
    mapBigtableInstances,
    mapBigtableTables,
    mapSqlInstances,
    mapSqlDatabases,
    mapProjects,
    parseBigtableInstanceParam,
    parseSqlInstanceParam,
    mapHealthcareDatasetItems
} from './cli/resourceMappers';
export { listAssets, getGcloudProject } from './cli/gcloudClient';

export {
    SamplePipeline,
    formatSampleTitle,
    computePipelineFlow,
    getSamplePipelines
} from './samples/samplePipelineService';



/**
 * Directory names, system paths, and dependency folders to ignore during file tree scans and cleanup.
 */
export const IGNORED_DIRECTORY_NAMES = new Set([
    'venv',
    '.venv',
    'env',
    '.env',
    'virtualenv',
    '.virtualenv',
    'node_modules',
    '__pycache__',
    'target',
    'build',
    'dist',
    'out',
    'bin',
    'site-packages',
    'dist-packages',
    '.pytest_cache',
    '.mypy_cache',
    '.ruff_cache',
    '.tox',
    '.nox',
    '.eggs',
    '.git',
    '.github',
    '.idea',
    '.vscode'
]);

/**
 * Checks if a given relative or absolute file path belongs to an ignored directory,
 * virtual environment, or hidden cache structure.
 */
export function isIgnoredPath(fileNameOrPath: string): boolean {
    if (!fileNameOrPath) return true;
    const parts = fileNameOrPath.toLowerCase().replace(/\\/g, '/').split('/');
    return parts.some(part => {
        if (!part) return false;
        if (part === '.dockerignore' || part === '.gcloudignore') return false;
        if (IGNORED_DIRECTORY_NAMES.has(part)) return true;
        if (part.startsWith('.') || part.endsWith('.egg-info')) return true;
        return false;
    });
}

export {
    resolvePipelineId,
    gateOutputFolder,
    executeScopedCleanup,
    writeGenerationManifest,
} from './generation/outputFolderGate';

export {
    ALLOWED_EXECUTABLE_SCRIPTS,
    isAllowedExecutableScript,
    resolveSafeOutputPath,
    SHELL_METASYMBOLS_REGEX,
    isSafeFolderPath,
    terminalCwdMatches,
} from './security/scriptGuard';




export type { DocumentSyncState } from './editor/documentSync';
export { createSafePostMessage, shouldPushDocumentUpdate } from './editor/documentSync';
export { savePipelineFiles } from './editor/pipelineFileWriter';
export { BeamEditorProvider } from './editor/BeamEditorProvider';

export { getDesignerOutputChannel, disposeDesignerOutputChannel } from './core/outputChannel';

export type { MessageContext, MessageHandler } from './ipc/messageContext';
export {
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
} from './ipc/handlers/discoveryHandlers';
export {
    handleReady,
    handleGetSamples,
    handleOpenSample,
    handleSavePipeline,
    handlePickFolder,
    handleReadFolderFiles,
    handleReadFileContent,
    handleShowOutputChannel,
    handleOpenExternal,
} from './ipc/handlers/workspaceHandlers';
export {
    handleRunPipeline,
    handleStopPipeline,
    handleStopCodeGeneration,
    handleRegenerateCodeCommand,
} from './ipc/handlers/executionHandlers';
export {
    MESSAGE_HANDLERS,
    handleMessages,
} from './ipc/messageRouter';


