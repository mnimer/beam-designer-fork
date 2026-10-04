/**
 * ElasticsearchIOSourceProperties Component
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Renders the property configuration panel for Apache Beam ElasticsearchIO Read Source nodes
 * (org.apache.beam.sdk.io.elasticsearch.ElasticsearchIO.read() in Java / cross-language expansion service in Python).
 * Configures Elasticsearch cluster connection addresses, target index and document type (deprecated in ES 7+),
 * Query DSL JSON, scroll keepalive, batch sizing, Point-in-Time (PIT) search, authentication
 * (None, Basic via GCP Secret Manager, or API Key via Secret Manager), and advanced network/SSL options.
 *
 * Architectural Decisions:
 * - Real-time validation: Requires Cluster Addresses and Index with immediate visual feedback and ARIA attributes.
 * - Scheme format warning: Alerts user when any cluster address is missing an "http://" or "https://" scheme.
 * - Connection configuration mapping: Properties map to ElasticsearchIO.ConnectionConfiguration.create(...)
 *   builder methods (.withConnectTimeout, .withSocketTimeout, .withTrustSelfSignedCerts, etc.).
 * - Dynamic discovery: Queries GCP Secret Manager secrets via 'getSecrets' IPC message to populate
 *   the 'elasticsearch-source-secret-options' datalist for secure credential binding.
 * - Decomposed into local presentational sub-components adhering to "props in, events up" with semantic callbacks.
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

/** Secret descriptor loaded from the secret manager for Elasticsearch authentication. */
export interface SecretItem {
  id: string;
  name: string;
  fullName?: string;
}

export type ElasticsearchAuthMode = 'none' | 'basic_secret_manager' | 'api_key_secret';

/** Props for the {@link ElasticsearchIOSourceProperties} component. */
export interface ElasticsearchIOSourcePropertiesProps {
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
        query?: string;
        scrollKeepalive?: string;
        batchSize?: number | string;
        pointInTimeSearch?: boolean;
        authMode?: ElasticsearchAuthMode | string;
        usernameSecret?: string;
        passwordSecret?: string;
        apiKeySecret?: string;
        connectTimeout?: number | string;
        socketTimeout?: number | string;
        trustSelfSignedCerts?: boolean;
        keystorePath?: string;
        keystorePasswordSecret?: string;
        system_instructions?: string;
        special_instructions?: string;
        [key: string]: any;
      };
    };
  };
  onChange: (properties: any) => void;
}

