/**
 * MySQL / PostgreSQL / Oracle / SQL Server (Beam YAML) Sink Properties Component (IO79)
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Renders the property configuration panel for the multi-database Beam YAML JDBC Sink node
 * (`MySQLPostgreSQLOracleSQLServer` -> `WriteToMySql`, `WriteToPostgres`, `WriteToOracle`,
 * `WriteToSqlServer` in `apache_beam/yaml/standard_io.yaml` and
 * `org.apache.beam.sdk.io.jdbc.JdbcWriteSchemaTransformProvider`).
 *
 * Architectural Decisions:
 * - Includes a `databaseType` selector (`mysql` | `postgres` | `oracle` | `sqlserver`) that selects
 *   which Beam YAML write transform the node represents and adapts flavor-specific defaults,
 *   placeholders, and upstream validation rules (`connectionInitSql` only for MySQL).
 * - Credentials (`password`) use exclusively `SecretManagerSecretField` (`passwordSecret`, discovered
 *   via `gcloud secrets list`); no plaintext password mode is offered (R3/D3).
 * - Exposes `resolveOnWorkers` checkbox when `passwordSecret` is set (default unchecked ->
 *   construction-time secret resolution per D5; checked -> worker-time resolution via Beam
 *   `secret_manager: GoogleCloudSecretManager`).
 * - Reuses flavor descriptors and pure validation helpers from
 *   `../source/MySQLPostgreSQLOracleSQLServer`.
 */

import React from 'react';
import { InfoTooltip } from '../../components/InfoTooltip';
import { PropertyField } from '../../components/common/PropertyField';
import { SecretManagerSecretField } from '../../components/common/SecretManagerSecretField';
import { YAML_DOC_BASE } from '../source/MySQLPostgreSQLOracleSQLServer';
import type {
  DatabaseType,
  DbFlavor,
  MultiDbNodeData,
} from '../source/MySQLPostgreSQLOracleSQLServer';

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

function resolveFlavor(v: unknown): DbFlavor {
  return DB_FLAVORS.find((f) => f.value === v) ?? DB_FLAVORS[0];
}

function exampleUrl(f: DbFlavor): string {
  return `jdbc:${f.urlScheme}://my-host:${f.defaultPort}/database`;
}

function openMultiDbDocs(anchor: string): void {
  const vscodeApi = (window as unknown as { vscode?: { postMessage: (msg: unknown) => void } }).vscode;
  if (vscodeApi) {
    vscodeApi.postMessage({ command: 'openExternal', url: `${YAML_DOC_BASE}#${anchor}` });
  }
}

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

function connectionPropertiesError(v: string): string | null {
  if (/(^|;)\s*(password|user)\s*=/i.test(v)) {
    return 'Set Username and Password Secret above; do not put credentials in connection properties.';
  }
  return null;
}

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

