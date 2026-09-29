/**
 * CloudSQL Sink Properties Component (IO74)
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Renders the property configuration panel for Google Cloud SQL (PostgreSQL) Sink nodes
 * in Apache Beam Python pipelines, traced to jccatrinck/dataflow-cloud-sql-python
 * (`transformations/db.py` WriteIntoDB / WriteIntoDBFn, `.env-example`, `Makefile`, `devops/entrypoint.sh`).
 *
 * Documentation Traceability:
 * - Repository: https://github.com/jccatrinck/dataflow-cloud-sql-python
 * - WriteIntoDB(url, table, update_ignores=()): https://github.com/jccatrinck/dataflow-cloud-sql-python/blob/master/transformations/db.py#L33-L82
 * - DB_URL & CLOUD_SQL_INSTANCES: https://github.com/jccatrinck/dataflow-cloud-sql-python/blob/master/.env-example#L5-L6
 * - Drivers (pg8000, psycopg2): https://github.com/jccatrinck/dataflow-cloud-sql-python/blob/master/Makefile#L17-L20
 *
 * Architectural Decisions:
 * - Upstream WriteIntoDBFn reflects an existing PostgreSQL table and performs a primary-key upsert via
 *   `sqlalchemy.dialects.postgresql.insert(table).values(data).on_conflict_do_update(...)`, excluding
 *   columns in `update_ignores` from the UPDATE SET clause.
 * - Decomposes DB_URL into cloudSqlInstance, dbDriver, database, username, and passwordSecret so no
 *   plaintext password is ever stored in the pipeline YAML (R3).
 * - Uses useAssetLoader('sqlInstances') and gated useAssetLoader('sqlDatabases') with PropertyField
 *   datalists following the PubSubIO discovery pattern (R2).
 * - Standardized on SQLAlchemy 2.x API (`sqlalchemy.Table(..., autoload_with=engine)`) matching
 *   upstream WriteIntoDB semantics on Python 3.11 / Beam 2.55+.
 */

import React from 'react';
import { InfoTooltip } from '../../components/InfoTooltip';
import { PropertyField } from '../../components/common/PropertyField';
import { SecretManagerSecretField } from '../../components/common/SecretManagerSecretField';
import { useAssetLoader } from '../../hooks/useAssetLoader';

export const CLOUD_SQL_DOC_URL = 'https://github.com/jccatrinck/dataflow-cloud-sql-python';
export const CLOUD_SQL_DB_DOC_URL =
  'https://github.com/jccatrinck/dataflow-cloud-sql-python/blob/master/transformations/db.py';
export const DEFAULT_DB_DRIVER = 'postgresql+pg8000';

/**
 * Matches a Cloud SQL instance connection name `[domain:]project:region:instance`.
 */
const CONNECTION_NAME_RE = /^(?:[a-z0-9.-]+:)?[a-z0-9-]+:[a-z0-9-]+:[a-z][a-z0-9-]*$/i;

const DB_DRIVER_OPTIONS = [
  { value: 'postgresql+pg8000', label: 'PostgreSQL (pg8000) — repository default' },
  { value: 'postgresql+psycopg2', label: 'PostgreSQL (psycopg2)' },
] as const;

/**
 * Database name cannot contain whitespace or URI delimiter characters.
 */
