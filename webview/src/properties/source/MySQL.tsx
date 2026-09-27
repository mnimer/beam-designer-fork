/**
 * MySQL Source Properties Component (IO75)
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Renders the property configuration panel for MySQL Source (`ReadFromMySQL`) nodes in
 * Apache Beam Python pipelines, traced to `esakik/beam-mysql-connector` v1.8.6
 * (`beam_mysql/connector/io.py`, `splitters.py`, `client.py`, `README.md`).
 *
 * Documentation Traceability:
 * - README: https://github.com/esakik/beam-mysql-connector#getting-started
 * - ReadFromMySQL(query, host, database, user, password, port=3306, splitter=NoSplitter()):
 *   https://github.com/esakik/beam-mysql-connector/blob/master/beam_mysql/connector/io.py#L17-L28
 * - Splitters (NoSplitter, LimitOffsetSplitter, IdsSplitter, PartitionSplitter, DateSplitter):
 *   https://github.com/esakik/beam-mysql-connector/blob/master/beam_mysql/connector/splitters.py
 * - Client SELECT validation & mysql-connector-python config:
 *   https://github.com/esakik/beam-mysql-connector/blob/master/beam_mysql/connector/client.py#L170-L200
 *
 * Architectural Decisions:
 * - Enforces R3: replaces plaintext `password` with `passwordSecret` via `SecretManagerSecretField`.
 * - Mirrors upstream query-shape validation for SELECT statements (allowing leading CTEs and SQL comments)
 *   and splitter-specific query constraints (`IdsSplitter`, `PartitionSplitter`, `DateSplitter`).
 * - Cleans up conditional splitter parameters (`splitterBatchSize`, `generateIdsFn`) when switching splitters
 *   so stale keys do not leak into the pipeline YAML.
 */

import React from 'react';
import { InfoTooltip } from '../../components/InfoTooltip';
import { PropertyField } from '../../components/common/PropertyField';
import { SecretManagerSecretField } from '../../components/common/SecretManagerSecretField';

export const MYSQL_DOC_URL = 'https://github.com/esakik/beam-mysql-connector#getting-started';
export const DEFAULT_MYSQL_SPLITTER = 'NoSplitter';

export interface MySQLSplitterOption {
  value: string;
  label: string;
  helperText: string;
}

const MYSQL_SPLITTER_OPTIONS: readonly MySQLSplitterOption[] = [
  {
    value: 'NoSplitter',
    label: 'No splitter (single bundle)',
    helperText: 'No split bounded source so not work parallel.',
  },
  {
    value: 'LimitOffsetSplitter',
    label: 'Limit / Offset',
    helperText: 'Split bounded source by limit and offset.',
  },
  {
    value: 'IdsSplitter',
    label: 'IDs',
    helperText: 'Split bounded source by any ids.',
  },
  {
    value: 'PartitionSplitter',
    label: 'Partitions',
    helperText: 'Split bounded source by partitions.',
  },
  {
    value: 'DateSplitter',
    label: 'Date range (monthly)',
    helperText: 'Split bounded source by dates.',
  },
];

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
 * Validates an optional positive integer property (e.g. `splitterBatchSize`).
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
 * Checks whether a SQL query starts with a SELECT statement after stripping SQL comments
 * and a leading `WITH ... AS (...)` CTE, matching `beam_mysql/connector/client.py:176-200`.
 */
function isSelectQuery(query: string): boolean {
  const cleansed = query
    .replace(/--.*\n/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\n/g, ' ')
    .replace(/WITH\s+(?:\w+\s+AS\s+\(.+?\)\s*,?\s*)+/gi, '')
    .trim();
  return cleansed.toLowerCase().startsWith('select');
}

/**
 * Validates splitter-specific SQL query rules from `beam_mysql/connector/splitters.py`.
 */
