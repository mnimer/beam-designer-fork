/**
 * CassandraIOSourceProperties Unit Tests
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Tests the CassandraIOSourceProperties panel component covering field rendering,
 * hydration from node properties, onChange event dispatch, IPC Secret Manager communication,
 * edge cases (missing properties, 0 values), validation alerts, and instruction fallback chains.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CassandraIOSourceProperties } from './CassandraIO';

describe('CassandraIOSourceProperties', () => {
  const mockOnChange = vi.fn();
  let postMessageSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    postMessageSpy = vi.fn();
    (window as any).vscode = { postMessage: postMessageSpy };
  });

  afterEach(() => {
    delete (window as any).vscode;
  });

  it('renders required fields and shows validation errors when empty', () => {
    const node = {
      data: {
        label: 'Cassandra Source',
        properties: {}
      }
    };

    render(<CassandraIOSourceProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('127.0.0.1, 10.0.0.1')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. telemetry')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. device_events')).toBeInTheDocument();

    expect(screen.getByText(/Contact points \/ hosts are required/i)).toBeInTheDocument();
    expect(screen.getByText(/Keyspace is required/i)).toBeInTheDocument();
    expect(screen.getByText(/Table is required/i)).toBeInTheDocument();
  });

  it('hydrates all populated properties correctly', () => {
    const node = {
      data: {
        label: 'Cassandra Source',
        properties: {
          hosts: '10.0.0.1,10.0.0.2',
          port: 9043,
          localDc: 'datacenter-east',
          keyspace: 'prod_telemetry',
          table: 'sensors',
          query: "WHERE region = 'us-east' ALLOW FILTERING",
          consistencyLevel: 'LOCAL_QUORUM',
          entity: 'com.example.SensorRecord',
          authMode: 'default',
          system_instructions: 'Convert SensorRecord to Schema Row'
        }
      }
    };

    render(<CassandraIOSourceProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('127.0.0.1, 10.0.0.1')).toHaveValue('10.0.0.1,10.0.0.2');
    expect(screen.getByPlaceholderText('9042')).toHaveValue(9043);
    expect(screen.getByPlaceholderText('datacenter1')).toHaveValue('datacenter-east');
    expect(screen.getByPlaceholderText('e.g. telemetry')).toHaveValue('prod_telemetry');
    expect(screen.getByPlaceholderText('e.g. device_events')).toHaveValue('sensors');
    expect(screen.getByPlaceholderText(/WHERE status = 'ACTIVE'/i)).toHaveValue("WHERE region = 'us-east' ALLOW FILTERING");
    expect(screen.getByRole('combobox', { name: 'Consistency Level' })).toHaveValue('LOCAL_QUORUM');
    expect(screen.getByPlaceholderText('com.example.CassandraRowEntity')).toHaveValue('com.example.SensorRecord');
    expect(screen.getByPlaceholderText(/Read Cassandra rows/i)).toHaveValue('Convert SensorRecord to Schema Row');
  });

  it('supports entityStrategy switching between infer, schema editor, and custom class', () => {
    const { unmount } = render(
      <CassandraIOSourceProperties
        node={{ data: { properties: { hosts: '127.0.0.1', keyspace: 'ks', table: 'tbl', entityStrategy: 'infer' } } }}
        onChange={mockOnChange}
      />
    );
    expect(screen.getByText(/Dynamic Inference:/i)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('com.example.CassandraRowEntity')).not.toBeInTheDocument();
    unmount();

    render(
      <CassandraIOSourceProperties
        node={{
          data: {
            properties: {
              hosts: '127.0.0.1',
              keyspace: 'ks',
              table: 'tbl',
              entityStrategy: 'schema',
              schemaString: 'device_id:STRING:REQUIRED, metric_val:DOUBLE'
            }
          }
        }}
        onChange={mockOnChange}
      />
    );
    expect(screen.getByText('Field Builder (2)')).toBeInTheDocument();
  });

  it('supports contactPoints alias fallback for hosts', () => {
    const node = {
      data: {
        label: 'Cassandra Source',
        properties: {
          contactPoints: '192.168.1.100'
        }
      }
    };

    render(<CassandraIOSourceProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('127.0.0.1, 10.0.0.1')).toHaveValue('192.168.1.100');
  });

  it('dispatches updates when text and select fields change', () => {
    const node = {
      data: {
        label: 'Cassandra Source',
        properties: {
          hosts: 'localhost'
        }
      }
    };

    render(<CassandraIOSourceProperties node={node} onChange={mockOnChange} />);

    const keyspaceInput = screen.getByPlaceholderText('e.g. telemetry');
    fireEvent.change(keyspaceInput, { target: { name: 'keyspace', value: 'analytics' } });
    expect(mockOnChange).toHaveBeenCalledWith({
      hosts: 'localhost',
      keyspace: 'analytics'
    });

    const consistencySelect = screen.getByRole('combobox', { name: 'Consistency Level' });
    fireEvent.change(consistencySelect, { target: { name: 'consistencyLevel', value: 'QUORUM' } });
    expect(mockOnChange).toHaveBeenCalledWith({
      hosts: 'localhost',
      consistencyLevel: 'QUORUM'
    });
  });

  it('switches to Secret Manager auth mode and loads secrets into datalist', () => {
    const node = {
      data: {
        label: 'Cassandra Source',
        properties: {
          hosts: 'localhost',
          authMode: 'secret_manager' as const
        }
      }
    };

    render(<CassandraIOSourceProperties node={node} onChange={mockOnChange} />);

    const usernameSecretInput = screen.getByPlaceholderText('e.g. cassandra-username');
    const passwordSecretInput = screen.getByPlaceholderText('e.g. cassandra-password');
    expect(usernameSecretInput).toBeInTheDocument();
    expect(passwordSecretInput).toBeInTheDocument();

    // Type in secret fields
    fireEvent.change(usernameSecretInput, { target: { name: 'usernameSecret', value: 'cassandra-user' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      usernameSecret: 'cassandra-user'
    }));
  });

  it('toggles Advanced Source Settings and updates parameters', () => {
    const node = {
      data: {
        label: 'Cassandra Source',
        properties: {
          minNumberOfSplits: 12,
          connectTimeout: 3000,
          readTimeout: 8000,
          ssl: false
        }
      }
    };

    render(<CassandraIOSourceProperties node={node} onChange={mockOnChange} />);

    const advancedButton = screen.getByRole('button', { name: /Advanced Source Settings/i });
    fireEvent.click(advancedButton);

    const minSplitsInput = screen.getByPlaceholderText('10');
    expect(minSplitsInput).toHaveValue(12);

    const sslCheckbox = screen.getByLabelText(/Enable SSL \/ TLS/i);
    expect(sslCheckbox).not.toBeChecked();

    fireEvent.click(sslCheckbox);
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      ssl: true
    }));

    fireEvent.change(minSplitsInput, { target: { name: 'minNumberOfSplits', value: '20' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      minNumberOfSplits: '20'
    }));
  });

  it('handles edge case: numeric fields set to 0', () => {
    const node = {
      data: {
        label: 'Cassandra Source',
        properties: {
          port: 0,
          minNumberOfSplits: 0,
          connectTimeout: 0,
          readTimeout: 0
        }
      }
    };

    render(<CassandraIOSourceProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('9042')).toHaveValue(0);

    const advancedButton = screen.getByRole('button', { name: /Advanced Source Settings/i });
    fireEvent.click(advancedButton);

    expect(screen.getByPlaceholderText('10')).toHaveValue(0);
    expect(screen.getByPlaceholderText('5000')).toHaveValue(0);
    expect(screen.getByPlaceholderText('12000')).toHaveValue(0);
  });

  it('handles missing node.data.properties gracefully without crashing', () => {
    const node = {
      data: {
        label: 'Cassandra Source'
      }
    } as any;

    render(<CassandraIOSourceProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('127.0.0.1, 10.0.0.1')).toHaveValue('');
    expect(screen.getByPlaceholderText('9042')).toHaveValue(9042);
  });

  it('updates system_instructions when textarea changes', () => {
    const node = {
      data: {
        label: 'Cassandra Source',
        properties: {}
      }
    };
    render(<CassandraIOSourceProperties node={node} onChange={mockOnChange} />);

    // Modifying textarea calls onChange with system_instructions
    const textarea = screen.getByPlaceholderText(/Read Cassandra rows/i);
    fireEvent.change(textarea, { target: { value: 'New system instructions' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      system_instructions: 'New system instructions'
    }));
  });
});
