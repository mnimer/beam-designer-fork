/**
 * SingleStoreDBIOSourceProperties Component
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Renders the property configuration panel for Apache Beam SingleStoreDB source nodes mapping to
 * SingleStoreIO.read() and SingleStoreIO.readWithPartitions(). Configures cluster endpoint host:port,
 * database name, read mode (query vs table vs partitions), row mapper class, output parallelization,
 * authentication (none vs Secret Manager), and advanced connection properties/SSL settings.
 *
 * Architectural Decisions:
 * - Controlled inputs with "props in, events up" dispatch pattern and no local state mirroring.
 * - NOTE: The Visual Designer palette and registry identify this connector as 'SingleStoreDBIO',
 *   matching TASK.md. However, the underlying Apache Beam Java SDK class is
 *   org.apache.beam.sdk.io.singlestore.SingleStoreIO. System instructions and code generation prompts
 *   must target SingleStoreIO, while component filenames, props, and registration keys use SingleStoreDBIO.
 * - Decomposed into local presentational sub-components (SingleStoreSourceConnectionCard,
 *   SingleStoreSourceReadModeCard, SingleStoreSourceMapperCard, SingleStoreSourceAuthCard,
 *   SingleStoreSourceAdvancedGroup) keeping each section focused and under ~350 lines.
 * - Supports three read modes: 'query' (withQuery), 'table' (withTable), and 'partitions' (readWithPartitions).
 * - Real-time validation for required connection endpoint, database name, and active read target.
 * - Dynamic IPC integration: listens for 'secretsLoaded' responses and issues 'getSecrets' command to extension host.
 * - Secret normalization supporting both string paths and SecretItem objects with dedicated datalist 'singlestore-source-secret-options'.
 * - Preserves system_instructions / special_instructions fallback chain for LLM code generation.
 * - Follows the 8pt grid system and Tailwind CSS styling with VS Code theme tokens.
 */

import React, { useState } from 'react';
import { InfoTooltip } from '../../components/InfoTooltip';
import { PropertyField } from '../../components/common/PropertyField';
import { SystemInstructionsField } from '../../components/common/SystemInstructionsField';
import { CollapsibleSection } from '../../components/common/CollapsibleSection';
import { resolveSystemInstructions } from '../../utils/systemInstructions';
import { MappingStrategyField } from '../../components/common/MappingStrategyField';
import { resolveSchemaFields, type SchemaField } from '../../components/common/SchemaEditor';
import { normalizeSecretItem } from '../../components/common/SecretManagerAuthFields';
import type { SecretItem } from '../../components/common/SecretManagerAuthFields';
import { useAssetLoader } from '../../hooks/useAssetLoader';

export type { SecretItem };

export type SingleStoreReadMode = 'query' | 'table' | 'partitions';
export type SingleStoreSslMode = 'DISABLED' | 'TRUST' | 'VERIFY_CA' | 'VERIFY_FULL';
export type SingleStoreMapperStrategy = 'infer' | 'schema' | 'customClass';

/**
 * Props for the SingleStoreDBIO source properties component.
 */
export interface SingleStoreDBIOSourcePropertiesProps {
  node: {
    data: {
      label?: string;
      beam_transform?: string;
      system_instructions?: string;
      special_instructions?: string;
      properties?: {
        endpoint?: string;
        database?: string;
        readMode?: SingleStoreReadMode | string;
        query?: string;
        table?: string;
        mapperStrategy?: SingleStoreMapperStrategy | string;
        schemaString?: string;
        rowMapper?: string;
        outputParallelization?: boolean;
        authMode?: 'none' | 'secret_manager' | string;
        usernameSecret?: string;
        passwordSecret?: string;
        connectionProperties?: string;
        connectTimeout?: number | string;
        sslMode?: SingleStoreSslMode | string;
        system_instructions?: string;
        special_instructions?: string;
        [key: string]: any;
      };
    };
  };
  onChange: (properties: any) => void;
}

