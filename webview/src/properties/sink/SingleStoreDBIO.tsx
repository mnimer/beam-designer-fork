/**
 * SingleStoreDBIOSinkProperties Component
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Renders the property configuration panel for Apache Beam SingleStoreDB sink nodes mapping to
 * SingleStoreIO.write(). Configures cluster endpoint host:port, target database, destination table,
 * user data mapper class, batch size, authentication (none vs Secret Manager), and advanced
 * connection properties/SSL settings.
 *
 * Architectural Decisions:
 * - Controlled inputs with "props in, events up" dispatch pattern and no local state mirroring.
 * - NOTE: The Visual Designer palette and registry identify this connector as 'SingleStoreDBIO',
 *   matching TASK.md. However, the underlying Apache Beam Java SDK class is
 *   org.apache.beam.sdk.io.singlestore.SingleStoreIO. System instructions and code generation prompts
 *   must target SingleStoreIO, while component filenames, props, and registration keys use SingleStoreDBIO.
 * - Decomposed into local presentational sub-components (SingleStoreSinkConnectionCard,
 *   SingleStoreSinkMapperCard, SingleStoreSinkAuthCard, SingleStoreSinkAdvancedGroup)
 *   keeping each section focused and under ~350 lines.
 * - Real-time validation for required connection endpoint, database name, and destination table.
 * - Dynamic IPC integration: listens for 'secretsLoaded' responses and issues 'getSecrets' command to extension host.
 * - Secret normalization supporting both string paths and SecretItem objects with dedicated datalist 'singlestore-sink-secret-options'.
 * - Preserves system_instructions / special_instructions fallback chain for LLM code generation.
 * - Follows the 8pt grid system and Tailwind CSS styling with VS Code theme tokens.
 */

import React, { useState } from 'react';
import { InfoTooltip } from '../../components/InfoTooltip';
import { PropertyField } from '../../components/common/PropertyField';
import { MappingStrategyField } from '../../components/common/MappingStrategyField';
import { resolveSchemaFields, type SchemaField } from '../../components/common/SchemaEditor';
import { normalizeSecretItem } from '../../components/common/SecretManagerAuthFields';
import type { SecretItem } from '../../components/common/SecretManagerAuthFields';
import { useAssetLoader } from '../../hooks/useAssetLoader';

export type SingleStoreSslMode = 'DISABLED' | 'TRUST' | 'VERIFY_CA' | 'VERIFY_FULL';
export type SingleStoreMapperStrategy = 'infer' | 'schema' | 'customClass';

