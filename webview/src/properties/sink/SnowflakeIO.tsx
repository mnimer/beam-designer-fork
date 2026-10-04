/**
 * SnowflakeIOSinkProperties Component
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Renders the configuration panel for Apache Beam SnowflakeIO Sink nodes (SnowflakeIO.write()).
 * Configures writing records to Snowflake tables via DataSourceConfiguration, staging CSV records
 * in external cloud storage, write and create dispositions, user data mapping, and authentication.
 *
 * Architectural Decisions:
 * - Enforces required destination table, connection coordinates (server, database), and staging parameters
 *   (staging bucket, storage integration) with validation alerts and accessible ARIA attributes.
 * - Staging parameters are prominently grouped in a dedicated card, as SnowflakeIO writes require staging
 *   temporary CSV files before executing Snowflake COPY INTO commands.
 * - Dynamic discovery: fetches GCP Secret Manager secrets via 'getSecrets' IPC message for secure credentials.
 * - Provides distinct datalist id 'snowflake-sink-secret-options' avoiding collisions.
 * - Supports authentication modes: Username/Password, Key Pair (private key & passphrase), and OAuth.
 * - Dispositions card configures WriteDisposition (APPEND, TRUNCATE, EMPTY) and CreateDisposition (CREATE_IF_NEEDED, CREATE_NEVER).
 * - Decomposed into local presentational sub-components with onToggle callback for collapsible state.
 * - Preserves system_instructions / special_instructions in the bottom textarea for LLM code generation.
 * - Follows the 8pt grid system and Tailwind CSS styling with VS Code theme tokens.
 */

import React, { useState } from 'react';
import { CollapsibleSection } from '../../components/common/CollapsibleSection';
import { InfoTooltip } from '../../components/InfoTooltip';
import { PropertyField } from '../../components/common/PropertyField';
import { SystemInstructionsField } from '../../components/common/SystemInstructionsField';
import { resolveSystemInstructions } from '../../utils/systemInstructions';
import { normalizeSecretItem } from '../../components/common/SecretManagerAuthFields';
import type { SecretItem } from '../../components/common/SecretManagerAuthFields';
import { useAssetLoader } from '../../hooks/useAssetLoader';

export type { SecretItem };

export type SnowflakeWriteDisposition = 'APPEND' | 'TRUNCATE' | 'EMPTY';
export type SnowflakeCreateDisposition = 'CREATE_IF_NEEDED' | 'CREATE_NEVER';
export type SnowflakeAuthMode = 'username_password' | 'key_pair' | 'oauth';

/**
 * Props for the SnowflakeIOSinkProperties component.
 */
export interface SnowflakeIOSinkPropertiesProps {
  node: {
    data: {
      label?: string;
      beam_transform?: string;
      system_instructions?: string;
      special_instructions?: string;
      properties?: {
        serverName?: string;
        database?: string;
        schema?: string;
        warehouse?: string;
        role?: string;
        table?: string;
        stagingBucketName?: string;
        storageIntegrationName?: string;
        writeDisposition?: SnowflakeWriteDisposition;
        createDisposition?: SnowflakeCreateDisposition;
        tableSchema?: string;
        quotationMark?: string;
        fileNameTemplate?: string;
        authMode?: SnowflakeAuthMode;
        usernameSecret?: string;
        passwordSecret?: string;
        privateKeySecret?: string;
        privateKeyPassphraseSecret?: string;
        oauthTokenSecret?: string;
        flushRowLimit?: number | string;
        loginTimeout?: number | string;
        extraParameters?: string;
        system_instructions?: string;
        special_instructions?: string;
        [key: string]: any;
      };
    };
  };
  onChange: (properties: any) => void;
}

/**
 * Props for the SnowflakeSinkConnectionCard component.
 */
interface SnowflakeSinkConnectionCardProps {
  serverName: string;
  database: string;
  schema: string;
  warehouse: string;
  role: string;
  table: string;
  isServerEmpty: boolean;
  isDatabaseEmpty: boolean;
  isTableEmpty: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}

/**
 * Local presentational sub-component for Snowflake sink connection coordinates and destination table.
 */
