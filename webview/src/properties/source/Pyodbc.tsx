/**
 * PyodbcSourceProperties Component (IO76)
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Renders the property configuration panel for the Pyodbc (Python ODBC) Source node.
 * Exposes the parameters documented in the upstream `beam-pyodbc-connector` README
 * (`ReadFromDB(query, host, database, user, password, port=3306, splitter=NoSplitter())`)
 * together with the required ODBC `driver` and optional driver-specific `extraAttributes`
 * documented by `pyodbc.connect()`.
 *
 * Architectural Decisions:
 * - Upstream `beam-pyodbc-connector` (0.0.1) is a stub package whose README specifies
 *   the API. Generated Python pipelines implement the read via `pyodbc` in a custom DoFn.
 * - Credentials (`password` / ODBC `PWD`) are collected exclusively via `SecretManagerSecretField`
 *   (`passwordSecret`, resolved from Google Cloud Secret Manager at runtime per R3).
 * - Free-text `extraAttributes` rejects embedded credential keywords (`PWD`, `PASSWORD`,
 *   `UID`, `USER`, `USER ID`, `USERNAME`) and keys that have dedicated fields.
 */

import React from 'react';
import { PropertyField } from '../../components/common/PropertyField';
import { SystemInstructionsField } from '../../components/common/SystemInstructionsField';
import { resolveSystemInstructions } from '../../utils/systemInstructions';
import { SecretManagerSecretField } from '../../components/common/SecretManagerSecretField';
import { ExternalDocsLink } from '../../components/common/ExternalDocsLink';
import { useNodeProperties } from '../../hooks/useNodeProperties';

const PYODBC_DOCS_URL = 'https://github.com/314e/beam-pyodbc-connector';

const PYODBC_DRIVER_SUGGESTIONS: string[] = [
  'ODBC Driver 18 for SQL Server',
  'ODBC Driver 17 for SQL Server',
  'PostgreSQL Unicode',
  'MySQL ODBC 8.0 Unicode Driver',
];

const HOST_RE = /^[A-Za-z0-9._\-\\[\]:]+$/;
const CREDENTIAL_KEYS = new Set(['pwd', 'password', 'uid', 'user', 'user id', 'username']);
const DEDICATED_KEYS = new Set(['driver', 'dsn', 'server', 'database', 'port']);


/**
 * Returns default network port string based on driver name heuristics.
 *
 * @param driver The ODBC driver name string.
 * @returns The default port number string or placeholder label.
 */
function getPyodbcDefaultPort(driver: string): string {
  if (/sql server/i.test(driver)) {
    return '1433';
  }
  if (/postgres/i.test(driver)) {
    return '5432';
  }
  if (/mysql|mariadb/i.test(driver)) {
    return '3306';
  }
  return 'driver default';
}

/**
 * Validates the ODBC driver name string.
 *
 * @param v The driver name to validate.
 * @returns Error message string if invalid, or null if valid.
 */
function validateDriver(v: string): string | null {
  const trimmed = v.trim();
  if (!trimmed) {
    return 'ODBC driver is required.';
  }
  if (/[{};]/.test(trimmed)) {
    return "Enter the driver name without braces or ';' (e.g. ODBC Driver 18 for SQL Server).";
  }
  return null;
}

/**
 * Validates the database hostname or IP address format.
 *
 * @param v The host string to validate.
 * @returns Error message string if invalid, or null if valid.
 */
function validateHost(v: string): string | null {
  const trimmed = v.trim();
  if (!trimmed) {
    return 'Host is required.';
  }
  if (!HOST_RE.test(trimmed)) {
    return "Enter a hostname or IP address only (no scheme, credentials, spaces, ',' or ';'). Put the port in the Port field.";
  }
  return null;
}

/**
 * Validates the database network port number.
 *
 * @param v The port value to validate.
 * @returns Error message string if invalid, or null if valid.
 */
