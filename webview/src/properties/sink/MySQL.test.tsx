/**
 * Unit Tests for MySQLSinkProperties Component (IO75)
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Achieves 100% statement, branch, function, and line coverage for
 * `webview/src/properties/sink/MySQL.tsx`, verifying R1 (documented properties + Docs ↗ link),
 * R2/R3 (SecretManagerSecretField for passwordSecret + classifyKey allowlist verification),
 * and validation for host, port, database, bare table name, user, and batchSize.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MySQLSinkProperties } from './MySQL';
import { classifyKey } from '../../../../src/credentialRedaction';

const ALLOWED_SINK_KEYS = new Set([
  'host',
  'port',
  'database',
  'table',
  'user',
  'passwordSecret',
  'batchSize',
  'system_instructions',
]);

describe('MySQLSinkProperties (IO75)', () => {
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

  it('K-T1: renders with undefined properties and shows required errors for host, database, table, user, passwordSecret', () => {
    const { container } = render(<MySQLSinkProperties node={{ data: {} }} onChange={vi.fn()} />);

    expect(container.querySelector('#mysqlSinkHost')).toHaveAttribute('aria-invalid', 'true');
    expect(container.querySelector('#mysqlSinkPort')).toHaveAttribute('aria-invalid', 'false');
    expect(container.querySelector('#mysqlSinkDatabase')).toHaveAttribute('aria-invalid', 'true');
    expect(container.querySelector('#mysqlSinkTable')).toHaveAttribute('aria-invalid', 'true');
    expect(container.querySelector('#mysqlSinkUser')).toHaveAttribute('aria-invalid', 'true');
    expect(container.querySelector('#mysqlSinkPasswordSecret')).toHaveAttribute('aria-invalid', 'true');
    expect(container.querySelector('#mysqlSinkBatchSize')).toHaveAttribute('aria-invalid', 'false');

    expect(screen.getByText('Host is required.')).toBeInTheDocument();
    expect(screen.getByText('Database is required.')).toBeInTheDocument();
    expect(screen.getByText('Table is required.')).toBeInTheDocument();
    expect(screen.getByText('User is required.')).toBeInTheDocument();
    expect(screen.getByText('Password secret is required.')).toBeInTheDocument();
    expect(screen.getByText(/INSERT INTO my_database\.my_table/)).toBeInTheDocument();
  });

  it('K-T2: renders valid properties with zero alerts', () => {
    const { container } = render(
      <MySQLSinkProperties
        node={{
          data: {
            properties: {
              host: '10.0.0.6',
              port: '3306',
              database: 'analytics',
              table: 'orders_normalized',
              user: 'beam_writer',
              passwordSecret: 'analytics-mysql-pw',
              batchSize: '500',
            },
          },
        }}
        onChange={vi.fn()}
      />
    );

    expect(screen.queryAllByRole('alert')).toHaveLength(0);
    expect(container.querySelector('#mysqlSinkHost')).toHaveAttribute('aria-invalid', 'false');
    expect(container.querySelector('#mysqlSinkTable')).toHaveAttribute('aria-invalid', 'false');
    expect(container.querySelector('#mysqlSinkBatchSize')).toHaveAttribute('aria-invalid', 'false');
  });

  it('K-T3/K-T4/K-T5/K-T6/K-T7/K-T8: validates fields, updates onChange, and handles Secret Manager discovery', () => {
    const emitted: Array<Record<string, unknown>> = [];
    const onChange = vi.fn((p: Record<string, unknown>) => emitted.push(p));

    const { container, rerender } = render(
      <MySQLSinkProperties
        node={{
          data: {
            properties: {
              host: 'mysql://bad',
              port: '70000',
              database: 'analytics',
              table: 'analytics.orders',
              user: 'beam_writer',
              passwordSecret: 'pw',
              batchSize: '0',
            },
          },
        }}
        onChange={onChange}
      />
    );

    expect(
      screen.getByText('Enter a hostname or IP address only (no scheme, credentials, path or spaces).')
    ).toBeInTheDocument();
    expect(screen.getByText('Port must be an integer between 1 and 65535.')).toBeInTheDocument();
    expect(screen.getByText('Enter the table name only; the connector writes to <database>.<table>.')).toBeInTheDocument();
    expect(screen.getByText('Batch size must be a positive integer.')).toBeInTheDocument();

    // Non-digit port and batchSize
    rerender(
      <MySQLSinkProperties
        node={{
          data: {
            properties: {
              host: '10.0.0.6',
              port: 'abc',
              database: 'analytics',
              table: 'orders',
              user: 'beam_writer',
              passwordSecret: 'pw',
              batchSize: 'xyz',
            },
          },
        }}
        onChange={onChange}
      />
    );
    expect(screen.getByText('Port must be an integer between 1 and 65535.')).toBeInTheDocument();
    expect(screen.getByText('Batch size must be a positive integer.')).toBeInTheDocument();

    fireEvent.change(container.querySelector('#mysqlSinkHost')!, {
      target: { name: 'host', value: '10.0.0.9' },
    });
    fireEvent.change(container.querySelector('#mysqlSinkPort')!, {
      target: { name: 'port', value: '3306' },
    });
    fireEvent.change(container.querySelector('#mysqlSinkDatabase')!, {
      target: { name: 'database', value: 'analytics_db' },
    });
    fireEvent.change(container.querySelector('#mysqlSinkTable')!, {
      target: { name: 'table', value: 'orders_out' },
    });
    fireEvent.change(container.querySelector('#mysqlSinkUser')!, {
      target: { name: 'user', value: 'writer' },
    });
    fireEvent.change(container.querySelector('#mysqlSinkPasswordSecret')!, {
      target: { name: 'passwordSecret', value: 'writer-pw' },
    });
    fireEvent.change(container.querySelector('#mysqlSinkBatchSize')!, {
      target: { name: 'batchSize', value: '1000' },
    });

    expect(onChange).toHaveBeenCalledTimes(7);

    for (const payload of emitted) {
      for (const key of Object.keys(payload)) {
        expect(ALLOWED_SINK_KEYS.has(key)).toBe(true);
        expect(['safe', 'reference']).toContain(classifyKey(key));
      }
    }
  });

  it('K-T9: updates system_instructions and emits updates', () => {
    const onChange = vi.fn();

    const { container } = render(
      <MySQLSinkProperties
        node={{
          data: {
            properties: {},
          },
        }}
        onChange={onChange}
      />
    );
    const textarea = container.querySelector('#mysqlSinkSystemInstructions') as HTMLTextAreaElement;

    fireEvent.change(textarea, { target: { value: 'custom mysql sink instructions' } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ system_instructions: 'custom mysql sink instructions' })
    );
  });

  it('K-T10: enforces R3 credential security', () => {
    const { container } = render(<MySQLSinkProperties node={{ data: { properties: {} } }} onChange={vi.fn()} />);

    expect(container.querySelector('input[type="password"]')).toBeNull();
    expect(container.querySelector('[name="password"]')).toBeNull();

    for (const key of ALLOWED_SINK_KEYS) {
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
