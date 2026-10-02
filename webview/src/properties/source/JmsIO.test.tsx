/**
 * JmsIOSourceProperties Test Suite
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Unit tests validating JmsIOSourceProperties component functionality,
 * provider presets, mutual queue/topic selection, gcloud callbacks,
 * validation errors, execution limits, and system instructions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { JmsIOSourceProperties } from './JmsIO';

describe('JmsIOSourceProperties', () => {
  let mockPostMessage: any;

  beforeEach(() => {
    mockPostMessage = vi.fn();
    (window as any).vscode = {
      postMessage: mockPostMessage
    };
  });

  it('renders default fields with preset, broker URL, destination, and instructions', () => {
    const mockNode = {
      data: {
        label: 'JMS',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<JmsIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    // Verifies provider preset dropdown
    expect(screen.getByLabelText(/JMS Provider Preset/i)).toBeInTheDocument();
    // Verifies broker url input
    expect(screen.getByLabelText(/Broker URL/i)).toBeInTheDocument();
    // Verifies destination type buttons
    expect(screen.getByText(/Queue \(Point-to-Point\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Topic \(Pub\/Sub\)/i)).toBeInTheDocument();
    // Verifies queue name input by default
    expect(screen.getByLabelText(/Queue Name/i)).toBeInTheDocument();
    // Verifies code generation instructions
    expect(screen.getByLabelText(/Code Generation Instructions/i)).toBeInTheDocument();

    // Verifies extension messages requested on mount
    expect(mockPostMessage).toHaveBeenCalledWith({ command: 'getSecrets' });
    expect(mockPostMessage).toHaveBeenCalledWith({ command: 'getComputeInstances' });
  });

  it('changes preset and automatically updates ConnectionFactory and defaultUrl', () => {
    const mockNode = {
      data: {
        label: 'JMS',
        properties: {
          connectionFactory: 'org.apache.activemq.ActiveMQConnectionFactory',
          brokerUrl: 'tcp://localhost:61616'
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<JmsIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const presetSelect = screen.getByLabelText(/JMS Provider Preset/i);
    fireEvent.change(presetSelect, { target: { value: 'org.apache.qpid.jms.JmsConnectionFactory' } });

    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      connectionFactory: 'org.apache.qpid.jms.JmsConnectionFactory',
      brokerUrl: 'amqp://localhost:5672'
    }));
  });

  it('does not offer Custom ConnectionFactory option or customConnectionFactory input', () => {
    const mockNode = {
      data: {
        label: 'JMS',
        properties: {
          connectionFactory: 'org.apache.activemq.ActiveMQConnectionFactory'
        }
      }
    };
    const mockOnChange = vi.fn();

    const { container } = render(<JmsIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const presetSelect = screen.getByLabelText(/JMS Provider Preset/i) as HTMLSelectElement;
    const optionValues = Array.from(presetSelect.querySelectorAll('option')).map(o => o.value);
    expect(optionValues).not.toContain('custom');
    expect(container.querySelector('#jmsCustomFactory')).not.toBeInTheDocument();
    expect(container.querySelector('input[name="customConnectionFactory"]')).not.toBeInTheDocument();
  });

  it('switches between Queue and Topic and enforces mutual exclusivity', () => {
    const mockNode = {
      data: {
        label: 'JMS',
        properties: {
          destinationType: 'queue' as const,
          queue: 'orders.input'
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<JmsIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    // Click Topic button
    const topicButton = screen.getByText(/Topic \(Pub\/Sub\)/i);
    fireEvent.click(topicButton);

    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      destinationType: 'topic',
      topic: 'orders.input'
    }));
    expect(mockOnChange.mock.calls[0][0].queue).toBeUndefined();
  });

  it('updates destination name and cleans up opposing destination', () => {
    const mockNode = {
      data: {
        label: 'JMS',
        properties: {
          destinationType: 'topic' as const,
          topic: 'events.stock'
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<JmsIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const topicInput = screen.getByLabelText(/Topic Name/i);
    fireEvent.change(topicInput, { target: { value: 'events.updates' } });

    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      destinationType: 'topic',
      topic: 'events.updates'
    }));
    expect(mockOnChange.mock.calls[0][0].queue).toBeUndefined();
  });

  it('displays validation message when destination name is empty', () => {
    const mockNode = {
      data: {
        label: 'JMS',
        properties: {
          destinationType: 'queue' as const,
          queue: ''
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<JmsIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByText(/A queue name is required for JmsIO.read\(\)/i)).toBeInTheDocument();
  });


  it('receives computeInstancesLoaded and allows inserting instance IP', () => {
    const mockNode = {
      data: {
        label: 'JMS',
        properties: {
          brokerUrl: 'tcp://localhost:61616'
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<JmsIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    // Post message with VM instances
    act(() => {
      window.dispatchEvent(new MessageEvent('message', {
        data: {
          command: 'computeInstancesLoaded',
          instances: [
            { name: 'activemq-vm', internalIp: '10.128.0.5', externalIp: '34.56.78.90', zone: 'us-central1-a', status: 'RUNNING' }
          ]
        }
      }));
    });

    const instanceButton = screen.getByRole('button', { name: 'activemq-vm' });
    expect(instanceButton).toBeInTheDocument();

    fireEvent.click(instanceButton);
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      brokerUrl: 'tcp://10.128.0.5:61616'
    }));
  });

  it('updates maxNumRecords, maxReadTime, and system_instructions', () => {
    const mockNode = {
      data: {
        label: 'JMS',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<JmsIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const maxRecordsInput = screen.getByLabelText(/Max Records/i);
    fireEvent.change(maxRecordsInput, { target: { name: 'maxNumRecords', value: '500' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      maxNumRecords: '500'
    }));

    const maxTimeInput = screen.getByLabelText(/Max Duration \(s\)/i);
    fireEvent.change(maxTimeInput, { target: { name: 'maxReadTime', value: '30' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      maxReadTime: '30'
    }));

    const instructionsTextarea = screen.getByLabelText(/Code Generation Instructions/i);
    fireEvent.change(instructionsTextarea, { target: { value: 'Parse XML message to Order entity' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      system_instructions: 'Parse XML message to Order entity'
    }));
  });

  it('always uses Secret Manager mode and does not render plaintext password input', () => {
    const mockNode = {
      data: {
        label: 'JMS',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    const { container } = render(<JmsIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const authSelect = container.querySelector('select[name="authMode"]') as HTMLSelectElement;
    expect(authSelect).toHaveValue('secretManager');
    expect(container.querySelector('input[name="passwordSecret"]')).toBeInTheDocument();
    expect(container.querySelector('input[name="password"]')).not.toBeInTheDocument();
    expect(screen.queryByText(/cleartext/i)).not.toBeInTheDocument();
  });

  it('strips legacy plaintext password when updating properties', () => {
    const mockNode = {
      data: {
        label: 'JMS',
        properties: {
          password: 'legacy-jms-password',
        },
      },
    };
    const mockOnChange = vi.fn();

    const { container } = render(<JmsIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const authModeSelect = container.querySelector('select[name="authMode"]') as HTMLSelectElement;
    expect(authModeSelect).toHaveValue('secretManager');
    expect(container.querySelector('input[name="password"]')).not.toBeInTheDocument();

    const usernameInput = container.querySelector('input[name="username"]') as HTMLInputElement;
    fireEvent.change(usernameInput, { target: { name: 'username', value: 'jms-user-secret' } });

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        username: 'jms-user-secret',
      })
    );
    expect(mockOnChange.mock.calls[0][0].password).toBeUndefined();
  });

  it('choosing a secret writes passwordSecret and does NOT write password', () => {
    const mockNode = {
      data: {
        label: 'JMS',
        properties: {
          authMode: 'secretManager' as const,
        },
      },
    };
    const mockOnChange = vi.fn();

    const { container } = render(<JmsIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const secretInput = container.querySelector('input[name="passwordSecret"]') as HTMLInputElement;
    expect(secretInput).toBeInTheDocument();

    fireEvent.change(secretInput, { target: { name: 'passwordSecret', value: 'jms-broker-secret' } });

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        passwordSecret: 'jms-broker-secret',
      })
    );
    expect(mockOnChange.mock.calls[0][0].password).toBeUndefined();
  });
});
