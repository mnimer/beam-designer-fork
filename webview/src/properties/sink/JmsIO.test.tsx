/**
 * JmsIOSinkProperties Test Suite
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Unit tests validating JmsIOSinkProperties component functionality,
 * provider presets, mutual queue/topic selection, gcloud callbacks,
 * validation errors, retry configurations, value mapping, and system instructions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { JmsIOSinkProperties } from './JmsIO';

describe('JmsIOSinkProperties', () => {
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

    render(<JmsIOSinkProperties node={mockNode} onChange={mockOnChange} />);

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

    render(<JmsIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    const presetSelect = screen.getByLabelText(/JMS Provider Preset/i);
    fireEvent.change(presetSelect, { target: { value: 'org.apache.activemq.artemis.jms.client.ActiveMQConnectionFactory' } });

    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      connectionFactory: 'org.apache.activemq.artemis.jms.client.ActiveMQConnectionFactory',
      brokerUrl: 'tcp://localhost:61616'
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

    const { container } = render(<JmsIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    const presetSelect = screen.getByLabelText(/JMS Provider Preset/i) as HTMLSelectElement;
    const optionValues = Array.from(presetSelect.querySelectorAll('option')).map(o => o.value);
    expect(optionValues).not.toContain('custom');
    expect(container.querySelector('#jmsSinkCustomFactory')).not.toBeInTheDocument();
    expect(container.querySelector('input[name="customConnectionFactory"]')).not.toBeInTheDocument();
  });

  it('switches between Queue and Topic and enforces mutual exclusivity', () => {
    const mockNode = {
      data: {
        label: 'JMS',
        properties: {
          destinationType: 'queue' as const,
          queue: 'orders.out'
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<JmsIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    // Click Topic button
    const topicButton = screen.getByText(/Topic \(Pub\/Sub\)/i);
    fireEvent.click(topicButton);

    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      destinationType: 'topic',
      topic: 'orders.out'
    }));
    expect(mockOnChange.mock.calls[0][0].queue).toBeUndefined();
  });

  it('displays validation message when destination name is empty', () => {
    const mockNode = {
      data: {
        label: 'JMS',
        properties: {
          destinationType: 'topic' as const,
          topic: ''
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<JmsIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByText(/A topic name is required for JmsIO.write\(\)/i)).toBeInTheDocument();
  });

  it('receives secretsLoaded and populates secret options when Secret Manager is enabled', () => {
    const mockNode = {
      data: {
        label: 'JMS',
        properties: {
          authMode: 'secretManager' as const,
          passwordSecret: 'jms-sink-pass'
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<JmsIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    // Post message from extension
    act(() => {
      window.dispatchEvent(new MessageEvent('message', {
        data: {
          command: 'secretsLoaded',
          secrets: ['jms-sink-pass', 'gcp-sa-key']
        }
      }));
    });

    const secretInput = screen.getByLabelText(/Secret Manager Secret/i);
    expect(secretInput).toHaveValue('jms-sink-pass');

    fireEvent.change(secretInput, { target: { name: 'passwordSecret', value: 'gcp-sa-key' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      passwordSecret: 'gcp-sa-key'
    }));
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

    render(<JmsIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    // Post message with VM instances
    act(() => {
      window.dispatchEvent(new MessageEvent('message', {
        data: {
          command: 'computeInstancesLoaded',
          instances: [
            { name: 'artemis-broker', internalIp: '10.142.0.12', externalIp: '', zone: 'us-east1-b', status: 'RUNNING' }
          ]
        }
      }));
    });

    const instanceButton = screen.getByRole('button', { name: 'artemis-broker' });
    expect(instanceButton).toBeInTheDocument();

    fireEvent.click(instanceButton);
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      brokerUrl: 'tcp://10.142.0.12:61616'
    }));
  });

  it('updates retry settings and system_instructions', () => {
    const mockNode = {
      data: {
        label: 'JMS',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<JmsIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    const maxRetriesInput = screen.getByLabelText(/Max Retries/i);
    fireEvent.change(maxRetriesInput, { target: { name: 'maxRetries', value: '5' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      maxRetries: '5'
    }));

    const delayInput = screen.getByLabelText(/Retry Delay \(ms\)/i);
    fireEvent.change(delayInput, { target: { name: 'initialRetryDelay', value: '1000' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      initialRetryDelay: '1000'
    }));

    const instructionsTextarea = screen.getByLabelText(/Code Generation Instructions/i);
    fireEvent.change(instructionsTextarea, { target: { value: 'Add custom header clientTimestamp' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      system_instructions: 'Add custom header clientTimestamp'
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

    const { container } = render(<JmsIOSinkProperties node={mockNode} onChange={mockOnChange} />);

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
          password: 'legacy-sink-jms-password',
        },
      },
    };
    const mockOnChange = vi.fn();

    const { container } = render(<JmsIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    const authModeSelect = container.querySelector('select[name="authMode"]') as HTMLSelectElement;
    expect(authModeSelect).toHaveValue('secretManager');
    expect(container.querySelector('input[name="password"]')).not.toBeInTheDocument();

    const usernameInput = container.querySelector('input[name="username"]') as HTMLInputElement;
    fireEvent.change(usernameInput, { target: { name: 'username', value: 'jms-sink-user-secret' } });

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        username: 'jms-sink-user-secret',
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

    const { container } = render(<JmsIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    const secretInput = container.querySelector('input[name="passwordSecret"]') as HTMLInputElement;
    expect(secretInput).toBeInTheDocument();

    fireEvent.change(secretInput, { target: { name: 'passwordSecret', value: 'jms-sink-broker-secret' } });

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        passwordSecret: 'jms-sink-broker-secret',
      })
    );
    expect(mockOnChange.mock.calls[0][0].password).toBeUndefined();
  });
});
