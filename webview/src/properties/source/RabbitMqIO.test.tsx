/**
 * RabbitMqIOSourceProperties Test Suite
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Unit tests validating RabbitMqIOSourceProperties component functionality,
 * form change callbacks, protocol and port handling, gcloud Secret Manager integration,
 * Compute Engine VM instance suggestions, mutually-exclusive consumption modes (Queue vs Exchange),
 * bounded stream limits, Python x-lang expansion service configuration, and system instructions.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { RabbitMqIOSourceProperties } from './RabbitMqIO';

describe('RabbitMqIOSourceProperties', () => {
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

  it('renders default fields with documentation tooltips and placeholders in queue mode', () => {
    const mockNode = {
      data: {
        label: 'RabbitMQ',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<RabbitMqIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByLabelText(/Broker Host/i, { selector: 'input' })).toBeInTheDocument();
    expect(screen.getByLabelText(/^Port$/i, { selector: 'input' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Virtual Host/i, { selector: 'input' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Use TLS \/ SSL/i, { selector: 'input' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Username \(Secret Manager\)/i, { selector: 'input' })).toBeInTheDocument();
    expect(screen.getByText(/RabbitMQ broker credentials are authenticated via Google Cloud Secret Manager/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/GCP Secret Manager Secret/i, { selector: 'input' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Queue Name/i, { selector: 'input' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Declare Queue if Not Exists/i, { selector: 'input' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Use Correlation ID/i, { selector: 'input' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Max Records/i, { selector: 'input' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Max Read Time \(s\)/i, { selector: 'input' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Expansion Service Mode/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Code Generation Instructions/i)).toBeInTheDocument();
  });

  it('populates fields with provided properties in queue mode', () => {
    const mockNode = {
      data: {
        label: 'RabbitMQ',
        properties: {
          host: 'rabbitmq.prod.internal',
          port: 5672,
          virtualHost: '/orders',
          useTls: false,
          username: 'worker_app',
          consumeMode: 'queue' as const,
          queue: 'orders.incoming',
          queueDeclare: true,
          useCorrelationId: true,
          maxNumRecords: 1000,
          maxReadTime: 120,
          expansionServiceMode: 'auto' as const
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<RabbitMqIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByLabelText(/Broker Host/i, { selector: 'input' })).toHaveValue('rabbitmq.prod.internal');
    expect(screen.getByLabelText(/^Port$/i, { selector: 'input' })).toHaveValue(5672);
    expect(screen.getByLabelText(/Virtual Host/i, { selector: 'input' })).toHaveValue('/orders');
    expect(screen.getByLabelText(/Use TLS \/ SSL/i, { selector: 'input' })).not.toBeChecked();
    expect(screen.getByLabelText(/Username/i, { selector: 'input' })).toHaveValue('worker_app');
    expect(screen.getByLabelText(/Queue Name/i, { selector: 'input' })).toHaveValue('orders.incoming');
    expect(screen.getByLabelText(/Declare Queue if Not Exists/i, { selector: 'input' })).toBeChecked();
    expect(screen.getByLabelText(/Use Correlation ID/i, { selector: 'input' })).toBeChecked();
    expect(screen.getByLabelText(/Max Records/i, { selector: 'input' })).toHaveValue(1000);
    expect(screen.getByLabelText(/Max Read Time \(s\)/i, { selector: 'input' })).toHaveValue(120);
    expect(screen.getByLabelText(/Expansion Service Mode/i)).toHaveValue('auto');
  });

  it('renders exchange mode fields and hides queue fields when consumeMode is exchange', () => {
    const mockNode = {
      data: {
        label: 'RabbitMQ',
        properties: {
          consumeMode: 'exchange' as const,
          exchange: 'orders.topic',
          exchangeType: 'topic' as const,
          routingKey: 'orders.eu.*'
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<RabbitMqIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByLabelText(/Exchange Name/i, { selector: 'input' })).toHaveValue('orders.topic');
    expect(screen.getByLabelText(/Auto-declare Exchange/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Exchange Type/i)).toHaveValue('topic');
    expect(screen.getByLabelText(/Routing Key/i, { selector: 'input' })).toHaveValue('orders.eu.*');
    expect(screen.queryByLabelText(/Queue Name/i, { selector: 'input' })).not.toBeInTheDocument();
  });

  it('automatically detects exchange mode if properties.exchange is present and consumeMode is unset', () => {
    const mockNode = {
      data: {
        label: 'RabbitMQ',
        properties: {
          exchange: 'events.fanout'
        }
      }
    };

    render(<RabbitMqIOSourceProperties node={mockNode} onChange={vi.fn()} />);

    expect(screen.getByLabelText(/Exchange Name/i, { selector: 'input' })).toBeInTheDocument();
    expect(screen.queryByLabelText(/Queue Name/i, { selector: 'input' })).not.toBeInTheDocument();
  });

  it('emits onChange when host, port, and virtualHost change', () => {
    const mockNode = {
      data: {
        label: 'RabbitMQ',
        properties: { host: 'localhost' }
      }
    };
    const mockOnChange = vi.fn();

    render(<RabbitMqIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const hostInput = screen.getByLabelText(/Broker Host/i, { selector: 'input' });
    fireEvent.change(hostInput, { target: { name: 'host', value: 'rmq.cluster.local' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({ host: 'rmq.cluster.local' }));

    const portInput = screen.getByLabelText(/^Port$/i, { selector: 'input' });
    fireEvent.change(portInput, { target: { name: 'port', value: '5673' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({ port: '5673' }));

    const vhostInput = screen.getByLabelText(/Virtual Host/i, { selector: 'input' });
    fireEvent.change(vhostInput, { target: { name: 'virtualHost', value: '/custom-vhost' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({ virtualHost: '/custom-vhost' }));
  });

  it('toggles TLS checkbox and automatically switches port between 5672 and 5671', () => {
    const mockNode = {
      data: {
        label: 'RabbitMQ',
        properties: { port: '5672', useTls: false }
      }
    };
    const mockOnChange = vi.fn();

    const { unmount } = render(<RabbitMqIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const tlsCheckbox = screen.getByLabelText(/Use TLS \/ SSL/i, { selector: 'input' });
    fireEvent.click(tlsCheckbox);

    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      useTls: true,
      port: '5671'
    }));

    unmount();

    // Test disabling TLS switches back from 5671 to 5672
    const mockNodeTls = {
      data: {
        label: 'RabbitMQ',
        properties: { port: '5671', useTls: true }
      }
    };
    const mockOnChangeTls = vi.fn();
    render(<RabbitMqIOSourceProperties node={mockNodeTls} onChange={mockOnChangeTls} />);

    const tlsCheckboxActive = screen.getByLabelText(/Use TLS \/ SSL/i, { selector: 'input' });
    fireEvent.click(tlsCheckboxActive);

    expect(mockOnChangeTls).toHaveBeenCalledWith(expect.objectContaining({
      useTls: false,
      port: '5672'
    }));
  });

  it('switches consumeMode between queue and exchange, cleaning up opposing fields', () => {
    const mockNode = {
      data: {
        label: 'RabbitMQ',
        properties: {
          consumeMode: 'queue' as const,
          queue: 'orders.incoming',
          queueDeclare: true
        }
      }
    };
    const mockOnChange = vi.fn();

    const { unmount } = render(<RabbitMqIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const exchangeRadio = screen.getByLabelText(/^Exchange$/i, { selector: 'input' });
    fireEvent.click(exchangeRadio);

    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      consumeMode: 'exchange',
      exchangeType: 'direct'
    }));
    const callArg = mockOnChange.mock.calls[0][0];
    expect(callArg.queue).toBeUndefined();
    expect(callArg.queueDeclare).toBeUndefined();

    unmount();

    // Now test switching back to queue
    const mockNodeExchange = {
      data: {
        label: 'RabbitMQ',
        properties: {
          consumeMode: 'exchange' as const,
          exchange: 'events.topic',
          exchangeType: 'topic' as const,
          routingKey: 'events.#'
        }
      }
    };
    const mockOnChangeQueue = vi.fn();
    render(<RabbitMqIOSourceProperties node={mockNodeExchange} onChange={mockOnChangeQueue} />);

    const queueRadio = screen.getByLabelText(/^Queue$/i, { selector: 'input' });
    fireEvent.click(queueRadio);

    expect(mockOnChangeQueue).toHaveBeenCalledWith(expect.objectContaining({
      consumeMode: 'queue'
    }));
    const callArgQueue = mockOnChangeQueue.mock.calls[0][0];
    expect(callArgQueue.exchange).toBeUndefined();
    expect(callArgQueue.exchangeDeclare).toBeUndefined();
    expect(callArgQueue.exchangeType).toBeUndefined();
    expect(callArgQueue.routingKey).toBeUndefined();
  });

  it('emits onChange when queue and queueDeclare change', () => {
    const mockNode = {
      data: {
        label: 'RabbitMQ',
        properties: { consumeMode: 'queue' as const, queue: 'q1' }
      }
    };
    const mockOnChange = vi.fn();

    render(<RabbitMqIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const queueInput = screen.getByLabelText(/Queue Name/i, { selector: 'input' });
    fireEvent.change(queueInput, { target: { name: 'queue', value: 'q2.updated' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({ queue: 'q2.updated' }));

    const declareCheckbox = screen.getByLabelText(/Declare Queue if Not Exists/i, { selector: 'input' });
    fireEvent.click(declareCheckbox);
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({ queueDeclare: true }));
  });

  it('emits onChange when exchange, exchangeType, and routingKey change in exchange mode', () => {
    const mockNode = {
      data: {
        label: 'RabbitMQ',
        properties: {
          consumeMode: 'exchange' as const,
          exchange: 'ex1',
          exchangeType: 'direct' as const,
          routingKey: 'rk1'
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<RabbitMqIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const exInput = screen.getByLabelText(/Exchange Name/i, { selector: 'input' });
    fireEvent.change(exInput, { target: { name: 'exchange', value: 'ex2.fanout' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({ exchange: 'ex2.fanout' }));

    const exTypeSelect = screen.getByLabelText(/Exchange Type/i);
    fireEvent.change(exTypeSelect, { target: { name: 'exchangeType', value: 'fanout' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({ exchangeType: 'fanout' }));

    const rkInput = screen.getByLabelText(/Routing Key/i, { selector: 'input' });
    fireEvent.change(rkInput, { target: { name: 'routingKey', value: 'orders.*' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({ routingKey: 'orders.*' }));
  });

  it('emits onChange when useCorrelationId, maxNumRecords, and maxReadTime change', () => {
    const mockNode = {
      data: {
        label: 'RabbitMQ',
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<RabbitMqIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const corrCheckbox = screen.getByLabelText(/Use Correlation ID/i, { selector: 'input' });
    fireEvent.click(corrCheckbox);
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({ useCorrelationId: true }));

    const maxRecordsInput = screen.getByLabelText(/Max Records/i, { selector: 'input' });
    fireEvent.change(maxRecordsInput, { target: { name: 'maxNumRecords', value: '5000' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({ maxNumRecords: '5000' }));

    const maxTimeInput = screen.getByLabelText(/Max Read Time \(s\)/i, { selector: 'input' });
    fireEvent.change(maxTimeInput, { target: { name: 'maxReadTime', value: '300' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({ maxReadTime: '300' }));
  });

  it('handles expansion service mode switching and endpoint entry', () => {
    const mockNode = {
      data: {
        label: 'RabbitMQ',
        properties: {
          expansionServiceMode: 'auto' as const
        }
      }
    };
    const mockOnChange = vi.fn();

    const { unmount } = render(<RabbitMqIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    expect(screen.queryByLabelText(/Expansion Service Endpoint/i, { selector: 'input' })).not.toBeInTheDocument();

    const modeSelect = screen.getByLabelText(/Expansion Service Mode/i);
    fireEvent.change(modeSelect, { target: { name: 'expansionServiceMode', value: 'endpoint' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({ expansionServiceMode: 'endpoint' }));

    unmount();

    // Re-render in endpoint mode
    const mockNodeEndpoint = {
      data: {
        label: 'RabbitMQ',
        properties: {
          expansionServiceMode: 'endpoint' as const,
          expansionServiceEndpoint: 'localhost:8097'
        }
      }
    };
    render(<RabbitMqIOSourceProperties node={mockNodeEndpoint} onChange={mockOnChange} />);

    const endpointInput = screen.getByLabelText(/Expansion Service Endpoint/i, { selector: 'input' });
    expect(endpointInput).toHaveValue('localhost:8097');

    fireEvent.change(endpointInput, { target: { name: 'expansionServiceEndpoint', value: '10.0.0.1:9099' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({ expansionServiceEndpoint: '10.0.0.1:9099' }));
  });

  it('validates required fields with semantic red borders and aria-invalid', () => {
    const mockNode = {
      data: {
        label: 'RabbitMQ',
        properties: {
          host: '',
          consumeMode: 'queue' as const,
          queue: ''
        }
      }
    };

    const { unmount: unmount1 } = render(<RabbitMqIOSourceProperties node={mockNode} onChange={vi.fn()} />);

    const hostInput = screen.getByLabelText(/Broker Host/i, { selector: 'input' });
    expect(hostInput).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Broker host is required.')).toBeInTheDocument();

    const queueInput = screen.getByLabelText(/Queue Name/i, { selector: 'input' });
    expect(queueInput).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Queue name is required.')).toBeInTheDocument();

    unmount1();

    // Verify exchange validation in exchange mode
    const mockNodeExchange = {
      data: {
        label: 'RabbitMQ',
        properties: {
          host: 'rmq.local',
          consumeMode: 'exchange' as const,
          exchange: ''
        }
      }
    };
    const { unmount: unmount2 } = render(<RabbitMqIOSourceProperties node={mockNodeExchange} onChange={vi.fn()} />);

    const exInput = screen.getByLabelText(/Exchange Name/i, { selector: 'input' });
    expect(exInput).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Exchange name is required.')).toBeInTheDocument();

    unmount2();

    // Verify expansion service validation in endpoint mode
    const mockNodeEndpoint = {
      data: {
        label: 'RabbitMQ',
        properties: {
          host: 'rmq.local',
          queue: 'q1',
          expansionServiceMode: 'endpoint' as const,
          expansionServiceEndpoint: ''
        }
      }
    };
    render(<RabbitMqIOSourceProperties node={mockNodeEndpoint} onChange={vi.fn()} />);

    const endpointInput = screen.getByLabelText(/Expansion Service Endpoint/i, { selector: 'input' });
    expect(endpointInput).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Expansion service endpoint is required.')).toBeInTheDocument();
  });

  it('handles Secret Manager selection', () => {
    const mockNode = {
      data: {
        label: 'RabbitMQ',
        properties: {
          passwordSource: 'secretManager' as const
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<RabbitMqIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const secretDropdown = screen.getByLabelText(/GCP Secret Manager Secret/i, { selector: 'input' });
    expect(secretDropdown).toBeInTheDocument();

    const usernameDropdown = screen.getByLabelText(/Username \(Secret Manager\)/i, { selector: 'input' });
    expect(usernameDropdown).toBeInTheDocument();

    fireEvent.change(secretDropdown, { target: { name: 'secretName', value: 'rabbitmq-admin-pass' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      secretName: 'rabbitmq-admin-pass'
    }));
  });

  it('handles computeInstancesLoaded and applies discovered VM IP to broker host', () => {
    const mockNode = {
      data: {
        label: 'RabbitMQ',
        properties: {
          host: 'localhost'
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<RabbitMqIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    act(() => {
      window.dispatchEvent(new MessageEvent('message', {
        data: {
          command: 'computeInstancesLoaded',
          instances: [
            { name: 'rmq-broker-1', status: 'RUNNING', internalIp: '10.128.0.45', externalIp: '34.68.10.12' }
          ]
        }
      }));
    });

    const vmButton = screen.getByTitle(/Use IP 10.128.0.45 for VM rmq-broker-1/i);
    expect(vmButton).toBeInTheDocument();

    fireEvent.click(vmButton);
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({ host: '10.128.0.45' }));
  });

  it('runs safely when window.vscode is undefined', () => {
    delete (window as any).vscode;

    const mockNode = {
      data: {
        label: 'RabbitMQ',
        properties: {}
      }
    };

    expect(() => {
      render(<RabbitMqIOSourceProperties node={mockNode} onChange={vi.fn()} />);
    }).not.toThrow();
  });

  it('updates system_instructions when instructions textarea is edited', () => {
    const mockNode = {
      data: {
        label: 'RabbitMQ',
        properties: {
          system_instructions: 'Initial instructions'
        }
      }
    };
    const mockOnChange = vi.fn();
    render(<RabbitMqIOSourceProperties node={mockNode} onChange={mockOnChange} />);
    const textarea = screen.getByLabelText(/Code Generation Instructions/i);
    expect(textarea).toHaveValue('Initial instructions');

    fireEvent.change(textarea, { target: { value: 'Custom instructions for RabbitMQ pipeline' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      system_instructions: 'Custom instructions for RabbitMQ pipeline'
    }));
  });
});
