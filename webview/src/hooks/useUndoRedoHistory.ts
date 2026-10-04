/**
 * @fileoverview Capped and coalesced undo/redo history hook with form editable target detection.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Options configuring the undo/redo history manager.
 */
export interface UseUndoRedoHistoryOptions<T> {
  /** Callback returning the current state snapshot to record */
  capture: () => T;
  /** Callback restoring a previously recorded state snapshot */
  restore: (snapshot: T) => void;
  /** Maximum number of snapshots retained in the history stack (default: 100) */
  limit?: number;
  /** Milliseconds window within which rapid snapshot calls are coalesced (default: 500ms) */
  coalesceMs?: number;
  /** Optional clock function returning epoch milliseconds (default: Date.now) */
  now?: () => number;
}

/**
 * Result returned by the useUndoRedoHistory hook.
 */
export interface UseUndoRedoHistoryResult {
  /** Stable callback to record an undo snapshot before state modifications */
  takeSnapshot: () => void;
  /** Callback to undo the last change */
  undo: () => void;
  /** Callback to redo the last undone change */
  redo: () => void;
  /** Whether there are snapshots available to undo */
  canUndo: boolean;
  /** Whether there are snapshots available to redo */
  canRedo: boolean;
}

/**
 * Determines whether an event target is an editable form element or contenteditable element,
 * where typing shortcuts (such as undo/redo or delete) should not intercept native input behavior.
 *
 * @param target - The event target to inspect (e.g. event.target or document.activeElement)
 * @returns True if the target is an editable input, textarea, select, or contenteditable element
 */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return target.isContentEditable || target.closest('[contenteditable]:not([contenteditable="false"])') !== null;
}

/**
 * Custom React hook managing an undo/redo stack of state snapshots.
 *
 * Provides bounded stack capacity (limit), coalesces rapid edit bursts within
 * coalesceMs, and exposes stable action callbacks.
 *
 * @param options - Configuration options for snapshot capture, restore, limit, and coalescing
 * @returns Object containing takeSnapshot, undo, redo, canUndo, and canRedo
 */
export function useUndoRedoHistory<T>({
  capture,
  restore,
  limit = 100,
  coalesceMs = 500,
  now,
}: UseUndoRedoHistoryOptions<T>): UseUndoRedoHistoryResult {
  const maxLimit = Math.max(1, limit);
  const effectiveCoalesceMs = Math.max(0, coalesceMs);

  const lastCallTimeRef = useRef<number>(0);
  const historyRef = useRef<T[]>([]);
  const futureRef = useRef<T[]>([]);

  const captureRef = useRef(capture);
  const restoreRef = useRef(restore);
  const nowRef = useRef(now ?? Date.now);

  useEffect(() => {
    captureRef.current = capture;
    restoreRef.current = restore;
    nowRef.current = now ?? Date.now;
  }, [capture, restore, now]);

  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const takeSnapshot = useCallback(() => {
    const currentTime = nowRef.current();
    const timeSinceLastCall = currentTime - lastCallTimeRef.current;
    lastCallTimeRef.current = currentTime;

    if (timeSinceLastCall < effectiveCoalesceMs) {
      return;
    }

    const snapshot = captureRef.current();
    const nextHistory = [...historyRef.current, snapshot];
    const cappedHistory =
      nextHistory.length > maxLimit
        ? nextHistory.slice(nextHistory.length - maxLimit)
        : nextHistory;

    historyRef.current = cappedHistory;
    futureRef.current = [];

    setCanUndo(true);
    setCanRedo(false);
  }, [maxLimit, effectiveCoalesceMs]);

  const undo = useCallback(() => {
    if (historyRef.current.length === 0) {
      return;
    }
    const previousState = historyRef.current[historyRef.current.length - 1];
    const currentSnapshot = captureRef.current();
    const nextFuture = [currentSnapshot, ...futureRef.current];
    const cappedFuture =
      nextFuture.length > maxLimit ? nextFuture.slice(0, maxLimit) : nextFuture;
    const newHistory = historyRef.current.slice(0, -1);

    historyRef.current = newHistory;
    futureRef.current = cappedFuture;
    lastCallTimeRef.current = 0;

    setCanUndo(newHistory.length > 0);
    setCanRedo(true);

    restoreRef.current(previousState);
  }, [maxLimit]);

  const redo = useCallback(() => {
    if (futureRef.current.length === 0) {
      return;
    }
    const nextState = futureRef.current[0];
    const currentSnapshot = captureRef.current();
    const nextHistory = [...historyRef.current, currentSnapshot];
    const cappedHistory =
      nextHistory.length > maxLimit
        ? nextHistory.slice(nextHistory.length - maxLimit)
        : nextHistory;
    const newFuture = futureRef.current.slice(1);

    historyRef.current = cappedHistory;
    futureRef.current = newFuture;
    lastCallTimeRef.current = 0;

    setCanUndo(true);
    setCanRedo(newFuture.length > 0);

    restoreRef.current(nextState);
  }, [maxLimit]);

  return {
    takeSnapshot,
    undo,
    redo,
    canUndo,
    canRedo,
  };
}
