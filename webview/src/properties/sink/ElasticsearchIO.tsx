/**
 * ElasticsearchIOSinkProperties Component
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Renders the property configuration panel for Apache Beam ElasticsearchIO Write Sink nodes
 * (org.apache.beam.sdk.io.elasticsearch.ElasticsearchIO.write() in Java / cross-language expansion service in Python).
 * Configures Elasticsearch cluster connection addresses, target index and document type (deprecated in ES 7+),
 * bulk batch sizing (count and bytes), partial update mode, document ID / routing field extraction,
 * failure error handling, retry configuration, authentication via GCP Secret Manager, and advanced timeouts.
 *
 * Architectural Decisions:
 * - Real-time validation: Requires Cluster Addresses and Index with immediate visual cues and ARIA attributes.
 * - Scheme format warning: Alerts user when any cluster address is missing an "http://" or "https://" scheme.
 * - Connection configuration mapping: Properties map to ElasticsearchIO.ConnectionConfiguration.create(...)
 *   and ElasticsearchIO.write() builder methods.
 * - Retry configuration: Models both retry max attempts and retry max duration for withRetryConfiguration.
 * - Dynamic discovery: Requests GCP Secret Manager secrets via 'getSecrets' IPC message to populate
 *   the 'elasticsearch-sink-secret-options' datalist.
 * - Decomposed into local presentational sub-components adhering to "props in, events up" with semantic callbacks.
 * - Preserves system_instructions / special_instructions for LLM code generation.
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

export type ElasticsearchAuthMode = 'none' | 'basic_secret_manager' | 'api_key_secret';

export interface ElasticsearchIOSinkPropertiesProps {
  node: {
    data: {
      label?: string;
      beam_transform?: string;
      system_instructions?: string;
      special_instructions?: string;
      properties?: {
        addresses?: string;
        index?: string;
        type?: string;
        maxBatchSize?: number | string;
        maxBatchSizeBytes?: number | string;
        usePartialUpdate?: boolean;
        idFn?: string;
        routingFn?: string;
        throwWriteErrors?: boolean;
        retryMaxAttempts?: number | string;
        retryMaxDuration?: string;
        authMode?: ElasticsearchAuthMode | string;
        usernameSecret?: string;
        passwordSecret?: string;
        apiKeySecret?: string;
        connectTimeout?: number | string;
        socketTimeout?: number | string;
        trustSelfSignedCerts?: boolean;
        allowableResponseErrors?: string;
        system_instructions?: string;
        special_instructions?: string;
        [key: string]: any;
      };
    };
  };
  onChange: (properties: any) => void;
}

interface SinkTargetSectionProps {
  addresses: string;
  index: string;
  type: string;
  isAddressesEmpty: boolean;
  isIndexEmpty: boolean;
  hasSchemeWarning: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
}

/**
 * Presentational component for Elasticsearch cluster addresses and target index.
 */
