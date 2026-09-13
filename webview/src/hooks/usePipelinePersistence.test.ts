/**
 * Unit tests for usePipelinePersistence hook (P6)
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Tests:
 * - Debounced saving of YAML to extension host
 * - P6: skipping redundant save when YAML string is byte-identical across debounce ticks
 * - P6: saving when actual changes occur
 * - Guard against saving when not loaded
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePipelinePersistence, serializePipeline, type PipelineState } from './usePipelinePersistence';

describe('usePipelinePersistence (P6 autosave)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const sampleState: PipelineState = {
    nodes: [{ id: 'n1', type: 'pipeline', position: { x: 0, y: 0 }, data: { label: 'Node 1', type: 'SOURCE', iconName: 'Radio' } }],
    edges: [],
    runtimeVariables: [{ key: 'LOG_LEVEL', value: 'INFO' }],
    jobConfig: { runner: 'DirectRunner' },
    pipelineConfig: { language: 'Python', outputFolder: 'test', needsRebuild: false },
  };

  it('serializes pipeline state into valid YAML', () => {
    const yaml = serializePipeline(sampleState);
    expect(yaml).toContain('Node 1');
    expect(yaml).toContain('LOG_LEVEL');
    expect(yaml).toContain('DirectRunner');
  });

  it('does not post save message when isLoaded is false', () => {
    const mockPostMessage = vi.fn();
    renderHook(() =>
      usePipelinePersistence({
        ...sampleState,
        isLoaded: false,
        vscode: { postMessage: mockPostMessage },
        debounceMs: 2000,
      })
    );

    act(() => {
      vi.advanceTimersByTime(2500);
    });

    expect(mockPostMessage).not.toHaveBeenCalled();
  });

  it('posts save message after debounce interval when isLoaded is true', () => {
    const mockPostMessage = vi.fn();
    renderHook(() =>
      usePipelinePersistence({
        ...sampleState,
        isLoaded: true,
        vscode: { postMessage: mockPostMessage },
        debounceMs: 2000,
      })
    );

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(mockPostMessage).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(mockPostMessage).toHaveBeenCalledTimes(1);
    expect(mockPostMessage).toHaveBeenCalledWith({
      command: 'savePipeline',
      data: expect.stringContaining('Node 1'),
    });
  });

  /**
   * P6 Core Requirement:
   * Two consecutive debounce ticks with unchanged state produce ONE post, not two.
   */
  it('P6: two consecutive debounce ticks with unchanged state produce one post, not two', () => {
    const mockPostMessage = vi.fn();
    const { rerender } = renderHook(
      (props) => usePipelinePersistence(props),
      {
        initialProps: {
          ...sampleState,
          isLoaded: true,
          vscode: { postMessage: mockPostMessage },
          debounceMs: 2000,
        },
      }
    );

    // First tick fires
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(mockPostMessage).toHaveBeenCalledTimes(1);

    // Re-render with identical state (e.g. parent re-render or new object with same content)
    rerender({
      nodes: [{ id: 'n1', type: 'pipeline', position: { x: 0, y: 0 }, data: { label: 'Node 1', type: 'SOURCE', iconName: 'Radio' } }],
      edges: [],
      runtimeVariables: [{ key: 'LOG_LEVEL', value: 'INFO' }],
      jobConfig: { runner: 'DirectRunner' },
      pipelineConfig: { language: 'Python', outputFolder: 'test', needsRebuild: false },
      isLoaded: true,
      vscode: { postMessage: mockPostMessage },
      debounceMs: 2000,
    });

    // Second tick fires
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // P6 verification: Still exactly ONE post, second tick was skipped!
    expect(mockPostMessage).toHaveBeenCalledTimes(1);
  });

  /**
   * P6 Core Requirement:
   * A tick after a real change does post.
   */
  it('P6: a tick after a real change does post', () => {
    const mockPostMessage = vi.fn();
    const { rerender } = renderHook(
      (props) => usePipelinePersistence(props),
      {
        initialProps: {
          ...sampleState,
          isLoaded: true,
          vscode: { postMessage: mockPostMessage },
          debounceMs: 2000,
        },
      }
    );

    // First tick fires
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(mockPostMessage).toHaveBeenCalledTimes(1);

    // State actually changes (e.g. node moved)
    rerender({
      ...sampleState,
      nodes: [{ id: 'n1', type: 'pipeline', position: { x: 150, y: 200 }, data: { label: 'Node 1', type: 'SOURCE', iconName: 'Radio' } }],
      isLoaded: true,
      vscode: { postMessage: mockPostMessage },
      debounceMs: 2000,
    });

    // Next tick fires
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // Real change was saved: total 2 posts
    expect(mockPostMessage).toHaveBeenCalledTimes(2);
    expect(mockPostMessage).toHaveBeenLastCalledWith({
      command: 'savePipeline',
      data: expect.stringContaining('150'),
    });
  });

  it('resets timer on rapid changes so only the trailing change saves', () => {
    const mockPostMessage = vi.fn();
    const { rerender } = renderHook(
      (props) => usePipelinePersistence(props),
      {
        initialProps: {
          ...sampleState,
          isLoaded: true,
          vscode: { postMessage: mockPostMessage },
          debounceMs: 2000,
        },
      }
    );

    // 1000ms in, change happens
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(mockPostMessage).not.toHaveBeenCalled();

    rerender({
      ...sampleState,
      runtimeVariables: [{ key: 'LOG_LEVEL', value: 'DEBUG' }],
      isLoaded: true,
      vscode: { postMessage: mockPostMessage },
      debounceMs: 2000,
    });

    // Another 1500ms (total 2500ms from start, but only 1500ms since re-render)
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(mockPostMessage).not.toHaveBeenCalled();

    // Final 500ms brings elapsed time since last change to 2000ms
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(mockPostMessage).toHaveBeenCalledTimes(1);
    expect(mockPostMessage).toHaveBeenCalledWith({
      command: 'savePipeline',
      data: expect.stringContaining('DEBUG'),
    });
  });
});