/**
 * Props for the SingleStoreSourceConnectionCard component.
 */
interface ConnectionCardProps {
  endpoint: string;
  database: string;
  isEndpointEmpty: boolean;
  isDatabaseEmpty: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}

/**
 * Presentational card for SingleStoreDB endpoint and database name.
 */
const SingleStoreSourceConnectionCard: React.FC<ConnectionCardProps> = ({
  endpoint,
  database,
  isEndpointEmpty,
  isDatabaseEmpty,
  onChange
}) => (
  <div className="flex flex-col gap-3 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
    <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
      <span>Database Connection</span>
      <InfoTooltip text="Configures connection to the SingleStoreDB cluster. Maps to SingleStoreIO.DataSourceConfiguration.create(endpoint).withDatabase(database)." />
    </label>

    <PropertyField
      id="singleStoreSourceEndpoint"
      name="endpoint"
      label="Endpoint (host:port)"
      required="Endpoint host:port is required"
      tooltip="SingleStoreDB cluster endpoint host:port (e.g. 127.0.0.1:3306). Maps to DataSourceConfiguration.create(). Required."
      value={endpoint}
      invalid={isEndpointEmpty}
      error={isEndpointEmpty ? 'Endpoint host:port is required' : null}
      placeholder="127.0.0.1:3306"
      onChange={onChange}
      mono={true}
    />

    <PropertyField
      id="singleStoreSourceDatabase"
      name="database"
      label="Database Name"
      required="Database name is required"
      tooltip="Target SingleStore database name. Maps to DataSourceConfiguration.withDatabase(). Required."
      value={database}
      invalid={isDatabaseEmpty}
      error={isDatabaseEmpty ? 'Database name is required' : null}
      placeholder="e.g. telemetry_db"
      onChange={onChange}
      mono={true}
    />
  </div>
);

/**
 * Props for the SingleStoreSourceReadModeCard component.
 */
interface ReadModeCardProps {
  readMode: string;
  query: string;
  table: string;
  isQueryEmpty: boolean;
  isTableEmpty: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}

/**
 * Presentational card for query vs table vs partitions read mode.
 */
