import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { JdbcIOSourceProperties, getJdbcUrlExample, JDBC_DRIVER_PRESETS } from './JdbcIO';

describe('JdbcIOSourceProperties', () => {
  const mockOnChange = vi.fn();

  it('computes correct JDBC URL example based on driver class', () => {
    expect(getJdbcUrlExample('org.postgresql.Driver')).toBe('jdbc:postgresql://localhost:5432/mydb');
    expect(getJdbcUrlExample('com.mysql.cj.jdbc.Driver')).toBe('jdbc:mysql://localhost:3306/mydb');
    expect(getJdbcUrlExample('com.microsoft.sqlserver.jdbc.SQLServerDriver')).toBe('jdbc:sqlserver://localhost:1433;databaseName=mydb');
    expect(getJdbcUrlExample('oracle.jdbc.driver.OracleDriver')).toBe('jdbc:oracle:thin:@localhost:1521:xe');
    expect(getJdbcUrlExample('org.sqlite.JDBC')).toBe('jdbc:sqlite:/path/to/database.db');
    expect(getJdbcUrlExample('org.apache.derby.jdbc.ClientDriver')).toBe('jdbc:derby://localhost:1527/mydb');
    expect(getJdbcUrlExample('com.custom.Driver')).toBe('jdbc:<driver>://<host>:<port>/<database>');
    expect(getJdbcUrlExample('')).toBe('jdbc:postgresql://localhost:5432/mydb');
    expect(getJdbcUrlExample(undefined)).toBe('jdbc:postgresql://localhost:5432/mydb');
  });

  it('renders all default input fields and handles updates', () => {
    const mockNode: any = {
      data: {
        label: 'JdbcIO',
        beam_transform: 'JdbcIO',
        properties: {
          driverClassName: 'org.postgresql.Driver',
          url: 'jdbc:postgresql://localhost:5432/testdb',
          username: 'admin',
          query: 'SELECT * FROM test_table',
          fetchSize: 1000
        }
      }
    };

    const { container } = render(<JdbcIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const driverSelect = container.querySelector('#jdbcDriverClassName') as HTMLSelectElement;
    const urlInput = container.querySelector('#jdbcUrl') as HTMLInputElement;
    const userInput = container.querySelector('#jdbcUsername') as HTMLInputElement;
    const selectTypeSelect = container.querySelector('#jdbcSourceSelectType') as HTMLSelectElement;
    const queryInput = container.querySelector('#jdbcQuery') as HTMLTextAreaElement;
    const fetchInput = container.querySelector('#jdbcFetchSize') as HTMLInputElement;

    expect(driverSelect).toHaveValue('org.postgresql.Driver');
    expect(urlInput).toHaveValue('jdbc:postgresql://localhost:5432/testdb');
    expect(userInput).toHaveValue('admin');
    expect(selectTypeSelect).toHaveValue('query');
    expect(queryInput).toHaveValue('SELECT * FROM test_table');
    expect(fetchInput).toHaveValue(1000);

    // Test driver change
    fireEvent.change(driverSelect, {
      target: { name: 'driverClassName', value: 'com.mysql.cj.jdbc.Driver' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      driverClassName: 'com.mysql.cj.jdbc.Driver'
    }));

    // Test query change
    fireEvent.change(queryInput, {
      target: { name: 'query', value: 'SELECT id, name FROM users' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      query: 'SELECT id, name FROM users'
    }));
  });

  it('switches between SQL Statement and Table Name when changing Select Type', () => {
    const mockNode: any = {
      data: {
        label: 'JdbcIO',
        beam_transform: 'JdbcIO',
        properties: {
          selectType: 'table',
          tableName: 'my_users_table'
        }
      }
    };

    const { container } = render(<JdbcIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const selectTypeSelect = container.querySelector('#jdbcSourceSelectType') as HTMLSelectElement;
    const tableNameInput = container.querySelector('#jdbcTableName') as HTMLInputElement;

    expect(selectTypeSelect).toHaveValue('table');
    expect(tableNameInput).toHaveValue('my_users_table');
    expect(container.querySelector('#jdbcQuery')).not.toBeInTheDocument();

    fireEvent.change(tableNameInput, {
      target: { name: 'tableName', value: 'updated_table' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      tableName: 'updated_table'
    }));
  });

  it('handles toggling and configuring partitioned parallel reads', () => {
    const mockNode: any = {
      data: {
        label: 'JdbcIO',
        beam_transform: 'JdbcIO',
        properties: {
          usePartitioning: true,
          partitionColumn: 'user_id',
          lowerBound: 1,
          upperBound: 500000,
          numPartitions: 8
        }
      }
    };

    const { container } = render(<JdbcIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const partCheckbox = container.querySelector('#jdbcUsePartitioning') as HTMLInputElement;
    const partColInput = container.querySelector('#jdbcPartitionColumn') as HTMLInputElement;
    const lowerInput = container.querySelector('#jdbcLowerBound') as HTMLInputElement;
    const upperInput = container.querySelector('#jdbcUpperBound') as HTMLInputElement;
    const numPartInput = container.querySelector('#jdbcNumPartitions') as HTMLInputElement;

    expect(partCheckbox).toBeChecked();
    expect(partColInput).toHaveValue('user_id');
    expect(lowerInput).toHaveValue(1);
    expect(upperInput).toHaveValue(500000);
    expect(numPartInput).toHaveValue(8);

    fireEvent.change(partColInput, {
      target: { name: 'partitionColumn', value: 'id' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      partitionColumn: 'id'
    }));
  });

  it('handles code generation instructions editing', () => {
    const mockNode: any = {
      data: {
        label: 'JdbcIO',
        beam_transform: 'JdbcIO',
        system_instructions: 'Custom source instructions',
        properties: {}
      }
    };

    const { container } = render(<JdbcIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const instructionsArea = container.querySelector('#jdbcSourceSystemInstructions') as HTMLTextAreaElement;
    expect(instructionsArea).toHaveValue('Custom source instructions');

    fireEvent.change(instructionsArea, {
      target: { name: 'system_instructions', value: 'Add custom query filter' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      system_instructions: 'Add custom query filter'
    }));
  });

  it('renders driver select dropdown with friendly labels and class values', () => {
    const mockNode: any = {
      data: {
        label: 'JdbcIO',
        properties: {}
      }
    };

    const { container } = render(<JdbcIOSourceProperties node={mockNode} onChange={mockOnChange} />);
    const select = container.querySelector('#jdbcDriverClassName') as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'PostgreSQL' })).toHaveValue('org.postgresql.Driver');
    expect(screen.getByRole('option', { name: 'MySQL' })).toHaveValue('com.mysql.cj.jdbc.Driver');
    expect(select.querySelectorAll('option').length).toBe(JDBC_DRIVER_PRESETS.length);
  });

  it('opens a legacy node with a password and no authMode in plaintext mode with value preserved', () => {
    const mockNode: any = {
      data: {
        label: 'JdbcIO',
        properties: {
          password: 'legacy-cleartext-password',
        },
      },
    };

    const { container } = render(<JdbcIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const authModeSelect = container.querySelector('select[name="authMode"]') as HTMLSelectElement;
    expect(authModeSelect).toBeInTheDocument();
    expect(authModeSelect).toHaveValue('plaintext');

    const passwordInput = container.querySelector('input[name="password"]') as HTMLInputElement;
    expect(passwordInput).toBeInTheDocument();
    expect(passwordInput).toHaveValue('legacy-cleartext-password');
  });

  it('opens a fresh node with no credential in Secret Manager mode', () => {
    const mockNode: any = {
      data: {
        label: 'JdbcIO',
        properties: {},
      },
    };

    const { container } = render(<JdbcIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const authModeSelect = container.querySelector('select[name="authMode"]') as HTMLSelectElement;
    expect(authModeSelect).toBeInTheDocument();
    expect(authModeSelect).toHaveValue('secretManager');

    expect(container.querySelector('input[name="passwordSecret"]')).toBeInTheDocument();
    expect(container.querySelector('input[name="password"]')).not.toBeInTheDocument();
  });

  it('choosing a secret writes passwordSecret and does NOT write password', () => {
    const mockNode: any = {
      data: {
        label: 'JdbcIO',
        properties: {
          authMode: 'secretManager',
        },
      },
    };

    const { container } = render(<JdbcIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const secretInput = container.querySelector('input[name="passwordSecret"]') as HTMLInputElement;
    expect(secretInput).toBeInTheDocument();

    fireEvent.change(secretInput, { target: { name: 'passwordSecret', value: 'db-secret-id' } });

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        passwordSecret: 'db-secret-id',
      })
    );
    expect(mockOnChange.mock.calls[0][0].password).toBeUndefined();
  });

  it('renders cleartext warning in plaintext mode', () => {
    const mockNode: any = {
      data: {
        label: 'JdbcIO',
        properties: {
          authMode: 'plaintext',
          password: 'my-password',
        },
      },
    };

    render(<JdbcIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByText(/cleartext/i)).toBeInTheDocument();
  });
});
