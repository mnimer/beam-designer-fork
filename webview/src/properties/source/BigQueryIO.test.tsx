import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
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

    const { container } = render(<BigQuerySourceProperties node={mockNode} onChange={mockOnChange} />);

    const datasetInput = container.querySelector('#bqSourceDataset') as HTMLInputElement;
    const tableInput = container.querySelector('#bqSourceTable') as HTMLInputElement;
    const queryInput = container.querySelector('#bqSourceQuery') as HTMLTextAreaElement;

    expect(datasetInput).toHaveValue('test-dataset');
    expect(tableInput).toHaveValue('test-table');
    expect(queryInput).toBeInTheDocument();
  });

  it('calls onChange when dataset input changes', () => {
    const mockNode = {
      data: {
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    const { container } = render(<BigQuerySourceProperties node={mockNode} onChange={mockOnChange} />);

    const datasetInput = container.querySelector('#bqSourceDataset') as HTMLInputElement;
    fireEvent.change(datasetInput, { target: { value: 'new-dataset' } });

    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({ dataset: 'new-dataset', table: '' }));
  });

  it('calls onChange when table input changes', () => {
    const mockNode = {
      data: {
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    const { container } = render(<BigQuerySourceProperties node={mockNode} onChange={mockOnChange} />);

    const tableInput = container.querySelector('#bqSourceTable') as HTMLInputElement;
    fireEvent.change(tableInput, { target: { value: 'new-table' } });

    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({ table: 'new-table' }));
  });

  it('calls onChange when query input changes', () => {
    const mockNode = {
      data: {
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    const { container } = render(<BigQuerySourceProperties node={mockNode} onChange={mockOnChange} />);

    const queryInput = container.querySelector('#bqSourceQuery') as HTMLTextAreaElement;
    fireEvent.change(queryInput, { target: { value: 'SELECT * FROM test' } });

    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({ query: 'SELECT * FROM test' }));
  });
});
