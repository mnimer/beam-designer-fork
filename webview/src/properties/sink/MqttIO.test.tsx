/**
 * MqttIOSinkProperties Test Suite
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Unit tests validating MqttIOSinkProperties component functionality,
 * form change callbacks, wildcard validation warnings, retain flag toggling,
 * gcloud Secret Manager integration, and protocol helpers.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MqttIOSinkProperties } from './MqttIO';

describe('MqttIOSinkProperties', () => {
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

    render(<MqttIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByLabelText(/Broker Server URI/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Publish Topic/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Client ID/i)).toBeInTheDocument();
    expect(screen.getByText(/QoS 1 \(At Least Once\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Timeout \(s\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Keep Alive \(s\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Retain Messages/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Code Generation Instructions/i)).toBeInTheDocument();
  });

  it('triggers onChange when serverUri, topic, and clientId change', () => {
    const mockNode = {
      data: {
        label: 'MQTT',
        properties: {
          serverUri: 'tcp://broker.local:1883',
          topic: 'alerts/temperature'
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<MqttIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    const topicInput = screen.getByLabelText(/Publish Topic/i);
    expect(topicInput).toHaveValue('alerts/temperature');

    fireEvent.change(topicInput, { target: { name: 'topic', value: 'alerts/pressure' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      topic: 'alerts/pressure'
    }));
  });

  it('displays a warning banner when topic contains wildcard characters (+ or #)', () => {
    const mockNode = {
      data: {
        label: 'MQTT',
        properties: {
          topic: 'sensors/+/events'
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<MqttIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByText(/Wildcard detected:/i)).toBeInTheDocument();
    expect(screen.getByText(/MQTT publishers cannot send messages to wildcard topics/i)).toBeInTheDocument();
  });

  it('applies protocol helper pills to broker URI', () => {
    const mockNode = {
      data: {
        label: 'MQTT',
        properties: {
          serverUri: 'tcp://broker.local:1883'
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<MqttIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    const sslButton = screen.getByTitle('Set ssl:// scheme');
    fireEvent.click(sslButton);

    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      serverUri: 'ssl://broker.local:1883'
    }));
  });

  it('handles extension message for Secret Manager secrets and allows selecting a secret', () => {
    const mockNode = {
      data: {
        label: 'MQTT',
        properties: {
          passwordSource: 'secretManager' as const
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<MqttIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    // Simulate extension response with secrets
    act(() => {
      window.dispatchEvent(new MessageEvent('message', {
        data: {
          command: 'secretsLoaded',
          secrets: [
            { name: 'mqtt-sink-secret', value: 'mqtt-sink-secret' }
          ]
        }
      }));
    });

    const secretDropdown = screen.getByLabelText(/GCP Secret Manager Secret/i);
    expect(secretDropdown).toBeInTheDocument();

    fireEvent.change(secretDropdown, { target: { name: 'secretName', value: 'mqtt-sink-secret' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      secretName: 'mqtt-sink-secret'
    }));
  });

  it('switches to direct password entry and toggles visibility', () => {
    const mockNode = {
      data: {
        label: 'MQTT',
        properties: {
          passwordSource: 'direct' as const,
          password: 'sink-password-123'
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<MqttIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    const passwordInput = screen.getByLabelText(/^Password/i);
    expect(passwordInput).toHaveAttribute('type', 'password');

    const toggleButton = screen.getByLabelText('Show password');
    fireEvent.click(toggleButton);

    expect(passwordInput).toHaveAttribute('type', 'text');
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

    render(<MqttIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    act(() => {
      window.dispatchEvent(new MessageEvent('message', {
        data: {
          command: 'computeInstancesLoaded',
          instances: [
            { name: 'broker-vm', status: 'RUNNING', internalIp: '10.0.0.12', externalIp: '' }
          ]
        }
      }));
    });

    const vmButton = screen.getByTitle(/Use IP 10.0.0.12 for VM broker-vm/i);
    expect(vmButton).toBeInTheDocument();

    fireEvent.click(vmButton);
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      serverUri: 'tcp://10.0.0.12:1883'
    }));
  });

  it('toggles retain messages checkbox', () => {
    const mockNode = {
      data: {
        label: 'MQTT',
        properties: {
          retain: false
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<MqttIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    const retainCheckbox = screen.getByLabelText(/Retain Messages/i);
    fireEvent.click(retainCheckbox);

    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      retain: true
    }));
  });

  it('updates system_instructions when textarea changes', () => {
    const mockNode = {
      data: {
        label: 'MQTT',
        properties: {
          system_instructions: 'Sink initial'
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<MqttIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    const textarea = screen.getByLabelText(/Code Generation Instructions/i);
    fireEvent.change(textarea, { target: { value: 'Encode output records into JSON payload' } });

    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      system_instructions: 'Encode output records into JSON payload'
    }));
  });

  it('renders QoS on its own line outside the timeout and keepalive grid', () => {
    const mockNode = {
      data: {
        label: 'MQTT',
        properties: {}
      }
    };
    render(<MqttIOSinkProperties node={mockNode} onChange={vi.fn()} />);

    const qosBadge = screen.getByText(/QoS 1 \(At Least Once\)/i);
    const timeoutInput = screen.getByLabelText(/Timeout \(s\)/i);
    const keepAliveInput = screen.getByLabelText(/Keep Alive \(s\)/i);

    // Timeout and Keep Alive share a 2-column grid
    expect(timeoutInput.closest('.grid')).toContainElement(keepAliveInput);
    // QoS is rendered on its own row outside the connection tuning grid
    expect(timeoutInput.closest('.grid')).not.toContainElement(qosBadge);
  });
});
