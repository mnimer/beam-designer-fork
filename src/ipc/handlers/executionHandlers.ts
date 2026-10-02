/** @fileoverview Execution and code generation IPC message handlers.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { handleRegenerateCode } from '../../codeGeneration';
import { getDesignerOutputChannel } from '../../core/outputChannel';
import { EditorSession } from '../../editor/EditorSession';
import { resolveOutputFolder } from '../../editor/outputFolder';
import { isSafeFolderPath, isAllowedExecutableScript } from '../../security/scriptGuard';
import {
    buildRunnerEnvironment,
    createJobIdTracker,
    describeRunner,
    findRunnerScript,
    resolveRunTarget,
    runnerScriptCandidates,
    spawnRunnerScript,
} from '../../execution/PipelineRunner';
import { MessageContext } from '../messageContext';

/**
 * Session used when a MessageContext carries no per-panel session (legacy
 * callers and direct handler invocations in tests).
 */
const fallbackSession = new EditorSession();

/**
 * Returns the session that owns long-running work for the sending panel.
 *
 * @param ctx Message context.
 * @returns The panel's session, or the shared fallback session.
 */
function sessionOf(ctx: MessageContext): EditorSession {
    return ctx.session ?? fallbackSession;
}

/**
 * Whether VS Code reports the workspace as explicitly untrusted (finding S2).
 * Running runner scripts or writing generated code from an untrusted folder
 * would let a malicious `.beam` file or checked-in script execute locally.
 *
 * @returns True only when `workspace.isTrusted` is exactly false.
 */
function isWorkspaceUntrusted(): boolean {
    return vscode.workspace.isTrusted === false;
}

/** User-facing explanation shown when an action is blocked by Workspace Trust. */
const UNTRUSTED_WORKSPACE_MESSAGE =
    'This workspace is not trusted. Trust the workspace to run pipelines or generate code.';

/**
 * Executes a pipeline script as a child process and streams real-time stdout/stderr
 * logs and detected job IDs to the webview and output channel.
 *
 * @param ctx Message context
 * @param message Incoming IPC message with pipeline and runner configuration
 */
export async function handleRunPipeline(ctx: MessageContext, message: any): Promise<void> {
    if (isWorkspaceUntrusted()) {
        vscode.window.showErrorMessage(UNTRUSTED_WORKSPACE_MESSAGE);
        ctx.postToWebview({ command: 'pipelineLog', text: `[Error]: ${UNTRUSTED_WORKSPACE_MESSAGE}\n`, stream: 'stderr' });
        ctx.postToWebview({ command: 'pipelineFinished', exitCode: 1, status: 'failed' });
        return;
    }
    const session = sessionOf(ctx);
    const runUri = ctx.document ? ctx.document.uri : ctx.uri;
    if (runUri) {
        const outputFolder = message.pipelineConfig?.outputFolder;
        if (outputFolder && outputFolder.trim() && !isSafeFolderPath(outputFolder)) {
            vscode.window.showErrorMessage(`Invalid output folder "${outputFolder}": contains unsafe shell characters.`);
            return;
        }
        const folderPath = resolveOutputFolder(
            runUri.fsPath,
            outputFolder,
            vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
        );

        if (!isSafeFolderPath(folderPath)) {
            vscode.window.showErrorMessage(`Invalid pipeline folder path "${folderPath}": contains unsafe shell characters.`);
            return;
        }

        const runner = message.jobConfig?.runner || 'DirectRunner';
        const possibleNames = runnerScriptCandidates(runner);
        const scriptName = findRunnerScript(folderPath, possibleNames);

        if (scriptName) {
            if (!isAllowedExecutableScript(scriptName)) {
                vscode.window.showErrorMessage(`Unauthorized runner script: ${scriptName}`);
                return;
            }

            try {
                // If this panel already has a run in progress, terminate it before starting a new one.
                // Runs owned by other editor panels are left alone.
                session.stopProcess(false);

                const scriptFullPath = path.join(folderPath, scriptName);
                try {
                    fs.chmodSync(scriptFullPath, '755');
                } catch (e) {
                    // Best effort file permission update, continue execution
                }

                const commandLine = `${describeRunner(runner)}\ncd "${folderPath}" && bash ./${scriptName}`;

                ctx.postToWebview({
                    command: 'pipelineStarted',
                    runner: runner,
                    commandLine: commandLine,
                    folderPath: folderPath
                });

                const channel = ctx.outputChannel || getDesignerOutputChannel();
                channel.appendLine(`\n[${new Date().toLocaleTimeString()}] Starting pipeline execution with ${runner}:`);
                channel.appendLine(`Command: cd "${folderPath}" && bash ./${scriptName}`);

                const { env, rejectedKeys } = buildRunnerEnvironment({
                    baseEnv: process.env,
                    runtimeVariables: message.runtimeVariables,
                    jobConfig: message.jobConfig,
                });
                if (rejectedKeys.length > 0) {
                    const warning = `Ignored unsafe runtime variable name(s): ${rejectedKeys.join(', ')}`;
                    channel.appendLine(`[${new Date().toLocaleTimeString()}] WARNING: ${warning}`);
                    ctx.postToWebview({ command: 'pipelineLog', text: `[Warning]: ${warning}\n`, stream: 'stderr' });
                }

                // F6: resolve the project before spawning (explicit projectId wins).
                const target = await resolveRunTarget(message.jobConfig);
                const trackJobId = createJobIdTracker(target);

                const child = spawnRunnerScript(folderPath, scriptFullPath, env, {
                    onOutput: (text, stream) => {
                        channel.append(text);
                        ctx.postToWebview({ command: 'pipelineLog', text, stream });
                        const job = trackJobId(text);
                        if (job) {
                            const label = job.runner === 'Dataflow' ? 'Dataflow Job ID' : 'Spark Batch ID';
                            channel.appendLine(`[${new Date().toLocaleTimeString()}] Detected ${label}: ${job.jobId}`);
                            ctx.postToWebview({ command: 'pipelineJobIdDetected', ...job });
                        }
                    },
                    onError: (err) => {
                        const errText = `\n[Process execution error: ${err.message}]\n`;
                        channel.appendLine(errText);
                        ctx.postToWebview({ command: 'pipelineLog', text: errText, stream: 'stderr' });
                        ctx.postToWebview({ command: 'pipelineFinished', exitCode: 1, status: 'failed' });
                        session.clearProcessIf(child);
                    },
                    onClose: (code, signal) => {
                        const status = (code === 0) ? 'completed' : (signal ? 'stopped' : 'failed');
                        const finishText = `\n[Execution ${status} (exit code: ${code ?? 0}${signal ? `, signal: ${signal}` : ''})]\n`;
                        channel.appendLine(finishText);
                        ctx.postToWebview({ command: 'pipelineLog', text: finishText, stream: 'stdout' });
                        ctx.postToWebview({ command: 'pipelineFinished', exitCode: code ?? 0, status: status });
                        session.clearProcessIf(child);
                    },
                });
                session.setProcess(child);

            } catch (e: any) {
                console.error('Failed to spawn runner process', e);
                vscode.window.showErrorMessage(`Failed to execute runner process: ${e.message}`);
                ctx.postToWebview({
                    command: 'pipelineLog',
                    text: `\nFailed to start runner process: ${e.message}\n`,
                    stream: 'stderr'
                });
                ctx.postToWebview({
                    command: 'pipelineFinished',
                    exitCode: 1,
                    status: 'failed'
                });
            }
        } else {
            const namesStr = possibleNames.join(' or ');
            const notFoundMsg = `Runner script not found (${namesStr}) in ${folderPath}. Please save and/or generate code first.`;
            vscode.window.showErrorMessage(notFoundMsg);
            ctx.postToWebview({
                command: 'pipelineLog',
                text: `[Error]: ${notFoundMsg}\n`,
                stream: 'stderr'
            });
            ctx.postToWebview({
                command: 'pipelineFinished',
                exitCode: 1,
                status: 'failed'
            });
        }
    } else {
        vscode.window.showErrorMessage("Please save the pipeline first to run it.");
    }
}

