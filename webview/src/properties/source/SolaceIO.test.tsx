/**
 * SolaceIOSourceProperties Test Suite
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Unit tests validating SolaceIOSourceProperties component functionality,
 * form change callbacks, protocol helpers, gcloud Secret Manager integration,
 * Compute Engine VM instance suggestions, destination mode switching,
 * Python x-lang expansion service configuration, and system instructions.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SolaceIOSourceProperties } from './SolaceIO';

describe('SolaceIOSourceProperties', () => {
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
        label: 'SolaceIO',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<SolaceIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByLabelText(/JCSMP Host \(SMF Messaging\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/SEMP Host \(Management HTTPS\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Message VPN Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Password \(Secret Manager\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Destination Type/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Queue Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Max Concurrent Connections/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Timestamp Function/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Deduplicate Records/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Expansion Service Mode/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Code Generation Instructions/i)).toBeInTheDocument();

    // Verify host formatting and timestampFn guidance helper texts
    expect(screen.getByText('Format: Host[:Port] (e.g. localhost:55555)')).toBeInTheDocument();
    expect(screen.getByText('Format: [Protocol://]Host[:Port] (e.g. https://localhost:943)')).toBeInTheDocument();
    expect(screen.getByText(/Java lambda expression \(e\.g\. record -> Instant\.ofEpochMilli\(\.\.\.\)\)\. Applicable only to Java pipelines; not supported in Python cross-language pipelines\./i)).toBeInTheDocument();
  });

  it('populates fields with provided properties and triggers onChange on inputs', () => {
    const mockNode = {
      data: {
        label: 'SolaceIO',
        properties: {
          jcsmpHost: 'solace.prod.internal:55555',
          sempHost: 'https://solace.prod.internal:943',
          vpnName: 'analytics-vpn',
          username: 'solace-consumer',
          passwordSecret: 'solace-client-secret',
          destinationType: 'topic' as const,
          topic: 'events/telemetry/>',
          maxNumConnections: 4,
          deduplicateRecords: true,
          timestampFn: 'msg -> Instant.now()',
          expansionServiceMode: 'endpoint' as const,
          expansionServiceEndpoint: '10.0.0.5:8097'
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<SolaceIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByLabelText(/JCSMP Host \(SMF Messaging\)/i)).toHaveValue('solace.prod.internal:55555');
    expect(screen.getByLabelText(/SEMP Host \(Management HTTPS\)/i)).toHaveValue('https://solace.prod.internal:943');
    expect(screen.getByLabelText(/^Message VPN Name/i)).toHaveValue('analytics-vpn');
    expect(screen.getByLabelText(/^Username/i)).toHaveValue('solace-consumer');
    expect(screen.getByLabelText(/^Password \(Secret Manager\)/i)).toHaveValue('solace-client-secret');
    expect(screen.getByLabelText(/^Topic Name/i)).toHaveValue('events/telemetry/>');
    expect(screen.getByLabelText(/Max Concurrent Connections/i)).toHaveValue(4);
    expect(screen.getByLabelText(/Deduplicate Records/i)).toBeChecked();
    expect(screen.getByLabelText(/Timestamp Function/i)).toHaveValue('msg -> Instant.now()');
    expect(screen.getByLabelText(/Expansion Service Endpoint/i)).toHaveValue('10.0.0.5:8097');

    const usernameInput = screen.getByLabelText(/^Username/i);
    fireEvent.change(usernameInput, { target: { name: 'username', value: 'new-user' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      username: 'new-user'
    }));

    const dedupCheckbox = screen.getByLabelText(/Deduplicate Records/i);
    fireEvent.click(dedupCheckbox);
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      deduplicateRecords: false
    }));
  });

  it('switches destination type between queue and topic and updates active field', () => {
    const mockNode = {
      data: {
        label: 'SolaceIO',
        properties: {
          destinationType: 'queue' as const,
          queue: 'test-queue'
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<SolaceIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByLabelText(/^Queue Name/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Topic Name/i)).not.toBeInTheDocument();

    const destSelect = screen.getByLabelText(/^Destination Type/i);
    fireEvent.change(destSelect, { target: { value: 'topic' } });

    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      destinationType: 'topic'
    }));
  });

  it('applies host helper buttons to JCSMP and SEMP host inputs', () => {
    const mockNode = {
      data: {
        label: 'SolaceIO',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<SolaceIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const jcsmpHelperBtn = screen.getByTitle('Use localhost:55555 default');
    fireEvent.click(jcsmpHelperBtn);
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      jcsmpHost: 'localhost:55555'
    }));

    const sempHelperBtn = screen.getByTitle('Use https://localhost:943 default');
    fireEvent.click(sempHelperBtn);
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      sempHost: 'https://localhost:943'
    }));
  });

  it('handles extension message for Secret Manager secrets and allows selecting a secret', () => {
    const mockNode = {
      data: {
        label: 'SolaceIO',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<SolaceIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    act(() => {
      window.dispatchEvent(new MessageEvent('message', {
        data: {
          command: 'secretsLoaded',
          secrets: [
            { name: 'solace-prod-key', value: 'solace-prod-key' },
            'projects/my-project/secrets/solace-vpn-pass'
          ]
        }
      }));
    });

    const secretInput = screen.getByLabelText(/^Password \(Secret Manager\)/i);
    fireEvent.change(secretInput, { target: { name: 'passwordSecret', value: 'solace-prod-key' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      passwordSecret: 'solace-prod-key'
    }));
  });

  it('triggers refresh secrets callback when refresh button clicked', () => {
    const mockNode = {
      data: {
        label: 'SolaceIO',
        properties: {}
      }
    };

    render(<SolaceIOSourceProperties node={mockNode} onChange={vi.fn()} />);

    const refreshButton = screen.getByTitle('Refresh secrets from Secret Manager');
    fireEvent.click(refreshButton);

    expect((window as any).vscode.postMessage).toHaveBeenCalledWith({ command: 'getSecrets' });
  });

  it('handles extension message for Compute Engine instances and applies IP to hosts', () => {
    const mockNode = {
      data: {
        label: 'SolaceIO',
        properties: {
          sempHost: 'https://localhost:943'
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<SolaceIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    act(() => {
      window.dispatchEvent(new MessageEvent('message', {
        data: {
          command: 'computeInstancesLoaded',
          instances: [
            { name: 'solace-broker-vm', status: 'RUNNING', internalIp: '10.128.0.25', externalIp: '' }
          ]
        }
      }));
    });

    const vmButton = screen.getByTitle(/Use IP 10.128.0.25 for VM solace-broker-vm/i);
    expect(vmButton).toBeInTheDocument();

    fireEvent.click(vmButton);
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      jcsmpHost: '10.128.0.25:55555',
      sempHost: 'https://10.128.0.25:943'
    }));
  });

  it('shows and validates expansion service endpoint when mode is endpoint', () => {
    const mockNode = {
      data: {
        label: 'SolaceIO',
        properties: {
          expansionServiceMode: 'endpoint' as const,
          expansionServiceEndpoint: ''
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<SolaceIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const endpointInput = screen.getByLabelText(/Expansion Service Endpoint/i);
    expect(endpointInput).toBeInTheDocument();
    expect(endpointInput).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText(/Expansion service endpoint is required/i)).toBeInTheDocument();

    fireEvent.change(endpointInput, { target: { name: 'expansionServiceEndpoint', value: 'localhost:8097' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      expansionServiceEndpoint: 'localhost:8097'
    }));
  });

  it('switches expansion service mode', () => {
    const mockNode = {
      data: {
        label: 'SolaceIO',
        properties: {
          expansionServiceMode: 'auto' as const
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<SolaceIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const modeSelect = screen.getByLabelText(/Expansion Service Mode/i);
    fireEvent.change(modeSelect, { target: { name: 'expansionServiceMode', value: 'endpoint' } });

    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      expansionServiceMode: 'endpoint'
    }));
  });

  it('validates empty required fields with error messages and aria-invalid', () => {
    const mockNode = {
      data: {
        label: 'SolaceIO',
        properties: {
          jcsmpHost: '   ',
          sempHost: '',
          vpnName: ' ',
          username: '',
          passwordSecret: '',
          destinationType: 'queue' as const,
          queue: ''
        }
      }
    };

    render(<SolaceIOSourceProperties node={mockNode} onChange={vi.fn()} />);

    const jcsmpInput = screen.getByLabelText(/JCSMP Host \(SMF Messaging\)/i);
    expect(jcsmpInput).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('JCSMP host is required.')).toBeInTheDocument();

    const sempInput = screen.getByLabelText(/SEMP Host \(Management HTTPS\)/i);
    expect(sempInput).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('SEMP host is required.')).toBeInTheDocument();

    const vpnInput = screen.getByLabelText(/^Message VPN Name/i);
    expect(vpnInput).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Message VPN name is required.')).toBeInTheDocument();

    const usernameInput = screen.getByLabelText(/^Username/i);
    expect(usernameInput).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Username is required.')).toBeInTheDocument();

    const secretInput = screen.getByLabelText(/^Password \(Secret Manager\)/i);
    expect(secretInput).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Password secret is required.')).toBeInTheDocument();

    const queueInput = screen.getByLabelText(/^Queue Name/i);
    expect(queueInput).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Queue name is required when reading from a Queue.')).toBeInTheDocument();
  });

  it('validates empty topic name when destinationType is topic', () => {
    const mockNode = {
      data: {
        label: 'SolaceIO',
        properties: {
          destinationType: 'topic' as const,
          topic: ''
        }
      }
    };

    render(<SolaceIOSourceProperties node={mockNode} onChange={vi.fn()} />);

    const topicInput = screen.getByLabelText(/^Topic Name/i);
    expect(topicInput).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Topic name is required when reading from a Topic.')).toBeInTheDocument();
  });

  it('handles error messages from extension correctly', () => {
    const mockNode = {
      data: {
        label: 'SolaceIO',
        properties: {
          passwordSecret: 'some-secret'
        }
      }
    };

    render(<SolaceIOSourceProperties node={mockNode} onChange={vi.fn()} />);

    act(() => {
      window.dispatchEvent(new MessageEvent('message', {
        data: {
          command: 'secretsLoaded',
          error: 'Secret Manager API is not enabled'
        }
      }));
    });

    expect(screen.getAllByText('Secret Manager API is not enabled').length).toBeGreaterThan(0);

    act(() => {
      window.dispatchEvent(new MessageEvent('message', {
        data: {
          command: 'computeInstancesLoaded',
          error: 'Compute API permission denied'
        }
      }));
    });

    expect(screen.getByText('Compute API permission denied')).toBeInTheDocument();
  });

  it('handles non-array secrets or compute payloads without throwing', () => {
    const mockNode = {
      data: {
        label: 'SolaceIO',
        properties: {}
      }
    };

    expect(() => {
      render(<SolaceIOSourceProperties node={mockNode} onChange={vi.fn()} />);

      act(() => {
        window.dispatchEvent(new MessageEvent('message', {
          data: {
            command: 'secretsLoaded',
            secrets: null
          }
        }));
        window.dispatchEvent(new MessageEvent('message', {
          data: {
            command: 'computeInstancesLoaded',
            instances: 'not-an-array'
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
        label: 'SolaceIO',
        properties: {}
      }
    };

    expect(() => {
      render(<SolaceIOSourceProperties node={mockNode} onChange={vi.fn()} />);
    }).not.toThrow();
  });

  it('respects system_instructions fallback precedence', () => {
    // 1. node.data.system_instructions wins
    const node1 = {
      data: {
        label: 'SolaceIO',
        system_instructions: 'From node data system',
        special_instructions: 'From node data special',
        properties: {
          system_instructions: 'From prop system',
          special_instructions: 'From prop special'
        }
      }
    };
    const { unmount: unmount1 } = render(<SolaceIOSourceProperties node={node1} onChange={vi.fn()} />);
    expect(screen.getByLabelText(/Code Generation Instructions/i)).toHaveValue('From node data system');
    unmount1();

    // 2. node.data.special_instructions fallback
    const node2 = {
      data: {
        label: 'SolaceIO',
        special_instructions: 'From node data special',
        properties: {
          system_instructions: 'From prop system'
        }
      }
    };
    const { unmount: unmount2 } = render(<SolaceIOSourceProperties node={node2} onChange={vi.fn()} />);
    expect(screen.getByLabelText(/Code Generation Instructions/i)).toHaveValue('From node data special');
    unmount2();

    // 3. properties.system_instructions fallback
    const node3 = {
      data: {
        label: 'SolaceIO',
        properties: {
          system_instructions: 'From prop system',
          special_instructions: 'From prop special'
        }
      }
    };
    const { unmount: unmount3 } = render(<SolaceIOSourceProperties node={node3} onChange={vi.fn()} />);
    expect(screen.getByLabelText(/Code Generation Instructions/i)).toHaveValue('From prop system');
    unmount3();

    // 4. properties.special_instructions fallback
    const node4 = {
      data: {
        label: 'SolaceIO',
        properties: {
          special_instructions: 'From prop special'
        }
      }
    };
    const { unmount: unmount4 } = render(<SolaceIOSourceProperties node={node4} onChange={vi.fn()} />);
    expect(screen.getByLabelText(/Code Generation Instructions/i)).toHaveValue('From prop special');
    unmount4();
  });

  it('updates system_instructions when textarea changes', () => {
    const mockNode = {
      data: {
        label: 'SolaceIO',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<SolaceIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const instructionsTextarea = screen.getByLabelText(/Code Generation Instructions/i);
    fireEvent.change(instructionsTextarea, { target: { value: 'Parse Solace XMLPayload directly' } });

    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      system_instructions: 'Parse Solace XMLPayload directly'
    }));
  });
});
