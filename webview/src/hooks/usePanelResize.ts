/**
 * @fileoverview Reusable hook for panel resizing with requestAnimationFrame throttling.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

import { useState, useRef, useEffect, useCallback } from 'react';

/**
 * Configuration options for the `usePanelResize` hook.
 */
export interface UsePanelResizeOptions {
  /**
   * The axis along which resizing occurs.
   * - 'x': horizontal resizing (e.g. sidebars or property panels).
   * - 'y': vertical resizing (e.g. bottom panels or drawers).
   */
  axis: 'x' | 'y';

  /**
   * Initial size in pixels, or a lazy initializer function.
   */
  initialSize: number | (() => number);

  /**
   * Minimum permitted size in pixels.
   */
  min?: number;

  /**
   * Maximum permitted size in pixels, or a function returning the maximum size.
   */
  max?: number | (() => number);

  /**
   * Growth direction relative to mouse coordinates:
   * - 'normal': panel size increases as coordinate increases (e.g. left-to-right, top-to-bottom).
   * - 'reverse': panel size increases as coordinate decreases (e.g. right-to-left, bottom-to-top).
   * @default 'normal'
   */
  direction?: 'normal' | 'reverse';

  /**
   * Custom function to calculate the new size from the mouse event.
   * When provided, overrides the default coordinate delta calculation.
   * Clamping against `min`/`max` is still applied if specified.
   *
   * @param event The latest mouse event.
   * @param startSize The size of the panel when resize started.
   * @param startPos The initial mouse position along the active axis.
   * @returns The computed new size in pixels.
   */
  computeSize?: (event: MouseEvent, startSize: number, startPos: number) => number;

  /**
   * Cursor style to apply to document.body while dragging (e.g. 'col-resize' or 'row-resize').
   */
  cursor?: 'col-resize' | 'row-resize';

  /**
   * Optional callback invoked when resizing completes on mouseup.
   * Useful for persisting final panel dimensions (e.g. to localStorage).
   *
   * @param size The final size in pixels.
   */
  onResizeEnd?: (size: number) => void;
}

/**
 * Return value of the `usePanelResize` hook.
 */
export interface UsePanelResizeReturn {
  /**
   * Current size of the panel in pixels.
   */
  size: number;

  /**
   * Function to manually update the panel size.
   */
  setSize: React.Dispatch<React.SetStateAction<number>>;

  /**
   * Whether resizing is currently in progress.
   */
  isResizing: boolean;

  /**
   * Event handler to attach to the resize handle/divider (e.g. onMouseDown).
   */
  startResize: (e: React.MouseEvent | MouseEvent) => void;
}

/**
 * Reusable hook to handle mouse-driven panel resizing with requestAnimationFrame throttling.
 * Coalesces rapid mousemove events into animation frames, applies cursor/user-select body styles,
 * and cleans up listeners and pending frames on mouseup or unmount.
 *
 * @param options Configuration options for panel resize.
 * @returns State and event handlers for managing panel resizing.
 */
export function usePanelResize(options: UsePanelResizeOptions): UsePanelResizeReturn {
  const { initialSize, cursor } = options;

  const [size, setSize] = useState<number>(initialSize);
  const [isResizing, setIsResizing] = useState(false);

  const currentSizeRef = useRef<number>(size);
  const startPosRef = useRef<number>(0);
  const startSizeRef = useRef<number>(0);
  const latestMouseEventRef = useRef<MouseEvent | null>(null);
  const rafIdRef = useRef<number | null>(null);

  // Keep options in a ref updated via effect to avoid reading/writing during render
  const optionsRef = useRef<UsePanelResizeOptions>(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  useEffect(() => {
    currentSizeRef.current = size;
  }, [size]);

  const startResize = useCallback((e: React.MouseEvent | MouseEvent) => {
    if (typeof e.preventDefault === 'function') {
      e.preventDefault();
    }
    const currentAxis = optionsRef.current.axis;
    startPosRef.current = currentAxis === 'x' ? e.clientX : e.clientY;
    startSizeRef.current = currentSizeRef.current;
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    let originalCursor = '';
    let originalUserSelect = '';
    if (typeof document !== 'undefined' && document.body) {
      originalCursor = document.body.style.cursor;
      originalUserSelect = document.body.style.userSelect;
      if (cursor) {
        document.body.style.cursor = cursor;
      }
      document.body.style.userSelect = 'none';
    }

    const restoreBodyStyles = () => {
      if (typeof document !== 'undefined' && document.body) {
        document.body.style.cursor = originalCursor;
        document.body.style.userSelect = originalUserSelect;
      }
    };

    const calculateNewSize = (event: MouseEvent): number => {
      const opts = optionsRef.current;
      const {
        axis,
        direction = 'normal',
        computeSize,
        min,
        max,
      } = opts;

      let newSize: number;
      if (computeSize) {
        newSize = computeSize(event, startSizeRef.current, startPosRef.current);
      } else {
        const pos = axis === 'x' ? event.clientX : event.clientY;
        const delta = direction === 'reverse'
          ? startPosRef.current - pos
          : pos - startPosRef.current;
        newSize = startSizeRef.current + delta;
      }

      const effectiveMin = min;
      const effectiveMax = typeof max === 'function' ? max() : max;

      if (effectiveMin !== undefined && newSize < effectiveMin) {
        newSize = effectiveMin;
      }
      if (effectiveMax !== undefined && newSize > effectiveMax) {
        newSize = effectiveMax;
      }

      return newSize;
    };

    const handleMouseMove = (event: MouseEvent) => {
      latestMouseEventRef.current = event;
      if (rafIdRef.current === null) {
        let callbackRan = false;
        const id = window.requestAnimationFrame(() => {
          callbackRan = true;
          rafIdRef.current = null;
          if (!latestMouseEventRef.current) return;
          const nextSize = calculateNewSize(latestMouseEventRef.current);
          setSize(nextSize);
          currentSizeRef.current = nextSize;
        });
        if (!callbackRan) {
          rafIdRef.current = id;
        }
      }
    };

    const handleMouseUp = () => {
      if (rafIdRef.current !== null) {
        window.cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
        if (latestMouseEventRef.current) {
          const nextSize = calculateNewSize(latestMouseEventRef.current);
          setSize(nextSize);
          currentSizeRef.current = nextSize;
        }
      }
      latestMouseEventRef.current = null;
      restoreBodyStyles();
      setIsResizing(false);
      optionsRef.current.onResizeEnd?.(currentSizeRef.current);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      if (rafIdRef.current !== null) {
        window.cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      latestMouseEventRef.current = null;
      restoreBodyStyles();
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, cursor]);

  return {
    size,
    setSize,
    isResizing,
    startResize,
  };
}