const SnowflakeSinkConnectionCard: React.FC<SnowflakeSinkConnectionCardProps> = ({
  serverName,
  database,
  schema,
  warehouse,
  role,
  table,
  isServerEmpty,
  isDatabaseEmpty,
  isTableEmpty,
  onChange
}) => {
  return (
    <div className="flex flex-col gap-3 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
      <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
        <span>Snowflake Destination</span>
        <InfoTooltip text="Connection coordinates and target table for writing into Snowflake via SnowflakeIO.write()." />
      </label>

      <PropertyField
        id="snowflakeSinkServerName"
        name="serverName"
        label="Account / Server Name"
        required="Snowflake account/server name is required"
        tooltip="Snowflake account identifier or full host URL (e.g. xy12345.us-east-1.snowflakecomputing.com). Maps to withServerName() or withUrl()."
        value={serverName}
        invalid={isServerEmpty}
        error={isServerEmpty ? 'Snowflake account/server name is required' : null}
        placeholder="e.g. xy12345.us-central1.gcp.snowflakecomputing.com"
        onChange={onChange}
        mono={true}
      />

      <div className="grid grid-cols-2 gap-2">
        <PropertyField
          id="snowflakeSinkDatabase"
          name="database"
          label="Database"
          required="Snowflake database is required"
          tooltip="Target Snowflake database name. Maps to withDatabase()."
          value={database}
          invalid={isDatabaseEmpty}
          error={isDatabaseEmpty ? 'Snowflake database is required' : null}
          placeholder="e.g. ANALYTICS_DB"
          onChange={onChange}
          mono={true}
        />
        <PropertyField
          id="snowflakeSinkSchema"
          name="schema"
          label="Schema"
          tooltip="Target Snowflake schema name. Maps to withSchema(). Default: PUBLIC."
          value={schema}
          placeholder="e.g. PUBLIC"
          onChange={onChange}
          mono={true}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <PropertyField
          id="snowflakeSinkWarehouse"
          name="warehouse"
          label="Warehouse"
          tooltip="Virtual warehouse used for write execution. Maps to withWarehouse()."
          value={warehouse}
          placeholder="e.g. COMPUTE_WH"
          onChange={onChange}
          mono={true}
        />
        <PropertyField
          id="snowflakeSinkRole"
          name="role"
          label="Role"
          tooltip="Snowflake authorization role. Maps to withRole()."
          value={role}
          placeholder="e.g. ACCOUNTADMIN"
          onChange={onChange}
          mono={true}
        />
      </div>

      <PropertyField
        id="snowflakeSinkTable"
        name="table"
        label="Destination Table"
        required="Destination table name is required"
        tooltip="Target Snowflake table to write data into. Maps to .to(String) in SnowflakeIO.write()."
        value={table}
        invalid={isTableEmpty}
        error={isTableEmpty ? 'Destination table name is required' : null}
        placeholder="e.g. AGGREGATED_METRICS"
        onChange={onChange}
        mono={true}
      />
    </div>
  );
};

/**
 * Props for the SnowflakeSinkStagingCard component.
 */
interface SnowflakeSinkStagingCardProps {
  stagingBucketName: string;
  storageIntegrationName: string;
  isStagingBucketEmpty: boolean;
  isStorageIntegrationEmpty: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}

/**
 * Local presentational sub-component for staging bucket and storage integration in Snowflake sink.
 */
const SnowflakeSinkStagingCard: React.FC<SnowflakeSinkStagingCardProps> = ({
  stagingBucketName,
  storageIntegrationName,
  isStagingBucketEmpty,
  isStorageIntegrationEmpty,
  onChange
}) => {
  return (
    <div className="flex flex-col gap-3 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
      <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
        <span>Staging Configuration</span>
        <InfoTooltip text="Beam stages CSV records in cloud storage and instructs Snowflake to COPY INTO the target table." />
      </label>

      <PropertyField
        id="snowflakeSinkStagingBucketName"
        name="stagingBucketName"
        label="Staging Bucket"
        required="Staging bucket name is required"
        tooltip="Cloud storage URI where Beam stages temporary CSV files (e.g. gs://my-bucket/snowflake-staging/ or s3://my-bucket/). Maps to withStagingBucketName()."
        value={stagingBucketName}
        invalid={isStagingBucketEmpty}
        error={isStagingBucketEmpty ? 'Staging bucket name is required' : null}
        placeholder="gs://my-bucket/staging-path/"
        onChange={onChange}
        mono={true}
      />

      <PropertyField
        id="snowflakeSinkStorageIntegrationName"
        name="storageIntegrationName"
        label="Storage Integration"
        required="Storage integration name is required"
        tooltip="Name of the Snowflake STORAGE INTEGRATION object granting access to the staging bucket. Maps to withStorageIntegrationName()."
        value={storageIntegrationName}
        invalid={isStorageIntegrationEmpty}
        error={isStorageIntegrationEmpty ? 'Storage integration name is required' : null}
        placeholder="e.g. GCS_STORAGE_INT"
        onChange={onChange}
        mono={true}
      />
    </div>
  );
};

