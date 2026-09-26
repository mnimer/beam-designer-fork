/**
 * DatabaseIOSourceProperties Component
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Renders the property configuration panel for generic DatabaseIO Source nodes.
 * Configures database ingestion for Apache Beam pipelines using the generic database access abstraction
 * (backed by Java JdbcIO.read() / JdbcIO.readWithPartitions() and Python/YAML apache_beam.io.jdbc.ReadFromJdbc).
 *
 * Architectural Decisions:
 * - Scoping & Beam SDK Mapping: Investigated DatabaseIO in Apache Beam (see Beam YAML documentation
 *   https://beam.apache.org/documentation/sdks/yaml/ and Python apache_beam.io.jdbc.ReadFromJdbc/WriteToJdbc).
 *   Beam does not have a single org.apache.beam.sdk.io.database.DatabaseIO class; "DatabaseIO" represents the
 *   generic, driver-agnostic database access abstraction backed by Java JdbcIO and Python/YAML ReadFromJdbc.
 * - Differentiation from dedicated JdbcIO: While JdbcIO assumes the user already knows low-level driver classes
 *   and connection URLs, DatabaseIO acts as a "pick-your-engine" node. It provides a primary Database Engine selector
 *   (PostgreSQL, MySQL, SQL Server, Oracle, Generic JDBC) that dynamically provisions recommended driver class names,
 *   port defaults, URL templates, and SSL conventions while preserving user manual overrides.
 * - Real-time validation: Requires JDBC URL and driver class name, and enforces that either a SELECT query or a table
 *   name is provided for data extraction.
 * - Parallel partitioned reads: Supports partitionColumn, lowerBound, upperBound, and splitCount/numPartitions.
 * - Authentication: Provides 'none' vs 'secret_manager' mode with username/password secrets resolved via 'getSecrets' IPC.
 * - Collapsible Advanced Source Settings: connection properties, connection timeout, SSL mode, and driver JAR hints.
 * - Preserves system_instructions / special_instructions fallback chain for LLM code generation.
 * - Follows the 8pt grid system and Tailwind CSS styling using VS Code theme tokens.
 */

import React, { useState } from 'react';
import { InfoTooltip } from '../../components/InfoTooltip';
import { PropertyField } from '../../components/common/PropertyField';
import { useAssetLoader } from '../../hooks/useAssetLoader';
import { normalizeSecretItem } from '../../components/common/SecretManagerAuthFields';

export interface SecretItem {
  id: string;
  name: string;
  fullName?: string;
}

export type DatabaseEngine = 'postgresql' | 'mysql' | 'sqlserver' | 'oracle' | 'generic';

export interface DatabaseEnginePreset {
  label: string;
  defaultDriver: string;
  urlTemplate: string;
  defaultPort: number;
}

export const DATABASE_ENGINES: Record<DatabaseEngine, DatabaseEnginePreset> = {
  postgresql: {
    label: 'PostgreSQL',
    defaultDriver: 'org.postgresql.Driver',
    urlTemplate: 'jdbc:postgresql://localhost:5432/mydb',
    defaultPort: 5432
  },
  mysql: {
    label: 'MySQL',
    defaultDriver: 'com.mysql.cj.jdbc.Driver',
    urlTemplate: 'jdbc:mysql://localhost:3306/mydb',
    defaultPort: 3306
  },
  sqlserver: {
    label: 'Microsoft SQL Server',
    defaultDriver: 'com.microsoft.sqlserver.jdbc.SQLServerDriver',
    urlTemplate: 'jdbc:sqlserver://localhost:1433;databaseName=mydb',
    defaultPort: 1433
  },
  oracle: {
    label: 'Oracle Database',
    defaultDriver: 'oracle.jdbc.driver.OracleDriver',
    urlTemplate: 'jdbc:oracle:thin:@localhost:1521:xe',
    defaultPort: 1521
  },
  generic: {
    label: 'Generic JDBC',
    defaultDriver: '',
    urlTemplate: 'jdbc:<subprotocol>://<host>:<port>/<database>',
    defaultPort: 5432
  }
};

export const SSL_MODES = [
  { value: 'disable', label: 'Disable' },
  { value: 'require', label: 'Require' },
  { value: 'verify-ca', label: 'Verify CA' },
  { value: 'verify-full', label: 'Verify Full' },
  { value: 'prefer', label: 'Prefer' }
];

