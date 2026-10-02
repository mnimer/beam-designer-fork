/**
 * JdbcIOSourceProperties Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Renders the property panel for Apache Beam JdbcIO Database Source nodes.
 * Supports both Java native JdbcIO (readRows / read / readWithPartitions)
 * and Python Cross-Language API (ReadFromJdbc).
 * 
 * Architectural Decisions:
 * - In Apache Beam, a JDBC read requires a driverClassName, connection url, and either a query or tableName.
 * - Enforces required field indicators, aria-required/aria-invalid attributes, and red border highlights on validation failure.
 * - Provides preset suggestions for standard JDBC database drivers (PostgreSQL, MySQL, SQL Server, Oracle, SQLite, Derby).
 * - Dynamically computes example JDBC URL placeholders and help text based on the selected database driver.
 * - Integrates InfoTooltip popovers linking field definitions to Apache Beam documentation.
 * - Supports authentication mode selection: Google Cloud Secret Manager (passwordSecret) or Plaintext password (with cleartext warning).
 * - Resolves initial authentication mode with backward compatibility for legacy saved pipelines.
 * - Includes a flexible spacer and "Code Generation Instructions" textarea at the bottom for LLM code generation prompt overrides.
 */

import React from 'react';
import { InfoTooltip } from '../../components/InfoTooltip';
import { PropertyField } from '../../components/common/PropertyField';
import { SystemInstructionsField } from '../../components/common/SystemInstructionsField';
import { resolveSystemInstructions } from '../../utils/systemInstructions';
import { normalizeSecretItem } from '../../components/common/SecretManagerAuthFields';
import type { SecretItem, AuthModeOption } from '../../components/common/SecretManagerAuthFields';
import { useAssetLoader } from '../../hooks/useAssetLoader';

export type JdbcAuthMode = 'secretManager';

export const JDBC_AUTH_OPTIONS: AuthModeOption[] = [
  { value: 'secretManager', label: 'Google Cloud Secret Manager' },
];

/**
 * Resolves the authentication mode for the JDBC Source node.
 * Defaults to 'secretManager'.
 */
export function resolveAuthMode(_authMode?: string, _password?: string): JdbcAuthMode {
  return 'secretManager';
}

/** Preset mapping driver label to class name and sample JDBC connection URL. */
export interface JdbcDriverPreset {
  label: string;
  driverClass: string;
  exampleUrl: string;
}

export const JDBC_DRIVER_PRESETS: JdbcDriverPreset[] = [
  { label: 'PostgreSQL', driverClass: 'org.postgresql.Driver', exampleUrl: 'jdbc:postgresql://localhost:5432/mydb' },
  { label: 'MySQL', driverClass: 'com.mysql.cj.jdbc.Driver', exampleUrl: 'jdbc:mysql://localhost:3306/mydb' },
  { label: 'Microsoft SQL Server', driverClass: 'com.microsoft.sqlserver.jdbc.SQLServerDriver', exampleUrl: 'jdbc:sqlserver://localhost:1433;databaseName=mydb' },
  { label: 'Oracle', driverClass: 'oracle.jdbc.driver.OracleDriver', exampleUrl: 'jdbc:oracle:thin:@localhost:1521:xe' },
  { label: 'SQLite', driverClass: 'org.sqlite.JDBC', exampleUrl: 'jdbc:sqlite:/path/to/database.db' },
  { label: 'Apache Derby', driverClass: 'org.apache.derby.jdbc.ClientDriver', exampleUrl: 'jdbc:derby://localhost:1527/mydb' },
];

/**
 * Returns a suitable JDBC connection URL example based on the driver class name.
 * 
 * @param driverClass The JDBC driver class name string.
 * @returns Example JDBC connection URL.
 */
