/** @fileoverview Workspace, filesystem, and sample pipeline IPC message handlers.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import {
    BEAM_EDITOR_VIEW_TYPE,
    GENERATED_FILE_LIST_EXCLUDE_DIRS
} from '../../core/constants';
import { getDesignerOutputChannel } from '../../core/outputChannel';
import { isAllowedExternalUri } from '../../security/uriGuard';
import { isSubPath } from '../../security/pathGuard';
import { computePipelineLocation } from '../../editor/pipelineLocation';
import { getGcloudProjectCached } from '../../cli/gcloudClient';
import { getSamplePipelines } from '../../samples/samplePipelineService';
import { savePipelineFiles } from '../../editor/pipelineFileWriter';
import { promptForBeamSaveLocation } from '../../editor/beamSaveDialog';
import { MessageContext } from '../messageContext';
import type { TokenUsage } from '../../shared/types';

/**
 * Handler for 'ready' command.
 * Pushes the pipeline document to the webview, then resolves the default GCP project.
 *
 * P9 ordering contract -- `loadPipeline` is posted FIRST and synchronously:
 * - The document text is already in memory; nothing about rendering the canvas depends on
 *   gcloud or on the sample catalogue. Previously both were awaited ahead of `loadPipeline`,
 *   so the nodes were held behind a 1–5 s `gcloud config get-value project` spawn.
 * - Samples are NOT loaded here. The webview requests them separately with `getSamples`
 *   on mount, so doing it in `ready` as well was a duplicate read+parse of every sample.
 * - The default project is delivered afterwards as `projectIdResolved` (cached, see
 *   `getGcloudProjectCached`), and the webview applies it only if the user has not already
 *   chosen a project in the meantime.
 *
 * @param ctx Message context
 * @param _message Incoming IPC message (unused)
 */
export async function handleReady(ctx: MessageContext, _message: any): Promise<void> {
    const activeUri = ctx.document ? ctx.document.uri : ctx.uri;
    let relativeFolder = '';
    let defaultOutputFolder = '';
    if (activeUri) {
        ({ relativeFolder, defaultOutputFolder } = computePipelineLocation(
            activeUri.fsPath,
            vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
        ));
    }

    if (ctx.document) {
        if (ctx.syncState) {
            ctx.syncState.lastSavedContent = ctx.document.getText();
        }
        ctx.postToWebview({
            command: 'loadPipeline',
            data: ctx.document.getText(),
            filename: path.basename(ctx.document.uri.fsPath),
            relativeFolder: relativeFolder,
            defaultOutputFolder: defaultOutputFolder
        });
    } else if (ctx.uri && fs.existsSync(ctx.uri.fsPath)) {
        const content = fs.readFileSync(ctx.uri.fsPath, 'utf-8');
        ctx.postToWebview({
            command: 'loadPipeline',
            data: content,
            filename: ctx.pipelineName,
            relativeFolder: relativeFolder,
            defaultOutputFolder: defaultOutputFolder
        });
    } else {
        ctx.postToWebview({
            command: 'loadPipeline',
            data: null,
            filename: ctx.pipelineName,
            relativeFolder: relativeFolder,
            defaultOutputFolder: defaultOutputFolder
        });
    }

    // Off the critical path: the canvas is already rendering by the time this resolves.
    const projectId = await getGcloudProjectCached();
    ctx.postToWebview({ command: 'projectIdResolved', projectId });
}

/**
 * Handler for 'getSamples' command.
 * Fetches sample pipelines and posts them to the webview.
 *
 * @param ctx Message context
 * @param _message Incoming IPC message (unused)
 */
export async function handleGetSamples(ctx: MessageContext, _message: any): Promise<void> {
    const requestedSamples = await getSamplePipelines(ctx.context);
    ctx.postToWebview({
        command: 'samplesLoaded',
        samples: requestedSamples
    });
}

