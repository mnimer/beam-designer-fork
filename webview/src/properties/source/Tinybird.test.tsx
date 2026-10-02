/**
 * Tinybird Source Properties Unit Test Suite (IO77 — D2 Bridge)
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Covers statements, branches, functions, and lines in `source/Tinybird.tsx`,
 * including Pipe mode, SQL mode, Query Parameters, Response Formats, Pagination,
 * and credential redaction key classification checks.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TinybirdSourceProperties } from './Tinybird';
import { TINYBIRD_HOSTS, DEFAULT_TINYBIRD_HOST } from '../sink/Tinybird';
import { classifyKey } from '../../../../src/credentialRedaction';

describe('TinybirdSourceProperties', () => {
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
        label: 'Tinybird Source',
        beam_transform: 'Tinybird',
        ...(properties !== undefined ? { properties } : {}),
        ...extraData,
      },
    };
    const utils = render(<TinybirdSourceProperties node={node} onChange={onChange} />);
    return { ...utils, onChange };
  };

  it('classifies every Source property key as safe or reference under credentialRedaction', () => {
    const sourceKeys = [
      'host',
      'tokenSecret',
      'queryMode',
      'pipeName',
      'pipeQuery',
      'sqlQuery',
      'sqlPipeline',
      'queryParams',
      'format',
      'quote64BitIntegers',
      'enablePagination',
      'pageSize',
      'limitParam',
      'offsetParam',
      'maxPages',
      'system_instructions',
    ];
    for (const key of sourceKeys) {
      expect(['safe', 'reference']).toContain(classifyKey(key));
    }
    expect(classifyKey('tokenSecret')).toBe('reference');
  });

  it('renders defaults with D2 bridge banner and populates host datalist', () => {
    const { unmount } = renderPanel(undefined);
    expect(screen.getByRole('note')).toHaveTextContent(/tinybird-beam is ingest-only/i);
    expect(screen.getByLabelText(/Tinybird API Host/i, { selector: 'input' })).toHaveValue(
      DEFAULT_TINYBIRD_HOST
    );
    expect(
      screen.getByLabelText(/Published API Endpoint/i, { selector: 'input' })
    ).toBeChecked();
    expect(screen.getByLabelText(/Response Format/i)).toHaveValue('json');
    expect(
      screen.getByLabelText(/Quote 64-bit Integers/i, { selector: 'input' })
    ).not.toBeChecked();
    expect(screen.queryByLabelText(/Paginate Results/i)).not.toBeInTheDocument();

    const hostDatalist = document.getElementById('tinybird-source-host-options');
    expect(hostDatalist).not.toBeNull();
    expect(hostDatalist!.querySelectorAll('option')).toHaveLength(TINYBIRD_HOSTS.length);

    const alerts = screen.getAllByRole('alert').map((a) => a.textContent);
    expect(alerts).toContain('Auth token secret is required');
    expect(alerts).toContain('Pipe name is required');
    unmount();

    renderPanel({ format: 'unknown-format' });
    expect(screen.getByLabelText(/Response Format/i)).toHaveValue('json');
  });

  it('validates and updates host, tokenSecret, Pipe mode, and SQL mode fields', () => {
    const onChange = vi.fn();
    const { rerender } = renderPanel(
      {
        host: '',
        tokenSecret: 'tb-read-token',
        queryMode: 'pipe',
        pipeName: 'bad-pipe-name',
      },
      {},
      onChange
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Tinybird API host is required');
    expect(
      screen.getByText(/Tinybird Pipe names contain only letters, digits and underscores/i)
    ).toBeInTheDocument();

    rerender(
      <TinybirdSourceProperties
        node={{
          data: {
            properties: {
              host: 'http://api.tinybird.co',
              tokenSecret: 'tb-read-token',
              queryMode: 'pipe',
              pipeName: 'top_products',
              pipeQuery: 'SELECT * FROM _',
            },
          },
        }}
        onChange={onChange}
      />
    );
    expect(screen.getByText(/Tinybird API hosts use https:\/\//i)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Pipe \(API Endpoint\) Name/i, { selector: 'input' }), {
      target: { value: 'events_pipe' },
    });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ pipeName: 'events_pipe' }));

    fireEvent.change(
      screen.getByLabelText(/SQL over Endpoint Result/i, { selector: 'textarea' }),
      {
        target: { value: 'SELECT id FROM _' },
      }
    );
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ pipeQuery: 'SELECT id FROM _' })
    );

    // Switch to SQL mode
    fireEvent.click(screen.getByLabelText(/SQL Query \(Query API\)/i, { selector: 'input' }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ queryMode: 'sql' }));

    rerender(
      <TinybirdSourceProperties
        node={{
          data: {
            properties: {
              host: 'https://api.tinybird.co',
              tokenSecret: 'tb-read-token',
              queryMode: 'sql',
              sqlQuery: '',
            },
          },
        }}
        onChange={onChange}
      />
    );
    expect(screen.getByRole('alert')).toHaveTextContent('SQL query is required');

    rerender(
      <TinybirdSourceProperties
        node={{
          data: {
            properties: {
              host: 'https://api.tinybird.co',
              tokenSecret: 'tb-read-token',
              queryMode: 'sql',
              sqlQuery: 'SELECT * FROM events FORMAT JSON',
              enablePagination: true,
              pageSize: '100',
            },
          },
        }}
        onChange={onChange}
      />
    );
    expect(screen.getByText(/Remove the FORMAT clause/i)).toBeInTheDocument();
    expect(screen.getByText(/Add ORDER BY for deterministic pagination/i)).toBeInTheDocument();

    rerender(
      <TinybirdSourceProperties
        node={{
          data: {
            properties: {
              host: 'https://api.tinybird.co',
              tokenSecret: 'tb-read-token',
              queryMode: 'sql',
              sqlQuery: 'SELECT * FROM events ORDER BY id',
              enablePagination: true,
              pageSize: '100',
            },
          },
        }}
        onChange={onChange}
      />
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText(/Add ORDER BY/i)).not.toBeInTheDocument();

    rerender(
      <TinybirdSourceProperties
        node={{
          data: {
            properties: {
              host: 'https://api.tinybird.co',
              tokenSecret: 'tb-read-token',
              queryMode: 'sql',
              sqlQuery: 'SELECT * FROM events',
              sqlPipeline: 'my_pipe',
              enablePagination: false,
            },
          },
        }}
        onChange={onChange}
      />
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Pipeline \(for _ alias\)/i, { selector: 'input' }), {
      target: { value: 'base_pipe' },
    });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ sqlPipeline: 'base_pipe' }));
  });

  it('validates queryParams, response formats, quote64BitIntegers, and pagination options', () => {
    const onChange = vi.fn();
    const { rerender } = renderPanel(
      {
        host: 'https://api.tinybird.co',
        tokenSecret: 'tb-read-token',
        queryMode: 'pipe',
        pipeName: 'top_products',
        queryParams: 'bad line without equals',
        quote64BitIntegers: true,
      },
      {},
      onChange
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Invalid parameter line: bad line without equals (expected name=value)'
    );

    rerender(
      <TinybirdSourceProperties
        node={{
          data: {
            properties: {
              host: 'https://api.tinybird.co',
              tokenSecret: 'tb-read-token',
              queryMode: 'pipe',
              pipeName: 'top_products',
              queryParams: 'token=secret',
            },
          },
        }}
        onChange={onChange}
      />
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Do not pass the token as a parameter; use Auth Token Secret'
    );

    rerender(
      <TinybirdSourceProperties
        node={{
          data: {
            properties: {
              host: 'https://api.tinybird.co',
              tokenSecret: 'tb-read-token',
              queryMode: 'pipe',
              pipeName: 'top_products',
              queryParams: 'q=SELECT 1',
            },
          },
        }}
        onChange={onChange}
      />
    );
    expect(screen.getByRole('alert')).toHaveTextContent("'q' is reserved; use the dedicated field");

    rerender(
      <TinybirdSourceProperties
        node={{
          data: {
            properties: {
              host: 'https://api.tinybird.co',
              tokenSecret: 'tb-read-token',
              queryMode: 'pipe',
              pipeName: 'top_products',
              queryParams: 'limit=50',
              enablePagination: true,
              pageSize: '100',
            },
          },
        }}
        onChange={onChange}
      />
    );
    expect(screen.getByRole('alert')).toHaveTextContent("'limit' is managed by pagination");

    rerender(
      <TinybirdSourceProperties
        node={{
          data: {
            properties: {
              host: 'https://api.tinybird.co',
              tokenSecret: 'tb-read-token',
              queryMode: 'pipe',
              pipeName: 'top_products',
              queryParams: 'offset=10',
              enablePagination: true,
              pageSize: '1.5',
            },
          },
        }}
        onChange={onChange}
      />
    );
    expect(screen.getByRole('alert')).toHaveTextContent("'offset' is managed by pagination");

    // Formats & quote64BitIntegers
    fireEvent.click(screen.getByLabelText(/Quote 64-bit Integers/i, { selector: 'input' }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ quote64BitIntegers: true }));

    rerender(
      <TinybirdSourceProperties
        node={{
          data: {
            properties: {
              host: 'https://api.tinybird.co',
              tokenSecret: 'tb-read-token',
              queryMode: 'pipe',
              pipeName: 'top_products',
              queryParams: 'env=prod',
              format: 'csv',
              enablePagination: false,
            },
          },
        }}
        onChange={onChange}
      />
    );
    expect(
      screen.queryByLabelText(/Quote 64-bit Integers/i, { selector: 'input' })
    ).not.toBeInTheDocument();

    // Expand Pagination while enablePagination is false
    fireEvent.click(screen.getByRole('button', { name: /Pagination/i }));
    expect(screen.getByLabelText(/Paginate Results/i, { selector: 'input' })).not.toBeChecked();

    rerender(
      <TinybirdSourceProperties
        node={{
          data: {
            properties: {
              host: 'https://api.tinybird.co',
              tokenSecret: 'tb-read-token',
              queryMode: 'sql',
              sqlQuery: 'SELECT * FROM events ORDER BY id',
              format: 'parquet',
              enablePagination: true,
              pageSize: '100',
            },
          },
        }}
        onChange={onChange}
      />
    );
    expect(screen.getByText(/Requires pyarrow on workers/i)).toBeInTheDocument();
    expect(
      screen.queryByLabelText(/Quote 64-bit Integers/i, { selector: 'input' })
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Limit Parameter Name/i)).not.toBeInTheDocument();

    rerender(
      <TinybirdSourceProperties
        node={{
          data: {
            properties: {
              host: 'https://api.tinybird.co',
              tokenSecret: 'tb-read-token',
              queryMode: 'pipe',
              pipeName: 'top_products',
              format: 'ndjson',
              enablePagination: true,
              pageSize: '',
              maxPages: '0',
              limitParam: '1bad',
              offsetParam: '1bad',
            },
          },
        }}
        onChange={onChange}
      />
    );
    expect(
      screen.getByLabelText(/Quote 64-bit Integers/i, { selector: 'input' })
    ).toBeInTheDocument();
    let alerts = screen.getAllByRole('alert').map((a) => a.textContent);
    expect(alerts).toContain('Page size is required when pagination is enabled');
    expect(alerts).toContain('Must be an integer ≥ 1');
    expect(alerts).toContain('Invalid parameter name');

    // Equal limitParam and offsetParam
    rerender(
      <TinybirdSourceProperties
        node={{
          data: {
            properties: {
              host: 'https://api.tinybird.co',
              tokenSecret: 'tb-read-token',
              queryMode: 'pipe',
              pipeName: 'top_products',
              enablePagination: true,
              pageSize: '0',
              limitParam: 'page_limit',
              offsetParam: 'page_limit',
            },
          },
        }}
        onChange={onChange}
      />
    );
    alerts = screen.getAllByRole('alert').map((a) => a.textContent);
    expect(alerts).toContain('Must be an integer ≥ 1');
    expect(alerts).toContain('Limit and offset parameters must differ');

    // Valid pagination in Pipe mode
    rerender(
      <TinybirdSourceProperties
        node={{
          data: {
            properties: {
              host: 'https://api.tinybird.co',
              tokenSecret: 'tb-read-token',
              queryMode: 'pipe',
              pipeName: 'top_products',
              queryParams: 'start_date=2024-01-01\n\ncurrency=USD',
              enablePagination: true,
              pageSize: '500',
              maxPages: '10',
              limitParam: 'limit',
              offsetParam: 'offset',
            },
          },
        }}
        onChange={onChange}
      />
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    // Collapse Pagination section
    fireEvent.click(screen.getByRole('button', { name: /Pagination/i }));
    expect(screen.queryByLabelText(/Paginate Results/i)).not.toBeInTheDocument();
  });

  it('updates system_instructions when code generation instructions textarea changes', () => {
    const onChange = vi.fn();
    renderPanel({}, {}, onChange);

    fireEvent.change(screen.getByLabelText(/Code Generation Instructions/i), {
      target: { value: 'updated tinybird source instructions' },
    });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ system_instructions: 'updated tinybird source instructions' })
    );
  });
});
