/**
 * @fileoverview Per-editor-panel lifecycle state for long-running work
 * (pipeline runner child process and Gemini code generation).
 *
 * Before this module the extension kept a single module-level
 * `activeExecutionProcess` / `activeGenerationCts` pair, so two open `.beam`
 * tabs clobbered each other (findings F1/F4): starting a run in tab B killed
 * tab A's process, and Stop never reached the Gemini request. Each webview
 * panel now owns one {@link EditorSession}; disposing the panel disposes the
 * session, which stops its process and aborts its generation.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

import type { ChildProcess } from 'child_process';

/** Delay before escalating a graceful SIGINT to SIGKILL, in milliseconds. */
export const FORCE_KILL_DELAY_MS = 2000;

/**
 * Sends `signal` to a runner process. On POSIX the runner is spawned detached
 * as a process-group leader, so the whole group (bash plus the JVM/python it
 * launched) is signalled; if that fails the direct child is signalled instead.
 * Errors from already-exited processes are swallowed.
 *
 * @param proc Process to signal.
 * @param signal Signal name, e.g. 'SIGINT' or 'SIGKILL'.
 */
export function signalProcessTree(proc: ChildProcess, signal: 'SIGINT' | 'SIGKILL'): void {
    try {
        if (proc.pid && process.platform !== 'win32') {
            try {
                process.kill(-proc.pid, signal);
            } catch {
                proc.kill(signal);
            }
        } else {
            proc.kill(signal);
        }
    } catch {
        // Process already exited.
    }
}

/**
 * Owns the runner process and generation abort controller of one editor panel.
 */
export class EditorSession {
    private executionProcess: ChildProcess | null = null;
    private generationController: AbortController | null = null;
    private disposed = false;

    /**
     * Whether {@link dispose} has been called.
     *
     * @returns True once the owning panel has closed.
     */
    public get isDisposed(): boolean {
        return this.disposed;
    }

    /**
     * The currently running pipeline process, if any.
     *
     * @returns The active child process or null.
     */
    public get activeProcess(): ChildProcess | null {
        return this.executionProcess;
    }

    /**
     * Records a newly spawned runner process as the active one.
     *
     * @param proc The spawned child process.
     */
    public setProcess(proc: ChildProcess): void {
        this.executionProcess = proc;
    }

    /**
     * Clears the active process if (and only if) it is still `proc`. Used by
     * exit handlers so a late 'close' from an old run cannot clear a newer one.
     *
     * @param proc The process whose lifecycle ended.
     */
    public clearProcessIf(proc: ChildProcess): void {
        if (this.executionProcess === proc) {
            this.executionProcess = null;
        }
    }

    /**
     * Stops the active runner process: SIGINT to the process group now and,
     * when `escalate` is true, SIGKILL after {@link FORCE_KILL_DELAY_MS}.
     *
     * @param escalate Whether to schedule a SIGKILL follow-up.
     * @returns The process that was signalled, or null if none was running.
     */
    public stopProcess(escalate: boolean): ChildProcess | null {
        const proc = this.executionProcess;
        if (!proc) {
            return null;
        }
        this.executionProcess = null;
        signalProcessTree(proc, 'SIGINT');
        if (escalate && proc.pid && process.platform !== 'win32') {
            const timer = setTimeout(() => {
                try {
                    process.kill(-(proc.pid as number), 'SIGKILL');
                } catch {
                    // Process already exited before SIGKILL timeout.
                }
            }, FORCE_KILL_DELAY_MS);
            // Do not keep the extension host alive just for this timer.
            timer.unref?.();
        }
        return proc;
    }

    /**
     * Begins a new code generation, aborting any generation still in flight
     * for this panel.
     *
     * @returns The controller for the new generation; pass its `signal` down.
     */
    public beginGeneration(): AbortController {
        this.generationController?.abort();
        const controller = new AbortController();
        this.generationController = controller;
        return controller;
    }

    /**
     * Marks `controller`'s generation as finished. No-op if a newer generation
     * has already replaced it.
     *
     * @param controller Controller returned by {@link beginGeneration}.
     */
    public endGeneration(controller: AbortController): void {
        if (this.generationController === controller) {
            this.generationController = null;
        }
    }

    /**
     * Aborts the in-flight generation, if any.
     *
     * @returns True when a generation was running and has been aborted.
     */
    public cancelGeneration(): boolean {
        const controller = this.generationController;
        if (!controller) {
            return false;
        }
        this.generationController = null;
        controller.abort();
        return true;
    }

    /**
     * Releases everything the session owns. Called when the panel closes.
     */
    public dispose(): void {
        if (this.disposed) {
            return;
        }
        this.disposed = true;
        this.cancelGeneration();
        this.stopProcess(true);
    }
}