export function getJdbcUrlExample(driverClass?: string): string {
  if (!driverClass) {
    return 'jdbc:postgresql://localhost:5432/mydb';
  }
  const lower = driverClass.toLowerCase();
  if (lower.includes('mysql')) {
    return 'jdbc:mysql://localhost:3306/mydb';
  }
  if (lower.includes('sqlserver') || lower.includes('microsoft')) {
    return 'jdbc:sqlserver://localhost:1433;databaseName=mydb';
  }
  if (lower.includes('oracle')) {
    return 'jdbc:oracle:thin:@localhost:1521:xe';
  }
  if (lower.includes('sqlite')) {
    return 'jdbc:sqlite:/path/to/database.db';
  }
  if (lower.includes('derby')) {
    return 'jdbc:derby://localhost:1527/mydb';
  }
  if (lower.includes('postgres')) {
    return 'jdbc:postgresql://localhost:5432/mydb';
  }
  return 'jdbc:<driver>://<host>:<port>/<database>';
}

/** React Flow node shape for the JdbcIO source panel, including its persisted configuration data. */
interface JdbcIOSourceNode {
  data: {
    label: string;
    beam_transform?: string;
    system_instructions?: string;
    special_instructions?: string;
    properties?: {
      driverClassName?: string;
      url?: string;
      authMode?: JdbcAuthMode;
      username?: string;
      password?: string;
      passwordSecret?: string;
      connectionProperties?: string;
      driverJars?: string;
      query?: string;
      tableName?: string;
      selectType?: 'query' | 'table';
      fetchSize?: string | number;
      outputParallelization?: boolean;
      usePartitioning?: boolean;
      partitionColumn?: string;
      lowerBound?: string | number;
      upperBound?: string | number;
      numPartitions?: string | number;
      system_instructions?: string;
      special_instructions?: string;
      codeGenerationPrompt?: string;
      prompt?: string;
      [key: string]: any;
    };
  };
}

/** Props for the {@link JdbcIOSourceProperties} component. */
interface JdbcIOSourcePropertiesProps {
  node: JdbcIOSourceNode;
  onChange: (properties: any) => void;
}

/**
 * Dedicated property panel for the JdbcIO source node. Configures JDBC driver, connection URL, credentials, and SQL queries.
 *
 * @param props The selected node and the onChange callback used to persist edits.
 */
