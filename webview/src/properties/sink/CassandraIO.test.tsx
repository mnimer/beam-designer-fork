/**
 * CassandraIOSinkProperties Unit Tests
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Tests the CassandraIOSinkProperties panel component covering field rendering,
 * hydration from node properties, onChange event dispatch, IPC Secret Manager communication,
 * mutation mode toggling (write vs delete), edge cases (missing properties, 0 values),
 * validation alerts, and instruction fallback chains.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CassandraIOSinkProperties } from './CassandraIO';

describe('CassandraIOSinkProperties', () => {
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
        label: 'Cassandra Sink',
        properties: {}
      }
    };

    render(<CassandraIOSinkProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('127.0.0.1, 10.0.0.1')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. telemetry')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. device_rollups')).toBeInTheDocument();

    expect(screen.getByText(/Contact points \/ hosts are required/i)).toBeInTheDocument();
    expect(screen.getByText(/Keyspace is required/i)).toBeInTheDocument();
    expect(screen.getByText(/Table is required/i)).toBeInTheDocument();

    expect(postMessageSpy).toHaveBeenCalledWith({ command: 'getSecrets' });
  });

  it('hydrates all populated sink properties correctly', () => {
    const node = {
      data: {
        label: 'Cassandra Sink',
        properties: {
          hosts: 'cassandra.internal:9042',
          port: 9042,
          localDc: 'dc2',
          keyspace: 'analytics_db',
          table: 'hourly_rollups',
          mutationType: 'delete',
          entity: 'com.example.RollupEntity',
          consistencyLevel: 'QUORUM',
          authMode: 'default',
          system_instructions: 'Delete processed records via CassandraIO.delete()'
        }
      }
    };

    render(<CassandraIOSinkProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('127.0.0.1, 10.0.0.1')).toHaveValue('cassandra.internal:9042');
    expect(screen.getByPlaceholderText('9042')).toHaveValue(9042);
    expect(screen.getByPlaceholderText('datacenter1')).toHaveValue('dc2');
    expect(screen.getByPlaceholderText('e.g. telemetry')).toHaveValue('analytics_db');
    expect(screen.getByPlaceholderText('e.g. device_rollups')).toHaveValue('hourly_rollups');
    expect(screen.getByLabelText(/Delete \(CassandraIO\.delete\(\)\)/i)).toBeChecked();
    expect(screen.getByRole('combobox', { name: 'Consistency Level' })).toHaveValue('QUORUM');
    expect(screen.getByPlaceholderText('com.example.CassandraRowEntity')).toHaveValue('com.example.RollupEntity');
    expect(screen.getByPlaceholderText(/Write mutated Cassandra entities/i)).toHaveValue('Delete processed records via CassandraIO.delete()');
  });

  it('supports entityStrategy switching between infer, schema editor, and custom class', () => {
    const { unmount } = render(
      <CassandraIOSinkProperties
        node={{ data: { properties: { hosts: '127.0.0.1', keyspace: 'ks', table: 'tbl', entityStrategy: 'infer' } } }}
        onChange={mockOnChange}
      />
    );
    expect(screen.getByText(/Dynamic Inference:/i)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('com.example.CassandraRowEntity')).not.toBeInTheDocument();
    unmount();

    render(
      <CassandraIOSinkProperties
        node={{
          data: {
            properties: {
              hosts: '127.0.0.1',
              keyspace: 'ks',
              table: 'tbl',
              entityStrategy: 'schema',
              schemaString: 'device_id:STRING:REQUIRED, avg_val:DOUBLE'
            }
          }
        }}
        onChange={mockOnChange}
      />
    );
    expect(screen.getByText('Field Builder (2)')).toBeInTheDocument();
  });

  it('toggles mutation mode from write to delete and dispatches update', () => {
    const node = {
      data: {
        label: 'Cassandra Sink',
        properties: {
          mutationType: 'write'
        }
      }
    };

    render(<CassandraIOSinkProperties node={node} onChange={mockOnChange} />);

    const writeRadio = screen.getByLabelText(/Write \/ Upsert \(CassandraIO\.write\(\)\)/i);
    const deleteRadio = screen.getByLabelText(/Delete \(CassandraIO\.delete\(\)\)/i);

    expect(writeRadio).toBeChecked();
    expect(deleteRadio).not.toBeChecked();

    fireEvent.click(deleteRadio);
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      mutationType: 'delete'
    }));
  });

  it('dispatches updates when text and select fields change', () => {
    const node = {
      data: {
        label: 'Cassandra Sink',
        properties: {
          hosts: 'localhost'
        }
      }
    };

    render(<CassandraIOSinkProperties node={node} onChange={mockOnChange} />);

    const keyspaceInput = screen.getByPlaceholderText('e.g. telemetry');
    fireEvent.change(keyspaceInput, { target: { name: 'keyspace', value: 'realtime_events' } });
    expect(mockOnChange).toHaveBeenCalledWith({
      hosts: 'localhost',
      keyspace: 'realtime_events'
    });

    const tableInput = screen.getByPlaceholderText('e.g. device_rollups');
    fireEvent.change(tableInput, { target: { name: 'table', value: 'aggregated_metrics' } });
    expect(mockOnChange).toHaveBeenCalledWith({
      hosts: 'localhost',
      table: 'aggregated_metrics'
    });

    const consistencySelect = screen.getByRole('combobox', { name: 'Consistency Level' });
    fireEvent.change(consistencySelect, { target: { name: 'consistencyLevel', value: 'LOCAL_QUORUM' } });
    expect(mockOnChange).toHaveBeenCalledWith({
      hosts: 'localhost',
      consistencyLevel: 'LOCAL_QUORUM'
    });
  });

  it('switches to Secret Manager auth mode and loads secrets into sink datalist', () => {
    const node = {
      data: {
        label: 'Cassandra Sink',
        properties: {
          hosts: 'localhost',
          authMode: 'secret_manager' as const
        }
      }
    };

    render(<CassandraIOSinkProperties node={node} onChange={mockOnChange} />);

    const usernameSecretInput = screen.getByPlaceholderText('e.g. cassandra-username');
    const passwordSecretInput = screen.getByPlaceholderText('e.g. cassandra-password');
    expect(usernameSecretInput).toBeInTheDocument();
    expect(passwordSecretInput).toBeInTheDocument();

    // Simulate secretsLoaded event
    fireEvent(window, new MessageEvent('message', {
      data: {
        command: 'secretsLoaded',
        secrets: [
          'projects/my-project/secrets/sink-cassandra-user',
          { id: 'sink-cassandra-pass', name: 'sink-cassandra-pass' }
        ]
      }
    }));

    const option1 = document.querySelector('datalist#cassandra-sink-secret-options option[value="sink-cassandra-user"]');
    const option2 = document.querySelector('datalist#cassandra-sink-secret-options option[value="sink-cassandra-pass"]');
    expect(option1).not.toBeNull();
    expect(option2).not.toBeNull();

    // Type in secret fields
    fireEvent.change(passwordSecretInput, { target: { name: 'passwordSecret', value: 'sink-cassandra-pass' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      passwordSecret: 'sink-cassandra-pass'
    }));
  });

  it('displays error when Secret Manager loading fails', () => {
    const node = {
      data: {
        label: 'Cassandra Sink',
        properties: {
          authMode: 'secret_manager' as const
        }
      }
    };

    render(<CassandraIOSinkProperties node={node} onChange={mockOnChange} />);

    fireEvent(window, new MessageEvent('message', {
      data: {
        command: 'secretsLoaded',
        error: 'Failed to access Secret Manager in sink'
      }
    }));

    expect(screen.getByText('Failed to access Secret Manager in sink')).toBeInTheDocument();
  });

  it('toggles Advanced Sink Settings and updates parameters', () => {
    const node = {
      data: {
        label: 'Cassandra Sink',
        properties: {
          maxBatchSize: 150,
          concurrentAsyncQueries: 25,
          connectTimeout: 4000,
          readTimeout: 10000,
          ssl: false
        }
      }
    };

    render(<CassandraIOSinkProperties node={node} onChange={mockOnChange} />);

    const advancedButton = screen.getByRole('button', { name: /Advanced Sink Settings/i });
    fireEvent.click(advancedButton);

    const batchSizeInput = screen.getByPlaceholderText('100');
    expect(batchSizeInput).toHaveValue(150);

    const concurrentInput = screen.getByPlaceholderText('50');
    expect(concurrentInput).toHaveValue(25);

    const sslCheckbox = screen.getByLabelText(/Enable SSL \/ TLS/i);
    expect(sslCheckbox).not.toBeChecked();

    fireEvent.click(sslCheckbox);
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      ssl: true
    }));

    fireEvent.change(batchSizeInput, { target: { name: 'maxBatchSize', value: '200' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      maxBatchSize: '200'
    }));
  });

  it('handles edge case: numeric fields set to 0', () => {
    const node = {
      data: {
        label: 'Cassandra Sink',
        properties: {
          port: 0,
          maxBatchSize: 0,
          concurrentAsyncQueries: 0,
          connectTimeout: 0,
          readTimeout: 0
        }
      }
    };

    render(<CassandraIOSinkProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('9042')).toHaveValue(0);

    const advancedButton = screen.getByRole('button', { name: /Advanced Sink Settings/i });
    fireEvent.click(advancedButton);

    expect(screen.getByPlaceholderText('100')).toHaveValue(0);
    expect(screen.getByPlaceholderText('50')).toHaveValue(0);
    expect(screen.getByPlaceholderText('5000')).toHaveValue(0);
    expect(screen.getByPlaceholderText('12000')).toHaveValue(0);
  });

  it('handles missing node.data.properties gracefully without crashing', () => {
    const node = {
      data: {
        label: 'Cassandra Sink'
      }
    } as any;

    render(<CassandraIOSinkProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('127.0.0.1, 10.0.0.1')).toHaveValue('');
    expect(screen.getByPlaceholderText('9042')).toHaveValue(9042);
  });

  it('respects system_instructions fallback chain', () => {
    // 1. From special_instructions in node.data
    const node1 = {
      data: {
        label: 'Cassandra Sink',
        special_instructions: 'Fallback instructions 1',
        properties: {}
      }
    };
    const { unmount } = render(<CassandraIOSinkProperties node={node1} onChange={mockOnChange} />);
    expect(screen.getByPlaceholderText(/Write mutated Cassandra entities/i)).toHaveValue('Fallback instructions 1');
    unmount();

    // 2. From properties.special_instructions
    const node2 = {
      data: {
        label: 'Cassandra Sink',
        properties: {
          special_instructions: 'Fallback instructions 2'
        }
      }
    };
    render(<CassandraIOSinkProperties node={node2} onChange={mockOnChange} />);
    expect(screen.getByPlaceholderText(/Write mutated Cassandra entities/i)).toHaveValue('Fallback instructions 2');

    // Modifying textarea calls onChange with system_instructions
    const textarea = screen.getByPlaceholderText(/Write mutated Cassandra entities/i);
    fireEvent.change(textarea, { target: { value: 'New sink instructions' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      system_instructions: 'New sink instructions'
    }));
  });
});
