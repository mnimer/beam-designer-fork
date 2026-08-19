import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { JdbcIOSinkProperties } from './JdbcIO';

describe('JdbcIOSinkProperties', () => {
  const mockOnChange = vi.fn();

  it('renders all default input fields and handles updates', () => {
    const mockNode: any = {
      data: {
        label: 'JdbcIO',
        beam_transform: 'JdbcIO',
        properties: {
          driverClassName: 'com.mysql.cj.jdbc.Driver',
          url: 'jdbc:mysql://localhost:3306/mydb',
          username: 'writer',
          statement: 'INSERT INTO sink_table (id, name) VALUES (?, ?)',
          batchSize: 500,
          autosharding: true
        }
      }
    };

    render(<JdbcIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByLabelText(/Driver Class Name/i)).toHaveValue('com.mysql.cj.jdbc.Driver');
    expect(screen.getByLabelText(/JDBC Connection URL/i)).toHaveValue('jdbc:mysql://localhost:3306/mydb');
    expect(screen.getByLabelText(/Username/i)).toHaveValue('writer');
    expect(screen.getByLabelText(/Select Type/i)).toHaveValue('statement');
    expect(screen.getByLabelText(/SQL Statement/i)).toHaveValue('INSERT INTO sink_table (id, name) VALUES (?, ?)');
    expect(screen.getByLabelText(/Batch Size/i)).toHaveValue(500);
    expect(screen.getByLabelText(/Auto Sharding/i)).toBeChecked();

    // Test statement change
    fireEvent.change(screen.getByLabelText(/SQL Statement/i), {
      target: { name: 'statement', value: 'INSERT INTO orders (id, total) VALUES (?, ?)' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      statement: 'INSERT INTO orders (id, total) VALUES (?, ?)'
    }));

    // Test batch size change
    fireEvent.change(screen.getByLabelText(/Batch Size/i), {
      target: { name: 'batchSize', value: 2000 }
    });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      batchSize: '2000'
    }));
  });

  it('switches between SQL Statement and Table Name when changing Select Type', () => {
    const mockNode: any = {
      data: {
        label: 'JdbcIO',
        beam_transform: 'JdbcIO',
        properties: {
          selectType: 'table',
          tableName: 'sink_table_name'
        }
      }
    };

    render(<JdbcIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByLabelText(/Select Type/i)).toHaveValue('table');
    expect(screen.getByLabelText(/Table Name/i)).toHaveValue('sink_table_name');
    expect(screen.queryByLabelText(/SQL Statement/i)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Table Name/i), {
      target: { name: 'tableName', value: 'new_sink_table' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      tableName: 'new_sink_table'
    }));
  });

  it('handles code generation instructions editing', () => {
    const mockNode: any = {
      data: {
        label: 'JdbcIO',
        beam_transform: 'JdbcIO',
        system_instructions: 'Handle deadlock retries',
        properties: {}
      }
    };

    render(<JdbcIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    const instructionsArea = screen.getByLabelText(/Code Generation Instructions/i);
    expect(instructionsArea).toHaveValue('Handle deadlock retries');

    fireEvent.change(instructionsArea, {
      target: { name: 'system_instructions', value: 'Custom sink instructions' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      system_instructions: 'Custom sink instructions'
    }));
  });

  it('renders driver select dropdown with friendly labels and class values for sink', () => {
    const mockNode: any = {
      data: {
        label: 'JdbcIO',
        properties: {}
      }
    };

    render(<JdbcIOSinkProperties node={mockNode} onChange={mockOnChange} />);
    const select = screen.getByLabelText(/Driver Class Name/i);
    expect(select).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'PostgreSQL' })).toHaveValue('org.postgresql.Driver');
    expect(screen.getByRole('option', { name: 'MySQL' })).toHaveValue('com.mysql.cj.jdbc.Driver');
  });
});