function validatePort(v: string | number): string | null {
  const s = String(v).trim();
  if (!s) {
    return null;
  }
  if (!/^\d+$/.test(s)) {
    return 'Port must be an integer between 1 and 65535.';
  }
  const n = Number(s);
  if (n < 1 || n > 65535) {
    return 'Port must be an integer between 1 and 65535.';
  }
  return null;
}

/**
 * Validates semicolon-delimited ODBC extra connection string attributes.
 *
 * @param v The attributes string to validate.
 * @returns Error message string if invalid, or null if valid.
 */
function validateExtraAttributes(v: string): string | null {
  if (!v.trim()) {
    return null;
  }
  const segments = v
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
  for (const seg of segments) {
    const eqIndex = seg.indexOf('=');
    if (eqIndex <= 0) {
      return "Use key=value pairs separated by ';'.";
    }
    const rawKey = seg.slice(0, eqIndex).trim();
    const keyLower = rawKey.toLowerCase();
    if (CREDENTIAL_KEYS.has(keyLower)) {
      return 'Credentials are not allowed here. Use the User and Password Secret fields.';
    }
    if (DEDICATED_KEYS.has(keyLower)) {
      return `${rawKey} has its own field. Remove it from Extra Attributes.`;
    }
  }
  return null;
}

/** Props for the {@link PyodbcSourceProperties} component. */
export interface PyodbcSourcePropertiesProps {
  node: {
    data: {
      properties?: Record<string, unknown>;
      system_instructions?: string;
      special_instructions?: string;
    };
  };
  onChange: (properties: Record<string, unknown>) => void;
}

/**
 * Dedicated property panel for the Pyodbc source node. Configures ODBC driver, host, credentials, and SQL queries.
 *
 * @param props The selected node and the onChange callback used to persist edits.
 */
