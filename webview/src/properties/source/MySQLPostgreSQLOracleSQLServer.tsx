/**
 * MySQL / PostgreSQL / Oracle / SQL Server (Beam YAML) Source Properties Component (IO79)
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Renders the property configuration panel for the multi-database Beam YAML JDBC Source node
 * (`MySQLPostgreSQLOracleSQLServer` -> `ReadFromMySql`, `ReadFromPostgres`, `ReadFromOracle`,
 * `ReadFromSqlServer` in `apache_beam/yaml/standard_io.yaml` and
 * `org.apache.beam.sdk.io.jdbc.JdbcReadSchemaTransformProvider`).
 *
 * Architectural Decisions:
 * - Includes a `databaseType` selector (`mysql` | `postgres` | `oracle` | `sqlserver`) that selects
 *   which Beam YAML transform the node represents and adapts flavor-specific defaults, placeholders,
 *   and upstream validation rules (e.g. `connectionInitSql` only for MySQL; `useCursorFetch=true`
 *   required when `fetchSize` is set on MySQL; `disableAutoCommit` forced to `true` on PostgreSQL).
 * - Credentials (`password`) use exclusively `SecretManagerSecretField` (`passwordSecret`, discovered
 *   via `gcloud secrets list`); no plaintext password mode is offered (R3/D3).
 * - Exposes `resolveOnWorkers` checkbox when `passwordSecret` is set (default unchecked ->
 *   construction-time secret resolution per D5; checked -> worker-time resolution via Beam
 *   `secret_manager: GoogleCloudSecretManager`). The `secret_manager` key is never persisted in
 *   `.beam` properties to avoid triggering credential redaction (`classifyKey` classifies
 *   `secret_manager` as `secret`).
 * - Omitted upstream options: `secret_manager: GoogleCloudHsmGeneratedSecretManager` (generates a
 *   random HSM secret rather than reading an existing database password; R3) and `jdbc_type`
 *   (overridden by each per-flavor schema transform provider).
 * - No `getSqlInstances` discovery is used: Beam YAML JDBC transforms take standard `jdbc:` URLs
 *   rather than Cloud SQL instance connection names (`MILESTONE_DECISIONS.md`).
 */

import React from 'react';
import { InfoTooltip } from '../../components/InfoTooltip';
import { PropertyField } from '../../components/common/PropertyField';
import { SecretManagerSecretField } from '../../components/common/SecretManagerSecretField';

export const YAML_DOC_BASE = 'https://beam.apache.org/releases/yamldoc/current/';

export type DatabaseType = 'mysql' | 'postgres' | 'oracle' | 'sqlserver';

export interface DbFlavor {
  value: DatabaseType;
  label: string;
  readTransform: string;
  writeTransform: string;
  anchor: string;
  urlScheme: string;
  defaultPort: number;
  supportsInitSql: boolean;
  forcesAutoCommitDisabled: boolean;
  fetchSizeNeedsCursorFetch: boolean;
}

const DB_FLAVORS: DbFlavor[] = [
  {
    value: 'mysql',
    label: 'MySQL',
    readTransform: 'ReadFromMySql',
    writeTransform: 'WriteToMySql',
    anchor: 'mysql',
    urlScheme: 'mysql',
    defaultPort: 3306,
    supportsInitSql: true,
    forcesAutoCommitDisabled: false,
    fetchSizeNeedsCursorFetch: true,
  },
  {
    value: 'postgres',
    label: 'PostgreSQL',
    readTransform: 'ReadFromPostgres',
    writeTransform: 'WriteToPostgres',
    anchor: 'postgres',
    urlScheme: 'postgresql',
    defaultPort: 5432,
    supportsInitSql: false,
    forcesAutoCommitDisabled: true,
    fetchSizeNeedsCursorFetch: false,
  },
  {
    value: 'oracle',
    label: 'Oracle',
    readTransform: 'ReadFromOracle',
    writeTransform: 'WriteToOracle',
    anchor: 'oracle',
    urlScheme: 'oracle',
    defaultPort: 1521,
    supportsInitSql: false,
    forcesAutoCommitDisabled: false,
    fetchSizeNeedsCursorFetch: false,
  },
  {
    value: 'sqlserver',
    label: 'SQL Server',
    readTransform: 'ReadFromSqlServer',
    writeTransform: 'WriteToSqlServer',
    anchor: 'sqlserver',
    urlScheme: 'sqlserver',
    defaultPort: 1433,
    supportsInitSql: false,
    forcesAutoCommitDisabled: false,
    fetchSizeNeedsCursorFetch: false,
  },
];