/**
 * Handler for 'openSample' command.
 * Prompts user to save sample pipeline to disk and opens it in the custom beam editor.
 *
 * @param ctx Message context
 * @param message Incoming IPC message with sample content or filename
 */
export async function handleOpenSample(ctx: MessageContext, message: any): Promise<void> {
    let sampleContent = message.content;
    let sampleFilename = message.filename || 'sample-pipeline.beam';
    if (!sampleFilename.endsWith('.beam')) {
        sampleFilename += '.beam';
    }

    if (!sampleContent && message.filename) {
        const available = await getSamplePipelines(ctx.context);
        const found = available.find(s => s.filename === message.filename);
        if (found) {
            sampleContent = found.content;
        }
    }

    if (sampleContent) {
        try {
            // Pop up the Save dialog automatically for the user with .beam filter
            const fileUri = await promptForBeamSaveLocation('Save Sample Pipeline', sampleFilename);

            if (!fileUri) {
                return; // User cancelled the save dialog
            }

            // Write sample pipeline content to selected location
            fs.writeFileSync(fileUri.fsPath, sampleContent, 'utf-8');

            // Refresh tree explorer and open in the visual custom beam editor
            vscode.commands.executeCommand('dataflow-pipeline-builder.refreshPipelines');
            await vscode.commands.executeCommand('vscode.openWith', fileUri, BEAM_EDITOR_VIEW_TYPE);
        } catch (err: any) {
            console.error('Failed to save and open sample pipeline:', err);
            vscode.window.showErrorMessage(`Failed to open sample pipeline: ${err.message}`);
        }
    }
}

/**
 * Handler for 'savePipeline' command.
 * Prompts for location if untitled, saves pipeline files, and refreshes pipeline tree.
 *
 * @param ctx Message context
 * @param message Incoming IPC message with pipeline code and configuration
 */
export async function handleSavePipeline(ctx: MessageContext, message: any): Promise<void> {
    let targetUri = ctx.document ? ctx.document.uri : ctx.uri;
    if (!targetUri || targetUri.scheme === 'untitled') {
        const chosenUri = await promptForBeamSaveLocation('Save Apache Beam Pipeline', 'pipeline');
        if (!chosenUri) {
            return;
        }
        targetUri = chosenUri;
    }

    await savePipelineFiles(
        targetUri,
        message.data,
        message.code,
        message.fileExtension,
        message.outputFolder,
        message.requirements,
        message.dockerfile,
        message.runScript,
        message.runDataflowScript,
        message.dockerIgnore,
        message.gcloudIgnore,
        ctx.syncState
    );
    vscode.window.setStatusBarMessage(`Saved ${path.basename(targetUri.fsPath)} and generated files`, 2000);
    vscode.commands.executeCommand('dataflow-pipeline-builder.refreshPipelines');
}

/**
 * Handler for 'pickFolder' command.
 * Opens folder chooser dialog and reports selected folder path to webview.
 *
 * @param ctx Message context
 * @param _message Incoming IPC message (unused)
 */
export async function handlePickFolder(ctx: MessageContext, _message: any): Promise<void> {
    const uris = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        title: 'Select Output Folder'
    });
    if (uris && uris.length > 0) {
        let selectedPath = uris[0].fsPath;
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (workspaceFolder && isSubPath(workspaceFolder, selectedPath)) {
            selectedPath = path.relative(workspaceFolder, selectedPath);
        }
        ctx.postToWebview({
            command: 'folderSelected',
            path: selectedPath
        });
    }
}

/**
 * Handler for 'readFolderFiles' command.
 * Scans a folder recursively and returns relative paths of all files.
 * Ignores dotfiles, dependency folders, build outputs, and symbolic links (symlink guard).
 *
 * @param ctx Message context
 * @param message Incoming IPC message with optional folderPath
 */
