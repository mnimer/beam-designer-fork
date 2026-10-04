/**
 * MqttIOSourceProperties Test Suite
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Unit tests validating MqttIOSourceProperties component functionality,
 * form change callbacks, protocol helpers, gcloud Secret Manager integration,
 * QoS dropdown, metadata toggle, and stream bounding settings.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MqttIOSourceProperties } from './MqttIO';

describe('MqttIOSourceProperties', () => {
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
        label: 'MQTT',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<MqttIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByLabelText(/Broker Server URI/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Subscription Topic \/ Filter/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Client ID/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^QoS/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Timeout \(s\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Keep Alive \(s\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Read with Metadata/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Code Generation Instructions/i)).toBeInTheDocument();
  });

  it('populates fields with provided properties and triggers onChange on serverUri and topic changes', () => {
    const mockNode = {
      data: {
        label: 'MQTT',
        properties: {
          serverUri: 'tcp://broker.hivemq.com:1883',
          topic: 'sensors/+/temperature',
          clientId: 'worker-1',
          qos: '2' as const,
          connectionTimeout: '45',
          keepAlive: '90'
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<MqttIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const serverInput = screen.getByLabelText(/Broker Server URI/i);
    expect(serverInput).toHaveValue('tcp://broker.hivemq.com:1883');

    const topicInput = screen.getByLabelText(/Subscription Topic \/ Filter/i);
    expect(topicInput).toHaveValue('sensors/+/temperature');

    const clientInput = screen.getByLabelText(/Client ID/i);
    expect(clientInput).toHaveValue('worker-1');

    fireEvent.change(topicInput, { target: { name: 'topic', value: 'iot/fleet/#' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      topic: 'iot/fleet/#'
    }));
  });

  it('applies protocol helper pills to broker URI', () => {
    const mockNode = {
      data: {
        label: 'MQTT',
        properties: {
          serverUri: 'tcp://my-broker.local:1883'
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<MqttIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const sslButton = screen.getByTitle('Set ssl:// scheme');
    fireEvent.click(sslButton);

    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      serverUri: 'ssl://my-broker.local:1883'
    }));
  });

  it('allows selecting a secret when passwordSource is secretManager', () => {
    const mockNode = {
      data: {
        label: 'MQTT',
        properties: {
          passwordSource: 'secretManager' as const
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<MqttIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const secretDropdown = screen.getByLabelText(/GCP Secret Manager Secret/i);
    expect(secretDropdown).toBeInTheDocument();

    fireEvent.change(secretDropdown, { target: { name: 'secretName', value: 'mqtt-pass-prod' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      secretName: 'mqtt-pass-prod'
    }));
  });

  it('does not render direct cleartext password entry and strips legacy password on update', () => {
    const mockNode = {
      data: {
        label: 'MQTT',
        properties: {
          password: 'super-secret-token'
        }
      }
    };
    const mockOnChange = vi.fn();

    const { container } = render(<MqttIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    expect(container.querySelector('input[name="password"]')).not.toBeInTheDocument();
    expect(container.querySelector('#mqtt-secret-name')).toBeInTheDocument();

    const usernameInput = container.querySelector('#mqtt-username') as HTMLInputElement;
    fireEvent.change(usernameInput, { target: { name: 'username', value: 'mqtt-user-secret' } });

    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      username: 'mqtt-user-secret'
    }));
    expect(mockOnChange.mock.calls[0][0].password).toBeUndefined();
  });

  it('handles extension message for Compute Engine instances and applies IP to serverUri', () => {
    const mockNode = {
      data: {
        label: 'MQTT',
        properties: {
          serverUri: 'tcp://'
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<MqttIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    // Simulate extension response with compute instances
    act(() => {
      window.dispatchEvent(new MessageEvent('message', {
        data: {
          command: 'computeInstancesLoaded',
          instances: [
            { name: 'mosquitto-vm', status: 'RUNNING', internalIp: '10.128.0.5', externalIp: '34.10.20.30' }
          ]
        }
      }));
    });

    const vmButton = screen.getByTitle(/Use IP 10.128.0.5 for VM mosquitto-vm/i);
    expect(vmButton).toBeInTheDocument();

    fireEvent.click(vmButton);
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      serverUri: 'tcp://10.128.0.5:1883'
    }));
  });

  it('supports toggling Read with Metadata and configuring bounded limits', () => {
    const mockNode = {
      data: {
        label: 'MQTT',
        properties: {
          useMetadata: false
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<MqttIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    // Toggle Read with Metadata
    const metadataCheckbox = screen.getByLabelText(/Read with Metadata/i);
    fireEvent.click(metadataCheckbox);
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      useMetadata: true
    }));

    // Bounded limits fields are directly visible
    const maxRecordsInput = screen.getByLabelText('Max Records');
    fireEvent.change(maxRecordsInput, { target: { name: 'maxNumRecords', value: '500' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      maxNumRecords: '500'
    }));
  });

  it('updates system_instructions when textarea changes', () => {
    const mockNode = {
      data: {
        label: 'MQTT',
        properties: {
          system_instructions: 'Initial prompt'
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<MqttIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const textarea = screen.getByLabelText(/Code Generation Instructions/i);
    fireEvent.change(textarea, { target: { value: 'Parse JSON payload using Jackson' } });

    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      system_instructions: 'Parse JSON payload using Jackson'
    }));
  });

  it('renders QoS on its own line separate from connection tuning fields', () => {
    const mockNode = {
      data: {
        label: 'MQTT',
        properties: {}
      }
    };
    render(<MqttIOSourceProperties node={mockNode} onChange={vi.fn()} />);

    const qosSelect = screen.getByLabelText(/^QoS/i);
    const timeoutInput = screen.getByLabelText(/Timeout \(s\)/i);

    // QoS parent container should not be the same container as the timeout input
    expect(qosSelect.parentElement).not.toBe(timeoutInput.parentElement);
    // Timeout should be within a 2-column grid, while QoS is on its own full line
    expect(timeoutInput.closest('.grid')).not.toContainElement(qosSelect);
  });


  it('displays error when loading compute instances fails', () => {
    const mockNode = {
      data: {
        label: 'MQTT',
        properties: {
          serverUri: 'tcp://broker.example.com:1883'
        }
      }
    };
    render(<MqttIOSourceProperties node={mockNode} onChange={vi.fn()} />);

    act(() => {
      window.dispatchEvent(new MessageEvent('message', {
        data: {
          command: 'computeInstancesLoaded',
          error: 'Failed to list Compute Engine instances'
        }
      }));
    });

    expect(screen.getByText('Failed to list Compute Engine instances')).toBeInTheDocument();
  });
});