const SingleStoreSourceReadModeCard: React.FC<ReadModeCardProps> = ({
  readMode,
  query,
  table,
  isQueryEmpty,
  isTableEmpty,
  onChange
}) => (
  <div className="flex flex-col gap-3 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
    <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
      <span>Read Mode</span>
      <InfoTooltip text="Choose read strategy: query executes a custom SQL statement via withQuery(); table reads from a table via withTable(); partitions applies the distinct SingleStoreIO.readWithPartitions() transform for parallel partition reading." />
    </label>

    <div className="flex gap-4">
      <label className="flex items-center gap-1.5 cursor-pointer text-xs text-[var(--vscode-text-secondary)]">
        <input
          type="radio"
          name="readMode"
          value="query"
          checked={readMode === 'query'}
          onChange={onChange}
          className="accent-[var(--vscode-highlight)]"
        />
        <span>Custom SQL Query</span>
      </label>
      <label className="flex items-center gap-1.5 cursor-pointer text-xs text-[var(--vscode-text-secondary)]">
        <input
          type="radio"
          name="readMode"
          value="table"
          checked={readMode === 'table'}
          onChange={onChange}
          className="accent-[var(--vscode-highlight)]"
        />
        <span>Table Name</span>
      </label>
      <label className="flex items-center gap-1.5 cursor-pointer text-xs text-[var(--vscode-text-secondary)]">
        <input
          type="radio"
          name="readMode"
          value="partitions"
          checked={readMode === 'partitions'}
          onChange={onChange}
          className="accent-[var(--vscode-highlight)]"
        />
        <span>Partitioned Read</span>
      </label>
    </div>

    {readMode === 'query' && (
      <div className="flex flex-col gap-3 mt-1 pl-2 border-l-2 border-[var(--vscode-highlight)]/50">
        <PropertyField
          id="singleStoreSourceQuery"
          name="query"
          label="SQL Query"
          required="SQL query is required in query mode"
          tooltip="SQL query statement to execute. Maps to withQuery(). Required in Query mode."
          type="textarea"
          rows={3}
          value={query}
          invalid={isQueryEmpty}
          error={isQueryEmpty ? 'SQL query is required in query mode' : null}
          placeholder="SELECT * FROM sensor_readings WHERE active = 1"
          onChange={onChange}
          mono={true}
        />
      </div>
    )}

    {readMode === 'table' && (
      <div className="flex flex-col gap-3 mt-1 pl-2 border-l-2 border-[var(--vscode-highlight)]/50">
        <PropertyField
          id="singleStoreSourceTable"
          name="table"
          label="Table Name"
          required="Table name is required in table mode"
          tooltip="SingleStore table name to read from. Maps to withTable(). Required in Table mode."
          value={table}
          invalid={isTableEmpty}
          error={isTableEmpty ? 'Table name is required in table mode' : null}
          placeholder="e.g. sensor_readings"
          onChange={onChange}
          mono={true}
        />
      </div>
    )}

    {readMode === 'partitions' && (
      <div className="flex flex-col gap-3 mt-1 pl-2 border-l-2 border-[var(--vscode-highlight)]/50">
        <PropertyField
          id="singleStoreSourcePartitionsTable"
          name="table"
          label="Table Name"
          required="Table name is required for partitioned read"
          tooltip="SingleStore table name for parallel partition reading. Applied using the distinct SingleStoreIO.readWithPartitions().withTable() transform."
          value={table}
          invalid={isTableEmpty}
          error={isTableEmpty ? 'Table name is required for partitioned read' : null}
          placeholder="e.g. sensor_readings"
          onChange={onChange}
          mono={true}
        />

        <PropertyField
          id="singleStoreSourcePartitionsQuery"
          name="query"
          label="Optional Query Filter"
          tooltip="Optional query projection or filter applied across partitions. Maps to SingleStoreIO.readWithPartitions().withQuery()."
          value={query}
          onChange={onChange}
          placeholder="SELECT id, metric_val, recorded_at FROM sensor_readings"
          mono={true}
        />
      </div>
    )}
  </div>
);

/**
 * Props for the SingleStoreSourceMapperCard component.
 */
interface MapperCardProps {
  mapperStrategy: SingleStoreMapperStrategy | string;
  schemaFields: SchemaField[];
  rowMapper: string;
  outputParallelization: boolean;
  onSchemaChange: (data: { schemaFields: SchemaField[]; schema: string; schemaString: string }) => void;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}

/**
 * Presentational card for RowMapper strategy, schema definition, and output parallelization settings.
 */
