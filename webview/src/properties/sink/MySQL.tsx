/**
 * MySQL Sink Properties Component (IO75)
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Renders the property configuration panel for MySQL Sink (`WriteToMySQL`) nodes in
 * Apache Beam Python pipelines, traced to `esakik/beam-mysql-connector` v1.8.6
 * (`beam_mysql/connector/io.py`, `client.py`, `README.md`).
 *
 * Documentation Traceability:
 * - README: https://github.com/esakik/beam-mysql-connector#getting-started
 * - WriteToMySQL(host, database, table, user, password, port=3306, batch_size=1000):
 *   https://github.com/esakik/beam-mysql-connector/blob/master/beam_mysql/connector/io.py#L53-L64
 * - INSERT statement formatting & dict element handling:
 *   https://github.com/esakik/beam-mysql-connector/blob/master/beam_mysql/connector/io.py#L124-L160
 * - mysql-connector-python connection config:
 *   https://github.com/esakik/beam-mysql-connector/blob/master/beam_mysql/connector/client.py#L170-L175
 *
 * Architectural Decisions:
 * - Enforces R3: replaces plaintext `password` with `passwordSecret` via `SecretManagerSecretField`.
 * - Enforces bare table name validation (`table` must not contain `.`) because upstream formats
 *   `INSERT INTO {database}.{table}(...) VALUES ...;`.
 * - Documents upstream batching and value-interpolation quirks in field tooltips.
 */

import React from 'react';
import { PropertyField } from '../../components/common/PropertyField';
import { SystemInstructionsField } from '../../components/common/SystemInstructionsField';
import { resolveSystemInstructions } from '../../utils/systemInstructions';
import { SecretManagerSecretField } from '../../components/common/SecretManagerSecretField';
import { ExternalDocsLink } from '../../components/common/ExternalDocsLink';
import { useNodeProperties } from '../../hooks/useNodeProperties';

export const MYSQL_DOC_URL = 'https://github.com/esakik/beam-mysql-connector#getting-started';

/**
 * Validates the MySQL server host (`host`).
 */
function validateHost(v: string): string | null {
  const trimmed = v.trim();
  if (!trimmed) {
    return 'Host is required.';
  }
  if (/[\s@/]/.test(trimmed)) {
    return 'Enter a hostname or IP address only (no scheme, credentials, path or spaces).';
  }
  return null;
}

/**
 * Validates the optional MySQL server port (`port`, default 3306).
 */
function validatePort(v: string): string | null {
  const trimmed = v.trim();
  if (!trimmed) {
    return null;
  }
  if (!/^\d+$/.test(trimmed)) {
    return 'Port must be an integer between 1 and 65535.';
  }
  const n = Number(trimmed);
  if (n < 1 || n > 65535) {
    return 'Port must be an integer between 1 and 65535.';
  }
  return null;
}

/**
 * Validates an optional positive integer property (e.g. `batchSize`).
 */
function validatePositiveInt(v: string, label: string): string | null {
  const trimmed = v.trim();
  if (!trimmed) {
    return null;
  }
  if (!/^\d+$/.test(trimmed) || Number(trimmed) < 1) {
    return `${label} must be a positive integer.`;
  }
  return null;
}

/**
 * Validates the bare target table name (`table`).
 */
function validateTable(v: string): string | null {
  const trimmed = v.trim();
  if (!trimmed) {
    return 'Table is required.';
  }
  if (trimmed.includes('.')) {
    return 'Enter the table name only; the connector writes to <database>.<table>.';
  }
  return null;
}

/**
 * Props for the MySQLSinkProperties component.
 */
export interface MySQLSinkPropertiesProps {
  node: {
    data: {
      properties?: {
        host?: string;
        port?: string;
        database?: string;
        table?: string;
        user?: string;
        passwordSecret?: string;
        batchSize?: string;
        system_instructions?: string;
        special_instructions?: string;
        [key: string]: unknown;
      };
      system_instructions?: string;
      special_instructions?: string;
    };
  };
  onChange: (properties: Record<string, unknown>) => void;
}

/**
 * Dedicated property panel for the MySQL sink node. Configures host, database, table, credentials, and batch size.
 *
 * @param props The selected node and the onChange callback used to persist edits.
 */
