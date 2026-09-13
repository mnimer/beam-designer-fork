/**
 * useExtensionMessage Hook
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Subscribes to window message events originating from the VS Code extension host.
 * Guarantees window.removeEventListener cleanup on unmount or command changes.
 * 
 * Architectural Decisions:
 * - Solves the stale-closure bug (where message handlers capture first-render props/state)
 *   by holding the latest handler callback in a mutable React ref updated on every render.
 * - Dispatches via handlerRef.current, ensuring consumers passing inline arrow functions
 *   always read the latest component state/props without recreating listeners.
 * - Supports single command strings or arrays of command strings.
 */

import { useEffect, useRef } from 'react';

/**
 * Subscribes to window message events originating from the VS Code extension host.
 *
 * @template T Type of the expected message payload
 * @param command Single command string or array of command strings to filter for
 * @param handler Callback invoked when a message with a matching command is received
 */
export function useExtensionMessage<T = any>(
  command: string | string[],
  handler: (message: T) => void
): void {
  // NOTE: Store the latest handler in a mutable ref updated on every render.
  // This guarantees that even if the consumer provides an inline arrow function capturing
  // fast-changing state/props, invocations always execute the freshest closure without
  // needing to re-bind window event listeners.
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  // Derive a stable dependency key so array references don't re-trigger effect needlessly
  const commandKey = Array.isArray(command) ? [...command].sort().join(',') : command;

  useEffect(() => {
    // Fail fast if command is invalid or empty
    if (!command || (Array.isArray(command) && command.length === 0)) {
      return;
    }

    /**
     * Message event dispatcher verifying command match before delegating to handlerRef.
     */
    const handleMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== 'object') {
        return;
      }

      const isMatch = Array.isArray(command)
        ? command.includes(data.command)
        : data.command === command;

      if (isMatch) {
        handlerRef.current(data as T);
      }
    };

    window.addEventListener('message', handleMessage);

    // Guaranteed cleanup on unmount or when command filter criteria changes
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [commandKey]);
}
