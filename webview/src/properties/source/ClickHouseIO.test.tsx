/**
 * ClickHouseIOSourceProperties Unit Tests
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Tests the ClickHouseIOSourceProperties panel component covering field rendering,
 * hydration from node properties, onChange event dispatch, IPC Secret Manager communication,
 * edge cases (missing properties, 0 values, aliases), validation alerts, and instruction fallback chains.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ClickHouseIOSourceProperties } from './ClickHouseIO';

describe('ClickHouseIOSourceProperties', () => {
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
        label: 'ClickHouse Source',
        properties: {}
      }
    };

    render(<ClickHouseIOSourceProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('jdbc:clickhouse://localhost:8123/default')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('SELECT id, name, timestamp FROM my_table')).toBeInTheDocument();

    expect(screen.getByText('ClickHouse JDBC URL is required')).toBeInTheDocument();
    expect(screen.getByText('SELECT query is required')).toBeInTheDocument();
  });

  it('shows warning alert when JDBC URL does not start with jdbc:clickhouse:', () => {
    const node = {
      data: {
        label: 'ClickHouse Source',
        properties: {
          url: 'http://localhost:8123/default',
          query: 'SELECT * FROM test'
        }
      }
    };

    render(<ClickHouseIOSourceProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Warning: ClickHouse JDBC URL should start with "jdbc:clickhouse:"'
    );
  });

  it('does not show warning alert when JDBC URL correctly starts with jdbc:clickhouse:', () => {
    const node = {
      data: {
        label: 'ClickHouse Source',
        properties: {
          url: 'jdbc:clickhouse://localhost:8123/analytics',
          query: 'SELECT 1'
        }
      }
    };

    render(<ClickHouseIOSourceProperties node={node} onChange={mockOnChange} />);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('hydrates all populated properties correctly', () => {
    const node = {
      data: {
        label: 'ClickHouse Source',
        properties: {
          url: 'jdbc:clickhouse://ch-node:8123/analytics',
          driverClassName: 'ru.yandex.clickhouse.ClickHouseDriver',
          database: 'analytics',
          table: 'events',
          query: 'SELECT event_id, event_time FROM events',
          rowMapper: 'com.example.EventRowMapper',
          fetchSize: 25000,
          partitionColumn: 'event_id',
          lowerBound: 100,
          upperBound: 500000,
          splitCount: 8,
          authMode: 'secret_manager' as const,
          usernameSecret: 'ch-user-secret',
          passwordSecret: 'ch-pass-secret',
          socketTimeout: 45000,
          connectionTimeout: 15000,
          compress: true,
          extraJdbcProperties: 'ssl=true\nsslmode=strict',
          system_instructions: 'Custom instructions for LLM'
        }
      }
    };

    render(<ClickHouseIOSourceProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('jdbc:clickhouse://localhost:8123/default')).toHaveValue(
      'jdbc:clickhouse://ch-node:8123/analytics'
    );
    expect(screen.getByPlaceholderText('com.clickhouse.jdbc.ClickHouseDriver')).toHaveValue(
      'ru.yandex.clickhouse.ClickHouseDriver'
    );
    expect(screen.getByPlaceholderText('default')).toHaveValue('analytics');
    expect(screen.getByPlaceholderText('my_table')).toHaveValue('events');
    expect(screen.getByPlaceholderText('SELECT id, name, timestamp FROM my_table')).toHaveValue(
      'SELECT event_id, event_time FROM events'
    );
    expect(screen.getByPlaceholderText('com.example.ClickHouseRowMapper')).toHaveValue('com.example.EventRowMapper');
    expect(screen.getByPlaceholderText('50000')).toHaveValue(25000);
    expect(screen.getByPlaceholderText('id')).toHaveValue('event_id');
    expect(screen.getByPlaceholderText('1')).toHaveValue(100);
    expect(screen.getByPlaceholderText('1000000')).toHaveValue(500000);
    expect(screen.getByPlaceholderText('10')).toHaveValue(8);

    // Auth fields
    expect(screen.getByPlaceholderText('e.g. clickhouse-username')).toHaveValue('ch-user-secret');
    expect(screen.getByPlaceholderText('e.g. clickhouse-password')).toHaveValue('ch-pass-secret');

    // Advanced section
    fireEvent.click(screen.getByRole('button', { name: /Advanced Source Settings/i }));
    expect(screen.getByPlaceholderText('30000')).toHaveValue(45000);
    expect(screen.getByPlaceholderText('10000')).toHaveValue(15000);
    expect(screen.getByRole('checkbox', { name: /Enable Compression/i })).toBeChecked();
    expect(screen.getByPlaceholderText(/ssl=true/i)).toHaveValue('ssl=true\nsslmode=strict');

    // System instructions
    expect(screen.getByPlaceholderText(/Read ClickHouse records via JdbcIO/i)).toHaveValue(
      'Custom instructions for LLM'
    );
  });

  it('supports mapperStrategy switching between infer, schema editor, and custom class', () => {
    const { unmount } = render(
      <ClickHouseIOSourceProperties
        node={{ data: { properties: { url: 'jdbc:clickhouse://localhost:8123/default', query: 'SELECT 1', mapperStrategy: 'infer' } } }}
        onChange={mockOnChange}
      />
    );
    expect(screen.getByText(/Dynamic Inference:/i)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('com.example.ClickHouseRowMapper')).not.toBeInTheDocument();
    unmount();

    render(
      <ClickHouseIOSourceProperties
        node={{
          data: {
            properties: {
              url: 'jdbc:clickhouse://localhost:8123/default',
              query: 'SELECT id, name FROM t',
              mapperStrategy: 'schema',
              schemaString: 'id:BIGINT:REQUIRED, name:STRING'
            }
          }
        }}
        onChange={mockOnChange}
      />
    );
    expect(screen.getByText('Field Builder (2)')).toBeInTheDocument();
  });

  it('supports alias fallbacks for jdbcUrl, tableName, numPartitions, connectionProperties', () => {
    const node = {
      data: {
        label: 'ClickHouse Source',
        properties: {
          jdbcUrl: 'jdbc:clickhouse://ch-alias:8123/default',
          tableName: 'aliased_table',
          numPartitions: 4,
          connectionProperties: 'socket_timeout=5000'
        }
      }
    };

    render(<ClickHouseIOSourceProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('jdbc:clickhouse://localhost:8123/default')).toHaveValue(
      'jdbc:clickhouse://ch-alias:8123/default'
    );
    expect(screen.getByPlaceholderText('my_table')).toHaveValue('aliased_table');
    expect(screen.getByPlaceholderText('10')).toHaveValue(4);

    fireEvent.click(screen.getByRole('button', { name: /Advanced Source Settings/i }));
    expect(screen.getByPlaceholderText(/ssl=true/i)).toHaveValue('socket_timeout=5000');

    // Verify writing canonical key removes legacy alias to prevent desync
    const tableInput = screen.getByPlaceholderText('my_table');
    fireEvent.change(tableInput, { target: { name: 'table', value: 'canonical_table' } });
    expect(mockOnChange).toHaveBeenCalledWith({
      jdbcUrl: 'jdbc:clickhouse://ch-alias:8123/default',
      table: 'canonical_table',
      numPartitions: 4,
      connectionProperties: 'socket_timeout=5000'
    });
  });

  it('dispatches updates on text and numeric input changes', () => {
    const node = {
      data: {
        label: 'ClickHouse Source',
        properties: {
          url: 'jdbc:clickhouse://localhost:8123/default'
        }
      }
    };

    render(<ClickHouseIOSourceProperties node={node} onChange={mockOnChange} />);

    const urlInput = screen.getByPlaceholderText('jdbc:clickhouse://localhost:8123/default');
    fireEvent.change(urlInput, { target: { name: 'url', value: 'jdbc:clickhouse://remote:8123/db' } });
    expect(mockOnChange).toHaveBeenCalledWith({
      url: 'jdbc:clickhouse://remote:8123/db'
    });

    const queryInput = screen.getByPlaceholderText('SELECT id, name, timestamp FROM my_table');
    fireEvent.change(queryInput, { target: { name: 'query', value: 'SELECT * FROM users' } });
    expect(mockOnChange).toHaveBeenCalledWith({
      url: 'jdbc:clickhouse://localhost:8123/default',
      query: 'SELECT * FROM users'
    });

    const fetchSizeInput = screen.getByPlaceholderText('50000');
    fireEvent.change(fetchSizeInput, { target: { name: 'fetchSize', value: '10000' } });
    expect(mockOnChange).toHaveBeenCalledWith({
      url: 'jdbc:clickhouse://localhost:8123/default',
      fetchSize: '10000'
    });
  });

  it('handles authMode toggle and loads secrets via IPC', () => {
    const node = {
      data: {
        label: 'ClickHouse Source',
        properties: {
          url: 'jdbc:clickhouse://localhost:8123/default',
          authMode: 'none' as const
        }
      }
    };

    const { rerender } = render(<ClickHouseIOSourceProperties node={node} onChange={mockOnChange} />);

    expect(screen.queryByPlaceholderText('e.g. clickhouse-username')).not.toBeInTheDocument();

    // Switch radio to secret_manager
    const secretManagerRadio = screen.getByRole('radio', { name: /Secret Manager/i });
    fireEvent.click(secretManagerRadio);
    expect(mockOnChange).toHaveBeenCalledWith({
      url: 'jdbc:clickhouse://localhost:8123/default',
      authMode: 'secret_manager'
    });

    // Re-render with secret_manager
    const updatedNode = {
      data: {
        ...node.data,
        properties: {
          ...node.data.properties,
          authMode: 'secret_manager' as const
        }
      }
    };
    rerender(<ClickHouseIOSourceProperties node={updatedNode} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('e.g. clickhouse-username')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. clickhouse-password')).toBeInTheDocument();
  });

  it('handles advanced source settings updates', () => {
    const node = {
      data: {
        label: 'ClickHouse Source',
        properties: {
          url: 'jdbc:clickhouse://localhost:8123/default'
        }
      }
    };

    render(<ClickHouseIOSourceProperties node={node} onChange={mockOnChange} />);

    const toggleButton = screen.getByRole('button', { name: /Advanced Source Settings/i });
    fireEvent.click(toggleButton);
    expect(screen.getByPlaceholderText('30000')).toBeInTheDocument();

    // Change compress checkbox
    const compressCheckbox = screen.getByRole('checkbox', { name: /Enable Compression/i });
    fireEvent.click(compressCheckbox);
    expect(mockOnChange).toHaveBeenCalledWith({
      url: 'jdbc:clickhouse://localhost:8123/default',
      compress: true
    });
  });

  it('handles edge cases: missing properties, 0 values', () => {
    const node = {
      data: {
        label: 'ClickHouse Source'
      }
    };

    const { rerender } = render(<ClickHouseIOSourceProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('jdbc:clickhouse://localhost:8123/default')).toHaveValue('');

    const nodeWithZeros = {
      data: {
        label: 'ClickHouse Source',
        properties: {
          lowerBound: 0,
          splitCount: 0
        }
      }
    };

    rerender(<ClickHouseIOSourceProperties node={nodeWithZeros} onChange={mockOnChange} />);
    expect(screen.getByPlaceholderText('1')).toHaveValue(0);
    expect(screen.getByPlaceholderText('10')).toHaveValue(0);
  });

  it('updates system_instructions when instructions textarea changes', () => {
    const node = {
      data: {
        label: 'ClickHouse Source',
        properties: {}
      }
    };
    render(<ClickHouseIOSourceProperties node={node} onChange={mockOnChange} />);
    const textarea = screen.getByPlaceholderText(/Read ClickHouse records via JdbcIO/i);
    fireEvent.change(textarea, { target: { value: 'Updated prompt instructions' } });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      system_instructions: 'Updated prompt instructions'
    }));
  });
});
