/**
 * Unit tests for usePanelResize hook
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Tests:
 * - (a) startResize then 3 mousemove events before a frame => size updates once with the LAST position
 * - (b) clamping at min and max
 * - (c) mouseup removes listeners (further mousemove does not change size) and restores document.body.style.cursor
 * - (d) unmount during resize removes listeners and cancels the pending frame
 * - computeSize support and initialSize function initializer
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type React from 'react';
import { usePanelResize } from './usePanelResize';

const createMockMouseEvent = (coords: { clientX?: number; clientY?: number }): React.MouseEvent => {
  return {
    clientX: coords.clientX ?? 0,
    clientY: coords.clientY ?? 0,
    preventDefault: vi.fn(),
  } as unknown as React.MouseEvent;
};

describe('usePanelResize', () => {
  const rafCallbacks = new Map<number, FrameRequestCallback>();
  let rafIdCounter = 0;
  let cancelSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    rafCallbacks.clear();
    rafIdCounter = 0;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      const id = ++rafIdCounter;
      rafCallbacks.set(id, cb);
      return id;
    });
    cancelSpy = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id: number) => {
      rafCallbacks.delete(id);
    });
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  });

  const flushNextFrame = () => {
    const callbacks = Array.from(rafCallbacks.entries());
    rafCallbacks.clear();
    callbacks.forEach(([, cb]) => cb(performance.now()));
  };

  it('(a) startResize then 3 mousemove events before a frame => size updates once with the LAST position', () => {
    const { result } = renderHook(() =>
      usePanelResize({
        axis: 'x',
        initialSize: 200,
      })
    );

    act(() => {
      result.current.startResize(createMockMouseEvent({ clientX: 200 }));
    });

    expect(result.current.isResizing).toBe(true);
    expect(result.current.size).toBe(200);

    // 3 rapid mousemove events before a frame fires
    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 230 }));
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 260 }));
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 300 }));
    });

    // Size should not have updated yet (coalesced in rAF)
    expect(result.current.size).toBe(200);
    // Exactly 1 frame should have been scheduled
    expect(rafCallbacks.size).toBe(1);

    // Flush the single animation frame
    act(() => {
      flushNextFrame();
    });

    // Size updates once with the LAST position (startSize 200 + delta 100 = 300)
    expect(result.current.size).toBe(300);
  });

  it('(b) clamping at min and max', () => {
    const { result } = renderHook(() =>
      usePanelResize({
        axis: 'x',
        initialSize: 200,
        min: 100,
        max: 400,
      })
    );

    act(() => {
      result.current.startResize(createMockMouseEvent({ clientX: 200 }));
    });

    // Exceed max (200 + 350 = 550 > 400)
    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 550 }));
      flushNextFrame();
    });
    expect(result.current.size).toBe(400);

    // Exceed min (200 - 150 = 50 < 100)
    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 50 }));
      flushNextFrame();
    });
    expect(result.current.size).toBe(100);
  });

  it('(c) mouseup removes listeners (further mousemove does not change size) and restores document.body.style.cursor', () => {
    const onResizeEnd = vi.fn();
    const { result } = renderHook(() =>
      usePanelResize({
        axis: 'x',
        initialSize: 200,
        cursor: 'col-resize',
        onResizeEnd,
      })
    );

    act(() => {
      result.current.startResize(createMockMouseEvent({ clientX: 200 }));
    });

    expect(document.body.style.cursor).toBe('col-resize');
    expect(document.body.style.userSelect).toBe('none');
    expect(result.current.isResizing).toBe(true);

    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 250 }));
      flushNextFrame();
    });
    expect(result.current.size).toBe(250);

    // Mouseup ends resize
    act(() => {
      window.dispatchEvent(new MouseEvent('mouseup'));
    });

    expect(result.current.isResizing).toBe(false);
    expect(document.body.style.cursor).toBe('');
    expect(document.body.style.userSelect).toBe('');
    expect(onResizeEnd).toHaveBeenCalledWith(250);

    // Further mousemove does not change size
    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 400 }));
      flushNextFrame();
    });
    expect(result.current.size).toBe(250);
  });

  it('(d) unmount during resize removes listeners and cancels the pending frame', () => {
    const { result, unmount } = renderHook(() =>
      usePanelResize({
        axis: 'y',
        initialSize: 300,
        cursor: 'row-resize',
      })
    );

    act(() => {
      result.current.startResize(createMockMouseEvent({ clientY: 300 }));
    });

    expect(document.body.style.cursor).toBe('row-resize');

    // Trigger a mousemove so a frame is scheduled
    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove', { clientY: 350 }));
    });
    expect(rafCallbacks.size).toBe(1);

    // Unmount while resize is pending
    act(() => {
      unmount();
    });

    expect(cancelSpy).toHaveBeenCalled();
    expect(rafCallbacks.size).toBe(0);
    expect(document.body.style.cursor).toBe('');
    expect(document.body.style.userSelect).toBe('');

    // Further events don't trigger anything
    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove', { clientY: 500 }));
    });
    expect(rafCallbacks.size).toBe(0);
  });

  it('supports custom computeSize and reverse direction', () => {
    const computeSize = vi.fn((e: MouseEvent) => {
      return 1000 - e.clientX;
    });

    const { result } = renderHook(() =>
      usePanelResize({
        axis: 'x',
        initialSize: () => 320,
        computeSize,
        min: 300,
        max: () => 800,
      })
    );

    expect(result.current.size).toBe(320);

    act(() => {
      result.current.startResize(createMockMouseEvent({ clientX: 680 }));
    });

    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 500 }));
      flushNextFrame();
    });

    expect(computeSize).toHaveBeenCalled();
    expect(result.current.size).toBe(500); // 1000 - 500 = 500
  });

  it('flushes pending mousemove and updates size synchronously before onResizeEnd on mouseup', () => {
    const onResizeEnd = vi.fn();
    const { result } = renderHook(() =>
      usePanelResize({
        axis: 'x',
        initialSize: 200,
        onResizeEnd,
      })
    );

    act(() => {
      result.current.startResize(createMockMouseEvent({ clientX: 200 }));
    });

    // Fire mousemove without flushing rAF
    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 280 }));
    });

    // rAF is still pending, size has not updated yet
    expect(result.current.size).toBe(200);
    expect(rafCallbacks.size).toBe(1);

    // Fire mouseup while rAF is still pending
    act(() => {
      window.dispatchEvent(new MouseEvent('mouseup'));
    });

    // Pending rAF was cancelled
    expect(cancelSpy).toHaveBeenCalled();
    // Size was flushed synchronously to 280 (200 + 80)
    expect(result.current.size).toBe(280);
    // onResizeEnd was called with the flushed size 280
    expect(onResizeEnd).toHaveBeenCalledWith(280);
    expect(result.current.isResizing).toBe(false);
  });
});

