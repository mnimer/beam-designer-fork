import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getVsCodeApi,
  postToHost,
  resetVsCodeApiForTesting,
  type VsCodeApi
} from './vscodeApi';
import type { WebviewToHostMessage } from '../utils/protocol';

// These tests exercise the transport with synthetic command names that are not
// part of the host protocol, so they are cast to the protocol type.
const msg = (message: Record<string, unknown>) => message as unknown as WebviewToHostMessage;

describe('bridge/vscodeApi', () => {
  const originalAcquire = window.acquireVsCodeApi;

  beforeEach(() => {
    resetVsCodeApiForTesting();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    resetVsCodeApiForTesting();
    window.acquireVsCodeApi = originalAcquire;
  });

  it('acquires once even when called many times', () => {
    const mockPostMessage = vi.fn();
    const mockApi: VsCodeApi = { postMessage: mockPostMessage };
    const acquireStub = vi.fn(() => mockApi);
    vi.stubGlobal('acquireVsCodeApi', acquireStub);
    window.acquireVsCodeApi = acquireStub;

    const first = getVsCodeApi();
    const second = getVsCodeApi();
    const third = getVsCodeApi();

    expect(acquireStub).toHaveBeenCalledTimes(1);
    expect(first).toBe(mockApi);
    expect(second).toBe(mockApi);
    expect(third).toBe(mockApi);
    expect(window.vscode).toBe(mockApi);
  });

  it('respects a pre-set window.vscode', () => {
    const mockPostMessage = vi.fn();
    const preSetApi: VsCodeApi = { postMessage: mockPostMessage };
    window.vscode = preSetApi;

    const acquireStub = vi.fn();
    vi.stubGlobal('acquireVsCodeApi', acquireStub);
    window.acquireVsCodeApi = acquireStub;

    const result = getVsCodeApi();

    expect(result).toBe(preSetApi);
    expect(acquireStub).not.toHaveBeenCalled();
  });

  it('postToHost delivers messages when API is available', () => {
    const mockPostMessage = vi.fn();
    window.vscode = { postMessage: mockPostMessage };

    postToHost(msg({ command: 'testMessage', payload: 123 }));

    expect(mockPostMessage).toHaveBeenCalledTimes(1);
    expect(mockPostMessage).toHaveBeenCalledWith({ command: 'testMessage', payload: 123 });
  });

  it('postToHost no-ops without an API and logs console.warn once', () => {
    vi.stubGlobal('acquireVsCodeApi', undefined);
    delete (window as unknown as { acquireVsCodeApi?: unknown }).acquireVsCodeApi;
    delete (globalThis as { acquireVsCodeApi?: unknown }).acquireVsCodeApi;
    delete window.vscode;

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    postToHost(msg({ command: 'message1' }));
    postToHost(msg({ command: 'message2' }));
    postToHost(msg({ command: 'message3' }));

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(
      '[vscodeApi] No VS Code API available to post message:',
      { command: 'message1' }
    );
  });
});
