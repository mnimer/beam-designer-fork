/**
 * AmqpIOSourceProperties Test Suite
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Unit tests validating AmqpIOSourceProperties component functionality,
 * form change callbacks, protocol helpers, addresses validation,
 * bounded stream limits, and system instructions.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AmqpIOSourceProperties } from './AmqpIO';

describe('AmqpIOSourceProperties', () => {
  const originalPostMessage = (window as any).vscode?.postMessage;

  beforeEach(() => {
    (window as any).vscode = {
      postMessage: vi.fn()
    };
  });

  afterEach(() => {
    if (originalPostMessage) {
      (window as any).vscode.postMessage = originalPostMessage;
    } else {
      delete (window as any).vscode;
    }
  });

  it('renders default fields with documentation tooltips and placeholders', () => {
    const mockNode = {
      data: {
        label: 'AmqpIO',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<AmqpIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByLabelText(/Broker Addresses/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Username Secret \(Secret Manager\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/GCP Secret Manager Secret/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Max Records/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Max Read Time \(s\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Expansion Service Mode/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Code Generation Instructions/i)).toBeInTheDocument();
  });

  it('populates fields with provided properties and triggers onChange on addresses change', () => {
    const mockNode = {
      data: {
        label: 'AmqpIO',
        properties: {
          addresses: 'amqp://broker1.internal:5672/queue',
          username: 'worker-user',
          maxNumRecords: 500,
          maxReadTime: 30,
          expansionServiceMode: 'auto' as const
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<AmqpIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const addressInput = screen.getByLabelText(/Broker Addresses/i);
    expect(addressInput).toHaveValue('amqp://broker1.internal:5672/queue');

    const usernameInput = screen.getByLabelText(/Username/i);
    expect(usernameInput).toHaveValue('worker-user');

    const maxRecordsInput = screen.getByLabelText(/Max Records/i);
    expect(maxRecordsInput).toHaveValue(500);

    const maxReadTimeInput = screen.getByLabelText(/Max Read Time \(s\)/i);
    expect(maxReadTimeInput).toHaveValue(30);

    fireEvent.change(addressInput, { target: { name: 'addresses', value: 'amqps://secure-broker:5671/queue' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      addresses: 'amqps://secure-broker:5671/queue'
    }));
  });

  it('handles array formatted addresses gracefully', () => {
    const mockNode = {
      data: {
        label: 'AmqpIO',
        properties: {
          addresses: ['amqp://host1:5672/q1', 'amqp://host2:5672/q2']
        }
      }
    };

    render(<AmqpIOSourceProperties node={mockNode} onChange={vi.fn()} />);

    const addressInput = screen.getByLabelText(/Broker Addresses/i);
    expect(addressInput).toHaveValue('amqp://host1:5672/q1\namqp://host2:5672/q2');
  });

  it('applies protocol helper pills to broker addresses', () => {
    const mockNode = {
      data: {
        label: 'AmqpIO',
        properties: {
          addresses: ''
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<AmqpIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const amqpButton = screen.getByTitle('Set amqp:// scheme (standard port 5672)');
    fireEvent.click(amqpButton);

    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      addresses: 'amqp://localhost:5672/queue'
    }));

    const amqpsButton = screen.getByTitle('Set amqps:// scheme (TLS port 5671)');
    fireEvent.click(amqpsButton);

    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      addresses: 'amqps://localhost:5671/queue'
    }));
  });

  it('applies protocol helper pill replacing existing scheme and swapping default port', () => {
    const mockNode = {
      data: {
        label: 'AmqpIO',
        properties: {
          addresses: 'amqp://broker.corp:5672/events'
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<AmqpIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const amqpsButton = screen.getByTitle('Set amqps:// scheme (TLS port 5671)');
    fireEvent.click(amqpsButton);

    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      addresses: 'amqps://broker.corp:5671/events'
    }));
  });

  it('converts all addresses and swaps ports in multi-address lists with protocol helper', () => {
    const mockNode = {
      data: {
        label: 'AmqpIO',
        properties: {
          addresses: 'amqp://host-a:5672/queue\namqp://host-b:5672/queue'
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<AmqpIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const amqpsButton = screen.getByTitle('Set amqps:// scheme (TLS port 5671)');
    fireEvent.click(amqpsButton);

    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      addresses: 'amqps://host-a:5671/queue\namqps://host-b:5671/queue'
    }));
  });

  it('validates empty addresses with required error and aria-invalid', () => {
    const mockNode = {
      data: {
        label: 'AmqpIO',
        properties: {
          addresses: '   '
        }
      }
    };

    render(<AmqpIOSourceProperties node={mockNode} onChange={vi.fn()} />);

    const addressInput = screen.getByLabelText(/Broker Addresses/i);
    expect(addressInput).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('At least one AMQP address is required.')).toBeInTheDocument();
  });

  it('updates system_instructions when textarea changes', () => {
    const mockNode = {
      data: {
        label: 'AmqpIO',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<AmqpIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const instructionsTextarea = screen.getByLabelText(/Code Generation Instructions/i);
    fireEvent.change(instructionsTextarea, { target: { value: 'Parse JSON payload using Jackson' } });

    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      system_instructions: 'Parse JSON payload using Jackson'
    }));
  });
});