/**
 * Props for the SnowflakeSinkDispositionsCard component.
 */
interface SnowflakeSinkDispositionsCardProps {
  writeDisposition: SnowflakeWriteDisposition;
  createDisposition: SnowflakeCreateDisposition;
  tableSchema: string;
  quotationMark: string;
  fileNameTemplate: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}

/**
 * Local presentational sub-component for write/create dispositions, schema, and file formatting.
 */
const SnowflakeSinkDispositionsCard: React.FC<SnowflakeSinkDispositionsCardProps> = ({
  writeDisposition,
  createDisposition,
  tableSchema,
  quotationMark,
  fileNameTemplate,
  onChange
}) => {
  return (
    <div className="flex flex-col gap-3 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
      <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
        <span>Dispositions &amp; Serialization</span>
        <InfoTooltip text="Controls write disposition, table auto-creation, and staged file formatting." />
      </label>

      <div className="grid grid-cols-2 items-end gap-2 mt-1">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="snowflakeSinkWriteDisposition"
            className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]"
          >
            <span>Write Disposition</span>
            <InfoTooltip text="Action when writing to an existing table: APPEND appends new rows; TRUNCATE truncates table before writing; EMPTY fails if table is not empty. Maps to withWriteDisposition()." />
          </label>
          <select
            id="snowflakeSinkWriteDisposition"
            name="writeDisposition"
            value={writeDisposition}
            onChange={onChange}
            className="bg-[var(--vscode-input-bg)] text-[var(--vscode-text-primary)] p-2 rounded border border-[var(--vscode-border)] text-xs focus:outline-none focus:border-[var(--vscode-highlight)]"
          >
            <option value="APPEND">APPEND (Append to existing rows)</option>
            <option value="TRUNCATE">TRUNCATE (Truncate table before writing)</option>
            <option value="EMPTY">EMPTY (Fail if table has rows)</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="snowflakeSinkCreateDisposition"
            className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]"
          >
            <span>Create Disposition</span>
            <InfoTooltip text="Action if target table does not exist: CREATE_IF_NEEDED creates the table using TableSchema; CREATE_NEVER requires table to pre-exist. Maps to withCreateDisposition()." />
          </label>
          <select
            id="snowflakeSinkCreateDisposition"
            name="createDisposition"
            value={createDisposition}
            onChange={onChange}
            className="bg-[var(--vscode-input-bg)] text-[var(--vscode-text-primary)] p-2 rounded border border-[var(--vscode-border)] text-xs focus:outline-none focus:border-[var(--vscode-highlight)]"
          >
            <option value="CREATE_IF_NEEDED">CREATE_IF_NEEDED</option>
            <option value="CREATE_NEVER">CREATE_NEVER</option>
          </select>
        </div>
      </div>

      <PropertyField
        id="snowflakeSinkTableSchema"
          name="tableSchema"
          label="Table Schema"
          tooltip="Snowflake TableSchema instance reference or DDL for automatic table creation. Maps to withTableSchema()."
          value={tableSchema}
          placeholder="e.g. com.example.TargetTableSchema"
          onChange={onChange}
          mono={true}
        />

      <div className="grid grid-cols-2 gap-2 mt-1">
        <PropertyField
          id="snowflakeSinkQuotationMark"
          name="quotationMark"
          label="Quotation Mark"
          tooltip="Quote character enclosing CSV field values during staging. Maps to withQuotationMark(). Default: double quote."
          value={quotationMark}
          placeholder='e.g. "'
          onChange={onChange}
          mono={true}
        />
        <PropertyField
          id="snowflakeSinkFileNameTemplate"
          name="fileNameTemplate"
          label="File Name Template"
          tooltip="File naming template for staged CSV part files. Maps to withFileNameTemplate()."
          value={fileNameTemplate}
          placeholder="e.g. output-shard-%s.csv"
          onChange={onChange}
          mono={true}
        />
      </div>
    </div>
  );
};