const PACKAGED_DRIVERS: Record<DatabaseType, string> = {
  mysql: 'com.mysql.cj.jdbc.Driver',
  postgres: 'org.postgresql.Driver',
  oracle: 'oracle.jdbc.driver.OracleDriver',
  sqlserver: 'com.microsoft.sqlserver.jdbc.SQLServerDriver',
};

/**
 * Resolves a stored `databaseType` value to its `DbFlavor` descriptor (defaults to MySQL).
 */
function resolveFlavor(v: unknown): DbFlavor {
  return DB_FLAVORS.find((f) => f.value === v) ?? DB_FLAVORS[0];
}

/**
 * Returns the canonical JDBC URL example from `JdbcReadSchemaTransformProvider.inheritedDescription`.
 */
function exampleUrl(f: DbFlavor): string {
  return `jdbc:${f.urlScheme}://my-host:${f.defaultPort}/database`;
}

/**
 * Opens the Beam YAML documentation anchor in the external browser via VS Code IPC.
 */
function openMultiDbDocs(anchor: string): void {
  const vscodeApi = (window as unknown as { vscode?: { postMessage: (msg: unknown) => void } }).vscode;
  if (vscodeApi) {
    vscodeApi.postMessage({ command: 'openExternal', url: `${YAML_DOC_BASE}#${anchor}` });
  }
}

/**
 * Validates the JDBC URL for blankness and embedded passwords (`JdbcReadSchemaTransformProvider` L404).
 */
function urlError(url: string): string | null {
  if (!url.trim()) {
    return 'JDBC URL cannot be blank';
  }
  if (
    /[?&;]\s*password\s*=/i.test(url) ||
    /^[a-z][a-z0-9+.:-]*:\/\/[^/@\s]*:[^/@\s]+@/i.test(url)
  ) {
    return 'Do not embed a password in the URL — select a Password Secret instead.';
  }
  return null;
}

/**
 * Returns a non-blocking scheme mismatch warning when `url` does not start with `jdbc:<scheme>:`.
 */
function urlSchemeWarning(url: string, f: DbFlavor): string | null {
  const trimmed = url.trim();
  if (!trimmed) {
    return null;
  }
  if (!trimmed.toLowerCase().startsWith(`jdbc:${f.urlScheme}:`)) {
    return `URL does not look like a ${f.label} JDBC URL (expected jdbc:${f.urlScheme}:…)`;
  }
  return null;
}

/**
 * Validates `connectionProperties` against embedded `user=` or `password=` entries.
 */
function connectionPropertiesError(v: string): string | null {
  if (/(^|;)\s*(password|user)\s*=/i.test(v)) {
    return 'Set Username and Password Secret above; do not put credentials in connection properties.';
  }
  return null;
}

/**
 * Validates an optional positive integer property (`numPartitions`, `fetchSize`).
 */
function positiveIntError(v: unknown, label: string): string | null {
  if (v === undefined) {
    return null;
  }
  const num = Number(v);
  if (!Number.isInteger(num) || num < 1) {
    return `${label} must be a whole number ≥ 1.`;
  }
  return null;
}

/**
 * Parses newline-delimited SQL statements into a trimmed `string[]`.
 */
