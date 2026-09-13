/**
 * BigQuery Sink Properties Unit Tests
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
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

    const { container } = render(<BigQuerySinkProperties node={mockNode} onChange={mockOnChange} />);

    const datasetInput = container.querySelector('#bigQuerySinkDataset') as HTMLInputElement;
    const tableInput = container.querySelector('#bigQuerySinkTable') as HTMLInputElement;

    expect(datasetInput).toBeInTheDocument();
    expect(tableInput).toBeInTheDocument();
    expect(tableInput).toHaveValue('test-table');
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

    const { container } = render(<BigQuerySinkProperties node={mockNode} onChange={mockOnChange} />);

    const tableInput = container.querySelector('#bigQuerySinkTable') as HTMLInputElement;
    fireEvent.change(tableInput, { target: { value: 'new-table' } });

    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({ table: 'new-table' }));
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

    const { container } = render(<BigQuerySinkProperties node={mockNode} onChange={mockOnChange} />);

    const datasetInput = container.querySelector('#bigQuerySinkDataset') as HTMLInputElement;
    fireEvent.change(datasetInput, { target: { value: 'new-dataset' } });

    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({ dataset: 'new-dataset', table: '' }));
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

    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({ createDisposition: 'beam.io.BigQueryDisposition.CREATE_IF_NEEDED' }));
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

    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({ method: 'FILE_LOADS' }));
  });

  // Regression test: stale closure bug where datasetsLoaded overwrote user input
  it('preserves latest user changes when datasetsLoaded message arrives (stale closure regression)', () => {
    const initialNode = {
      data: {
        properties: {
          dataset: 'initial-dataset',
          table: 'initial-table'
        }
      }
    };
    const mockOnChange = vi.fn();

    const { rerender } = render(<BigQuerySinkProperties node={initialNode} onChange={mockOnChange} />);

    // Simulate user editing fields after mount, causing parent component to re-render with updated properties
    const updatedNode = {
      data: {
        properties: {
          dataset: 'initial-dataset',
          table: 'user-updated-table',
          createDisposition: 'beam.io.BigQueryDisposition.CREATE_IF_NEEDED'
        }
      }
    };
    rerender(<BigQuerySinkProperties node={updatedNode} onChange={mockOnChange} />);

    // Dispatch datasetsLoaded message event on window inside act
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            command: 'datasetsLoaded',
            datasets: ['dataset-a', 'dataset-b'],
            projectId: 'new-project-id'
          }
        })
      );
    });

    // Assert onChange is called with projectId merged into the latest properties, NOT initial properties
    expect(mockOnChange).toHaveBeenCalledWith({
      dataset: 'initial-dataset',
      table: 'user-updated-table',
      createDisposition: 'beam.io.BigQueryDisposition.CREATE_IF_NEEDED',
      projectId: 'new-project-id'
    });
  });

  // Extreme case: multiple rapid updates from initial empty state before message arrival
  it('preserves multiple sequential property updates when datasetsLoaded arrives', () => {
    const initialNode = {
      data: {
        properties: {}
      }
    };
    const mockOnChange = vi.fn();

    const { rerender } = render(<BigQuerySinkProperties node={initialNode} onChange={mockOnChange} />);

    // User types dataset, then table, then configures method and dispositions
    const intermediateNode1 = {
      data: {
        properties: { dataset: 'warehouse' }
      }
    };
    rerender(<BigQuerySinkProperties node={intermediateNode1} onChange={mockOnChange} />);

    const intermediateNode2 = {
      data: {
        properties: { dataset: 'warehouse', table: 'fact_orders' }
      }
    };
    rerender(<BigQuerySinkProperties node={intermediateNode2} onChange={mockOnChange} />);

    const finalNode = {
      data: {
        properties: {
          dataset: 'warehouse',
          table: 'fact_orders',
          method: 'FILE_LOADS',
          triggering_frequency: '10',
          createDisposition: 'beam.io.BigQueryDisposition.CREATE_IF_NEEDED',
          writeDisposition: 'beam.io.BigQueryDisposition.WRITE_APPEND'
        }
      }
    };
    rerender(<BigQuerySinkProperties node={finalNode} onChange={mockOnChange} />);

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            command: 'datasetsLoaded',
            datasets: ['warehouse', 'staging'],
            projectId: 'corp-etl-prod'
          }
        })
      );
    });

    expect(mockOnChange).toHaveBeenCalledWith({
      dataset: 'warehouse',
      table: 'fact_orders',
      method: 'FILE_LOADS',
      triggering_frequency: '10',
      createDisposition: 'beam.io.BigQueryDisposition.CREATE_IF_NEEDED',
      writeDisposition: 'beam.io.BigQueryDisposition.WRITE_APPEND',
      projectId: 'corp-etl-prod'
    });
  });

  // Failure / edge case: datasetsLoaded message arrives with missing or null projectId
  it('does not trigger onChange if datasetsLoaded message has no projectId', () => {
    const mockNode = {
      data: {
        properties: {
          dataset: 'warehouse',
          table: 'fact_orders'
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<BigQuerySinkProperties node={mockNode} onChange={mockOnChange} />);

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            command: 'datasetsLoaded',
            datasets: ['warehouse']
          }
        })
      );
    });

    expect(mockOnChange).not.toHaveBeenCalled();
  });

  // Cleanup case: unmounted component cleans up event listener and does not fire onChange
  it('cleans up window message listener on unmount', () => {
    const mockNode = {
      data: {
        properties: { table: 'test' }
      }
    };
    const mockOnChange = vi.fn();

    const { unmount } = render(<BigQuerySinkProperties node={mockNode} onChange={mockOnChange} />);
    unmount();

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            command: 'datasetsLoaded',
            datasets: ['ds1'],
            projectId: 'proj1'
          }
        })
      );
    });

    expect(mockOnChange).not.toHaveBeenCalled();
  });

  it('renders dataset error message with role="alert" when datasetsLoaded contains error', () => {
    const mockNode = {
      data: {
        properties: { table: 'test' }
      }
    };
    const mockOnChange = vi.fn();

    render(<BigQuerySinkProperties node={mockNode} onChange={mockOnChange} />);

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            command: 'datasetsLoaded',
            datasets: [],
            error: 'Failed to authenticate to BigQuery'
          }
        })
      );
    });

    expect(screen.getByText('Failed to authenticate to BigQuery')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Failed to authenticate to BigQuery');
  });

  it('renders table error message with role="alert" when tablesLoaded contains error', () => {
    const mockNode = {
      data: {
        properties: { dataset: 'my_dataset', table: 'test' }
      }
    };
    const mockOnChange = vi.fn();

    render(<BigQuerySinkProperties node={mockNode} onChange={mockOnChange} />);

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            command: 'tablesLoaded',
            tables: [],
            error: 'Dataset not found: my_dataset'
          }
        })
      );
    });

    expect(screen.getByText('Dataset not found: my_dataset')).toBeInTheDocument();
  });
});