const SingleStoreSourceMapperCard: React.FC<MapperCardProps> = ({
  mapperStrategy,
  schemaFields,
  rowMapper,
  outputParallelization,
  onSchemaChange,
  onChange
}) => (
  <div className="flex flex-col gap-3 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
    <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
      <span>Serialization &amp; Schema Mapping</span>
      <InfoTooltip text="Configures how SingleStoreDB JDBC ResultSet rows map to Beam PCollection elements. Since pipeline code is generated dynamically, Gemini can automatically infer columns or generate an inline RowMapper from a defined schema without requiring an external pre-compiled Java class." />
    </label>

    <MappingStrategyField
      id="singleStoreSourceMapperStrategy"
      strategyName="mapperStrategy"
      strategy={mapperStrategy}
      label="Row Mapping Strategy"
      tooltip="Select how ResultSet rows are mapped to Beam elements. 'Infer / Inline Mapper' lets Gemini synthesize an inline lambda RowMapper automatically. 'Define Schema' specifies typed fields (like BigQueryIO). 'Custom Class' is for an existing compiled class."
      optionLabels={{
        customClass: 'Custom RowMapper Class Name (Optional)'
      }}
      inferDescription={
        <>
          Gemini will automatically generate an inline{' '}
          <code className="text-slate-200 bg-slate-800/80 px-1 py-0.5 rounded">SingleStoreIO.RowMapper&lt;Row&gt;</code>{' '}
          matching the columns from your SQL query or table. No external pre-compiled class is needed.
        </>
      }
      schemaFields={schemaFields}
      schemaStringPlaceholder="id:BIGINT, device_id:VARCHAR, metric_val:DOUBLE, recorded_at:TIMESTAMP"
      onSchemaChange={onSchemaChange}
      customClassId="singleStoreSourceRowMapper"
      customClassName="rowMapper"
      customClassLabel="Row Mapper Class"
      customClassTooltip="Fully qualified class name of an existing compiled RowMapper implementation. Maps to withRowMapper()."
      customClassPlaceholder="com.example.SensorReadingRowMapper"
      customClassValue={rowMapper}
      onChange={onChange}
    />

    <div className="flex items-center gap-2 p-2 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
      <input
        id="singleStoreSourceOutputParallelization"
        type="checkbox"
        name="outputParallelization"
        checked={outputParallelization}
        onChange={onChange}
        className="rounded border-[var(--vscode-border)] text-[var(--vscode-highlight)] accent-[var(--vscode-highlight)] focus:ring-0"
      />
      <label htmlFor="singleStoreSourceOutputParallelization" className="flex items-center gap-1.5 text-xs text-[var(--vscode-text-secondary)] cursor-pointer">
        <span>Enable Output Parallelization</span>
        <InfoTooltip text="Whether to reshuffle results across all workers after reading. Defaults to true. Maps to withOutputParallelization()." />
      </label>
    </div>
  </div>
);

/**
 * Props for the SingleStoreSourceAuthCard component.
 */
interface AuthCardProps {
  authMode: string;
  usernameSecret: string;
  passwordSecret: string;
  secretOptions: { value: string; label: string }[];
  secretError: string | null;
  secretsLoading?: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}

/**
 * Presentational card for SingleStoreDB authentication credentials.
 */
const SingleStoreSourceAuthCard: React.FC<AuthCardProps> = ({
  authMode,
  usernameSecret,
  passwordSecret,
  secretOptions,
  secretError,
  secretsLoading,
  onChange
}) => (
  <div className="flex flex-col gap-3 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
    <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
      <span>Authentication</span>
      <InfoTooltip text="Choose authentication strategy: unauthenticated access or credentials securely referenced from GCP Secret Manager." />
    </label>
    <div className="flex gap-4">
      <label className="flex items-center gap-1.5 cursor-pointer text-xs text-[var(--vscode-text-secondary)]">
        <input
          type="radio"
          name="authMode"
          value="none"
          checked={authMode === 'none'}
          onChange={onChange}
          className="accent-[var(--vscode-highlight)]"
        />
        <span>None (Default)</span>
      </label>
      <label className="flex items-center gap-1.5 cursor-pointer text-xs text-[var(--vscode-text-secondary)]">
        <input
          type="radio"
          name="authMode"
          value="secret_manager"
          checked={authMode === 'secret_manager'}
          onChange={onChange}
          className="accent-[var(--vscode-highlight)]"
        />
        <span>Secret Manager</span>
      </label>
    </div>

    {authMode === 'secret_manager' && (
      <div className="flex flex-col gap-3 mt-1">
        <PropertyField
          id="singleStoreSourceUsernameSecret"
          name="usernameSecret"
          label="Username Secret"
          tooltip="Google Cloud Secret Manager secret containing the database username."
          value={usernameSecret}
          onChange={onChange}
          list="singlestore-source-secret-options"
          datalist={secretOptions}
          error={secretError}
          loading={secretsLoading}
          placeholder="e.g. singlestore-username"
          mono={true}
          helperText={
            <span>
              Values auto-populated from{' '}
              <code className="text-slate-300 bg-slate-800/60 px-1 py-0.5 rounded">
                gcloud secrets list
              </code>
            </span>
          }
        />
        <PropertyField
          id="singleStoreSourcePasswordSecret"
          name="passwordSecret"
          label="Password Secret"
          tooltip="Google Cloud Secret Manager secret containing the database password."
          value={passwordSecret}
          onChange={onChange}
          list="singlestore-source-secret-options"
          datalist={secretOptions}
          invalid={!!secretError}
          loading={secretsLoading}
          placeholder="e.g. singlestore-password"
          mono={true}
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
    )}
  </div>
);

