/**
 * MongoDbIOSinkProperties Component
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Renders the property configuration panel for Apache Beam MongoDbIO Write Sink nodes.
 * Maps to Java SDK `MongoDbIO.write()` and Python SDK native `WriteToMongoDB`.
 *
 * Architectural Decisions:
 * - Controlled input architecture with props in / events up pattern.
 * - Real-time validation for required connection URI, database, and collection fields.
 * - URI format validation providing a warning helper text when not starting with "mongodb".
 * - Write mode toggle between insert and upsert; enforces key field requirement when upsert is active.
 * - Batch size, ordered write toggle, and write concern select mapped to Beam SDK options.
 * - Dynamic discovery: Requests GCP Secret Manager secrets from the extension host via `getSecrets` IPC.
 * - Unique datalist id `mongodb-sink-secret-options` to prevent collision across panels.
 * - Collapsible Advanced Sink Settings decomposed into local presentational sub-component with semantic toggle event callback.
 * - Preserves system_instructions / special_instructions for LLM code generation.
 * - Strictly adheres to 8pt grid system (p-2, p-3, gap-2, gap-3, gap-4) and Tailwind CSS with VS Code tokens.
 */

import React, { useState } from 'react';
import { InfoTooltip } from '../../components/InfoTooltip';
import { PropertyField } from '../../components/common/PropertyField';
import { SystemInstructionsField } from '../../components/common/SystemInstructionsField';
import { resolveSystemInstructions } from '../../utils/systemInstructions';
import { useAssetLoader } from '../../hooks/useAssetLoader';
import { normalizeSecretItem } from '../../components/common/SecretManagerAuthFields';
import { CollapsibleSection } from '../../components/common/CollapsibleSection';

/**
 * Secret item interface for normalized Secret Manager secrets.
 */
export interface SecretItem {
  id: string;
  name: string;
  fullName?: string;
}

/**
 * Props for the MongoDbSinkAuthSection sub-component.
 */
interface MongoDbSinkAuthSectionProps {
  authMode: 'uri_embedded' | 'secret_manager';
  usernameSecret: string;
  passwordSecret: string;
  secrets: SecretItem[];
  secretError: string | null;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}

/**
 * Presentational component for sink authentication configuration.
 *
 * @param props Sub-component properties
 */
const MongoDbSinkAuthSection: React.FC<MongoDbSinkAuthSectionProps> = ({
  authMode,
  usernameSecret,
  passwordSecret,
  secrets,
  secretError,
  onChange
}) => {
  return (
    <div className="flex flex-col gap-2 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
      <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
        <span>Authentication</span>
        <InfoTooltip text="Choose how credentials are provided to the MongoDB cluster. Using Secret Manager avoids committing credentials into pipeline code." />
      </label>
      <div className="flex flex-col gap-2 mt-1">
        <label className="flex items-center gap-2 cursor-pointer text-xs text-[var(--vscode-text-secondary)]">
          <input
            type="radio"
            name="authMode"
            value="uri_embedded"
            checked={authMode === 'uri_embedded'}
            onChange={onChange}
            className="accent-[var(--vscode-highlight)] text-[var(--vscode-highlight)]"
          />
          <span>None (Unauthenticated)</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer text-xs text-[var(--vscode-text-secondary)]">
          <input
            type="radio"
            name="authMode"
            value="secret_manager"
            checked={authMode === 'secret_manager'}
            onChange={onChange}
            className="accent-[var(--vscode-highlight)] text-[var(--vscode-highlight)]"
          />
          <span>GCP Secret Manager</span>
        </label>
      </div>

      {authMode === 'secret_manager' && (
        <div className="flex flex-col gap-3 mt-2 pl-2 border-l-2 border-[var(--vscode-highlight)]/50">
          <PropertyField
            id="mongoSinkUsernameSecret"
            name="usernameSecret"
            label="Username Secret"
            value={usernameSecret}
            onChange={onChange}
            list="mongodb-sink-secret-options"
            datalist={secrets.map((s) => ({ value: s.id || s.name, label: s.name || s.id }))}
            placeholder="e.g. mongodb-username"
            tooltip="GCP Secret Manager secret containing the MongoDB username."
            error={secretError}
            invalid={!!secretError}
            mono={true}
          />
          <PropertyField
            id="mongoSinkPasswordSecret"
            name="passwordSecret"
            label="Password Secret"
            value={passwordSecret}
            onChange={onChange}
            list="mongodb-sink-secret-options"
            datalist={secrets.map((s) => ({ value: s.id || s.name, label: s.name || s.id }))}
            placeholder="e.g. mongodb-password"
            tooltip="GCP Secret Manager secret containing the MongoDB password."
            invalid={!!secretError}
            mono={true}
          />
        </div>
      )}
    </div>
  );
};

