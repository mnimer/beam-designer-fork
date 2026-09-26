/**
 * InfluxDbIOSinkProperties Component
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Renders the property configuration panel for Apache Beam InfluxDbIO Write Sink nodes.
 * Maps to Java SDK `org.apache.beam.sdk.io.influxdb.InfluxDbIO.write()`.
 *
 * Architectural Decisions:
 * // NOTE: Apache Beam InfluxDbIO targets InfluxDB 1.x line (database + retention policy +
 * // DataSourceConfiguration.create(url, username, password)), NOT the InfluxDB 2.x
 * // organization/bucket/token model. We adhere strictly to InfluxDB 1.x Beam SDK semantics.
 * // NOTE: InfluxDbIO.write() consumes a PCollection<String> where each element is formatted
 * // according to the InfluxDB line-protocol specification.
 * - Supports Python via cross-language (x-lang) external expansion service.
 * - Controlled input architecture with props in / events up pattern.
 * - Validates required Server URL and Database name.
 * - URL scheme format validation providing a warning if not starting with http:// or https://.
 * - Write consistency level select mapping to InfluxDB ConsistencyLevel (ALL, ANY, ONE, QUORUM).
 * - Batch size configuration mapping to `withBatchSize`.
 * - Dynamic discovery: Requests GCP Secret Manager secrets from extension host via `getSecrets` IPC.
 * - Unique datalist id `influxdb-sink-secret-options` to prevent collision across panels.
 * - Collapsible Advanced Sink Settings decomposed into local presentational component with semantic toggle callback.
 * - Single error display on usernameSecret field to avoid duplicate alerts.
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
 * Props for the InfluxDbSinkAuthSection sub-component.
 */
