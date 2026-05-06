import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BigQuerySinkProperties } from './BigQueryIO';

describe('BigQuerySinkProperties', () => {
  it('renders table input and selects', () => {
    const mockNode = {
      data: {
        properties: {
          table: 'test-table',
          createDisposition: 'beam.io.BigQueryDisposition.CREATE_IF_NEEDED',
          writeDisposition: 'beam.io.BigQueryDisposition.WRITE_TRUNCATE'
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<BigQuerySinkProperties node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText('my_dataset')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('my_table')).toBeInTheDocument();
    expect(screen.getByDisplayValue('test-table')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Create If Needed')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Write Truncate')).toBeInTheDocument();
  });

  it('calls onChange when table input changes', () => {
    const mockNode = {
      data: {
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<BigQuerySinkProperties node={mockNode} onChange={mockOnChange} />);

    const tableInput = screen.getByPlaceholderText('my_table');
    fireEvent.change(tableInput, { target: { value: 'new-table' } });

    expect(mockOnChange).toHaveBeenCalledWith({ table: 'new-table' });
  });

  it('calls onChange when dataset input changes and clears table', () => {
    const mockNode = {
      data: {
        properties: {
          table: 'old-table'
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<BigQuerySinkProperties node={mockNode} onChange={mockOnChange} />);

    const datasetInput = screen.getByPlaceholderText('my_dataset');
    fireEvent.change(datasetInput, { target: { value: 'new-dataset' } });

    expect(mockOnChange).toHaveBeenCalledWith({ dataset: 'new-dataset', table: '' });
  });

  it('calls onChange when createDisposition changes', () => {
    const mockNode = {
      data: {
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<BigQuerySinkProperties node={mockNode} onChange={mockOnChange} />);

    const createSelect = screen.getByDisplayValue('Create Never');
    fireEvent.change(createSelect, { target: { value: 'beam.io.BigQueryDisposition.CREATE_IF_NEEDED' } });

    expect(mockOnChange).toHaveBeenCalledWith({ createDisposition: 'beam.io.BigQueryDisposition.CREATE_IF_NEEDED' });
  });

  it('shows conditional fields for FILE_LOADS method', () => {
    const mockNode = {
      data: {
        properties: {
          method: 'FILE_LOADS'
        }
      }
    };
    const mockOnChange = vi.fn();

    const { container } = render(<BigQuerySinkProperties node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByText('Triggering Frequency')).toBeInTheDocument();
    expect(screen.getByText('Custom GCS Temp Location')).toBeInTheDocument();
    expect(screen.getByText('minutes')).toBeInTheDocument();
    
    const freqInput = container.querySelector('input[name="triggering_frequency"]');
    expect(freqInput).toHaveAttribute('maxLength', '3');
  });

  it('shows conditional fields for STORAGE_WRITE_API method', () => {
    const mockNode = {
      data: {
        properties: {
          method: 'STORAGE_WRITE_API'
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<BigQuerySinkProperties node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByText('Triggering Frequency')).toBeInTheDocument();
    expect(screen.getByText('Num Storage API Streams')).toBeInTheDocument();
  });

  it('shows conditional fields for STREAMING_INSERTS method', () => {
    const mockNode = {
      data: {
        properties: {
          method: 'STREAMING_INSERTS'
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<BigQuerySinkProperties node={mockNode} onChange={mockOnChange} />);

    expect(screen.getByText('Streaming Inserts')).toBeInTheDocument();
    expect(screen.getByText('Insert Retry Strategy')).toBeInTheDocument();
  });

  it('calls onChange when method changes', () => {
    const mockNode = {
      data: {
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    render(<BigQuerySinkProperties node={mockNode} onChange={mockOnChange} />);

    const methodSelect = screen.getByDisplayValue('File Loads');
    fireEvent.change(methodSelect, { target: { value: 'FILE_LOADS' } });

    expect(mockOnChange).toHaveBeenCalledWith({ method: 'FILE_LOADS' });
  });
});
