/**
 * MySQL / PostgreSQL / Oracle / SQL Server (Beam YAML) Source Properties Unit Tests (IO79)
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Exercises 100% of statements, branches, functions, and lines in
 * `webview/src/properties/source/MySQLPostgreSQLOracleSQLServer.tsx`, including
 * per-flavor rendering/switching, SecretManagerSecretField + resolveOnWorkers toggle,
 * query/table readMode + partitioning, MySQL useCursorFetch validation, external doc links,
 * `classifyKey` redaction hygiene, and static validation of `src/test/integration/multidb-yaml.beam`.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  MySQLPostgreSQLOracleSQLServerSourceProperties,
  YAML_DOC_BASE,
} from './MySQLPostgreSQLOracleSQLServer';
import type { DatabaseType } from './MySQLPostgreSQLOracleSQLServer';
import { classifyKey, redactPipelineYaml } from '../../../../src/credentialRedaction';

const FLAVOR_EXPECTATIONS: Array<{
  value: DatabaseType;
  readTransform: string;
  exampleUrl: string;
  driver: string;
  supportsInitSql: boolean;
  forcesAutoCommitDisabled: boolean;
}> = [
  {
    value: 'mysql',
    readTransform: 'ReadFromMySql',
    exampleUrl: 'jdbc:mysql://my-host:3306/database',
    driver: 'com.mysql.cj.jdbc.Driver',
    supportsInitSql: true,
    forcesAutoCommitDisabled: false,
  },
  {
    value: 'postgres',
    readTransform: 'ReadFromPostgres',
    exampleUrl: 'jdbc:postgresql://my-host:5432/database',
    driver: 'org.postgresql.Driver',
    supportsInitSql: false,
    forcesAutoCommitDisabled: true,
  },
  {
    value: 'oracle',
    readTransform: 'ReadFromOracle',
    exampleUrl: 'jdbc:oracle://my-host:1521/database',
    driver: 'oracle.jdbc.driver.OracleDriver',
    supportsInitSql: false,
    forcesAutoCommitDisabled: false,
  },
  {
    value: 'sqlserver',
    readTransform: 'ReadFromSqlServer',
    exampleUrl: 'jdbc:sqlserver://my-host:1433/database',
    driver: 'com.microsoft.sqlserver.jdbc.SQLServerDriver',
    supportsInitSql: false,
    forcesAutoCommitDisabled: false,
  },
];

describe('MySQLPostgreSQLOracleSQLServerSourceProperties (IO79)', () => {
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
      type: 'SOURCE',
      beam_transform: 'MySQLPostgreSQLOracleSQLServer',
      ...(props !== undefined ? { properties: props } : {}),
      ...extraData,
    },
  });

  describe('component rendering & validation', () => {
    it('renders default state (MySQL, query mode) with undefined properties and required errors', () => {
      const { container } = render(
        <MySQLPostgreSQLOracleSQLServerSourceProperties
          node={makeNode(undefined)}
          onChange={vi.fn()}
        />
      );

      expect(screen.getByText('ReadFromMySql')).toBeInTheDocument();
      expect(screen.getByText('JDBC URL cannot be blank')).toBeInTheDocument();
      expect(screen.getByText('Either Query or Table must be specified.')).toBeInTheDocument();
      expect(
        screen.getByLabelText(/Connection Init SQL/i, { selector: 'textarea' })
      ).toBeInTheDocument();
      expect(screen.queryByLabelText(/Resolve secret on workers/i)).toBeNull();
      expect(mockPostMessage).toHaveBeenCalledWith({ command: 'getSecrets' });
      expect(container.querySelector('input[type="password"]')).toBeNull();
    });

    it('validates embedded URL passwords and connectionProperties credentials', () => {
      const { rerender } = render(
        <MySQLPostgreSQLOracleSQLServerSourceProperties
          node={makeNode({
            databaseType: 'mysql',
            url: 'jdbc:mysql://host/db?user=u&password=secret',
            query: 'SELECT 1',
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
        <MySQLPostgreSQLOracleSQLServerSourceProperties
          node={makeNode({
            databaseType: 'postgres',
            url: 'jdbc:postgresql://user:secret@host:5432/db',
            query: 'SELECT 1',
            connectionProperties: 'ssl=true; user=admin',
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
    });

    it('opens Beam YAML transform documentation via Docs ↗ and handles missing vscode API', () => {
      const { rerender } = render(
        <MySQLPostgreSQLOracleSQLServerSourceProperties
          node={makeNode({ databaseType: 'mysql', url: 'jdbc:mysql://h:3306/d', query: 'SELECT 1' })}
          onChange={vi.fn()}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: 'Open ReadFromMySql documentation' }));
      expect(mockPostMessage).toHaveBeenCalledWith({
        command: 'openExternal',
        url: `${YAML_DOC_BASE}#readfrommysql`,
      });

      rerender(
        <MySQLPostgreSQLOracleSQLServerSourceProperties
          node={makeNode({
            databaseType: 'postgres',
            url: 'jdbc:postgresql://h:5432/d',
            query: 'SELECT 1',
          })}
          onChange={vi.fn()}
        />
      );
      fireEvent.click(screen.getByRole('button', { name: 'Open ReadFromPostgres documentation' }));
      expect(mockPostMessage).toHaveBeenCalledWith({
        command: 'openExternal',
        url: `${YAML_DOC_BASE}#readfrompostgres`,
      });

      mockPostMessage.mockClear();
      delete vscodeWindow.vscode;
      fireEvent.click(screen.getByRole('button', { name: 'Open ReadFromPostgres documentation' }));
      expect(mockPostMessage).not.toHaveBeenCalled();
    });

    it.each(FLAVOR_EXPECTATIONS)(
      'renders flavor-specific UI for $value ($readTransform)',
      (flavor) => {
        render(
          <MySQLPostgreSQLOracleSQLServerSourceProperties
            node={makeNode({
              databaseType: flavor.value,
              url: flavor.exampleUrl,
              query: 'SELECT 1',
            })}
            onChange={vi.fn()}
          />
        );

        expect(screen.getByText(flavor.readTransform)).toBeInTheDocument();
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

        const autoCommitSelect = screen.getByLabelText(/Disable Auto Commit/i, {
          selector: 'select',
        });
        if (flavor.forcesAutoCommitDisabled) {
          expect(autoCommitSelect).toBeDisabled();
          expect(autoCommitSelect).toHaveValue('true');
          expect(screen.getByText('PostgreSQL reads always use true.')).toBeInTheDocument();
        } else {
          expect(autoCommitSelect).not.toBeDisabled();
          expect(autoCommitSelect).toHaveValue('');
        }
      }
    );

    it('cleans up flavor-incompatible keys when switching databaseType', () => {
      const onChange = vi.fn();
      const { rerender } = render(
        <MySQLPostgreSQLOracleSQLServerSourceProperties
          node={makeNode({
            databaseType: 'mysql',
            url: 'jdbc:mysql://h:3306/d',
            query: 'SELECT 1',
            connectionInitSql: ['SET a=1'],
            disableAutoCommit: false,
            outputParallelization: true,
          })}
          onChange={onChange}
        />
      );

      expect(
        screen.getByLabelText(/Output Parallelization/i, { selector: 'select' })
      ).toHaveValue('true');
      expect(
        screen.getByLabelText(/Disable Auto Commit/i, { selector: 'select' })
      ).toHaveValue('false');

      // Switch mysql -> postgres: deletes connectionInitSql AND disableAutoCommit
      fireEvent.change(screen.getByLabelText(/^Database/i, { selector: 'select' }), {
        target: { value: 'postgres' },
      });
      const pgPayload = onChange.mock.calls.at(-1)?.[0];
      expect(pgPayload).toEqual({
        databaseType: 'postgres',
        url: 'jdbc:mysql://h:3306/d',
        query: 'SELECT 1',
        outputParallelization: true,
      });

      // Switch mysql -> oracle: deletes connectionInitSql, keeps disableAutoCommit
      fireEvent.change(screen.getByLabelText(/^Database/i, { selector: 'select' }), {
        target: { value: 'oracle' },
      });
      expect(onChange.mock.calls.at(-1)?.[0]).toEqual({
        databaseType: 'oracle',
        url: 'jdbc:mysql://h:3306/d',
        query: 'SELECT 1',
        disableAutoCommit: false,
        outputParallelization: true,
      });

      // Switch oracle -> mysql: deletes nothing
      rerender(
        <MySQLPostgreSQLOracleSQLServerSourceProperties
          node={makeNode({
            databaseType: 'oracle',
            url: 'jdbc:oracle://h:1521/d',
            query: 'SELECT 1',
            disableAutoCommit: false,
          })}
          onChange={onChange}
        />
      );
      fireEvent.change(screen.getByLabelText(/^Database/i, { selector: 'select' }), {
        target: { value: 'mysql' },
      });
      expect(onChange.mock.calls.at(-1)?.[0]).toEqual({
        databaseType: 'mysql',
        url: 'jdbc:oracle://h:1521/d',
        query: 'SELECT 1',
        disableAutoCommit: false,
      });
    });

    it('renders URL scheme warning without marking URL invalid, and handles secret + resolveOnWorkers lifecycle', () => {
      const onChange = vi.fn();
      const { rerender } = render(
        <MySQLPostgreSQLOracleSQLServerSourceProperties
          node={makeNode({
            databaseType: 'sqlserver',
            url: 'jdbc:mysql://h:3306/d',
            query: 'SELECT 1',
          })}
          onChange={onChange}
        />
      );

      expect(
        screen.getByText(/URL does not look like a SQL Server JDBC URL/i)
      ).toBeInTheDocument();
      expect(screen.getByLabelText(/JDBC URL/i, { selector: 'input' })).toHaveAttribute(
        'aria-invalid',
        'false'
      );

      // Load secrets and select passwordSecret
      act(() => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: { command: 'secretsLoaded', secrets: ['pg-reader-pw'] },
          })
        );
      });
      const options = Array.from(
        document.querySelectorAll('#multidb-source-secrets-list option')
      ).map((o) => o.getAttribute('value'));
      expect(options).toEqual(['pg-reader-pw']);

      fireEvent.change(screen.getByLabelText(/Password Secret/i, { selector: 'input' }), {
        target: { name: 'passwordSecret', value: 'pg-reader-pw' },
      });
      expect(onChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ passwordSecret: 'pg-reader-pw' })
      );

      // Re-render with passwordSecret set -> resolveOnWorkers checkbox appears
      rerender(
        <MySQLPostgreSQLOracleSQLServerSourceProperties
          node={makeNode({
            databaseType: 'sqlserver',
            url: 'jdbc:sqlserver://h:1433/d',
            query: 'SELECT 1',
            passwordSecret: 'pg-reader-pw',
          })}
          onChange={onChange}
        />
      );
      expect(screen.getByText('GoogleCloudSecretManager')).toBeInTheDocument();
      const resolveCheckbox = screen.getByLabelText(/Resolve secret on workers/i, {
        selector: 'input',
      });
      expect(resolveCheckbox).not.toBeChecked();

      fireEvent.click(resolveCheckbox);
      expect(onChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ resolveOnWorkers: true })
      );

      // Clearing passwordSecret deletes both passwordSecret and resolveOnWorkers
      rerender(
        <MySQLPostgreSQLOracleSQLServerSourceProperties
          node={makeNode({
            databaseType: 'sqlserver',
            url: 'jdbc:sqlserver://h:1433/d',
            query: 'SELECT 1',
            passwordSecret: 'pg-reader-pw',
            resolveOnWorkers: true,
          })}
          onChange={onChange}
        />
      );
      fireEvent.change(screen.getByLabelText(/Password Secret/i, { selector: 'input' }), {
        target: { name: 'passwordSecret', value: '   ' },
      });
      const cleared = onChange.mock.calls.at(-1)?.[0] as Record<string, unknown>;
      expect(cleared).not.toHaveProperty('passwordSecret');
      expect(cleared).not.toHaveProperty('resolveOnWorkers');
    });

    it('switches between query and table readMode and manages partitioning fields', () => {
      const onChange = vi.fn();
      // Auto-detect table mode when table is set and query is absent
      const { rerender } = render(
        <MySQLPostgreSQLOracleSQLServerSourceProperties
          node={makeNode({
            databaseType: 'postgres',
            url: 'jdbc:postgresql://h:5432/d',
            table: 'public.orders',
          })}
          onChange={onChange}
        />
      );

      expect(screen.getByLabelText(/Read From/i, { selector: 'select' })).toHaveValue('table');
      expect(screen.getByLabelText(/^Table/i, { selector: 'input' })).toHaveValue('public.orders');
      expect(
        screen.getByLabelText(/Number of Partitions/i, { selector: 'input' })
      ).toBeDisabled();

      // Set partitionColumn
      fireEvent.change(screen.getByLabelText(/Partition Column/i, { selector: 'input' }), {
        target: { name: 'partitionColumn', value: 'order_id' },
      });
      expect(onChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ partitionColumn: 'order_id' })
      );

      // Re-render with partitionColumn set and invalid numPartitions
      rerender(
        <MySQLPostgreSQLOracleSQLServerSourceProperties
          node={makeNode({
            databaseType: 'postgres',
            url: 'jdbc:postgresql://h:5432/d',
            readMode: 'table',
            table: '',
            partitionColumn: 'order_id',
            numPartitions: 0,
          })}
          onChange={onChange}
        />
      );
      expect(screen.getByText('Either Query or Table must be specified.')).toBeInTheDocument();
      expect(
        screen.getByText('Number of partitions must be a whole number ≥ 1.')
      ).toBeInTheDocument();
      expect(screen.getByText('Ignored for partitioned reads.')).toBeInTheDocument();
      expect(
        screen.getByLabelText(/Output Parallelization/i, { selector: 'select' })
      ).toBeDisabled();

      // Change numPartitions to valid number, then clear it
      fireEvent.change(screen.getByLabelText(/Number of Partitions/i, { selector: 'input' }), {
        target: { name: 'numPartitions', value: '8' },
      });
      expect(onChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ numPartitions: 8 })
      );

      fireEvent.change(screen.getByLabelText(/Number of Partitions/i, { selector: 'input' }), {
        target: { name: 'numPartitions', value: '' },
      });
      expect(onChange.mock.calls.at(-1)?.[0]).not.toHaveProperty('numPartitions');

      // Clearing partitionColumn deletes both partitionColumn and numPartitions
      fireEvent.change(screen.getByLabelText(/Partition Column/i, { selector: 'input' }), {
        target: { name: 'partitionColumn', value: '  ' },
      });
      expect(onChange.mock.calls.at(-1)?.[0]).not.toHaveProperty('partitionColumn');
      expect(onChange.mock.calls.at(-1)?.[0]).not.toHaveProperty('numPartitions');

      // Switch table -> query: deletes table, partitionColumn, numPartitions
      fireEvent.change(screen.getByLabelText(/Read From/i, { selector: 'select' }), {
        target: { value: 'query' },
      });
      const queryModePayload = onChange.mock.calls.at(-1)?.[0];
      expect(queryModePayload).toHaveProperty('readMode', 'query');
      expect(queryModePayload).not.toHaveProperty('table');
      expect(queryModePayload).not.toHaveProperty('partitionColumn');
      expect(queryModePayload).not.toHaveProperty('numPartitions');

      // Switch query -> table: deletes query
      rerender(
        <MySQLPostgreSQLOracleSQLServerSourceProperties
          node={makeNode({
            databaseType: 'postgres',
            url: 'jdbc:postgresql://h:5432/d',
            readMode: 'query',
            query: 'SELECT 1',
          })}
          onChange={onChange}
        />
      );
      fireEvent.change(screen.getByLabelText(/Read From/i, { selector: 'select' }), {
        target: { value: 'table' },
      });
      expect(onChange.mock.calls.at(-1)?.[0]).toEqual({
        databaseType: 'postgres',
        url: 'jdbc:postgresql://h:5432/d',
        readMode: 'table',
      });
    });

    it('enforces MySQL useCursorFetch=true rule on fetchSize and handles tri-state, initSql, and driver fields', () => {
      const onChange = vi.fn();
      const { rerender } = render(
        <MySQLPostgreSQLOracleSQLServerSourceProperties
          node={makeNode({
            databaseType: 'mysql',
            url: 'jdbc:mysql://h:3306/d',
            query: 'SELECT 1',
            fetchSize: 500,
          })}
          onChange={onChange}
        />
      );

      expect(
        screen.getByText(
          'It is required to set useCursorFetch=true in the JDBC URL when using fetchSize for MySQL'
        )
      ).toBeInTheDocument();

      // Invalid integer fetchSize shows positiveIntError first
      rerender(
        <MySQLPostgreSQLOracleSQLServerSourceProperties
          node={makeNode({
            databaseType: 'mysql',
            url: 'jdbc:mysql://h:3306/d',
            query: 'SELECT 1',
            fetchSize: 0,
          })}
          onChange={onChange}
        />
      );
      expect(screen.getByText('Fetch size must be a whole number ≥ 1.')).toBeInTheDocument();

      // With useCursorFetch=true in URL, error disappears
      rerender(
        <MySQLPostgreSQLOracleSQLServerSourceProperties
          node={makeNode({
            databaseType: 'mysql',
            url: 'jdbc:mysql://h:3306/d?useCursorFetch=true',
            query: 'SELECT 1',
            fetchSize: 500,
            connectionInitSql: ['SET a=1'],
          })}
          onChange={onChange}
        />
      );
      expect(screen.queryByRole('alert')).toBeNull();

      // Tri-state selects: outputParallelization & disableAutoCommit
      const outParSelect = screen.getByLabelText(/Output Parallelization/i, {
        selector: 'select',
      });
      fireEvent.change(outParSelect, { target: { name: 'outputParallelization', value: 'true' } });
      expect(onChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ outputParallelization: true })
      );
      fireEvent.change(outParSelect, { target: { name: 'outputParallelization', value: 'false' } });
      expect(onChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ outputParallelization: false })
      );
      fireEvent.change(outParSelect, { target: { name: 'outputParallelization', value: '' } });
      expect(onChange.mock.calls.at(-1)?.[0]).not.toHaveProperty('outputParallelization');

      const autoCommitSelect = screen.getByLabelText(/Disable Auto Commit/i, {
        selector: 'select',
      });
      fireEvent.change(autoCommitSelect, { target: { name: 'disableAutoCommit', value: 'false' } });
      expect(onChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ disableAutoCommit: false })
      );

      // Connection Init SQL: update and clear
      const initSqlInput = screen.getByLabelText(/Connection Init SQL/i, {
        selector: 'textarea',
      });
      fireEvent.change(initSqlInput, {
        target: { name: 'connectionInitSql', value: 'SET x=1\nSET y=2' },
      });
      expect(onChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ connectionInitSql: ['SET x=1', 'SET y=2'] })
      );
      fireEvent.change(initSqlInput, {
        target: { name: 'connectionInitSql', value: '   \n  ' },
      });
      expect(onChange.mock.calls.at(-1)?.[0]).not.toHaveProperty('connectionInitSql');

      // Username, connectionProperties, driverClassName, driverJars
      fireEvent.change(screen.getByLabelText(/Username/i, { selector: 'input' }), {
        target: { name: 'username', value: 'reader' },
      });
      expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ username: 'reader' }));

      fireEvent.change(screen.getByLabelText(/Connection Properties/i, { selector: 'input' }), {
        target: { name: 'connectionProperties', value: 'useSSL=true;' },
      });
      expect(onChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ connectionProperties: 'useSSL=true;' })
      );

      fireEvent.change(screen.getByLabelText(/Driver Class Name/i, { selector: 'input' }), {
        target: { name: 'driverClassName', value: 'com.custom.Driver' },
      });
      expect(onChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ driverClassName: 'com.custom.Driver' })
      );

      fireEvent.change(screen.getByLabelText(/Driver JARs/i, { selector: 'input' }), {
        target: { name: 'driverJars', value: 'gs://b/d.jar' },
      });
      expect(onChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ driverJars: 'gs://b/d.jar' })
      );
    });

    it('resolves system_instructions across all 4 fallback levels and updates on change', () => {
      const onChange = vi.fn();
      const baseProps = {
        databaseType: 'mysql',
        url: 'jdbc:mysql://h:3306/d',
        query: 'SELECT 1',
      };

      const { rerender } = render(
        <MySQLPostgreSQLOracleSQLServerSourceProperties
          node={makeNode(baseProps, { system_instructions: 'node sys' })}
          onChange={onChange}
        />
      );
      expect(
        screen.getByLabelText(/Code Generation Instructions/i, { selector: 'textarea' })
      ).toHaveValue('node sys');

      rerender(
        <MySQLPostgreSQLOracleSQLServerSourceProperties
          node={makeNode(baseProps, { special_instructions: 'node spec' })}
          onChange={onChange}
        />
      );
      expect(
        screen.getByLabelText(/Code Generation Instructions/i, { selector: 'textarea' })
      ).toHaveValue('node spec');

      rerender(
        <MySQLPostgreSQLOracleSQLServerSourceProperties
          node={makeNode({ ...baseProps, system_instructions: 'props sys' })}
          onChange={onChange}
        />
      );
      expect(
        screen.getByLabelText(/Code Generation Instructions/i, { selector: 'textarea' })
      ).toHaveValue('props sys');

      rerender(
        <MySQLPostgreSQLOracleSQLServerSourceProperties
          node={makeNode({ ...baseProps, special_instructions: 'props spec' })}
          onChange={onChange}
        />
      );
      expect(
        screen.getByLabelText(/Code Generation Instructions/i, { selector: 'textarea' })
      ).toHaveValue('props spec');

      fireEvent.change(
        screen.getByLabelText(/Code Generation Instructions/i, { selector: 'textarea' }),
        { target: { name: 'system_instructions', value: 'updated sys' } }
      );
      expect(onChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ system_instructions: 'updated sys' })
      );
    });

    it('classifies every emitted property key as safe or reference via classifyKey and never emits secret_manager', () => {
      const onChange = vi.fn();
      const allProps = {
        databaseType: 'mysql',
        url: 'jdbc:mysql://h:3306/d?useCursorFetch=true',
        username: 'u',
        passwordSecret: 'pw-secret',
        resolveOnWorkers: true,
        readMode: 'table',
        table: 'orders',
        partitionColumn: 'id',
        numPartitions: 4,
        fetchSize: 1000,
        outputParallelization: true,
        disableAutoCommit: true,
        connectionProperties: 'characterEncoding=UTF-8;',
        connectionInitSql: ['SET a=1'],
        driverClassName: 'com.mysql.cj.jdbc.Driver',
        driverJars: 'gs://b/d.jar',
      };

      render(
        <MySQLPostgreSQLOracleSQLServerSourceProperties
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

    it('validates src/test/integration/sources/java/multidb-yaml-source.beam fixture with zero redactions and safe/reference keys', () => {
      const beamPath = path.resolve(
        __dirname,
        '../../../../src/test/integration/sources/java/multidb-yaml-source.beam'
      );
      const rawYaml = fs.readFileSync(beamPath, 'utf-8');
      const redaction = redactPipelineYaml(rawYaml);
      expect(redaction.redactedPaths).toEqual([]);

      const parsed = yaml.parse(rawYaml) as {
        nodes: Array<{ properties?: Record<string, unknown> }>;
      };
      expect(parsed.nodes.length).toBeGreaterThanOrEqual(3);
      for (const node of parsed.nodes) {
        for (const key of Object.keys(node.properties || {})) {
          expect(['safe', 'reference']).toContain(classifyKey(key));
        }
      }
    });
  });
});
