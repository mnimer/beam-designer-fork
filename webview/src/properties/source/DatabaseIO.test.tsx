/**
 * DatabaseIOSourceProperties Unit Tests
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Tests the DatabaseIOSourceProperties panel component covering field rendering,
 * database engine presets and selection, hydration from node properties, onChange event dispatch,
 * IPC Secret Manager communication, edge cases (missing properties, 0 values, aliases),
 * validation alerts, and instruction fallback chains.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DatabaseIOSourceProperties } from './DatabaseIO';

describe('DatabaseIOSourceProperties', () => {
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
        label: 'Database Source',
        properties: {}
      }
    };

    render(<DatabaseIOSourceProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByRole('combobox', { name: /Database Engine/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('jdbc:postgresql://localhost:5432/mydb')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('org.postgresql.Driver')).toBeInTheDocument();

    expect(screen.getByText('JDBC URL is required')).toBeInTheDocument();
    expect(screen.getByText('Either a Table Name or a SELECT query is required')).toBeInTheDocument();

    expect(postMessageSpy).toHaveBeenCalledWith({ command: 'getSecrets' });
  });

  it('passes table/query validation when either table or query is populated', () => {
    const node = {
      data: {
        label: 'Database Source',
        properties: {
          url: 'jdbc:postgresql://localhost:5432/mydb',
          table: 'customers'
        }
      }
    };

    render(<DatabaseIOSourceProperties node={node} onChange={mockOnChange} />);

    expect(screen.queryByText('Either a Table Name or a SELECT query is required')).not.toBeInTheDocument();
  });

  it('hydrates all populated properties correctly', () => {
    const node = {
      data: {
        label: 'Database Source',
        properties: {
          engine: 'mysql' as const,
          url: 'jdbc:mysql://db-host:3306/inventory',
          driverClassName: 'com.mysql.cj.jdbc.Driver',
          database: 'inventory',
          table: 'items',
          query: 'SELECT id, sku, quantity FROM items',
          fetchSize: 20000,
          partitionColumn: 'id',
          lowerBound: 1,
          upperBound: 100000,
          splitCount: 8,
          authMode: 'secret_manager' as const,
          usernameSecret: 'mysql-user',
          passwordSecret: 'mysql-pass',
          connectTimeout: 45,
          sslMode: 'require',
          driverJars: 'gs://bucket/mysql-connector.jar',
          connectionProperties: 'useSSL=true\nallowPublicKeyRetrieval=true',
          system_instructions: 'Custom DB source instructions'
        }
      }
    };

    render(<DatabaseIOSourceProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByRole('combobox', { name: /Database Engine/i })).toHaveValue('mysql');
    expect(screen.getByPlaceholderText('jdbc:mysql://localhost:3306/mydb')).toHaveValue(
      'jdbc:mysql://db-host:3306/inventory'
    );
    expect(screen.getByPlaceholderText('org.postgresql.Driver')).toHaveValue('com.mysql.cj.jdbc.Driver');
    expect(screen.getByPlaceholderText('mydb')).toHaveValue('inventory');
    expect(screen.getByPlaceholderText('e.g. customers')).toHaveValue('items');
    expect(screen.getByPlaceholderText(/SELECT id, name/i)).toHaveValue('SELECT id, sku, quantity FROM items');
    expect(screen.getByPlaceholderText('50000')).toHaveValue(20000);
    expect(screen.getByPlaceholderText('e.g. id')).toHaveValue('id');
    expect(screen.getByPlaceholderText('1')).toHaveValue(1);
    expect(screen.getByPlaceholderText('1000000')).toHaveValue(100000);
    expect(screen.getByPlaceholderText('10')).toHaveValue(8);

    // Auth
    expect(screen.getByPlaceholderText('e.g. db-username')).toHaveValue('mysql-user');
    expect(screen.getByPlaceholderText('e.g. db-password')).toHaveValue('mysql-pass');

    // Advanced section
    fireEvent.click(screen.getByRole('button', { name: /Advanced Source Settings/i }));
    expect(screen.getByPlaceholderText('30')).toHaveValue(45);
    expect(screen.getByRole('combobox', { name: /SSL Mode/i })).toHaveValue('require');
    expect(screen.getByPlaceholderText(/gs:\/\/my-bucket/i)).toHaveValue('gs://bucket/mysql-connector.jar');
    expect(screen.getByPlaceholderText(/ssl=true/i)).toHaveValue('useSSL=true\nallowPublicKeyRetrieval=true');

    // Instructions
    expect(screen.getByPlaceholderText(/Read records using JdbcIO/i)).toHaveValue('Custom DB source instructions');
  });

  it('automatically configures default driver and URL template when changing engine', () => {
    const node = {
      data: {
        label: 'Database Source',
        properties: {
          engine: 'postgresql' as const
        }
      }
    };

    render(<DatabaseIOSourceProperties node={node} onChange={mockOnChange} />);

    const engineSelect = screen.getByRole('combobox', { name: /Database Engine/i });
    fireEvent.change(engineSelect, { target: { value: 'sqlserver' } });

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        engine: 'sqlserver',
        driverClassName: 'com.microsoft.sqlserver.jdbc.SQLServerDriver',
        url: 'jdbc:sqlserver://localhost:1433;databaseName=mydb'
      })
    );
  });

  it('dispatches updates when text and numeric inputs change', () => {
    const node = {
      data: {
        label: 'Database Source',
        properties: {
          url: 'jdbc:postgresql://localhost:5432/mydb'
        }
      }
    };

    render(<DatabaseIOSourceProperties node={node} onChange={mockOnChange} />);

    const tableInput = screen.getByPlaceholderText('e.g. customers');
    fireEvent.change(tableInput, { target: { name: 'table', value: 'accounts' } });
    expect(mockOnChange).toHaveBeenCalledWith({
      url: 'jdbc:postgresql://localhost:5432/mydb',
      table: 'accounts'
    });

    const fetchSizeInput = screen.getByPlaceholderText('50000');
    fireEvent.change(fetchSizeInput, { target: { name: 'fetchSize', value: '15000' } });
    expect(mockOnChange).toHaveBeenCalledWith({
      url: 'jdbc:postgresql://localhost:5432/mydb',
      fetchSize: '15000'
    });
  });

  it('handles authMode toggle and loads secrets via IPC', () => {
    const node = {
      data: {
        label: 'Database Source',
        properties: {
          url: 'jdbc:postgresql://localhost:5432/mydb',
          authMode: 'none' as const
        }
      }
    };

    const { rerender } = render(<DatabaseIOSourceProperties node={node} onChange={mockOnChange} />);

    expect(screen.queryByPlaceholderText('e.g. db-username')).not.toBeInTheDocument();

    const secretManagerRadio = screen.getByRole('radio', { name: /Secret Manager/i });
    fireEvent.click(secretManagerRadio);
    expect(mockOnChange).toHaveBeenCalledWith({
      url: 'jdbc:postgresql://localhost:5432/mydb',
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
    rerender(<DatabaseIOSourceProperties node={updatedNode} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('e.g. db-username')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. db-password')).toBeInTheDocument();

    fireEvent(
      window,
      new MessageEvent('message', {
        data: {
          command: 'secretsLoaded',
          secrets: [
            { id: 'db-user-secret', name: 'db-user-secret' },
            'projects/my-proj/secrets/db-pass-secret'
          ]
        }
      })
    );

    const datalist = document.getElementById('databaseio-source-secret-options');
    expect(datalist).toBeInTheDocument();
    expect(datalist?.children.length).toBe(2);
    expect(datalist?.children[0]).toHaveAttribute('value', 'db-user-secret');
    expect(datalist?.children[1]).toHaveAttribute('value', 'db-pass-secret');
  });

  it('displays error alert when secretsLoaded carries an error message', () => {
    const node = {
      data: {
        label: 'Database Source',
        properties: {
          authMode: 'secret_manager' as const
        }
      }
    };

    render(<DatabaseIOSourceProperties node={node} onChange={mockOnChange} />);

    fireEvent(
      window,
      new MessageEvent('message', {
        data: {
          command: 'secretsLoaded',
          error: 'Access denied to Secret Manager'
        }
      })
    );

    expect(screen.getByText(/Access denied to Secret Manager/i)).toBeInTheDocument();
  });

  it('handles advanced source settings toggling and updates', () => {
    const node = {
      data: {
        label: 'Database Source',
        properties: {
          url: 'jdbc:postgresql://localhost:5432/mydb'
        }
      }
    };

    render(<DatabaseIOSourceProperties node={node} onChange={mockOnChange} />);

    const toggleButton = screen.getByRole('button', { name: /Advanced Source Settings/i });
    expect(screen.queryByPlaceholderText('30')).not.toBeInTheDocument();

    fireEvent.click(toggleButton);
    expect(screen.getByPlaceholderText('30')).toBeInTheDocument();

    const sslSelect = screen.getByRole('combobox', { name: /SSL Mode/i });
    fireEvent.change(sslSelect, { target: { name: 'sslMode', value: 'verify-full' } });
    expect(mockOnChange).toHaveBeenCalledWith({
      url: 'jdbc:postgresql://localhost:5432/mydb',
      sslMode: 'verify-full'
    });

    fireEvent.click(toggleButton);
    expect(screen.queryByPlaceholderText('30')).not.toBeInTheDocument();
  });

  it('supports alias fallbacks for jdbcUrl, tableName, databaseEngine, partitionCount and prunes them on write', () => {
    const node = {
      data: {
        label: 'Database Source',
        properties: {
          jdbcUrl: 'jdbc:postgresql://legacy:5432/mydb',
          tableName: 'legacy_table',
          databaseEngine: 'postgresql' as const,
          partitionCount: 4
        }
      }
    };

    render(<DatabaseIOSourceProperties node={node} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('jdbc:postgresql://localhost:5432/mydb')).toHaveValue(
      'jdbc:postgresql://legacy:5432/mydb'
    );
    expect(screen.getByPlaceholderText('e.g. customers')).toHaveValue('legacy_table');
    expect(screen.getByPlaceholderText('10')).toHaveValue(4);

    // Editing table writes canonical table and removes tableName
    const tableInput = screen.getByPlaceholderText('e.g. customers');
    fireEvent.change(tableInput, { target: { name: 'table', value: 'canonical_table' } });
    expect(mockOnChange).toHaveBeenCalledWith({
      jdbcUrl: 'jdbc:postgresql://legacy:5432/mydb',
      table: 'canonical_table',
      databaseEngine: 'postgresql',
      partitionCount: 4
    });
  });

  it('handles edge cases: missing properties, 0 values', () => {
    const node = {
      data: {
        label: 'Database Source'
      }
    };

    const { rerender } = render(<DatabaseIOSourceProperties node={node} onChange={mockOnChange} />);
    expect(screen.getByPlaceholderText('jdbc:postgresql://localhost:5432/mydb')).toHaveValue('');

    const nodeWithZeros = {
      data: {
        label: 'Database Source',
        properties: {
          lowerBound: 0,
          splitCount: 0
        }
      }
    };

    rerender(<DatabaseIOSourceProperties node={nodeWithZeros} onChange={mockOnChange} />);
    expect(screen.getByPlaceholderText('1')).toHaveValue(0);
    expect(screen.getByPlaceholderText('10')).toHaveValue(0);
  });

  it('respects instructions fallback chain and dispatches change', () => {
    const node1 = {
      data: {
        label: 'Database Source',
        system_instructions: 'Level 1 instructions',
        special_instructions: 'Level 2 instructions',
        properties: {
          system_instructions: 'Level 3 instructions'
        }
      }
    };
    const { rerender } = render(<DatabaseIOSourceProperties node={node1} onChange={mockOnChange} />);
    const textarea = screen.getByPlaceholderText(/Read records using JdbcIO/i);
    expect(textarea).toHaveValue('Level 1 instructions');

    const node2 = {
      data: {
        label: 'Database Source',
        special_instructions: 'Level 2 instructions',
        properties: {
          system_instructions: 'Level 3 instructions'
        }
      }
    };
    rerender(<DatabaseIOSourceProperties node={node2} onChange={mockOnChange} />);
    expect(textarea).toHaveValue('Level 2 instructions');

    const node3 = {
      data: {
        label: 'Database Source',
        properties: {
          system_instructions: 'Level 3 instructions'
        }
      }
    };
    rerender(<DatabaseIOSourceProperties node={node3} onChange={mockOnChange} />);
    expect(textarea).toHaveValue('Level 3 instructions');

    const node4 = {
      data: {
        label: 'Database Source',
        properties: {
          special_instructions: 'Level 4 instructions'
        }
      }
    };
    rerender(<DatabaseIOSourceProperties node={node4} onChange={mockOnChange} />);
    expect(textarea).toHaveValue('Level 4 instructions');

    fireEvent.change(textarea, { target: { value: 'New database instructions' } });
    expect(mockOnChange).toHaveBeenCalledWith({
      special_instructions: 'Level 4 instructions',
      system_instructions: 'New database instructions'
    });
  });
});
