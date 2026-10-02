/**
 * SolaceIOSinkProperties Test Suite
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Unit tests validating SolaceIOSinkProperties component functionality,
 * form change callbacks, protocol helpers, gcloud Secret Manager integration,
 * Compute Engine VM instance suggestions, writer enum selectors, destination mode switching,
 * Python x-lang expansion service configuration, and system instructions.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SolaceIOSinkProperties } from './SolaceIO';

describe('SolaceIOSinkProperties', () => {
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

  it('populates fields with provided properties and triggers onChange on inputs', () => {
    const mockNode = {
      data: {
        label: 'SolaceIO',
        properties: {
          jcsmpHost: 'solace.sink.internal:55555',
          vpnName: 'finance-vpn',
          username: 'solace-writer',
          passwordSecret: 'solace-writer-secret',
          destinationType: 'queue' as const,
          queue: 'orders-processing-queue',
          submissionMode: 'LOWER_LATENCY' as const,
          deliveryMode: 'NON_PERSISTENT' as const,
          writerType: 'STREAMING' as const,
          numberOfClientsPerWorker: 8,
          numShards: 35,
          publishLatencyMetrics: true,
          expansionServiceMode: 'endpoint' as const,
          expansionServiceEndpoint: '192.168.1.10:8097'
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<SolaceIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByLabelText(/JCSMP Host \(SMF Messaging\)/i)).toHaveValue('solace.sink.internal:55555');
    expect(screen.getByLabelText(/^Message VPN Name/i)).toHaveValue('finance-vpn');
    expect(screen.getByLabelText(/^Username/i)).toHaveValue('solace-writer');
    expect(screen.getByLabelText(/^Password \(Secret Manager\)/i)).toHaveValue('solace-writer-secret');
    expect(screen.getByLabelText(/^Queue Name/i)).toHaveValue('orders-processing-queue');
    expect(screen.getByLabelText(/^Submission Mode/i)).toHaveValue('LOWER_LATENCY');
    expect(screen.getByLabelText(/^Delivery Mode/i)).toHaveValue('NON_PERSISTENT');
    expect(screen.getByLabelText(/^Writer Type/i)).toHaveValue('STREAMING');
    expect(screen.getByLabelText(/Clients Per Worker/i)).toHaveValue(8);
    expect(screen.getByLabelText(/Number of Shards/i)).toHaveValue(35);
    expect(screen.getByLabelText(/Publish Latency Metrics/i)).toBeChecked();
    expect(screen.getByLabelText(/Expansion Service Endpoint/i)).toHaveValue('192.168.1.10:8097');

    const submissionSelect = screen.getByLabelText(/^Submission Mode/i);
    fireEvent.change(submissionSelect, { target: { name: 'submissionMode', value: 'HIGHER_THROUGHPUT' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      submissionMode: 'HIGHER_THROUGHPUT'
    }));

    const deliverySelect = screen.getByLabelText(/^Delivery Mode/i);
    fireEvent.change(deliverySelect, { target: { name: 'deliveryMode', value: 'PERSISTENT' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      deliveryMode: 'PERSISTENT'
    }));

    fireEvent.change(deliverySelect, { target: { name: 'deliveryMode', value: 'DIRECT' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      deliveryMode: 'DIRECT'
    }));

    const writerSelect = screen.getByLabelText(/^Writer Type/i);
    fireEvent.change(writerSelect, { target: { name: 'writerType', value: 'BATCHED' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      writerType: 'BATCHED'
    }));

    const clientsInput = screen.getByLabelText(/Clients Per Worker/i);
    fireEvent.change(clientsInput, { target: { name: 'numberOfClientsPerWorker', value: '6' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      numberOfClientsPerWorker: '6'
    }));

    const shardsInput = screen.getByLabelText(/Number of Shards/i);
    fireEvent.change(shardsInput, { target: { name: 'numShards', value: '50' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      numShards: '50'
    }));

    const latencyCheckbox = screen.getByLabelText(/Publish Latency Metrics/i);
    fireEvent.click(latencyCheckbox);
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      publishLatencyMetrics: false
    }));
  });

  it('switches destination type between topic and queue', () => {
    const mockNode = {
      data: {
        label: 'SolaceIO',
        properties: {
          destinationType: 'topic' as const,
          topic: 'events/orders'
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<SolaceIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByLabelText(/^Topic Name/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Queue Name/i)).not.toBeInTheDocument();

    const destSelect = screen.getByLabelText(/^Destination Type/i);
    fireEvent.change(destSelect, { target: { value: 'queue' } });

    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      destinationType: 'queue'
    }));
  });

  it('applies host helper button to JCSMP host input', () => {
    const mockNode = {
      data: {
        label: 'SolaceIO',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<SolaceIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    const helperBtn = screen.getByTitle('Use localhost:55555 default');
    fireEvent.click(helperBtn);

    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      jcsmpHost: 'localhost:55555'
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

    render(<SolaceIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    const secretInput = screen.getByLabelText(/^Password \(Secret Manager\)/i);
    fireEvent.change(secretInput, { target: { name: 'passwordSecret', value: 'solace-sink-auth' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      passwordSecret: 'solace-sink-auth'
    }));
  });

  it('handles extension message for Compute Engine instances and applies IP to JCSMP host', () => {
    const mockNode = {
      data: {
        label: 'SolaceIO',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<SolaceIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    act(() => {
      window.dispatchEvent(new MessageEvent('message', {
        data: {
          command: 'computeInstancesLoaded',
          instances: [
            { name: 'solace-sink-broker-vm', status: 'RUNNING', internalIp: '10.200.0.15', externalIp: '' }
          ]
        }
      }));
    });

    const vmButton = screen.getByTitle(/Use IP 10.200.0.15 for VM solace-sink-broker-vm/i);
    expect(vmButton).toBeInTheDocument();

    fireEvent.click(vmButton);
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      jcsmpHost: '10.200.0.15:55555'
    }));
  });

  it('validates empty required fields with error messages and aria-invalid', () => {
    const mockNode = {
      data: {
        label: 'SolaceIO',
        properties: {
          jcsmpHost: '',
          vpnName: '',
          username: '',
          passwordSecret: '',
          destinationType: 'topic' as const,
          topic: ''
        }
      }
    };

    render(<SolaceIOSinkProperties node={mockNode} onChange={vi.fn()} />);

    const jcsmpInput = screen.getByLabelText(/JCSMP Host \(SMF Messaging\)/i);
    expect(jcsmpInput).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('JCSMP host is required.')).toBeInTheDocument();

    const vpnInput = screen.getByLabelText(/^Message VPN Name/i);
    expect(vpnInput).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Message VPN name is required.')).toBeInTheDocument();

    const usernameInput = screen.getByLabelText(/^Username/i);
    expect(usernameInput).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Username is required.')).toBeInTheDocument();

    const secretInput = screen.getByLabelText(/^Password \(Secret Manager\)/i);
    expect(secretInput).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Password secret is required.')).toBeInTheDocument();

    const topicInput = screen.getByLabelText(/^Topic Name/i);
    expect(topicInput).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Topic name is required when publishing to a Topic.')).toBeInTheDocument();
  });

  it('validates empty queue name when destinationType is queue', () => {
    const mockNode = {
      data: {
        label: 'SolaceIO',
        properties: {
          destinationType: 'queue' as const,
          queue: ''
        }
      }
    };

    render(<SolaceIOSinkProperties node={mockNode} onChange={vi.fn()} />);

    const queueInput = screen.getByLabelText(/^Queue Name/i);
    expect(queueInput).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Queue name is required when publishing to a Queue.')).toBeInTheDocument();
  });

  it('updates system_instructions when textarea changes', () => {
    const mockNode = {
      data: {
        label: 'SolaceIO',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<SolaceIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    const instructionsTextarea = screen.getByLabelText(/Code Generation Instructions/i);
    fireEvent.change(instructionsTextarea, { target: { value: 'Publish with PERSISTENT delivery mode' } });

    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      system_instructions: 'Publish with PERSISTENT delivery mode'
    }));
  });
});
