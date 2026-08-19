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

    render(<JdbcIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByLabelText(/Driver Class Name/i)).toHaveValue('org.postgresql.Driver');
    expect(screen.getByLabelText(/JDBC Connection URL/i)).toHaveValue('jdbc:postgresql://localhost:5432/testdb');
    expect(screen.getByLabelText(/Username/i)).toHaveValue('admin');
    expect(screen.getByLabelText(/Select Type/i)).toHaveValue('query');
    expect(screen.getByLabelText(/SQL Statement/i)).toHaveValue('SELECT * FROM test_table');
    expect(screen.getByLabelText(/Fetch Size/i)).toHaveValue(1000);

    // Test driver change
    fireEvent.change(screen.getByLabelText(/Driver Class Name/i), {
      target: { name: 'driverClassName', value: 'com.mysql.cj.jdbc.Driver' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      driverClassName: 'com.mysql.cj.jdbc.Driver'
    }));

    // Test query change
    fireEvent.change(screen.getByLabelText(/SQL Statement/i), {
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

    render(<JdbcIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByLabelText(/Select Type/i)).toHaveValue('table');
    expect(screen.getByLabelText(/Table Name/i)).toHaveValue('my_users_table');
    expect(screen.queryByLabelText(/SQL Statement/i)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Table Name/i), {
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

    render(<JdbcIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByLabelText(/Partitioned Parallel Reads/i)).toBeChecked();
    expect(screen.getByLabelText(/Partition Column/i)).toHaveValue('user_id');
    expect(screen.getByLabelText(/Lower Bound/i)).toHaveValue(1);
    expect(screen.getByLabelText(/Upper Bound/i)).toHaveValue(500000);
    expect(screen.getByLabelText(/Partitions/i)).toHaveValue(8);

    fireEvent.change(screen.getByLabelText(/Partition Column/i), {
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

    render(<JdbcIOSourceProperties node={mockNode} onChange={mockOnChange} />);

    const instructionsArea = screen.getByLabelText(/Code Generation Instructions/i);
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

    render(<JdbcIOSourceProperties node={mockNode} onChange={mockOnChange} />);
    const select = screen.getByLabelText(/Driver Class Name/i);
    expect(select).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'PostgreSQL' })).toHaveValue('org.postgresql.Driver');
    expect(screen.getByRole('option', { name: 'MySQL' })).toHaveValue('com.mysql.cj.jdbc.Driver');
    expect(select.querySelectorAll('option').length).toBe(JDBC_DRIVER_PRESETS.length);
  });
});