export async function handleReadFolderFiles(ctx: MessageContext, message: any): Promise<void> {
    let folderPath = message.folderPath;
    const activeUriForFolder = ctx.document ? ctx.document.uri : ctx.uri;
    if (!folderPath && activeUriForFolder) {
        const baseName = path.basename(activeUriForFolder.fsPath, '.beam');
        folderPath = path.join(path.dirname(activeUriForFolder.fsPath), baseName);
    } else if (folderPath && !path.isAbsolute(folderPath)) {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (workspaceFolder) {
            folderPath = path.join(workspaceFolder, folderPath);
        }
    }
    // NOTE: inherently TOCTOU directory check
    const folderExists = folderPath
        ? await fs.promises.stat(folderPath).then(s => s.isDirectory()).catch(() => false)
        : false;
    if (folderPath && folderExists) {
        try {
            const excludedDirs = new Set(GENERATED_FILE_LIST_EXCLUDE_DIRS);
            const getFilesRecursively = async (dir: string, baseDir: string = dir): Promise<string[]> => {
                let results: string[] = [];
                const list = await fs.promises.readdir(dir);
                for (const item of list) {
                    if (item === 'gemini.log') continue;
                    if (item.startsWith('.') && item !== '.dockerignore' && item !== '.gcloudignore' && item !== '.gitignore') continue;
                    const fullPath = path.join(dir, item);
                    const stat = await fs.promises.lstat(fullPath);
                    if (stat.isSymbolicLink()) continue;
                    if (stat.isDirectory()) {
                        // Skip dependency and build directories. Running a generated Python
                        // pipeline creates `venv/` (thousands of files) and Maven creates
                        // `target/`; without this the Source Code tab lists those instead of
                        // the handful of files the generator actually produced.
                        if (excludedDirs.has(item)) continue;
                        const nested = await getFilesRecursively(fullPath, baseDir);
                        results = results.concat(nested);
                    } else if (stat.isFile()) {
                        const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
                        results.push(relPath);
                    }
                }
                return results;
            };
            const files = await getFilesRecursively(folderPath);
            let tokenUsage: TokenUsage | undefined;
            try {
                const logFilePath = path.join(folderPath, 'gemini.log');
                if (fs.existsSync(logFilePath)) {
                    const logContent = JSON.parse(await fs.promises.readFile(logFilePath, 'utf-8'));
                    if (logContent && logContent.tokenUsage && typeof logContent.tokenUsage === 'object' && logContent.tokenUsage !== 'Unavailable') {
                        tokenUsage = {
                            inputTokens: Number(logContent.tokenUsage.inputTokens) || 0,
                            outputTokens: Number(logContent.tokenUsage.outputTokens) || 0,
                            totalTokens: Number(logContent.tokenUsage.totalTokens) || 0,
                        };
                    }
                }
            } catch {
                // Ignore missing or corrupt gemini.log
            }
            ctx.postToWebview({
                command: 'folderFilesRead',
                files: files,
                folderPath: folderPath,
                tokenUsage: tokenUsage
            });
        } catch (e) {
            console.error('Failed to read folder files', e);
            ctx.postToWebview({
                command: 'folderFilesRead',
                files: [],
                folderPath: folderPath
            });
        }
    } else {
        ctx.postToWebview({
            command: 'folderFilesRead',
            files: [],
            folderPath: folderPath
        });
    }
}

/**
 * Handler for 'readFileContent' command.
 * Reads contents of a specified file within folder boundary and posts to webview.
 * Validates lexical containment and resolves canonical paths to prevent symlink escapes.
 * Reports fileContentError to the webview on any failure.
 *
 * @param ctx Message context
 * @param message Incoming IPC message with folderPath and filePath
 */
