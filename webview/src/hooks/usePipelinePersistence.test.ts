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
import {
  usePipelinePersistence,
  serializePipeline,
  type PipelineState,
  type UsePipelinePersistenceOptions,
} from './usePipelinePersistence';

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

  it('does not post save message on initial load when no changes have been made (regression: opening .beam file must not mark it unsaved)', () => {
    const mockPostMessage = vi.fn();
    const { rerender } = renderHook(
      (props: UsePipelinePersistenceOptions) => usePipelinePersistence(props),
      {
        initialProps: {
          ...sampleState,
          isLoaded: false,
          vscode: { postMessage: mockPostMessage },
          debounceMs: 2000,
        },
      }
    );

    // Simulate loadPipeline completing (isLoaded transitions from false to true)
    rerender({
      ...sampleState,
      isLoaded: true,
      vscode: { postMessage: mockPostMessage },
      debounceMs: 2000,
    });

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    // Opening a file without making edits must NOT send savePipeline
    expect(mockPostMessage).not.toHaveBeenCalled();
  });

  it('does not post save message when React Flow mutates transient node/edge fields (width, height, selected, dragging, positionAbsolute) after load', () => {
    const mockPostMessage = vi.fn();
    const { rerender } = renderHook(
      (props: UsePipelinePersistenceOptions) => usePipelinePersistence(props),
      {
        initialProps: {
          ...sampleState,
          edges: [{ id: 'e1', source: 'n1', target: 'n2' }],
          isLoaded: true,
          vscode: { postMessage: mockPostMessage },
          debounceMs: 2000,
        } as UsePipelinePersistenceOptions,
      }
    );

    // Simulate React Flow ResizeObserver measuring node dimensions and user selecting a node/edge to inspect
    rerender({
      ...sampleState,
      nodes: [
        {
          ...sampleState.nodes[0],
          width: 180,
          height: 64,
          selected: true,
          dragging: false,
          positionAbsolute: { x: 0, y: 0 },
        },
      ],
      edges: [{ id: 'e1', source: 'n1', target: 'n2', selected: true }],
      isLoaded: true,
      vscode: { postMessage: mockPostMessage },
      debounceMs: 2000,
    });

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(mockPostMessage).not.toHaveBeenCalled();
  });

  it('re-seeds baseline without saving when loadRevision increments on external loadPipeline', () => {
    const mockPostMessage = vi.fn();
    const { rerender } = renderHook(
      (props) => usePipelinePersistence(props),
      {
        initialProps: {
          ...sampleState,
          isLoaded: true,
          loadRevision: 1,
          vscode: { postMessage: mockPostMessage },
          debounceMs: 2000,
        },
      }
    );

    // Simulate receiving a new loadPipeline payload from the extension host
    rerender({
      ...sampleState,
      nodes: [{ id: 'n2', type: 'pipeline', position: { x: 50, y: 50 }, data: { label: 'Reloaded Node', type: 'SOURCE', iconName: 'Radio' } }],
      isLoaded: true,
      loadRevision: 2,
      vscode: { postMessage: mockPostMessage },
      debounceMs: 2000,
    });

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(mockPostMessage).not.toHaveBeenCalled();
  });

  it('posts save message after debounce interval when state is modified after load', () => {
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

    // User modifies a node label after load
    rerender({
      ...sampleState,
      nodes: [{ id: 'n1', type: 'pipeline', position: { x: 0, y: 0 }, data: { label: 'Node 1 Updated', type: 'SOURCE', iconName: 'Radio' } }],
      isLoaded: true,
      vscode: { postMessage: mockPostMessage },
      debounceMs: 2000,
    });

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
      data: expect.stringContaining('Node 1 Updated'),
    });
  });

  /**
   * P6 Core Requirement:
   * Two consecutive debounce ticks with identical state produce ONE post, not two.
   */
  it('P6: two consecutive debounce ticks after a change with identical subsequent state produce one post, not two', () => {
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

    // User makes a change
    const updatedNodes = [{ id: 'n1', type: 'pipeline', position: { x: 10, y: 20 }, data: { label: 'Node 1', type: 'SOURCE', iconName: 'Radio' } }];
    rerender({
      ...sampleState,
      nodes: updatedNodes,
      isLoaded: true,
      vscode: { postMessage: mockPostMessage },
      debounceMs: 2000,
    });

    // First tick fires
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(mockPostMessage).toHaveBeenCalledTimes(1);

    // Re-render with identical state (new object references with same content)
    rerender({
      nodes: [{ id: 'n1', type: 'pipeline', position: { x: 10, y: 20 }, data: { label: 'Node 1', type: 'SOURCE', iconName: 'Radio' } }],
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

    // Initial load tick fires: 0 posts because no changes were made yet
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(mockPostMessage).toHaveBeenCalledTimes(0);

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

    // Real change was saved: 1 post
    expect(mockPostMessage).toHaveBeenCalledTimes(1);
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

    // First edit
    rerender({
      ...sampleState,
      runtimeVariables: [{ key: 'LOG_LEVEL', value: 'WARN' }],
      isLoaded: true,
      vscode: { postMessage: mockPostMessage },
      debounceMs: 2000,
    });

    // 1000ms in, second edit happens
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

    // Another 1500ms (total 2500ms from first edit, but only 1500ms since second edit)
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