/**
 * Props for the SnowflakeSinkAuthCard component.
 */
interface SnowflakeSinkAuthCardProps {
  authMode: SnowflakeAuthMode;
  usernameSecret: string;
  passwordSecret: string;
  privateKeySecret: string;
  privateKeyPassphraseSecret: string;
  oauthTokenSecret: string;
  secretOptions: { value: string; label: string }[];
  secretError: string | null;
  secretsLoading?: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}

/**
 * Local presentational sub-component for Snowflake sink authentication configuration.
 */
const SnowflakeSinkAuthCard: React.FC<SnowflakeSinkAuthCardProps> = ({
  authMode,
  usernameSecret,
  passwordSecret,
  privateKeySecret,
  privateKeyPassphraseSecret,
  oauthTokenSecret,
  secretOptions,
  secretError,
  secretsLoading,
  onChange
}) => {
  return (
    <div className="flex flex-col gap-2 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
      <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
        <span>Authentication</span>
        <InfoTooltip text="Authentication strategy for Snowflake connection via GCP Secret Manager: Username/Password, Key Pair, or OAuth Token." />
      </label>

      <div className="flex flex-col gap-1.5 mt-1">
        <label
          htmlFor="snowflakeSinkAuthMode"
          className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]"
        >
          <span>Authentication Strategy</span>
        </label>
        <select
          id="snowflakeSinkAuthMode"
          name="authMode"
          value={authMode}
          onChange={onChange}
          className="bg-[var(--vscode-input-bg)] text-[var(--vscode-text-primary)] p-2 rounded border border-[var(--vscode-border)] text-xs focus:outline-none focus:border-[var(--vscode-highlight)]"
        >
          <option value="username_password">Username &amp; Password (Secret Manager)</option>
          <option value="key_pair">Key Pair Authentication (Private Key)</option>
          <option value="oauth">OAuth Access Token</option>
        </select>
      </div>

      <div className="flex flex-col gap-3 mt-2 pl-2 border-l-2 border-[var(--vscode-highlight)]/50">
        {authMode !== 'oauth' && (
          <PropertyField
            id="snowflakeSinkUsernameSecret"
            name="usernameSecret"
            label="Username Secret"
            value={usernameSecret}
            onChange={onChange}
            list="snowflake-sink-secret-options"
            datalist={secretOptions}
            loading={secretsLoading}
            placeholder="e.g. snowflake-username"
            tooltip="GCP Secret Manager secret containing the Snowflake login user name."
            invalid={!!secretError}
            mono={true}
          />
        )}

        {authMode === 'username_password' && (
          <PropertyField
            id="snowflakeSinkPasswordSecret"
            name="passwordSecret"
            label="Password Secret"
            value={passwordSecret}
            onChange={onChange}
            list="snowflake-sink-secret-options"
            datalist={secretOptions}
            loading={secretsLoading}
            placeholder="e.g. snowflake-password"
            tooltip="GCP Secret Manager secret containing the Snowflake user password."
            error={secretError}
            invalid={!!secretError}
            mono={true}
          />
        )}

        {authMode === 'key_pair' && (
          <>
            <PropertyField
              id="snowflakeSinkPrivateKeySecret"
              name="privateKeySecret"
              label="Private Key Secret"
              value={privateKeySecret}
              onChange={onChange}
              list="snowflake-sink-secret-options"
              datalist={secretOptions}
              loading={secretsLoading}
              placeholder="e.g. snowflake-rsa-private-key"
              tooltip="GCP Secret Manager secret containing the PEM-encoded private key."
              error={secretError}
              invalid={!!secretError}
              mono={true}
            />
            <PropertyField
              id="snowflakeSinkPrivateKeyPassphraseSecret"
              name="privateKeyPassphraseSecret"
              label="Key Passphrase Secret (Optional)"
              value={privateKeyPassphraseSecret}
              onChange={onChange}
              list="snowflake-sink-secret-options"
              datalist={secretOptions}
              loading={secretsLoading}
              placeholder="e.g. snowflake-key-passphrase"
              tooltip="Optional GCP Secret Manager secret containing the passphrase for the encrypted private key."
              mono={true}
            />
          </>
        )}

        {authMode === 'oauth' && (
          <PropertyField
            id="snowflakeSinkOauthTokenSecret"
            name="oauthTokenSecret"
            label="OAuth Token Secret"
            value={oauthTokenSecret}
            onChange={onChange}
            list="snowflake-sink-secret-options"
            datalist={secretOptions}
            loading={secretsLoading}
            placeholder="e.g. snowflake-oauth-token"
            tooltip="GCP Secret Manager secret containing the OAuth access token."
            error={secretError}
            invalid={!!secretError}
            mono={true}
          />
        )}
      </div>
    </div>
  );
};

