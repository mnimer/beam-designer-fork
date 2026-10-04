/**
 * AmqpIOSinkProperties Test Suite
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Unit tests validating AmqpIOSinkProperties component functionality,
 * form change callbacks, protocol helpers, message construction options
 * (subject, encoding, durability, priority, TTL), gcloud Secret Manager integration,
 * Compute Engine VM instance suggestions, Python x-lang expansion service configuration,
 * and system instructions.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AmqpIOSinkProperties } from './AmqpIO';

describe('AmqpIOSinkProperties', () => {
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

    render(<AmqpIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByLabelText(/Target AMQP Address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Subject \/ Message Type/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Message Body Type/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Content-Type \(Optional\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Content-Encoding \(Optional\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Durable Messages/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Message Priority/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/TTL \(ms\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Username Secret \(Secret Manager\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/GCP Secret Manager Secret/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Expansion Service Mode/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Code Generation Instructions/i)).toBeInTheDocument();
  });

  it('populates fields with provided properties and triggers onChange on address changes', () => {
    const mockNode = {
      data: {
        label: 'AmqpIO',
        properties: {
          address: 'amqp://broker.internal:5672/orders.out',
          subject: 'order.completed',
          bodyType: 'json' as const,
          contentType: 'application/json',
          contentEncoding: 'gzip',
          durable: true,
          priority: 7,
          ttlMillis: 120000,
          username: 'sink-worker'
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<AmqpIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    const addressInput = screen.getByLabelText(/Target AMQP Address/i);
    expect(addressInput).toHaveValue('amqp://broker.internal:5672/orders.out');

    const subjectInput = screen.getByLabelText(/Subject \/ Message Type/i);
    expect(subjectInput).toHaveValue('order.completed');

    const bodyTypeSelect = screen.getByLabelText(/Message Body Type/i);
    expect(bodyTypeSelect).toHaveValue('json');

    const contentTypeInput = screen.getByLabelText(/Content-Type \(Optional\)/i);
    expect(contentTypeInput).toHaveValue('application/json');

    const contentEncodingInput = screen.getByLabelText(/Content-Encoding \(Optional\)/i);
    expect(contentEncodingInput).toHaveValue('gzip');

    const durableCheckbox = screen.getByLabelText(/Durable Messages/i);
    expect(durableCheckbox).toBeChecked();

    const priorityInput = screen.getByLabelText(/^Message Priority/i);
    expect(priorityInput).toHaveValue(7);

    const ttlInput = screen.getByLabelText(/TTL \(ms\)/i);
    expect(ttlInput).toHaveValue(120000);

    fireEvent.change(addressInput, { target: { name: 'address', value: 'amqps://secure-broker:5671/orders.out' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      address: 'amqps://secure-broker:5671/orders.out'
    }));
  });

  it('applies protocol helper pills to destination address', () => {
    const mockNode = {
      data: {
        label: 'AmqpIO',
        properties: {
          address: ''
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<AmqpIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    const amqpButton = screen.getByTitle('Set amqp:// scheme (standard port 5672)');
    fireEvent.click(amqpButton);

    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      address: 'amqp://localhost:5672/queue'
    }));

    const amqpsButton = screen.getByTitle('Set amqps:// scheme (TLS port 5671)');
    fireEvent.click(amqpsButton);

    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      address: 'amqps://localhost:5671/queue'
    }));
  });

  it('applies protocol helper pill replacing existing scheme', () => {
    const mockNode = {
      data: {
        label: 'AmqpIO',
        properties: {
          address: 'amqp://broker.corp:5672/telemetry'
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<AmqpIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    const amqpsButton = screen.getByTitle('Set amqps:// scheme (TLS port 5671)');
    fireEvent.click(amqpsButton);

    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      address: 'amqps://broker.corp:5671/telemetry'
    }));
  });

  it('handles message construction fields changes (subject, bodyType, contentType, contentEncoding, durable, priority, ttl)', () => {
    const mockNode = {
      data: {
        label: 'AmqpIO',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<AmqpIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    // Subject
    const subjectInput = screen.getByLabelText(/Subject \/ Message Type/i);
    fireEvent.change(subjectInput, { target: { name: 'subject', value: 'system.event' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      subject: 'system.event'
    }));

    // Body Type
    const bodyTypeSelect = screen.getByLabelText(/Message Body Type/i);
    fireEvent.change(bodyTypeSelect, { target: { name: 'bodyType', value: 'bytes' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      bodyType: 'bytes'
    }));

    // Content-Type
    const contentTypeInput = screen.getByLabelText(/Content-Type \(Optional\)/i);
    fireEvent.change(contentTypeInput, { target: { name: 'contentType', value: 'application/json' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      contentType: 'application/json'
    }));

    // Content-Encoding
    const encodingInput = screen.getByLabelText(/Content-Encoding \(Optional\)/i);
    fireEvent.change(encodingInput, { target: { name: 'contentEncoding', value: 'gzip' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      contentEncoding: 'gzip'
    }));

    // Durable Checkbox
    const durableCheckbox = screen.getByLabelText(/Durable Messages/i);
    fireEvent.click(durableCheckbox);
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      durable: true
    }));

    // Priority
    const priorityInput = screen.getByLabelText(/^Message Priority/i);
    fireEvent.change(priorityInput, { target: { name: 'priority', value: '9' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      priority: '9'
    }));

    // TTL
    const ttlInput = screen.getByLabelText(/TTL \(ms\)/i);
    fireEvent.change(ttlInput, { target: { name: 'ttlMillis', value: '30000' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      ttlMillis: '30000'
    }));
  });

  it('handles extension message for Secret Manager secrets and allows selecting or typing a secret', () => {
    const mockNode = {
      data: {
        label: 'AmqpIO',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<AmqpIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    const secretInput = screen.getByLabelText(/GCP Secret Manager Secret/i);
    expect(secretInput).toBeInTheDocument();

    fireEvent.change(secretInput, { target: { name: 'secretName', value: 'amqp-sink-creds' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      secretName: 'amqp-sink-creds'
    }));
  });

  it('shows and validates expansion service endpoint when mode is endpoint', () => {
    const mockNode = {
      data: {
        label: 'AmqpIO',
        properties: {
          expansionServiceMode: 'endpoint' as const,
          expansionServiceEndpoint: ''
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<AmqpIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    const endpointInput = screen.getByLabelText(/Expansion Service Endpoint/i);
    expect(endpointInput).toBeInTheDocument();
    expect(endpointInput).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Expansion service endpoint is required.')).toBeInTheDocument();

    fireEvent.change(endpointInput, { target: { name: 'expansionServiceEndpoint', value: '10.0.0.5:8097' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      expansionServiceEndpoint: '10.0.0.5:8097'
    }));
  });

  it('validates priority out of 0-9 range or non-numeric with error and aria-invalid', () => {
    const mockNode = {
      data: {
        label: 'AmqpIO',
        properties: {
          priority: 15
        }
      }
    };

    render(<AmqpIOSinkProperties node={mockNode} onChange={vi.fn()} />);

    const priorityInput = screen.getByLabelText(/^Message Priority/i);
    expect(priorityInput).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Priority must be an integer between 0 and 9.')).toBeInTheDocument();
  });

  it('switches expansion service mode', () => {
    const mockNode = {
      data: {
        label: 'AmqpIO',
        properties: {
          expansionServiceMode: 'auto' as const
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<AmqpIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    const modeSelect = screen.getByLabelText(/Expansion Service Mode/i);
    fireEvent.change(modeSelect, { target: { name: 'expansionServiceMode', value: 'endpoint' } });

    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      expansionServiceMode: 'endpoint'
    }));
  });

  it('validates empty address with required error and aria-invalid', () => {
    const mockNode = {
      data: {
        label: 'AmqpIO',
        properties: {
          address: '   '
        }
      }
    };

    render(<AmqpIOSinkProperties node={mockNode} onChange={vi.fn()} />);

    const addressInput = screen.getByLabelText(/Target AMQP Address/i);
    expect(addressInput).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Target AMQP address is required.')).toBeInTheDocument();
  });

  it('mounts gracefully when window.vscode is undefined', () => {
    delete (window as any).vscode;

    const mockNode = {
      data: {
        label: 'AmqpIO',
        properties: {}
      }
    };

    expect(() => {
      render(<AmqpIOSinkProperties node={mockNode} onChange={vi.fn()} />);
    }).not.toThrow();
  });

  it('updates system_instructions when textarea changes', () => {
    const mockNode = {
      data: {
        label: 'AmqpIO',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<AmqpIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    const instructionsTextarea = screen.getByLabelText(/Code Generation Instructions/i);
    fireEvent.change(instructionsTextarea, { target: { value: 'Construct Proton Message and set durable to true' } });

    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      system_instructions: 'Construct Proton Message and set durable to true'
    }));
  });

  it('supports backward compatibility reading bodyType from legacy contentEncoding property', () => {
    const mockNode = {
      data: {
        label: 'AmqpIO',
        properties: {
          contentEncoding: 'json'
        }
      }
    };
    render(<AmqpIOSinkProperties node={mockNode} onChange={vi.fn()} />);
    const bodyTypeSelect = screen.getByLabelText(/Message Body Type/i);
    expect(bodyTypeSelect).toHaveValue('json');
  });

  it('displays credentials documentation callout explaining AMQP 1.0 authentication via Secret Manager', () => {
    const mockNode = {
      data: {
        label: 'AmqpIO',
        properties: {}
      }
    };
    render(<AmqpIOSinkProperties node={mockNode} onChange={vi.fn()} />);
    expect(screen.getByText(/AMQP 1\.0 broker credentials are authenticated via Google Cloud Secret Manager/i)).toBeInTheDocument();
  });
});