export const PyodbcSourceProperties: React.FC<PyodbcSourcePropertiesProps> = ({ node, onChange }) => {
  const { properties, handleChange } = useNodeProperties(node, onChange);

  const driver = String(properties.driver ?? '');
  const host = String(properties.host ?? '');
  const port = (properties.port as string | number | undefined) ?? '';
  const database = String(properties.database ?? '');
  const user = String(properties.user ?? '');
  const passwordSecret = String(properties.passwordSecret ?? '');
  const extraAttributes = String(properties.extraAttributes ?? '');
  const query = String(properties.query ?? '');

  const systemInstructions = resolveSystemInstructions(node);

  const driverError = validateDriver(driver);
  const hostError = validateHost(host);
  const portError = validatePort(port);
  const databaseError = database.trim() ? null : 'Database is required.';
  const userError = user.trim() ? null : 'User is required.';
  const passwordSecretError = passwordSecret.trim() ? null : 'Password secret is required.';
  const extraAttributesError = validateExtraAttributes(extraAttributes);
  const queryError = query.trim() ? null : 'Query is required.';

  return (
    <div className="flex-1 flex flex-col gap-4">
      {/* Header & Documentation Link */}
      <div className="flex flex-col gap-1.5 p-2.5 rounded bg-slate-800/40 border border-slate-700/60 text-xs text-slate-300">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-slate-200">Pyodbc Source (ReadFromDB / pyodbc)</span>
          <ExternalDocsLink url={PYODBC_DOCS_URL} />
        </div>
        <p className="text-slate-400">
          Queries an ODBC-compliant database from Python Beam pipelines using pyodbc drivers.
        </p>
      </div>

      {/* S1: ODBC Driver */}
      <PropertyField
        id="pyodbcSourceDriver"
        name="driver"
        label="ODBC Driver"
        required
        tooltip="Name of the ODBC driver installed on the workers, exactly as registered in odbcinst.ini (becomes DRIVER={...} in the pyodbc connection string)."
        value={driver}
        invalid={Boolean(driverError)}
        error={driverError}
        onChange={handleChange}
        placeholder="ODBC Driver 18 for SQL Server"
        list="pyodbc-source-driver-options"
        datalist={PYODBC_DRIVER_SUGGESTIONS}
        helperText={
          <>
            Sample: <code className="text-slate-300 bg-slate-800/60 px-1 py-0.5 rounded">ODBC Driver 18 for SQL Server</code>
          </>
        }
      />

      {/* S2: Host */}
      <PropertyField
        id="pyodbcSourceHost"
        name="host"
        label="Host"
        required
        tooltip="Database server host (host in ReadFromDB; pyodbc converts it to SERVER). A SQL Server named instance may be written as host\INSTANCE."
        value={host}
        invalid={Boolean(hostError)}
        error={hostError}
        onChange={handleChange}
        placeholder="db.example.com"
      />

      {/* S3: Port */}
      <PropertyField
        id="pyodbcSourcePort"
        name="port"
        label="Port"
        type="number"
        min={1}
        max={65535}
        tooltip="Server port (port in ReadFromDB). Leave blank for the driver's default. SQL Server drivers take the port as SERVER=host,port; other drivers use PORT=."
        value={port}
        invalid={Boolean(portError)}
        error={portError}
        onChange={handleChange}
        placeholder={getPyodbcDefaultPort(driver)}
      />

      {/* S4: Database */}
      <PropertyField
        id="pyodbcSourceDatabase"
        name="database"
        label="Database"
        required
        tooltip="Database name (database in ReadFromDB; DATABASE= in the connection string)."
        value={database}
        invalid={Boolean(databaseError)}
        error={databaseError}
        onChange={handleChange}
        placeholder="test_db"
      />

      {/* S5: User */}
      <PropertyField
        id="pyodbcSourceUser"
        name="user"
        label="User"
        required
        mono={false}
        tooltip="Database user (user in ReadFromDB; pyodbc converts it to UID). The password is read from Secret Manager at runtime."
        value={user}
        invalid={Boolean(userError)}
        error={userError}
        onChange={handleChange}
        placeholder="db_user"
      />

      {/* S6: Password Secret */}
      <SecretManagerSecretField
        id="pyodbcSourcePasswordSecret"
        name="passwordSecret"
        label="Password Secret"
        required
        tooltip="Short ID of the Google Cloud Secret Manager secret that holds the database password. Generated code resolves it at runtime and passes it as password (PWD); the password is never stored in the pipeline."
        placeholder="e.g. my-odbc-password"
        value={passwordSecret}
        invalid={Boolean(passwordSecretError)}
        error={passwordSecretError}
        onChange={handleChange}
      />

      {/* S7: Extra Attributes */}
      <PropertyField
        id="pyodbcSourceExtraAttributes"
        name="extraAttributes"
        label="Extra Attributes"
        tooltip="Optional driver-specific connection-string attributes as key=value pairs separated by ';' (appended to the pyodbc connection string). Do not put credentials, DRIVER, SERVER, DATABASE or PORT here."
        value={extraAttributes}
        invalid={Boolean(extraAttributesError)}
        error={extraAttributesError}
        onChange={handleChange}
        placeholder="Encrypt=yes;TrustServerCertificate=no"
      />

      {/* S8: SQL Query */}
      <PropertyField
        id="pyodbcSourceQuery"
        name="query"
        label="SQL Query"
        type="textarea"
        rows={3}
        required
        tooltip="SQL statement executed through pyodbc (query in ReadFromDB). Each result row is emitted as a dict keyed by column name."
        value={query}
        invalid={Boolean(queryError)}
        error={queryError}
        onChange={handleChange}
        placeholder="SELECT * FROM test_db.tests"
      />

      {/* S9: Code Generation Instructions */}
      <SystemInstructionsField
        id="pyodbcSourceSystemInstructions"
        value={systemInstructions}
        tooltip="Custom instructions for LLM code generation for this Pyodbc source node."
        placeholder="Enter custom instructions for pyodbc read code generation..."
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