export interface DatabaseIOSourcePropertiesProps {
  node: {
    data: {
      label?: string;
      beam_transform?: string;
      system_instructions?: string;
      special_instructions?: string;
      properties?: {
        engine?: DatabaseEngine;
        databaseEngine?: DatabaseEngine;
        url?: string;
        jdbcUrl?: string;
        driverClassName?: string;
        database?: string;
        schema?: string;
        table?: string;
        tableName?: string;
        query?: string;
        fetchSize?: number | string;
        partitionColumn?: string;
        lowerBound?: number | string;
        upperBound?: number | string;
        splitCount?: number | string;
        partitionCount?: number | string;
        numPartitions?: number | string;
        authMode?: 'none' | 'secret_manager';
        usernameSecret?: string;
        passwordSecret?: string;
        connectionProperties?: string;
        connectTimeout?: number | string;
        sslMode?: string;
        driverJars?: string;
        system_instructions?: string;
        special_instructions?: string;
        [key: string]: any;
      };
    };
  };
  onChange: (properties: any) => void;
}

/**
 * Presentational component for parallel partition bounds configuration.
 */
interface PartitionSectionProps {
  partitionColumn: string;
  lowerBound: number | string;
  upperBound: number | string;
  splitCount: number | string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}

const PartitionSection: React.FC<PartitionSectionProps> = ({
  partitionColumn,
  lowerBound,
  upperBound,
  splitCount,
  onChange
}) => (
  <div className="flex flex-col gap-3 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
    <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
      <span>Parallel Partitioning</span>
      <InfoTooltip text="Range partitioning configuration for parallel reads via JdbcIO.readWithPartitions()." />
    </label>

    <PropertyField
      id="dbSourcePartitionColumn"
      name="partitionColumn"
      label="Partition Column"
      tooltip="Integer column used for parallel splitting."
      value={partitionColumn}
      onChange={onChange}
      placeholder="e.g. id"
      mono={true}
    />

    <div className="grid grid-cols-3 gap-2">
      <PropertyField
        id="dbSourceLowerBound"
        name="lowerBound"
        label="Lower Bound"
        type="number"
        tooltip="Lower bound value for partition column."
        value={lowerBound}
        onChange={onChange}
        placeholder="1"
        mono={true}
      />
      <PropertyField
        id="dbSourceUpperBound"
        name="upperBound"
        label="Upper Bound"
        type="number"
        tooltip="Upper bound value for partition column."
        value={upperBound}
        onChange={onChange}
        placeholder="1000000"
        mono={true}
      />
      <PropertyField
        id="dbSourceSplitCount"
        name="splitCount"
        label="Partition Count"
        type="number"
        tooltip="Number of parallel partitions to generate."
        value={splitCount}
        onChange={onChange}
        placeholder="10"
        mono={true}
      />
    </div>
  </div>
);

/**
 * Presentational component for collapsible advanced database source settings.
 */
interface AdvancedSourceSectionProps {
  showAdvanced: boolean;
  onToggle: () => void;
  connectTimeout: number | string;
  sslMode: string;
  connectionProperties: string;
  driverJars: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}

