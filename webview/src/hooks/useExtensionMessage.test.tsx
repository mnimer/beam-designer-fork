/**
 * useExtensionMessage Unit Tests
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React, { useState } from 'react';
import { useExtensionMessage } from './useExtensionMessage';
import type { HostToWebviewCommand } from '../utils/protocol';

// These tests exercise the listener plumbing with synthetic command names that
// are not part of the host protocol, so they are cast to the protocol type.
const cmd = (name: string) => name as HostToWebviewCommand;

describe('useExtensionMessage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('invokes handler when window receives message with matching command', () => {
    const handler = vi.fn();

    const TestComponent = () => {
      useExtensionMessage(cmd('testLoaded'), handler);
      return <div>Test</div>;
    };

    render(<TestComponent />);

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { command: 'testLoaded', payload: [1, 2, 3] }
        })
      );
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ command: 'testLoaded', payload: [1, 2, 3] });
  });

  it('ignores messages with different commands or invalid data payloads', () => {
    const handler = vi.fn();

    const TestComponent = () => {
      useExtensionMessage(cmd('expectedCommand'), handler);
      return <div>Test</div>;
    };

    render(<TestComponent />);

    act(() => {
      // Different command
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { command: 'otherCommand', payload: 'bar' }
        })
      );

      // Primitive string payload
      window.dispatchEvent(
        new MessageEvent('message', {
          data: 'string-not-object'
        })
      );

      // Null payload
      window.dispatchEvent(
        new MessageEvent('message', {
          data: null
        })
      );
    });

    expect(handler).not.toHaveBeenCalled();
  });

  it('supports an array of commands and fires for any matching command', () => {
    const handler = vi.fn();

    const TestComponent = () => {
      useExtensionMessage(['topicsLoaded', 'subscriptionsLoaded'], handler);
      return <div>Multi-command</div>;
    };

    render(<TestComponent />);

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { command: 'topicsLoaded', topics: ['topic-a'] }
        })
      );
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { command: 'subscriptionsLoaded', subscriptions: ['sub-a'] }
        })
      );
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { command: 'otherLoaded' }
        })
      );
    });

    expect(handler).toHaveBeenCalledTimes(2);
    expect(handler).toHaveBeenNthCalledWith(1, { command: 'topicsLoaded', topics: ['topic-a'] });
    expect(handler).toHaveBeenNthCalledWith(2, { command: 'subscriptionsLoaded', subscriptions: ['sub-a'] });
  });

  // CRITICAL REQUIREMENT: Stale closure guarantee test
  it('guarantees handlers read latest state and props without stale closures', () => {
    let capturedCounterValue: number | null = null;

    const StaleClosureProbe: React.FC = () => {
      const [counter, setCounter] = useState(0);

      // Consumer passes an inline arrow function capturing local counter state.
      // In older implementations, this effect only registered on first render and
      // captured counter = 0 forever.
      useExtensionMessage(cmd('ping'), () => {
        capturedCounterValue = counter;
      });

      return (
        <div>
          <span data-testid="counter-val">{counter}</span>
          <button type="button" onClick={() => setCounter(c => c + 1)}>Increment</button>
        </div>
      );
    };

    render(<StaleClosureProbe />);

    const incrementBtn = screen.getByRole('button', { name: 'Increment' });

    // Simulate user state changes causing re-renders
    fireEvent.click(incrementBtn);
    fireEvent.click(incrementBtn);
    fireEvent.click(incrementBtn);

    expect(screen.getByTestId('counter-val')).toHaveTextContent('3');

    // Dispatch extension host message
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { command: 'ping' }
        })
      );
    });

    // The handler MUST see 3, not the first-render 0
    expect(capturedCounterValue).toBe(3);
  });

  it('guarantees removeEventListener cleanup is called on unmount', () => {
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
    const handler = vi.fn();

    const TestComponent = () => {
      useExtensionMessage(cmd('testCleanup'), handler);
      return <div>Cleanup Test</div>;
    };

    const { unmount } = render(<TestComponent />);

    expect(removeEventListenerSpy).not.toHaveBeenCalledWith('message', expect.any(Function));

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('message', expect.any(Function));
  });
});
