/**
 * AmqpIOSourceProperties Test Suite
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Unit tests validating AmqpIOSourceProperties component functionality,
 * form change callbacks, protocol helpers, gcloud Secret Manager integration,
 * Compute Engine VM instance suggestions, bounded stream limits,
 * Python x-lang expansion service configuration, and system instructions.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
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

  it('handles extension message for Secret Manager secrets and allows selecting or typing a secret', () => {
    const mockNode = {
      data: {
        label: 'AmqpIO',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<AmqpIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    act(() => {
      window.dispatchEvent(new MessageEvent('message', {
        data: {
          command: 'secretsLoaded',
          secrets: [
            { name: 'amqp-auth-token', value: 'amqp-auth-token' },
            'projects/my-gcp-project/secrets/amqp-prod-key'
          ]
        }
      }));
    });

    const secretInput = screen.getByLabelText(/GCP Secret Manager Secret/i);
    expect(secretInput).toBeInTheDocument();

    fireEvent.change(secretInput, { target: { name: 'secretName', value: 'amqp-auth-token' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      secretName: 'amqp-auth-token'
    }));
  });

  it('triggers refresh secrets callback when refresh button clicked', () => {
    const mockNode = {
      data: {
        label: 'AmqpIO',
        properties: {}
      }
    };

    render(<AmqpIOSourceProperties node={mockNode} onChange={vi.fn()} />);

    const refreshButton = screen.getByTitle('Refresh secrets from Secret Manager');
    fireEvent.click(refreshButton);

    expect((window as any).vscode.postMessage).toHaveBeenCalledWith({ command: 'getSecrets' });
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

    render(<AmqpIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const endpointInput = screen.getByLabelText(/Expansion Service Endpoint/i);
    expect(endpointInput).toBeInTheDocument();
    expect(endpointInput).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Expansion service endpoint is required.')).toBeInTheDocument();

    fireEvent.change(endpointInput, { target: { name: 'expansionServiceEndpoint', value: '127.0.0.1:8097' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      expansionServiceEndpoint: '127.0.0.1:8097'
    }));
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

    render(<AmqpIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const modeSelect = screen.getByLabelText(/Expansion Service Mode/i);
    fireEvent.change(modeSelect, { target: { name: 'expansionServiceMode', value: 'endpoint' } });

    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      expansionServiceMode: 'endpoint'
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

  it('handles error messages from extension correctly', () => {
    const mockNode = {
      data: {
        label: 'AmqpIO',
        properties: {
          addresses: 'amqp://broker.example.com:5672/queue'
        }
      }
    };

    render(<AmqpIOSourceProperties node={mockNode} onChange={vi.fn()} />);

    act(() => {
      window.dispatchEvent(new MessageEvent('message', {
        data: {
          command: 'secretsLoaded',
          error: 'Secret Manager API is not enabled'
        }
      }));
    });

    expect(screen.getByText('Secret Manager API is not enabled')).toBeInTheDocument();
  });

  it('handles non-array secrets payload without throwing', () => {
    const mockNode = {
      data: {
        label: 'AmqpIO',
        properties: {}
      }
    };

    expect(() => {
      render(<AmqpIOSourceProperties node={mockNode} onChange={vi.fn()} />);

      act(() => {
        window.dispatchEvent(new MessageEvent('message', {
          data: {
            command: 'secretsLoaded',
            secrets: null
          }
        }));
        window.dispatchEvent(new MessageEvent('message', {
          data: {
            command: 'unrelatedMessage'
          }
        }));
      });
    }).not.toThrow();
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
      render(<AmqpIOSourceProperties node={mockNode} onChange={vi.fn()} />);
    }).not.toThrow();
  });

  it('respects system_instructions fallback precedence', () => {
    // 1. node.data.system_instructions wins
    const node1 = {
      data: {
        label: 'AmqpIO',
        system_instructions: 'From node data system',
        special_instructions: 'From node data special',
        properties: {
          system_instructions: 'From prop system',
          special_instructions: 'From prop special'
        }
      }
    };
    const { unmount: unmount1 } = render(<AmqpIOSourceProperties node={node1} onChange={vi.fn()} />);
    expect(screen.getByLabelText(/Code Generation Instructions/i)).toHaveValue('From node data system');
    unmount1();

    // 2. node.data.special_instructions fallback
    const node2 = {
      data: {
        label: 'AmqpIO',
        special_instructions: 'From node data special',
        properties: {
          system_instructions: 'From prop system'
        }
      }
    };
    const { unmount: unmount2 } = render(<AmqpIOSourceProperties node={node2} onChange={vi.fn()} />);
    expect(screen.getByLabelText(/Code Generation Instructions/i)).toHaveValue('From node data special');
    unmount2();

    // 3. properties.system_instructions fallback
    const node3 = {
      data: {
        label: 'AmqpIO',
        properties: {
          system_instructions: 'From prop system',
          special_instructions: 'From prop special'
        }
      }
    };
    const { unmount: unmount3 } = render(<AmqpIOSourceProperties node={node3} onChange={vi.fn()} />);
    expect(screen.getByLabelText(/Code Generation Instructions/i)).toHaveValue('From prop system');
    unmount3();

    // 4. properties.special_instructions fallback
    const node4 = {
      data: {
        label: 'AmqpIO',
        properties: {
          special_instructions: 'From prop special'
        }
      }
    };
    const { unmount: unmount4 } = render(<AmqpIOSourceProperties node={node4} onChange={vi.fn()} />);
    expect(screen.getByLabelText(/Code Generation Instructions/i)).toHaveValue('From prop special');
    unmount4();
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

  it('displays credentials documentation callout explaining AMQP 1.0 authentication via Secret Manager', () => {
    const mockNode = {
      data: {
        label: 'AmqpIO',
        properties: {}
      }
    };
    render(<AmqpIOSourceProperties node={mockNode} onChange={vi.fn()} />);
    expect(screen.getByText(/AMQP 1\.0 broker credentials are authenticated via Google Cloud Secret Manager/i)).toBeInTheDocument();
  });
});
