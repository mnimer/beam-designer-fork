/**
 * DatabaseIOSinkProperties Unit Tests
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Tests the DatabaseIOSinkProperties panel component covering field rendering,
 * database engine presets and selection, statement mode toggle (auto vs custom),
 * hydration from node properties, onChange event dispatch, IPC Secret Manager communication,
 * edge cases (missing properties, 0 values, aliases), validation alerts, and instruction fallback chains.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DatabaseIOSinkProperties } from './DatabaseIO';

describe('DatabaseIOSinkProperties', () => {
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

  it('renders required destination fields and shows validation errors when empty', () => {
    const node = {
      data: {
        label: 'Database Sink',
        properties: {}
      }
    };

    render(<DatabaseIOSinkProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByRole('combobox', { name: /Database Engine/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('jdbc:postgresql://localhost:5432/mydb')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('org.postgresql.Driver')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. customers')).toBeInTheDocument();

    expect(screen.getByText('JDBC URL is required')).toBeInTheDocument();
    expect(screen.getByText('Destination table is required')).toBeInTheDocument();

    expect(postMessageSpy).toHaveBeenCalledWith({ command: 'getSecrets' });
  });

  it('hydrates all populated properties correctly', () => {
    const node = {
      data: {
        label: 'Database Sink',
        properties: {
          engine: 'sqlserver' as const,
          url: 'jdbc:sqlserver://db-server:1433;databaseName=analytics',
          driverClassName: 'com.microsoft.sqlserver.jdbc.SQLServerDriver',
          table: 'processed_orders',
          statementMode: 'custom' as const,
          statement: 'INSERT INTO processed_orders (id, total) VALUES (?, ?)',
          batchSize: 500,
          autocommit: true,
          maxRetries: 5,
          authMode: 'secret_manager' as const,
          usernameSecret: 'sql-user-secret',
          passwordSecret: 'sql-pass-secret',
          connectTimeout: 40,
          sslMode: 'require',
          connectionProperties: 'encrypt=true\ntrustServerCertificate=false',
          system_instructions: 'Sink LLM instructions'
        }
      }
    };

    render(<DatabaseIOSinkProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByRole('combobox', { name: /Database Engine/i })).toHaveValue('sqlserver');
    expect(screen.getByPlaceholderText('jdbc:sqlserver://localhost:1433;databaseName=mydb')).toHaveValue(
      'jdbc:sqlserver://db-server:1433;databaseName=analytics'
    );
    expect(screen.getByPlaceholderText('org.postgresql.Driver')).toHaveValue(
      'com.microsoft.sqlserver.jdbc.SQLServerDriver'
    );
    expect(screen.getByPlaceholderText('e.g. customers')).toHaveValue('processed_orders');
    expect(screen.getByRole('radio', { name: /Custom Prepared Statement/i })).toBeChecked();
    expect(screen.getByPlaceholderText(/INSERT INTO customers/i)).toHaveValue(
      'INSERT INTO processed_orders (id, total) VALUES (?, ?)'
    );
    expect(screen.getByPlaceholderText('1000')).toHaveValue(500);
    expect(screen.getByRole('checkbox', { name: /Enable Autocommit/i })).toBeChecked();
    expect(screen.getByPlaceholderText('3')).toHaveValue(5);

    // Auth
    expect(screen.getByPlaceholderText('e.g. db-username')).toHaveValue('sql-user-secret');
    expect(screen.getByPlaceholderText('e.g. db-password')).toHaveValue('sql-pass-secret');

    // Advanced section
    fireEvent.click(screen.getByRole('button', { name: /Advanced Sink Settings/i }));
    expect(screen.getByPlaceholderText('30')).toHaveValue(40);
    expect(screen.getByRole('combobox', { name: /SSL Mode/i })).toHaveValue('require');
    expect(screen.getByPlaceholderText(/ssl=true/i)).toHaveValue('encrypt=true\ntrustServerCertificate=false');

    // Instructions
    expect(screen.getByPlaceholderText(/Write elements using JdbcIO/i)).toHaveValue('Sink LLM instructions');
  });

  it('automatically configures default driver and URL template when changing engine', () => {
    const node = {
      data: {
        label: 'Database Sink',
        properties: {
          engine: 'postgresql' as const
        }
      }
    };

    render(<DatabaseIOSinkProperties node={node} onChange={mockOnChange} />);

    const engineSelect = screen.getByRole('combobox', { name: /Database Engine/i });
    fireEvent.change(engineSelect, { target: { value: 'oracle' } });

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        engine: 'oracle',
        driverClassName: 'oracle.jdbc.driver.OracleDriver',
        url: 'jdbc:oracle:thin:@localhost:1521:xe'
      })
    );
  });

  it('toggles statement mode between auto and custom prepared statement', () => {
    const node = {
      data: {
        label: 'Database Sink',
        properties: {
          url: 'jdbc:postgresql://localhost:5432/mydb',
          table: 'users',
          statementMode: 'auto' as const
        }
      }
    };

    const { rerender } = render(<DatabaseIOSinkProperties node={node} onChange={mockOnChange} />);

    expect(screen.queryByPlaceholderText(/INSERT INTO customers/i)).not.toBeInTheDocument();

    const customRadio = screen.getByRole('radio', { name: /Custom Prepared Statement/i });
    fireEvent.click(customRadio);
    expect(mockOnChange).toHaveBeenCalledWith({
      url: 'jdbc:postgresql://localhost:5432/mydb',
      table: 'users',
      statementMode: 'custom'
    });

    const updatedNode = {
      data: {
        ...node.data,
        properties: {
          ...node.data.properties,
          statementMode: 'custom' as const
        }
      }
    };
    rerender(<DatabaseIOSinkProperties node={updatedNode} onChange={mockOnChange} />);

    const statementInput = screen.getByPlaceholderText(/INSERT INTO customers/i);
    expect(statementInput).toBeInTheDocument();

    fireEvent.change(statementInput, { target: { name: 'statement', value: 'INSERT INTO users VALUES (?)' } });
    expect(mockOnChange).toHaveBeenCalledWith({
      url: 'jdbc:postgresql://localhost:5432/mydb',
      table: 'users',
      statementMode: 'custom',
      statement: 'INSERT INTO users VALUES (?)'
    });
  });

  it('dispatches updates when text and checkbox inputs change', () => {
    const node = {
      data: {
        label: 'Database Sink',
        properties: {
          url: 'jdbc:postgresql://localhost:5432/mydb',
          table: 'products'
        }
      }
    };

    render(<DatabaseIOSinkProperties node={node} onChange={mockOnChange} />);

    const batchSizeInput = screen.getByPlaceholderText('1000');
    fireEvent.change(batchSizeInput, { target: { name: 'batchSize', value: '2500' } });
    expect(mockOnChange).toHaveBeenCalledWith({
      url: 'jdbc:postgresql://localhost:5432/mydb',
      table: 'products',
      batchSize: '2500'
    });

    const autocommitCheckbox = screen.getByRole('checkbox', { name: /Enable Autocommit/i });
    fireEvent.click(autocommitCheckbox);
    expect(mockOnChange).toHaveBeenCalledWith({
      url: 'jdbc:postgresql://localhost:5432/mydb',
      table: 'products',
      autocommit: true
    });
  });

  it('handles authMode toggle and loads secrets via IPC', () => {
    const node = {
      data: {
        label: 'Database Sink',
        properties: {
          url: 'jdbc:postgresql://localhost:5432/mydb',
          table: 'products',
          authMode: 'none' as const
        }
      }
    };

    const { rerender } = render(<DatabaseIOSinkProperties node={node} onChange={mockOnChange} />);

    expect(screen.queryByPlaceholderText('e.g. db-username')).not.toBeInTheDocument();

    const secretManagerRadio = screen.getByRole('radio', { name: /Secret Manager/i });
    fireEvent.click(secretManagerRadio);
    expect(mockOnChange).toHaveBeenCalledWith({
      url: 'jdbc:postgresql://localhost:5432/mydb',
      table: 'products',
      authMode: 'secret_manager'
    });

    const updatedNode = {
      data: {
        ...node.data,
        properties: {
          ...node.data.properties,
          authMode: 'secret_manager' as const
        }
      }
    };
    rerender(<DatabaseIOSinkProperties node={updatedNode} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('e.g. db-username')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. db-password')).toBeInTheDocument();

    fireEvent(
      window,
      new MessageEvent('message', {
        data: {
          command: 'secretsLoaded',
          secrets: [
            { id: 'db-sink-user', name: 'db-sink-user' },
            'projects/my-proj/secrets/db-sink-pass'
          ]
        }
      })
    );

    const datalist = document.getElementById('databaseio-sink-secret-options');
    expect(datalist).toBeInTheDocument();
    expect(datalist?.children.length).toBe(2);
    expect(datalist?.children[0]).toHaveAttribute('value', 'db-sink-user');
    expect(datalist?.children[1]).toHaveAttribute('value', 'db-sink-pass');
  });

  it('displays error alert when secretsLoaded carries an error message', () => {
    const node = {
      data: {
        label: 'Database Sink',
        properties: {
          authMode: 'secret_manager' as const
        }
      }
    };

    render(<DatabaseIOSinkProperties node={node} onChange={mockOnChange} />);

    fireEvent(
      window,
      new MessageEvent('message', {
        data: {
          command: 'secretsLoaded',
          error: 'Sink Secret Manager permission denied'
        }
      })
    );

    expect(screen.getByText(/Sink Secret Manager permission denied/i)).toBeInTheDocument();
  });

  it('handles advanced sink settings toggling and updates', () => {
    const node = {
      data: {
        label: 'Database Sink',
        properties: {
          url: 'jdbc:postgresql://localhost:5432/mydb',
          table: 'products'
        }
      }
    };

    render(<DatabaseIOSinkProperties node={node} onChange={mockOnChange} />);

    const toggleButton = screen.getByRole('button', { name: /Advanced Sink Settings/i });
    expect(screen.queryByPlaceholderText('30')).not.toBeInTheDocument();

    fireEvent.click(toggleButton);
    expect(screen.getByPlaceholderText('30')).toBeInTheDocument();

    const connectTimeoutInput = screen.getByPlaceholderText('30');
    fireEvent.change(connectTimeoutInput, { target: { name: 'connectTimeout', value: '60' } });
    expect(mockOnChange).toHaveBeenCalledWith({
      url: 'jdbc:postgresql://localhost:5432/mydb',
      table: 'products',
      connectTimeout: '60'
    });

    fireEvent.click(toggleButton);
    expect(screen.queryByPlaceholderText('30')).not.toBeInTheDocument();
  });

  it('supports alias fallbacks for jdbcUrl, tableName, customStatement, retryStrategy and prunes on write', () => {
    const node = {
      data: {
        label: 'Database Sink',
        properties: {
          jdbcUrl: 'jdbc:postgresql://legacy:5432/mydb',
          tableName: 'legacy_sink_table',
          customStatement: 'INSERT INTO legacy VALUES (?)',
          retryStrategy: 4
        }
      }
    };

    render(<DatabaseIOSinkProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('jdbc:postgresql://localhost:5432/mydb')).toHaveValue(
      'jdbc:postgresql://legacy:5432/mydb'
    );
    expect(screen.getByPlaceholderText('e.g. customers')).toHaveValue('legacy_sink_table');
    expect(screen.getByPlaceholderText('3')).toHaveValue(4);

    const tableInput = screen.getByPlaceholderText('e.g. customers');
    fireEvent.change(tableInput, { target: { name: 'table', value: 'canonical_sink_table' } });
    expect(mockOnChange).toHaveBeenCalledWith({
      jdbcUrl: 'jdbc:postgresql://legacy:5432/mydb',
      table: 'canonical_sink_table',
      customStatement: 'INSERT INTO legacy VALUES (?)',
      retryStrategy: 4
    });
  });

  it('handles edge cases: missing properties, 0 values', () => {
    const node = {
      data: {
        label: 'Database Sink'
      }
    };

    const { rerender } = render(<DatabaseIOSinkProperties node={node} onChange={mockOnChange} />);
    expect(screen.getByPlaceholderText('jdbc:postgresql://localhost:5432/mydb')).toHaveValue('');

    const nodeWithZeros = {
      data: {
        label: 'Database Sink',
        properties: {
          maxRetries: 0
        }
      }
    };

    rerender(<DatabaseIOSinkProperties node={nodeWithZeros} onChange={mockOnChange} />);
    expect(screen.getByPlaceholderText('3')).toHaveValue(0);
  });

  it('respects instructions fallback chain and dispatches change', () => {
    const node1 = {
      data: {
        label: 'Database Sink',
        system_instructions: 'Sink Level 1',
        special_instructions: 'Sink Level 2',
        properties: {
          system_instructions: 'Sink Level 3'
        }
      }
    };
    const { rerender } = render(<DatabaseIOSinkProperties node={node1} onChange={mockOnChange} />);
    const textarea = screen.getByPlaceholderText(/Write elements using JdbcIO/i);
    expect(textarea).toHaveValue('Sink Level 1');

    const node2 = {
      data: {
        label: 'Database Sink',
        special_instructions: 'Sink Level 2',
        properties: {
          system_instructions: 'Sink Level 3'
        }
      }
    };
    rerender(<DatabaseIOSinkProperties node={node2} onChange={mockOnChange} />);
    expect(textarea).toHaveValue('Sink Level 2');

    const node3 = {
      data: {
        label: 'Database Sink',
        properties: {
          system_instructions: 'Sink Level 3'
        }
      }
    };
    rerender(<DatabaseIOSinkProperties node={node3} onChange={mockOnChange} />);
    expect(textarea).toHaveValue('Sink Level 3');

    const node4 = {
      data: {
        label: 'Database Sink',
        properties: {
          special_instructions: 'Sink Level 4'
        }
      }
    };
    rerender(<DatabaseIOSinkProperties node={node4} onChange={mockOnChange} />);
    expect(textarea).toHaveValue('Sink Level 4');

    fireEvent.change(textarea, { target: { value: 'Updated sink instructions' } });
    expect(mockOnChange).toHaveBeenCalledWith({
      special_instructions: 'Sink Level 4',
      system_instructions: 'Updated sink instructions'
    });
  });
});
