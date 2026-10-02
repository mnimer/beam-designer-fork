/**
 * SolrIOSinkProperties Component
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Renders the property configuration panel for Apache Beam SolrIO Write Sink nodes
 * (org.apache.beam.sdk.io.solr.SolrIO.write() in Java / cross-language expansion service in Python).
 * Configures SolrCloud ZooKeeper ensemble connection, destination collection, bulk batch sizing
 * (withMaxBatchSize), exponential backoff retry configuration (withRetryConfiguration),
 * authentication (None vs Basic Auth via GCP Secret Manager), commit latency tuning, and network timeouts.
 *
 * Architectural Decisions:
 * - Real-time validation: Requires ZooKeeper Host and Collection name with instant validation alerts and ARIA flags.
 * - SolrCloud ZK ensemble validation: Displays a helpful warning when an HTTP/HTTPS scheme is entered instead of a ZK host string.
 * - Connection configuration mapping: Models SolrIO.ConnectionConfiguration.create(zkHost).withBasicCredentials(...)
 *   passed to SolrIO.write().withConnectionConfiguration(...).
 * - Retry configuration: Models both retry max attempts and retry max duration for withRetryConfiguration.
 * - Dynamic discovery: Requests GCP Secret Manager secrets via 'getSecrets' IPC message to populate
 *   the 'solr-sink-secret-options' datalist for secure credential binding.
 * - Decomposed into local presentational sub-components adhering to "props in, events up" with semantic callbacks (onToggle).
 * - Preserves system_instructions / special_instructions for LLM code generation.
 * - Strictly follows the 8pt grid system and Tailwind CSS styling using VS Code theme tokens.
 */

import React, { useState } from 'react';
import { CollapsibleSection } from '../../components/common/CollapsibleSection';
import { InfoTooltip } from '../../components/InfoTooltip';
import { PropertyField } from '../../components/common/PropertyField';
import { SystemInstructionsField } from '../../components/common/SystemInstructionsField';
import { resolveSystemInstructions } from '../../utils/systemInstructions';
import { useAssetLoader } from '../../hooks/useAssetLoader';
import { normalizeSecretItem } from '../../components/common/SecretManagerAuthFields';

/**
 * Secret item loaded from Secret Manager for Solr authentication.
 */
export interface SecretItem {
  id: string;
  name: string;
  fullName?: string;
}

export type SolrAuthMode = 'none' | 'basic_secret_manager';

/**
 * Props for the SolrIOSinkProperties component.
 */
export interface SolrIOSinkPropertiesProps {
  node: {
    data: {
      label?: string;
      beam_transform?: string;
      system_instructions?: string;
      special_instructions?: string;
      properties?: {
        zkHost?: string;
        collection?: string;
        maxBatchSize?: number | string;
        retryMaxAttempts?: number | string;
        retryMaxDuration?: string;
        authMode?: SolrAuthMode | string;
        usernameSecret?: string;
        passwordSecret?: string;
        connectTimeout?: number | string;
        socketTimeout?: number | string;
        commitWithinMs?: number | string;
        system_instructions?: string;
        special_instructions?: string;
        [key: string]: any;
      };
    };
  };
  onChange: (properties: any) => void;
}

/**
 * Props for the SinkTargetSection component.
 */
interface SinkTargetSectionProps {
  zkHost: string;
  collection: string;
  isZkHostEmpty: boolean;
  isCollectionEmpty: boolean;
  hasHttpWarning: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
}

/**
 * Presentational component for SolrCloud ZooKeeper host and destination collection.
 */
const SinkTargetSection: React.FC<SinkTargetSectionProps> = ({
  zkHost,
  collection,
  isZkHostEmpty,
  isCollectionEmpty,
  hasHttpWarning,
  onChange,
}) => {
  return (
    <div className="flex flex-col gap-2 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
      <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
        <span>SolrCloud & Destination Collection</span>
        <InfoTooltip text="Configures SolrCloud ZooKeeper ensemble connect string and destination collection for SolrIO.write()." />
      </label>

      <PropertyField
        id="solr-sink-zk-host"
        name="zkHost"
        label="ZooKeeper Host (SolrCloud)"
        tooltip="ZooKeeper ensemble connect string including chroot (e.g. zk1:2181,zk2:2181/solr). SolrIO connects via ZooKeeper, not an HTTP URL."
        value={zkHost}
        onChange={onChange}
        placeholder="zk1:2181,zk2:2181/solr"
        required="ZooKeeper Host is required"
        invalid={isZkHostEmpty}
        error={isZkHostEmpty ? 'ZooKeeper Host is required' : null}
        helperText={
          <span>
            Connects to SolrCloud via ZooKeeper ensemble string (e.g.{' '}
            <code className="text-slate-300 bg-slate-800/60 px-1 py-0.5 rounded">zk1:2181,zk2:2181/solr</code>).
          </span>
        }
      />
      {hasHttpWarning && (
        <span className="text-xs text-amber-400" role="alert">
          Warning: SolrIO connects via SolrCloud ZooKeeper ensemble string (e.g. &quot;zk1:2181,zk2:2181/solr&quot;), not an HTTP URL.
        </span>
      )}

      <PropertyField
        id="solr-sink-collection"
        name="collection"
        label="Destination Collection"
        tooltip="Solr collection name to write SolrInputDocument records into (maps to SolrIO.write().to(collection))."
        value={collection}
        onChange={onChange}
        placeholder="e.g. products_search"
        required="Collection name is required"
        invalid={isCollectionEmpty}
        error={isCollectionEmpty ? 'Collection name is required' : null}
      />
    </div>
  );
};