export async function handleReadFileContent(ctx: MessageContext, message: any): Promise<void> {
    let readFolder = message.folderPath;

    const activeUriForRead = ctx.document ? ctx.document.uri : ctx.uri;
    if (!readFolder && activeUriForRead) {
        const baseName = path.basename(activeUriForRead.fsPath, '.beam');
        readFolder = path.join(path.dirname(activeUriForRead.fsPath), baseName);
    } else if (readFolder && !path.isAbsolute(readFolder)) {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (workspaceFolder) {
            readFolder = path.join(workspaceFolder, readFolder);
        }
    }

    if (readFolder && message.filePath && typeof message.filePath === 'string') {
        const resolvedReadFolder = path.resolve(readFolder);
        const fullFilePath = path.resolve(
            path.isAbsolute(message.filePath)
                ? message.filePath
                : path.join(resolvedReadFolder, message.filePath)
        );

        const relativePath = path.relative(resolvedReadFolder, fullFilePath);
        if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
            console.error(`Blocked attempt to read file outside folder: ${fullFilePath}`);
            ctx.postToWebview({
                command: 'fileContentError',
                filePath: message.filePath,
                error: 'Blocked attempt to read file outside folder'
            });
            return;
        }

        let realFolder: string;
        let realFile: string;
        try {
            realFolder = await fs.promises.realpath(resolvedReadFolder);
            realFile = await fs.promises.realpath(fullFilePath);
        } catch {
            console.error(`File does not exist or cannot be resolved: ${fullFilePath}`);
            ctx.postToWebview({
                command: 'fileContentError',
                filePath: message.filePath,
                error: 'File does not exist'
            });
            return;
        }

        if (!isSubPath(realFolder, realFile)) {
            console.error(`Blocked attempt to read file via symlink outside folder: ${fullFilePath} -> ${realFile}`);
            ctx.postToWebview({
                command: 'fileContentError',
                filePath: message.filePath,
                error: 'Blocked attempt to read file outside folder'
            });
            return;
        }

        // NOTE: inherently TOCTOU existence check
        const fileExists = await fs.promises.stat(realFile).then(s => s.isFile()).catch(() => false);
        if (fileExists) {
            try {
                const content = await fs.promises.readFile(realFile, 'utf-8');
                ctx.postToWebview({
                    command: 'fileContentLoaded',
                    filePath: message.filePath,
                    content: content
                });
            } catch (e) {
                console.error('Failed to read file content', e);
                ctx.postToWebview({
                    command: 'fileContentError',
                    filePath: message.filePath,
                    error: `Failed to read file: ${(e as Error)?.message || String(e)}`
                });
            }
        } else {
            console.error(`File does not exist or is not a regular file: ${fullFilePath}`);
            ctx.postToWebview({
                command: 'fileContentError',
                filePath: message.filePath,
                error: 'File does not exist or is not a regular file'
            });
        }
    } else if (message && message.filePath && typeof message.filePath === 'string') {
        ctx.postToWebview({
            command: 'fileContentError',
            filePath: message.filePath,
            error: 'Invalid folder or file path'
        });
    }
}

/**
 * Handler for 'showOutputChannel' command.
 * Reveals the extension output channel and logs the webview request.
 *
 * @param ctx Message context
 * @param _message Incoming IPC message (unused)
 */
export function handleShowOutputChannel(ctx: MessageContext, _message: any): void {
    const channel = ctx.outputChannel || getDesignerOutputChannel();
    channel.show(true);
    channel.appendLine(`[${new Date().toLocaleTimeString()}] Log channel requested from Webview.`);
}

/**
 * Handler for 'openExternal' command.
 * Opens an external URL in the system browser.
 *
 * @param _ctx Message context (unused)
 * @param message Incoming IPC message containing target URL
 */
export function handleOpenExternal(_ctx: MessageContext, message: any): void {
    if (message.url) {
        if (!isAllowedExternalUri(message.url)) {
            console.warn(`Blocked opening disallowed external URI: ${message.url}`);
            return;
        }
        try {
            vscode.env.openExternal(vscode.Uri.parse(message.url));
        } catch (e) {
            console.error('Failed to open URL', e);
        }
    }
}