/** Props for the Elasticsearch target cluster and index configuration section. */
interface SourceTargetSectionProps {
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
const SourceTargetSection: React.FC<SourceTargetSectionProps> = ({
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
        <span>Cluster & Target Index</span>
        <InfoTooltip text="Configures Elasticsearch cluster connection addresses and target index for ElasticsearchIO.read()." />
      </label>

      <PropertyField
        id="es-source-addresses"
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
          id="es-source-index"
          name="index"
          label="Index"
          tooltip="Elasticsearch index to read documents from (required)."
          value={index}
          onChange={onChange}
          placeholder="e.g. sensor_readings"
          required="Index is required"
          invalid={isIndexEmpty}
          error={isIndexEmpty ? 'Index is required' : null}
        />
        <PropertyField
          id="es-source-type"
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

/** Props for the Elasticsearch query and pagination configuration section. */
interface SourceQuerySectionProps {
  query: string;
  scrollKeepalive: string;
  batchSize: number | string;
  pointInTimeSearch: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
}

/**
 * Presentational component for Query DSL and read pagination options.
 */
const SourceQuerySection: React.FC<SourceQuerySectionProps> = ({
  query,
  scrollKeepalive,
  batchSize,
  pointInTimeSearch,
  onChange,
}) => {
  return (
    <div className="flex flex-col gap-2 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
      <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
        <span>Query & Pagination</span>
        <InfoTooltip text="Configures Elasticsearch Query DSL JSON filter, scroll retention keepalive, batch size, and PIT search." />
      </label>

      <PropertyField
        id="es-source-query"
        name="query"
        label="Query DSL (JSON)"
        tooltip="Elasticsearch Query DSL JSON string passed to ElasticsearchIO.Read.withQuery()."
        type="textarea"
        rows={4}
        value={query}
        onChange={onChange}
        placeholder={'{\n  "query": {\n    "match_all": {}\n  }\n}'}
      />

      <div className="grid grid-cols-2 gap-2">
        <PropertyField
          id="es-source-scroll-keepalive"
          name="scrollKeepalive"
          label="Scroll Keepalive"
          tooltip="Scroll context keepalive duration (maps to ElasticsearchIO.Read.withScrollKeepalive), e.g. 5m or 10m."
          value={scrollKeepalive}
          onChange={onChange}
          placeholder="e.g. 5m"
        />
        <PropertyField
          id="es-source-batch-size"
          name="batchSize"
          label="Batch Size"
          type="number"
          min={1}
          tooltip="Number of documents to retrieve per scroll search request (maps to ElasticsearchIO.Read.withBatchSize)."
          value={batchSize}
          onChange={onChange}
          placeholder="1000"
        />
      </div>

      <div className="flex items-center gap-2 mt-1">
        <input
          id="es-source-pit"
          name="pointInTimeSearch"
          type="checkbox"
          checked={pointInTimeSearch}
          onChange={onChange}
          className="accent-[var(--vscode-highlight)] cursor-pointer"
        />
        <label htmlFor="es-source-pit" className="text-xs text-[var(--vscode-text-primary)] cursor-pointer flex items-center gap-1.5">
          <span>Enable Point In Time Search (PIT)</span>
          <InfoTooltip text="Enables Point-in-Time (PIT) search for supported Elasticsearch versions (maps to withPointInTimeSearch)." />
        </label>
      </div>
    </div>
  );
};

/** Props for the Elasticsearch authentication configuration section. */
interface SourceAuthSectionProps {
  authMode: ElasticsearchAuthMode;
  usernameSecret: string;
  passwordSecret: string;
  apiKeySecret: string;
  secrets: SecretItem[];
  secretError: string | null;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}

/**
 * Presentational component for Authentication and credential secrets.
 */
const SourceAuthSection: React.FC<SourceAuthSectionProps> = ({
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
        <label htmlFor="es-source-auth-mode" className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          <span>Auth Mode</span>
          <InfoTooltip text="Select authentication method for Elasticsearch cluster." />
        </label>
        <select
          id="es-source-auth-mode"
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
            id="es-source-username-secret"
            name="usernameSecret"
            label="Username Secret"
            tooltip="GCP Secret Manager secret ID containing the Elasticsearch username."
            value={usernameSecret}
            onChange={onChange}
            placeholder="e.g. es-username-secret"
            list="elasticsearch-source-secret-options"
            datalist={secrets.map((s) => ({ value: s.id || s.name, label: s.name || s.id }))}
          />
          <PropertyField
            id="es-source-password-secret"
            name="passwordSecret"
            label="Password Secret"
            tooltip="GCP Secret Manager secret ID containing the Elasticsearch password."
            value={passwordSecret}
            onChange={onChange}
            placeholder="e.g. es-password-secret"
            list="elasticsearch-source-secret-options"
            datalist={secrets.map((s) => ({ value: s.id || s.name, label: s.name || s.id }))}
          />
        </div>
      )}

      {authMode === 'api_key_secret' && (
        <PropertyField
          id="es-source-api-key-secret"
          name="apiKeySecret"
          label="API Key Secret"
          tooltip="GCP Secret Manager secret ID containing the base64-encoded Elasticsearch API Key."
          value={apiKeySecret}
          onChange={onChange}
          placeholder="e.g. es-api-key-secret"
          list="elasticsearch-source-secret-options"
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

/** Props for the Elasticsearch advanced connection settings section. */
interface SourceAdvancedSectionProps {
  showAdvanced: boolean;
  onToggle: () => void;
  connectTimeout: number | string;
  socketTimeout: number | string;
  trustSelfSignedCerts: boolean;
  keystorePath: string;
  keystorePasswordSecret: string;
  secrets: SecretItem[];
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
}

/**
 * Presentational component for collapsible Advanced Source Settings.
 */
const SourceAdvancedSection: React.FC<SourceAdvancedSectionProps> = ({
  showAdvanced,
  onToggle,
  connectTimeout,
  socketTimeout,
  trustSelfSignedCerts,
  keystorePath,
  keystorePasswordSecret,
  secrets,
  onChange,
}) => {
  return (
    <CollapsibleSection
      title="Advanced Source Settings"
      isOpen={showAdvanced}
      onToggle={onToggle}
    >
      <div className="grid grid-cols-2 gap-2">
        <PropertyField
          id="es-source-connect-timeout"
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
          id="es-source-socket-timeout"
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
          id="es-source-trust-self-signed"
          name="trustSelfSignedCerts"
          type="checkbox"
          checked={trustSelfSignedCerts}
          onChange={onChange}
          className="accent-[var(--vscode-highlight)] cursor-pointer"
        />
        <label htmlFor="es-source-trust-self-signed" className="text-xs text-[var(--vscode-text-primary)] cursor-pointer flex items-center gap-1.5">
          <span>Trust Self-Signed Certificates</span>
          <InfoTooltip text="Configures the client to trust self-signed SSL/TLS certificates (maps to withTrustSelfSignedCerts)." />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <PropertyField
          id="es-source-keystore-path"
          name="keystorePath"
          label="Keystore Path"
          tooltip="Path to SSL truststore/keystore file (maps to withKeystorePath)."
          value={keystorePath}
          onChange={onChange}
          placeholder="/path/to/keystore.jks"
        />
        <PropertyField
          id="es-source-keystore-password-secret"
          name="keystorePasswordSecret"
          label="Keystore Password Secret"
          tooltip="Secret Manager secret ID containing the SSL keystore password (maps to withKeystorePassword)."
          value={keystorePasswordSecret}
          onChange={onChange}
          placeholder="e.g. es-keystore-pwd"
          list="elasticsearch-source-secret-options"
          datalist={secrets.map((s) => ({ value: s.id || s.name, label: s.name || s.id }))}
        />
      </div>
    </CollapsibleSection>
  );
};

/**
 * ElasticsearchIOSourceProperties renders the configuration form for ElasticsearchIO.read().
 *
 * @param props Component properties containing the active node and onChange callback
 */
export const ElasticsearchIOSourceProperties: React.FC<ElasticsearchIOSourcePropertiesProps> = ({ node, onChange }) => {
  const properties = node?.data?.properties || {};

  // Form field state extracted from node properties
  const addresses = properties.addresses || '';
  const index = properties.index || '';
  const type = properties.type || '';
  const query = properties.query || '';
  const scrollKeepalive = properties.scrollKeepalive || '';
  const batchSize = properties.batchSize ?? '';
  const pointInTimeSearch = properties.pointInTimeSearch ?? false;

  const authMode: ElasticsearchAuthMode = (properties.authMode as ElasticsearchAuthMode) || 'none';
  const usernameSecret = properties.usernameSecret || '';
  const passwordSecret = properties.passwordSecret || '';
  const apiKeySecret = properties.apiKeySecret || '';

  const connectTimeout = properties.connectTimeout ?? '';
  const socketTimeout = properties.socketTimeout ?? '';
  const trustSelfSignedCerts = properties.trustSelfSignedCerts ?? false;
  const keystorePath = properties.keystorePath || '';
  const keystorePasswordSecret = properties.keystorePasswordSecret || '';

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
  return (
    <div className="flex-1 flex flex-col gap-4 text-[var(--vscode-text-primary)] text-sm">
      {/* Cluster Addresses & Target Index */}
      <SourceTargetSection
        addresses={addresses}
        index={index}
        type={type}
        isAddressesEmpty={isAddressesEmpty}
        isIndexEmpty={isIndexEmpty}
        hasSchemeWarning={hasSchemeWarning}
        onChange={handleChange}
      />

      {/* Query DSL & Pagination */}
      <SourceQuerySection
        query={query}
        scrollKeepalive={scrollKeepalive}
        batchSize={batchSize}
        pointInTimeSearch={pointInTimeSearch}
        onChange={handleChange}
      />

      {/* Authentication & Security */}
      <SourceAuthSection
        authMode={authMode}
        usernameSecret={usernameSecret}
        passwordSecret={passwordSecret}
        apiKeySecret={apiKeySecret}
        secrets={secrets}
        secretError={secretError}
        onChange={handleChange}
      />

      {/* Collapsible Advanced Source Settings */}
      <SourceAdvancedSection
        showAdvanced={showAdvanced}
        onToggle={() => setShowAdvanced(!showAdvanced)}
        connectTimeout={connectTimeout}
        socketTimeout={socketTimeout}
        trustSelfSignedCerts={trustSelfSignedCerts}
        keystorePath={keystorePath}
        keystorePasswordSecret={keystorePasswordSecret}
        secrets={secrets}
        onChange={handleChange}
      />

      {/* Code Generation Instructions Textarea */}
      <SystemInstructionsField
        id="es-source-instructions"
        value={systemInstructions}
        tooltip="Custom system instructions passed to the LLM when generating code for this Elasticsearch source transform."
        placeholder="e.g. ElasticsearchIO.read().withConnectionConfiguration(ConnectionConfiguration.create(new String[]{'http://localhost:9200'}, 'sensor_readings')).withQuery('...')"
        rows={4}
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
