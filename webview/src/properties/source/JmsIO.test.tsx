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

  it('displays custom factory input when Custom preset is selected', () => {
    const mockNode = {
      data: {
        label: 'JMS',
        properties: {
          connectionFactory: 'custom',
          customConnectionFactory: 'com.mycorp.jms.MyConnectionFactory'
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<JmsIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const customInput = screen.getByLabelText(/ConnectionFactory Class/i);
    expect(customInput).toBeInTheDocument();
    expect(customInput).toHaveValue('com.mycorp.jms.MyConnectionFactory');

    fireEvent.change(customInput, { target: { value: 'com.mycorp.jms.NewFactory' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      connectionFactory: 'com.mycorp.jms.NewFactory',
      customConnectionFactory: 'com.mycorp.jms.NewFactory'
    }));
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

  it('receives secretsLoaded and populates secret options when Secret Manager is enabled', () => {
    const mockNode = {
      data: {
        label: 'JMS',
        properties: {
          useSecretManager: true,
          passwordSecret: 'jms-pass'
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<JmsIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    // Post message from extension
    act(() => {
      window.dispatchEvent(new MessageEvent('message', {
        data: {
          command: 'secretsLoaded',
          secrets: ['jms-pass', 'db-pass', 'oauth-token']
        }
      }));
    });

    const secretInput = screen.getByLabelText(/Password Secret/i);
    expect(secretInput).toHaveValue('jms-pass');

    fireEvent.change(secretInput, { target: { name: 'passwordSecret', value: 'db-pass' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      passwordSecret: 'db-pass'
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

  it('checks Use Secret Manager by default and toggles to direct password', () => {
    const mockNode = {
      data: {
        label: 'JMS',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<JmsIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const secretManagerCheckbox = screen.getByRole('checkbox', { name: /Use Secret Manager/i });
    expect(secretManagerCheckbox).toBeChecked();
    expect(screen.getByLabelText(/Password Secret/i)).toBeInTheDocument();

    fireEvent.click(secretManagerCheckbox);
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      useSecretManager: false
    }));
  });
});
