import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BigQueryProperties } from './BigQuery';

describe('BigQueryProperties', () => {
  it('renders table input and selects', () => {
    const mockNode = {
      data: {
        properties: {
          table: 'test-table',
          createDisposition: 'CREATE_IF_NEEDED',
          writeDisposition: 'WRITE_TRUNCATE'
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<BigQueryProperties node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('my-project:my_dataset.my_table')).toBeInTheDocument();
    expect(screen.getByDisplayValue('test-table')).toBeInTheDocument();
    expect(screen.getByDisplayValue('CREATE_IF_NEEDED')).toBeInTheDocument();
    expect(screen.getByDisplayValue('WRITE_TRUNCATE')).toBeInTheDocument();
  });

  it('calls onChange when table input changes', () => {
    const mockNode = {
      data: {
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<BigQueryProperties node={mockNode} onChange={mockOnChange} />);

    const tableInput = screen.getByPlaceholderText('my-project:my_dataset.my_table');
    fireEvent.change(tableInput, { target: { value: 'new-table' } });

    expect(mockOnChange).toHaveBeenCalledWith({ table: 'new-table' });
  });

  it('calls onChange when createDisposition changes', () => {
    const mockNode = {
      data: {
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<BigQueryProperties node={mockNode} onChange={mockOnChange} />);

    // Find by display value since we know default is CREATE_NEVER
    const createSelect = screen.getByDisplayValue('CREATE_NEVER');

    fireEvent.change(createSelect, { target: { value: 'CREATE_IF_NEEDED' } });

    expect(mockOnChange).toHaveBeenCalledWith({ createDisposition: 'CREATE_IF_NEEDED' });
  });
});