/**
 * Props for the SnowflakeSinkAdvancedCard component.
 */
interface SnowflakeSinkAdvancedCardProps {
  showAdvanced: boolean;
  onToggle: () => void;
  flushRowLimit: number | string;
  loginTimeout: number | string;
  extraParameters: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}

/**
 * Local presentational sub-component for advanced Snowflake sink buffer and session settings.
 */
const SnowflakeSinkAdvancedCard: React.FC<SnowflakeSinkAdvancedCardProps> = ({
  showAdvanced,
  onToggle,
  flushRowLimit,
  loginTimeout,
  extraParameters,
  onChange
}) => {
  return (
    <CollapsibleSection
      title="Advanced Sink Settings"
      isOpen={showAdvanced}
      onToggle={onToggle}
    >
      <div className="grid grid-cols-2 gap-2">
        <PropertyField
          id="snowflakeSinkFlushRowLimit"
          name="flushRowLimit"
          label="Flush Row Limit"
          type="number"
          value={flushRowLimit}
          onChange={onChange}
          placeholder="e.g. 10000"
          tooltip="Maximum number of rows buffered before flushing to a staged file. Maps to withFlushRowLimit()."
          min={0}
        />
        <PropertyField
          id="snowflakeSinkLoginTimeout"
          name="loginTimeout"
          label="Login Timeout (Seconds)"
          type="number"
          value={loginTimeout}
          onChange={onChange}
          placeholder="e.g. 60"
          tooltip="Login timeout duration in seconds for DataSourceConfiguration.withLoginTimeout()."
          min={0}
        />
      </div>

      <PropertyField
        id="snowflakeSinkExtraParameters"
        name="extraParameters"
        label="Extra Session / JDBC Parameters"
        type="textarea"
        rows={2}
        value={extraParameters}
        onChange={onChange}
        placeholder="CLIENT_SESSION_KEEP_ALIVE=true"
        tooltip="Additional session connection parameters."
        mono={true}
      />
    </CollapsibleSection>
  );
};

/**
 * SnowflakeIOSinkProperties renders the configuration form for writing records to Snowflake.
 *
 * @param props Component properties containing the active node and onChange callback
 */