function parseInitSql(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function formatInitSql(v: unknown): string {
  return Array.isArray(v) ? v.join('\n') : '';
}

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

export interface MySQLPostgreSQLOracleSQLServerSinkPropertiesProps {
  node: {
    data: MultiDbNodeData;
  };
  onChange: (properties: Record<string, unknown>) => void;
}

export const MySQLPostgreSQLOracleSQLServerSinkProperties: React.FC<
  MySQLPostgreSQLOracleSQLServerSinkPropertiesProps
> = ({ node, onChange }) => {
  const properties = node.data.properties || {};
  const flavor = resolveFlavor(properties.databaseType);

  const url = String(properties.url ?? '');
  const username = String(properties.username ?? '');
  const passwordSecret = String(properties.passwordSecret ?? '');
  const resolveOnWorkers = Boolean(properties.resolveOnWorkers);

  const table = String(properties.table ?? '');
  const query = String(properties.query ?? '');
  const writeMode: 'table' | 'query' =
    properties.writeMode === 'query' || (properties.writeMode === undefined && Boolean(query && !table))
      ? 'query'
      : 'table';

  const batchSizeRaw = properties.batchSize;
  const autoSharding = Boolean(properties.autoSharding);
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
  const tableError =
    writeMode === 'table' && !table.trim() ? 'Either Write Statement or Table must be set.' : null;
  const queryError =
    writeMode === 'query' && !query.trim() ? 'Either Write Statement or Table must be set.' : null;
  const batchSizeError = positiveIntError(batchSizeRaw, 'Batch size');
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

  const handleWriteModeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const mode = e.target.value as 'table' | 'query';
    if (mode === 'table') {
      update({ writeMode: 'table' }, ['query']);
    } else {
      update({ writeMode: 'query' }, ['table']);
    }
  };

  const handleBatchSizeChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { value } = e.target;
    if (value === '') {
      update({}, ['batchSize']);
    } else {
      update({ batchSize: Number(value) });
    }
  };

  const handleAutoShardingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    update({ autoSharding: e.target.checked });
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
      <div className="flex items-center justify-between text-xs text-slate-400 bg-slate-800/40 px-2.5 py-1.5 rounded border border-slate-700/50">
        <span>
          Beam YAML transform: <code className="text-slate-300">{flavor.writeTransform}</code>
        </span>
        <button
          type="button"
          aria-label={`Open ${flavor.writeTransform} documentation`}
          onClick={() => openMultiDbDocs(`writeto${flavor.anchor}`)}
          className="text-blue-400 hover:text-blue-300 font-semibold"
        >
          Docs ↗
        </button>
      </div>

      {/* 1. Database Type Selector */}
      <div className="flex flex-col gap-2">
        <label
          htmlFor="multidbSinkDatabaseType"
          className="flex items-center text-xs font-bold uppercase text-slate-500"
        >
          <span>Database</span>
          <span className="text-red-400 ml-1 font-bold" title="Required">
            *
          </span>
          <InfoTooltip text="Selects WriteToMySql, WriteToPostgres, WriteToOracle or WriteToSqlServer (special cases of WriteToJdbc with the driver included)." />
        </label>
        <select
          id="multidbSinkDatabaseType"
          name="databaseType"
          value={flavor.value}
          onChange={handleDatabaseTypeChange}
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
        >
          {DB_FLAVORS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label} ({f.writeTransform})
            </option>
          ))}
        </select>
      </div>

      {/* 2. JDBC URL */}
      <PropertyField
        id="multidbSinkUrl"
        name="url"
        label="JDBC URL"
        required
        tooltip="Connection URL for the JDBC sink."
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
        id="multidbSinkUsername"
        name="username"
        label="Username"
        tooltip="Username for the JDBC source."
        value={username}
        onChange={handleTextChange}
        placeholder="my-username"
        mono={false}
      />

      <SecretManagerSecretField
        id="multidbSinkPasswordSecret"
        name="passwordSecret"
        label="Password Secret"
        datalistId="multidb-sink-secrets-list"
        tooltip="Google Cloud Secret Manager secret that holds the database password (the JDBC password option). Only the secret ID is stored; the password is fetched from Secret Manager at runtime."
        value={passwordSecret}
        onChange={handlePasswordSecretChange}
      />

      {passwordSecret.trim().length > 0 && (
        <div className="p-2.5 bg-slate-800/40 rounded border border-slate-700/50 flex flex-col gap-1.5">
          <label
            htmlFor="multidbSinkResolveOnWorkers"
            className="flex items-center gap-2 cursor-pointer"
          >
            <input
              id="multidbSinkResolveOnWorkers"
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

      {/* 6. Write Mode (Table vs Custom Write Statement) */}
      <div className="flex flex-col gap-2">
        <label
          htmlFor="multidbSinkWriteMode"
          className="flex items-center text-xs font-bold uppercase text-slate-500"
        >
          <span>Write Using</span>
          <span className="text-red-400 ml-1 font-bold" title="Required">
            *
          </span>
          <InfoTooltip text="Write to a table (INSERT INTO t (cols…) VALUES(?, …) generated from the input schema) or supply your own statement." />
        </label>
        <select
          id="multidbSinkWriteMode"
          name="writeMode"
          value={writeMode}
          onChange={handleWriteModeChange}
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
        >
          <option value="table">Table (auto-generated INSERT)</option>
          <option value="query">Custom write statement</option>
        </select>
      </div>

      {/* 7. Table OR 8. Write Statement */}
      {writeMode === 'table' ? (
        <PropertyField
          id="multidbSinkTable"
          name="table"
          label="Table"
          required
          tooltip="Name of the table to write to."
          value={table}
          error={tableError}
          invalid={Boolean(tableError)}
          onChange={handleTextChange}
          placeholder="my-table"
        />
      ) : (
        <PropertyField
          id="multidbSinkQuery"
          name="query"
          label="Write Statement"
          type="textarea"
          required
          tooltip="SQL query used to insert records into the JDBC sink. Use ? placeholders in input-schema field order."
          value={query}
          error={queryError}
          invalid={Boolean(queryError)}
          onChange={handleTextChange}
          placeholder="INSERT INTO my_table (id, name) VALUES(?, ?)"
          rows={3}
        />
      )}

      {/* 9. Batch Size */}
      <PropertyField
        id="multidbSinkBatchSize"
        name="batchSize"
        label="Batch Size"
        type="number"
        min={1}
        step={1}
        tooltip="Maximum number of rows per JDBC batch (JdbcIO.write().withBatchSize)."
        value={batchSizeRaw === undefined ? '' : String(batchSizeRaw)}
        error={batchSizeError}
        invalid={Boolean(batchSizeError)}
        onChange={handleBatchSizeChange}
        placeholder="1000"
      />

      {/* 10. Auto Sharding */}
      <div className="p-3 bg-slate-800/40 rounded border border-slate-700/50">
        <label htmlFor="multidbSinkAutoSharding" className="flex items-center gap-2 cursor-pointer">
          <input
            id="multidbSinkAutoSharding"
            type="checkbox"
            name="autoSharding"
            checked={autoSharding}
            onChange={handleAutoShardingChange}
            className="w-4 h-4 rounded border-slate-700 text-blue-600 focus:ring-0 focus:ring-offset-0 bg-[#252836]"
          />
          <span className="text-sm font-medium text-slate-300">Auto Sharding</span>
          <InfoTooltip text="If true, enables using a dynamically determined number of shards to write." />
        </label>
      </div>

      {/* 11. Connection Properties */}
      <PropertyField
        id="multidbSinkConnectionProperties"
        name="connectionProperties"
        label="Connection Properties"
        tooltip="Connection properties passed to the JDBC driver that are not already defined as standalone parameters. Format: key1=value1;key2=value2;"
        value={connectionProperties}
        error={connPropsError}
        invalid={Boolean(connPropsError)}
        onChange={handleTextChange}
        placeholder="characterEncoding=UTF-8;"
      />

      {/* 12. Connection Init SQL (MySQL only) */}
      {flavor.supportsInitSql && (
        <PropertyField
          id="multidbSinkConnectionInitSql"
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

      {/* 13-14. Advanced: Custom JDBC Driver */}
      <div className="p-3 bg-slate-800/40 rounded border border-slate-700/50 flex flex-col gap-3">
        <div className="text-xs font-bold uppercase text-slate-400">
          Advanced: Custom JDBC Driver
        </div>

        <PropertyField
          id="multidbSinkDriverClassName"
          name="driverClassName"
          label="Driver Class Name"
          tooltip="Name of a Java Driver class to use to connect to the JDBC sink. Leave empty to use the driver packaged with this transform."
          value={driverClassName}
          onChange={handleTextChange}
          placeholder={PACKAGED_DRIVERS[flavor.value]}
        />

        <PropertyField
          id="multidbSinkDriverJars"
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

      {/* 15. Code Generation Instructions */}
      <div className="flex flex-col gap-2 pt-2 border-t border-slate-700/60">
        <PropertyField
          id="multidbSinkSystemInstructions"
          name="system_instructions"
          label="Code Generation Instructions"
          type="textarea"
          value={systemInstructions}
          onChange={handleTextChange}
          placeholder="Enter custom instructions for multi-database YAML sink code generation..."
          rows={3}
          mono={false}
        />
      </div>
    </div>
  );
};
