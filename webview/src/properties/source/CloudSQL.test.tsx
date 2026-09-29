/**
 * Unit Tests for CloudSQLSourceProperties Component (IO74)
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Achieves 100% statement, branch, function, and line coverage for
 * `webview/src/properties/source/CloudSQL.tsx`, verifying R1 (documented properties + Docs ↗ link),
 * R2 (PubSubIO datalist pattern for sqlInstances and gated sqlDatabases), and
 * R3 (SecretManagerSecretField for passwordSecret + classifyKey allowlist verification).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  CloudSQLSourceProperties,
  CLOUD_SQL_DOC_URL,
  CLOUD_SQL_DB_DOC_URL,
  DEFAULT_DB_DRIVER,
} from './CloudSQL';
import { classifyKey } from '../../../../src/credentialRedaction';

const ALLOWED_SOURCE_KEYS = new Set([
  'cloudSqlInstance',
  'dbDriver',
  'database',
  'username',
  'passwordSecret',
  'query',
  'queryParams',
  'system_instructions',
]);

describe('CloudSQLSourceProperties (IO74)', () => {
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

  it('S1/S2/S3: renders with undefined properties, posts initial discovery requests, and marks required fields invalid', () => {
    expect(CLOUD_SQL_DB_DOC_URL).toContain('transformations/db.py');

    const { container } = render(<CloudSQLSourceProperties node={{ data: {} }} onChange={vi.fn()} />);

    const driverSelect = container.querySelector('#cloudSqlSourceDriver') as HTMLSelectElement;
    expect(driverSelect.value).toBe(DEFAULT_DB_DRIVER);

    const instructions = container.querySelector('#cloudSqlSourceSystemInstructions') as HTMLTextAreaElement;
    expect(instructions.value).toBe('');

    // Initial discovery: sqlInstances and secrets requested; sqlDatabases NOT requested while instance is empty
    expect(postMessageSpy).toHaveBeenCalledWith({ command: 'getSqlInstances' });
    expect(postMessageSpy).toHaveBeenCalledWith({ command: 'getSecrets' });
    expect(postMessageSpy).not.toHaveBeenCalledWith(expect.objectContaining({ command: 'getSqlDatabases' }));

    // Required fields are aria-invalid="true" when empty; optional queryParams is aria-invalid="false"
    expect(container.querySelector('#cloudSqlSourceInstance')).toHaveAttribute('aria-invalid', 'true');
    expect(container.querySelector('#cloudSqlSourceDatabase')).toHaveAttribute('aria-invalid', 'true');
    expect(container.querySelector('#cloudSqlSourceUsername')).toHaveAttribute('aria-invalid', 'true');
    expect(container.querySelector('#cloudSqlSourcePasswordSecret')).toHaveAttribute('aria-invalid', 'true');
    expect(container.querySelector('#cloudSqlSourceQuery')).toHaveAttribute('aria-invalid', 'true');
    expect(container.querySelector('#cloudSqlSourceQueryParams')).toHaveAttribute('aria-invalid', 'false');
  });

  it('S4: renders with all valid properties without any alert or invalid state', () => {
    const node = {
      data: {
        properties: {
          cloudSqlInstance: 'my-project:us-central1:orders-pg',
          dbDriver: 'postgresql+psycopg2',
          database: 'orders',
          username: 'beam_reader',
          passwordSecret: 'orders-pg-pw',
          query: 'SELECT * FROM orders WHERE status = :status',
          queryParams: '{"status": "PAID"}',
        },
      },
    };

    const { container, rerender } = render(<CloudSQLSourceProperties node={node} onChange={vi.fn()} />);

    expect(screen.queryAllByRole('alert')).toHaveLength(0);
    expect(container.querySelector('#cloudSqlSourceInstance')).toHaveAttribute('aria-invalid', 'false');
    expect(container.querySelector('#cloudSqlSourceDatabase')).toHaveAttribute('aria-invalid', 'false');
    expect(container.querySelector('#cloudSqlSourceUsername')).toHaveAttribute('aria-invalid', 'false');
    expect(container.querySelector('#cloudSqlSourcePasswordSecret')).toHaveAttribute('aria-invalid', 'false');
    expect(container.querySelector('#cloudSqlSourceQuery')).toHaveAttribute('aria-invalid', 'false');
    expect(container.querySelector('#cloudSqlSourceQueryParams')).toHaveAttribute('aria-invalid', 'false');
    expect((container.querySelector('#cloudSqlSourceDriver') as HTMLSelectElement).value).toBe('postgresql+psycopg2');

    // Whitespace-only queryParams is also valid
    rerender(
      <CloudSQLSourceProperties
        node={{ data: { properties: { ...node.data.properties, queryParams: '   ' } } }}
        onChange={vi.fn()}
      />
    );
    expect(screen.queryAllByRole('alert')).toHaveLength(0);
  });

  it('S5/S6: populates sqlInstances datalist on success and displays discovery error on failure', () => {
    render(<CloudSQLSourceProperties node={{ data: { properties: {} } }} onChange={vi.fn()} />);

    dispatchExtMessage({
      command: 'sqlInstancesLoaded',
      sqlInstances: ['p1:us-central1:db1', 'p2:europe-west1:db2'],
    });
    expect(getOptionValues('cloudsql-source-instance-options')).toEqual([
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

  it('S7/S8/S9/S10/S11/S12: gates sqlDatabases on well-formed connection name, refreshes on change, and suppresses stale items', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <CloudSQLSourceProperties
        node={{ data: { properties: { cloudSqlInstance: 'my-instance', database: 'shop' } } }}
        onChange={onChange}
      />
    );

    // S7: malformed connection name shows validation error and does NOT trigger getSqlDatabases
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Use the instance connection name PROJECT:REGION:INSTANCE (see gcloud sql instances list).'
    );
    expect(postMessageSpy).not.toHaveBeenCalledWith(expect.objectContaining({ command: 'getSqlDatabases' }));

    // S8: rerender with valid connection name triggers getSqlDatabases
    rerender(
      <CloudSQLSourceProperties
        node={{ data: { properties: { cloudSqlInstance: 'p:us-central1:db1', database: 'shop' } } }}
        onChange={onChange}
      />
    );
    expect(postMessageSpy).toHaveBeenCalledWith({
      command: 'getSqlDatabases',
      instance: 'p:us-central1:db1',
    });

    dispatchExtMessage({
      command: 'sqlDatabasesLoaded',
      sqlDatabases: ['postgres', 'shop'],
    });
    expect(getOptionValues('cloudsql-source-database-options')).toEqual(['postgres', 'shop']);

    // S9: dependent refresh when instance changes to another valid instance; database property is preserved
    rerender(
      <CloudSQLSourceProperties
        node={{ data: { properties: { cloudSqlInstance: '  example.com:p:us-central1:db2  ', database: 'shop' } } }}
        onChange={onChange}
      />
    );
    expect(postMessageSpy).toHaveBeenCalledWith({
      command: 'getSqlDatabases',
      instance: 'example.com:p:us-central1:db2',
    });
    expect(onChange).not.toHaveBeenCalled();

    // S10: sqlDatabasesLoaded error payload displays alert on database field
    dispatchExtMessage({
      command: 'sqlDatabasesLoaded',
      sqlDatabases: [],
      error: "Invalid or missing Cloud SQL instance identifier: 'x'",
    });
    expect(screen.getByRole('alert')).toHaveTextContent("Invalid or missing Cloud SQL instance identifier: 'x'");

    // S11: stale-list and error suppression when instance becomes invalid again
    rerender(
      <CloudSQLSourceProperties
        node={{ data: { properties: { cloudSqlInstance: 'bad', database: 'shop' } } }}
        onChange={onChange}
      />
    );
    expect(getOptionValues('cloudsql-source-database-options')).toEqual([]);
    expect(screen.queryByText(/Invalid or missing Cloud SQL instance identifier/)).toBeNull();
  });

  it('S13–S19: validates database, username, queryParams (invalid JSON, array, null, primitive) and emits onChange with preserved properties', () => {
    const emitted: Array<Record<string, unknown>> = [];
    const onChange = vi.fn((p: Record<string, unknown>) => emitted.push(p));

    const { container, rerender } = render(
      <CloudSQLSourceProperties
        node={{
          data: {
            properties: {
              cloudSqlInstance: 'p:us-central1:db1',
              database: 'my/db',
              username: 'bad user',
              passwordSecret: 'pw-secret',
              query: 'SELECT 1',
              queryParams: '{invalid',
            },
          },
        }}
        onChange={onChange}
      />
    );

    expect(screen.getByText('Database name cannot contain spaces or / ? # @ :')).toBeInTheDocument();
    expect(screen.getByText('Username cannot contain whitespace')).toBeInTheDocument();
    expect(screen.getByText(/Invalid JSON:/)).toBeInTheDocument();

    fireEvent.change(container.querySelector('#cloudSqlSourceInstance')!, {
      target: { name: 'cloudSqlInstance', value: 'p:us-central1:db2' },
    });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ cloudSqlInstance: 'p:us-central1:db2', query: 'SELECT 1' })
    );

    fireEvent.change(container.querySelector('#cloudSqlSourceDriver')!, {
      target: { name: 'dbDriver', value: 'postgresql+psycopg2' },
    });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ dbDriver: 'postgresql+psycopg2' }));

    fireEvent.change(container.querySelector('#cloudSqlSourceDatabase')!, {
      target: { name: 'database', value: 'orders' },
    });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ database: 'orders' }));

    fireEvent.change(container.querySelector('#cloudSqlSourceUsername')!, {
      target: { name: 'username', value: 'beam_user' },
    });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ username: 'beam_user' }));

    // Secret picker datalist & onChange
    dispatchExtMessage({
      command: 'secretsLoaded',
      secrets: ['db-pw', { id: 'other-pw', name: 'other-pw', value: 'other-pw', fullName: 'projects/1/secrets/other-pw' }],
    });
    expect(getOptionValues('cloudsql-source-secret-options')).toEqual(['db-pw', 'other-pw']);

    fireEvent.change(container.querySelector('#cloudSqlSourcePasswordSecret')!, {
      target: { name: 'passwordSecret', value: 'db-pw' },
    });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ passwordSecret: 'db-pw' }));

    fireEvent.change(container.querySelector('#cloudSqlSourceQuery')!, {
      target: { name: 'query', value: 'SELECT id FROM orders' },
    });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ query: 'SELECT id FROM orders' }));

    fireEvent.change(container.querySelector('#cloudSqlSourceQueryParams')!, {
      target: { name: 'queryParams', value: '{"status": "ACTIVE"}' },
    });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ queryParams: '{"status": "ACTIVE"}' }));

    // Verify non-object JSON values (array, null, number) in component render
    for (const nonObj of ['[1, 2, 3]', 'null', '42']) {
      rerender(
        <CloudSQLSourceProperties
          node={{
            data: {
              properties: {
                cloudSqlInstance: 'p:us-central1:db1',
                database: 'orders',
                username: 'beam_user',
                passwordSecret: 'db-pw',
                query: 'SELECT 1',
                queryParams: nonObj,
              },
            },
          }}
          onChange={onChange}
        />
      );
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Query parameters must be a JSON object, e.g. {"status": "active"}'
      );
    }

    // Every emitted key is in ALLOWED_SOURCE_KEYS and classifies as 'safe' or 'reference'
    for (const payload of emitted) {
      for (const key of Object.keys(payload)) {
        expect(ALLOWED_SOURCE_KEYS.has(key)).toBe(true);
        expect(['safe', 'reference']).toContain(classifyKey(key));
      }
    }
  });

  it('S20: honours the 4-level system_instructions fallback chain and emits updates', () => {
    const onChange = vi.fn();

    const { container, rerender } = render(
      <CloudSQLSourceProperties
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
    const textarea = container.querySelector('#cloudSqlSourceSystemInstructions') as HTMLTextAreaElement;
    expect(textarea.value).toBe('from-data-system');

    rerender(
      <CloudSQLSourceProperties
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
      <CloudSQLSourceProperties
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
      <CloudSQLSourceProperties
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

    fireEvent.change(textarea, { target: { value: 'custom cloud sql instructions' } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ system_instructions: 'custom cloud sql instructions' })
    );
  });

  it('S21/S22/S23: opens external documentation via Docs ↗ button and enforces R3 credential security', () => {
    const { container } = render(<CloudSQLSourceProperties node={{ data: { properties: {} } }} onChange={vi.fn()} />);

    const docsBtn = screen.getByRole('button', { name: /Open Cloud SQL connector documentation/i });
    expect(docsBtn).toHaveTextContent('Docs ↗');
    fireEvent.click(docsBtn);
    expect(postMessageSpy).toHaveBeenCalledWith({
      command: 'openExternal',
      url: CLOUD_SQL_DOC_URL,
    });

    // Clicking Docs ↗ when window.vscode is undefined is a safe no-op
    delete vscodeWindow.vscode;
    fireEvent.click(docsBtn);

    // R3 audit: no password input, no plaintext password or dbUrl fields, all allowed keys classify safe/reference
    expect(container.querySelector('input[type="password"]')).toBeNull();
    expect(container.querySelector('[name="password"]')).toBeNull();
    expect(container.querySelector('[name="dbUrl"]')).toBeNull();
    expect(container.querySelector('[name="passwordSecret"]')).toHaveAttribute(
      'data-list',
      'cloudsql-source-secret-options'
    );

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
