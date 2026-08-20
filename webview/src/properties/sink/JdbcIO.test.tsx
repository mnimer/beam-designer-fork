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

    const { container } = render(<JdbcIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    const driverSelect = container.querySelector('#jdbcSinkDriverClassName') as HTMLSelectElement;
    const urlInput = container.querySelector('#jdbcSinkUrl') as HTMLInputElement;
    const userInput = container.querySelector('#jdbcSinkUsername') as HTMLInputElement;
    const selectTypeSelect = container.querySelector('#jdbcSinkSelectType') as HTMLSelectElement;
    const statementInput = container.querySelector('#jdbcSinkStatement') as HTMLTextAreaElement;
    const batchInput = container.querySelector('#jdbcSinkBatchSize') as HTMLInputElement;
    const autoCheckbox = container.querySelector('#jdbcSinkAutosharding') as HTMLInputElement;

    expect(driverSelect).toHaveValue('com.mysql.cj.jdbc.Driver');
    expect(urlInput).toHaveValue('jdbc:mysql://localhost:3306/mydb');
    expect(userInput).toHaveValue('writer');
    expect(selectTypeSelect).toHaveValue('statement');
    expect(statementInput).toHaveValue('INSERT INTO sink_table (id, name) VALUES (?, ?)');
    expect(batchInput).toHaveValue(500);
    expect(autoCheckbox).toBeChecked();

    // Test statement change
    fireEvent.change(statementInput, {
      target: { name: 'statement', value: 'INSERT INTO orders (id, total) VALUES (?, ?)' }
    });
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
      statement: 'INSERT INTO orders (id, total) VALUES (?, ?)'
    }));

    // Test batch size change
    fireEvent.change(batchInput, {
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

    const { container } = render(<JdbcIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    const selectTypeSelect = container.querySelector('#jdbcSinkSelectType') as HTMLSelectElement;
    const tableNameInput = container.querySelector('#jdbcSinkTableName') as HTMLInputElement;

    expect(selectTypeSelect).toHaveValue('table');
    expect(tableNameInput).toHaveValue('sink_table_name');
    expect(container.querySelector('#jdbcSinkStatement')).not.toBeInTheDocument();

    fireEvent.change(tableNameInput, {
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

    const { container } = render(<JdbcIOSinkProperties node={mockNode} onChange={mockOnChange} />);

    const instructionsArea = container.querySelector('#jdbcSinkSystemInstructions') as HTMLTextAreaElement;
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

    const { container } = render(<JdbcIOSinkProperties node={mockNode} onChange={mockOnChange} />);
    const select = container.querySelector('#jdbcSinkDriverClassName') as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'PostgreSQL' })).toHaveValue('org.postgresql.Driver');
    expect(screen.getByRole('option', { name: 'MySQL' })).toHaveValue('com.mysql.cj.jdbc.Driver');
  });
});
