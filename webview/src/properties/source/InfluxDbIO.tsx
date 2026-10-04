/**
 * InfluxDbIOSourceProperties Component
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Renders the property configuration panel for Apache Beam InfluxDbIO Source nodes.
 * Maps to Java SDK `org.apache.beam.sdk.io.influxdb.InfluxDbIO.read()`.
 *
 * Architectural Decisions:
 * // NOTE: Apache Beam InfluxDbIO targets InfluxDB 1.x line (database + retention policy +
 * // DataSourceConfiguration.create(url, username, password)), NOT the InfluxDB 2.x
 * // organization/bucket/token model. We adhere strictly to InfluxDB 1.x Beam SDK semantics.
 * - Supports Python via cross-language (x-lang) external expansion service.
 * - Controlled input architecture with props in / events up pattern.
 * - Validates required Server URL, Database name, and active Query/Metric branch.
 * - URL scheme format validation providing a warning if not starting with http:// or https://.
 * - Dynamic discovery: Requests GCP Secret Manager secrets from the extension host via `getSecrets` IPC.
 * - Unique datalist id `influxdb-source-secret-options` to prevent collision with other connector panels.
 * - Collapsible Advanced Source Settings decomposed into local presentational component with semantic toggle event callback.
 * - Single error display on usernameSecret field to avoid duplicate error alert rendering.
 * - Preserves system_instructions / special_instructions for LLM code generation.
 * - Strictly adheres to 8pt grid system (p-2, p-3, gap-2, gap-3, gap-4) and Tailwind CSS with VS Code tokens.
 */

import React, { useState } from 'react';
import { InfoTooltip } from '../../components/InfoTooltip';
import { PropertyField } from '../../components/common/PropertyField';
import { SystemInstructionsField } from '../../components/common/SystemInstructionsField';
import { CollapsibleSection } from '../../components/common/CollapsibleSection';
import { resolveSystemInstructions } from '../../utils/systemInstructions';
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
 * Props for the InfluxDbSourceAuthSection sub-component.
 */
interface InfluxDbSourceAuthSectionProps {
  authMode: 'none' | 'secret_manager';
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
const InfluxDbSourceAuthSection: React.FC<InfluxDbSourceAuthSectionProps> = ({
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
        <InfoTooltip text="Choose whether to connect anonymously or provide credentials via GCP Secret Manager." />
      </label>
      <div className="flex flex-col gap-2 mt-1">
        <label className="flex items-center gap-2 cursor-pointer text-xs text-[var(--vscode-text-secondary)]">
          <input
            type="radio"
            name="authMode"
            value="none"
            checked={authMode === 'none'}
            onChange={onChange}
            className="accent-[var(--vscode-highlight)] text-[var(--vscode-highlight)]"
          />
          <span>None (Anonymous / Public)</span>
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
            id="influxSourceUsernameSecret"
            name="usernameSecret"
            label="Username Secret"
            value={usernameSecret}
            onChange={onChange}
            list="influxdb-source-secret-options"
            datalist={secrets.map((s) => ({ value: s.id || s.name, label: s.name || s.id }))}
            placeholder="e.g. influxdb-username"
            tooltip="GCP Secret Manager secret containing the InfluxDB username."
            error={secretError}
            invalid={!!secretError}
            mono={true}
          />
          <PropertyField
            id="influxSourcePasswordSecret"
            name="passwordSecret"
            label="Password Secret"
            value={passwordSecret}
            onChange={onChange}
            list="influxdb-source-secret-options"
            datalist={secrets.map((s) => ({ value: s.id || s.name, label: s.name || s.id }))}
            placeholder="e.g. influxdb-password"
            tooltip="GCP Secret Manager secret containing the InfluxDB password."
            invalid={!!secretError}
            mono={true}
          />
        </div>
      )}
    </div>
  );
};

/**
 * Props for the InfluxDbSourceAdvancedSection sub-component.
 */