interface InfluxDbSinkAuthSectionProps {
  authMode: 'none' | 'secret_manager';
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
const InfluxDbSinkAuthSection: React.FC<InfluxDbSinkAuthSectionProps> = ({
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
            id="influxSinkUsernameSecret"
            name="usernameSecret"
            label="Username Secret"
            value={usernameSecret}
            onChange={onChange}
            list="influxdb-sink-secret-options"
            datalist={secrets.map((s) => ({ value: s.id || s.name, label: s.name || s.id }))}
            placeholder="e.g. influxdb-username"
            tooltip="GCP Secret Manager secret containing the InfluxDB username."
            error={secretError}
            invalid={!!secretError}
            mono={true}
          />
          <PropertyField
            id="influxSinkPasswordSecret"
            name="passwordSecret"
            label="Password Secret"
            value={passwordSecret}
            onChange={onChange}
            list="influxdb-sink-secret-options"
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
 * Props for the InfluxDbSinkAdvancedSection sub-component.
 */
interface InfluxDbSinkAdvancedSectionProps {
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
 * Presentational component for collapsible Advanced Sink Settings.
 *
 * @param props Sub-component properties
 */
const InfluxDbSinkAdvancedSection: React.FC<InfluxDbSinkAdvancedSectionProps> = ({
  showAdvanced,
  onToggleAdvanced,
  sslInvalidHostNameAllowed,
  disableCertificateValidation,
  connectTimeout,
  readTimeout,
  onChange
}) => {
  return (
    <div className="flex flex-col border border-[var(--vscode-border-light)] rounded-md overflow-hidden">
      <button
        type="button"
        onClick={onToggleAdvanced}
        className="flex items-center justify-between p-2 bg-[var(--vscode-subcard-bg)] text-xs font-bold uppercase text-[var(--vscode-text-muted)] hover:text-[var(--vscode-text-primary)] transition-colors cursor-pointer"
      >
        <span>Advanced Sink Settings</span>
        <span>{showAdvanced ? '▲' : '▼'}</span>
      </button>

      {showAdvanced && (
        <div className="p-3 bg-[var(--vscode-workbench-bg)] flex flex-col gap-3 border-t border-[var(--vscode-border-light)]">
          {/* SSL Certificate & Hostname Toggles */}
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-[var(--vscode-text-secondary)]">
              <input
                id="influxSinkSslInvalidHostNameAllowed"
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
                id="influxSinkDisableCertificateValidation"
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
              id="influxSinkConnectTimeout"
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
              id="influxSinkReadTimeout"
              name="readTimeout"
              label="Read Timeout (ms)"
              type="number"
              value={readTimeout}
              onChange={onChange}
              placeholder="30000"
              min={0}
              tooltip="HTTP socket write/response timeout in milliseconds."
            />
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Component props interface for InfluxDbIOSinkProperties.
 */
export interface InfluxDbIOSinkPropertiesProps {
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
        consistencyLevel?: 'ALL' | 'ANY' | 'ONE' | 'QUORUM' | string;
        batchSize?: number | string;
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
 * InfluxDbIOSinkProperties renders the configuration panel for writing to InfluxDB.
 *
 * @param props Component properties containing the active node and onChange callback
 */
export const InfluxDbIOSinkProperties: React.FC<InfluxDbIOSinkPropertiesProps> = ({
  node,
  onChange
}) => {
  const properties = node.data.properties || {};

  // Form field state extracted from node properties
  const url = properties.url || '';
  const database = properties.database || '';
  const retentionPolicy = properties.retentionPolicy || '';
  const consistencyLevel = properties.consistencyLevel || 'ONE';
  const batchSize = properties.batchSize ?? '';
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
      {/* InfluxDB Server URL Input */}
      <PropertyField
        id="influxSinkUrl"
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
          id="influxSinkDatabase"
          name="database"
          label="Database Name"
          required="Database name is required"
          tooltip="Destination InfluxDB database name (Java: withDatabase)."
          value={database}
          invalid={isDatabaseEmpty}
          error={isDatabaseEmpty ? 'Database name is required' : null}
          placeholder="e.g. metrics"
          onChange={handleChange}
          mono={true}
        />
        <PropertyField
          id="influxSinkRetentionPolicy"
          name="retentionPolicy"
          label="Retention Policy"
          tooltip="Optional InfluxDB retention policy name (Java: withRetentionPolicy). If omitted, default policy is used."
          value={retentionPolicy}
          placeholder="e.g. autogen"
          onChange={handleChange}
          mono={true}
        />
      </div>

      {/* Batching & Write Consistency */}
      <div className="flex flex-col gap-3 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
        <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          <span>Delivery &amp; Consistency</span>
          <InfoTooltip text="Configure batch write size and replica write consistency level." />
        </label>

        <PropertyField
          id="influxSinkBatchSize"
          name="batchSize"
          label="Batch Size"
          type="number"
          value={batchSize}
          onChange={handleChange}
          placeholder="1000"
          min={1}
          tooltip="Number of line protocol records batched into a single HTTP write request (Java: withBatchSize)."
        />

        <div className="flex flex-col gap-1">
          <label
            htmlFor="influxSinkConsistencyLevel"
            className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]"
          >
            <span>Write Consistency Level</span>
            <InfoTooltip text="Consistency level required before considering a write successful in InfluxDB cluster (Java: withConsistencyLevel)." />
          </label>
          <select
            id="influxSinkConsistencyLevel"
            name="consistencyLevel"
            value={consistencyLevel}
            onChange={handleChange}
            className="bg-[var(--vscode-input-bg)] text-[var(--vscode-text-primary)] p-2 rounded border border-[var(--vscode-border)] text-xs focus:outline-none focus:border-[var(--vscode-highlight)]"
          >
            <option value="ONE">ONE (At least one node)</option>
            <option value="QUORUM">QUORUM (Majority of nodes)</option>
            <option value="ALL">ALL (All nodes)</option>
            <option value="ANY">ANY (Any node, including hinted handoff)</option>
          </select>
        </div>
      </div>

      {/* Authentication Configuration Sub-section */}
      <InfluxDbSinkAuthSection
        authMode={authMode}
        usernameSecret={usernameSecret}
        passwordSecret={passwordSecret}
        secrets={secrets}
        secretError={secretError}
        onChange={handleChange}
      />

      {/* Collapsible Advanced Sink Settings Sub-section */}
      <InfluxDbSinkAdvancedSection
        showAdvanced={showAdvanced}
        onToggleAdvanced={() => setShowAdvanced(!showAdvanced)}
        sslInvalidHostNameAllowed={sslInvalidHostNameAllowed}
        disableCertificateValidation={disableCertificateValidation}
        connectTimeout={connectTimeout}
        readTimeout={readTimeout}
        onChange={handleChange}
      />

      {/* Flexible Spacer */}
      <div className="flex-1 min-h-[16px]" />

      {/* Code Generation Instructions */}
      <PropertyField
        id="influxSinkInstructions"
        name="system_instructions"
        label="Code Generation Instructions"
        tooltip="Custom instructions passed to the LLM code generator when synthesizing Beam pipeline code for Java (InfluxDbIO.write()) or cross-language Python."
        type="textarea"
        rows={3}
        value={systemInstructions}
        onChange={handleInstructionsChange}
        placeholder="e.g. Format input elements as InfluxDB line-protocol strings (measurement,tags fields timestamp) and write to InfluxDB"
        mono={true}
      />
    </div>
  );
};