/**
 * Props for the SinkBatchSection component.
 */
interface SinkBatchSectionProps {
  maxBatchSize: number | string;
  retryMaxAttempts: number | string;
  retryMaxDuration: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
}

/**
 * Presentational component for batching and retry configuration.
 */
const SinkBatchSection: React.FC<SinkBatchSectionProps> = ({
  maxBatchSize,
  retryMaxAttempts,
  retryMaxDuration,
  onChange,
}) => {
  return (
    <div className="flex flex-col gap-2 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
      <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
        <span>Batching & Retries</span>
        <InfoTooltip text="Configures maximum batch write size (withMaxBatchSize) and exponential retry parameters (withRetryConfiguration)." />
      </label>

      <PropertyField
        id="solr-sink-max-batch-size"
        name="maxBatchSize"
        label="Max Batch Size"
        type="number"
        min={1}
        tooltip="Maximum number of SolrInputDocument instances sent per bulk indexing request (maps to withMaxBatchSize)."
        value={maxBatchSize}
        onChange={onChange}
        placeholder="1000"
      />

      <div className="grid grid-cols-2 gap-2">
        <PropertyField
          id="solr-sink-retry-max-attempts"
          name="retryMaxAttempts"
          label="Retry Max Attempts"
          type="number"
          min={0}
          tooltip="Maximum number of retry attempts for transient SolrCloud errors (maps to RetryConfiguration.create(maxAttempts, ...))."
          value={retryMaxAttempts}
          onChange={onChange}
          placeholder="5"
        />
        <PropertyField
          id="solr-sink-retry-max-duration"
          name="retryMaxDuration"
          label="Retry Max Duration"
          tooltip="Maximum total retry duration before giving up, e.g. 1m or 30s (maps to RetryConfiguration.create(..., maxDuration))."
          value={retryMaxDuration}
          onChange={onChange}
          placeholder="e.g. 1m"
        />
      </div>
    </div>
  );
};

/**
 * Props for the SinkAuthSection component.
 */
interface SinkAuthSectionProps {
  authMode: SolrAuthMode;
  usernameSecret: string;
  passwordSecret: string;
  secrets: SecretItem[];
  secretError: string | null;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}

/**
 * Presentational component for Authentication credentials.
 */
const SinkAuthSection: React.FC<SinkAuthSectionProps> = ({
  authMode,
  usernameSecret,
  passwordSecret,
  secrets,
  secretError,
  onChange,
}) => {
  return (
    <div className="flex flex-col gap-2 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
      <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
        <span>Authentication & Security</span>
        <InfoTooltip text="Configures SolrCloud authentication: None (anonymous) or Basic Authentication via GCP Secret Manager." />
      </label>

      <div className="flex flex-col gap-2">
        <label htmlFor="solr-sink-auth-mode" className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          <span>Auth Mode</span>
          <InfoTooltip text="Select authentication method for SolrCloud cluster." />
        </label>
        <select
          id="solr-sink-auth-mode"
          name="authMode"
          value={authMode}
          onChange={onChange}
          className="bg-[var(--vscode-input-bg)] text-[var(--vscode-text-primary)] p-2 rounded border border-[var(--vscode-border)] text-xs focus:outline-none focus:border-[var(--vscode-highlight)]"
        >
          <option value="none">None / Anonymous</option>
          <option value="basic_secret_manager">Basic Auth (Secret Manager)</option>
        </select>
      </div>

      {authMode === 'basic_secret_manager' && (
        <div className="grid grid-cols-2 gap-2">
          <PropertyField
            id="solr-sink-username-secret"
            name="usernameSecret"
            label="Username Secret"
            tooltip="GCP Secret Manager secret ID containing the Solr username (maps to withBasicCredentials)."
            value={usernameSecret}
            onChange={onChange}
            placeholder="e.g. solr-username-secret"
            list="solr-sink-secret-options"
            datalist={secrets.map((s) => ({ value: s.id || s.name, label: s.name || s.id }))}
          />
          <PropertyField
            id="solr-sink-password-secret"
            name="passwordSecret"
            label="Password Secret"
            tooltip="GCP Secret Manager secret ID containing the Solr password (maps to withBasicCredentials)."
            value={passwordSecret}
            onChange={onChange}
            placeholder="e.g. solr-password-secret"
            list="solr-sink-secret-options"
            datalist={secrets.map((s) => ({ value: s.id || s.name, label: s.name || s.id }))}
          />
        </div>
      )}

      {secretError && (
        <span className="text-xs text-red-400 mt-1" role="alert">
          {secretError}
        </span>
      )}
    </div>
  );
};

