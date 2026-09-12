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

  it('displays custom factory input when Custom preset is selected', () => {
    const mockNode = {
      data: {
        label: 'JMS',
        properties: {
          connectionFactory: 'custom',
          customConnectionFactory: 'com.enterprise.jms.CustomSinkFactory'
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<JmsIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    const customInput = screen.getByLabelText(/ConnectionFactory Class/i);
    expect(customInput).toBeInTheDocument();
    expect(customInput).toHaveValue('com.enterprise.jms.CustomSinkFactory');

    fireEvent.change(customInput, { target: { value: 'com.enterprise.jms.NewSinkFactory' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      connectionFactory: 'com.enterprise.jms.NewSinkFactory',
      customConnectionFactory: 'com.enterprise.jms.NewSinkFactory'
    }));
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
          useSecretManager: true,
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

    const secretInput = screen.getByLabelText(/Password Secret/i);
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

  it('updates retry settings, valueMapper, and system_instructions', () => {
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

    const mapperInput = screen.getByLabelText(/Value Mapper/i);
    fireEvent.change(mapperInput, { target: { name: 'valueMapper', value: 'CustomOrderMapper' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      valueMapper: 'CustomOrderMapper'
    }));

    const instructionsTextarea = screen.getByLabelText(/Code Generation Instructions/i);
    fireEvent.change(instructionsTextarea, { target: { value: 'Add custom header clientTimestamp' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      system_instructions: 'Add custom header clientTimestamp'
    }));
  });

  it('checks Use Secret Manager by default and toggles to direct password', () => {
    const mockNode = {
      data: {
        label: 'JMS',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<JmsIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    const secretManagerCheckbox = screen.getByRole('checkbox', { name: /Use Secret Manager/i });
    expect(secretManagerCheckbox).toBeChecked();
    expect(screen.getByLabelText(/Password Secret/i)).toBeInTheDocument();

    fireEvent.click(secretManagerCheckbox);
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      useSecretManager: false
    }));
  });
});