/**
 * Props for the MongoDbSinkAdvancedSection sub-component.
 */
interface MongoDbSinkAdvancedSectionProps {
  showAdvanced: boolean;
  /** Emitted when the user toggles the advanced drawer. */
  onToggleAdvanced: () => void;
  sslEnabled: boolean;
  sslInvalidHostNameAllowed: boolean;
  retryWrites: boolean;
  maxConnectionIdleTime: number | string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}

/**
 * Presentational component for collapsible Advanced Sink Settings.
 *
 * @param props Sub-component properties
 */
const MongoDbSinkAdvancedSection: React.FC<MongoDbSinkAdvancedSectionProps> = ({
  showAdvanced,
  onToggleAdvanced,
  sslEnabled,
  sslInvalidHostNameAllowed,
  retryWrites,
  maxConnectionIdleTime,
  onChange
}) => {
  return (
    <CollapsibleSection
      title="Advanced Sink Settings"
      isOpen={showAdvanced}
      onToggle={onToggleAdvanced}
    >
      {/* SSL Options */}
      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-2 cursor-pointer text-xs text-[var(--vscode-text-secondary)]">
          <input
            id="mongoSinkSslEnabled"
            type="checkbox"
            name="sslEnabled"
            checked={sslEnabled}
            onChange={onChange}
            className="rounded border-[var(--vscode-border)] text-[var(--vscode-highlight)] accent-[var(--vscode-highlight)]"
          />
          <span>SSL / TLS Enabled</span>
          <InfoTooltip text="Enables SSL/TLS encrypted connection to MongoDB cluster." />
        </label>
        <label className="flex items-center gap-2 cursor-pointer text-xs text-[var(--vscode-text-secondary)]">
          <input
            id="mongoSinkSslInvalidHostNameAllowed"
            type="checkbox"
            name="sslInvalidHostNameAllowed"
            checked={sslInvalidHostNameAllowed}
            onChange={onChange}
            className="rounded border-[var(--vscode-border)] text-[var(--vscode-highlight)] accent-[var(--vscode-highlight)]"
          />
          <span>Allow Invalid Hostname</span>
          <InfoTooltip text="Configures whether invalid hostnames are allowed in SSL connections (Java: withSslInvalidHostNameAllowed)." />
        </label>
        <label className="flex items-center gap-2 cursor-pointer text-xs text-[var(--vscode-text-secondary)]">
          <input
            id="mongoSinkRetryWrites"
            type="checkbox"
            name="retryWrites"
            checked={retryWrites}
            onChange={onChange}
            className="rounded border-[var(--vscode-border)] text-[var(--vscode-highlight)] accent-[var(--vscode-highlight)]"
          />
          <span>Retry Writes</span>
          <InfoTooltip text="Configures driver automatic retry of failed write operations (specified in connection URI: retryWrites=true)." />
        </label>
      </div>

      {/* Max Connection Idle Time */}
      <PropertyField
        id="mongoSinkMaxConnectionIdleTime"
        name="maxConnectionIdleTime"
        label="Max Connection Idle Time (ms)"
        type="number"
        value={maxConnectionIdleTime}
        onChange={onChange}
        placeholder="0 (Unlimited)"
        min={0}
        tooltip="Maximum idle time of a pooled connection in milliseconds before it is closed (withMaxConnectionIdleTime)."
      />
    </CollapsibleSection>
  );
};

/**
 * Component props interface for MongoDbIOSinkProperties.
 */
export interface MongoDbIOSinkPropertiesProps {
  node: {
    data: {
      label?: string;
      beam_transform?: string;
      system_instructions?: string;
      special_instructions?: string;
      properties?: {
        uri?: string;
        database?: string;
        collection?: string;
        writeMode?: 'insert' | 'upsert';
        keyFields?: string;
        batchSize?: number | string;
        ordered?: boolean;
        writeConcern?: string;
        authMode?: 'uri_embedded' | 'secret_manager';
        usernameSecret?: string;
        passwordSecret?: string;
        sslEnabled?: boolean;
        sslInvalidHostNameAllowed?: boolean;
        maxConnectionIdleTime?: number | string;
        retryWrites?: boolean;
        system_instructions?: string;
        special_instructions?: string;
        [key: string]: any;
      };
    };
  };
  onChange: (properties: any) => void;
}

/**
 * MongoDbIOSinkProperties renders the configuration panel for writing to MongoDB.
 *
 * @param props Component properties containing the active node and onChange callback
 */