interface InfluxDbSourceAdvancedSectionProps {
  showAdvanced: boolean;
  /** Emitted when the user toggles the advanced drawer. */
  onToggleAdvanced: () => void;
  sslInvalidHostNameAllowed: boolean;
  disableCertificateValidation: boolean;
  connectTimeout: number | string;
  readTimeout: number | string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}

/**
 * Presentational component for collapsible Advanced Source Settings.
 *
 * @param props Sub-component properties
 */
const InfluxDbSourceAdvancedSection: React.FC<InfluxDbSourceAdvancedSectionProps> = ({
  showAdvanced,
  onToggleAdvanced,
  sslInvalidHostNameAllowed,
  disableCertificateValidation,
  connectTimeout,
  readTimeout,
  onChange
}) => {
  return (
    <CollapsibleSection
      title="Advanced Source Settings"
      isOpen={showAdvanced}
      onToggle={onToggleAdvanced}
    >
      {/* SSL Certificate & Hostname Toggles */}
      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-2 cursor-pointer text-xs text-[var(--vscode-text-secondary)]">
          <input
            id="influxSourceSslInvalidHostNameAllowed"
            type="checkbox"
            name="sslInvalidHostNameAllowed"
            checked={sslInvalidHostNameAllowed}
            onChange={onChange}
            className="rounded border-[var(--vscode-border)] text-[var(--vscode-highlight)] accent-[var(--vscode-highlight)]"
          />
          <span>Allow Invalid Hostname</span>
          <InfoTooltip text="Allows SSL/TLS connections even when hostname does not match the certificate." />
        </label>
        <label className="flex items-center gap-2 cursor-pointer text-xs text-[var(--vscode-text-secondary)]">
          <input
            id="influxSourceDisableCertificateValidation"
            type="checkbox"
            name="disableCertificateValidation"
            checked={disableCertificateValidation}
            onChange={onChange}
            className="rounded border-[var(--vscode-border)] text-[var(--vscode-highlight)] accent-[var(--vscode-highlight)]"
          />
          <span>Disable Certificate Validation</span>
          <InfoTooltip text="Bypasses SSL certificate verification for self-signed development environments (Java: withDisableCertificateValidation)." />
        </label>
      </div>

      {/* Timeouts */}
      <div className="grid grid-cols-2 gap-2">
        <PropertyField
          id="influxSourceConnectTimeout"
          name="connectTimeout"
          label="Connect Timeout (ms)"
          type="number"
          value={connectTimeout}
          onChange={onChange}
          placeholder="10000"
          min={0}
          tooltip="HTTP connection establishment timeout in milliseconds."
        />
        <PropertyField
          id="influxSourceReadTimeout"
          name="readTimeout"
          label="Read Timeout (ms)"
          type="number"
          value={readTimeout}
          onChange={onChange}
          placeholder="30000"
          min={0}
          tooltip="HTTP socket read timeout in milliseconds for large InfluxDB query responses."
        />
      </div>
    </CollapsibleSection>
  );
};

/**
 * Component props interface for InfluxDbIOSourceProperties.
 */
export interface InfluxDbIOSourcePropertiesProps {
  node: {
    data: {
      label?: string;
      beam_transform?: string;
      system_instructions?: string;
      special_instructions?: string;
      properties?: {
        url?: string;
        database?: string;
        retentionPolicy?: string;
        queryMode?: 'query' | 'metric' | string;
        query?: string;
        metric?: string;
        numOfElementsToFetchPerQuery?: number | string;
        authMode?: 'none' | 'secret_manager' | string;
        usernameSecret?: string;
        passwordSecret?: string;
        sslInvalidHostNameAllowed?: boolean;
        disableCertificateValidation?: boolean;
        connectTimeout?: number | string;
        readTimeout?: number | string;
        system_instructions?: string;
        special_instructions?: string;
        [key: string]: any;
      };
    };
  };
  onChange: (properties: any) => void;
}