/**
 * Terminates an active background pipeline execution process.
 *
 * @param ctx Message context
 * @param _message Incoming IPC message
 */
export async function handleStopPipeline(ctx: MessageContext, _message: any): Promise<void> {
    // SIGINT the process group now, SIGKILL after a grace period if still alive.
    const stopped = sessionOf(ctx).stopProcess(true);
    if (stopped) {
        const channel = ctx.outputChannel || getDesignerOutputChannel();
        channel.appendLine(`[${new Date().toLocaleTimeString()}] Pipeline execution stopped by user.`);
        ctx.postToWebview({ command: 'pipelineStopped' });
    }
}

/**
 * Cancels any active Gemini code generation task.
 *
 * @param ctx Message context
 * @param _message Incoming IPC message
 */
export async function handleStopCodeGeneration(ctx: MessageContext, _message: any): Promise<void> {
    // Aborting the controller cancels the in-flight Gemini request and makes
    // executeCodeGeneration bail out before touching the output folder.
    sessionOf(ctx).cancelGeneration();
    const channel = ctx.outputChannel || getDesignerOutputChannel();
    channel.appendLine(`[${new Date().toLocaleTimeString()}] Code generation canceled by user.`);
    vscode.window.showInformationMessage("Gemini code generation stopped.");
    ctx.postToWebview({ command: 'codeGenerationStopped' });
}

/**
 * Handler for 'regenerateCode' command.
 * Invokes modular AI code generation pipeline.
 *
 * @param ctx Message context
 * @param message Incoming IPC message with code generation parameters
 */
export async function handleRegenerateCodeCommand(ctx: MessageContext, message: any): Promise<void> {
    if (isWorkspaceUntrusted()) {
        vscode.window.showErrorMessage(UNTRUSTED_WORKSPACE_MESSAGE);
        ctx.postToWebview({ command: 'codeRegenerated', success: false, error: UNTRUSTED_WORKSPACE_MESSAGE });
        return;
    }
    const session = sessionOf(ctx);
    // Starting a new generation aborts any generation still running for this panel.
    const controller = session.beginGeneration();
    try {
        await handleRegenerateCode({
            message,
            context: ctx.context,
            document: ctx.document,
            uri: ctx.uri,
            postToWebview: ctx.postToWebview,
            outputChannel: ctx.outputChannel || getDesignerOutputChannel(),
            abortSignal: controller.signal,
        });
    } finally {
        session.endGeneration(controller);
    }
}