/**
 * Props for the SolrIO sink advanced settings section.
 */
interface SinkAdvancedSectionProps {
  showAdvanced: boolean;
  onToggle: () => void;
  connectTimeout: number | string;
  socketTimeout: number | string;
  commitWithinMs: number | string;
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
  commitWithinMs,
  onChange,
}) => {
  return (
    <CollapsibleSection
      title="Advanced Sink Settings"
      isOpen={showAdvanced}
      onToggle={onToggle}
    >
      <div className="grid grid-cols-2 gap-2">
        <PropertyField
          id="solr-sink-connect-timeout"
          name="connectTimeout"
          label="Connect Timeout (ms)"
          type="number"
          min={0}
          tooltip="Solr client connection timeout in milliseconds."
          value={connectTimeout}
          onChange={onChange}
          placeholder="15000"
        />
        <PropertyField
          id="solr-sink-socket-timeout"
          name="socketTimeout"
          label="Socket Timeout (ms)"
          type="number"
          min={0}
          tooltip="Solr client socket timeout in milliseconds."
          value={socketTimeout}
          onChange={onChange}
          placeholder="30000"
        />
      </div>

      <PropertyField
        id="solr-sink-commit-within"
        name="commitWithinMs"
        label="Commit Within (ms)"
        type="number"
        min={0}
        tooltip="Maximum time in milliseconds before documents are soft-committed in SolrCloud."
        value={commitWithinMs}
        onChange={onChange}
        placeholder="10000"
      />
    </CollapsibleSection>
  );
};

/**
 * SolrIOSinkProperties renders the configuration form for SolrIO.write().
 *
 * @param props Component properties containing the active node and onChange callback
 */
export const SolrIOSinkProperties: React.FC<SolrIOSinkPropertiesProps> = ({ node, onChange }) => {
  const properties = node?.data?.properties || {};

  // Form field state extracted from node properties
  const zkHost = properties.zkHost || '';
  const collection = properties.collection || '';
  const maxBatchSize = properties.maxBatchSize ?? '';

  const retryMaxAttempts = properties.retryMaxAttempts ?? '';
  const retryMaxDuration = properties.retryMaxDuration || '';

  const authMode: SolrAuthMode = (properties.authMode as SolrAuthMode) || 'none';
  const usernameSecret = properties.usernameSecret || '';
  const passwordSecret = properties.passwordSecret || '';

  const connectTimeout = properties.connectTimeout ?? '';
  const socketTimeout = properties.socketTimeout ?? '';
  const commitWithinMs = properties.commitWithinMs ?? '';

  // Local UI state
  const { items: rawSecrets, error: secretError } = useAssetLoader<SecretItem | string>('secrets');
  const secrets: SecretItem[] = (rawSecrets || []).map(normalizeSecretItem);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Field validation: ZooKeeper Host and Collection are required
  const isZkHostEmpty = !zkHost.trim();
  const isCollectionEmpty = !collection.trim();

  // SolrCloud ZooKeeper format warning: warn if HTTP/HTTPS URL scheme was entered
  const hasHttpWarning =
    zkHost.trim().length > 0 &&
    (zkHost.trim().toLowerCase().startsWith('http://') || zkHost.trim().toLowerCase().startsWith('https://'));

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
   * Handles text, select, and textarea input changes.
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

  return (
    <div className="flex-1 flex flex-col gap-4 text-[var(--vscode-text-primary)] text-sm">
      {/* SolrCloud ZK Host & Destination Collection */}
      <SinkTargetSection
        zkHost={zkHost}
        collection={collection}
        isZkHostEmpty={isZkHostEmpty}
        isCollectionEmpty={isCollectionEmpty}
        hasHttpWarning={hasHttpWarning}
        onChange={handleChange}
      />

      {/* Batching & Retries */}
      <SinkBatchSection
        maxBatchSize={maxBatchSize}
        retryMaxAttempts={retryMaxAttempts}
        retryMaxDuration={retryMaxDuration}
        onChange={handleChange}
      />

      {/* Authentication & Security */}
      <SinkAuthSection
        authMode={authMode}
        usernameSecret={usernameSecret}
        passwordSecret={passwordSecret}
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
        commitWithinMs={commitWithinMs}
        onChange={handleChange}
      />

      {/* Code Generation Instructions Textarea */}
      <SystemInstructionsField
        id="solr-sink-instructions"
        value={systemInstructions}
        rows={4}
        tooltip="Custom system instructions passed to the LLM when generating code for this Solr sink transform."
        placeholder="e.g. SolrIO.write().withConnectionConfiguration(SolrIO.ConnectionConfiguration.create('zk1:2181,zk2:2181/solr')).to('products_search').withMaxBatchSize(1000)"
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