function getSplitterQueryError(splitter: string, query: string): string | null {
  if (splitter === 'IdsSplitter') {
    const condensed = query.toLowerCase().replace(/\s+/g, '');
    if (/notin\(\{ids\}\)/.test(condensed)) {
      return 'IdsSplitter does not support NOT IN ({ids}).';
    }
    if (!/in\(\{ids\}\)/.test(condensed)) {
      return 'Query must contain an IN ({ids}) clause, e.g. SELECT * FROM tests WHERE id IN ({ids})';
    }
    return null;
  }
  if (splitter === 'PartitionSplitter') {
    if (!/\((,?p\d{6})+\)/.test(query)) {
      return 'Query must list partitions named p + 6 digits, e.g. SELECT * FROM tests PARTITION (p202001,p202002)';
    }
    return null;
  }
  if (splitter === 'DateSplitter') {
    if (!/['"]*(\d{4}-\d{2}-\d{2})['"]*[\w\s]+['"]*(\d{4}-\d{2}-\d{2})['"]*/.test(query)) {
      return "Query must contain a date range, e.g. SELECT * FROM tests WHERE date BETWEEN '2019-01-01' AND '2020-01-01'";
    }
    return null;
  }
  return null;
}

/**
 * Validates the source SQL query (`query`) in priority order: non-empty, SELECT statement, splitter rule.
 */
function validateSourceQuery(query: string, splitter: string): string | null {
  if (!query.trim()) {
    return 'Query is required.';
  }
  if (!isSelectQuery(query)) {
    return 'Query must be a SELECT statement (a leading WITH … AS (…) CTE and comments are allowed).';
  }
  return getSplitterQueryError(splitter, query);
}

/**
 * Returns the upstream docstring helper text for the selected splitter.
 */
function getSplitterHelperText(splitter: string): string {
  const found = MYSQL_SPLITTER_OPTIONS.find((opt) => opt.value === splitter);
  return found ? found.helperText : MYSQL_SPLITTER_OPTIONS[0].helperText;
}

export interface MySQLSourcePropertiesProps {
  node: {
    data: {
      properties?: {
        host?: string;
        port?: string;
        database?: string;
        user?: string;
        passwordSecret?: string;
        query?: string;
        splitter?: string;
        splitterBatchSize?: string;
        generateIdsFn?: string;
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

export const MySQLSourceProperties: React.FC<MySQLSourcePropertiesProps> = ({ node, onChange }) => {
  const properties = node.data.properties || {};

  const host = properties.host || '';
  const port = properties.port || '';
  const database = properties.database || '';
  const user = properties.user || '';
  const passwordSecret = properties.passwordSecret || '';
  const query = properties.query || '';
  const splitter = properties.splitter || DEFAULT_MYSQL_SPLITTER;
  const splitterBatchSize = properties.splitterBatchSize || '';
  const generateIdsFn = properties.generateIdsFn || '';

  const hostError = validateHost(host);
  const portError = validatePort(port);
  const databaseError = !database.trim() ? 'Database is required.' : null;
  const userError = !user.trim() ? 'User is required.' : null;
  const passwordSecretError = !passwordSecret.trim() ? 'Password secret is required.' : null;
  const queryError = validateSourceQuery(query, splitter);

  const showBatchSize = splitter === 'LimitOffsetSplitter' || splitter === 'IdsSplitter';
  const showGenerateIdsFn = splitter === 'IdsSplitter';

  const splitterBatchSizeError = showBatchSize
    ? validatePositiveInt(splitterBatchSize, 'Splitter batch size')
    : null;
  const generateIdsFnError =
    showGenerateIdsFn && !generateIdsFn.trim()
      ? 'A Python callable that returns the ids is required for IdsSplitter.'
      : null;

  const splitterBatchSizeTooltip =
    splitter === 'IdsSplitter'
      ? 'Number of ids substituted into {ids} per bundle (IdsSplitter(batch_size)). Defaults to 1,000,000.'
      : 'Rows per LIMIT/OFFSET bundle (LimitOffsetSplitter(batch_size)). Defaults to 1,000,000. Upstream note: LimitOffsetSplitter wraps the query as a subquery and counts rows before splitting.';

  const systemInstructions =
    node.data.system_instructions ??
    node.data.special_instructions ??
    properties.system_instructions ??
    properties.special_instructions ??
    '';

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const newProperties: Record<string, unknown> = {
      ...properties,
      [name]: value,
    };

    if (name === 'splitter') {
      if (value !== 'LimitOffsetSplitter' && value !== 'IdsSplitter') {
        delete newProperties.splitterBatchSize;
      }
      if (value !== 'IdsSplitter') {
        delete newProperties.generateIdsFn;
      }
    }

    onChange(newProperties);
  };

  const handleInstructionsChange = (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    onChange({
      ...properties,
      system_instructions: e.target.value,
    });
  };

  const handleOpenDocs = () => {
    const vscodeApi = (window as unknown as { vscode?: { postMessage: (msg: unknown) => void } }).vscode;
    if (vscodeApi) {
      vscodeApi.postMessage({ command: 'openExternal', url: MYSQL_DOC_URL });
    }
  };

  return (
    <div className="flex-1 flex flex-col gap-4">
      {/* Header & Documentation Link */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase text-slate-400">MySQL Source (ReadFromMySQL)</span>
        <button
          type="button"
          onClick={handleOpenDocs}
          className="text-xs text-blue-400 hover:text-blue-300 underline focus:outline-none"
          aria-label="Open MySQL connector documentation"
        >
          Docs ↗
        </button>
      </div>

      {/* Host */}
      <PropertyField
        id="mysqlSourceHost"
        name="host"
        label="Host"
        required
        tooltip="MySQL server hostname or IP address, passed as `host` to ReadFromMySQL (mysql-connector-python). For Cloud SQL, use the instance's private or public IP."
        value={host}
        invalid={Boolean(hostError)}
        error={hostError}
        onChange={handleChange}
        placeholder="10.0.0.5 or mysql.example.com"
        mono
      />

      {/* Port */}
      <PropertyField
        id="mysqlSourcePort"
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
        id="mysqlSourceDatabase"
        name="database"
        label="Database"
        required
        tooltip="Name of the MySQL database (schema) to connect to (`database`)."
        value={database}
        invalid={Boolean(databaseError)}
        error={databaseError}
        onChange={handleChange}
        placeholder="my_database"
      />

      {/* User */}
      <PropertyField
        id="mysqlSourceUser"
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
        id="mysqlSourcePasswordSecret"
        name="passwordSecret"
        label="Password Secret"
        required
        tooltip="Short ID of the Google Cloud Secret Manager secret holding the MySQL password. Generated code resolves it at runtime and passes it as `password`; the password is never stored in the pipeline."
        value={passwordSecret}
        invalid={Boolean(passwordSecretError)}
        error={passwordSecretError}
        onChange={handleChange}
        placeholder="e.g. my-mysql-password"
        datalistId="mysql-source-secret-options"
      />

      {/* Query */}
      <PropertyField
        id="mysqlSourceQuery"
        name="query"
        label="Query"
        type="textarea"
        rows={4}
        required
        tooltip="SQL SELECT statement to read (`query`). The connector rejects non-SELECT statements; a trailing ';' is ignored."
        value={query}
        invalid={Boolean(queryError)}
        error={queryError}
        onChange={handleChange}
        placeholder="SELECT * FROM my_database.my_table"
        mono
      />

      {/* Splitter */}
      <div className="flex flex-col gap-2">
        <label htmlFor="mysqlSourceSplitter" className="flex items-center text-xs font-bold uppercase text-slate-500">
          <span>Splitter</span>
          <InfoTooltip text="How the query is split for parallel reads (`splitter`). Default NoSplitter reads the whole result in one bundle (no parallelism)." />
        </label>
        <select
          id="mysqlSourceSplitter"
          name="splitter"
          value={splitter}
          onChange={handleChange}
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
        >
          {MYSQL_SPLITTER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <span className="text-xs text-slate-400">{getSplitterHelperText(splitter)}</span>
      </div>

      {/* Conditional Splitter Batch Size */}
      {showBatchSize && (
        <PropertyField
          id="mysqlSourceSplitterBatchSize"
          name="splitterBatchSize"
          label="Splitter Batch Size"
          type="number"
          min={1}
          tooltip={splitterBatchSizeTooltip}
          value={splitterBatchSize}
          invalid={Boolean(splitterBatchSizeError)}
          error={splitterBatchSizeError}
          onChange={handleChange}
          placeholder="1000000"
        />
      )}

      {/* Conditional Generate IDs Function (IdsSplitter) */}
      {showGenerateIdsFn && (
        <PropertyField
          id="mysqlSourceGenerateIdsFn"
          name="generateIdsFn"
          label="Generate IDs Function (Python)"
          type="textarea"
          rows={3}
          required
          tooltip="Zero-argument Python callable returning an iterator of ids (`IdsSplitter(generate_ids_fn)`), e.g. `lambda: range(1, 100001)`. Ids are quoted and substituted into the query's IN ({ids}) clause in batches."
          value={generateIdsFn}
          invalid={Boolean(generateIdsFnError)}
          error={generateIdsFnError}
          onChange={handleChange}
          placeholder="lambda: range(1, 100001)"
          mono
        />
      )}

      {/* Flexible Spacer */}
      <div className="flex-1 min-h-4" />

      {/* Code Generation Instructions */}
      <div className="flex flex-col gap-2 pt-2 border-t border-slate-700/60">
        <PropertyField
          id="mysqlSourceSystemInstructions"
          name="system_instructions"
          label="Code Generation Instructions"
          type="textarea"
          value={systemInstructions}
          onChange={handleInstructionsChange}
          placeholder="Enter custom instructions for MySQL source code generation..."
          rows={3}
          mono={false}
        />
      </div>
    </div>
  );
};
