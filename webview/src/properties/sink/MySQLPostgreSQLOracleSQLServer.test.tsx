/**
 * MySQL / PostgreSQL / Oracle / SQL Server (Beam YAML) Sink Properties Unit Tests (IO79)
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Exercises 100% of statements, branches, functions, and lines in
 * `webview/src/properties/sink/MySQLPostgreSQLOracleSQLServer.tsx`, including per-flavor
 * rendering/switching, SecretManagerSecretField + resolveOnWorkers toggle, table/query
 * writeMode, batchSize, autoSharding, connectionInitSql, external doc links, and
 * `classifyKey` redaction hygiene.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MySQLPostgreSQLOracleSQLServerSinkProperties } from './MySQLPostgreSQLOracleSQLServer';
import { YAML_DOC_BASE } from '../source/MySQLPostgreSQLOracleSQLServer';
import type { DatabaseType } from '../source/MySQLPostgreSQLOracleSQLServer';
import { classifyKey } from '../../../../src/credentialRedaction';

const FLAVOR_EXPECTATIONS: Array<{
  value: DatabaseType;
  writeTransform: string;
  exampleUrl: string;
  driver: string;
  supportsInitSql: boolean;
}> = [
  {
    value: 'mysql',
    writeTransform: 'WriteToMySql',
    exampleUrl: 'jdbc:mysql://my-host:3306/database',
    driver: 'com.mysql.cj.jdbc.Driver',
    supportsInitSql: true,
  },
  {
    value: 'postgres',
    writeTransform: 'WriteToPostgres',
    exampleUrl: 'jdbc:postgresql://my-host:5432/database',
    driver: 'org.postgresql.Driver',
    supportsInitSql: false,
  },
  {
    value: 'oracle',
    writeTransform: 'WriteToOracle',
    exampleUrl: 'jdbc:oracle://my-host:1521/database',
    driver: 'oracle.jdbc.driver.OracleDriver',
    supportsInitSql: false,
  },
  {
    value: 'sqlserver',
    writeTransform: 'WriteToSqlServer',
    exampleUrl: 'jdbc:sqlserver://my-host:1433/database',
    driver: 'com.microsoft.sqlserver.jdbc.SQLServerDriver',
    supportsInitSql: false,
  },
];

describe('MySQLPostgreSQLOracleSQLServerSinkProperties (IO79)', () => {
  const mockPostMessage = vi.fn();
  const vscodeWindow = window as unknown as { vscode?: { postMessage: typeof mockPostMessage } };

  beforeEach(() => {
    mockPostMessage.mockClear();
    vscodeWindow.vscode = { postMessage: mockPostMessage };
  });

  afterEach(() => {
    delete vscodeWindow.vscode;
  });

  const makeNode = (
    props?: Record<string, unknown>,
    extraData?: Record<string, unknown>
  ) => ({
    data: {
      label: 'MySQL, PostgreSQL, Oracle, SQL Server',
      type: 'SINK',
      beam_transform: 'MySQLPostgreSQLOracleSQLServer',
      ...(props !== undefined ? { properties: props } : {}),
      ...extraData,
    },
  });

  it('renders default state (MySQL, table mode) with undefined properties and required errors', () => {
    const { container } = render(
      <MySQLPostgreSQLOracleSQLServerSinkProperties
        node={makeNode(undefined)}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByText('WriteToMySql')).toBeInTheDocument();
    expect(screen.getByText('JDBC URL cannot be blank')).toBeInTheDocument();
    expect(screen.getByText('Either Write Statement or Table must be set.')).toBeInTheDocument();
    expect(
      screen.getByLabelText(/Connection Init SQL/i, { selector: 'textarea' })
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/Resolve secret on workers/i)).toBeNull();
    expect(screen.queryByLabelText(/Fetch Size/i)).toBeNull();
    expect(screen.queryByLabelText(/Partition Column/i)).toBeNull();
    expect(mockPostMessage).toHaveBeenCalledWith({ command: 'getSecrets' });
    expect(container.querySelector('input[type="password"]')).toBeNull();
  });

  it('validates embedded URL passwords and connectionProperties credentials on sink panel', () => {
    const { rerender } = render(
      <MySQLPostgreSQLOracleSQLServerSinkProperties
        node={makeNode({
          databaseType: 'mysql',
          url: 'jdbc:mysql://host/db?password=secret',
          table: 'orders',
          connectionProperties: 'password=secret;',
        })}
        onChange={vi.fn()}
      />
    );

    expect(
      screen.getByText('Do not embed a password in the URL — select a Password Secret instead.')
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Set Username and Password Secret above; do not put credentials in connection properties.'
      )
    ).toBeInTheDocument();

    rerender(
      <MySQLPostgreSQLOracleSQLServerSinkProperties
        node={makeNode({
          databaseType: 'postgres',
          url: 'jdbc:postgresql://user:secret@host:5432/db',
          table: 'orders',
        })}
        onChange={vi.fn()}
      />
    );
    expect(
      screen.getByText('Do not embed a password in the URL — select a Password Secret instead.')
    ).toBeInTheDocument();
  });

  it('opens Beam YAML write transform documentation when Docs ↗ button is clicked and handles missing vscode API', () => {
    const { rerender } = render(
      <MySQLPostgreSQLOracleSQLServerSinkProperties
        node={makeNode({ databaseType: 'mysql', url: 'jdbc:mysql://h:3306/d', table: 't' })}
        onChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open WriteToMySql documentation' }));
    expect(mockPostMessage).toHaveBeenCalledWith({
      command: 'openExternal',
      url: `${YAML_DOC_BASE}#writetomysql`,
    });

    rerender(
      <MySQLPostgreSQLOracleSQLServerSinkProperties
        node={makeNode({
          databaseType: 'sqlserver',
          url: 'jdbc:sqlserver://h:1433/d',
          table: 't',
        })}
        onChange={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open WriteToSqlServer documentation' }));
    expect(mockPostMessage).toHaveBeenCalledWith({
      command: 'openExternal',
      url: `${YAML_DOC_BASE}#writetosqlserver`,
    });

    mockPostMessage.mockClear();
    delete vscodeWindow.vscode;
    fireEvent.click(screen.getByRole('button', { name: 'Open WriteToSqlServer documentation' }));
    expect(mockPostMessage).not.toHaveBeenCalled();
  });

  it.each(FLAVOR_EXPECTATIONS)(
    'renders flavor-specific UI for $value ($writeTransform)',
    (flavor) => {
      render(
        <MySQLPostgreSQLOracleSQLServerSinkProperties
          node={makeNode({
            databaseType: flavor.value,
            url: flavor.exampleUrl,
            table: 'orders',
          })}
          onChange={vi.fn()}
        />
      );

      expect(screen.getByText(flavor.writeTransform)).toBeInTheDocument();
      expect(screen.getByLabelText(/JDBC URL/i, { selector: 'input' })).toHaveAttribute(
        'placeholder',
        flavor.exampleUrl
      );
      expect(screen.getByLabelText(/Driver Class Name/i, { selector: 'input' })).toHaveAttribute(
        'placeholder',
        flavor.driver
      );

      if (flavor.supportsInitSql) {
        expect(
          screen.getByLabelText(/Connection Init SQL/i, { selector: 'textarea' })
        ).toBeInTheDocument();
      } else {
        expect(screen.queryByLabelText(/Connection Init SQL/i)).toBeNull();
      }
    }
  );

  it('cleans up connectionInitSql when switching from MySQL to non-MySQL and keeps it when switching to MySQL', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <MySQLPostgreSQLOracleSQLServerSinkProperties
        node={makeNode({
          databaseType: 'mysql',
          url: 'jdbc:mysql://h:3306/d',
          table: 'orders',
          connectionInitSql: ['SET a=1'],
        })}
        onChange={onChange}
      />
    );

    fireEvent.change(screen.getByLabelText(/^Database/i, { selector: 'select' }), {
      target: { value: 'postgres' },
    });
    expect(onChange.mock.calls.at(-1)?.[0]).toEqual({
      databaseType: 'postgres',
      url: 'jdbc:mysql://h:3306/d',
      table: 'orders',
    });

    rerender(
      <MySQLPostgreSQLOracleSQLServerSinkProperties
        node={makeNode({
          databaseType: 'postgres',
          url: 'jdbc:postgresql://h:5432/d',
          table: 'orders',
        })}
        onChange={onChange}
      />
    );
    fireEvent.change(screen.getByLabelText(/^Database/i, { selector: 'select' }), {
      target: { value: 'mysql' },
    });
    expect(onChange.mock.calls.at(-1)?.[0]).toEqual({
      databaseType: 'mysql',
      url: 'jdbc:postgresql://h:5432/d',
      table: 'orders',
    });
  });

  it('renders URL scheme warning and manages passwordSecret + resolveOnWorkers lifecycle', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <MySQLPostgreSQLOracleSQLServerSinkProperties
        node={makeNode({
          databaseType: 'oracle',
          url: 'jdbc:mysql://h:3306/d',
          table: 'orders',
        })}
        onChange={onChange}
      />
    );

    expect(screen.getByText(/URL does not look like a Oracle JDBC URL/i)).toBeInTheDocument();

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { command: 'secretsLoaded', secrets: ['oracle-writer-pw'] },
        })
      );
    });
    const options = Array.from(
      document.querySelectorAll('#multidb-sink-secrets-list option')
    ).map((o) => o.getAttribute('value'));
    expect(options).toEqual(['oracle-writer-pw']);

    fireEvent.change(screen.getByLabelText(/Password Secret/i, { selector: 'input' }), {
      target: { name: 'passwordSecret', value: 'oracle-writer-pw' },
    });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ passwordSecret: 'oracle-writer-pw' })
    );

    rerender(
      <MySQLPostgreSQLOracleSQLServerSinkProperties
        node={makeNode({
          databaseType: 'oracle',
          url: 'jdbc:oracle://h:1521/d',
          table: 'orders',
          passwordSecret: 'oracle-writer-pw',
        })}
        onChange={onChange}
      />
    );
    const resolveCheckbox = screen.getByLabelText(/Resolve secret on workers/i, {
      selector: 'input',
    });
    fireEvent.click(resolveCheckbox);
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ resolveOnWorkers: true })
    );

    // Clearing passwordSecret deletes both passwordSecret and resolveOnWorkers
    rerender(
      <MySQLPostgreSQLOracleSQLServerSinkProperties
        node={makeNode({
          databaseType: 'oracle',
          url: 'jdbc:oracle://h:1521/d',
          table: 'orders',
          passwordSecret: 'oracle-writer-pw',
          resolveOnWorkers: true,
        })}
        onChange={onChange}
      />
    );
    fireEvent.change(screen.getByLabelText(/Password Secret/i, { selector: 'input' }), {
      target: { name: 'passwordSecret', value: '' },
    });
    const cleared = onChange.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    expect(cleared).not.toHaveProperty('passwordSecret');
    expect(cleared).not.toHaveProperty('resolveOnWorkers');
  });

  it('switches between table and query writeMode and validates required fields', () => {
    const onChange = vi.fn();
    // Auto-detect query mode when query is set and table is absent
    const { rerender } = render(
      <MySQLPostgreSQLOracleSQLServerSinkProperties
        node={makeNode({
          databaseType: 'sqlserver',
          url: 'jdbc:sqlserver://h:1433/d',
          query: 'INSERT INTO t VALUES (?)',
        })}
        onChange={onChange}
      />
    );

    expect(screen.getByLabelText(/Write Using/i, { selector: 'select' })).toHaveValue('query');
    expect(screen.getByLabelText(/Write Statement/i, { selector: 'textarea' })).toHaveValue(
      'INSERT INTO t VALUES (?)'
    );

    // Switch query -> table: deletes query
    fireEvent.change(screen.getByLabelText(/Write Using/i, { selector: 'select' }), {
      target: { value: 'table' },
    });
    expect(onChange.mock.calls.at(-1)?.[0]).toEqual({
      databaseType: 'sqlserver',
      url: 'jdbc:sqlserver://h:1433/d',
      writeMode: 'table',
    });

    // Switch table -> query: deletes table
    rerender(
      <MySQLPostgreSQLOracleSQLServerSinkProperties
        node={makeNode({
          databaseType: 'sqlserver',
          url: 'jdbc:sqlserver://h:1433/d',
          writeMode: 'table',
          table: 'dbo.orders',
        })}
        onChange={onChange}
      />
    );
    fireEvent.change(screen.getByLabelText(/Write Using/i, { selector: 'select' }), {
      target: { value: 'query' },
    });
    expect(onChange.mock.calls.at(-1)?.[0]).toEqual({
      databaseType: 'sqlserver',
      url: 'jdbc:sqlserver://h:1433/d',
      writeMode: 'query',
    });

    // Render query mode with empty query -> shows error
    rerender(
      <MySQLPostgreSQLOracleSQLServerSinkProperties
        node={makeNode({
          databaseType: 'sqlserver',
          url: 'jdbc:sqlserver://h:1433/d',
          writeMode: 'query',
          query: '   ',
        })}
        onChange={onChange}
      />
    );
    expect(screen.getByText('Either Write Statement or Table must be set.')).toBeInTheDocument();
  });

  it('handles batchSize, autoSharding, connectionProperties, connectionInitSql, and driver fields', () => {
    const onChange = vi.fn();
    render(
      <MySQLPostgreSQLOracleSQLServerSinkProperties
        node={makeNode({
          databaseType: 'mysql',
          url: 'jdbc:mysql://h:3306/d',
          table: 'orders',
          batchSize: 0,
        })}
        onChange={onChange}
      />
    );

    expect(screen.getByText('Batch size must be a whole number ≥ 1.')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Batch Size/i, { selector: 'input' }), {
      target: { name: 'batchSize', value: '500' },
    });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ batchSize: 500 }));

    fireEvent.change(screen.getByLabelText(/Batch Size/i, { selector: 'input' }), {
      target: { name: 'batchSize', value: '' },
    });
    expect(onChange.mock.calls.at(-1)?.[0]).not.toHaveProperty('batchSize');

    fireEvent.click(screen.getByLabelText(/Auto Sharding/i, { selector: 'input' }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ autoSharding: true }));

    fireEvent.change(screen.getByLabelText(/Username/i, { selector: 'input' }), {
      target: { name: 'username', value: 'writer' },
    });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ username: 'writer' }));

    fireEvent.change(screen.getByLabelText(/Connection Properties/i, { selector: 'input' }), {
      target: { name: 'connectionProperties', value: 'characterEncoding=UTF-8;' },
    });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ connectionProperties: 'characterEncoding=UTF-8;' })
    );

    const initSqlInput = screen.getByLabelText(/Connection Init SQL/i, {
      selector: 'textarea',
    });
    fireEvent.change(initSqlInput, {
      target: { name: 'connectionInitSql', value: 'SET sql_mode=ANSI_QUOTES' },
    });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ connectionInitSql: ['SET sql_mode=ANSI_QUOTES'] })
    );
    fireEvent.change(initSqlInput, {
      target: { name: 'connectionInitSql', value: '  ' },
    });
    expect(onChange.mock.calls.at(-1)?.[0]).not.toHaveProperty('connectionInitSql');

    fireEvent.change(screen.getByLabelText(/Driver Class Name/i, { selector: 'input' }), {
      target: { name: 'driverClassName', value: 'com.custom.SinkDriver' },
    });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ driverClassName: 'com.custom.SinkDriver' })
    );

    fireEvent.change(screen.getByLabelText(/Driver JARs/i, { selector: 'input' }), {
      target: { name: 'driverJars', value: 'gs://b/sink.jar' },
    });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ driverJars: 'gs://b/sink.jar' })
    );
  });

  it('resolves system_instructions across all 4 fallback levels and updates on change', () => {
    const onChange = vi.fn();
    const baseProps = {
      databaseType: 'mysql',
      url: 'jdbc:mysql://h:3306/d',
      table: 'orders',
    };

    const { rerender } = render(
      <MySQLPostgreSQLOracleSQLServerSinkProperties
        node={makeNode(baseProps, { system_instructions: 'sink node sys' })}
        onChange={onChange}
      />
    );
    expect(
      screen.getByLabelText(/Code Generation Instructions/i, { selector: 'textarea' })
    ).toHaveValue('sink node sys');

    rerender(
      <MySQLPostgreSQLOracleSQLServerSinkProperties
        node={makeNode(baseProps, { special_instructions: 'sink node spec' })}
        onChange={onChange}
      />
    );
    expect(
      screen.getByLabelText(/Code Generation Instructions/i, { selector: 'textarea' })
    ).toHaveValue('sink node spec');

    rerender(
      <MySQLPostgreSQLOracleSQLServerSinkProperties
        node={makeNode({ ...baseProps, system_instructions: 'sink props sys' })}
        onChange={onChange}
      />
    );
    expect(
      screen.getByLabelText(/Code Generation Instructions/i, { selector: 'textarea' })
    ).toHaveValue('sink props sys');

    rerender(
      <MySQLPostgreSQLOracleSQLServerSinkProperties
        node={makeNode({ ...baseProps, special_instructions: 'sink props spec' })}
        onChange={onChange}
      />
    );
    expect(
      screen.getByLabelText(/Code Generation Instructions/i, { selector: 'textarea' })
    ).toHaveValue('sink props spec');

    fireEvent.change(
      screen.getByLabelText(/Code Generation Instructions/i, { selector: 'textarea' }),
      { target: { name: 'system_instructions', value: 'updated sink sys' } }
    );
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ system_instructions: 'updated sink sys' })
    );
  });

  it('classifies every emitted property key as safe or reference via classifyKey and never emits secret_manager', () => {
    const onChange = vi.fn();
    const allProps = {
      databaseType: 'mysql',
      url: 'jdbc:mysql://h:3306/d',
      username: 'u',
      passwordSecret: 'pw-secret',
      resolveOnWorkers: true,
      writeMode: 'table',
      table: 'orders',
      batchSize: 500,
      autoSharding: true,
      connectionProperties: 'characterEncoding=UTF-8;',
      connectionInitSql: ['SET a=1'],
      driverClassName: 'com.mysql.cj.jdbc.Driver',
      driverJars: 'gs://b/d.jar',
    };

    render(
      <MySQLPostgreSQLOracleSQLServerSinkProperties
        node={makeNode(allProps)}
        onChange={onChange}
      />
    );

    fireEvent.change(
      screen.getByLabelText(/Code Generation Instructions/i, { selector: 'textarea' }),
      { target: { name: 'system_instructions', value: 'custom' } }
    );

    const emitted = onChange.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    expect(emitted).not.toHaveProperty('password');
    expect(emitted).not.toHaveProperty('secret_manager');
    expect(emitted).not.toHaveProperty('secretManager');
    expect(emitted).not.toHaveProperty('jdbcType');

    for (const key of Object.keys(emitted)) {
      const cls = classifyKey(key);
      expect(['safe', 'reference']).toContain(cls);
    }
    expect(classifyKey('passwordSecret')).toBe('reference');
    expect(classifyKey('resolveOnWorkers')).toBe('safe');
  });
});
