/**
 * SnowflakeIOSourceProperties Component
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Renders the configuration panel for Apache Beam SnowflakeIO Source nodes (SnowflakeIO.read()).
 * Configures connection to Snowflake via DataSourceConfiguration, external cloud storage staging,
 * query vs table reading (fromQuery / fromTable), CSV row mapping, and authentication strategies.
 *
 * Architectural Decisions:
 * - Enforces required connection coordinates (account/server, database), staging parameters (staging bucket,
 *   storage integration), and mode-dependent targets (query vs table).
 * - Staging parameters are prominently grouped in a dedicated card, as SnowflakeIO relies on COPY INTO
 *   external storage for distributed extraction.
 * - Dynamic discovery: fetches GCP Secret Manager secrets via 'getSecrets' IPC message for secure credentials.
 * - Provides distinct datalist id 'snowflake-source-secret-options' avoiding DOM collisions.
 * - Supports authentication modes: Username/Password, Key Pair (private key & passphrase), and OAuth.
 * - Decomposed into local presentational sub-components with onToggle callback for collapsible state.
 * - Preserves system_instructions / special_instructions in the bottom textarea for LLM code generation.
 * - Follows the 8pt grid system and Tailwind CSS styling with VS Code theme tokens.
 */

import React, { useState } from 'react';
import { InfoTooltip } from '../../components/InfoTooltip';
import { PropertyField } from '../../components/common/PropertyField';
import { SystemInstructionsField } from '../../components/common/SystemInstructionsField';
import { CollapsibleSection } from '../../components/common/CollapsibleSection';
import { resolveSystemInstructions } from '../../utils/systemInstructions';
import { normalizeSecretItem } from '../../components/common/SecretManagerAuthFields';
import type { SecretItem } from '../../components/common/SecretManagerAuthFields';
import { useAssetLoader } from '../../hooks/useAssetLoader';

export type { SecretItem };

export type SnowflakeReadMode = 'query' | 'table';
export type SnowflakeAuthMode = 'username_password' | 'key_pair' | 'oauth';

/**
 * Props for the SnowflakeIO source properties component.
 */
