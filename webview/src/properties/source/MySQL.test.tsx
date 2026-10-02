/**
 * Unit Tests for MySQLSourceProperties Component (IO75)
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Unit tests for `webview/src/properties/source/MySQL.tsx`, verifying documented properties,
 * SecretManagerSecretField for passwordSecret + classifyKey allowlist verification,
 * and splitter-specific SQL query rules (`NoSplitter`, `LimitOffsetSplitter`, `IdsSplitter`,
 * `PartitionSplitter`, `DateSplitter`).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  MySQLSourceProperties,
  DEFAULT_MYSQL_SPLITTER,
} from './MySQL';
import { classifyKey } from '../../../../src/credentialRedaction';

const ALLOWED_SOURCE_KEYS = new Set([
  'host',
  'port',
  'database',
  'user',
  'passwordSecret',
  'query',
  'splitter',
  'splitterBatchSize',
  'generateIdsFn',
  'system_instructions',
]);

describe('MySQLSourceProperties (IO75)', () => {
  let postMessageSpy: ReturnType<typeof vi.fn>;
  const vscodeWindow = window as unknown as { vscode?: { postMessage: ReturnType<typeof vi.fn> } };

  beforeEach(() => {
    vi.clearAllMocks();
    postMessageSpy = vi.fn();
    vscodeWindow.vscode = { postMessage: postMessageSpy };
  });

  afterEach(() => {
    delete vscodeWindow.vscode;
  });


  it('T1/T2: renders with undefined properties, shows default NoSplitter, hides conditional fields, and shows required errors', () => {
    const { container } = render(<MySQLSourceProperties node={{ data: {} }} onChange={vi.fn()} />);

    expect(container.querySelector('#mysqlSourceHost')).toHaveAttribute('aria-invalid', 'true');
    expect(container.querySelector('#mysqlSourcePort')).toHaveAttribute('aria-invalid', 'false');
    expect(container.querySelector('#mysqlSourceDatabase')).toHaveAttribute('aria-invalid', 'true');
    expect(container.querySelector('#mysqlSourceUser')).toHaveAttribute('aria-invalid', 'true');
    expect(container.querySelector('#mysqlSourcePasswordSecret')).toHaveAttribute('aria-invalid', 'true');
    expect(container.querySelector('#mysqlSourceQuery')).toHaveAttribute('aria-invalid', 'true');

    const splitterSelect = container.querySelector('#mysqlSourceSplitter') as HTMLSelectElement;
    expect(splitterSelect.value).toBe(DEFAULT_MYSQL_SPLITTER);
    expect(container.querySelector('#mysqlSourceSplitterBatchSize')).toBeNull();
    expect(container.querySelector('#mysqlSourceGenerateIdsFn')).toBeNull();

    expect(screen.getByText('Host is required.')).toBeInTheDocument();
    expect(screen.getByText('Database is required.')).toBeInTheDocument();
    expect(screen.getByText('User is required.')).toBeInTheDocument();
    expect(screen.getByText('Password secret is required.')).toBeInTheDocument();
    expect(screen.getByText('Query is required.')).toBeInTheDocument();
    expect(screen.getByText('No split bounded source so not work parallel.')).toBeInTheDocument();
  });

  it('T3: renders valid properties with zero alerts', () => {
    const { container } = render(
      <MySQLSourceProperties
        node={{
          data: {
            properties: {
              host: '10.0.0.5',
              port: '3306',
              database: 'shop',
              user: 'beam_reader',
              passwordSecret: 'shop-mysql-pw',
              query: 'SELECT id, amount FROM orders',
            },
          },
        }}
        onChange={vi.fn()}
      />
    );

    expect(screen.queryAllByRole('alert')).toHaveLength(0);
    expect(container.querySelector('#mysqlSourceHost')).toHaveAttribute('aria-invalid', 'false');
    expect(container.querySelector('#mysqlSourcePort')).toHaveAttribute('aria-invalid', 'false');
  });

  it('T4/T5/T6/T7: validates host, port, SELECT query (with comments/CTE), and splitter query rules via component render', () => {
    const baseValid = {
      host: '10.0.0.5',
      port: '3306',
      database: 'shop',
      user: 'beam_reader',
      passwordSecret: 'shop-mysql-pw',
      query: 'SELECT * FROM orders',
    };

    const { rerender } = render(
      <MySQLSourceProperties
        node={{ data: { properties: { ...baseValid, host: 'user:pw@host' } } }}
        onChange={vi.fn()}
      />
    );
    expect(
      screen.getByText('Enter a hostname or IP address only (no scheme, credentials, path or spaces).')
    ).toBeInTheDocument();

    // Port non-digit and out-of-range
    rerender(
      <MySQLSourceProperties node={{ data: { properties: { ...baseValid, port: 'abc' } } }} onChange={vi.fn()} />
    );
    expect(screen.getByText('Port must be an integer between 1 and 65535.')).toBeInTheDocument();

    rerender(
      <MySQLSourceProperties node={{ data: { properties: { ...baseValid, port: '0' } } }} onChange={vi.fn()} />
    );
    expect(screen.getByText('Port must be an integer between 1 and 65535.')).toBeInTheDocument();

    rerender(
      <MySQLSourceProperties node={{ data: { properties: { ...baseValid, port: '65536' } } }} onChange={vi.fn()} />
    );
    expect(screen.getByText('Port must be an integer between 1 and 65535.')).toBeInTheDocument();

    // Non-SELECT query vs CTE/comment SELECT query
    rerender(
      <MySQLSourceProperties
        node={{ data: { properties: { ...baseValid, query: 'DELETE FROM orders' } } }}
        onChange={vi.fn()}
      />
    );
    expect(
      screen.getByText('Query must be a SELECT statement (a leading WITH … AS (…) CTE and comments are allowed).')
    ).toBeInTheDocument();

    rerender(
      <MySQLSourceProperties
        node={{
          data: {
            properties: {
              ...baseValid,
              query: '-- comment\n/* block */\nWITH recent AS (SELECT * FROM orders) SELECT * FROM recent',
            },
          },
        }}
        onChange={vi.fn()}
      />
    );
    expect(screen.queryAllByRole('alert')).toHaveLength(0);

    // IdsSplitter query rules: NOT IN ({ids}), missing IN ({ids})
    rerender(
      <MySQLSourceProperties
        node={{
          data: {
            properties: {
              ...baseValid,
              splitter: 'IdsSplitter',
              generateIdsFn: 'lambda: [1]',
              query: 'SELECT * FROM orders WHERE id NOT IN ({ids})',
            },
          },
        }}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByText('IdsSplitter does not support NOT IN ({ids}).')).toBeInTheDocument();

    rerender(
      <MySQLSourceProperties
        node={{
          data: {
            properties: {
              ...baseValid,
              splitter: 'IdsSplitter',
              generateIdsFn: 'lambda: [1]',
              query: 'SELECT * FROM orders',
            },
          },
        }}
        onChange={vi.fn()}
      />
    );
    expect(
      screen.getByText('Query must contain an IN ({ids}) clause, e.g. SELECT * FROM orders WHERE id IN ({ids})'.replace('orders', 'tests'))
    ).toBeInTheDocument();

    // PartitionSplitter query rules: invalid vs valid
    rerender(
      <MySQLSourceProperties
        node={{
          data: {
            properties: {
              ...baseValid,
              splitter: 'PartitionSplitter',
              query: 'SELECT * FROM orders PARTITION (P202001)',
            },
          },
        }}
        onChange={vi.fn()}
      />
    );
    expect(
      screen.getByText('Query must list partitions named p + 6 digits, e.g. SELECT * FROM tests PARTITION (p202001,p202002)')
    ).toBeInTheDocument();

    rerender(
      <MySQLSourceProperties
        node={{
          data: {
            properties: {
              ...baseValid,
              splitter: 'PartitionSplitter',
              query: 'SELECT * FROM orders PARTITION (p202001,p202002)',
            },
          },
        }}
        onChange={vi.fn()}
      />
    );
    expect(screen.queryAllByRole('alert')).toHaveLength(0);

    // DateSplitter query rules: invalid vs valid
    rerender(
      <MySQLSourceProperties
        node={{
          data: {
            properties: {
              ...baseValid,
              splitter: 'DateSplitter',
              query: "SELECT * FROM orders WHERE created_at >= '2020-01-01'",
            },
          },
        }}
        onChange={vi.fn()}
      />
    );
    expect(
      screen.getByText(
        "Query must contain a date range, e.g. SELECT * FROM tests WHERE date BETWEEN '2019-01-01' AND '2020-01-01'"
      )
    ).toBeInTheDocument();

    rerender(
      <MySQLSourceProperties
        node={{
          data: {
            properties: {
              ...baseValid,
              splitter: 'DateSplitter',
              query: "SELECT * FROM orders WHERE created_at BETWEEN '2019-01-01' AND '2020-01-01'",
            },
          },
        }}
        onChange={vi.fn()}
      />
    );
    expect(screen.queryAllByRole('alert')).toHaveLength(0);

    // Unknown splitter falls back to NoSplitter helper text and null splitter error
    rerender(
      <MySQLSourceProperties
        node={{
          data: {
            properties: {
              ...baseValid,
              splitter: 'CustomUnknownSplitter',
            },
          },
        }}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByText('No split bounded source so not work parallel.')).toBeInTheDocument();
  });

  it('T8/T9/T10/T11/T12/T13: renders conditional splitter fields, validates them, and cleans up stale keys on splitter change', () => {
    const onChange = vi.fn();

    // Render LimitOffsetSplitter with invalid batchSize
    const { container, rerender } = render(
      <MySQLSourceProperties
        node={{
          data: {
            properties: {
              host: '10.0.0.5',
              database: 'shop',
              user: 'u',
              passwordSecret: 'pw',
              query: 'SELECT * FROM orders',
              splitter: 'LimitOffsetSplitter',
              splitterBatchSize: '0',
            },
          },
        }}
        onChange={onChange}
      />
    );

    expect(container.querySelector('#mysqlSourceSplitterBatchSize')).not.toBeNull();
    expect(container.querySelector('#mysqlSourceGenerateIdsFn')).toBeNull();
    expect(screen.getByText('Splitter batch size must be a positive integer.')).toBeInTheDocument();
    expect(screen.getByText('Split bounded source by limit and offset.')).toBeInTheDocument();

    // Render IdsSplitter with empty generateIdsFn and valid batchSize
    rerender(
      <MySQLSourceProperties
        node={{
          data: {
            properties: {
              host: '10.0.0.5',
              database: 'shop',
              user: 'u',
              passwordSecret: 'pw',
              query: 'SELECT * FROM orders WHERE id IN ({ids})',
              splitter: 'IdsSplitter',
              splitterBatchSize: '500',
              generateIdsFn: '',
            },
          },
        }}
        onChange={onChange}
      />
    );

    expect(container.querySelector('#mysqlSourceSplitterBatchSize')).toHaveAttribute('aria-invalid', 'false');
    expect(container.querySelector('#mysqlSourceGenerateIdsFn')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('A Python callable that returns the ids is required for IdsSplitter.')).toBeInTheDocument();

    // Fill generateIdsFn and blank splitterBatchSize -> valid
    rerender(
      <MySQLSourceProperties
        node={{
          data: {
            properties: {
              host: '10.0.0.5',
              database: 'shop',
              user: 'u',
              passwordSecret: 'pw',
              query: 'SELECT * FROM orders WHERE id IN ({ids})',
              splitter: 'IdsSplitter',
              splitterBatchSize: '',
              generateIdsFn: 'lambda: range(1, 100)',
            },
          },
        }}
        onChange={onChange}
      />
    );
    expect(screen.queryAllByRole('alert')).toHaveLength(0);

    // Rerender with both splitterBatchSize and generateIdsFn set to test cleanup on splitter change
    rerender(
      <MySQLSourceProperties
        node={{
          data: {
            properties: {
              host: '10.0.0.5',
              database: 'shop',
              user: 'u',
              passwordSecret: 'pw',
              query: 'SELECT * FROM orders WHERE id IN ({ids})',
              splitter: 'IdsSplitter',
              splitterBatchSize: '500',
              generateIdsFn: 'lambda: range(1, 100)',
            },
          },
        }}
        onChange={onChange}
      />
    );

    // Switching from IdsSplitter to LimitOffsetSplitter keeps splitterBatchSize and deletes generateIdsFn
    const splitterSelect = container.querySelector('#mysqlSourceSplitter') as HTMLSelectElement;
    fireEvent.change(splitterSelect, { target: { name: 'splitter', value: 'LimitOffsetSplitter' } });
    const limitOffsetCall = onChange.mock.calls.at(-1)![0];
    expect(limitOffsetCall.splitter).toBe('LimitOffsetSplitter');
    expect(limitOffsetCall.splitterBatchSize).toBe('500');
    expect(limitOffsetCall).not.toHaveProperty('generateIdsFn');

    // Switching from IdsSplitter to NoSplitter deletes both splitterBatchSize and generateIdsFn
    fireEvent.change(splitterSelect, { target: { name: 'splitter', value: 'NoSplitter' } });
    const noSplitterCall = onChange.mock.calls.at(-1)![0];
    expect(noSplitterCall.splitter).toBe('NoSplitter');
    expect(noSplitterCall).not.toHaveProperty('splitterBatchSize');
    expect(noSplitterCall).not.toHaveProperty('generateIdsFn');

    // Switching to IdsSplitter keeps both
    fireEvent.change(splitterSelect, { target: { name: 'splitter', value: 'IdsSplitter' } });
    const idsCall = onChange.mock.calls.at(-1)![0];
    expect(idsCall.splitter).toBe('IdsSplitter');
    expect(idsCall.splitterBatchSize).toBe('500');
    expect(idsCall.generateIdsFn).toBe('lambda: range(1, 100)');
  });

  it('T14/T15/T16: updates all fields via onChange', () => {
    const emitted: Array<Record<string, unknown>> = [];
    const onChange = vi.fn((p: Record<string, unknown>) => emitted.push(p));

    const { container } = render(
      <MySQLSourceProperties
        node={{
          data: {
            properties: {
              host: '10.0.0.1',
              port: '3306',
              database: 'db',
              user: 'u',
              passwordSecret: 'pw',
              query: 'SELECT * FROM t WHERE id IN ({ids})',
              splitter: 'IdsSplitter',
            },
          },
        }}
        onChange={onChange}
      />
    );

    fireEvent.change(container.querySelector('#mysqlSourceHost')!, {
      target: { name: 'host', value: '10.0.0.2' },
    });
    fireEvent.change(container.querySelector('#mysqlSourcePort')!, {
      target: { name: 'port', value: '3307' },
    });
    fireEvent.change(container.querySelector('#mysqlSourceDatabase')!, {
      target: { name: 'database', value: 'shop_db' },
    });
    fireEvent.change(container.querySelector('#mysqlSourceUser')!, {
      target: { name: 'user', value: 'reader' },
    });
    fireEvent.change(container.querySelector('#mysqlSourcePasswordSecret')!, {
      target: { name: 'passwordSecret', value: 'mysql-pw' },
    });
    fireEvent.change(container.querySelector('#mysqlSourceQuery')!, {
      target: { name: 'query', value: 'SELECT id FROM t WHERE id IN ({ids})' },
    });
    fireEvent.change(container.querySelector('#mysqlSourceSplitterBatchSize')!, {
      target: { name: 'splitterBatchSize', value: '50000' },
    });
    fireEvent.change(container.querySelector('#mysqlSourceGenerateIdsFn')!, {
      target: { name: 'generateIdsFn', value: 'lambda: [1, 2, 3]' },
    });

    expect(onChange).toHaveBeenCalledTimes(8);

    for (const payload of emitted) {
      for (const key of Object.keys(payload)) {
        expect(ALLOWED_SOURCE_KEYS.has(key)).toBe(true);
        expect(['safe', 'reference']).toContain(classifyKey(key));
      }
    }
  });

  it('T17: updates system_instructions when instructions textarea is edited', () => {
    const onChange = vi.fn();

    const { container } = render(
      <MySQLSourceProperties
        node={{
          data: {
            properties: {},
          },
        }}
        onChange={onChange}
      />
    );
    const textarea = container.querySelector('#mysqlSourceSystemInstructions') as HTMLTextAreaElement;

    fireEvent.change(textarea, { target: { value: 'custom mysql source instructions' } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ system_instructions: 'custom mysql source instructions' })
    );
  });

  it('T18: enforces R3 credential security and key classification', () => {
    const { container } = render(<MySQLSourceProperties node={{ data: { properties: {} } }} onChange={vi.fn()} />);

    expect(container.querySelector('input[type="password"]')).toBeNull();
    expect(container.querySelector('[name="password"]')).toBeNull();

    for (const key of ALLOWED_SOURCE_KEYS) {
      const classification = classifyKey(key);
      expect(['safe', 'reference']).toContain(classification);
      if (key === 'passwordSecret') {
        expect(classification).toBe('reference');
      } else {
        expect(classification).toBe('safe');
      }
    }
  });
});