const AdvancedSourceSection: React.FC<AdvancedSourceSectionProps> = ({
  showAdvanced,
  onToggle,
  connectTimeout,
  sslMode,
  connectionProperties,
  driverJars,
  onChange
}) => (
  <div className="flex flex-col border border-[var(--vscode-border-light)] rounded-md overflow-hidden">
    <button
      type="button"
      onClick={onToggle}
      className="flex items-center justify-between p-2 bg-[var(--vscode-subcard-bg)] text-xs font-bold uppercase text-[var(--vscode-text-muted)] hover:text-[var(--vscode-text-primary)] transition-colors cursor-pointer"
    >
      <span>Advanced Source Settings</span>
      <span>{showAdvanced ? '▲' : '▼'}</span>
    </button>

    {showAdvanced && (
      <div className="p-3 bg-[var(--vscode-workbench-bg)] flex flex-col gap-3 border-t border-[var(--vscode-border-light)]">
        <div className="grid grid-cols-2 gap-2">
          <PropertyField
            id="dbSourceConnectTimeout"
            name="connectTimeout"
            label="Connect Timeout (s)"
            type="number"
            tooltip="Connection timeout in seconds."
            value={connectTimeout}
            onChange={onChange}
            placeholder="30"
            mono={true}
          />

          <div className="flex flex-col gap-1">
            <label
              htmlFor="dbSourceSslMode"
              className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]"
            >
              <span>SSL Mode</span>
              <InfoTooltip text="Database SSL connection negotiation strategy." />
            </label>
            <select
              id="dbSourceSslMode"
              name="sslMode"
              value={sslMode}
              onChange={onChange}
              className="bg-[var(--vscode-input-bg)] text-[var(--vscode-text-primary)] p-2 rounded border border-[var(--vscode-border)] text-xs focus:outline-none focus:border-[var(--vscode-highlight)] font-mono"
            >
              {SSL_MODES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <PropertyField
          id="dbSourceDriverJars"
          name="driverJars"
          label="Driver JARs / Classpath"
          tooltip="Optional comma-delimited path or GCS URI to JDBC driver JARs for workers."
          value={driverJars}
          onChange={onChange}
          placeholder="e.g. gs://my-bucket/jars/mysql-connector.jar"
          mono={true}
        />

        <PropertyField
          id="dbSourceConnectionProperties"
          name="connectionProperties"
          label="Extra Connection Properties"
          type="textarea"
          rows={3}
          tooltip="Custom JDBC connection properties as key=value pairs per line."
          value={connectionProperties}
          onChange={onChange}
          placeholder="ssl=true&#10;tcpKeepAlive=true"
          mono={true}
        />
      </div>
    )}
  </div>
);

/**
 * DatabaseIOSourceProperties renders the configuration form for generic database ingestion.
 *
 * @param props - Component props containing the active node data and onChange dispatch callback.
 */