/**
 * Props for the SingleStoreSourceAdvancedGroup component.
 */
interface AdvancedGroupProps {
  showAdvanced: boolean;
  connectionProperties: string;
  connectTimeout: number | string;
  sslMode: string;
  onToggle: () => void;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}

/**
 * Presentational collapsible group for advanced connection properties and timeouts.
 */
const SingleStoreSourceAdvancedGroup: React.FC<AdvancedGroupProps> = ({
  showAdvanced,
  connectionProperties,
  connectTimeout,
  sslMode,
  onToggle,
  onChange
}) => (
  <CollapsibleSection
    title="Advanced Source Settings"
    isOpen={showAdvanced}
    onToggle={onToggle}
  >
    <PropertyField
      id="singleStoreSourceConnectionProperties"
      name="connectionProperties"
      label="Connection Properties"
      type="textarea"
      rows={2}
      tooltip="Semicolon or ampersand-separated JDBC connection properties (e.g. connectTimeout=30000;useServerPrepStmts=FALSE). Maps to DataSourceConfiguration.withConnectionProperties()."
      value={connectionProperties}
      onChange={onChange}
      placeholder="connectTimeout=30000;useServerPrepStmts=FALSE"
      mono={true}
    />

    <div className="grid grid-cols-2 gap-2">
      <PropertyField
        id="singleStoreSourceConnectTimeout"
        name="connectTimeout"
        label="Connect Timeout (ms)"
        type="number"
        tooltip="Database connection timeout in milliseconds."
        value={connectTimeout}
        onChange={onChange}
        placeholder="30000"
        mono={true}
      />

      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1.5">
          <label
            htmlFor="singleStoreSourceSslMode"
            className="text-xs font-bold uppercase text-[var(--vscode-text-muted)]"
          >
            SSL Mode
          </label>
          <InfoTooltip text="Configures SSL mode for encrypted transport to the SingleStoreDB cluster." />
        </div>
        <select
          id="singleStoreSourceSslMode"
          name="sslMode"
          value={sslMode}
          onChange={onChange}
          className="bg-[var(--vscode-input-bg)] text-[var(--vscode-text-primary)] p-2 rounded border border-[var(--vscode-border)] text-xs focus:outline-none focus:border-[var(--vscode-highlight)]"
        >
          <option value="DISABLED">DISABLED</option>
          <option value="TRUST">TRUST</option>
          <option value="VERIFY_CA">VERIFY_CA</option>
          <option value="VERIFY_FULL">VERIFY_FULL</option>
        </select>
      </div>
    </div>
  </CollapsibleSection>
);

/**
 * SingleStoreDBIOSourceProperties renders the configuration form for SingleStoreIO.read() transforms.
 *
 * @param props Component properties containing the active node and onChange callback
 */
