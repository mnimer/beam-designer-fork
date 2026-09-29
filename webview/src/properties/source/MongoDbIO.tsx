/**
 * MongoDbIOSourceProperties Component
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Renders the property configuration panel for Apache Beam MongoDbIO Source nodes.
 * Maps to Java SDK `MongoDbIO.read()` and Python SDK native `ReadFromMongoDB`.
 *
 * Architectural Decisions:
 * - Controlled input architecture with props in / events up pattern.
 * - Real-time validation for required connection URI, database, and collection fields.
 * - URI format validation providing a warning helper text if not starting with "mongodb".
 * - Dynamic discovery: Requests GCP Secret Manager secrets from the extension host via `getSecrets` IPC.
 * - Unique datalist id `mongodb-source-secret-options` to prevent collision with other connector panels.
 * - BucketAuto and split configuration directly mapping to `withBucketAuto` and `withNumSplits`.
 * - Collapsible Advanced Source Settings decomposed into local presentational component with semantic toggle event callback.
 * - Preserves system_instructions / special_instructions for LLM code generation.
 * - Strictly adheres to 8pt grid system (p-2, p-3, gap-2, gap-3, gap-4) and Tailwind CSS with VS Code tokens.
 */

import React, { useState } from 'react';
import { InfoTooltip } from '../../components/InfoTooltip';
import { PropertyField } from '../../components/common/PropertyField';
import { useAssetLoader } from '../../hooks/useAssetLoader';
import { normalizeSecretItem } from '../../components/common/SecretManagerAuthFields';

/**
 * Secret item interface for normalized Secret Manager secrets.
 */
export interface SecretItem {
  id: string;
  name: string;
  fullName?: string;
}

/**
 * Props for the MongoDbSourceAuthSection sub-component.
 */
interface MongoDbSourceAuthSectionProps {
  authMode: 'uri_embedded' | 'secret_manager';
  usernameSecret: string;
  passwordSecret: string;
  secrets: SecretItem[];
  secretError: string | null;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}

/**
 * Presentational component for source authentication configuration.
 *
 * @param props Sub-component properties
 */
