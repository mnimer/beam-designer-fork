/**
 * PulsarIOSinkProperties Test Suite
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Comprehensive unit tests validating PulsarIOSinkProperties component functionality,
 * form change callbacks, protocol helpers, topic format validation, gcloud Secret Manager integration,
 * payload serialization modes, producer tuning options,
 * Python x-lang expansion service options, and prompt instructions fallback.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PulsarIOSinkProperties } from './PulsarIO';

describe('PulsarIOSinkProperties', () => {
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

  it('renders default fields with documentation tooltips and suppresses admin URL and producer tuning', () => {
    const mockNode = {
      data: {
        label: 'Pulsar Sink',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<PulsarIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByLabelText(/Pulsar Client Service URL/i)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('http://localhost:8080')).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Destination Pulsar Topic/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Authentication Mode/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Message Payload Encoding/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Expansion Service Mode/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Code Generation Instructions/i)).toBeInTheDocument();

    // Verify pruned fields are not rendered
    expect(screen.queryByLabelText(/Message Partition Key Field/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Producer Name Identifier/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^Compression$/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^Message Routing$/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Block if Queue Full/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Enable Batching/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Max Pending Messages/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Send Timeout/i)).not.toBeInTheDocument();
  });

  it('populates fields with provided properties and triggers onChange for serialization settings', () => {
    const mockNode = {
      data: {
        label: 'Pulsar Sink',
        properties: {
          clientUrl: 'pulsar://pulsar.prod:6650',
          topic: 'persistent://public/default/alerts',
          valueType: 'JSON' as const
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<PulsarIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByLabelText(/Pulsar Client Service URL/i)).toHaveValue('pulsar://pulsar.prod:6650');
    expect(screen.getByLabelText(/Destination Pulsar Topic/i)).toHaveValue('persistent://public/default/alerts');
    expect(screen.getByLabelText(/Message Payload Encoding/i)).toHaveValue('JSON');

    // Test changing valueType
    const encodingSelect = screen.getByLabelText(/Message Payload Encoding/i);
    fireEvent.change(encodingSelect, { target: { name: 'valueType', value: 'ByteArray' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      valueType: 'ByteArray'
    }));
  });

  it('applies protocol helper pills to broker client URL and suppresses admin URL', () => {
    const mockNode = {
      data: {
        label: 'Pulsar Sink',
        properties: {
          clientUrl: 'pulsar://broker:6650'
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<PulsarIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    // Test client protocol pill pulsar+ssl://
    const sslButton = screen.getByTitle('Set pulsar+ssl:// scheme');
    fireEvent.click(sslButton);
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      clientUrl: 'pulsar+ssl://broker:6650'
    }));

    // Verify admin URL controls and pills are not rendered
    expect(screen.queryByPlaceholderText('http://localhost:8080')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Set https:// scheme')).not.toBeInTheDocument();
  });

  it('validates canonical Pulsar topic format with helpful inline errors', () => {
    const mockOnChange = vi.fn();

    // 1. Missing topic
    const { rerender } = render(
      <PulsarIOSinkProperties
        node={{ data: { label: 'Pulsar Sink', properties: { clientUrl: 'pulsar://localhost:6650', topic: '' } } }}
        onChange={mockOnChange}
      />
    );
    expect(screen.getByText('Pulsar destination topic is required.')).toBeInTheDocument();

    // 2. Malformed topic
    rerender(
      <PulsarIOSinkProperties
        node={{ data: { label: 'Pulsar Sink', properties: { clientUrl: 'pulsar://localhost:6650', topic: 'simple/topic' } } }}
        onChange={mockOnChange}
      />
    );
    expect(screen.getByText(/Topic must follow format \(persistent\|non-persistent\):\/\/tenant\/namespace\/topic/i)).toBeInTheDocument();

    // 3. Valid persistent topic
    rerender(
      <PulsarIOSinkProperties
        node={{ data: { label: 'Pulsar Sink', properties: { clientUrl: 'pulsar://localhost:6650', topic: 'persistent://tenant-x/app-y/output-topic' } } }}
        onChange={mockOnChange}
      />
    );
    expect(screen.queryByText(/Topic must follow format/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Pulsar destination topic is required/i)).not.toBeInTheDocument();
  });

  it('validates missing required clientUrl with semantic error and aria-invalid', () => {
    const mockNode = {
      data: {
        label: 'Pulsar Sink',
        properties: {
          clientUrl: '',
          topic: 'persistent://public/default/events'
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<PulsarIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    const clientInput = screen.getByLabelText(/Pulsar Client Service URL/i);
    expect(clientInput).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Pulsar Client Service URL is required.')).toBeInTheDocument();
  });

  it('supports custom value serializer class with required validation', () => {
    const mockOnChange = vi.fn();

    const { rerender } = render(
      <PulsarIOSinkProperties
        node={{
          data: {
            label: 'Pulsar Sink',
            properties: {
              valueType: 'Custom' as const,
              customValueType: ''
            }
          }
        }}
        onChange={mockOnChange}
      />
    );

    const customClassInput = screen.getByLabelText(/Custom Formatter \/ Coder Class/i);
    expect(customClassInput).toBeInTheDocument();
    expect(customClassInput).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Custom formatter class is required.')).toBeInTheDocument();

    rerender(
      <PulsarIOSinkProperties
        node={{
          data: {
            label: 'Pulsar Sink',
            properties: {
              valueType: 'Custom' as const,
              customValueType: 'com.example.CustomEncoder'
            }
          }
        }}
        onChange={mockOnChange}
      />
    );
    expect(screen.queryByText('Custom formatter class is required.')).not.toBeInTheDocument();
  });

  it('handles extension message for Secret Manager secrets and allows selecting a secret in token mode', () => {
    const mockNode = {
      data: {
        label: 'Pulsar Sink',
        properties: {
          authMode: 'token' as const
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<PulsarIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    expect((window as any).vscode.postMessage).toHaveBeenCalledWith({ command: 'getSecrets' });

    // Simulate secretsLoaded message
    act(() => {
      window.dispatchEvent(new MessageEvent('message', {
        data: {
          command: 'secretsLoaded',
          secrets: [
            { name: 'pulsar-producer-token', value: 'pulsar-producer-token' }
          ]
        }
      }));
    });

    const secretDropdown = screen.getByLabelText(/Pulsar JWT Token Secret/i);
    expect(secretDropdown).toBeInTheDocument();

    fireEvent.change(secretDropdown, { target: { name: 'tokenSecretName', value: 'pulsar-producer-token' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      tokenSecretName: 'pulsar-producer-token'
    }));

    // Test refresh button
    const refreshButton = screen.getByTitle('Refresh secrets from Secret Manager');
    fireEvent.click(refreshButton);
    expect((window as any).vscode.postMessage).toHaveBeenCalledWith({ command: 'getSecrets' });
  });

  it('enforces Secret Manager usage for token auth mode and eliminates direct token entry', () => {
    const mockNode = {
      data: {
        label: 'Pulsar Sink',
        properties: {
          authMode: 'token' as const,
          tokenSecretName: 'my-sink-token-secret'
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<PulsarIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    // Direct entry should not be present
    expect(screen.queryByLabelText(/Direct/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Direct Entry/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Show token')).not.toBeInTheDocument();

    // Secret Manager secret field is present
    expect(screen.getByLabelText(/Pulsar JWT Token Secret/i)).toBeInTheDocument();
  });

  it('supports Python x-lang Expansion Service configuration in auto and endpoint modes', () => {
    const mockOnChange = vi.fn();

    const { rerender } = render(
      <PulsarIOSinkProperties
        node={{
          data: {
            label: 'Pulsar Sink',
            properties: {
              expansionServiceMode: 'auto'
            }
          }
        }}
        onChange={mockOnChange}
      />
    );

    expect(screen.queryByLabelText(/Expansion Service Endpoint/i)).not.toBeInTheDocument();

    rerender(
      <PulsarIOSinkProperties
        node={{
          data: {
            label: 'Pulsar Sink',
            properties: {
              expansionServiceMode: 'endpoint',
              expansionServiceEndpoint: ''
            }
          }
        }}
        onChange={mockOnChange}
      />
    );

    const endpointInput = screen.getByLabelText(/Expansion Service Endpoint/i);
    expect(endpointInput).toBeInTheDocument();
    expect(endpointInput).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Expansion service endpoint is required.')).toBeInTheDocument();

    fireEvent.change(endpointInput, { target: { name: 'expansionServiceEndpoint', value: 'localhost:8097' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      expansionServiceEndpoint: 'localhost:8097'
    }));
  });

  it('verifies system_instructions fallback precedence and textarea changes', () => {
    const mockOnChange = vi.fn();

    const { rerender } = render(
      <PulsarIOSinkProperties
        node={{
          data: {
            label: 'Pulsar Sink',
            special_instructions: 'Sink fallback prompt'
          }
        }}
        onChange={mockOnChange}
      />
    );

    const textarea = screen.getByLabelText(/Code Generation Instructions/i);
    expect(textarea).toHaveValue('Sink fallback prompt');

    rerender(
      <PulsarIOSinkProperties
        node={{
          data: {
            label: 'Pulsar Sink',
            properties: {
              system_instructions: 'Explicit sink instructions'
            }
          }
        }}
        onChange={mockOnChange}
      />
    );
    expect(textarea).toHaveValue('Explicit sink instructions');

    fireEvent.change(textarea, { target: { value: 'Updated sink instructions' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      system_instructions: 'Updated sink instructions'
    }));
  });

  it('runs safely when window.vscode is undefined', () => {
    delete (window as any).vscode;

    const mockNode = {
      data: {
        label: 'Pulsar Sink',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    expect(() => {
      render(<PulsarIOSinkProperties node={mockNode} onChange={mockOnChange} />);
    }).not.toThrow();
  });
});