export const JdbcIOSourceProperties: React.FC<JdbcIOSourcePropertiesProps> = ({ node, onChange }) => {
  // Extract existing properties or fallback to empty object
  const properties = node.data.properties || {};

  // NOTE: Request Secret Manager secrets via useAssetLoader
  const { items: secrets, error: secretError, loading: secretsLoading } = useAssetLoader<SecretItem | string>('secrets');

  const driverClassName = properties.driverClassName || 'org.postgresql.Driver';
  const url = properties.url || '';
  const username = properties.username || '';
  const passwordSecret = properties.passwordSecret || '';
  const connectionProperties = properties.connectionProperties || '';
  const query = properties.query || '';
  const tableName = properties.tableName || '';
  const selectType = properties.selectType || (properties.tableName && !properties.query ? 'table' : 'query');
  const fetchSize = properties.fetchSize ?? '';
  const outputParallelization = properties.outputParallelization ?? false;
  const usePartitioning = properties.usePartitioning ?? false;
  const partitionColumn = properties.partitionColumn || '';
  const lowerBound = properties.lowerBound ?? '';
  const upperBound = properties.upperBound ?? '';
  const numPartitions = properties.numPartitions ?? '';

  const normalizedSecrets = (secrets || []).map(normalizeSecretItem);

  // Validation states
  const isDriverInvalid = !driverClassName.trim();
  const isUrlInvalid = !url.trim();
  const isQueryInvalid = selectType === 'query' && !query.trim();
  const isTableNameInvalid = selectType === 'table' && !tableName.trim();

  // System instructions text with default fallback
  const systemInstructions = resolveSystemInstructions(node);

  const exampleUrl = getJdbcUrlExample(driverClassName);

  /**
   * Handles generic text/checkbox input changes.
   */
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const isCheckbox = type === 'checkbox';
    const checked = isCheckbox ? (e.target as HTMLInputElement).checked : undefined;

    const newProperties = {
      ...properties,
      [name]: isCheckbox ? checked : value
    };

    // Ensure plaintext password is removed if present
    delete newProperties.password;

    if (name === 'passwordSecret') {
      if (!newProperties.passwordSecret) {
        delete newProperties.passwordSecret;
      }
    }

    if (name === 'selectType') {
      if (value === 'table') {
        delete newProperties.query;
      } else if (value === 'query') {
        delete newProperties.tableName;
      }
    }

    onChange(newProperties);
  };

  return (
    <div className="flex-1 flex flex-col gap-4">
      {/* Driver Class Name with friendly labels */}
      <div className="flex flex-col gap-2">
        <label htmlFor="jdbcDriverClassName" className="flex items-center text-xs font-bold uppercase text-slate-500">
          <span>Driver Class Name</span>
          <span className="text-red-400 ml-1 font-bold" title="Required">*</span>
          <InfoTooltip text="Fully qualified Java JDBC driver class name (e.g. org.postgresql.Driver or com.mysql.cj.jdbc.Driver)." />
        </label>
        <select
          id="jdbcDriverClassName"
          name="driverClassName"
          aria-required="true"
          aria-invalid={isDriverInvalid}
          value={driverClassName}
          onChange={handleChange}
          className={`bg-[#252836] text-white p-2 rounded border text-sm focus:outline-none ${
            isDriverInvalid
              ? 'border-red-500/80 focus:border-red-500'
              : 'border-slate-700 focus:border-blue-500'
          }`}
        >
          {JDBC_DRIVER_PRESETS.map((preset) => (
            <option key={preset.driverClass} value={preset.driverClass}>
              {preset.label}
            </option>
          ))}
        </select>
        {isDriverInvalid && (
          <span className="text-xs text-red-400">Driver class name is required.</span>
        )}
      </div>

      {/* JDBC Connection URL with dynamic example */}
      <div className="flex flex-col gap-2">
        <label htmlFor="jdbcUrl" className="flex items-center text-xs font-bold uppercase text-slate-500">
          <span>JDBC Connection URL</span>
          <span className="text-red-400 ml-1 font-bold" title="Required">*</span>
          <InfoTooltip text="JDBC database connection URL including host, port, and database name. Required." />
        </label>
        <input
          id="jdbcUrl"
          type="text"
          name="url"
          aria-required="true"
          aria-invalid={isUrlInvalid}
          value={url}
          onChange={handleChange}
          placeholder={exampleUrl}
          className={`bg-[#252836] text-white p-2 rounded border text-sm focus:outline-none font-mono ${
            isUrlInvalid
              ? 'border-red-500/80 focus:border-red-500'
              : 'border-slate-700 focus:border-blue-500'
          }`}
        />
        {isUrlInvalid ? (
          <span className="text-xs text-red-400">JDBC Connection URL is required.</span>
        ) : (
          <span className="text-xs text-slate-400">
            Example: <code className="text-slate-300 bg-slate-800/60 px-1 py-0.5 rounded">{exampleUrl}</code>
          </span>
        )}
      </div>

      {/* Credentials */}
      <div className="flex flex-col gap-3">
        <PropertyField
          id="jdbcUsername"
          name="username"
          label="Username Secret"
          tooltip="Select or enter the Google Cloud Secret Manager secret containing the database username."
          value={username}
          onChange={handleChange}
          placeholder="e.g. my-database-username"
          list="jdbc-source-username-secrets-list"
          datalist={normalizedSecrets.map((s) => ({ value: s.id, label: s.name }))}
          loading={secretsLoading}
          mono={true}
        />

        <PropertyField
          id="jdbcPasswordSecret"
          name="passwordSecret"
          label="Password Secret"
          tooltip="Select or enter the Google Cloud Secret Manager secret containing the database password."
          value={passwordSecret}
          onChange={handleChange}
          placeholder="e.g. my-database-password"
          list="jdbc-source-secrets-list"
          datalist={normalizedSecrets.map((s) => ({ value: s.id, label: s.name }))}
          error={secretError}
          loading={secretsLoading}
          helperText={
            <span>
              Values auto-populated from{' '}
              <code className="text-slate-300 bg-slate-800/60 px-1 py-0.5 rounded">
                gcloud secrets list
              </code>
            </span>
          }
        />
      </div>

      {/* Connection Properties */}
      <div className="flex flex-col gap-2">
        <label htmlFor="jdbcConnectionProperties" className="flex items-center text-xs font-bold uppercase text-slate-500">
          <span>Connection Properties</span>
          <InfoTooltip text="Optional key-value connection properties passed to JDBC driver (e.g. useSSL=false;socketTimeout=30)." />
        </label>
        <input
          id="jdbcConnectionProperties"
          type="text"
          name="connectionProperties"
          value={connectionProperties}
          onChange={handleChange}
          placeholder="useSSL=false;allowPublicKeyRetrieval=true"
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500 font-mono"
        />
      </div>

      {/* Select Type (SQL Statement or Table Name) */}
      <div className="flex flex-col gap-2">
        <label htmlFor="jdbcSourceSelectType" className="flex items-center text-xs font-bold uppercase text-slate-500">
          <span>Select Type</span>
          <InfoTooltip text="Choose whether to read via an explicit SQL SELECT query or by specifying a full table name." />
        </label>
        <select
          id="jdbcSourceSelectType"
          name="selectType"
          value={selectType}
          onChange={handleChange}
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
        >
          <option value="query">SQL Statement</option>
          <option value="table">Table Name</option>
        </select>
      </div>

      {/* Conditional SQL Statement or Table Name Field */}
      {selectType === 'query' ? (
        <div className="flex flex-col gap-2">
          <label htmlFor="jdbcQuery" className="flex items-center text-xs font-bold uppercase text-slate-500">
            <span>SQL Statement</span>
            <span className="text-red-400 ml-1 font-bold" title="Required">*</span>
            <InfoTooltip text="SQL query to execute for reading rows (e.g. SELECT * FROM my_table WHERE active = true). Required." />
          </label>
          <textarea
            id="jdbcQuery"
            name="query"
            aria-required="true"
            aria-invalid={isQueryInvalid}
            value={query}
            onChange={handleChange}
            placeholder="SELECT id, name, created_at FROM my_table WHERE active = 1"
            rows={3}
            className={`bg-[#252836] text-white p-2 rounded border text-sm focus:outline-none font-mono resize-y ${
              isQueryInvalid
                ? 'border-red-500/80 focus:border-red-500'
                : 'border-slate-700 focus:border-blue-500'
            }`}
          />
          {isQueryInvalid && (
            <span className="text-xs text-red-400">SQL Statement is required.</span>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <label htmlFor="jdbcTableName" className="flex items-center text-xs font-bold uppercase text-slate-500">
            <span>Table Name</span>
            <span className="text-red-400 ml-1 font-bold" title="Required">*</span>
            <InfoTooltip text="Database table name to read from. Required." />
          </label>
          <input
            id="jdbcTableName"
            type="text"
            name="tableName"
            aria-required="true"
            aria-invalid={isTableNameInvalid}
            value={tableName}
            onChange={handleChange}
            placeholder="my_table"
            className={`bg-[#252836] text-white p-2 rounded border text-sm focus:outline-none ${
              isTableNameInvalid
                ? 'border-red-500/80 focus:border-red-500'
                : 'border-slate-700 focus:border-blue-500'
            }`}
          />
          {isTableNameInvalid && (
            <span className="text-xs text-red-400">Table Name is required.</span>
          )}
        </div>
      )}

      {/* Fetch Size & Parallel Reads */}
      <div className="grid grid-cols-2 items-end gap-2">
        <div className="flex flex-col gap-2">
          <label htmlFor="jdbcFetchSize" className="flex items-center text-xs font-bold uppercase text-slate-500">
            <span>Fetch Size</span>
            <InfoTooltip text="JDBC statement fetch size hint for buffering rows from database." />
          </label>
          <input
            id="jdbcFetchSize"
            type="number"
            name="fetchSize"
            min="0"
            value={fetchSize}
            onChange={handleChange}
            placeholder="5000"
            className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="jdbcOutputParallelization" className="flex items-center text-xs font-bold uppercase text-slate-500">
            <span>Parallel Reads</span>
            <InfoTooltip text="Enables redistributing the read PCollection to break fusion and parallelize downstream steps." />
          </label>
          <div className="flex items-center h-[38px]">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                id="jdbcOutputParallelization"
                type="checkbox"
                name="outputParallelization"
                checked={outputParallelization}
                onChange={handleChange}
                className="w-4 h-4 rounded border-slate-700 text-blue-600 focus:ring-0 focus:ring-offset-0 bg-[#252836]"
              />
              <span className="text-xs text-slate-300">Enable</span>
            </label>
          </div>
        </div>
      </div>

      {/* Partitioned Reading Section */}
      <div className="p-3 bg-slate-800/40 rounded border border-slate-700/50 flex flex-col gap-3">
        <label htmlFor="jdbcUsePartitioning" className="flex items-center gap-2 cursor-pointer">
          <input
            id="jdbcUsePartitioning"
            type="checkbox"
            name="usePartitioning"
            checked={usePartitioning}
            onChange={handleChange}
            className="w-4 h-4 rounded border-slate-700 text-blue-600 focus:ring-0 focus:ring-offset-0 bg-[#252836]"
          />
          <span className="text-sm font-medium text-slate-300">Partitioned Parallel Reads</span>
          <InfoTooltip text="Partitions table reads using numeric ranges across multiple concurrent worker queries (readWithPartitions)." />
        </label>

        {usePartitioning && (
          <div className="flex flex-col gap-3 mt-1">
            <div className="flex flex-col gap-1">
              <label htmlFor="jdbcPartitionColumn" className="text-xs font-semibold text-slate-400">
                Partition Column
              </label>
              <input
                id="jdbcPartitionColumn"
                type="text"
                name="partitionColumn"
                value={partitionColumn}
                onChange={handleChange}
                placeholder="id"
                className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-3 items-end gap-2">
              <div className="flex flex-col gap-1">
                <label htmlFor="jdbcLowerBound" className="text-xs font-semibold text-slate-400">
                  Lower Bound
                </label>
                <input
                  id="jdbcLowerBound"
                  type="number"
                  name="lowerBound"
                  value={lowerBound}
                  onChange={handleChange}
                  placeholder="0"
                  className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="jdbcUpperBound" className="text-xs font-semibold text-slate-400">
                  Upper Bound
                </label>
                <input
                  id="jdbcUpperBound"
                  type="number"
                  name="upperBound"
                  value={upperBound}
                  onChange={handleChange}
                  placeholder="1000000"
                  className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="jdbcNumPartitions" className="text-xs font-semibold text-slate-400">
                  Partitions
                </label>
                <input
                  id="jdbcNumPartitions"
                  type="number"
                  name="numPartitions"
                  min="1"
                  value={numPartitions}
                  onChange={handleChange}
                  placeholder="10"
                  className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Code Generation Instructions Section at Bottom */}
      <SystemInstructionsField
        id="jdbcSourceSystemInstructions"
        value={systemInstructions}
        placeholder="Enter custom instructions for JDBC read code generation..."
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