export const DatabaseIOSourceProperties: React.FC<DatabaseIOSourcePropertiesProps> = ({ node, onChange }) => {
  const properties = node.data.properties || {};

  // Form field state extracted from node properties
  const engine = (properties.engine || properties.databaseEngine || 'postgresql') as DatabaseEngine;
  const url = properties.url ?? properties.jdbcUrl ?? '';
  const driverClassName = properties.driverClassName ?? (DATABASE_ENGINES[engine]?.defaultDriver || '');
  const database = properties.database ?? properties.schema ?? '';
  const table = properties.table ?? properties.tableName ?? '';
  const query = properties.query ?? '';
  const fetchSize = properties.fetchSize ?? '';
  const partitionColumn = properties.partitionColumn ?? '';
  const lowerBound = properties.lowerBound ?? '';
  const upperBound = properties.upperBound ?? '';
  const splitCount = properties.splitCount ?? properties.partitionCount ?? properties.numPartitions ?? '';
  const authMode = properties.authMode ?? 'none';
  const usernameSecret = properties.usernameSecret ?? '';
  const passwordSecret = properties.passwordSecret ?? '';
  const connectionProperties = properties.connectionProperties ?? '';
  const connectTimeout = properties.connectTimeout ?? '';
  const sslMode = properties.sslMode ?? 'disable';
  const driverJars = properties.driverJars ?? '';

  // Local UI state
  const { items: rawSecrets, error: secretError } = useAssetLoader<SecretItem | string>('secrets');
  const secrets: SecretItem[] = (rawSecrets || []).map(normalizeSecretItem);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Field validation
  const isUrlEmpty = !String(url).trim();
  const isDriverEmpty = !String(driverClassName).trim();
  const isTableOrQueryEmpty = !String(table).trim() && !String(query).trim();

  // NOTE: Fallback chain for system instructions per architecture spec
  const systemInstructions =
    node.data.system_instructions ??
    node.data.special_instructions ??
    properties.system_instructions ??
    properties.special_instructions ??
    '';

  /**
   * Updates a single property key and invokes onChange while pruning legacy alias keys.
   *
   * @param name - The property field name to update.
   * @param value - The new value for the property.
   */
  const updateProperty = (name: string, value: any) => {
    // NOTE: Controlled update pruning legacy alias keys to maintain single source of truth
    const updated = { ...properties, [name]: value };
    if (name === 'url') {
      delete updated.jdbcUrl;
    } else if (name === 'table') {
      delete updated.tableName;
    } else if (name === 'engine') {
      delete updated.databaseEngine;
    } else if (name === 'splitCount') {
      delete updated.partitionCount;
      delete updated.numPartitions;
    }
    onChange(updated);
  };

  /**
   * Handles database engine change and populates suggested driver and URL template.
   *
   * @param e - Change event from engine select.
   */
  const handleEngineChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newEngine = e.target.value as DatabaseEngine;
    const preset = DATABASE_ENGINES[newEngine] || DATABASE_ENGINES.generic;

    // NOTE: Check if user hasn't heavily customized the URL or driver before auto-updating
    const currentPreset = DATABASE_ENGINES[engine];
    const shouldUpdateDriver =
      !driverClassName || (currentPreset && driverClassName === currentPreset.defaultDriver);
    const shouldUpdateUrl = !url || (currentPreset && url === currentPreset.urlTemplate);

    const updated = {
      ...properties,
      engine: newEngine,
      ...(shouldUpdateDriver && preset.defaultDriver ? { driverClassName: preset.defaultDriver } : {}),
      ...(shouldUpdateUrl && preset.urlTemplate ? { url: preset.urlTemplate } : {})
    };
    delete updated.databaseEngine;
    onChange(updated);
  };

  /**
   * Handles text, number, and checkbox changes.
   *
   * @param e - React change event.
   */
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      updateProperty(name, checked);
    } else {
      updateProperty(name, value);
    }
  };

  /**
   * Handles system instructions change.
   *
   * @param e - Textarea change event.
   */
  const handleInstructionsChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    onChange({
      ...properties,
      system_instructions: e.target.value
    });
  };

  return (
    <div className="flex-1 flex flex-col gap-4 text-[var(--vscode-text-primary)] text-sm">
      {/* Database Engine Selector */}
      <div className="flex flex-col gap-2 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
        <label
          htmlFor="dbSourceEngine"
          className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]"
        >
          <span>Database Engine</span>
          <InfoTooltip text="Select the target database engine to automatically configure driver defaults and URL templates." />
        </label>
        <select
          id="dbSourceEngine"
          name="engine"
          value={engine}
          onChange={handleEngineChange}
          className="bg-[var(--vscode-input-bg)] text-[var(--vscode-text-primary)] p-2 rounded border border-[var(--vscode-border)] text-xs focus:outline-none focus:border-[var(--vscode-highlight)]"
        >
          {Object.entries(DATABASE_ENGINES).map(([key, item]) => (
            <option key={key} value={key}>
              {item.label}
            </option>
          ))}
        </select>
      </div>

      {/* Connection Endpoint & Driver */}
      <div className="flex flex-col gap-3 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
        <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          <span>Connection Endpoint</span>
          <InfoTooltip text="JDBC connection details for the database source." />
        </label>

        <PropertyField
          id="dbSourceUrl"
          name="url"
          label="JDBC URL"
          required="JDBC URL is required"
          tooltip="Standard JDBC connection URL for your database engine."
          value={url}
          invalid={isUrlEmpty}
          error={isUrlEmpty ? 'JDBC URL is required' : null}
          placeholder={DATABASE_ENGINES[engine]?.urlTemplate || 'jdbc:<subprotocol>://<host>:<port>/<db>'}
          onChange={handleChange}
          mono={true}
        />

        <PropertyField
          id="dbSourceDriverClassName"
          name="driverClassName"
          label="Driver Class Name"
          required="Driver class name is required"
          tooltip="Fully-qualified class name of the JDBC driver."
          value={driverClassName}
          invalid={isDriverEmpty}
          error={isDriverEmpty ? 'Driver class name is required' : null}
          placeholder="org.postgresql.Driver"
          onChange={handleChange}
          mono={true}
        />

        <div className="grid grid-cols-2 gap-2">
          <PropertyField
            id="dbSourceDatabase"
            name="database"
            label="Database / Schema"
            tooltip="Optional target database or schema name."
            value={database}
            onChange={handleChange}
            placeholder="mydb"
            mono={true}
          />
          <PropertyField
            id="dbSourceFetchSize"
            name="fetchSize"
            label="Fetch Size"
            type="number"
            tooltip="Number of rows fetched per network round-trip via withFetchSize()."
            value={fetchSize}
            onChange={handleChange}
            placeholder="50000"
            mono={true}
          />
        </div>
      </div>

      {/* Target Table or SELECT Query */}
      <div className="flex flex-col gap-3 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
        <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          <span>Data Extraction (Table or Query)</span>
          <InfoTooltip text="Provide either a SELECT query or a table name to extract records from." />
        </label>

        <PropertyField
          id="dbSourceTable"
          name="table"
          label="Table Name"
          tooltip="Database table to read from (if query is omitted)."
          value={table}
          onChange={handleChange}
          placeholder="e.g. customers"
          mono={true}
        />

        <PropertyField
          id="dbSourceQuery"
          name="query"
          label="SELECT Query"
          tooltip="Custom SQL SELECT statement executed to read data."
          type="textarea"
          rows={3}
          value={query}
          invalid={isTableOrQueryEmpty}
          error={isTableOrQueryEmpty ? 'Either a Table Name or a SELECT query is required' : null}
          placeholder="SELECT id, name, created_at FROM customers WHERE active = true"
          onChange={handleChange}
          mono={true}
        />
      </div>

      {/* Partitioning Section */}
      <PartitionSection
        partitionColumn={partitionColumn}
        lowerBound={lowerBound}
        upperBound={upperBound}
        splitCount={splitCount}
        onChange={handleChange}
      />

      {/* Authentication */}
      <div className="flex flex-col gap-2 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
        <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          <span>Authentication</span>
          <InfoTooltip text="Select authentication strategy: None or Google Cloud Secret Manager." />
        </label>
        <div className="flex gap-4 mt-1">
          <label className="flex items-center gap-1.5 cursor-pointer text-xs text-[var(--vscode-text-secondary)]">
            <input
              type="radio"
              name="authMode"
              value="none"
              checked={authMode === 'none'}
              onChange={handleChange}
              className="accent-[var(--vscode-highlight)]"
            />
            <span>None</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer text-xs text-[var(--vscode-text-secondary)]">
            <input
              type="radio"
              name="authMode"
              value="secret_manager"
              checked={authMode === 'secret_manager'}
              onChange={handleChange}
              className="accent-[var(--vscode-highlight)]"
            />
            <span>Secret Manager</span>
          </label>
        </div>

        {authMode === 'secret_manager' && (
          <div className="flex flex-col gap-3 mt-2 pl-2 border-l-2 border-[var(--vscode-highlight)]/50">
            {secretError && (
              <span className="text-xs text-[var(--vscode-errorForeground)]" role="alert">
                Failed to load secrets: {secretError}
              </span>
            )}
            <PropertyField
              id="dbSourceUsernameSecret"
              name="usernameSecret"
              label="Username Secret"
              tooltip="GCP Secret Manager secret containing database username."
              value={usernameSecret}
              onChange={handleChange}
              list="databaseio-source-secret-options"
              datalist={secrets.map((s) => ({ value: s.id || s.name, label: s.name || s.id }))}
              placeholder="e.g. db-username"
              mono={true}
            />
            <PropertyField
              id="dbSourcePasswordSecret"
              name="passwordSecret"
              label="Password Secret"
              tooltip="GCP Secret Manager secret containing database password."
              value={passwordSecret}
              onChange={handleChange}
              list="databaseio-source-secret-options"
              datalist={secrets.map((s) => ({ value: s.id || s.name, label: s.name || s.id }))}
              placeholder="e.g. db-password"
              mono={true}
            />
          </div>
        )}
      </div>

      {/* Advanced Source Settings */}
      <AdvancedSourceSection
        showAdvanced={showAdvanced}
        onToggle={() => setShowAdvanced(!showAdvanced)}
        connectTimeout={connectTimeout}
        sslMode={sslMode}
        connectionProperties={connectionProperties}
        driverJars={driverJars}
        onChange={handleChange}
      />

      {/* Flexible Spacer */}
      <div className="flex-1 min-h-[16px]" />

      {/* Code Generation Instructions */}
      <PropertyField
        id="dbSourceInstructions"
        name="system_instructions"
        label="Code Generation Instructions"
        tooltip="Optional instructions passed to LLM code generator when synthesizing database ingestion pipelines."
        type="textarea"
        rows={3}
        value={systemInstructions}
        onChange={handleInstructionsChange}
        placeholder="e.g. Read records using JdbcIO with custom RowMapper or Python ReadFromJdbc"
        mono={true}
      />
    </div>
  );
};
