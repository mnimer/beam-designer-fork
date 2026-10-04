/**
 * @fileoverview Helper for prompting the user with a Save dialog for a .beam pipeline file.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { nextAvailableBeamFilename } from './outputFolder';

/**
 * Prompts the user to choose a save location for a .beam pipeline file.
 *
 * @param title Dialog title displayed to the user.
 * @param baseName Preferred base filename or candidate filename (e.g. 'pipeline' or sample filename).
 * @returns The chosen Uri, or undefined if the user cancelled the dialog.
 */
export async function promptForBeamSaveLocation(
    title: string,
    baseName: string
): Promise<vscode.Uri | undefined> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    const defaultUri = workspaceFolder
        ? vscode.Uri.file(path.join(workspaceFolder, nextAvailableBeamFilename(workspaceFolder, baseName)))
        : undefined;
    return vscode.window.showSaveDialog({
        defaultUri,
        title,
        filters: { 'Beam Pipeline': ['beam'] }
    });
}