/**
 * InfluxDbIOSourceProperties renders the configuration panel for reading from InfluxDB.
 *
 * @param props Component properties containing the active node and onChange callback
 */
export const InfluxDbIOSourceProperties: React.FC<InfluxDbIOSourcePropertiesProps> = ({
  node,
  onChange
}) => {
  const properties = node.data.properties || {};

  // Form field state extracted from node properties
  const url = properties.url || '';
  const database = properties.database || '';
  const retentionPolicy = properties.retentionPolicy || '';
  const queryMode = properties.queryMode || 'query';
  const query = properties.query || '';
  const metric = properties.metric || '';
  const numOfElementsToFetchPerQuery = properties.numOfElementsToFetchPerQuery ?? '';
  const authMode: 'none' | 'secret_manager' = (properties.authMode as 'none' | 'secret_manager') || 'none';
  const usernameSecret = properties.usernameSecret || '';
  const passwordSecret = properties.passwordSecret || '';
  const sslInvalidHostNameAllowed = properties.sslInvalidHostNameAllowed ?? false;
  const disableCertificateValidation = properties.disableCertificateValidation ?? false;
  const connectTimeout = properties.connectTimeout ?? '';
  const readTimeout = properties.readTimeout ?? '';

  // Local state for dynamically loaded secrets and accordion toggle
  const { items: rawSecrets, error: secretError } = useAssetLoader<SecretItem | string>('secrets');
  const secrets: SecretItem[] = (rawSecrets || []).map(normalizeSecretItem);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Field validation
  const isUrlEmpty = !url.trim();
  const isUrlInvalid = url.trim().length > 0 && !url.trim().startsWith('http://') && !url.trim().startsWith('https://');
  const isDatabaseEmpty = !database.trim();
  const isQueryEmpty = queryMode === 'query' && !query.trim();
  const isMetricEmpty = queryMode === 'metric' && !metric.trim();

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

  /**
   * Handles system instructions textarea modification.
   *
   * @param e React textarea change event
   */
  return (
    <div className="flex-1 flex flex-col gap-4 text-[var(--vscode-text-primary)] text-sm">
      {/* InfluxDB Server URL Input */}
      <PropertyField
        id="influxSourceUrl"
        name="url"
        label="Server URL"
        required="Server URL is required"
        tooltip="InfluxDB server endpoint URL (e.g. http://localhost:8086). Used by DataSourceConfiguration.create(url, username, password)."
        value={url}
        invalid={isUrlEmpty}
        error={isUrlEmpty ? 'Server URL is required' : null}
        helperText={
          !isUrlEmpty && isUrlInvalid ? (
            <span className="text-amber-400" role="alert">
              Warning: InfluxDB URL should start with &quot;http://&quot; or &quot;https://&quot;
            </span>
          ) : null
        }
        placeholder="http://localhost:8086"
        onChange={handleChange}
        mono={true}
      />

      {/* Database & Retention Policy */}
      <div className="grid grid-cols-2 gap-2">
        <PropertyField
          id="influxSourceDatabase"
          name="database"
          label="Database Name"
          required="Database name is required"
          tooltip="InfluxDB database name to query (Java: withDatabase)."
          value={database}
          invalid={isDatabaseEmpty}
          error={isDatabaseEmpty ? 'Database name is required' : null}
          placeholder="e.g. metrics"
          onChange={handleChange}
          mono={true}
        />
        <PropertyField
          id="influxSourceRetentionPolicy"
          name="retentionPolicy"
          label="Retention Policy"
          tooltip="Optional InfluxDB retention policy name (Java: withRetentionPolicy). If omitted, default policy is used."
          value={retentionPolicy}
          placeholder="e.g. autogen"
          onChange={handleChange}
          mono={true}
        />
      </div>

      {/* Query Mode Selection (Query vs Metric) */}
      <div className="flex flex-col gap-2 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
        <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          <span>Query Mode</span>
          <InfoTooltip text="Choose whether to execute a custom InfluxQL query or read all records for a measurement/metric." />
        </label>
        <div className="flex gap-4 mt-1">
          <label className="flex items-center gap-2 cursor-pointer text-xs text-[var(--vscode-text-secondary)]">
            <input
              type="radio"
              name="queryMode"
              value="query"
              checked={queryMode === 'query'}
              onChange={handleChange}
              className="accent-[var(--vscode-highlight)] text-[var(--vscode-highlight)]"
            />
            <span>InfluxQL Query</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-xs text-[var(--vscode-text-secondary)]">
            <input
              type="radio"
              name="queryMode"
              value="metric"
              checked={queryMode === 'metric'}
              onChange={handleChange}
              className="accent-[var(--vscode-highlight)] text-[var(--vscode-highlight)]"
            />
            <span>Measurement Metric</span>
          </label>
        </div>

        {queryMode === 'query' ? (
          <div className="mt-2 pl-2 border-l-2 border-[var(--vscode-highlight)]/50">
            <PropertyField
              id="influxSourceQuery"
              name="query"
              label="InfluxQL Query"
              required="InfluxQL query is required when query mode is selected"
              tooltip="InfluxQL query string to execute (Java: withQuery). E.g. SELECT * FROM cpu_usage WHERE time > now() - 1h."
              type="textarea"
              rows={3}
              value={query}
              invalid={isQueryEmpty}
              error={isQueryEmpty ? 'InfluxQL query is required when query mode is selected' : null}
              placeholder="SELECT * FROM cpu_usage"
              onChange={handleChange}
              mono={true}
            />
          </div>
        ) : (
          <div className="mt-2 pl-2 border-l-2 border-[var(--vscode-highlight)]/50">
            <PropertyField
              id="influxSourceMetric"
              name="metric"
              label="Measurement / Metric Name"
              required="Measurement metric name is required when metric mode is selected"
              tooltip="Target measurement name to read from (Java: withMetric)."
              value={metric}
              invalid={isMetricEmpty}
              error={isMetricEmpty ? 'Measurement metric name is required when metric mode is selected' : null}
              placeholder="e.g. cpu_usage"
              onChange={handleChange}
              mono={true}
            />
          </div>
        )}
      </div>

      {/* Fetch Batching / Chunk Size */}
      <PropertyField
        id="influxSourceNumOfElementsToFetchPerQuery"
        name="numOfElementsToFetchPerQuery"
        label="Fetch Batch Size"
        type="number"
        value={numOfElementsToFetchPerQuery}
        onChange={handleChange}
        placeholder="e.g. 1000"
        min={1}
        tooltip="Number of elements to fetch per query chunk when streaming results (query chunk size hint)."
      />

      {/* Authentication Configuration Sub-section */}
      <InfluxDbSourceAuthSection
        authMode={authMode}
        usernameSecret={usernameSecret}
        passwordSecret={passwordSecret}
        secrets={secrets}
        secretError={secretError}
        onChange={handleChange}
      />

      {/* Collapsible Advanced Source Settings Sub-section */}
      <InfluxDbSourceAdvancedSection
        showAdvanced={showAdvanced}
        onToggleAdvanced={() => setShowAdvanced(!showAdvanced)}
        sslInvalidHostNameAllowed={sslInvalidHostNameAllowed}
        disableCertificateValidation={disableCertificateValidation}
        connectTimeout={connectTimeout}
        readTimeout={readTimeout}
        onChange={handleChange}
      />

      {/* Code Generation Instructions */}
      <SystemInstructionsField
        id="influxSourceInstructions"
        value={systemInstructions}
        tooltip="Custom instructions passed to the LLM code generator when synthesizing Beam pipeline code for Java (InfluxDbIO.read()) or cross-language Python."
        placeholder="e.g. Ingest time-series data from InfluxDB, apply sliding window, and compute average load"
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
