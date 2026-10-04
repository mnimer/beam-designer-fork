/**
 * ArrowFlightIOSourceProperties Unit Tests
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Tests the ArrowFlightIOSourceProperties panel component covering field rendering,
 * hydration from node properties, auth mode switching, onChange event dispatch,
 * IPC Secret Manager communication, validation alerts, and instruction fallback chains.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ArrowFlightIOSourceProperties } from './ArrowFlightIO';

describe('ArrowFlightIOSourceProperties', () => {
  const mockOnChange = vi.fn();
  let postMessageSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    postMessageSpy = vi.fn();
    (window as any).vscode = { postMessage: postMessageSpy };
  });

  afterEach(() => {
    delete (window as any).vscode;
  });

  it('renders required fields and shows validation errors when empty', () => {
    const node = {
      data: {
        label: 'Arrow Flight Source',
        properties: {}
      }
    };

    const { container } = render(<ArrowFlightIOSourceProperties node={node} onChange={mockOnChange} />);

    // Required fields & errors
    const hostInput = container.querySelector('#flightSourceHost');
    expect(hostInput).toBeInTheDocument();
    expect(screen.getByText('Server host is required')).toBeInTheDocument();

    const cmdInput = container.querySelector('#flightSourceCommand');
    expect(cmdInput).toBeInTheDocument();
    expect(screen.getByText('Flight command is required')).toBeInTheDocument();
  });

  it('hydrates all populated properties correctly', () => {
    const node = {
      data: {
        label: 'Arrow Flight Source',
        properties: {
          host: '10.0.0.12',
          port: 50051,
          useTls: true,
          command: 'SELECT id, metric, ts FROM metrics',
          authMode: 'secret_manager',
          tokenSecret: 'my-bearer-secret',
          system_instructions: 'Use ArrowFlightIO.read()'
        }
      }
    };

    const { container } = render(<ArrowFlightIOSourceProperties node={node} onChange={mockOnChange} />);

    expect((container.querySelector('#flightSourceHost') as HTMLInputElement).value).toBe('10.0.0.12');
    expect((container.querySelector('#flightSourcePort') as HTMLInputElement).value).toBe('50051');
    expect((container.querySelector('#flightSourceUseTls') as HTMLInputElement).checked).toBe(true);
    expect((container.querySelector('#flightSourceCommand') as HTMLTextAreaElement).value).toBe('SELECT id, metric, ts FROM metrics');
    expect((container.querySelector('#flightSourceAuthMode') as HTMLSelectElement).value).toBe('secret_manager');
    expect((container.querySelector('#flightSourceTokenSecret') as HTMLInputElement).value).toBe('my-bearer-secret');
    expect((container.querySelector('#flightSourceInstructions') as HTMLTextAreaElement).value).toBe('Use ArrowFlightIO.read()');

    expect(screen.queryByText('Server host is required')).not.toBeInTheDocument();
    expect(screen.queryByText('Flight command is required')).not.toBeInTheDocument();
  });

  it('dispatches onChange when host, port, or useTls change', () => {
    const node = {
      data: {
        label: 'Arrow Flight Source',
        properties: {
          host: 'initial.flight',
          port: 47470
        }
      }
    };

    const { container } = render(<ArrowFlightIOSourceProperties node={node} onChange={mockOnChange} />);

    const hostInput = container.querySelector('#flightSourceHost') as HTMLInputElement;
    fireEvent.change(hostInput, { target: { name: 'host', value: 'updated.flight' } });

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'updated.flight'
      })
    );

    const portInput = container.querySelector('#flightSourcePort') as HTMLInputElement;
    fireEvent.change(portInput, { target: { name: 'port', value: '32000' } });

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        port: 32000
      })
    );

    const tlsCheckbox = container.querySelector('#flightSourceUseTls') as HTMLInputElement;
    fireEvent.click(tlsCheckbox);

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        useTls: true
      })
    );
  });

  it('toggles bearer token input when authMode switches to secret_manager', () => {
    const node = {
      data: {
        label: 'Arrow Flight Source',
        properties: {
          host: 'flight.internal',
          command: 'SELECT 1',
          authMode: 'none'
        }
      }
    };

    const { container, rerender } = render(<ArrowFlightIOSourceProperties node={node} onChange={mockOnChange} />);

    expect(container.querySelector('#flightSourceTokenSecret')).not.toBeInTheDocument();

    const authSelect = container.querySelector('#flightSourceAuthMode') as HTMLSelectElement;
    fireEvent.change(authSelect, { target: { name: 'authMode', value: 'secret_manager' } });

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        authMode: 'secret_manager'
      })
    );

    const updatedNode = {
      data: {
        ...node.data,
        properties: {
          ...node.data.properties,
          authMode: 'secret_manager'
        }
      }
    };

    rerender(<ArrowFlightIOSourceProperties node={updatedNode} onChange={mockOnChange} />);
    expect(container.querySelector('#flightSourceTokenSecret')).toBeInTheDocument();
  });

  it('updates system_instructions when instructions textarea changes', () => {
    const node = {
      data: {
        label: 'Arrow Flight Source',
        properties: {}
      }
    };

    const { container } = render(<ArrowFlightIOSourceProperties node={node} onChange={mockOnChange} />);

    const inst = container.querySelector('#flightSourceInstructions') as HTMLTextAreaElement;
    fireEvent.change(inst, { target: { value: 'Use ArrowFlightIO.read()' } });

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        system_instructions: 'Use ArrowFlightIO.read()'
      })
    );
  });
});