export const MySQLSinkProperties: React.FC<MySQLSinkPropertiesProps> = ({ node, onChange }) => {
  const { properties, handleChange } = useNodeProperties(node, onChange);

  const host = properties.host || '';
  const port = properties.port || '';
  const database = properties.database || '';
  const table = properties.table || '';
  const user = properties.user || '';
  const passwordSecret = properties.passwordSecret || '';
  const batchSize = properties.batchSize || '';

  const hostError = validateHost(host);
  const portError = validatePort(port);
  const databaseError = !database.trim() ? 'Database is required.' : null;
  const tableError = validateTable(table);
  const userError = !user.trim() ? 'User is required.' : null;
  const passwordSecretError = !passwordSecret.trim() ? 'Password secret is required.' : null;
  const batchSizeError = validatePositiveInt(batchSize, 'Batch size');

  const systemInstructions = resolveSystemInstructions(node);

  return (
    <div className="flex-1 flex flex-col gap-4">
      {/* Header & Documentation Link */}
      <div className="flex flex-col gap-1.5 p-2.5 rounded bg-slate-800/40 border border-slate-700/60 text-xs text-slate-300">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-slate-200">MySQL Sink (WriteToMySQL)</span>
          <ExternalDocsLink
            url={MYSQL_DOC_URL}
            ariaLabel="Open MySQL connector documentation"
            className="text-blue-400 hover:text-blue-300 font-semibold cursor-pointer shrink-0 focus:outline-none"
          />
        </div>
        <p className="text-slate-400">
          Writes batched dictionary records into a MySQL database table (beam-mysql-connector).
        </p>
      </div>

      {/* Host */}
      <PropertyField
        id="mysqlSinkHost"
        name="host"
        label="Host"
        required
        tooltip="MySQL server hostname or IP address, passed as `host` to WriteToMySQL (mysql-connector-python). For Cloud SQL, use the instance's private or public IP."
        value={host}
        invalid={Boolean(hostError)}
        error={hostError}
        onChange={handleChange}
        placeholder="10.0.0.5 or mysql.example.com"
        mono
      />

      {/* Port */}
      <PropertyField
        id="mysqlSinkPort"
        name="port"
        label="Port"
        type="number"
        min={1}
        max={65535}
        tooltip="MySQL server port (`port`). Defaults to 3306 when left blank."
        value={port}
        invalid={Boolean(portError)}
        error={portError}
        onChange={handleChange}
        placeholder="3306"
      />

      {/* Database */}
      <PropertyField
        id="mysqlSinkDatabase"
        name="database"
        label="Database"
        required
        tooltip="MySQL database (schema) containing the target table (`database`). Rows are inserted into `<database>.<table>`."
        value={database}
        invalid={Boolean(databaseError)}
        error={databaseError}
        onChange={handleChange}
        placeholder="my_database"
      />

      {/* Table */}
      <PropertyField
        id="mysqlSinkTable"
        name="table"
        label="Table"
        required
        tooltip="Target table name (`table`), without the database prefix. Input elements must be dicts whose keys are column names; upstream interpolates values into multi-row INSERT statements."
        value={table}
        invalid={Boolean(tableError)}
        error={tableError}
        onChange={handleChange}
        placeholder="my_table"
        helperText={
          <span>
            Sample:{' '}
            <code className="text-slate-300 bg-slate-800/60 px-1 py-0.5 rounded">
              INSERT INTO my_database.my_table (col1, col2) VALUES (…)
            </code>
          </span>
        }
      />

      {/* User */}
      <PropertyField
        id="mysqlSinkUser"
        name="user"
        label="User"
        required
        tooltip="MySQL user name (`user`). The password is read from Secret Manager at runtime."
        value={user}
        invalid={Boolean(userError)}
        error={userError}
        onChange={handleChange}
        placeholder="db_user"
        mono={false}
      />

      {/* Password Secret */}
      <SecretManagerSecretField
        id="mysqlSinkPasswordSecret"
        name="passwordSecret"
        label="Password Secret"
        required
        tooltip="Short ID of the Google Cloud Secret Manager secret holding the MySQL password. Generated code resolves it at runtime and passes it as `password` to WriteToMySQL; the password is never stored in the pipeline."
        value={passwordSecret}
        invalid={Boolean(passwordSecretError)}
        error={passwordSecretError}
        onChange={handleChange}
        placeholder="e.g. my-mysql-password"
        datalistId="mysql-sink-secret-options"
      />

      {/* Batch Size */}
      <PropertyField
        id="mysqlSinkBatchSize"
        name="batchSize"
        label="Batch Size"
        type="number"
        min={1}
        tooltip="`batch_size` of WriteToMySQL (default 1000). Rows are buffered per bundle and written as multi-row INSERT statements (upstream checks distinct column-set count against batch_size and flushes remaining rows at the end of each bundle)."
        value={batchSize}
        invalid={Boolean(batchSizeError)}
        error={batchSizeError}
        onChange={handleChange}
        placeholder="1000"
      />

      {/* Code Generation Instructions */}
      <SystemInstructionsField
        id="mysqlSinkSystemInstructions"
        value={systemInstructions}
        placeholder="Enter custom instructions for MySQL sink code generation..."
        onChange={(value) =>
          onChange({
            ...properties,
            system_instructions: value,
          })
        }
      />
    </div>
  );
};