const SinkTargetSection: React.FC<SinkTargetSectionProps> = ({
  addresses,
  index,
  type,
  isAddressesEmpty,
  isIndexEmpty,
  hasSchemeWarning,
  onChange,
}) => {
  return (
    <div className="flex flex-col gap-2 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
      <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
        <span>Cluster & Destination Index</span>
        <InfoTooltip text="Configures Elasticsearch cluster connection addresses and target index for ElasticsearchIO.write()." />
      </label>

      <PropertyField
        id="es-sink-addresses"
        name="addresses"
        label="Cluster Addresses"
        tooltip="Comma-separated list of Elasticsearch node URLs including scheme and port (e.g. http://node1:9200,http://node2:9200)."
        value={addresses}
        onChange={onChange}
        placeholder="http://localhost:9200"
        required="Cluster Addresses are required"
        invalid={isAddressesEmpty}
        error={isAddressesEmpty ? 'Cluster Addresses are required' : null}
      />
      {hasSchemeWarning && (
        <span className="text-xs text-amber-400" role="alert">
          Warning: Cluster address entries should include a URL scheme (e.g. &quot;http://&quot; or &quot;https://&quot;).
        </span>
      )}

      <div className="grid grid-cols-2 gap-2">
        <PropertyField
          id="es-sink-index"
          name="index"
          label="Index"
          tooltip="Elasticsearch destination index to write documents into (required)."
          value={index}
          onChange={onChange}
          placeholder="e.g. sensor_aggregates"
          required="Index is required"
          invalid={isIndexEmpty}
          error={isIndexEmpty ? 'Index is required' : null}
        />
        <PropertyField
          id="es-sink-type"
          name="type"
          label="Document Type"
          tooltip="Elasticsearch document mapping type. NOTE: Deprecated and ignored in Elasticsearch 7+ and 8+ (typeless APIs)."
          value={type}
          onChange={onChange}
          placeholder="e.g. _doc (deprecated in ES 7+)"
        />
      </div>
    </div>
  );
};

interface SinkBulkSectionProps {
  maxBatchSize: number | string;
  maxBatchSizeBytes: number | string;
  usePartialUpdate: boolean;
  idFn: string;
  routingFn: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
}

/**
 * Presentational component for bulk indexing behavior and document identity.
 */
const SinkBulkSection: React.FC<SinkBulkSectionProps> = ({
  maxBatchSize,
  maxBatchSizeBytes,
  usePartialUpdate,
  idFn,
  routingFn,
  onChange,
}) => {
  return (
    <div className="flex flex-col gap-2 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
      <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
        <span>Bulk Indexing Options</span>
        <InfoTooltip text="Configures bulk batching limits, partial updates, and document ID/routing extraction." />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <PropertyField
          id="es-sink-max-batch-size"
          name="maxBatchSize"
          label="Max Batch Size"
          type="number"
          min={1}
          tooltip="Maximum number of documents to buffer per bulk write request (maps to withMaxBatchSize)."
          value={maxBatchSize}
          onChange={onChange}
          placeholder="1000"
        />
        <PropertyField
          id="es-sink-max-batch-size-bytes"
          name="maxBatchSizeBytes"
          label="Max Batch Size (Bytes)"
          type="number"
          min={0}
          tooltip="Maximum bulk request payload size in bytes before flushing (maps to withMaxBatchSizeBytes)."
          value={maxBatchSizeBytes}
          onChange={onChange}
          placeholder="5242880"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <PropertyField
          id="es-sink-id-fn"
          name="idFn"
          label="Document ID Field / Fn"
          tooltip="Document field or extraction function providing the document _id (maps to withIdFn)."
          value={idFn}
          onChange={onChange}
          placeholder="e.g. id or deviceId"
        />
        <PropertyField
          id="es-sink-routing-fn"
          name="routingFn"
          label="Routing Field / Fn"
          tooltip="Document field or extraction function providing shard routing (maps to withRoutingFn)."
          value={routingFn}
          onChange={onChange}
          placeholder="e.g. tenantId"
        />
      </div>

      <div className="flex items-center gap-2 mt-1">
        <input
          id="es-sink-partial-update"
          name="usePartialUpdate"
          type="checkbox"
          checked={usePartialUpdate}
          onChange={onChange}
          className="accent-[var(--vscode-highlight)] cursor-pointer"
        />
        <label htmlFor="es-sink-partial-update" className="text-xs text-[var(--vscode-text-primary)] cursor-pointer flex items-center gap-1.5">
          <span>Use Partial Update (Upsert)</span>
          <InfoTooltip text="Updates existing documents instead of replacing them (maps to withUsePartialUpdate)." />
        </label>
      </div>
    </div>
  );
};

interface SinkFailureSectionProps {
  throwWriteErrors: boolean;
  retryMaxAttempts: number | string;
  retryMaxDuration: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
}

/**
 * Presentational component for failure handling and retry configuration.
 */
const SinkFailureSection: React.FC<SinkFailureSectionProps> = ({
  throwWriteErrors,
  retryMaxAttempts,
  retryMaxDuration,
  onChange,
}) => {
  return (
    <div className="flex flex-col gap-2 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
      <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
        <span>Failure Handling & Retries</span>
        <InfoTooltip text="Configures error reporting and exponential backoff retry parameters for bulk write requests." />
      </label>

      <div className="flex items-center gap-2">
        <input
          id="es-sink-throw-errors"
          name="throwWriteErrors"
          type="checkbox"
          checked={throwWriteErrors}
          onChange={onChange}
          className="accent-[var(--vscode-highlight)] cursor-pointer"
        />
        <label htmlFor="es-sink-throw-errors" className="text-xs text-[var(--vscode-text-primary)] cursor-pointer flex items-center gap-1.5">
          <span>Throw Write Errors</span>
          <InfoTooltip text="Whether to throw an exception when documents fail indexing (maps to withThrowWriteErrors)." />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2 mt-1">
        <PropertyField
          id="es-sink-retry-max-attempts"
          name="retryMaxAttempts"
          label="Retry Max Attempts"
          type="number"
          min={0}
          tooltip="Maximum number of retry attempts for failed bulk requests in withRetryConfiguration."
          value={retryMaxAttempts}
          onChange={onChange}
          placeholder="5"
        />
        <PropertyField
          id="es-sink-retry-max-duration"
          name="retryMaxDuration"
          label="Retry Max Duration"
          tooltip="Maximum total duration for retries, e.g. 1m or 30s (maps to withRetryConfiguration duration)."
          value={retryMaxDuration}
          onChange={onChange}
          placeholder="e.g. 1m"
        />
      </div>
    </div>
  );
};

interface SinkAuthSectionProps {
  authMode: ElasticsearchAuthMode;
  usernameSecret: string;
  passwordSecret: string;
  apiKeySecret: string;
  secrets: SecretItem[];
  secretError: string | null;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}

/**
 * Presentational component for Authentication and credential secrets for sink.
 */
const SinkAuthSection: React.FC<SinkAuthSectionProps> = ({
  authMode,
  usernameSecret,
  passwordSecret,
  apiKeySecret,
  secrets,
  secretError,
  onChange,
}) => {
  return (
    <div className="flex flex-col gap-2 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
      <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
        <span>Authentication & Security</span>
        <InfoTooltip text="Configures Elasticsearch authentication: None (anonymous/testing), Basic Auth via GCP Secret Manager, or API Key via Secret Manager." />
      </label>

      <div className="flex flex-col gap-2">
        <label htmlFor="es-sink-auth-mode" className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          <span>Auth Mode</span>
          <InfoTooltip text="Select authentication method for Elasticsearch cluster." />
        </label>
        <select
          id="es-sink-auth-mode"
          name="authMode"
          value={authMode}
          onChange={onChange}
          className="bg-[var(--vscode-input-bg)] text-[var(--vscode-text-primary)] p-2 rounded border border-[var(--vscode-border)] text-xs focus:outline-none focus:border-[var(--vscode-highlight)]"
        >
          <option value="none">None / Anonymous</option>
          <option value="basic_secret_manager">Basic Auth (Secret Manager)</option>
          <option value="api_key_secret">API Key (Secret Manager)</option>
        </select>
      </div>

      {authMode === 'basic_secret_manager' && (
        <div className="grid grid-cols-2 gap-2">
          <PropertyField
            id="es-sink-username-secret"
            name="usernameSecret"
            label="Username Secret"
            tooltip="GCP Secret Manager secret ID containing the Elasticsearch username."
            value={usernameSecret}
            onChange={onChange}
            placeholder="e.g. es-username-secret"
            list="elasticsearch-sink-secret-options"
            datalist={secrets.map((s) => ({ value: s.id || s.name, label: s.name || s.id }))}
          />
          <PropertyField
            id="es-sink-password-secret"
            name="passwordSecret"
            label="Password Secret"
            tooltip="GCP Secret Manager secret ID containing the Elasticsearch password."
            value={passwordSecret}
            onChange={onChange}
            placeholder="e.g. es-password-secret"
            list="elasticsearch-sink-secret-options"
            datalist={secrets.map((s) => ({ value: s.id || s.name, label: s.name || s.id }))}
          />
        </div>
      )}

      {authMode === 'api_key_secret' && (
        <PropertyField
          id="es-sink-api-key-secret"
          name="apiKeySecret"
          label="API Key Secret"
          tooltip="GCP Secret Manager secret ID containing the base64-encoded Elasticsearch API Key."
          value={apiKeySecret}
          onChange={onChange}
          placeholder="e.g. es-api-key-secret"
          list="elasticsearch-sink-secret-options"
          datalist={secrets.map((s) => ({ value: s.id || s.name, label: s.name || s.id }))}
        />
      )}

      {secretError && (
        <span className="text-xs text-red-400 mt-1" role="alert">
          {secretError}
        </span>
      )}
    </div>
  );
};

interface SinkAdvancedSectionProps {
  showAdvanced: boolean;
  onToggle: () => void;
  connectTimeout: number | string;
  socketTimeout: number | string;
  trustSelfSignedCerts: boolean;
  allowableResponseErrors: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
}

/**
 * Presentational component for collapsible Advanced Sink Settings.
 */
const SinkAdvancedSection: React.FC<SinkAdvancedSectionProps> = ({
  showAdvanced,
  onToggle,
  connectTimeout,
  socketTimeout,
  trustSelfSignedCerts,
  allowableResponseErrors,
  onChange,
}) => {
  return (
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
          <div className="grid grid-cols-2 gap-2">
            <PropertyField
              id="es-sink-connect-timeout"
              name="connectTimeout"
              label="Connect Timeout (ms)"
              type="number"
              min={0}
              tooltip="Elasticsearch client connection timeout in milliseconds (maps to withConnectTimeout)."
              value={connectTimeout}
              onChange={onChange}
              placeholder="30000"
            />
            <PropertyField
              id="es-sink-socket-timeout"
              name="socketTimeout"
              label="Socket Timeout (ms)"
              type="number"
              min={0}
              tooltip="Elasticsearch client socket timeout in milliseconds (maps to withSocketTimeout)."
              value={socketTimeout}
              onChange={onChange}
              placeholder="30000"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              id="es-sink-trust-self-signed"
              name="trustSelfSignedCerts"
              type="checkbox"
              checked={trustSelfSignedCerts}
              onChange={onChange}
              className="accent-[var(--vscode-highlight)] cursor-pointer"
            />
            <label htmlFor="es-sink-trust-self-signed" className="text-xs text-[var(--vscode-text-primary)] cursor-pointer flex items-center gap-1.5">
              <span>Trust Self-Signed Certificates</span>
              <InfoTooltip text="Configures client to trust self-signed SSL/TLS certificates (maps to withTrustSelfSignedCerts)." />
            </label>
          </div>

          <PropertyField
            id="es-sink-allowable-response-errors"
            name="allowableResponseErrors"
            label="Allowable Response Errors"
            tooltip="Comma-separated list of Elasticsearch error types to ignore without failing (maps to withAllowableResponseErrors)."
            value={allowableResponseErrors}
            onChange={onChange}
            placeholder="e.g. version_conflict_engine_exception"
          />
        </div>
      )}
    </div>
  );
};

