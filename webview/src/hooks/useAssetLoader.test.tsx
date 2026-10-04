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

  const dispatch = (data: Record<string, unknown>) => {
    act(() => {
      window.dispatchEvent(new MessageEvent('message', { data }));
    });
  };

  it('requests Bigtable instances and populates short instance IDs', () => {
    const TestComponent = () => {
      const { items } = useAssetLoader<string>('bigtableInstances');
      return <ul>{items.map((i) => <li key={i}>{i}</li>)}</ul>;
    };

    render(<TestComponent />);
    expect(mockPostMessage).toHaveBeenCalledWith({ command: 'getBigtableInstances' });

    dispatch({ command: 'bigtableInstancesLoaded', bigtableInstances: ['inst-a'] });
    expect(screen.getByText('inst-a')).toBeInTheDocument();
  });

  it.each([
    ['bigtableTables', 'getBigtableTables', 'bigtableTablesLoaded', 'inst-a', ['orders', 'events']],
    ['sqlDatabases', 'getSqlDatabases', 'sqlDatabasesLoaded', 'p:us-central1:db1', ['postgres', 'app']],
  ] as const)(
    '%s is auto-disabled until the instance param is supplied, then requests with it',
    (assetType, requestCommand, responseCommand, instanceValue, results) => {
      const responseKey = assetType;
      const TestComponent = () => {
        const [instance, setInstance] = useState('');
        const { items, loading } = useAssetLoader<string>(assetType, { params: { instance } });
        return (
          <div>
            <button type="button" onClick={() => setInstance(instanceValue)}>Set Instance</button>
            <button type="button" onClick={() => setInstance('  ')}>Clear Instance</button>
            <span data-testid="loading">{String(loading)}</span>
            <span data-testid="count">{items.length}</span>
          </div>
        );
      };

      render(<TestComponent />);

      expect(mockPostMessage).not.toHaveBeenCalledWith(expect.objectContaining({ command: requestCommand }));
      expect(screen.getByTestId('loading')).toHaveTextContent('false');

      fireEvent.click(screen.getByRole('button', { name: 'Set Instance' }));
      expect(mockPostMessage).toHaveBeenCalledWith({ command: requestCommand, instance: instanceValue });
      expect(screen.getByTestId('loading')).toHaveTextContent('true');

      dispatch({ command: responseCommand, [responseKey]: [...results] });
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
      expect(screen.getByTestId('count')).toHaveTextContent(String(results.length));

      // Clearing the parent identifier (whitespace only) resets the list without a new request.
      mockPostMessage.mockClear();
      fireEvent.click(screen.getByRole('button', { name: 'Clear Instance' }));
      expect(mockPostMessage).not.toHaveBeenCalled();
      expect(screen.getByTestId('count')).toHaveTextContent('0');
    }
  );

  it('requests Cloud SQL instances as connection names', () => {
    const TestComponent = () => {
      const { items } = useAssetLoader<string>('sqlInstances');
      return <ul>{items.map((i) => <li key={i}>{i}</li>)}</ul>;
    };

    render(<TestComponent />);
    expect(mockPostMessage).toHaveBeenCalledWith({ command: 'getSqlInstances' });

    dispatch({ command: 'sqlInstancesLoaded', sqlInstances: ['p:us-central1:db1'] });
    expect(screen.getByText('p:us-central1:db1')).toBeInTheDocument();
  });

  it('requests projects and surfaces a discovery error', () => {
    const TestComponent = () => {
      const { items, error } = useAssetLoader<string>('projects');
      return (
        <div>
          <span data-testid="error">{error || 'none'}</span>
          <span data-testid="count">{items.length}</span>
        </div>
      );
    };

    render(<TestComponent />);
    expect(mockPostMessage).toHaveBeenCalledWith({ command: 'getProjects' });

    dispatch({ command: 'projectsLoaded', projects: [], error: 'Failed to list projects via gcloud: PERMISSION_DENIED' });
    expect(screen.getByTestId('error')).toHaveTextContent('Failed to list projects via gcloud: PERMISSION_DENIED');
    expect(screen.getByTestId('count')).toHaveTextContent('0');
  });

  it('does not reset preloaded items when a type without requiredParam is explicitly disabled', () => {
    const TestComponent = () => {
      const { items } = useAssetLoader<string>('secrets', { enabled: false, initialItems: ['kept'] });
      return <span data-testid="count">{items.length}</span>;
    };

    render(<TestComponent />);
    expect(mockPostMessage).not.toHaveBeenCalled();
    expect(screen.getByTestId('count')).toHaveTextContent('1');
  });

  describe('F11 request correlation via echoed requestParams', () => {
    const TablesFor = ({ dataset, testId }: { dataset: string; testId: string }) => {
      const { items, loading } = useAssetLoader<string>('tables', { dataset });
      return (
        <div>
          <span data-testid={`${testId}-loading`}>{String(loading)}</span>
          <span data-testid={`${testId}-items`}>{items.join(',')}</span>
        </div>
      );
    };

    it('only updates the listener whose params match the echoed request', () => {
      render(
        <>
          <TablesFor dataset="ds_a" testId="a" />
          <TablesFor dataset="ds_b" testId="b" />
        </>
      );

      dispatch({ command: 'tablesLoaded', tables: ['a1'], requestParams: { dataset: 'ds_a' } });
      expect(screen.getByTestId('a-items')).toHaveTextContent('a1');
      expect(screen.getByTestId('a-loading')).toHaveTextContent('false');
      expect(screen.getByTestId('b-items')).toHaveTextContent('');
      expect(screen.getByTestId('b-loading')).toHaveTextContent('true');

      dispatch({ command: 'tablesLoaded', tables: ['b1'], requestParams: { dataset: 'ds_b' } });
      expect(screen.getByTestId('a-items')).toHaveTextContent('a1');
      expect(screen.getByTestId('b-items')).toHaveTextContent('b1');
    });

    it('drops a late response for a previous parent selection', () => {
      const Switcher = () => {
        const [dataset, setDataset] = useState('ds_old');
        return (
          <div>
            <button type="button" onClick={() => setDataset('ds_new')}>Switch</button>
            <TablesFor dataset={dataset} testId="s" />
          </div>
        );
      };
      render(<Switcher />);
      fireEvent.click(screen.getByRole('button', { name: 'Switch' }));

      dispatch({ command: 'tablesLoaded', tables: ['new1'], requestParams: { dataset: 'ds_new' } });
      // The slower response for the old dataset arrives last and must be ignored.
      dispatch({ command: 'tablesLoaded', tables: ['old1'], requestParams: { dataset: 'ds_old' } });

      expect(screen.getByTestId('s-items')).toHaveTextContent('new1');
      expect(screen.getByTestId('s-loading')).toHaveTextContent('false');
    });

    it('still accepts responses without requestParams (legacy senders)', () => {
      render(<TablesFor dataset="ds_a" testId="l" />);
      dispatch({ command: 'tablesLoaded', tables: ['x'] });
      expect(screen.getByTestId('l-items')).toHaveTextContent('x');
    });

    it('does not add fields to the request message', () => {
      render(<TablesFor dataset="ds_a" testId="r" />);
      expect(mockPostMessage).toHaveBeenCalledWith({ command: 'getTables', dataset: 'ds_a' });
    });
  });
});

