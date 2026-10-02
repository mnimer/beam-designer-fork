/**
 * @fileoverview Centralised VS Code webview API bridge module.
 *
 * Provides a single cached handle to the VS Code webview API,
 * safe message posting to the extension host, and global type declarations.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

import type { WebviewToHostMessage } from '../utils/protocol';

/**
 * Shape of the VS Code webview API acquired from the runtime environment.
 */
export interface VsCodeApi {
  postMessage(message: unknown): void;
  getState?(): unknown;
  setState?(state: unknown): void;
}

declare global {
  /**
   * Browser window extensions exposing the VS Code host communication hooks.
   */
  interface Window {
    vscode?: VsCodeApi;
    acquireVsCodeApi?: () => VsCodeApi;
  }
  function acquireVsCodeApi(): VsCodeApi;
}

let acquired = false;
let hasWarnedNoApi = false;

/**
 * Returns the cached VS Code API instance.
 * On first call, acquires via acquireVsCodeApi if available and caches it on window.vscode.
 * If window.vscode is already set, returns it directly.
 *
 * @returns The VsCodeApi instance, or undefined if not running in a VS Code webview.
 */
export function getVsCodeApi(): VsCodeApi | undefined {
  if (typeof window !== 'undefined' && window.vscode) {
    return window.vscode;
  }
  if (!acquired) {
    acquired = true;
    const acquireFn =
      typeof acquireVsCodeApi === 'function'
        ? acquireVsCodeApi
        : typeof window !== 'undefined' && typeof window.acquireVsCodeApi === 'function'
          ? window.acquireVsCodeApi
          : undefined;
    if (acquireFn) {
      try {
        const api = acquireFn();
        if (typeof window !== 'undefined') {
          window.vscode = api;
        }
        return api;
      } catch {
        // VS Code throws if already acquired; fall back to window.vscode below.
      }
    }
  }
  return typeof window !== 'undefined' ? window.vscode : undefined;
}

/**
 * Posts a message to the VS Code extension host.
 * If no VS Code API is available, no-ops and logs a console warning once.
 *
 * @param message The message payload to send to the extension host; its
 *     `command` must be one the host registers (see src/shared/protocol.ts).
 */
export function postToHost(message: WebviewToHostMessage): void {
  const api = getVsCodeApi();
  if (api && typeof api.postMessage === 'function') {
    api.postMessage(message);
  } else {
    if (!hasWarnedNoApi) {
      hasWarnedNoApi = true;
      console.warn('[vscodeApi] No VS Code API available to post message:', message);
    }
  }
}

/**
 * Resets internal module state for testing.
 * @internal
 */
export function resetVsCodeApiForTesting(): void {
  acquired = false;
  hasWarnedNoApi = false;
  if (typeof window !== 'undefined') {
    delete window.vscode;
  }
}