/**
 * ElasticsearchIOSinkProperties renders the configuration form for ElasticsearchIO.write().
 *
 * @param props Component properties containing the active node and onChange callback
 */
export const ElasticsearchIOSinkProperties: React.FC<ElasticsearchIOSinkPropertiesProps> = ({ node, onChange }) => {
  const properties = node?.data?.properties || {};

  // Form field state extracted from node properties
  const addresses = properties.addresses || '';
  const index = properties.index || '';
  const type = properties.type || '';

  const maxBatchSize = properties.maxBatchSize ?? '';
  const maxBatchSizeBytes = properties.maxBatchSizeBytes ?? '';
  const usePartialUpdate = properties.usePartialUpdate ?? false;
  const idFn = properties.idFn || '';
  const routingFn = properties.routingFn || '';

  const throwWriteErrors = properties.throwWriteErrors ?? true;
  const retryMaxAttempts = properties.retryMaxAttempts ?? '';
  const retryMaxDuration = properties.retryMaxDuration || '';

  const authMode: ElasticsearchAuthMode = (properties.authMode as ElasticsearchAuthMode) || 'none';
  const usernameSecret = properties.usernameSecret || '';
  const passwordSecret = properties.passwordSecret || '';
  const apiKeySecret = properties.apiKeySecret || '';

  const connectTimeout = properties.connectTimeout ?? '';
  const socketTimeout = properties.socketTimeout ?? '';
  const trustSelfSignedCerts = properties.trustSelfSignedCerts ?? false;
  const allowableResponseErrors = properties.allowableResponseErrors || '';

  // Local UI state
  const { items: rawSecrets, error: secretError } = useAssetLoader<SecretItem | string>('secrets');
  const secrets: SecretItem[] = (rawSecrets || []).map(normalizeSecretItem);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Field validation
  const isAddressesEmpty = !addresses.trim();
  const isIndexEmpty = !index.trim();

  // Address scheme format warning
  const hasSchemeWarning =
    addresses.trim().length > 0 &&
    addresses.split(',').some((addr) => {
      const trimmed = addr.trim();
      return trimmed.length > 0 && !trimmed.startsWith('http://') && !trimmed.startsWith('https://');
    });

  // Fallback chain for system instructions
  const systemInstructions =
    node?.data?.system_instructions ??
    node?.data?.special_instructions ??
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
    const updated = { ...properties, [name]: value };
    onChange(updated);
  };

  /**
   * Handles text, select, and checkbox input changes.
   *
   * @param e Standard React change event
   */
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type: elemType } = e.target;
    if (elemType === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      updateProperty(name, checked);
    } else {
      updateProperty(name, value);
    }
  };

  /**
   * Handles system instructions textarea modifications.
   *
   * @param e React textarea change event
   */
  const handleInstructionsChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    onChange({
      ...properties,
      system_instructions: e.target.value,
    });
  };

  return (
    <div className="flex-1 flex flex-col gap-4 text-[var(--vscode-text-primary)] text-sm">
      {/* Cluster Addresses & Destination Index */}
      <SinkTargetSection
        addresses={addresses}
        index={index}
        type={type}
        isAddressesEmpty={isAddressesEmpty}
        isIndexEmpty={isIndexEmpty}
        hasSchemeWarning={hasSchemeWarning}
        onChange={handleChange}
      />

      {/* Bulk Indexing Options */}
      <SinkBulkSection
        maxBatchSize={maxBatchSize}
        maxBatchSizeBytes={maxBatchSizeBytes}
        usePartialUpdate={usePartialUpdate}
        idFn={idFn}
        routingFn={routingFn}
        onChange={handleChange}
      />

      {/* Failure Handling & Retries */}
      <SinkFailureSection
        throwWriteErrors={throwWriteErrors}
        retryMaxAttempts={retryMaxAttempts}
        retryMaxDuration={retryMaxDuration}
        onChange={handleChange}
      />

      {/* Authentication & Security */}
      <SinkAuthSection
        authMode={authMode}
        usernameSecret={usernameSecret}
        passwordSecret={passwordSecret}
        apiKeySecret={apiKeySecret}
        secrets={secrets}
        secretError={secretError}
        onChange={handleChange}
      />

      {/* Collapsible Advanced Sink Settings */}
      <SinkAdvancedSection
        showAdvanced={showAdvanced}
        onToggle={() => setShowAdvanced(!showAdvanced)}
        connectTimeout={connectTimeout}
        socketTimeout={socketTimeout}
        trustSelfSignedCerts={trustSelfSignedCerts}
        allowableResponseErrors={allowableResponseErrors}
        onChange={handleChange}
      />

      {/* Spacer before Instructions textarea */}
      <div className="flex-1 min-h-[16px]" />

      {/* Code Generation Instructions Textarea */}
      <PropertyField
        id="es-sink-instructions"
        name="system_instructions"
        label="Code Generation Instructions"
        tooltip="Custom system instructions passed to the LLM when generating code for this Elasticsearch sink transform."
        type="textarea"
        rows={4}
        mono={false}
        value={systemInstructions}
        onChange={handleInstructionsChange}
        placeholder="e.g. ElasticsearchIO.write().withConnectionConfiguration(ConnectionConfiguration.create(new String[]{'http://localhost:9200'}, 'sensor_aggregates')).withMaxBatchSize(1000)"
      />
    </div>
  );
};
