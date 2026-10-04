/**
 * ClickHouseIOSourceProperties Component
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Renders the property configuration panel for ClickHouse Database Source nodes.
 * NOTE: Apache Beam does NOT provide a native ClickHouseIO.read() transform (ClickHouseIO is write-only).
 * ClickHouse read operations are executed via the ClickHouse JDBC driver (com.clickhouse.jdbc.ClickHouseDriver
 * or ru.yandex.clickhouse.ClickHouseDriver) using Beam's JdbcIO.read() / JdbcIO.readWithPartitions().
 *
 * Architectural Decisions:
 * - Directs the code generator to emit JdbcIO reading over the ClickHouse JDBC driver with a SELECT query.
 * - Enforces required fields: ClickHouse JDBC URL (must start with jdbc:clickhouse:) and SELECT query.
 * - Supports parallel partitioned reads via partitionColumn, lowerBound, upperBound, and splitCount.
 * - Dynamic discovery: Loads GCP Secret Manager secrets via 'getSecrets' IPC message to populate datalist.
 * - Secret normalization supports both raw resource strings and SecretItem objects with short ID extraction.
 * - Collapsible Advanced Source Settings: socket timeout, connection timeout, compression, extra JDBC properties.
 * - Preserves system_instructions / special_instructions fallback chain for LLM code generation.
 * - Follows the 8pt grid system and Tailwind CSS styling using VS Code theme tokens.
 */

import React, { useState } from 'react';
import { CollapsibleSection } from '../../components/common/CollapsibleSection';
import { InfoTooltip } from '../../components/InfoTooltip';
import { PropertyField } from '../../components/common/PropertyField';
import { SystemInstructionsField } from '../../components/common/SystemInstructionsField';
import { resolveSystemInstructions } from '../../utils/systemInstructions';
import { MappingStrategyField, type MappingStrategy } from '../../components/common/MappingStrategyField';
import { resolveSchemaFields, type SchemaField } from '../../components/common/SchemaEditor';
import { useAssetLoader } from '../../hooks/useAssetLoader';
import { normalizeSecretItem } from '../../components/common/SecretManagerAuthFields';

/** Secret descriptor loaded from the secret manager for ClickHouse authentication. */
export interface SecretItem {
  id: string;
  name: string;
  fullName?: string;
}

/** Props for the {@link ClickHouseIOSourceProperties} component. */
export interface ClickHouseIOSourcePropertiesProps {
  node: {
    data: {
      label?: string;
      beam_transform?: string;
      system_instructions?: string;
      special_instructions?: string;
      properties?: {
        url?: string;
        jdbcUrl?: string;
        driverClassName?: string;
        database?: string;
        table?: string;
        tableName?: string;
        query?: string;
        mapperStrategy?: MappingStrategy | string;
        rowMapper?: string;
        schemaString?: string;
        schema?: string;
        schemaFields?: SchemaField[];
        fetchSize?: number | string;
        partitionColumn?: string;
        lowerBound?: number | string;
        upperBound?: number | string;
        splitCount?: number | string;
        numPartitions?: number | string;
        authMode?: 'none' | 'secret_manager';
        usernameSecret?: string;
        passwordSecret?: string;
        socketTimeout?: number | string;
        connectionTimeout?: number | string;
        compress?: boolean;
        extraJdbcProperties?: string;
        connectionProperties?: string;
        system_instructions?: string;
        special_instructions?: string;
        [key: string]: any;
      };
    };
  };
  onChange: (properties: any) => void;
}

/**
 * ClickHouseIOSourceProperties renders the configuration form for ClickHouse database reading via JDBC.
 *
 * @param props - Component props containing the active node data and onChange dispatch callback.
 */
