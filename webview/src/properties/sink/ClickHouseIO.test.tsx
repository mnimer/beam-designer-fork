/**
 * ClickHouseIOSinkProperties Unit Tests
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Tests the ClickHouseIOSinkProperties panel component covering field rendering,
 * hydration from node properties, onChange event dispatch, IPC Secret Manager communication,
 * edge cases (missing properties, 0 values, aliases), validation alerts, and instruction fallback chains.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ClickHouseIOSinkProperties } from './ClickHouseIO';

describe('ClickHouseIOSinkProperties', () => {
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

  it('renders required positional argument fields and shows validation errors when empty', () => {
    const node = {
      data: {
        label: 'ClickHouse Sink',
        properties: {}
      }
    };

    render(<ClickHouseIOSinkProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('jdbc:clickhouse://localhost:8123/default')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('my_table')).toBeInTheDocument();

    expect(screen.getByText('ClickHouse JDBC URL is required')).toBeInTheDocument();
    expect(screen.getByText('Target table name is required')).toBeInTheDocument();

    expect(postMessageSpy).toHaveBeenCalledWith({ command: 'getSecrets' });
  });

  it('shows warning alert when JDBC URL does not start with jdbc:clickhouse:', () => {
    const node = {
      data: {
        label: 'ClickHouse Sink',
        properties: {
          url: 'http://ch-cluster:8123',
          table: 'events'
        }
      }
    };

    render(<ClickHouseIOSinkProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Warning: ClickHouse JDBC URL should start with "jdbc:clickhouse:"'
    );
  });

  it('does not show warning alert when JDBC URL starts with jdbc:clickhouse:', () => {
    const node = {
      data: {
        label: 'ClickHouse Sink',
        properties: {
          url: 'jdbc:clickhouse://ch-cluster:8123/db',
          table: 'events'
        }
      }
    };

    render(<ClickHouseIOSinkProperties node={node} onChange={mockOnChange} />);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('hydrates all populated properties correctly', () => {
    const node = {
      data: {
        label: 'ClickHouse Sink',
        properties: {
          url: 'jdbc:clickhouse://ch-sink:8123/default',
          table: 'output_metrics',
          maxInsertBlockSize: 50000,
          insertQuorum: 2,
          insertDistributedSync: true,
          insertDeduplicate: true,
          maxRetries: 5,
          initialBackoff: 2000,
          maxCumulativeBackoff: 600000,
          authMode: 'secret_manager' as const,
          usernameSecret: 'ch-sink-user',
          passwordSecret: 'ch-sink-pass',
          socketTimeout: 60000,
          compress: true,
          extraJdbcProperties: 'ssl=true',
          system_instructions: 'Sink LLM instructions'
        }
      }
    };

    render(<ClickHouseIOSinkProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('jdbc:clickhouse://localhost:8123/default')).toHaveValue(
      'jdbc:clickhouse://ch-sink:8123/default'
    );
    expect(screen.getByPlaceholderText('my_table')).toHaveValue('output_metrics');
    expect(screen.getByPlaceholderText('100000')).toHaveValue(50000);
    expect(screen.getByPlaceholderText('0')).toHaveValue(2);
    expect(screen.getByRole('checkbox', { name: /Wait for Distributed Sync/i })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Enable Deduplication/i })).toBeChecked();
    expect(screen.getByPlaceholderText('3')).toHaveValue(5);
    expect(screen.getByPlaceholderText('1000')).toHaveValue(2000);
    expect(screen.getByPlaceholderText('300000')).toHaveValue(600000);

    // Auth fields
    expect(screen.getByPlaceholderText('e.g. clickhouse-username')).toHaveValue('ch-sink-user');
    expect(screen.getByPlaceholderText('e.g. clickhouse-password')).toHaveValue('ch-sink-pass');

    // Advanced section
    fireEvent.click(screen.getByRole('button', { name: /Advanced Sink Settings/i }));
    expect(screen.getByPlaceholderText('30000')).toHaveValue(60000);
    expect(screen.getByRole('checkbox', { name: /Enable Compression/i })).toBeChecked();
    expect(screen.getByPlaceholderText(/ssl=true/i)).toHaveValue('ssl=true');

    // System instructions
    expect(screen.getByPlaceholderText(/Ingest PCollection<Row>/i)).toHaveValue('Sink LLM instructions');
  });

  it('supports alias fallbacks for jdbcUrl, tableName, connectionProperties', () => {
    const node = {
      data: {
        label: 'ClickHouse Sink',
        properties: {
          jdbcUrl: 'jdbc:clickhouse://ch-alias:8123/default',
          tableName: 'aliased_sink_table',
          connectionProperties: 'compress=0'
        }
      }
    };

    render(<ClickHouseIOSinkProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('jdbc:clickhouse://localhost:8123/default')).toHaveValue(
      'jdbc:clickhouse://ch-alias:8123/default'
    );
    expect(screen.getByPlaceholderText('my_table')).toHaveValue('aliased_sink_table');

    fireEvent.click(screen.getByRole('button', { name: /Advanced Sink Settings/i }));
    expect(screen.getByPlaceholderText(/ssl=true/i)).toHaveValue('compress=0');

    // Verify writing canonical key removes legacy alias to prevent desync
    const tableInput = screen.getByPlaceholderText('my_table');
    fireEvent.change(tableInput, { target: { name: 'table', value: 'canonical_sink_table' } });
    expect(mockOnChange).toHaveBeenCalledWith({
      jdbcUrl: 'jdbc:clickhouse://ch-alias:8123/default',
      table: 'canonical_sink_table',
      connectionProperties: 'compress=0'
    });
  });

  it('dispatches updates on text and checkbox input changes', () => {
    const node = {
      data: {
        label: 'ClickHouse Sink',
        properties: {
          url: 'jdbc:clickhouse://localhost:8123/default',
          table: 'metrics'
        }
      }
    };

    render(<ClickHouseIOSinkProperties node={node} onChange={mockOnChange} />);

    const tableInput = screen.getByPlaceholderText('my_table');
    fireEvent.change(tableInput, { target: { name: 'table', value: 'events_log' } });
    expect(mockOnChange).toHaveBeenCalledWith({
      url: 'jdbc:clickhouse://localhost:8123/default',
      table: 'events_log'
    });

    const maxBlockSizeInput = screen.getByPlaceholderText('100000');
    fireEvent.change(maxBlockSizeInput, { target: { name: 'maxInsertBlockSize', value: '250000' } });
    expect(mockOnChange).toHaveBeenCalledWith({
      url: 'jdbc:clickhouse://localhost:8123/default',
      table: 'metrics',
      maxInsertBlockSize: '250000'
    });

    const deduplicateCheckbox = screen.getByRole('checkbox', { name: /Enable Deduplication/i });
    fireEvent.click(deduplicateCheckbox);
    expect(mockOnChange).toHaveBeenCalledWith({
      url: 'jdbc:clickhouse://localhost:8123/default',
      table: 'metrics',
      insertDeduplicate: true
    });
  });

  it('handles authMode toggle and loads secrets via IPC into clickhouse-sink-secret-options datalist', () => {
    const node = {
      data: {
        label: 'ClickHouse Sink',
        properties: {
          url: 'jdbc:clickhouse://localhost:8123/default',
          table: 'metrics',
          authMode: 'none' as const
        }
      }
    };

    const { rerender } = render(<ClickHouseIOSinkProperties node={node} onChange={mockOnChange} />);

    expect(screen.queryByPlaceholderText('e.g. clickhouse-username')).not.toBeInTheDocument();

    // Switch to secret_manager
    const secretManagerRadio = screen.getByRole('radio', { name: /Secret Manager/i });
    fireEvent.click(secretManagerRadio);
    expect(mockOnChange).toHaveBeenCalledWith({
      url: 'jdbc:clickhouse://localhost:8123/default',
      table: 'metrics',
      authMode: 'secret_manager'
    });

    // Re-render
    const updatedNode = {
      data: {
        ...node.data,
        properties: {
          ...node.data.properties,
          authMode: 'secret_manager' as const
        }
      }
    };
    rerender(<ClickHouseIOSinkProperties node={updatedNode} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('e.g. clickhouse-username')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. clickhouse-password')).toBeInTheDocument();
  });

  it('handles advanced sink settings toggling and updates', () => {
    const node = {
      data: {
        label: 'ClickHouse Sink',
        properties: {
          url: 'jdbc:clickhouse://localhost:8123/default',
          table: 'metrics'
        }
      }
    };

    render(<ClickHouseIOSinkProperties node={node} onChange={mockOnChange} />);

    const toggleButton = screen.getByRole('button', { name: /Advanced Sink Settings/i });

    // Expand
    fireEvent.click(toggleButton);
    expect(screen.getByPlaceholderText('30000')).toBeInTheDocument();

    // Change compress checkbox
    const compressCheckbox = screen.getByRole('checkbox', { name: /Enable Compression/i });
    fireEvent.click(compressCheckbox);
    expect(mockOnChange).toHaveBeenCalledWith({
      url: 'jdbc:clickhouse://localhost:8123/default',
      table: 'metrics',
      compress: true
    });
  });

  it('handles edge cases: missing properties, 0 values', () => {
    const node = {
      data: {
        label: 'ClickHouse Sink'
      }
    };

    const { rerender } = render(<ClickHouseIOSinkProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('jdbc:clickhouse://localhost:8123/default')).toHaveValue('');
    expect(screen.getByPlaceholderText('my_table')).toHaveValue('');

    const nodeWithZeros = {
      data: {
        label: 'ClickHouse Sink',
        properties: {
          insertQuorum: 0,
          maxRetries: 0
        }
      }
    };

    rerender(<ClickHouseIOSinkProperties node={nodeWithZeros} onChange={mockOnChange} />);
    expect(screen.getByPlaceholderText('0')).toHaveValue(0);
    expect(screen.getByPlaceholderText('3')).toHaveValue(0);
  });

  it('respects instructions fallback chain and dispatches change', () => {
    const node = {
      data: {
        label: 'ClickHouse Sink',
        properties: {}
      }
    };
    render(<ClickHouseIOSinkProperties node={node} onChange={mockOnChange} />);
    const textarea = screen.getByPlaceholderText(/Ingest PCollection<Row>/i);
    fireEvent.change(textarea, { target: { value: 'Updated sink instructions' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      system_instructions: 'Updated sink instructions'
    }));
  });
});