const MongoDbSourceAuthSection: React.FC<MongoDbSourceAuthSectionProps> = ({
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
        <InfoTooltip text="Choose how credentials are supplied to the MongoDB cluster. Using Secret Manager avoids committing credentials into pipeline code." />
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
            id="mongoSourceUsernameSecret"
            name="usernameSecret"
            label="Username Secret"
            value={usernameSecret}
            onChange={onChange}
            list="mongodb-source-secret-options"
            datalist={secrets.map((s) => ({ value: s.id || s.name, label: s.name || s.id }))}
            placeholder="e.g. mongodb-username"
            tooltip="GCP Secret Manager secret containing the MongoDB username."
            error={secretError}
            invalid={!!secretError}
            mono={true}
          />
          <PropertyField
            id="mongoSourcePasswordSecret"
            name="passwordSecret"
            label="Password Secret"
            value={passwordSecret}
            onChange={onChange}
            list="mongodb-source-secret-options"
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
 * Props for the MongoDbSourceAdvancedSection sub-component.
 */
interface MongoDbSourceAdvancedSectionProps {
  showAdvanced: boolean;
  /** Emitted when the user toggles the advanced drawer. */
  onToggleAdvanced: () => void;
  sslEnabled: boolean;
  sslInvalidHostNameAllowed: boolean;
  ignoreSSLCertificate: boolean;
  maxConnectionIdleTime: number | string;
  readPreference: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}

/**
 * Presentational component for collapsible Advanced Source Settings.
 *
 * @param props Sub-component properties
 */
const MongoDbSourceAdvancedSection: React.FC<MongoDbSourceAdvancedSectionProps> = ({
  showAdvanced,
  onToggleAdvanced,
  sslEnabled,
  sslInvalidHostNameAllowed,
  ignoreSSLCertificate,
  maxConnectionIdleTime,
  readPreference,
  onChange
}) => {
  return (
    <div className="flex flex-col border border-[var(--vscode-border-light)] rounded-md overflow-hidden">
      <button
        type="button"
        onClick={onToggleAdvanced}
        className="flex items-center justify-between p-2 bg-[var(--vscode-subcard-bg)] text-xs font-bold uppercase text-[var(--vscode-text-muted)] hover:text-[var(--vscode-text-primary)] transition-colors cursor-pointer"
      >
        <span>Advanced Source Settings</span>
        <span>{showAdvanced ? '▲' : '▼'}</span>
      </button>

      {showAdvanced && (
        <div className="p-3 bg-[var(--vscode-workbench-bg)] flex flex-col gap-3 border-t border-[var(--vscode-border-light)]">
          {/* SSL Options */}
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-[var(--vscode-text-secondary)]">
              <input
                id="mongoSourceSslEnabled"
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
                id="mongoSourceSslInvalidHostNameAllowed"
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
                id="mongoSourceIgnoreSSLCertificate"
                type="checkbox"
                name="ignoreSSLCertificate"
                checked={ignoreSSLCertificate}
                onChange={onChange}
                className="rounded border-[var(--vscode-border)] text-[var(--vscode-highlight)] accent-[var(--vscode-highlight)]"
              />
              <span>Ignore SSL Certificate</span>
              <InfoTooltip text="Configures whether to trust invalid or self-signed SSL certificates (Java: withIgnoreSSLCertificate)." />
            </label>
          </div>

          {/* Max Connection Idle Time */}
          <PropertyField
            id="mongoSourceMaxConnectionIdleTime"
            name="maxConnectionIdleTime"
            label="Max Connection Idle Time (ms)"
            type="number"
            value={maxConnectionIdleTime}
            onChange={onChange}
            placeholder="0 (Unlimited)"
            min={0}
            tooltip="Maximum idle time of a pooled connection in milliseconds before it is closed (withMaxConnectionIdleTime)."
          />

          {/* Read Preference */}
          <div className="flex flex-col gap-1">
            <label
              htmlFor="mongoSourceReadPreference"
              className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]"
            >
              <span>Read Preference</span>
              <InfoTooltip text="Configures replica set routing (e.g. primary, secondary, nearest)." />
            </label>
            <select
              id="mongoSourceReadPreference"
              name="readPreference"
              value={readPreference}
              onChange={onChange}
              className="bg-[var(--vscode-input-bg)] text-[var(--vscode-text-primary)] p-2 rounded border border-[var(--vscode-border)] text-xs focus:outline-none focus:border-[var(--vscode-highlight)]"
            >
              <option value="primary">primary</option>
              <option value="primaryPreferred">primaryPreferred</option>
              <option value="secondary">secondary</option>
              <option value="secondaryPreferred">secondaryPreferred</option>
              <option value="nearest">nearest</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Component props interface for MongoDbIOSourceProperties.
 */
export interface MongoDbIOSourcePropertiesProps {
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
        filter?: string;
        projection?: string;
        bucketAuto?: boolean;
        numSplits?: number | string;
        authMode?: 'uri_embedded' | 'secret_manager';
        usernameSecret?: string;
        passwordSecret?: string;
        sslEnabled?: boolean;
        sslInvalidHostNameAllowed?: boolean;
        ignoreSSLCertificate?: boolean;
        maxConnectionIdleTime?: number | string;
        readPreference?: string;
        system_instructions?: string;
        special_instructions?: string;
        [key: string]: any;
      };
    };
  };
  onChange: (properties: any) => void;
}

/**
 * MongoDbIOSourceProperties renders the configuration panel for reading from MongoDB.
 *
 * @param props Component properties containing the active node and onChange callback
 */
export const MongoDbIOSourceProperties: React.FC<MongoDbIOSourcePropertiesProps> = ({
  node,
  onChange
}) => {
  const properties = node.data.properties || {};

  // Form field state extracted from node properties
  const uri = properties.uri || '';
  const database = properties.database || '';
  const collection = properties.collection || '';
  const filter = properties.filter || '';
  const projection = properties.projection || '';
  const bucketAuto = properties.bucketAuto ?? false;
  const numSplits = properties.numSplits ?? '';
  const authMode = properties.authMode || 'uri_embedded';
  const usernameSecret = properties.usernameSecret || '';
  const passwordSecret = properties.passwordSecret || '';
  const sslEnabled = properties.sslEnabled ?? false;
  const sslInvalidHostNameAllowed = properties.sslInvalidHostNameAllowed ?? false;
  const ignoreSSLCertificate = properties.ignoreSSLCertificate ?? false;
  const maxConnectionIdleTime = properties.maxConnectionIdleTime ?? '';
  const readPreference = properties.readPreference || 'primary';

  // Local state for dynamically loaded secrets and accordion toggle
  const { items: rawSecrets, error: secretError } = useAssetLoader<SecretItem | string>('secrets');
  const secrets: SecretItem[] = (rawSecrets || []).map(normalizeSecretItem);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Field validation
  const isUriEmpty = !uri.trim();
  const isUriInvalid = uri.trim().length > 0 && !uri.trim().startsWith('mongodb');
  const isDatabaseEmpty = !database.trim();
  const isCollectionEmpty = !collection.trim();

  // Fallback chain for system instructions
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

  /**
   * Handles system instructions textarea modification.
   *
   * @param e React textarea change event
   */
  const handleInstructionsChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    // NOTE: Write directly to properties.system_instructions
    onChange({
      ...properties,
      system_instructions: e.target.value
    });
  };

  return (
    <div className="flex-1 flex flex-col gap-4 text-[var(--vscode-text-primary)] text-sm">
      {/* MongoDB Connection URI Input */}
      <PropertyField
        id="mongoSourceUri"
        name="uri"
        label="Connection URI"
        required="Connection URI is required"
        tooltip="MongoDB connection URI (e.g. mongodb://localhost:27017 or mongodb+srv://cluster.example.com). In Java: MongoDbIO.read().withUri(). In Python: ReadFromMongoDB(uri=...)."
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
          id="mongoSourceDatabase"
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
          id="mongoSourceCollection"
          name="collection"
          label="Collection Name"
          required="Collection name is required"
          tooltip="Target MongoDB collection name. In Java: withCollection(collection). In Python: coll=..."
          value={collection}
          invalid={isCollectionEmpty}
          error={isCollectionEmpty ? 'Collection name is required' : null}
          placeholder="e.g. events"
          onChange={handleChange}
          mono={true}
        />
      </div>

      {/* Query Filter & Projection */}
      <PropertyField
        id="mongoSourceFilter"
        name="filter"
        label="Query Filter (JSON)"
        tooltip="MongoDB JSON query filter for document matching. In Java: withFilter(json) or withQueryFn(...). In Python: filter={...}."
        type="textarea"
        rows={3}
        value={filter}
        onChange={handleChange}
        placeholder='{"status": "active"}'
        mono={true}
      />

      <PropertyField
        id="mongoSourceProjection"
        name="projection"
        label="Projection Fields"
        tooltip="Comma-delimited projection field list or JSON projection specification. In Java: configure custom projection inside withQueryFn(...). In Python: projection=[...]."
        value={projection}
        onChange={handleChange}
        placeholder="e.g. _id, timestamp, userId, status"
        mono={true}
      />

      {/* Bucket-Auto & Parallelism Split Configuration */}
      <div className="flex flex-col gap-2 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
        <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          <span>Splitting &amp; Parallelism</span>
          <InfoTooltip text="Configure how Beam partitions large MongoDB collections into parallel splits for distributed workers." />
        </label>
        <div className="flex items-center gap-2 mt-1">
          <input
            id="mongoSourceBucketAuto"
            type="checkbox"
            name="bucketAuto"
            checked={bucketAuto}
            onChange={handleChange}
            className="rounded border-[var(--vscode-border)] text-[var(--vscode-highlight)] accent-[var(--vscode-highlight)]"
          />
          <label
            htmlFor="mongoSourceBucketAuto"
            className="flex items-center gap-1.5 text-xs text-[var(--vscode-text-secondary)] cursor-pointer"
          >
            <span>Bucket-Auto Splitting</span>
            <InfoTooltip text="Uses MongoDB $bucketAuto aggregation operator to automatically partition collection into evenly sized splits (withBucketAuto)." />
          </label>
        </div>
        <PropertyField
          id="mongoSourceNumSplits"
          name="numSplits"
          label="Number of Splits"
          type="number"
          value={numSplits}
          onChange={handleChange}
          placeholder="0 (Automatic)"
          min={0}
          tooltip="Target number of splits to divide the collection into for parallel reads (Java: withNumSplits(splits)). Set 0 for auto."
        />
      </div>

      {/* Authentication Configuration Sub-section */}
      <MongoDbSourceAuthSection
        authMode={authMode}
        usernameSecret={usernameSecret}
        passwordSecret={passwordSecret}
        secrets={secrets}
        secretError={secretError}
        onChange={handleChange}
      />

      {/* Collapsible Advanced Source Settings Sub-section */}
      <MongoDbSourceAdvancedSection
        showAdvanced={showAdvanced}
        onToggleAdvanced={() => setShowAdvanced(!showAdvanced)}
        sslEnabled={sslEnabled}
        sslInvalidHostNameAllowed={sslInvalidHostNameAllowed}
        ignoreSSLCertificate={ignoreSSLCertificate}
        maxConnectionIdleTime={maxConnectionIdleTime}
        readPreference={readPreference}
        onChange={handleChange}
      />

      {/* Flexible Spacer */}
      <div className="flex-1 min-h-[16px]" />

      {/* Code Generation Instructions */}
      <PropertyField
        id="mongoSourceInstructions"
        name="system_instructions"
        label="Code Generation Instructions"
        tooltip="Custom instructions passed to the LLM code generator when synthesizing Beam pipeline code for Java (MongoDbIO.read()) or Python (ReadFromMongoDB)."
        type="textarea"
        rows={3}
        value={systemInstructions}
        onChange={handleInstructionsChange}
        placeholder="e.g. Read MongoDB BSON documents, filter by active status, and map to Beam Row schema"
        mono={true}
      />
    </div>
  );
};