export interface SingleStoreDBIOSinkPropertiesProps {
  node: {
    data: {
      label?: string;
      beam_transform?: string;
      system_instructions?: string;
      special_instructions?: string;
      properties?: {
        endpoint?: string;
        database?: string;
        table?: string;
        mapperStrategy?: SingleStoreMapperStrategy | string;
        schemaString?: string;
        userDataMapper?: string;
        batchSize?: number | string;
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

interface ConnectionCardProps {
  endpoint: string;
  database: string;
  table: string;
  isEndpointEmpty: boolean;
  isDatabaseEmpty: boolean;
  isTableEmpty: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}

/**
 * Presentational card for SingleStoreDB destination endpoint, database, and table.
 */
const SingleStoreSinkConnectionCard: React.FC<ConnectionCardProps> = ({
  endpoint,
  database,
  table,
  isEndpointEmpty,
  isDatabaseEmpty,
  isTableEmpty,
  onChange
}) => (
  <div className="flex flex-col gap-3 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
    <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
      <span>Destination Database</span>
      <InfoTooltip text="Configures connection and destination table. Maps to SingleStoreIO.write().withDataSourceConfiguration() and withTable()." />
    </label>

    <PropertyField
      id="singleStoreSinkEndpoint"
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

    <div className="grid grid-cols-2 gap-2">
      <PropertyField
        id="singleStoreSinkDatabase"
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

      <PropertyField
        id="singleStoreSinkTable"
        name="table"
        label="Destination Table"
        required="Destination table is required"
        tooltip="Target SingleStore table to insert records into. Maps to SingleStoreIO.write().withTable(). Required."
        value={table}
        invalid={isTableEmpty}
        error={isTableEmpty ? 'Destination table is required' : null}
        placeholder="e.g. telemetry_rollups"
        onChange={onChange}
        mono={true}
      />
    </div>
  </div>
);

interface MapperCardProps {
  mapperStrategy: SingleStoreMapperStrategy | string;
  schemaFields: SchemaField[];
  userDataMapper: string;
  batchSize: number | string;
  onSchemaChange: (data: { schemaFields: SchemaField[]; schema: string; schemaString: string }) => void;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}

/**
 * Presentational card for UserDataMapper strategy, schema definition, and batch size controls.
 */
const SingleStoreSinkMapperCard: React.FC<MapperCardProps> = ({
  mapperStrategy,
  schemaFields,
  userDataMapper,
  batchSize,
  onSchemaChange,
  onChange
}) => (
  <div className="flex flex-col gap-3 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
    <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
      <span>Serialization &amp; Batching</span>
      <InfoTooltip text="Configures how Beam PCollection elements map to SingleStoreDB PreparedStatement parameters and batch sizing. Since pipeline code is generated dynamically, Gemini can automatically infer columns or generate an inline UserDataMapper from a defined schema without requiring an external pre-compiled Java class." />
    </label>

    <MappingStrategyField
      id="singleStoreSinkMapperStrategy"
      strategyName="mapperStrategy"
      strategy={mapperStrategy}
      label="Row Mapping Strategy"
      tooltip="Select how input elements are mapped to SingleStoreDB parameters. 'Infer / Inline Mapper' lets Gemini synthesize an inline lambda UserDataMapper automatically. 'Define Schema' specifies typed fields (like BigQueryIO). 'Custom Class' is for an existing compiled class."
      optionLabels={{
        customClass: 'Custom UserDataMapper Class Name (Optional)'
      }}
      inferDescription={
        <>
          Gemini will automatically generate an inline{' '}
          <code className="text-slate-200 bg-slate-800/80 px-1 py-0.5 rounded">SingleStoreIO.UserDataMapper&lt;Row&gt;</code>{' '}
          matching the input elements and destination table columns. No external pre-compiled class is needed.
        </>
      }
      schemaFields={schemaFields}
      schemaStringPlaceholder="id:BIGINT, device_id:VARCHAR, metric_val:DOUBLE, recorded_at:TIMESTAMP"
      onSchemaChange={onSchemaChange}
      customClassId="singleStoreSinkUserDataMapper"
      customClassName="userDataMapper"
      customClassLabel="User Data Mapper Class"
      customClassTooltip="Fully qualified class name of an existing compiled UserDataMapper implementation. Maps to withUserDataMapper()."
      customClassPlaceholder="com.example.SensorRollupUserDataMapper"
      customClassValue={userDataMapper}
      onChange={onChange}
    />

    <PropertyField
      id="singleStoreSinkBatchSize"
      name="batchSize"
      label="Batch Size"
      type="number"
      tooltip="Maximum number of rows to insert in a single batch statement. Maps to withBatchSize()."
      value={batchSize}
      onChange={onChange}
      placeholder="10000"
      mono={true}
    />
  </div>
);

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
 * Presentational card for SingleStoreDB authentication credentials in sink.
 */
const SingleStoreSinkAuthCard: React.FC<AuthCardProps> = ({
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
          id="singleStoreSinkUsernameSecret"
          name="usernameSecret"
          label="Username Secret"
          tooltip="Google Cloud Secret Manager secret containing the database username."
          value={usernameSecret}
          onChange={onChange}
          list="singlestore-sink-secret-options"
          datalist={secretOptions}
          error={secretError}
          loading={secretsLoading}
          placeholder="e.g. singlestore-username"
          mono={true}
          helperText={
            <span>
              Values auto-populated from{' '}
              <code className="text-slate-300 bg-slate-800/60 px-1 py-0.5 rounded">
                GCP Secret Manager
              </code>
              .
            </span>
          }
        />
        <PropertyField
          id="singleStoreSinkPasswordSecret"
          name="passwordSecret"
          label="Password Secret"
          tooltip="Google Cloud Secret Manager secret containing the database password."
          value={passwordSecret}
          onChange={onChange}
          list="singlestore-sink-secret-options"
          datalist={secretOptions}
          loading={secretsLoading}
          placeholder="e.g. singlestore-password"
          mono={true}
        />
      </div>
    )}
  </div>
);

interface AdvancedGroupProps {
  showAdvanced: boolean;
  connectionProperties: string;
  connectTimeout: number | string;
  sslMode: string;
  onToggle: () => void;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}

/**
 * Presentational collapsible group for advanced sink connection properties.
 */
const SingleStoreSinkAdvancedGroup: React.FC<AdvancedGroupProps> = ({
  showAdvanced,
  connectionProperties,
  connectTimeout,
  sslMode,
  onToggle,
  onChange
}) => (
  <div className="flex flex-col border border-[var(--vscode-border-light)] rounded-md overflow-hidden">
    <button
      type="button"
      onClick={onToggle}
      className="flex items-center justify-between p-2 bg-[var(--vscode-subcard-bg)] text-xs font-bold uppercase text-[var(--vscode-text-muted)] hover:text-[var(--vscode-text-primary)] transition-colors cursor-pointer"
    >
      <span>Advanced Sink Settings</span>
      <span>{showAdvanced ? '▲' : '▼'}</span>
    </button>

    {showAdvanced && (
      <div className="p-3 bg-[var(--vscode-workbench-bg)] flex flex-col gap-3 border-t border-[var(--vscode-border-light)]">
        <PropertyField
          id="singleStoreSinkConnectionProperties"
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
            id="singleStoreSinkConnectTimeout"
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
                htmlFor="singleStoreSinkSslMode"
                className="text-xs font-bold uppercase text-[var(--vscode-text-muted)]"
              >
                SSL Mode
              </label>
              <InfoTooltip text="Configures SSL mode for encrypted transport to the SingleStoreDB cluster." />
            </div>
            <select
              id="singleStoreSinkSslMode"
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
      </div>
    )}
  </div>
);

/**
 * SingleStoreDBIOSinkProperties renders the configuration form for SingleStoreIO.write() transforms.
 *
 * @param props Component properties containing the active node and onChange callback
 */
export const SingleStoreDBIOSinkProperties: React.FC<SingleStoreDBIOSinkPropertiesProps> = ({ node, onChange }) => {
  const properties = node.data.properties || {};

  // Form field state extracted from node properties
  const endpoint = properties.endpoint ?? '';
  const database = properties.database ?? '';
  const table = properties.table ?? '';
  const mapperStrategy = properties.mapperStrategy || (properties.userDataMapper ? 'customClass' : 'infer');
  const schemaFields = React.useMemo(
    () => resolveSchemaFields(properties),
    [properties.schemaFields, properties.schema, properties.schemaString]
  );
  const userDataMapper = properties.userDataMapper ?? '';
  const batchSize = properties.batchSize ?? '';
  const authMode = properties.authMode ?? 'none';
  const usernameSecret = properties.usernameSecret ?? '';
  const passwordSecret = properties.passwordSecret ?? '';
  const connectionProperties = properties.connectionProperties ?? '';
  const connectTimeout = properties.connectTimeout ?? '';
  const sslMode = properties.sslMode ?? 'DISABLED';

  // Dynamic asset loading for Secret Manager resources via useAssetLoader
  const { items: rawSecrets, loading: secretsLoading, error: secretError } = useAssetLoader<SecretItem | string>('secrets');
  const normalizedSecrets = (rawSecrets || []).map(normalizeSecretItem);
  const secretOptions = normalizedSecrets.map(s => ({ value: s.id, label: s.name }));

  const [showAdvanced, setShowAdvanced] = useState(false);

  // Field validation
  const isEndpointEmpty = !String(endpoint).trim();
  const isDatabaseEmpty = !String(database).trim();
  const isTableEmpty = !String(table).trim();

  // NOTE: Fallback chain for system instructions
  const systemInstructions =
    node.data.system_instructions ??
    node.data.special_instructions ??
    properties.system_instructions ??
    properties.special_instructions ??
    '';

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

  /**
   * Handles system instructions textarea modification.
   *
   * @param e React textarea change event
   */
  const handleInstructionsChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    // NOTE: Dispatch system_instructions update to parent
    onChange({
      ...properties,
      system_instructions: e.target.value
    });
  };

  return (
    <div className="flex-1 flex flex-col gap-4 text-[var(--vscode-text-primary)] text-sm">
      <SingleStoreSinkConnectionCard
        endpoint={endpoint}
        database={database}
        table={table}
        isEndpointEmpty={isEndpointEmpty}
        isDatabaseEmpty={isDatabaseEmpty}
        isTableEmpty={isTableEmpty}
        onChange={handleChange}
      />

      <SingleStoreSinkMapperCard
        mapperStrategy={mapperStrategy}
        schemaFields={schemaFields}
        userDataMapper={userDataMapper}
        batchSize={batchSize}
        onSchemaChange={handleSchemaChange}
        onChange={handleChange}
      />

      <SingleStoreSinkAuthCard
        authMode={authMode}
        usernameSecret={usernameSecret}
        passwordSecret={passwordSecret}
        secretOptions={secretOptions}
        secretError={secretError}
        secretsLoading={secretsLoading}
        onChange={handleChange}
      />

      <SingleStoreSinkAdvancedGroup
        showAdvanced={showAdvanced}
        connectionProperties={connectionProperties}
        connectTimeout={connectTimeout}
        sslMode={sslMode}
        onToggle={() => setShowAdvanced(!showAdvanced)}
        onChange={handleChange}
      />

      {/* Flexible Spacer */}
      <div className="flex-1 min-h-[16px]" />

      {/* Code Generation Instructions */}
      <PropertyField
        id="singleStoreSinkInstructions"
        name="system_instructions"
        label="Code Generation Instructions"
        tooltip="Optional instructions passed to LLM code generator when synthesizing SingleStoreIO pipelines."
        type="textarea"
        rows={3}
        value={systemInstructions}
        onChange={handleInstructionsChange}
        placeholder="e.g. Write SensorRollup records to SingleStore table using SingleStoreIO.write() with UserDataMapper"
        mono={true}
      />
    </div>
  );
};
