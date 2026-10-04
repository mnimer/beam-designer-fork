/** @fileoverview Provides access to and lifecycle management for the Dataflow Designer output channel.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

import * as vscode from 'vscode';

let designerOutputChannel: vscode.OutputChannel | undefined;

/**
 * Returns the active output channel, creating it lazily if necessary.
 *
 * @returns The active vscode.OutputChannel
 */
export function getDesignerOutputChannel(): vscode.OutputChannel {
    if (!designerOutputChannel) {
        designerOutputChannel = vscode.window.createOutputChannel('Dataflow Designer');
    }
    return designerOutputChannel;
}

/**
 * Returns the active output channel if one exists, without creating it.
 */
export function tryGetDesignerOutputChannel(): vscode.OutputChannel | undefined {
    return designerOutputChannel;
}

/**
 * Disposes the active output channel if one exists and clears the cached instance.
 */
export function disposeDesignerOutputChannel(): void {
    if (designerOutputChannel) {
        designerOutputChannel.dispose();
        designerOutputChannel = undefined;
    }
}