export const SingleStoreDBIOSourceProperties: React.FC<SingleStoreDBIOSourcePropertiesProps> = ({ node, onChange }) => {
  const properties = node.data.properties || {};

  // Form field state extracted from node properties
  const endpoint = properties.endpoint ?? '';
  const database = properties.database ?? '';
  const readMode = properties.readMode ?? 'query';
  const query = properties.query ?? '';
  const table = properties.table ?? '';
  const mapperStrategy = properties.mapperStrategy || (properties.rowMapper ? 'customClass' : 'infer');
  const schemaFields = React.useMemo(
    () => resolveSchemaFields(properties),
    [properties.schemaFields, properties.schema, properties.schemaString]
  );
  const rowMapper = properties.rowMapper ?? '';
  const outputParallelization = properties.outputParallelization ?? true;
  const authMode = properties.authMode ?? 'none';
  const usernameSecret = properties.usernameSecret ?? '';
  const passwordSecret = properties.passwordSecret ?? '';
  const connectionProperties = properties.connectionProperties ?? '';
  const connectTimeout = properties.connectTimeout ?? '';
  const sslMode = properties.sslMode ?? 'DISABLED';

  // NOTE: Request Secret Manager secrets via useAssetLoader hook
  const { items: rawSecrets, error: secretError, loading: secretsLoading } = useAssetLoader<SecretItem | string>('secrets');
  const normalizedSecrets = (rawSecrets || []).map(normalizeSecretItem);
  const secretOptions = normalizedSecrets.map(s => ({ value: s.id, label: s.name }));
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Field validation
  const isEndpointEmpty = !String(endpoint).trim();
  const isDatabaseEmpty = !String(database).trim();
  const isQueryEmpty = readMode === 'query' && !String(query).trim();
  const isTableEmpty = (readMode === 'table' || readMode === 'partitions') && !String(table).trim();

  // NOTE: Fallback chain for system instructions
  const systemInstructions = resolveSystemInstructions(node);

  /**
   * Updates a generic property value and triggers onChange callback.
   *
   * @param name The property name key
   * @param value The updated property value
   */
  const updateProperty = (name: string, value: any) => {
    // NOTE: Merge updated property and dispatch to parent component
    const updated = { ...properties, [name]: value };
    onChange(updated);
  };

  /**
   * Handles text, number, select, and checkbox input changes.
   *
   * @param e Standard React change event
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
      <SingleStoreSourceConnectionCard
        endpoint={endpoint}
        database={database}
        isEndpointEmpty={isEndpointEmpty}
        isDatabaseEmpty={isDatabaseEmpty}
        onChange={handleChange}
      />

      <SingleStoreSourceReadModeCard
        readMode={readMode}
        query={query}
        table={table}
        isQueryEmpty={isQueryEmpty}
        isTableEmpty={isTableEmpty}
        onChange={handleChange}
      />

      <SingleStoreSourceMapperCard
        mapperStrategy={mapperStrategy}
        schemaFields={schemaFields}
        rowMapper={rowMapper}
        outputParallelization={outputParallelization}
        onSchemaChange={handleSchemaChange}
        onChange={handleChange}
      />

      <SingleStoreSourceAuthCard
        authMode={authMode}
        usernameSecret={usernameSecret}
        passwordSecret={passwordSecret}
        secretOptions={secretOptions}
        secretError={secretError}
        secretsLoading={secretsLoading}
        onChange={handleChange}
      />

      <SingleStoreSourceAdvancedGroup
        showAdvanced={showAdvanced}
        connectionProperties={connectionProperties}
        connectTimeout={connectTimeout}
        sslMode={sslMode}
        onToggle={() => setShowAdvanced(!showAdvanced)}
        onChange={handleChange}
      />

      {/* Code Generation Instructions */}
      <SystemInstructionsField
        id="singleStoreSourceInstructions"
        value={systemInstructions}
        tooltip="Optional instructions passed to LLM code generator when synthesizing SingleStoreIO pipelines. NOTE: SingleStoreIO.read() uses an inline RowMapper<Row> matching query columns or schema."
        placeholder="e.g. Read rows from SingleStoreDB table using SingleStoreIO.read() with dynamic inline RowMapper<Row>"
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