function parseInitSql(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/**
 * Formats a stored `connectionInitSql` value (`string[]`) for textarea display.
 */
function formatInitSql(v: unknown): string {
  return Array.isArray(v) ? v.join('\n') : '';
}

/**
 * Converts an optional boolean into a tri-state `<select>` value (`'' | 'true' | 'false'`).
 */
function toTriState(v: unknown): '' | 'true' | 'false' {
  if (v === true) {
    return 'true';
  }
  if (v === false) {
    return 'false';
  }
  return '';
}

/**
 * Applies a property patch and key deletions while ensuring `databaseType` is persisted.
 */
function applyPropertyPatch(
  base: Record<string, unknown>,
  databaseType: DatabaseType,
  patch: Record<string, unknown>,
  deletes: string[]
): Record<string, unknown> {
  const next: Record<string, unknown> = {
    databaseType,
    ...base,
    ...patch,
  };
  for (const key of deletes) {
    delete next[key];
  }
  return next;
}

export interface MultiDbNodeData {
  properties?: Record<string, unknown>;
  system_instructions?: string;
  special_instructions?: string;
  [key: string]: unknown;
}

export interface MySQLPostgreSQLOracleSQLServerSourcePropertiesProps {
  node: {
    data: MultiDbNodeData;
  };
  onChange: (properties: Record<string, unknown>) => void;
}

export const MySQLPostgreSQLOracleSQLServerSourceProperties: React.FC<
  MySQLPostgreSQLOracleSQLServerSourcePropertiesProps
> = ({ node, onChange }) => {
  const properties = node.data.properties || {};
  const flavor = resolveFlavor(properties.databaseType);

  const url = String(properties.url ?? '');
  const username = String(properties.username ?? '');
  const passwordSecret = String(properties.passwordSecret ?? '');
  const resolveOnWorkers = Boolean(properties.resolveOnWorkers);

  const query = String(properties.query ?? '');
  const table = String(properties.table ?? '');
  const readMode: 'query' | 'table' =
    properties.readMode === 'table' || (properties.readMode === undefined && Boolean(table && !query))
      ? 'table'
      : 'query';

  const partitionColumn = String(properties.partitionColumn ?? '');
  const numPartitionsRaw = properties.numPartitions;
  const fetchSizeRaw = properties.fetchSize;
  const outputParallelizationTri = toTriState(properties.outputParallelization);
  const disableAutoCommitTri = flavor.forcesAutoCommitDisabled
    ? 'true'
    : toTriState(properties.disableAutoCommit);

  const connectionProperties = String(properties.connectionProperties ?? '');
  const connectionInitSqlText = formatInitSql(properties.connectionInitSql);
  const driverClassName = String(properties.driverClassName ?? '');
  const driverJars = String(properties.driverJars ?? '');

  const systemInstructions = String(
    node.data.system_instructions ??
      node.data.special_instructions ??
      properties.system_instructions ??
      properties.special_instructions ??
      ''
  );

  // Validation
  const currentUrlError = urlError(url);
  const currentUrlWarning = urlSchemeWarning(url, flavor);
  const queryError = readMode === 'query' && !query.trim() ? 'Either Query or Table must be specified.' : null;
  const tableError = readMode === 'table' && !table.trim() ? 'Either Query or Table must be specified.' : null;
  const numPartitionsError = positiveIntError(numPartitionsRaw, 'Number of partitions');

  const fetchSizeIntError = positiveIntError(fetchSizeRaw, 'Fetch size');
  const mysqlCursorError =
    !fetchSizeIntError &&
    flavor.fetchSizeNeedsCursorFetch &&
    fetchSizeRaw !== undefined &&
    fetchSizeRaw !== '' &&
    !/useCursorFetch\s*=\s*true/i.test(url)
      ? 'It is required to set useCursorFetch=true in the JDBC URL when using fetchSize for MySQL'
      : null;
  const fetchSizeError = fetchSizeIntError || mysqlCursorError;

  const connPropsError = connectionPropertiesError(connectionProperties);

  const update = (patch: Record<string, unknown>, deletes: string[] = []) => {
    onChange(applyPropertyPatch(properties, flavor.value, patch, deletes));
  };

  const handleDatabaseTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextFlavor = resolveFlavor(e.target.value);
    const deletes: string[] = [];
    if (!nextFlavor.supportsInitSql) {
      deletes.push('connectionInitSql');
    }
    if (nextFlavor.forcesAutoCommitDisabled) {
      deletes.push('disableAutoCommit');
    }
    onChange(applyPropertyPatch(properties, nextFlavor.value, { databaseType: nextFlavor.value }, deletes));
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    update({ [e.target.name]: e.target.value });
  };

  const handlePasswordSecretChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const val = e.target.value;
    if (!val.trim()) {
      update({}, ['passwordSecret', 'resolveOnWorkers']);
    } else {
      update({ passwordSecret: val });
    }
  };

  const handleResolveOnWorkersChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    update({ resolveOnWorkers: e.target.checked });
  };

  const handleReadModeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const mode = e.target.value as 'query' | 'table';
    if (mode === 'table') {
      update({ readMode: 'table' }, ['query']);
    } else {
      update({ readMode: 'query' }, ['table', 'partitionColumn', 'numPartitions']);
    }
  };

  const handlePartitionColumnChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const val = e.target.value;
    if (!val.trim()) {
      update({}, ['partitionColumn', 'numPartitions']);
    } else {
      update({ partitionColumn: val });
    }
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (value === '') {
      update({}, [name]);
    } else {
      update({ [name]: Number(value) });
    }
  };

  const handleTriStateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (value === '') {
      update({}, [name]);
    } else {
      update({ [name]: value === 'true' });
    }
  };

  const handleInitSqlChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const parsed = parseInitSql(e.target.value);
    if (parsed.length === 0) {
      update({}, ['connectionInitSql']);
    } else {
      update({ connectionInitSql: parsed });
    }
  };

  return (
    <div className="flex-1 flex flex-col gap-4">
      {/* Header Docs Link */}
      <div className="flex flex-col gap-1.5 p-2.5 rounded bg-slate-800/40 border border-slate-700/60 text-xs text-slate-300">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-slate-200">
            Beam YAML transform: <code className="text-slate-300">{flavor.readTransform}</code>
          </span>
          <button
            type="button"
            aria-label={`Open ${flavor.readTransform} documentation`}
            onClick={() => openMultiDbDocs(`readfrom${flavor.anchor}`)}
            className="text-blue-400 hover:text-blue-300 font-semibold cursor-pointer shrink-0"
          >
            Docs ↗
          </button>
        </div>
        <p className="text-slate-400">
          Reads rows from MySQL, PostgreSQL, Oracle, or SQL Server via Beam YAML standard JDBC schema transforms.
        </p>
      </div>

      {/* 1. Database Type Selector */}
      <div className="flex flex-col gap-2">
        <label
          htmlFor="multidbSourceDatabaseType"
          className="flex items-center text-xs font-bold uppercase text-slate-500"
        >
          <span>Database</span>
          <span className="text-red-400 ml-1 font-bold" title="Required">
            *
          </span>
          <InfoTooltip text="Selects the Beam YAML transform: ReadFromMySql, ReadFromPostgres, ReadFromOracle or ReadFromSqlServer. Each is a special case of ReadFromJdbc that includes the necessary JDBC driver." />
        </label>
        <select
          id="multidbSourceDatabaseType"
          name="databaseType"
          value={flavor.value}
          onChange={handleDatabaseTypeChange}
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
        >
          {DB_FLAVORS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label} ({f.readTransform})
            </option>
          ))}
        </select>
      </div>

      {/* 2. JDBC URL */}
      <PropertyField
        id="multidbSourceUrl"
        name="url"
        label="JDBC URL"
        required
        tooltip="Connection URL for the JDBC source."
        value={url}
        error={currentUrlError}
        invalid={Boolean(currentUrlError)}
        onChange={handleTextChange}
        placeholder={exampleUrl(flavor)}
        helperText={
          <div className="flex flex-col gap-1">
            <span>
              Example:{' '}
              <code className="text-slate-300 bg-slate-800/60 px-1 py-0.5 rounded">
                {exampleUrl(flavor)}
              </code>
            </span>
            {currentUrlWarning && <span className="text-amber-400">{currentUrlWarning}</span>}
          </div>
        }
      />

      {/* 3. Username & 4. Password Secret & 5. Resolve on Workers */}
      <PropertyField
        id="multidbSourceUsername"
        name="username"
        label="Username"
        tooltip="Username for the JDBC source."
        value={username}
        onChange={handleTextChange}
        placeholder="my-username"
        mono={false}
      />

      <SecretManagerSecretField
        id="multidbSourcePasswordSecret"
        name="passwordSecret"
        label="Password Secret"
        datalistId="multidb-source-secrets-list"
        tooltip="Google Cloud Secret Manager secret that holds the database password (the JDBC password option). Only the secret ID is stored; the password is fetched from Secret Manager at runtime."
        value={passwordSecret}
        onChange={handlePasswordSecretChange}
      />

      {passwordSecret.trim().length > 0 && (
        <div className="p-2.5 bg-slate-800/40 rounded border border-slate-700/50 flex flex-col gap-1.5">
          <label
            htmlFor="multidbSourceResolveOnWorkers"
            className="flex items-center gap-2 cursor-pointer"
          >
            <input
              id="multidbSourceResolveOnWorkers"
              type="checkbox"
              name="resolveOnWorkers"
              checked={resolveOnWorkers}
              onChange={handleResolveOnWorkersChange}
              className="w-4 h-4 rounded border-slate-700 text-blue-600 focus:ring-0 focus:ring-offset-0 bg-[#252836]"
            />
            <span className="text-xs font-medium text-slate-300">
              Resolve secret on workers (Beam <code>secret_manager</code>)
            </span>
            <InfoTooltip text="When checked, generated code passes password as the JSON spec {&quot;name&quot;: &quot;<secret>&quot;, &quot;project&quot;: &quot;<pipeline project>&quot;} together with secret_manager: GoogleCloudSecretManager so Beam resolves it on workers (requires Beam > 2.55.0). When unchecked, the secret is resolved once at pipeline construction." />
          </label>
          <span className="text-xs text-slate-400">
            Secret manager: <code className="text-slate-300">GoogleCloudSecretManager</code>
          </span>
        </div>
      )}

      {/* 6. Read Mode (Query vs Table) */}
      <div className="flex flex-col gap-2">
        <label
          htmlFor="multidbSourceReadMode"
          className="flex items-center text-xs font-bold uppercase text-slate-500"
        >
          <span>Read From</span>
          <span className="text-red-400 ml-1 font-bold" title="Required">
            *
          </span>
          <InfoTooltip text="Read with a SQL query, or read an entire table (SELECT * FROM <table>). Query and Table are mutually exclusive." />
        </label>
        <select
          id="multidbSourceReadMode"
          name="readMode"
          value={readMode}
          onChange={handleReadModeChange}
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
        >
          <option value="query">SQL Query</option>
          <option value="table">Table</option>
        </select>
      </div>

      {/* 7. SQL Query OR 8. Table + 9-10. Partitioning */}
      {readMode === 'query' ? (
        <PropertyField
          id="multidbSourceQuery"
          name="query"
          label="SQL Query"
          type="textarea"
          required
          tooltip="SQL query used to query the JDBC source."
          value={query}
          error={queryError}
          invalid={Boolean(queryError)}
          onChange={handleTextChange}
          placeholder="SELECT * FROM my_table"
          rows={3}
        />
      ) : (
        <>
          <PropertyField
            id="multidbSourceTable"
            name="table"
            label="Table"
            required
            tooltip="Name of the table to read from."
            value={table}
            error={tableError}
            invalid={Boolean(tableError)}
            onChange={handleTextChange}
            placeholder="my-table"
          />

          <div className="p-3 bg-slate-800/40 rounded border border-slate-700/50 flex flex-col gap-3">
            <div className="text-xs font-bold uppercase text-slate-400">Partitioned Read</div>
            <PropertyField
              id="multidbSourcePartitionColumn"
              name="partitionColumn"
              label="Partition Column"
              tooltip="Name of a column of numeric type that will be used for partitioning. Requires Table."
              value={partitionColumn}
              onChange={handlePartitionColumnChange}
              placeholder="id"
            />
            <PropertyField
              id="multidbSourceNumPartitions"
              name="numPartitions"
              label="Number of Partitions"
              type="number"
              min={1}
              step={1}
              disabled={!partitionColumn.trim()}
              tooltip="The number of partitions."
              value={numPartitionsRaw === undefined ? '' : String(numPartitionsRaw)}
              error={numPartitionsError}
              invalid={Boolean(numPartitionsError)}
              onChange={handleNumberChange}
              placeholder="10"
            />
          </div>
        </>
      )}

      {/* 11. Fetch Size */}
      <PropertyField
        id="multidbSourceFetchSize"
        name="fetchSize"
        label="Fetch Size"
        type="number"
        min={1}
        step={1}
        tooltip="Overrides how many rows are fetched and loaded in memory per database call. It should ONLY be used if the default value throws memory errors. MySQL requires useCursorFetch=true in the URL."
        value={fetchSizeRaw === undefined ? '' : String(fetchSizeRaw)}
        error={fetchSizeError}
        invalid={Boolean(fetchSizeError)}
        onChange={handleNumberChange}
        placeholder="5000"
      />

      {/* 12. Output Parallelization & 13. Disable Auto Commit */}
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-2">
          <label
            htmlFor="multidbSourceOutputParallelization"
            className="flex items-center text-xs font-bold uppercase text-slate-500"
          >
            <span>Output Parallelization</span>
            <InfoTooltip text="Whether to reshuffle the resulting PCollection so results are distributed to all workers." />
          </label>
          <select
            id="multidbSourceOutputParallelization"
            name="outputParallelization"
            disabled={Boolean(partitionColumn.trim())}
            value={outputParallelizationTri}
            onChange={handleTriStateChange}
            className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500 disabled:opacity-60"
          >
            <option value="">Default (unset)</option>
            <option value="true">true</option>
            <option value="false">false</option>
          </select>
          {partitionColumn.trim().length > 0 && (
            <span className="text-xs text-slate-400">Ignored for partitioned reads.</span>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <label
            htmlFor="multidbSourceDisableAutoCommit"
            className="flex items-center text-xs font-bold uppercase text-slate-500"
          >
            <span>Disable Auto Commit</span>
            <InfoTooltip text="Whether to disable auto commit on read. Defaults to true if not provided. Informix requires false while Postgres requires true." />
          </label>
          <select
            id="multidbSourceDisableAutoCommit"
            name="disableAutoCommit"
            disabled={flavor.forcesAutoCommitDisabled}
            value={disableAutoCommitTri}
            onChange={handleTriStateChange}
            className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500 disabled:opacity-60"
          >
            <option value="">Default (unset)</option>
            <option value="true">true</option>
            <option value="false">false</option>
          </select>
          {flavor.forcesAutoCommitDisabled && (
            <span className="text-xs text-slate-400">PostgreSQL reads always use true.</span>
          )}
        </div>
      </div>

      {/* 14. Connection Properties */}
      <PropertyField
        id="multidbSourceConnectionProperties"
        name="connectionProperties"
        label="Connection Properties"
        tooltip="Connection properties passed to the JDBC driver that are not already defined as standalone parameters. Format: key1=value1;key2=value2;"
        value={connectionProperties}
        error={connPropsError}
        invalid={Boolean(connPropsError)}
        onChange={handleTextChange}
        placeholder="characterEncoding=UTF-8;"
      />

      {/* 15. Connection Init SQL (MySQL only) */}
      {flavor.supportsInitSql && (
        <PropertyField
          id="multidbSourceConnectionInitSql"
          name="connectionInitSql"
          label="Connection Init SQL"
          type="textarea"
          tooltip="Connection init SQL statements used by the driver (one per line). Only MySQL and MariaDB support this."
          value={connectionInitSqlText}
          onChange={handleInitSqlChange}
          placeholder="SET SESSION time_zone = '+00:00'"
          rows={2}
        />
      )}

      {/* 16-17. Advanced: Custom JDBC Driver */}
      <div className="p-3 bg-slate-800/40 rounded border border-slate-700/50 flex flex-col gap-3">
        <div className="text-xs font-bold uppercase text-slate-400">
          Advanced: Custom JDBC Driver
        </div>

        <PropertyField
          id="multidbSourceDriverClassName"
          name="driverClassName"
          label="Driver Class Name"
          tooltip="Name of a Java Driver class to use to connect to the JDBC source. Leave empty to use the driver packaged with this transform."
          value={driverClassName}
          onChange={handleTextChange}
          placeholder={PACKAGED_DRIVERS[flavor.value]}
        />

        <PropertyField
          id="multidbSourceDriverJars"
          name="driverJars"
          label="Driver JARs"
          tooltip="Comma separated path(s) for the JDBC driver jar(s). This can be a local path or GCS (gs://) path."
          value={driverJars}
          onChange={handleTextChange}
          placeholder="gs://my-bucket/drivers/driver.jar"
        />
      </div>

      {/* Flexible Spacer */}
      <div className="flex-1 min-h-4" />

      {/* 18. Code Generation Instructions */}
      <div className="flex flex-col gap-2 pt-2 border-t border-slate-700/60">
        <PropertyField
          id="multidbSourceSystemInstructions"
          name="system_instructions"
          label="Code Generation Instructions"
          type="textarea"
          value={systemInstructions}
          onChange={handleTextChange}
          placeholder="Enter custom instructions for multi-database YAML source code generation..."
          rows={3}
          mono={false}
        />
      </div>
    </div>
  );
};
