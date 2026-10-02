/** @fileoverview Helper for writing pipeline files and associated project scaffolding to disk.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { DocumentSyncState } from './documentSync';
import { resolveOutputFolder } from './outputFolder';

/**
 * Saves pipeline YAML definitions and generated code artifacts to disk.
 * 
 * Synchronization & Persistence Architecture (Finding M4):
 * - If targetUri corresponds to an open TextDocument in VS Code, updates are applied via
 *   vscode.workspace.applyEdit(...) to preserve in-memory document state, undo/redo history,
 *   and dirty tracking without producing spurious disk conflict warnings.
 * - If targetUri is NOT currently open as a TextDocument, direct filesystem write via
 *   fs.writeFileSync is used since no in-memory buffer exists.
 * - Auxiliary generated artifacts (code, requirements.txt, Dockerfile, runner scripts, ignore files)
 *   are output files not held open as .beam documents in VS Code, so writing them directly via fs is safe.
 * 
 * @param targetUri File URI to save the pipeline definition to
 * @param data Serialized YAML content of the pipeline
 * @param code Optional generated pipeline execution code
 * @param fileExtension Code file extension (defaults to 'py')
 * @param outputFolder Optional custom destination directory for pipeline code
 * @param requirements Optional requirements.txt content
 * @param dockerfile Optional Dockerfile content
 * @param runScript Optional local runner script content
 * @param runDataflowScript Optional Dataflow runner script content
 * @param dockerIgnore Optional .dockerignore content
 * @param gcloudIgnore Optional .gcloudignore content
 * @param syncState Optional synchronization state for echo-loop suppression
 */
export async function savePipelineFiles(
    targetUri: vscode.Uri,
    data: string,
    code?: string,
    fileExtension: string = 'py',
    outputFolder?: string,
    requirements?: string,
    dockerfile?: string,
    runScript?: string,
    runDataflowScript?: string,
    dockerIgnore?: string,
    gcloudIgnore?: string,
    syncState?: DocumentSyncState
): Promise<void> {
    if (targetUri.scheme === 'untitled') {
        console.warn('[savePipelineFiles] Skipping direct file write for untitled URI:', targetUri.toString());
        return;
    }

    // M4: Check if the file is currently open as a TextDocument in VS Code
    const openDoc = vscode.workspace.textDocuments?.find(
        (doc) => doc.uri.toString() === targetUri.toString()
    );

    if (openDoc) {
        // Path A: Document is open in VS Code editor.
        // Skip WorkspaceEdit when content is already identical so opening a clean .beam file does not mark it dirty.
        if (openDoc.getText() === data) {
            if (syncState) {
                syncState.lastSavedContent = data;
            }
        } else {
            // Update via WorkspaceEdit to preserve undo history and dirty state.
            if (syncState) {
                syncState.isApplyingEdit = true;
                syncState.lastSavedContent = data;
            }
            try {
                const startPos = typeof openDoc.positionAt === 'function'
                    ? openDoc.positionAt(0)
                    : new vscode.Position(0, 0);
                const endPos = typeof openDoc.positionAt === 'function'
                    ? openDoc.positionAt(openDoc.getText().length)
                    : new vscode.Position(openDoc.lineCount || 0, 0);
                const fullRange = new vscode.Range(startPos, endPos);
                const edit = new vscode.WorkspaceEdit();
                edit.replace(openDoc.uri, fullRange, data);
                await vscode.workspace.applyEdit(edit);
            } finally {
                if (syncState) {
                    syncState.isApplyingEdit = false;
                }
            }
        }
    } else {
        // Path B: Document is NOT open in VS Code.
        // Direct filesystem write is safe as no in-memory buffer is being tracked.
        await fs.promises.writeFile(targetUri.fsPath, data, 'utf-8');
    }
    if (code) {
        const pipelineBaseName = path.basename(targetUri.fsPath, '.beam');
        const folderPath = resolveOutputFolder(
            targetUri.fsPath,
            outputFolder,
            vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
        );

        // Replace redundant existsSync/mkdirSync with idempotent fs.promises.mkdir (M18)
        await fs.promises.mkdir(folderPath, { recursive: true });

        const srcFolderPath = path.join(folderPath, 'src');
        await fs.promises.mkdir(srcFolderPath, { recursive: true });

        const codePath = path.join(srcFolderPath, `${pipelineBaseName}.${fileExtension}`);
        await fs.promises.writeFile(codePath, code, 'utf-8');

        if (fileExtension === 'py') {
            const reqPath = path.join(folderPath, 'requirements.txt');
            const reqContent = requirements || 'apache-beam\n';
            await fs.promises.writeFile(reqPath, reqContent, 'utf-8');

            const dockerPath = path.join(folderPath, 'Dockerfile');
            if (dockerfile) {
                // NOTE: inherently TOCTOU existence check
                const dockerExists = await fs.promises.stat(dockerPath).then(() => true).catch(() => false);
                if (!dockerExists) {
                    await fs.promises.writeFile(dockerPath, dockerfile, 'utf-8');
                }
            }

            const runScriptPath = path.join(folderPath, 'run_directrunner.sh');
            if (runScript) {
                await fs.promises.writeFile(runScriptPath, runScript, 'utf-8');
                try {
                    await fs.promises.chmod(runScriptPath, '755');
                } catch (e) {
                    console.error(`Failed to set executable permission on ${runScriptPath}`, e);
                }
            }

            const runDataflowScriptPath = path.join(folderPath, 'run_dataflow.sh');
            if (runDataflowScript) {
                await fs.promises.writeFile(runDataflowScriptPath, runDataflowScript, 'utf-8');
                try {
                    await fs.promises.chmod(runDataflowScriptPath, '755');
                } catch (e) {
                    console.error(`Failed to set executable permission on ${runDataflowScriptPath}`, e);
                }
            }

            const ignorePath = path.join(folderPath, '.dockerignore');
            if (dockerIgnore) {
                await fs.promises.writeFile(ignorePath, dockerIgnore, 'utf-8');
            }

            const gcloudIgnorePath = path.join(folderPath, '.gcloudignore');
            if (gcloudIgnore) {
                await fs.promises.writeFile(gcloudIgnorePath, gcloudIgnore, 'utf-8');
            }
        }
    }
}
