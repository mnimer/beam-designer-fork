/**
 * Unit Tests for CloudSQLSinkProperties Component (IO74)
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Achieves 100% statement, branch, function, and line coverage for
 * `webview/src/properties/sink/CloudSQL.tsx`, verifying R1 (documented properties + Docs ↗ link),
 * R2 (PubSubIO datalist pattern for sqlInstances and gated sqlDatabases), and
 * R3 (SecretManagerSecretField for passwordSecret + classifyKey allowlist verification).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  CloudSQLSinkProperties,
  CLOUD_SQL_DOC_URL,
  CLOUD_SQL_DB_DOC_URL,
  DEFAULT_DB_DRIVER,
} from './CloudSQL';
import { classifyKey } from '../../../../src/credentialRedaction';

const ALLOWED_SINK_KEYS = new Set([
  'cloudSqlInstance',
  'dbDriver',
  'database',
  'username',
  'passwordSecret',
  'table',
  'updateIgnores',
  'system_instructions',
]);

describe('CloudSQLSinkProperties (IO74)', () => {
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

  const dispatchExtMessage = (data: Record<string, unknown>) => {
    act(() => {
      window.dispatchEvent(new MessageEvent('message', { data }));
    });
  };

  const getOptionValues = (datalistId: string) =>
    Array.from(document.querySelectorAll(`#${datalistId} option`)).map((o) => o.getAttribute('value'));

  it('K1/K2/K3: renders with undefined properties, posts initial discovery requests, and marks required fields invalid', () => {
    expect(CLOUD_SQL_DB_DOC_URL).toContain('transformations/db.py');

    const { container } = render(<CloudSQLSinkProperties node={{ data: {} }} onChange={vi.fn()} />);

    const driverSelect = container.querySelector('#cloudSqlSinkDriver') as HTMLSelectElement;
    expect(driverSelect.value).toBe(DEFAULT_DB_DRIVER);

    const instructions = container.querySelector('#cloudSqlSinkSystemInstructions') as HTMLTextAreaElement;
    expect(instructions.value).toBe('');

    expect(postMessageSpy).toHaveBeenCalledWith({ command: 'getSqlInstances' });
    expect(postMessageSpy).toHaveBeenCalledWith({ command: 'getSecrets' });
    expect(postMessageSpy).not.toHaveBeenCalledWith(expect.objectContaining({ command: 'getSqlDatabases' }));

    expect(container.querySelector('#cloudSqlSinkInstance')).toHaveAttribute('aria-invalid', 'true');
    expect(container.querySelector('#cloudSqlSinkDatabase')).toHaveAttribute('aria-invalid', 'true');
    expect(container.querySelector('#cloudSqlSinkUsername')).toHaveAttribute('aria-invalid', 'true');
    expect(container.querySelector('#cloudSqlSinkPasswordSecret')).toHaveAttribute('aria-invalid', 'true');
    expect(container.querySelector('#cloudSqlSinkTable')).toHaveAttribute('aria-invalid', 'true');
    expect(container.querySelector('#cloudSqlSinkUpdateIgnores')).toHaveAttribute('aria-invalid', 'false');
  });

  it('K4: renders with all valid properties without any alert or invalid state', () => {
    const node = {
      data: {
        properties: {
          cloudSqlInstance: 'my-project:us-central1:analytics-pg',
          dbDriver: 'postgresql+psycopg2',
          database: 'analytics',
          username: 'beam_writer',
          passwordSecret: 'analytics-pg-pw',
          table: 'fulfilled_orders',
          updateIgnores: 'created_at, created_by',
        },
      },
    };

    const { container, rerender } = render(<CloudSQLSinkProperties node={node} onChange={vi.fn()} />);

    expect(screen.queryAllByRole('alert')).toHaveLength(0);
    expect(container.querySelector('#cloudSqlSinkInstance')).toHaveAttribute('aria-invalid', 'false');
    expect(container.querySelector('#cloudSqlSinkDatabase')).toHaveAttribute('aria-invalid', 'false');
    expect(container.querySelector('#cloudSqlSinkUsername')).toHaveAttribute('aria-invalid', 'false');
    expect(container.querySelector('#cloudSqlSinkPasswordSecret')).toHaveAttribute('aria-invalid', 'false');
    expect(container.querySelector('#cloudSqlSinkTable')).toHaveAttribute('aria-invalid', 'false');
    expect(container.querySelector('#cloudSqlSinkUpdateIgnores')).toHaveAttribute('aria-invalid', 'false');
    expect((container.querySelector('#cloudSqlSinkDriver') as HTMLSelectElement).value).toBe('postgresql+psycopg2');

    // Whitespace-only updateIgnores is also valid
    rerender(
      <CloudSQLSinkProperties
        node={{ data: { properties: { ...node.data.properties, updateIgnores: '   ' } } }}
        onChange={vi.fn()}
      />
    );
    expect(screen.queryAllByRole('alert')).toHaveLength(0);
  });

  it('K5/K6: populates sqlInstances datalist on success and displays discovery error on failure', () => {
    render(<CloudSQLSinkProperties node={{ data: { properties: {} } }} onChange={vi.fn()} />);

    dispatchExtMessage({
      command: 'sqlInstancesLoaded',
      sqlInstances: ['p1:us-central1:db1', 'p2:europe-west1:db2'],
    });
    expect(getOptionValues('cloudsql-sink-instance-options')).toEqual([
      'p1:us-central1:db1',
      'p2:europe-west1:db2',
    ]);

    dispatchExtMessage({
      command: 'sqlInstancesLoaded',
      sqlInstances: [],
      error: 'Failed to list Cloud SQL instances',
    });
    expect(screen.getByRole('alert')).toHaveTextContent('Failed to list Cloud SQL instances');
  });

  it('K7–K12: gates sqlDatabases on well-formed connection name, refreshes on change, and suppresses stale items', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <CloudSQLSinkProperties
        node={{ data: { properties: { cloudSqlInstance: 'my-instance', database: 'analytics' } } }}
        onChange={onChange}
      />
    );

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Use the instance connection name PROJECT:REGION:INSTANCE (see gcloud sql instances list).'
    );
    expect(postMessageSpy).not.toHaveBeenCalledWith(expect.objectContaining({ command: 'getSqlDatabases' }));

    rerender(
      <CloudSQLSinkProperties
        node={{ data: { properties: { cloudSqlInstance: 'p:us-central1:db1', database: 'analytics' } } }}
        onChange={onChange}
      />
    );
    expect(postMessageSpy).toHaveBeenCalledWith({
      command: 'getSqlDatabases',
      instance: 'p:us-central1:db1',
    });

    dispatchExtMessage({
      command: 'sqlDatabasesLoaded',
      sqlDatabases: ['postgres', 'analytics'],
    });
    expect(getOptionValues('cloudsql-sink-database-options')).toEqual(['postgres', 'analytics']);

    rerender(
      <CloudSQLSinkProperties
        node={{ data: { properties: { cloudSqlInstance: '  example.com:p:us-central1:db2  ', database: 'analytics' } } }}
        onChange={onChange}
      />
    );
    expect(postMessageSpy).toHaveBeenCalledWith({
      command: 'getSqlDatabases',
      instance: 'example.com:p:us-central1:db2',
    });
    expect(onChange).not.toHaveBeenCalled();

    dispatchExtMessage({
      command: 'sqlDatabasesLoaded',
      sqlDatabases: [],
      error: "Invalid or missing Cloud SQL instance identifier: 'x'",
    });
    expect(screen.getByRole('alert')).toHaveTextContent("Invalid or missing Cloud SQL instance identifier: 'x'");

    rerender(
      <CloudSQLSinkProperties
        node={{ data: { properties: { cloudSqlInstance: 'bad', database: 'analytics' } } }}
        onChange={onChange}
      />
    );
    expect(getOptionValues('cloudsql-sink-database-options')).toEqual([]);
    expect(screen.queryByText(/Invalid or missing Cloud SQL instance identifier/)).toBeNull();
  });

  it('K13–K19: validates database, username, table, updateIgnores and emits onChange with preserved properties', () => {
    const emitted: Array<Record<string, unknown>> = [];
    const onChange = vi.fn((p: Record<string, unknown>) => emitted.push(p));

    const { container, rerender } = render(
      <CloudSQLSinkProperties
        node={{
          data: {
            properties: {
              cloudSqlInstance: 'p:us-central1:db1',
              database: 'my/db',
              username: 'bad user',
              passwordSecret: 'pw-secret',
              table: 'my table',
              updateIgnores: 'a,,b',
            },
          },
        }}
        onChange={onChange}
      />
    );

    expect(screen.getByText('Database name cannot contain spaces or / ? # @ :')).toBeInTheDocument();
    expect(screen.getByText('Username cannot contain whitespace')).toBeInTheDocument();
    expect(screen.getByText('Table name cannot contain whitespace')).toBeInTheDocument();
    expect(screen.getByText('Enter comma-separated column names, e.g. created_at, created_by')).toBeInTheDocument();

    // Also test whitespace inside a token in updateIgnores
    rerender(
      <CloudSQLSinkProperties
        node={{
          data: {
            properties: {
              cloudSqlInstance: 'p:us-central1:db1',
              database: 'analytics',
              username: 'beam_writer',
              passwordSecret: 'pw-secret',
              table: 'orders',
              updateIgnores: 'created at',
            },
          },
        }}
        onChange={onChange}
      />
    );
    expect(screen.getByText('Enter comma-separated column names, e.g. created_at, created_by')).toBeInTheDocument();

    fireEvent.change(container.querySelector('#cloudSqlSinkInstance')!, {
      target: { name: 'cloudSqlInstance', value: 'p:us-central1:db2' },
    });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ cloudSqlInstance: 'p:us-central1:db2', passwordSecret: 'pw-secret' })
    );

    fireEvent.change(container.querySelector('#cloudSqlSinkDriver')!, {
      target: { name: 'dbDriver', value: 'postgresql+psycopg2' },
    });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ dbDriver: 'postgresql+psycopg2' }));

    fireEvent.change(container.querySelector('#cloudSqlSinkDatabase')!, {
      target: { name: 'database', value: 'analytics' },
    });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ database: 'analytics' }));

    fireEvent.change(container.querySelector('#cloudSqlSinkUsername')!, {
      target: { name: 'username', value: 'beam_writer' },
    });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ username: 'beam_writer' }));

    dispatchExtMessage({
      command: 'secretsLoaded',
      secrets: ['writer-pw', { id: 'other-pw', name: 'other-pw', value: 'other-pw', fullName: 'projects/1/secrets/other-pw' }],
    });
    expect(getOptionValues('cloudsql-sink-secret-options')).toEqual(['writer-pw', 'other-pw']);

    fireEvent.change(container.querySelector('#cloudSqlSinkPasswordSecret')!, {
      target: { name: 'passwordSecret', value: 'writer-pw' },
    });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ passwordSecret: 'writer-pw' }));

    fireEvent.change(container.querySelector('#cloudSqlSinkTable')!, {
      target: { name: 'table', value: 'orders' },
    });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ table: 'orders' }));

    fireEvent.change(container.querySelector('#cloudSqlSinkUpdateIgnores')!, {
      target: { name: 'updateIgnores', value: 'created_at' },
    });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ updateIgnores: 'created_at' }));

    for (const payload of emitted) {
      for (const key of Object.keys(payload)) {
        expect(ALLOWED_SINK_KEYS.has(key)).toBe(true);
        expect(['safe', 'reference']).toContain(classifyKey(key));
      }
    }
  });

  it('K20: honours the 4-level system_instructions fallback chain and emits updates', () => {
    const onChange = vi.fn();

    const { container, rerender } = render(
      <CloudSQLSinkProperties
        node={{
          data: {
            system_instructions: 'from-data-system',
            special_instructions: 'from-data-special',
            properties: {
              system_instructions: 'from-props-system',
              special_instructions: 'from-props-special',
            },
          },
        }}
        onChange={onChange}
      />
    );
    const textarea = container.querySelector('#cloudSqlSinkSystemInstructions') as HTMLTextAreaElement;
    expect(textarea.value).toBe('from-data-system');

    rerender(
      <CloudSQLSinkProperties
        node={{
          data: {
            special_instructions: 'from-data-special',
            properties: {
              system_instructions: 'from-props-system',
              special_instructions: 'from-props-special',
            },
          },
        }}
        onChange={onChange}
      />
    );
    expect(textarea.value).toBe('from-data-special');

    rerender(
      <CloudSQLSinkProperties
        node={{
          data: {
            properties: {
              system_instructions: 'from-props-system',
              special_instructions: 'from-props-special',
            },
          },
        }}
        onChange={onChange}
      />
    );
    expect(textarea.value).toBe('from-props-system');

    rerender(
      <CloudSQLSinkProperties
        node={{
          data: {
            properties: {
              special_instructions: 'from-props-special',
            },
          },
        }}
        onChange={onChange}
      />
    );
    expect(textarea.value).toBe('from-props-special');

    fireEvent.change(textarea, { target: { value: 'custom sink instructions' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ system_instructions: 'custom sink instructions' }));
  });

  it('K21/K22/K23: opens external documentation via Docs ↗ button and enforces R3 credential security', () => {
    const { container } = render(<CloudSQLSinkProperties node={{ data: { properties: {} } }} onChange={vi.fn()} />);

    const docsBtn = screen.getByRole('button', { name: /Open Cloud SQL connector documentation/i });
    expect(docsBtn).toHaveTextContent('Docs ↗');
    fireEvent.click(docsBtn);
    expect(postMessageSpy).toHaveBeenCalledWith({
      command: 'openExternal',
      url: CLOUD_SQL_DOC_URL,
    });

    delete vscodeWindow.vscode;
    fireEvent.click(docsBtn);

    expect(container.querySelector('input[type="password"]')).toBeNull();
    expect(container.querySelector('[name="password"]')).toBeNull();
    expect(container.querySelector('[name="dbUrl"]')).toBeNull();
    expect(container.querySelector('[name="passwordSecret"]')).toHaveAttribute(
      'data-list',
      'cloudsql-sink-secret-options'
    );

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
