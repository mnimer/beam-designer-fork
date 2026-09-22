/**
 * BigQuery Source Properties Unit Tests
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
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

    const { rerender } = render(<BigQuerySourceProperties node={initialNode} onChange={mockOnChange} />);

    // Simulate user editing table after mount, causing parent component to re-render with updated properties
    const updatedNode = {
      data: {
        properties: {
          dataset: 'initial-dataset',
          table: 'user-updated-table',
          query: 'SELECT 1'
        }
      }
    };
    rerender(<BigQuerySourceProperties node={updatedNode} onChange={mockOnChange} />);

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
      query: 'SELECT 1',
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

    const { rerender } = render(<BigQuerySourceProperties node={initialNode} onChange={mockOnChange} />);

    // User types dataset, then table, then query, then system instructions
    const intermediateNode1 = {
      data: {
        properties: { dataset: 'sales_ds' }
      }
    };
    rerender(<BigQuerySourceProperties node={intermediateNode1} onChange={mockOnChange} />);

    const intermediateNode2 = {
      data: {
        properties: { dataset: 'sales_ds', table: 'orders' }
      }
    };
    rerender(<BigQuerySourceProperties node={intermediateNode2} onChange={mockOnChange} />);

    const finalNode = {
      data: {
        properties: {
          dataset: 'sales_ds',
          table: 'orders',
          query: 'SELECT * FROM orders WHERE amount > 100',
          system_instructions: 'Filter high-value orders'
        }
      }
    };
    rerender(<BigQuerySourceProperties node={finalNode} onChange={mockOnChange} />);

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            command: 'datasetsLoaded',
            datasets: ['sales_ds', 'inventory_ds'],
            projectId: 'corp-analytics-prod'
          }
        })
      );
    });

    expect(mockOnChange).toHaveBeenCalledWith({
      dataset: 'sales_ds',
      table: 'orders',
      query: 'SELECT * FROM orders WHERE amount > 100',
      system_instructions: 'Filter high-value orders',
      projectId: 'corp-analytics-prod'
    });
  });

  // Failure / edge case: datasetsLoaded message arrives with missing or null projectId
  it('does not trigger onChange if datasetsLoaded message has no projectId', () => {
    const mockNode = {
      data: {
        properties: {
          dataset: 'analytics',
          table: 'events'
        }
      }
    };
    const mockOnChange = vi.fn();

    render(<BigQuerySourceProperties node={mockNode} onChange={mockOnChange} />);

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            command: 'datasetsLoaded',
            datasets: ['analytics', 'monitoring']
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

    const { unmount } = render(<BigQuerySourceProperties node={mockNode} onChange={mockOnChange} />);
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

  // M6: Surfaces discovery error inline in picker instead of silently ignoring
  it('surfaces datasetsLoaded error inline in picker (M6 error surfacing)', () => {
    const mockNode = { data: { properties: {} } };
    const mockOnChange = vi.fn();

    const { getByRole } = render(<BigQuerySourceProperties node={mockNode} onChange={mockOnChange} />);

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            command: 'datasetsLoaded',
            datasets: [],
            error: 'CLI not found: bq (ENOENT)'
          }
        })
      );
    });

    const alert = getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent('CLI not found: bq (ENOENT)');
  });

  it('surfaces tablesLoaded error inline in picker (M6 error surfacing)', () => {
    const mockNode = { data: { properties: { dataset: 'my_ds' } } };
    const mockOnChange = vi.fn();

    const { getByRole } = render(<BigQuerySourceProperties node={mockNode} onChange={mockOnChange} />);

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            command: 'tablesLoaded',
            tables: [],
            error: 'Failed to query tables: Access denied'
          }
        })
      );
    });

    const alert = getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent('Failed to query tables: Access denied');
  });
});