export const SnowflakeIOSinkProperties: React.FC<SnowflakeIOSinkPropertiesProps> = ({ node, onChange }) => {
  const properties = node.data.properties || {};

  // Form field state extracted from node properties
  const serverName = properties.serverName || '';
  const database = properties.database || '';
  const schema = properties.schema || '';
  const warehouse = properties.warehouse || '';
  const role = properties.role || '';
  const table = properties.table || '';
  const stagingBucketName = properties.stagingBucketName || '';
  const storageIntegrationName = properties.storageIntegrationName || '';
  const writeDisposition: SnowflakeWriteDisposition = properties.writeDisposition || 'APPEND';
  const createDisposition: SnowflakeCreateDisposition = properties.createDisposition || 'CREATE_IF_NEEDED';
  const tableSchema = properties.tableSchema || '';
  const quotationMark = properties.quotationMark || '';
  const fileNameTemplate = properties.fileNameTemplate || '';
  const authMode: SnowflakeAuthMode = properties.authMode || 'username_password';
  const usernameSecret = properties.usernameSecret || '';
  const passwordSecret = properties.passwordSecret || '';
  const privateKeySecret = properties.privateKeySecret || '';
  const privateKeyPassphraseSecret = properties.privateKeyPassphraseSecret || '';
  const oauthTokenSecret = properties.oauthTokenSecret || '';
  const flushRowLimit = properties.flushRowLimit ?? '';
  const loginTimeout = properties.loginTimeout ?? '';
  const extraParameters = properties.extraParameters || '';

  // Request Secret Manager secrets via useAssetLoader hook
  const { items: rawSecrets, error: secretError, loading: secretsLoading } = useAssetLoader<SecretItem | string>('secrets');
  const normalizedSecrets = (rawSecrets || []).map(normalizeSecretItem);
  const secretOptions = normalizedSecrets.map(s => ({ value: s.id, label: s.name }));
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Field validation
  const isServerEmpty = !serverName.trim();
  const isDatabaseEmpty = !database.trim();
  const isTableEmpty = !table.trim();
  const isStagingBucketEmpty = !stagingBucketName.trim();
  const isStorageIntegrationEmpty = !storageIntegrationName.trim();

  // Fallback chain for system instructions
  const systemInstructions = resolveSystemInstructions(node);

  /**
   * Updates a generic property value and triggers onChange callback.
   *
   * @param name The property name key
   * @param value The updated property value
   */
  const updateProperty = (name: string, value: any) => {
    const updated = { ...properties, [name]: value };
    onChange(updated);
  };

  /**
   * Handles text, number, select, and checkbox input changes.
   *
   * @param e Standard React change event
   */
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      updateProperty(name, checked);
    } else {
      updateProperty(name, value);
    }
  };

  return (
    <div className="flex-1 flex flex-col gap-4 text-[var(--vscode-text-primary)] text-sm">
      {/* Snowflake Destination Connection Card */}
      <SnowflakeSinkConnectionCard
        serverName={serverName}
        database={database}
        schema={schema}
        warehouse={warehouse}
        role={role}
        table={table}
        isServerEmpty={isServerEmpty}
        isDatabaseEmpty={isDatabaseEmpty}
        isTableEmpty={isTableEmpty}
        onChange={handleChange}
      />

      {/* Staging Bucket & Storage Integration */}
      <SnowflakeSinkStagingCard
        stagingBucketName={stagingBucketName}
        storageIntegrationName={storageIntegrationName}
        isStagingBucketEmpty={isStagingBucketEmpty}
        isStorageIntegrationEmpty={isStorageIntegrationEmpty}
        onChange={handleChange}
      />

      {/* Dispositions and Schema */}
      <SnowflakeSinkDispositionsCard
        writeDisposition={writeDisposition}
        createDisposition={createDisposition}
        tableSchema={tableSchema}
        quotationMark={quotationMark}
        fileNameTemplate={fileNameTemplate}
        onChange={handleChange}
      />

      {/* Authentication Strategy Card */}
      <SnowflakeSinkAuthCard
        authMode={authMode}
        usernameSecret={usernameSecret}
        passwordSecret={passwordSecret}
        privateKeySecret={privateKeySecret}
        privateKeyPassphraseSecret={privateKeyPassphraseSecret}
        oauthTokenSecret={oauthTokenSecret}
        secretOptions={secretOptions}
        secretError={secretError}
        secretsLoading={secretsLoading}
        onChange={handleChange}
      />

      {/* Collapsible Advanced Sink Settings */}
      <SnowflakeSinkAdvancedCard
        showAdvanced={showAdvanced}
        onToggle={() => setShowAdvanced(!showAdvanced)}
        flushRowLimit={flushRowLimit}
        loginTimeout={loginTimeout}
        extraParameters={extraParameters}
        onChange={handleChange}
      />

      {/* Code Generation Instructions */}
      <SystemInstructionsField
        id="snowflakeSinkSystemInstructions"
        value={systemInstructions}
        rows={4}
        tooltip="Optional custom prompt instructions injected into LLM code generation for this transform."
        placeholder="Custom prompt instructions for generating the Apache Beam SnowflakeIO sink step..."
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