const DATABASE_RE = /^[^\s/?#@:]+$/;

/**
 * Username and table name cannot contain whitespace.
 */
const NO_WHITESPACE_RE = /^\S+$/;

/**
 * Validates the optional comma-separated column list for `WriteIntoDB(update_ignores=...)`.
 *
 * @param raw Raw input string.
 * @returns Validation error message, or null when blank or valid comma-separated identifiers.
 */
function validateUpdateIgnores(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  const tokens = raw.split(',').map((t) => t.trim());
  if (tokens.some((t) => t.length === 0 || /\s/.test(t))) {
    return 'Enter comma-separated column names, e.g. created_at, created_by';
  }
  return null;
}

export interface CloudSQLSinkPropertiesProps {
  node: {
    data: {
      properties?: {
        cloudSqlInstance?: string;
        dbDriver?: string;
        database?: string;
        username?: string;
        passwordSecret?: string;
        table?: string;
        updateIgnores?: string;
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

export const CloudSQLSinkProperties: React.FC<CloudSQLSinkPropertiesProps> = ({ node, onChange }) => {
  const properties = node.data.properties || {};

  const cloudSqlInstance = properties.cloudSqlInstance || '';
  const dbDriver = properties.dbDriver || DEFAULT_DB_DRIVER;
  const database = properties.database || '';
  const username = properties.username || '';
  const passwordSecret = properties.passwordSecret || '';
  const table = properties.table || '';
  const updateIgnores = properties.updateIgnores || '';

  // Dynamic gcloud discovery (R2 PubSubIO datalist pattern)
  const { items: sqlInstances, loading: sqlInstancesLoading, error: sqlInstancesError } = useAssetLoader<string>('sqlInstances');

  const instanceTrimmed = cloudSqlInstance.trim();
  const instanceWellFormed = CONNECTION_NAME_RE.test(instanceTrimmed);

  // Gate sqlDatabases discovery on a well-formed connection name to avoid per-keystroke CLI calls
  const { items: sqlDatabases, loading: sqlDatabasesLoading, error: sqlDatabasesError } = useAssetLoader<string>('sqlDatabases', {
    params: { instance: instanceTrimmed },
    enabled: instanceWellFormed,
  });

  const databaseOptions = instanceWellFormed ? sqlDatabases : [];
  const databaseDiscoveryError = instanceWellFormed ? sqlDatabasesError : null;

  // Field validation
  const isInstanceEmpty = instanceTrimmed.length === 0;
  const instanceFormatError =
    !isInstanceEmpty && !instanceWellFormed
      ? 'Use the instance connection name PROJECT:REGION:INSTANCE (see gcloud sql instances list).'
      : null;
  const instanceError = instanceFormatError ?? sqlInstancesError;
  const isInstanceInvalid = isInstanceEmpty || Boolean(instanceError);

  const databaseTrimmed = database.trim();
  const isDatabaseEmpty = databaseTrimmed.length === 0;
  const databaseFormatError =
    !isDatabaseEmpty && !DATABASE_RE.test(databaseTrimmed)
      ? 'Database name cannot contain spaces or / ? # @ :'
      : null;
  const databaseError = databaseFormatError ?? databaseDiscoveryError;
  const isDatabaseInvalid = isDatabaseEmpty || Boolean(databaseError);

  const usernameTrimmed = username.trim();
  const isUsernameEmpty = usernameTrimmed.length === 0;
  const usernameError =
    !isUsernameEmpty && !NO_WHITESPACE_RE.test(usernameTrimmed) ? 'Username cannot contain whitespace' : null;
  const isUsernameInvalid = isUsernameEmpty || Boolean(usernameError);

  const isPasswordSecretEmpty = passwordSecret.trim().length === 0;

  const tableTrimmed = table.trim();
  const isTableEmpty = tableTrimmed.length === 0;
  const tableError =
    !isTableEmpty && !NO_WHITESPACE_RE.test(tableTrimmed) ? 'Table name cannot contain whitespace' : null;
  const isTableInvalid = isTableEmpty || Boolean(tableError);

  const updateIgnoresError = validateUpdateIgnores(updateIgnores);

  const systemInstructions =
    node.data.system_instructions ??
    node.data.special_instructions ??
    properties.system_instructions ??
    properties.special_instructions ??
    '';

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    onChange({
      ...properties,
      [name]: value,
    });
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
      vscodeApi.postMessage({ command: 'openExternal', url: CLOUD_SQL_DOC_URL });
    }
  };

  return (
    <div className="flex-1 flex flex-col gap-4">
      {/* Header & Documentation Link */}
      <div className="flex flex-col gap-1.5 p-2.5 rounded bg-slate-800/40 border border-slate-700/60 text-xs text-slate-300">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-slate-200">Cloud SQL (PostgreSQL) Sink</span>
          <button
            type="button"
            onClick={handleOpenDocs}
            className="text-blue-400 hover:text-blue-300 font-semibold cursor-pointer shrink-0 focus:outline-none"
            aria-label="Open Cloud SQL connector documentation"
          >
            Docs ↗
          </button>
        </div>
        <p className="text-slate-400">
          Writes batched rows into a Google Cloud SQL for PostgreSQL table via the Cloud SQL Connector or Auth Proxy.
        </p>
      </div>

      {/* Instance Connection Name */}
      <PropertyField
        id="cloudSqlSinkInstance"
        name="cloudSqlInstance"
        label="Instance Connection Name"
        required
        tooltip="Cloud SQL for PostgreSQL instance connection name (PROJECT:REGION:INSTANCE). Reached via Cloud SQL Python Connector or Auth Proxy unix socket /cloudsql/<connection name>. PostgreSQL instances only."
        value={cloudSqlInstance}
        invalid={isInstanceInvalid}
        error={instanceError}
        onChange={handleChange}
        placeholder="my-project:us-central1:my-instance"
        list="cloudsql-sink-instance-options"
        datalist={sqlInstances}
        loading={sqlInstancesLoading}
        helperText={
          <span>
            Sample:{' '}
            <code className="text-slate-300 bg-slate-800/60 px-1 py-0.5 rounded">
              my-project:us-central1:my-instance
            </code>
          </span>
        }
      />

      {/* Database Driver */}
      <div className="flex flex-col gap-2">
        <label htmlFor="cloudSqlSinkDriver" className="flex items-center text-xs font-bold uppercase text-slate-500">
          <span>Database Driver</span>
          <span className="text-red-400 ml-1 font-bold" title="Required">
            *
          </span>
          <InfoTooltip text="SQLAlchemy dialect+driver prefix of the database engine (postgresql+pg8000 default, or postgresql+psycopg2). Only PostgreSQL is supported because WriteIntoDB uses PostgreSQL-specific ON CONFLICT DO UPDATE SQL." />
        </label>
        <select
          id="cloudSqlSinkDriver"
          name="dbDriver"
          aria-required="true"
          value={dbDriver}
          onChange={handleChange}
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
        >
          {DB_DRIVER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Database */}
      <PropertyField
        id="cloudSqlSinkDatabase"
        name="database"
        label="Database"
        required
        tooltip="Database name on the selected Cloud SQL instance (the database_name part of DB_URL). Suggestions load from gcloud sql databases list after a valid instance connection name is entered."
        value={database}
        invalid={isDatabaseInvalid}
        error={databaseError}
        onChange={handleChange}
        placeholder="postgres"
        list="cloudsql-sink-database-options"
        datalist={databaseOptions}
        loading={instanceWellFormed ? sqlDatabasesLoading : false}
        helperText={
          <span>
            Sample: <code className="text-slate-300 bg-slate-800/60 px-1 py-0.5 rounded">postgres</code>
          </span>
        }
      />

      {/* Username */}
      <PropertyField
        id="cloudSqlSinkUsername"
        name="username"
        label="Username"
        required
        tooltip="Database user (the user part of DB_URL)."
        value={username}
        invalid={isUsernameInvalid}
        error={usernameError}
        onChange={handleChange}
        placeholder="postgres"
      />

      {/* Password Secret */}
      <SecretManagerSecretField
        id="cloudSqlSinkPasswordSecret"
        name="passwordSecret"
        label="Password Secret"
        required
        tooltip="Secret Manager secret holding the database password (the password part of DB_URL). Resolved at pipeline construction; the password is never stored in the pipeline."
        value={passwordSecret}
        invalid={isPasswordSecretEmpty}
        onChange={handleChange}
        datalistId="cloudsql-sink-secret-options"
      />

      {/* Table */}
      <PropertyField
        id="cloudSqlSinkTable"
        name="table"
        label="Table"
        required
        tooltip="Existing PostgreSQL table to upsert into (WriteIntoDB table). Reflected at runtime via sqlalchemy.Table(table, metadata, autoload_with=engine) and must have a primary key: rows are written with INSERT … ON CONFLICT (primary key) DO UPDATE."
        value={table}
        invalid={isTableInvalid}
        error={tableError}
        onChange={handleChange}
        placeholder="orders"
      />

      {/* Columns Not Updated on Conflict */}
      <PropertyField
        id="cloudSqlSinkUpdateIgnores"
        name="updateIgnores"
        label="Columns Not Updated on Conflict"
        tooltip="Comma-separated columns excluded from the UPDATE SET when a row with the same primary key already exists (WriteIntoDB update_ignores). Those columns keep their existing values."
        value={updateIgnores}
        invalid={Boolean(updateIgnoresError)}
        error={updateIgnoresError}
        onChange={handleChange}
        placeholder="created_at, created_by"
      />

      {/* Flexible Spacer */}
      <div className="flex-1 min-h-4" />

      {/* Code Generation Instructions */}
      <div className="flex flex-col gap-2 pt-2 border-t border-slate-700/60">
        <PropertyField
          id="cloudSqlSinkSystemInstructions"
          name="system_instructions"
          label="Code Generation Instructions"
          type="textarea"
          value={systemInstructions}
          onChange={handleInstructionsChange}
          placeholder="Enter custom instructions for Cloud SQL sink code generation..."
          rows={3}
          mono={false}
        />
      </div>
    </div>
  );
};