export interface SnowflakeIOSourcePropertiesProps {
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
        readMode?: SnowflakeReadMode;
        query?: string;
        table?: string;
        stagingBucketName?: string;
        storageIntegrationName?: string;
        authMode?: SnowflakeAuthMode;
        usernameSecret?: string;
        passwordSecret?: string;
        privateKeySecret?: string;
        privateKeyPassphraseSecret?: string;
        oauthTokenSecret?: string;
        quotationMark?: string;
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
 * Props for the SnowflakeSourceConnectionCard component.
 */
interface SnowflakeSourceConnectionCardProps {
  serverName: string;
  database: string;
  schema: string;
  warehouse: string;
  role: string;
  isServerEmpty: boolean;
  isDatabaseEmpty: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}

/**
 * Local presentational sub-component for Snowflake connection coordinates.
 */
const SnowflakeSourceConnectionCard: React.FC<SnowflakeSourceConnectionCardProps> = ({
  serverName,
  database,
  schema,
  warehouse,
  role,
  isServerEmpty,
  isDatabaseEmpty,
  onChange
}) => {
  return (
    <div className="flex flex-col gap-3 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
      <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
        <span>Snowflake Connection</span>
        <InfoTooltip text="Connection coordinates for the Snowflake instance. Configures SnowflakeIO.DataSourceConfiguration." />
      </label>

      <PropertyField
        id="snowflakeSourceServerName"
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
          id="snowflakeSourceDatabase"
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
          id="snowflakeSourceSchema"
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
          id="snowflakeSourceWarehouse"
          name="warehouse"
          label="Warehouse"
          tooltip="Virtual warehouse used for compute resources. Maps to withWarehouse()."
          value={warehouse}
          placeholder="e.g. COMPUTE_WH"
          onChange={onChange}
          mono={true}
        />
        <PropertyField
          id="snowflakeSourceRole"
          name="role"
          label="Role"
          tooltip="Snowflake authorization role. Maps to withRole()."
          value={role}
          placeholder="e.g. ACCOUNTADMIN"
          onChange={onChange}
          mono={true}
        />
      </div>
    </div>
  );
};

/**
 * Props for the SnowflakeSourceReadTargetCard component.
 */
interface SnowflakeSourceReadTargetCardProps {
  readMode: SnowflakeReadMode;
  query: string;
  table: string;
  isQueryEmpty: boolean;
  isTableEmpty: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}

/**
 * Local presentational sub-component for query vs table read target branch.
 */
const SnowflakeSourceReadTargetCard: React.FC<SnowflakeSourceReadTargetCardProps> = ({
  readMode,
  query,
  table,
  isQueryEmpty,
  isTableEmpty,
  onChange
}) => {
  return (
    <div className="flex flex-col gap-3 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
      <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
        <span>Read Target</span>
        <InfoTooltip text="Select whether to read by executing a custom SQL query or scanning an entire Snowflake table." />
      </label>

      <div className="flex items-center gap-4 mt-1">
        <label className="flex items-center gap-2 cursor-pointer text-xs text-[var(--vscode-text-secondary)]">
          <input
            type="radio"
            name="readMode"
            value="query"
            checked={readMode === 'query'}
            onChange={onChange}
            className="accent-[var(--vscode-highlight)] text-[var(--vscode-highlight)]"
          />
          <span>SQL Query</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer text-xs text-[var(--vscode-text-secondary)]">
          <input
            type="radio"
            name="readMode"
            value="table"
            checked={readMode === 'table'}
            onChange={onChange}
            className="accent-[var(--vscode-highlight)] text-[var(--vscode-highlight)]"
          />
          <span>Table Scan</span>
        </label>
      </div>

      {readMode === 'query' ? (
        <PropertyField
          id="snowflakeSourceQuery"
          name="query"
          label="SQL Query"
          required="SQL query is required for Query read mode"
          tooltip="SQL query string to extract data. Maps to fromQuery()."
          type="textarea"
          rows={3}
          value={query}
          invalid={isQueryEmpty}
          error={isQueryEmpty ? 'SQL query is required for Query read mode' : null}
          placeholder="SELECT id, name, amount, event_date FROM transactions WHERE amount > 0"
          onChange={onChange}
          mono={true}
        />
      ) : (
        <PropertyField
          id="snowflakeSourceTable"
          name="table"
          label="Table Name"
          required="Table name is required for Table read mode"
          tooltip="Name of the Snowflake table to scan. Maps to fromTable()."
          value={table}
          invalid={isTableEmpty}
          error={isTableEmpty ? 'Table name is required for Table read mode' : null}
          placeholder="e.g. TRANSACTIONS"
          onChange={onChange}
          mono={true}
        />
      )}
    </div>
  );
};

/**
 * Props for the SnowflakeSourceStagingCard component.
 */
interface SnowflakeSourceStagingCardProps {
  stagingBucketName: string;
  storageIntegrationName: string;
  isStagingBucketEmpty: boolean;
  isStorageIntegrationEmpty: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}

/**
 * Local presentational sub-component for staging bucket and storage integration.
 */
const SnowflakeSourceStagingCard: React.FC<SnowflakeSourceStagingCardProps> = ({
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
        <InfoTooltip text="Snowflake unloads data as CSV files into cloud storage staging, and Beam workers read those staged files into records." />
      </label>

      <PropertyField
        id="snowflakeSourceStagingBucketName"
        name="stagingBucketName"
        label="Staging Bucket"
        required="Staging bucket name is required"
        tooltip="Cloud storage URI where Snowflake unloads temporary CSV files (e.g. gs://my-bucket/snowflake-staging/ or s3://my-bucket/). Maps to withStagingBucketName()."
        value={stagingBucketName}
        invalid={isStagingBucketEmpty}
        error={isStagingBucketEmpty ? 'Staging bucket name is required' : null}
        placeholder="gs://my-bucket/staging-path/"
        onChange={onChange}
        mono={true}
      />

      <PropertyField
        id="snowflakeSourceStorageIntegrationName"
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
 * Props for the SnowflakeSourceAuthCard component.
 */
interface SnowflakeSourceAuthCardProps {
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
 * Local presentational sub-component for Snowflake authentication configuration.
 */
const SnowflakeSourceAuthCard: React.FC<SnowflakeSourceAuthCardProps> = ({
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
          htmlFor="snowflakeSourceAuthMode"
          className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]"
        >
          <span>Authentication Strategy</span>
        </label>
        <select
          id="snowflakeSourceAuthMode"
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
            id="snowflakeSourceUsernameSecret"
            name="usernameSecret"
            label="Username Secret"
            value={usernameSecret}
            onChange={onChange}
            list="snowflake-source-secret-options"
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
            id="snowflakeSourcePasswordSecret"
            name="passwordSecret"
            label="Password Secret"
            value={passwordSecret}
            onChange={onChange}
            list="snowflake-source-secret-options"
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
              id="snowflakeSourcePrivateKeySecret"
              name="privateKeySecret"
              label="Private Key Secret"
              value={privateKeySecret}
              onChange={onChange}
              list="snowflake-source-secret-options"
              datalist={secretOptions}
              loading={secretsLoading}
              placeholder="e.g. snowflake-rsa-private-key"
              tooltip="GCP Secret Manager secret containing the PEM-encoded private key."
              error={secretError}
              invalid={!!secretError}
              mono={true}
            />
            <PropertyField
              id="snowflakeSourcePrivateKeyPassphraseSecret"
              name="privateKeyPassphraseSecret"
              label="Key Passphrase Secret (Optional)"
              value={privateKeyPassphraseSecret}
              onChange={onChange}
              list="snowflake-source-secret-options"
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
            id="snowflakeSourceOauthTokenSecret"
            name="oauthTokenSecret"
            label="OAuth Token Secret"
            value={oauthTokenSecret}
            onChange={onChange}
            list="snowflake-source-secret-options"
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
 * Props for the SnowflakeSourceAdvancedCard component.
 */
interface SnowflakeSourceAdvancedCardProps {
  showAdvanced: boolean;
  onToggle: () => void;
  quotationMark: string;
  loginTimeout: number | string;
  extraParameters: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}

/**
 * Local presentational sub-component for advanced Snowflake client and session parameters.
 */
const SnowflakeSourceAdvancedCard: React.FC<SnowflakeSourceAdvancedCardProps> = ({
  showAdvanced,
  onToggle,
  quotationMark,
  loginTimeout,
  extraParameters,
  onChange
}) => {
  return (
    <CollapsibleSection
      title="Advanced Source Settings"
      isOpen={showAdvanced}
      onToggle={onToggle}
    >
      <div className="grid grid-cols-2 gap-2">
        <PropertyField
          id="snowflakeSourceQuotationMark"
          name="quotationMark"
          label="Quotation Mark"
          value={quotationMark}
          onChange={onChange}
          placeholder='e.g. "'
          tooltip="Field quotation character used when parsing unloaded CSV files. Maps to withQuotationMark()."
          mono={true}
        />
        <PropertyField
          id="snowflakeSourceLoginTimeout"
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
        id="snowflakeSourceExtraParameters"
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
 * SnowflakeIOSourceProperties renders the configuration form for reading from Snowflake.
 *
 * @param props Component properties containing the active node and onChange callback
 */
export const SnowflakeIOSourceProperties: React.FC<SnowflakeIOSourcePropertiesProps> = ({ node, onChange }) => {
  const properties = node.data.properties || {};

  // Form field state extracted from node properties
  const serverName = properties.serverName || '';
  const database = properties.database || '';
  const schema = properties.schema || '';
  const warehouse = properties.warehouse || '';
  const role = properties.role || '';
  const readMode: SnowflakeReadMode = properties.readMode || 'query';
  const query = properties.query || '';
  const table = properties.table || '';
  const stagingBucketName = properties.stagingBucketName || '';
  const storageIntegrationName = properties.storageIntegrationName || '';
  const authMode: SnowflakeAuthMode = properties.authMode || 'username_password';
  const usernameSecret = properties.usernameSecret || '';
  const passwordSecret = properties.passwordSecret || '';
  const privateKeySecret = properties.privateKeySecret || '';
  const privateKeyPassphraseSecret = properties.privateKeyPassphraseSecret || '';
  const oauthTokenSecret = properties.oauthTokenSecret || '';
  const quotationMark = properties.quotationMark || '';
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
  const isQueryEmpty = readMode === 'query' && !query.trim();
  const isTableEmpty = readMode === 'table' && !table.trim();
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
      {/* Snowflake Connection Card */}
      <SnowflakeSourceConnectionCard
        serverName={serverName}
        database={database}
        schema={schema}
        warehouse={warehouse}
        role={role}
        isServerEmpty={isServerEmpty}
        isDatabaseEmpty={isDatabaseEmpty}
        onChange={handleChange}
      />

      {/* Read Target Mode Card */}
      <SnowflakeSourceReadTargetCard
        readMode={readMode}
        query={query}
        table={table}
        isQueryEmpty={isQueryEmpty}
        isTableEmpty={isTableEmpty}
        onChange={handleChange}
      />

      {/* Staging Bucket & Storage Integration */}
      <SnowflakeSourceStagingCard
        stagingBucketName={stagingBucketName}
        storageIntegrationName={storageIntegrationName}
        isStagingBucketEmpty={isStagingBucketEmpty}
        isStorageIntegrationEmpty={isStorageIntegrationEmpty}
        onChange={handleChange}
      />

      {/* Authentication Strategy Card */}
      <SnowflakeSourceAuthCard
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

      {/* Collapsible Advanced Source Settings */}
      <SnowflakeSourceAdvancedCard
        showAdvanced={showAdvanced}
        onToggle={() => setShowAdvanced(!showAdvanced)}
        quotationMark={quotationMark}
        loginTimeout={loginTimeout}
        extraParameters={extraParameters}
        onChange={handleChange}
      />

      {/* Code Generation Instructions */}
      <SystemInstructionsField
        id="snowflakeSourceSystemInstructions"
        value={systemInstructions}
        rows={4}
        placeholder="Custom prompt instructions for generating the Apache Beam SnowflakeIO source step..."
        tooltip="Optional custom prompt instructions injected into LLM code generation for this transform."
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