export const ClickHouseIOSourceProperties: React.FC<ClickHouseIOSourcePropertiesProps> = ({ node, onChange }) => {
  const properties = node.data.properties || {};

  // Form field state extracted from node properties
  const url = properties.url ?? properties.jdbcUrl ?? '';
  const driverClassName = properties.driverClassName || 'com.clickhouse.jdbc.ClickHouseDriver';
  const database = properties.database ?? '';
  const table = properties.table ?? properties.tableName ?? '';
  const query = properties.query ?? '';
  const rowMapper = properties.rowMapper ?? '';
  const mapperStrategy = properties.mapperStrategy || (properties.rowMapper ? 'customClass' : 'infer');
  const schemaFields = React.useMemo(
    () => resolveSchemaFields(properties),
    [properties.schemaFields, properties.schema, properties.schemaString]
  );
  const fetchSize = properties.fetchSize ?? '';
  const partitionColumn = properties.partitionColumn ?? '';
  const lowerBound = properties.lowerBound ?? '';
  const upperBound = properties.upperBound ?? '';
  const splitCount = properties.splitCount ?? properties.numPartitions ?? '';
  const authMode = properties.authMode ?? 'none';
  const usernameSecret = properties.usernameSecret ?? '';
  const passwordSecret = properties.passwordSecret ?? '';
  const socketTimeout = properties.socketTimeout ?? '';
  const connectionTimeout = properties.connectionTimeout ?? '';
  const compress = properties.compress ?? false;
  const extraJdbcProperties = properties.extraJdbcProperties ?? properties.connectionProperties ?? '';

  // Local state for dynamically loaded Secret Manager secrets and UI state
  const { items: rawSecrets, error: secretError } = useAssetLoader<SecretItem | string>('secrets');
  const secrets: SecretItem[] = (rawSecrets || []).map(normalizeSecretItem);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Field validation
  const isUrlEmpty = !String(url).trim();
  const isUrlFormatWarning = !isUrlEmpty && !String(url).trim().startsWith('jdbc:clickhouse:');
  const isQueryEmpty = !String(query).trim();

  // NOTE: Fallback chain for system instructions per architecture spec
  const systemInstructions = resolveSystemInstructions(node);

  /**
   * Updates a single property key and invokes the parent onChange callback.
   *
   * @param name - The property field name to update.
   * @param value - The new value for the property.
   */
  const updateProperty = (name: string, value: any) => {
    // NOTE: Controlled update creating a new properties dictionary while removing legacy alias keys to prevent desync
    const updated = { ...properties, [name]: value };
    if (name === 'url') {
      delete updated.jdbcUrl;
    } else if (name === 'table') {
      delete updated.tableName;
    } else if (name === 'splitCount') {
      delete updated.numPartitions;
    } else if (name === 'extraJdbcProperties') {
      delete updated.connectionProperties;
    }
    onChange(updated);
  };

  /**
   * Handles text, number, and checkbox change events.
   *
   * @param e - React change event from inputs or textareas.
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

  const handleSchemaChange = (data: { schemaFields: SchemaField[]; schema: string; schemaString: string }) => {
    onChange({
      ...properties,
      schemaFields: data.schemaFields,
      schema: data.schema,
      schemaString: data.schemaString
    });
  };

  return (
    <div className="flex-1 flex flex-col gap-4 text-[var(--vscode-text-primary)] text-sm">
      {/* Notice Banner explaining JDBC-based read model */}
      <div className="p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)] text-xs text-[var(--vscode-descriptionForeground)]">
        <span className="font-semibold text-[var(--vscode-text-primary)]">Notice: </span>
        Apache Beam does not provide a native ClickHouseIO.read transform. This source executes queries via Beam&apos;s
        JdbcIO using the ClickHouse JDBC driver.
      </div>

      {/* ClickHouse JDBC Connection URL */}
      <PropertyField
        id="clickhouseSourceUrl"
        name="url"
        label="JDBC URL"
        required="ClickHouse JDBC URL is required"
        tooltip="ClickHouse JDBC connection URL (e.g. jdbc:clickhouse://localhost:8123/default). Required."
        value={url}
        invalid={isUrlEmpty}
        error={isUrlEmpty ? 'ClickHouse JDBC URL is required' : null}
        helperText={
          isUrlFormatWarning ? (
            <span className="text-amber-400" role="alert">
              Warning: ClickHouse JDBC URL should start with &quot;jdbc:clickhouse:&quot;
            </span>
          ) : null
        }
        placeholder="jdbc:clickhouse://localhost:8123/default"
        onChange={handleChange}
        mono={true}
      />

      {/* Driver, Database, Table */}
      <div className="flex flex-col gap-3 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
        <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          <span>Driver &amp; Database Target</span>
          <InfoTooltip text="Configures the ClickHouse JDBC driver class and target database and table references." />
        </label>

        <PropertyField
          id="clickhouseSourceDriverClassName"
          name="driverClassName"
          label="Driver Class Name"
          tooltip="Fully-qualified class name of ClickHouse JDBC driver (default: com.clickhouse.jdbc.ClickHouseDriver)."
          value={driverClassName}
          onChange={handleChange}
          placeholder="com.clickhouse.jdbc.ClickHouseDriver"
          mono={true}
        />

        <div className="grid grid-cols-2 gap-2">
          <PropertyField
            id="clickhouseSourceDatabase"
            name="database"
            label="Database"
            tooltip="Target ClickHouse database name (e.g. default)."
            value={database}
            onChange={handleChange}
            placeholder="default"
            mono={true}
          />
          <PropertyField
            id="clickhouseSourceTable"
            name="table"
            label="Table Name"
            tooltip="Target ClickHouse table name (e.g. events)."
            value={table}
            onChange={handleChange}
            placeholder="my_table"
            mono={true}
          />
        </div>
      </div>

      {/* SELECT Query & Row Mapper */}
      <div className="flex flex-col gap-3 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
        <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          <span>Query Configuration</span>
          <InfoTooltip text="SQL SELECT statement to extract records from ClickHouse and optional row mapper class." />
        </label>

        <PropertyField
          id="clickhouseSourceQuery"
          name="query"
          label="SELECT Query"
          required="SELECT query is required"
          tooltip="SQL query executed against ClickHouse to read elements. Required."
          type="textarea"
          rows={3}
          value={query}
          invalid={isQueryEmpty}
          error={isQueryEmpty ? 'SELECT query is required' : null}
          placeholder="SELECT id, name, timestamp FROM my_table"
          onChange={handleChange}
          mono={true}
        />

        <MappingStrategyField
          id="clickhouseSourceMapperStrategy"
          strategyName="mapperStrategy"
          strategy={mapperStrategy}
          label="Row Mapping Strategy"
          tooltip="Select how ClickHouse JDBC ResultSet rows map to Beam PCollection elements. 'Auto-Infer' lets Gemini synthesize an inline JdbcIO.RowMapper<Row> from your SELECT query. 'Define Schema' specifies exact typed fields. 'Custom Class' references a compiled RowMapper class."
          optionLabels={{
            customClass: 'Custom RowMapper Class Name (Optional)'
          }}
          inferDescription={
            <>
              Gemini will automatically synthesize an inline{' '}
              <code className="text-slate-200 bg-slate-800/80 px-1 py-0.5 rounded">JdbcIO.RowMapper&lt;Row&gt;</code>{' '}
              matching the columns selected in your ClickHouse SQL query.
            </>
          }
          schemaFields={schemaFields}
          schemaStringPlaceholder="id:BIGINT:REQUIRED, name:STRING, timestamp:TIMESTAMP"
          onSchemaChange={handleSchemaChange}
          customClassId="clickhouseSourceRowMapper"
          customClassName="rowMapper"
          customClassLabel="Row Mapper Class"
          customClassTooltip="Optional custom JdbcIO.RowMapper class name mapping ResultSet rows to domain objects."
          customClassPlaceholder="com.example.ClickHouseRowMapper"
          customClassValue={rowMapper}
          onChange={handleChange}
        />
      </div>

      {/* Fetch Size & Parallel Partitioning */}
      <div className="flex flex-col gap-3 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
        <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          <span>Fetch Size &amp; Partitioning</span>
          <InfoTooltip text="Streaming fetch size to prevent memory pressure, and parallel split bounds for JdbcIO.readWithPartitions()." />
        </label>

        <PropertyField
          id="clickhouseSourceFetchSize"
          name="fetchSize"
          label="Fetch Size"
          type="number"
          tooltip="Statement fetch size via JdbcIO.Read.withFetchSize() to stream rows incrementally."
          value={fetchSize}
          onChange={handleChange}
          placeholder="50000"
          mono={true}
        />

        <PropertyField
          id="clickhouseSourcePartitionColumn"
          name="partitionColumn"
          label="Partition Column"
          tooltip="Numeric/integer column for parallel range splitting via JdbcIO.readWithPartitions()."
          value={partitionColumn}
          onChange={handleChange}
          placeholder="id"
          mono={true}
        />

        <div className="grid grid-cols-3 gap-2">
          <PropertyField
            id="clickhouseSourceLowerBound"
            name="lowerBound"
            label="Lower Bound"
            type="number"
            tooltip="Lower bound for partition column range."
            value={lowerBound}
            onChange={handleChange}
            placeholder="1"
            mono={true}
          />
          <PropertyField
            id="clickhouseSourceUpperBound"
            name="upperBound"
            label="Upper Bound"
            type="number"
            tooltip="Upper bound for partition column range."
            value={upperBound}
            onChange={handleChange}
            placeholder="1000000"
            mono={true}
          />
          <PropertyField
            id="clickhouseSourceSplitCount"
            name="splitCount"
            label="Split Count"
            type="number"
            tooltip="Number of parallel partitions to generate."
            value={splitCount}
            onChange={handleChange}
            placeholder="10"
            mono={true}
          />
        </div>
      </div>

      {/* Authentication */}
      <div className="flex flex-col gap-2 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
        <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          <span>Authentication</span>
          <InfoTooltip text="Select authentication strategy for ClickHouse JDBC connection: None or Google Cloud Secret Manager." />
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
              id="clickhouseSourceUsernameSecret"
              name="usernameSecret"
              label="Username Secret"
              tooltip="GCP Secret Manager secret holding ClickHouse username."
              value={usernameSecret}
              onChange={handleChange}
              list="clickhouse-source-secret-options"
              datalist={secrets.map((s) => ({ value: s.id || s.name, label: s.name || s.id }))}
              placeholder="e.g. clickhouse-username"
              mono={true}
            />
            <PropertyField
              id="clickhouseSourcePasswordSecret"
              name="passwordSecret"
              label="Password Secret"
              tooltip="GCP Secret Manager secret holding ClickHouse password."
              value={passwordSecret}
              onChange={handleChange}
              list="clickhouse-source-secret-options"
              datalist={secrets.map((s) => ({ value: s.id || s.name, label: s.name || s.id }))}
              placeholder="e.g. clickhouse-password"
              mono={true}
            />
          </div>
        )}
      </div>

      {/* Collapsible Advanced Source Settings */}
      <CollapsibleSection
        title="Advanced Source Settings"
        isOpen={showAdvanced}
        onToggle={() => setShowAdvanced(!showAdvanced)}
      >
        <div className="grid grid-cols-2 gap-2">
          <PropertyField
            id="clickhouseSourceSocketTimeout"
            name="socketTimeout"
            label="Socket Timeout (ms)"
            type="number"
            tooltip="ClickHouse JDBC socket timeout in milliseconds (socket_timeout)."
            value={socketTimeout}
            onChange={handleChange}
            placeholder="30000"
            mono={true}
          />
          <PropertyField
            id="clickhouseSourceConnectionTimeout"
            name="connectionTimeout"
            label="Connection Timeout (ms)"
            type="number"
            tooltip="ClickHouse JDBC connection timeout in milliseconds (connection_timeout)."
            value={connectionTimeout}
            onChange={handleChange}
            placeholder="10000"
            mono={true}
          />
        </div>

        <div className="flex items-center gap-2 p-2 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
          <input
            id="clickhouseSourceCompress"
            type="checkbox"
            name="compress"
            checked={compress}
            onChange={handleChange}
            className="rounded border-[var(--vscode-border)] text-[var(--vscode-highlight)] accent-[var(--vscode-highlight)] focus:ring-0 cursor-pointer"
          />
          <label
            htmlFor="clickhouseSourceCompress"
            className="flex items-center gap-1.5 text-xs text-[var(--vscode-text-secondary)] cursor-pointer"
          >
            <span>Enable Compression</span>
            <InfoTooltip text="Enables LZ4 transport compression (compress=1) for query data transfer between ClickHouse and Beam workers." />
          </label>
        </div>

        <PropertyField
          id="clickhouseSourceExtraJdbcProperties"
          name="extraJdbcProperties"
          label="Extra JDBC Properties"
          type="textarea"
          rows={3}
          tooltip="Additional ClickHouse JDBC connection parameters specified as key=value pairs per line."
          value={extraJdbcProperties}
          onChange={handleChange}
          placeholder="ssl=true&#10;sslmode=strict&#10;max_execution_time=60"
          mono={true}
        />
      </CollapsibleSection>

      {/* Code Generation Instructions */}
      <SystemInstructionsField
        id="clickhouseSourceInstructions"
        value={systemInstructions}
        tooltip="Optional instructions passed to LLM code generator. Explicitly notes that reading uses JdbcIO with ClickHouse JDBC driver (ClickHouseIO is write-only)."
        placeholder="e.g. Read ClickHouse records via JdbcIO using com.clickhouse.jdbc.ClickHouseDriver and map ResultSet to Beam Rows (ClickHouseIO is write-only; do not use ClickHouseIO.read)"
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
