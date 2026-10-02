/**
 * @fileoverview Unit tests for useUndoRedoHistory hook and isEditableTarget helper.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useUndoRedoHistory,
  isEditableTarget,
} from './useUndoRedoHistory.ts';

describe('useUndoRedoHistory', () => {
  it('undo restores previous snapshot', () => {
    let state = { count: 0 };
    const { result } = renderHook(() =>
      useUndoRedoHistory({
        capture: () => ({ ...state }),
        restore: (snapshot) => {
          state = { ...snapshot };
        },
        coalesceMs: 0,
      })
    );

    expect(result.current.canUndo).toBe(false);

    // Initial state captured
    act(() => {
      result.current.takeSnapshot();
    });
    state = { count: 1 };

    expect(result.current.canUndo).toBe(true);

    // Take another snapshot with state=1
    act(() => {
      result.current.takeSnapshot();
    });
    state = { count: 2 };

    // First undo restores count: 1
    act(() => {
      result.current.undo();
    });
    expect(state.count).toBe(1);
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(true);

    // Second undo restores count: 0
    act(() => {
      result.current.undo();
    });
    expect(state.count).toBe(0);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(true);

    // Further undo when empty is a no-op
    act(() => {
      result.current.undo();
    });
    expect(state.count).toBe(0);
  });

  it('redo re-applies', () => {
    let state = { text: 'initial' };
    const { result } = renderHook(() =>
      useUndoRedoHistory({
        capture: () => ({ ...state }),
        restore: (snapshot) => {
          state = { ...snapshot };
        },
        coalesceMs: 0,
      })
    );

    act(() => {
      result.current.takeSnapshot();
    });
    state = { text: 'first' };

    act(() => {
      result.current.takeSnapshot();
    });
    state = { text: 'second' };

    // Undo twice back to 'initial'
    act(() => {
      result.current.undo();
    });
    expect(state.text).toBe('first');

    act(() => {
      result.current.undo();
    });
    expect(state.text).toBe('initial');

    // Redo once brings back 'first'
    act(() => {
      result.current.redo();
    });
    expect(state.text).toBe('first');
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(true);

    // Redo again brings back 'second'
    act(() => {
      result.current.redo();
    });
    expect(state.text).toBe('second');
    expect(result.current.canRedo).toBe(false);

    // Further redo when empty is a no-op
    act(() => {
      result.current.redo();
    });
    expect(state.text).toBe('second');
  });

  it('new snapshot after undo clears redo', () => {
    let state = { val: 'A' };
    const { result } = renderHook(() =>
      useUndoRedoHistory({
        capture: () => ({ ...state }),
        restore: (snapshot) => {
          state = { ...snapshot };
        },
        coalesceMs: 0,
      })
    );

    act(() => {
      result.current.takeSnapshot();
    });
    state = { val: 'B' };

    act(() => {
      result.current.undo();
    });
    expect(state.val).toBe('A');
    expect(result.current.canRedo).toBe(true);

    // New edit and snapshot
    state = { val: 'C' };
    act(() => {
      result.current.takeSnapshot();
    });

    expect(result.current.canRedo).toBe(false);
    // Redo should be a no-op now
    act(() => {
      result.current.redo();
    });
    expect(state.val).toBe('C');
  });

  it('cap at limit', () => {
    let state = { val: 0 };
    const { result } = renderHook(() =>
      useUndoRedoHistory({
        capture: () => ({ ...state }),
        restore: (snapshot) => {
          state = { ...snapshot };
        },
        limit: 3,
        coalesceMs: 0,
      })
    );

    // Push 4 snapshots (0, 1, 2, 3)
    for (let i = 0; i < 4; i++) {
      state = { val: i };
      act(() => {
        result.current.takeSnapshot();
      });
    }
    state = { val: 4 };

    // History should have dropped snapshot 0 and kept [1, 2, 3]
    act(() => {
      result.current.undo();
    });
    expect(state.val).toBe(3);

    act(() => {
      result.current.undo();
    });
    expect(state.val).toBe(2);

    act(() => {
      result.current.undo();
    });
    expect(state.val).toBe(1);

    // Should be at the end of the capped stack (snapshot 0 was dropped)
    expect(result.current.canUndo).toBe(false);
    act(() => {
      result.current.undo();
    });
    expect(state.val).toBe(1);
  });

  it('coalescing within window pushes one entry, outside window pushes two', () => {
    let clockTime = 1000;
    const now = () => clockTime;
    let state = { text: 'start' };

    const { result } = renderHook(() =>
      useUndoRedoHistory({
        capture: () => ({ ...state }),
        restore: (snapshot) => {
          state = { ...snapshot };
        },
        limit: 100,
        coalesceMs: 500,
        now,
      })
    );

    // First snapshot at t=1000 (pre-edit: 'start')
    act(() => {
      result.current.takeSnapshot();
    });
    state = { text: 'start-1' };

    // Rapid second snapshot at t=1200 within 500ms window (should be coalesced / skipped)
    clockTime = 1200;
    act(() => {
      result.current.takeSnapshot();
    });
    state = { text: 'start-2' };

    // Rapid third snapshot at t=1400 within 500ms of previous call (should also be coalesced)
    clockTime = 1400;
    act(() => {
      result.current.takeSnapshot();
    });
    state = { text: 'start-final' };

    // Only one snapshot was pushed: undo restores 'start' and canUndo becomes false
    act(() => {
      result.current.undo();
    });
    expect(state.text).toBe('start');
    expect(result.current.canUndo).toBe(false);

    // Now outside window: advance time by 600ms (> 500ms coalesceMs)
    clockTime = 2000;
    state = { text: 'step-A' };
    act(() => {
      result.current.takeSnapshot();
    }); // pushes first entry of new burst

    state = { text: 'step-B' };
    clockTime = 2600; // outside window (> 500ms since t=2000)
    act(() => {
      result.current.takeSnapshot();
    }); // pushes second entry

    state = { text: 'step-C' };

    // Undo 1 restores step-B
    act(() => {
      result.current.undo();
    });
    expect(state.text).toBe('step-B');
    expect(result.current.canUndo).toBe(true);

    // Undo 2 restores step-A
    act(() => {
      result.current.undo();
    });
    expect(state.text).toBe('step-A');
    expect(result.current.canUndo).toBe(false);
  });

  it('keeps takeSnapshot a stable callback across re-renders', () => {
    const { result, rerender } = renderHook(
      ({ count }) =>
        useUndoRedoHistory({
          capture: () => ({ count }),
          restore: () => {},
        }),
      { initialProps: { count: 0 } }
    );

    const firstTakeSnapshot = result.current.takeSnapshot;

    // Trigger re-render with new props
    rerender({ count: 1 });
    expect(result.current.takeSnapshot).toBe(firstTakeSnapshot);

    rerender({ count: 2 });
    expect(result.current.takeSnapshot).toBe(firstTakeSnapshot);
  });
});

describe('isEditableTarget', () => {
  it('isEditableTarget true for input/textarea/select/contenteditable, false for div/body/null', () => {
    expect(isEditableTarget(null)).toBe(false);
    expect(isEditableTarget(undefined as unknown as EventTarget)).toBe(false);

    const div = document.createElement('div');
    expect(isEditableTarget(div)).toBe(false);

    expect(isEditableTarget(document.body)).toBe(false);

    const input = document.createElement('input');
    expect(isEditableTarget(input)).toBe(true);

    const textarea = document.createElement('textarea');
    expect(isEditableTarget(textarea)).toBe(true);

    const select = document.createElement('select');
    expect(isEditableTarget(select)).toBe(true);

    const contentEditableDiv = document.createElement('div');
    contentEditableDiv.setAttribute('contenteditable', 'true');
    expect(isEditableTarget(contentEditableDiv)).toBe(true);

    // Child of a contentEditable element inherits isContentEditable
    const parentEditable = document.createElement('div');
    parentEditable.setAttribute('contenteditable', 'true');
    const childSpan = document.createElement('span');
    parentEditable.appendChild(childSpan);
    document.body.appendChild(parentEditable);
    expect(isEditableTarget(childSpan)).toBe(true);
    document.body.removeChild(parentEditable);
  });
});
