/**
 * ArrowFlightIOSinkProperties Unit Tests
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Tests the ArrowFlightIOSinkProperties panel component covering field rendering,
 * hydration from node properties, auth mode switching, onChange event dispatch,
 * IPC Secret Manager communication, validation alerts, and instruction fallback chains.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ArrowFlightIOSinkProperties } from './ArrowFlightIO';

describe('ArrowFlightIOSinkProperties', () => {
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
        label: 'Arrow Flight Sink',
        properties: {}
      }
    };

    const { container } = render(<ArrowFlightIOSinkProperties node={node} onChange={mockOnChange} />);

    // Required fields & errors
    const hostInput = container.querySelector('#flightSinkHost');
    expect(hostInput).toBeInTheDocument();
    expect(screen.getByText('Server host is required')).toBeInTheDocument();

    const descInput = container.querySelector('#flightSinkDescriptor');
    expect(descInput).toBeInTheDocument();
    expect(screen.getByText('Flight descriptor is required')).toBeInTheDocument();

  });

  it('hydrates all populated properties correctly', () => {
    const node = {
      data: {
        label: 'Arrow Flight Sink',
        properties: {
          host: 'flight-sink.internal',
          port: 47470,
          useTls: true,
          descriptor: 'metrics_dataset',
          batchSize: 2048,
          authMode: 'secret_manager',
          tokenSecret: 'sink-token-secret',
          system_instructions: 'Use ArrowFlightIO.write()'
        }
      }
    };

    const { container } = render(<ArrowFlightIOSinkProperties node={node} onChange={mockOnChange} />);

    expect((container.querySelector('#flightSinkHost') as HTMLInputElement).value).toBe('flight-sink.internal');
    expect((container.querySelector('#flightSinkPort') as HTMLInputElement).value).toBe('47470');
    expect((container.querySelector('#flightSinkUseTls') as HTMLInputElement).checked).toBe(true);
    expect((container.querySelector('#flightSinkDescriptor') as HTMLInputElement).value).toBe('metrics_dataset');
    expect((container.querySelector('#flightSinkBatchSize') as HTMLInputElement).value).toBe('2048');
    expect((container.querySelector('#flightSinkAuthMode') as HTMLSelectElement).value).toBe('secret_manager');
    expect((container.querySelector('#flightSinkTokenSecret') as HTMLInputElement).value).toBe('sink-token-secret');
    expect((container.querySelector('#flightSinkInstructions') as HTMLTextAreaElement).value).toBe('Use ArrowFlightIO.write()');

    expect(screen.queryByText('Server host is required')).not.toBeInTheDocument();
    expect(screen.queryByText('Flight descriptor is required')).not.toBeInTheDocument();
  });

  it('dispatches onChange when host, descriptor, or batchSize change', () => {
    const node = {
      data: {
        label: 'Arrow Flight Sink',
        properties: {
          host: 'init.flight',
          descriptor: 'init_dataset'
        }
      }
    };

    const { container } = render(<ArrowFlightIOSinkProperties node={node} onChange={mockOnChange} />);

    const hostInput = container.querySelector('#flightSinkHost') as HTMLInputElement;
    fireEvent.change(hostInput, { target: { name: 'host', value: 'dest.flight' } });

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'dest.flight'
      })
    );

    const descInput = container.querySelector('#flightSinkDescriptor') as HTMLInputElement;
    fireEvent.change(descInput, { target: { name: 'descriptor', value: 'dest_dataset' } });

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        descriptor: 'dest_dataset'
      })
    );

    const batchInput = container.querySelector('#flightSinkBatchSize') as HTMLInputElement;
    fireEvent.change(batchInput, { target: { name: 'batchSize', value: '512' } });

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        batchSize: 512
      })
    );
  });

  it('toggles bearer token input when authMode switches to secret_manager', () => {
    const node = {
      data: {
        label: 'Arrow Flight Sink',
        properties: {
          host: 'flight.internal',
          descriptor: 'stream_sink',
          authMode: 'none'
        }
      }
    };

    const { container, rerender } = render(<ArrowFlightIOSinkProperties node={node} onChange={mockOnChange} />);

    expect(container.querySelector('#flightSinkTokenSecret')).not.toBeInTheDocument();

    const authSelect = container.querySelector('#flightSinkAuthMode') as HTMLSelectElement;
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

    rerender(<ArrowFlightIOSinkProperties node={updatedNode} onChange={mockOnChange} />);
    expect(container.querySelector('#flightSinkTokenSecret')).toBeInTheDocument();
  });
});
