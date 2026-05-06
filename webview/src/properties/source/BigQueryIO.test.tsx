import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BigQuerySourceProperties } from './BigQueryIO';

describe('BigQuerySourceProperties', () => {
  it('renders dataset and table input', () => {
    const mockNode = {
      data: {
        properties: {
          dataset: 'test-dataset',
          table: 'test-table'
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<BigQuerySourceProperties node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('my_dataset')).toBeInTheDocument();
    expect(screen.getByDisplayValue('test-dataset')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('my-project:my_dataset.my_table')).toBeInTheDocument();
    expect(screen.getByDisplayValue('test-table')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('SELECT * FROM `my-project.my_dataset.my_table`')).toBeInTheDocument();
  });

  it('calls onChange when dataset input changes', () => {
    const mockNode = {
      data: {
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<BigQuerySourceProperties node={mockNode} onChange={mockOnChange} />);

    const datasetInput = screen.getByPlaceholderText('my_dataset');
    fireEvent.change(datasetInput, { target: { value: 'new-dataset' } });

    expect(mockOnChange).toHaveBeenCalledWith({ dataset: 'new-dataset' });
  });

  it('calls onChange when table input changes', () => {
    const mockNode = {
      data: {
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<BigQuerySourceProperties node={mockNode} onChange={mockOnChange} />);

    const tableInput = screen.getByPlaceholderText('my-project:my_dataset.my_table');
    fireEvent.change(tableInput, { target: { value: 'new-table' } });

    expect(mockOnChange).toHaveBeenCalledWith({ table: 'new-table' });
  });

  it('calls onChange when query input changes', () => {
    const mockNode = {
      data: {
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<BigQuerySourceProperties node={mockNode} onChange={mockOnChange} />);

    const queryInput = screen.getByPlaceholderText('SELECT * FROM `my-project.my_dataset.my_table`');
    fireEvent.change(queryInput, { target: { value: 'SELECT * FROM test' } });

    expect(mockOnChange).toHaveBeenCalledWith({ query: 'SELECT * FROM test' });
  });
});
