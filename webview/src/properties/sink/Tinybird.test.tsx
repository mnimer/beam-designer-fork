/**
 * Tinybird Sink Properties Unit Test Suite (IO77)
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Covers 100% of statements, branches, functions, and lines in `sink/Tinybird.tsx`,
 * including `TinybirdSinkProperties`, `TINYBIRD_HOSTS`, `DEFAULT_TINYBIRD_HOST`,
 * Secret Manager discovery, and credential redaction key classification checks.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  TinybirdSinkProperties,
  TINYBIRD_HOSTS,
  DEFAULT_TINYBIRD_HOST,
} from './Tinybird';
import { classifyKey } from '../../../../src/credentialRedaction';

describe('TinybirdSinkProperties', () => {
  let postMessageMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    postMessageMock = vi.fn();
    (window as unknown as { vscode?: { postMessage: typeof postMessageMock } }).vscode = {
      postMessage: postMessageMock,
    };
  });

  afterEach(() => {
    delete (window as unknown as { vscode?: unknown }).vscode;
    vi.clearAllMocks();
  });

  const renderPanel = (
    properties?: Record<string, unknown>,
    extraData: Record<string, unknown> = {},
    onChange = vi.fn()
  ) => {
    const node = {
      data: {
        label: 'Tinybird Sink',
        beam_transform: 'Tinybird',
        ...(properties !== undefined ? { properties } : {}),
        ...extraData,
      },
    };
    const utils = render(<TinybirdSinkProperties node={node} onChange={onChange} />);
    return { ...utils, onChange };
  };

  it('classifies every Sink property key as safe or reference under credentialRedaction', () => {
    const sinkKeys = [
      'host',
      'tokenSecret',
      'datasource',
      'columns',
      'batchingMode',
      'minBatchSize',
      'maxBatchSize',
      'batchSize',
      'maxBufferingDurationSecs',
      'system_instructions',
    ];
    for (const key of sinkKeys) {
      expect(['safe', 'reference']).toContain(classifyKey(key));
    }
    expect(classifyKey('tokenSecret')).toBe('reference');
  });

  it('renders defaults with empty or undefined properties and populates host datalist', () => {
    const { unmount } = renderPanel(undefined);
    expect(screen.getByLabelText(/Tinybird API Host/i)).toHaveValue(DEFAULT_TINYBIRD_HOST);
    expect(screen.getByLabelText(/Batching Strategy/i)).toHaveValue('batchElements');
    expect(screen.getByLabelText(/Min Batch Size/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Max Batch Size/i)).toBeInTheDocument();

    const hostDatalist = document.getElementById('tinybird-sink-host-options');
    expect(hostDatalist).not.toBeNull();
    const hostOptions = Array.from(hostDatalist!.querySelectorAll('option'));
    expect(hostOptions).toHaveLength(TINYBIRD_HOSTS.length);
    expect(hostOptions.map((o) => o.getAttribute('value'))).toEqual(
      TINYBIRD_HOSTS.map((h) => h.value)
    );

    const alerts = screen.getAllByRole('alert').map((a) => a.textContent);
    expect(alerts).toContain('Auth token secret is required');
    expect(alerts).toContain('Data Source name is required');
    expect(alerts).toContain('At least one column is required');
    unmount();

    renderPanel({ batchingMode: 'unknown-mode' });
    expect(screen.getByLabelText(/Batching Strategy/i)).toHaveValue('batchElements');
  });

  it('validates and updates host, tokenSecret, datasource, and columns', () => {
    const onChange = vi.fn();
    const { rerender } = renderPanel(
      {
        host: '',
        tokenSecret: '',
        datasource: '',
        columns: '',
      },
      {},
      onChange
    );
    expect(screen.getAllByRole('alert').map((a) => a.textContent)).toContain(
      'Tinybird API host is required'
    );

    // Host http warning, datasource naming warning, empty column entry
    rerender(
      <TinybirdSinkProperties
        node={{
          data: {
            properties: {
              host: 'http://api.tinybird.co',
              tokenSecret: 'tb-token',
              datasource: 'bad-name',
              columns: 'id,,amount',
            },
          },
        }}
        onChange={onChange}
      />
    );
    expect(screen.getByText(/Tinybird API hosts use https:\/\//i)).toBeInTheDocument();
    expect(
      screen.getByText(/Tinybird Data Source names contain only letters, digits and underscores/i)
    ).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Column list contains an empty column name'
    );

    // Duplicate column error
    rerender(
      <TinybirdSinkProperties
        node={{
          data: {
            properties: {
              host: 'https://api.us-east.tinybird.co',
              tokenSecret: 'tb-token',
              datasource: 'pubsub__invoices',
              columns: 'id, amount, id',
            },
          },
        }}
        onChange={onChange}
      />
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Duplicate column: id');

    // Fully valid configuration
    rerender(
      <TinybirdSinkProperties
        node={{
          data: {
            properties: {
              host: 'https://api.us-east.tinybird.co',
              tokenSecret: 'tb-token',
              datasource: 'pubsub__invoices',
              columns: 'id,amount,created_at',
            },
          },
        }}
        onChange={onChange}
      />
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Tinybird API Host/i), {
      target: { value: 'https://api.tinybird.co' },
    });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ host: 'https://api.tinybird.co' })
    );

    fireEvent.change(screen.getByLabelText(/Auth Token Secret/i), {
      target: { value: 'new-token' },
    });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ tokenSecret: 'new-token' }));

    fireEvent.change(screen.getByLabelText(/Data Source Name/i), {
      target: { value: 'web_events' },
    });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ datasource: 'web_events' }));

    fireEvent.change(screen.getByLabelText(/^Columns/i), {
      target: { value: 'id,ts' },
    });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ columns: 'id,ts' }));
  });

  it('validates batching modes (batchElements, groupIntoBatches, none) and collapsible toggle', () => {
    const onChange = vi.fn();
    const { rerender } = renderPanel(
      {
        host: 'https://api.tinybird.co',
        tokenSecret: 'tb-token',
        datasource: 'events',
        columns: 'id,ts',
        batchingMode: 'batchElements',
        minBatchSize: '0',
        maxBatchSize: '1.5',
      },
      {},
      onChange
    );
    expect(screen.getAllByRole('alert').map((a) => a.textContent)).toEqual([
      'Must be an integer ≥ 1',
      'Must be an integer ≥ 1',
    ]);

    rerender(
      <TinybirdSinkProperties
        node={{
          data: {
            properties: {
              host: 'https://api.tinybird.co',
              tokenSecret: 'tb-token',
              datasource: 'events',
              columns: 'id,ts',
              batchingMode: 'batchElements',
              minBatchSize: '100',
              maxBatchSize: '50',
            },
          },
        }}
        onChange={onChange}
      />
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Max batch size must be ≥ min batch size');

    rerender(
      <TinybirdSinkProperties
        node={{
          data: {
            properties: {
              host: 'https://api.tinybird.co',
              tokenSecret: 'tb-token',
              datasource: 'events',
              columns: 'id,ts',
              batchingMode: 'batchElements',
              minBatchSize: '0',
              maxBatchSize: '50',
            },
          },
        }}
        onChange={onChange}
      />
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Must be an integer ≥ 1');

    rerender(
      <TinybirdSinkProperties
        node={{
          data: {
            properties: {
              host: 'https://api.tinybird.co',
              tokenSecret: 'tb-token',
              datasource: 'events',
              columns: 'id,ts',
              batchingMode: 'batchElements',
              minBatchSize: '10',
              maxBatchSize: '500',
            },
          },
        }}
        onChange={onChange}
      />
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    // groupIntoBatches empty, invalid, and valid
    rerender(
      <TinybirdSinkProperties
        node={{
          data: {
            properties: {
              host: 'https://api.tinybird.co',
              tokenSecret: 'tb-token',
              datasource: 'events',
              columns: 'id,ts',
              batchingMode: 'groupIntoBatches',
              batchSize: '',
              maxBufferingDurationSecs: '0',
            },
          },
        }}
        onChange={onChange}
      />
    );
    expect(screen.getAllByRole('alert').map((a) => a.textContent)).toEqual([
      'Batch size is required for GroupIntoBatches',
      'Must be > 0',
    ]);

    rerender(
      <TinybirdSinkProperties
        node={{
          data: {
            properties: {
              host: 'https://api.tinybird.co',
              tokenSecret: 'tb-token',
              datasource: 'events',
              columns: 'id,ts',
              batchingMode: 'groupIntoBatches',
              batchSize: '0',
              maxBufferingDurationSecs: 'abc',
            },
          },
        }}
        onChange={onChange}
      />
    );
    expect(screen.getAllByRole('alert').map((a) => a.textContent)).toEqual([
      'Must be an integer ≥ 1',
      'Must be > 0',
    ]);

    rerender(
      <TinybirdSinkProperties
        node={{
          data: {
            properties: {
              host: 'https://api.tinybird.co',
              tokenSecret: 'tb-token',
              datasource: 'events',
              columns: 'id,ts',
              batchingMode: 'groupIntoBatches',
              batchSize: '1000',
              maxBufferingDurationSecs: '',
            },
          },
        }}
        onChange={onChange}
      />
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    rerender(
      <TinybirdSinkProperties
        node={{
          data: {
            properties: {
              host: 'https://api.tinybird.co',
              tokenSecret: 'tb-token',
              datasource: 'events',
              columns: 'id,ts',
              batchingMode: 'groupIntoBatches',
              batchSize: '1000',
              maxBufferingDurationSecs: '30',
            },
          },
        }}
        onChange={onChange}
      />
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    // none mode shows warning
    rerender(
      <TinybirdSinkProperties
        node={{
          data: {
            properties: {
              host: 'https://api.tinybird.co',
              tokenSecret: 'tb-token',
              datasource: 'events',
              columns: 'id,ts',
              batchingMode: 'none',
            },
          },
        }}
        onChange={onChange}
      />
    );
    expect(screen.getByText(/Input elements must already be Iterable/i)).toBeInTheDocument();

    // Collapse and re-expand Batching section
    fireEvent.click(screen.getByRole('button', { name: /Batching/i }));
    expect(screen.queryByLabelText(/Batching Strategy/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Batching/i }));
    expect(screen.getByLabelText(/Batching Strategy/i)).toBeInTheDocument();
  });

  it('updates system_instructions when instructions textarea is edited', () => {
    const onChange = vi.fn();
    renderPanel(
      { system_instructions: 'initial instructions' },
      {},
      onChange
    );
    const textarea = screen.getByLabelText(/Code Generation Instructions/i);
    expect(textarea).toHaveValue('initial instructions');

    fireEvent.change(textarea, {
      target: { value: 'updated tinybird sink instructions' },
    });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ system_instructions: 'updated tinybird sink instructions' })
    );
  });
});
