/**
 * useAssetLoader Unit Tests
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import React, { useState } from 'react';
import { useAssetLoader } from './useAssetLoader';

describe('useAssetLoader', () => {
  const mockPostMessage = vi.fn();

  beforeEach(() => {
    mockPostMessage.mockClear();
    (window as any).vscode = { postMessage: mockPostMessage };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete (window as any).vscode;
  });

  it('sends IPC request on mount and populates items on response', () => {
    const TestComponent = () => {
      const { items, loading, error } = useAssetLoader<string>('topics');
      return (
        <div>
          <span data-testid="loading">{String(loading)}</span>
          <span data-testid="error">{error || 'none'}</span>
          <ul data-testid="items">
            {items.map(topic => (
              <li key={topic}>{topic}</li>
            ))}
          </ul>
        </div>
      );
    };

    render(<TestComponent />);

    expect(mockPostMessage).toHaveBeenCalledWith({ command: 'getTopics' });
    expect(screen.getByTestId('loading')).toHaveTextContent('true');

    // Simulate extension host responding with topics
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            command: 'topicsLoaded',
            topics: ['projects/test/topics/orders', 'projects/test/topics/events']
          }
        })
      );
    });

    expect(screen.getByTestId('loading')).toHaveTextContent('false');
    expect(screen.getByTestId('error')).toHaveTextContent('none');
    expect(screen.getByText('projects/test/topics/orders')).toBeInTheDocument();
    expect(screen.getByText('projects/test/topics/events')).toBeInTheDocument();
  });

  it('surfaces error message inline when extension host responds with an error', () => {
    const TestComponent = () => {
      const { items, error, loading } = useAssetLoader<string>('datasets');
      return (
        <div>
          <span data-testid="loading">{String(loading)}</span>
          <span data-testid="error">{error || 'none'}</span>
          <span data-testid="count">{items.length}</span>
        </div>
      );
    };

    render(<TestComponent />);

    expect(mockPostMessage).toHaveBeenCalledWith({ command: 'getDatasets' });

    // Extension responds with error payload
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            command: 'datasetsLoaded',
            datasets: [],
            error: 'Failed to list datasets via bq: CLI not found: bq (ENOENT)'
          }
        })
      );
    });

    expect(screen.getByTestId('loading')).toHaveTextContent('false');
    expect(screen.getByTestId('count')).toHaveTextContent('0');
    expect(screen.getByTestId('error')).toHaveTextContent('Failed to list datasets via bq: CLI not found: bq (ENOENT)');
  });

  it('auto-disables tables request when dataset is empty and enables when dataset is supplied', () => {
    const TestComponent = () => {
      const [dataset, setDataset] = useState('');
      const { items, loading } = useAssetLoader<string>('tables', {
        dataset
      });

      return (
        <div>
          <button type="button" onClick={() => setDataset('my_analytics_ds')}>Set Dataset</button>
          <span data-testid="loading">{String(loading)}</span>
          <span data-testid="count">{items.length}</span>
        </div>
      );
    };

    render(<TestComponent />);

    // Because dataset is empty, getTables should NOT have been called
    expect(mockPostMessage).not.toHaveBeenCalledWith(expect.objectContaining({ command: 'getTables' }));
    expect(screen.getByTestId('loading')).toHaveTextContent('false');

    // Provide a dataset
    fireEvent.click(screen.getByRole('button', { name: 'Set Dataset' }));

    expect(mockPostMessage).toHaveBeenCalledWith({ command: 'getTables', dataset: 'my_analytics_ds' });
    expect(screen.getByTestId('loading')).toHaveTextContent('true');

    // Dispatch table results
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            command: 'tablesLoaded',
            tables: ['table_a', 'table_b']
          }
        })
      );
    });

    expect(screen.getByTestId('loading')).toHaveTextContent('false');
    expect(screen.getByTestId('count')).toHaveTextContent('2');
  });

  it('dispatches refresh request when refresh() is called manually', () => {
    const TestComponent = () => {
      const { refresh } = useAssetLoader('storageBuckets');
      return <button type="button" onClick={refresh}>Reload Buckets</button>;
    };

    render(<TestComponent />);

    expect(mockPostMessage).toHaveBeenCalledTimes(1);
    expect(mockPostMessage).toHaveBeenCalledWith({ command: 'getStorageBuckets' });

    fireEvent.click(screen.getByRole('button', { name: 'Reload Buckets' }));

    expect(mockPostMessage).toHaveBeenCalledTimes(2);
  });

  it('fails fast with clear error when an unknown assetType is passed', () => {
    expect(() => {
      render(
        React.createElement(() => {
          useAssetLoader('unknownNonExistentAssetType');
          return null;
        })
      );
    }).toThrow(/Unknown assetType 'unknownNonExistentAssetType'/);
  });
});