export const MongoDbIOSinkProperties: React.FC<MongoDbIOSinkPropertiesProps> = ({
  node,
  onChange
}) => {
  const properties = node.data.properties || {};

  // Form field state extracted from node properties
  const uri = properties.uri || '';
  const database = properties.database || '';
  const collection = properties.collection || '';
  const writeMode = properties.writeMode || 'insert';
  const keyFields = properties.keyFields || '';
  const batchSize = properties.batchSize ?? '';
  const ordered = properties.ordered ?? true;
  const writeConcern = properties.writeConcern || 'W1';
  const authMode = properties.authMode || 'uri_embedded';
  const usernameSecret = properties.usernameSecret || '';
  const passwordSecret = properties.passwordSecret || '';
  const sslEnabled = properties.sslEnabled ?? false;
  const sslInvalidHostNameAllowed = properties.sslInvalidHostNameAllowed ?? false;
  const maxConnectionIdleTime = properties.maxConnectionIdleTime ?? '';
  const retryWrites = properties.retryWrites ?? false;

  // Local state for dynamically loaded secrets and accordion toggle
  const { items: rawSecrets, error: secretError } = useAssetLoader<SecretItem | string>('secrets');
  const secrets: SecretItem[] = (rawSecrets || []).map(normalizeSecretItem);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Field validation
  const isUriEmpty = !uri.trim();
  const isUriInvalid = uri.trim().length > 0 && !uri.trim().startsWith('mongodb');
  const isDatabaseEmpty = !database.trim();
  const isCollectionEmpty = !collection.trim();
  const isKeyFieldsEmpty = writeMode === 'upsert' && !keyFields.trim();

  // Fallback chain for system instructions
  const systemInstructions = resolveSystemInstructions(node);

  /**
   * Updates a generic property value and triggers onChange callback.
   *
   * @param name The property name key
   * @param value The updated property value
   */
  const updateProperty = (name: string, value: any) => {
    // NOTE: Keep controlled state intact and bubble changes upwards
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
      {/* MongoDB Connection URI Input */}
      <PropertyField
        id="mongoSinkUri"
        name="uri"
        label="Connection URI"
        required="Connection URI is required"
        tooltip="MongoDB connection URI (e.g. mongodb://localhost:27017 or mongodb+srv://cluster.example.com). In Java: MongoDbIO.write().withUri(). In Python: WriteToMongoDB(uri=...)."
        value={uri}
        invalid={isUriEmpty}
        error={isUriEmpty ? 'Connection URI is required' : null}
        helperText={
          !isUriEmpty && isUriInvalid ? (
            <span className="text-amber-400" role="alert">
              Warning: MongoDB connection URI should start with &quot;mongodb://&quot; or &quot;mongodb+srv://&quot;
            </span>
          ) : null
        }
        placeholder="mongodb://localhost:27017 or mongodb+srv://cluster.example.com"
        onChange={handleChange}
        mono={true}
      />

      {/* Database & Collection Names */}
      <div className="grid grid-cols-2 gap-2">
        <PropertyField
          id="mongoSinkDatabase"
          name="database"
          label="Database Name"
          required="Database name is required"
          tooltip="Target MongoDB database name. In Java: withDatabase(database). In Python: db=..."
          value={database}
          invalid={isDatabaseEmpty}
          error={isDatabaseEmpty ? 'Database name is required' : null}
          placeholder="e.g. analytics"
          onChange={handleChange}
          mono={true}
        />
        <PropertyField
          id="mongoSinkCollection"
          name="collection"
          label="Collection Name"
          required="Collection name is required"
          tooltip="Target MongoDB collection name. In Java: withCollection(collection). In Python: coll=..."
          value={collection}
          invalid={isCollectionEmpty}
          error={isCollectionEmpty ? 'Collection name is required' : null}
          placeholder="e.g. aggregated_metrics"
          onChange={handleChange}
          mono={true}
        />
      </div>

      {/* Write Mode & Upsert Key Fields */}
      <div className="flex flex-col gap-2 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
        <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          <span>Write Mode</span>
          <InfoTooltip text="Choose insert mode for standard document appends or update-or-insert mode." />
        </label>
        <div className="flex flex-col gap-2 mt-1">
          <label className="flex items-center gap-2 cursor-pointer text-xs text-[var(--vscode-text-secondary)]">
            <input
              type="radio"
              name="writeMode"
              value="insert"
              checked={writeMode === 'insert'}
              onChange={handleChange}
              className="accent-[var(--vscode-highlight)] text-[var(--vscode-highlight)]"
            />
            <span>Insert (Append documents)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-xs text-[var(--vscode-text-secondary)]">
            <input
              type="radio"
              name="writeMode"
              value="upsert"
              checked={writeMode === 'upsert'}
              onChange={handleChange}
              className="accent-[var(--vscode-highlight)] text-[var(--vscode-highlight)]"
            />
            <span>Upsert (Update matched document or insert)</span>
          </label>
        </div>

        {writeMode === 'upsert' && (
          <div className="mt-2 pl-2 border-l-2 border-[var(--vscode-highlight)]/50">
            <PropertyField
              id="mongoSinkKeyFields"
              name="keyFields"
              label="Upsert Key Field(s)"
              required="Key field(s) are required for upsert mode"
              tooltip="Comma-separated field names used as unique filter keys when matching existing documents (Java: withUpdateConfiguration(UpdateConfiguration.create().withKeyField(...)))."
              value={keyFields}
              invalid={isKeyFieldsEmpty}
              error={isKeyFieldsEmpty ? 'Key field(s) are required for upsert mode' : null}
              placeholder="e.g. _id or customerId, date"
              onChange={handleChange}
              mono={true}
            />
          </div>
        )}
      </div>

      {/* Batching & Execution Settings */}
      <div className="flex flex-col gap-3 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
        <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          <span>Batching &amp; Delivery</span>
          <InfoTooltip text="Configure batch sizes, write ordering guarantees, and replica write concerns." />
        </label>

        <PropertyField
          id="mongoSinkBatchSize"
          name="batchSize"
          label="Batch Size"
          type="number"
          value={batchSize}
          onChange={handleChange}
          placeholder="1024"
          min={1}
          tooltip="Number of documents batched into a single MongoDB bulk write operation. In Java: withBatchSize(long). In Python: batch_size=..."
        />

        <div className="flex items-center gap-2">
          <input
            id="mongoSinkOrdered"
            type="checkbox"
            name="ordered"
            checked={ordered}
            onChange={handleChange}
            className="rounded border-[var(--vscode-border)] text-[var(--vscode-highlight)] accent-[var(--vscode-highlight)]"
          />
          <label
            htmlFor="mongoSinkOrdered"
            className="flex items-center gap-1.5 text-xs text-[var(--vscode-text-secondary)] cursor-pointer"
          >
            <span>Ordered Writes</span>
            <InfoTooltip text="If true, MongoDB stops executing remaining writes when a single document fails in a batch. If false, unfailed documents proceed (withOrdered)." />
          </label>
        </div>

        <div className="flex flex-col gap-1">
          <label
            htmlFor="mongoSinkWriteConcern"
            className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]"
          >
            <span>Write Concern</span>
            <InfoTooltip text="Replica acknowledgment guarantee for writes (specified in connection URI: w=majority)." />
          </label>
          <select
            id="mongoSinkWriteConcern"
            name="writeConcern"
            value={writeConcern}
            onChange={handleChange}
            className="bg-[var(--vscode-input-bg)] text-[var(--vscode-text-primary)] p-2 rounded border border-[var(--vscode-border)] text-xs focus:outline-none focus:border-[var(--vscode-highlight)]"
          >
            <option value="W1">w=1 (Acknowledged)</option>
            <option value="MAJORITY">majority (Quorum)</option>
            <option value="UNACKNOWLEDGED">unacknowledged (w=0 / Fire-and-forget)</option>
            <option value="W2">w=2 (Two Replicas)</option>
            <option value="W3">w=3 (Three Replicas)</option>
          </select>
        </div>
      </div>

      {/* Authentication Configuration Sub-section */}
      <MongoDbSinkAuthSection
        authMode={authMode}
        usernameSecret={usernameSecret}
        passwordSecret={passwordSecret}
        secrets={secrets}
        secretError={secretError}
        onChange={handleChange}
      />

      {/* Collapsible Advanced Sink Settings Sub-section */}
      <MongoDbSinkAdvancedSection
        showAdvanced={showAdvanced}
        onToggleAdvanced={() => setShowAdvanced(!showAdvanced)}
        sslEnabled={sslEnabled}
        sslInvalidHostNameAllowed={sslInvalidHostNameAllowed}
        retryWrites={retryWrites}
        maxConnectionIdleTime={maxConnectionIdleTime}
        onChange={handleChange}
      />

      {/* Code Generation Instructions */}
      <SystemInstructionsField
        id="mongoSinkInstructions"
        value={systemInstructions}
        tooltip="Custom instructions passed to the LLM code generator when synthesizing Beam pipeline code for Java (MongoDbIO.write()) or Python (WriteToMongoDB)."
        placeholder="e.g. Convert elements to org.bson.Document, apply upsert key configuration, and write to MongoDB"
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
