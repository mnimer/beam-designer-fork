/**
 * DatabaseIOSinkProperties Component
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Renders the property configuration panel for generic DatabaseIO Sink nodes.
 * Configures database mutation for Apache Beam pipelines using the generic database access abstraction
 * (backed by Java JdbcIO.write() / JdbcIO.writeVoid() and Python/YAML apache_beam.io.jdbc.WriteToJdbc).
 *
 * Architectural Decisions:
 * - Scoping & Beam SDK Mapping: Investigated DatabaseIO in Apache Beam (see Beam YAML documentation
 *   https://beam.apache.org/documentation/sdks/yaml/ and Python apache_beam.io.jdbc.ReadFromJdbc/WriteToJdbc).
 *   Beam does not have a single org.apache.beam.sdk.io.database.DatabaseIO class; "DatabaseIO" represents the
 *   generic, driver-agnostic database access abstraction backed by Java JdbcIO and Python/YAML WriteToJdbc.
 * - Differentiation from dedicated JdbcIO: While JdbcIO assumes the user already knows low-level driver classes
 *   and connection URLs, DatabaseIO acts as a "pick-your-engine" node. It provides a primary Database Engine selector
 *   (PostgreSQL, MySQL, SQL Server, Oracle, Generic JDBC) that dynamically provisions recommended driver class names,
 *   port defaults, URL templates, and SSL conventions while preserving user manual overrides.
 * - Statement Mode Toggle: Supports 'auto' (generated INSERT into destination table) vs 'custom' (explicit prepared statement SQL).
 * - Real-time validation: Requires JDBC URL, driver class name, and destination table name.
 * - Delivery controls: Configures batchSize, autocommit toggle, and retry strategy.
 * - Authentication: Provides 'none' vs 'secret_manager' mode with username/password secrets resolved via 'getSecrets' IPC.
 * - Collapsible Advanced Sink Settings: connection properties, connection timeout, and SSL mode.
 * - Preserves system_instructions / special_instructions fallback chain for LLM code generation.
 * - Follows the 8pt grid system and Tailwind CSS styling using VS Code theme tokens.
 */

import React, { useState } from 'react';
import { InfoTooltip } from '../../components/InfoTooltip';
import { PropertyField } from '../../components/common/PropertyField';
import { SystemInstructionsField } from '../../components/common/SystemInstructionsField';
import { resolveSystemInstructions } from '../../utils/systemInstructions';
import { useAssetLoader } from '../../hooks/useAssetLoader';
import { normalizeSecretItem } from '../../components/common/SecretManagerAuthFields';
import { CollapsibleSection } from '../../components/common/CollapsibleSection';
import {
  DATABASE_ENGINES,
  SSL_MODES,
  type DatabaseEngine,
  type SecretItem
} from '../source/DatabaseIO';

/**
 * Props for the DatabaseIOSinkProperties component.
 */
export interface DatabaseIOSinkPropertiesProps {
  node: {
    data: {
      label?: string;
      beam_transform?: string;
      system_instructions?: string;
      special_instructions?: string;
      properties?: {
        engine?: DatabaseEngine;
        databaseEngine?: DatabaseEngine;
        url?: string;
        jdbcUrl?: string;
        driverClassName?: string;
        table?: string;
        tableName?: string;
        statementMode?: 'auto' | 'custom';
        statement?: string;
        customStatement?: string;
        batchSize?: number | string;
        autocommit?: boolean;
        maxRetries?: number | string;
        retryStrategy?: number | string;
        authMode?: 'none' | 'secret_manager';
        usernameSecret?: string;
        passwordSecret?: string;
        connectionProperties?: string;
        connectTimeout?: number | string;
        sslMode?: string;
        system_instructions?: string;
        special_instructions?: string;
        [key: string]: any;
      };
    };
  };
  onChange: (properties: any) => void;
}

/**
 * Presentational component for write statement mode selection and custom SQL statement.
 */
interface StatementModeSectionProps {
  statementMode: 'auto' | 'custom';
  statement: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}

const StatementModeSection: React.FC<StatementModeSectionProps> = ({ statementMode, statement, onChange }) => (
  <div className="flex flex-col gap-3 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
    <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
      <span>Write Statement Mode</span>
      <InfoTooltip text="Choose whether to automatically generate an INSERT statement based on the input schema, or supply a custom prepared statement." />
    </label>

    <div className="flex gap-4 mt-1">
      <label className="flex items-center gap-1.5 cursor-pointer text-xs text-[var(--vscode-text-secondary)]">
        <input
          type="radio"
          name="statementMode"
          value="auto"
          checked={statementMode === 'auto'}
          onChange={onChange}
          className="accent-[var(--vscode-highlight)]"
        />
        <span>Auto (Generated INSERT)</span>
      </label>
      <label className="flex items-center gap-1.5 cursor-pointer text-xs text-[var(--vscode-text-secondary)]">
        <input
          type="radio"
          name="statementMode"
          value="custom"
          checked={statementMode === 'custom'}
          onChange={onChange}
          className="accent-[var(--vscode-highlight)]"
        />
        <span>Custom Prepared Statement</span>
      </label>
    </div>

    {statementMode === 'custom' && (
      <div className="mt-2 pl-2 border-l-2 border-[var(--vscode-highlight)]/50">
        <PropertyField
          id="dbSinkStatement"
          name="statement"
          label="Prepared Statement SQL"
          type="textarea"
          rows={3}
          tooltip="Custom parameterized SQL statement (e.g. INSERT INTO table (c1, c2) VALUES (?, ?) ON CONFLICT DO NOTHING)."
          value={statement}
          onChange={onChange}
          placeholder="INSERT INTO customers (id, name, updated_at) VALUES (?, ?, ?)"
          mono={true}
        />
      </div>
    )}
  </div>
);

/**
 * Presentational component for collapsible advanced database sink settings.
 */
interface AdvancedSinkSectionProps {
  showAdvanced: boolean;
  onToggle: () => void;
  connectTimeout: number | string;
  sslMode: string;
  connectionProperties: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}

const AdvancedSinkSection: React.FC<AdvancedSinkSectionProps> = ({
  showAdvanced,
  onToggle,
  connectTimeout,
  sslMode,
  connectionProperties,
  onChange
}) => (
  <CollapsibleSection
    title="Advanced Sink Settings"
    isOpen={showAdvanced}
    onToggle={onToggle}
  >
    <div className="grid grid-cols-2 gap-2">
      <PropertyField
        id="dbSinkConnectTimeout"
        name="connectTimeout"
        label="Connect Timeout (s)"
        type="number"
        tooltip="Connection timeout in seconds."
        value={connectTimeout}
        onChange={onChange}
        placeholder="30"
        mono={true}
      />

      <div className="flex flex-col gap-1">
        <label
          htmlFor="dbSinkSslMode"
          className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]"
        >
          <span>SSL Mode</span>
          <InfoTooltip text="Database SSL connection negotiation strategy." />
        </label>
        <select
          id="dbSinkSslMode"
          name="sslMode"
          value={sslMode}
          onChange={onChange}
          className="bg-[var(--vscode-input-bg)] text-[var(--vscode-text-primary)] p-2 rounded border border-[var(--vscode-border)] text-xs focus:outline-none focus:border-[var(--vscode-highlight)] font-mono"
        >
          {SSL_MODES.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </div>
    </div>

    <PropertyField
      id="dbSinkConnectionProperties"
      name="connectionProperties"
      label="Extra Connection Properties"
      type="textarea"
      rows={3}
      tooltip="Custom JDBC connection properties as key=value pairs per line."
      value={connectionProperties}
      onChange={onChange}
      placeholder="ssl=true&#10;tcpKeepAlive=true"
      mono={true}
    />
  </CollapsibleSection>
);

/**
 * DatabaseIOSinkProperties renders the configuration form for generic database mutation.
 *
 * @param props - Component props containing the active node data and onChange dispatch callback.
 */
export const DatabaseIOSinkProperties: React.FC<DatabaseIOSinkPropertiesProps> = ({ node, onChange }) => {
  const properties = node.data.properties || {};

  // Form field state extracted from node properties
  const engine = (properties.engine || properties.databaseEngine || 'postgresql') as DatabaseEngine;
  const url = properties.url ?? properties.jdbcUrl ?? '';
  const driverClassName = properties.driverClassName ?? (DATABASE_ENGINES[engine]?.defaultDriver || '');
  const table = properties.table ?? properties.tableName ?? '';
  const statementMode = properties.statementMode ?? 'auto';
  const statement = properties.statement ?? properties.customStatement ?? '';
  const batchSize = properties.batchSize ?? '1000';
  const autocommit = properties.autocommit ?? false;
  const maxRetries = properties.maxRetries ?? properties.retryStrategy ?? '';
  const authMode = properties.authMode ?? 'none';
  const usernameSecret = properties.usernameSecret ?? '';
  const passwordSecret = properties.passwordSecret ?? '';
  const connectionProperties = properties.connectionProperties ?? '';
  const connectTimeout = properties.connectTimeout ?? '';
  const sslMode = properties.sslMode ?? 'disable';

  // Local UI state
  const { items: rawSecrets, error: secretError } = useAssetLoader<SecretItem | string>('secrets');
  const secrets: SecretItem[] = (rawSecrets || []).map(normalizeSecretItem);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Field validation
  const isUrlEmpty = !String(url).trim();
  const isDriverEmpty = !String(driverClassName).trim();
  const isTableEmpty = !String(table).trim();

  // NOTE: Fallback chain for system instructions per architecture spec
  const systemInstructions = resolveSystemInstructions(node);

  /**
   * Updates a single property key and invokes onChange while pruning legacy alias keys.
   *
   * @param name - The property field name to update.
   * @param value - The new value for the property.
   */
  const updateProperty = (name: string, value: any) => {
    // NOTE: Controlled update pruning legacy alias keys to maintain single source of truth
    const updated = { ...properties, [name]: value };
    if (name === 'url') {
      delete updated.jdbcUrl;
    } else if (name === 'table') {
      delete updated.tableName;
    } else if (name === 'engine') {
      delete updated.databaseEngine;
    } else if (name === 'statement') {
      delete updated.customStatement;
    } else if (name === 'maxRetries') {
      delete updated.retryStrategy;
    }
    onChange(updated);
  };

  /**
   * Handles database engine change and populates suggested driver and URL template.
   *
   * @param e - Change event from engine select.
   */
  const handleEngineChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newEngine = e.target.value as DatabaseEngine;
    const preset = DATABASE_ENGINES[newEngine] || DATABASE_ENGINES.generic;

    const currentPreset = DATABASE_ENGINES[engine];
    const shouldUpdateDriver =
      !driverClassName || (currentPreset && driverClassName === currentPreset.defaultDriver);
    const shouldUpdateUrl = !url || (currentPreset && url === currentPreset.urlTemplate);

    const updated = {
      ...properties,
      engine: newEngine,
      ...(shouldUpdateDriver && preset.defaultDriver ? { driverClassName: preset.defaultDriver } : {}),
      ...(shouldUpdateUrl && preset.urlTemplate ? { url: preset.urlTemplate } : {})
    };
    delete updated.databaseEngine;
    onChange(updated);
  };

  /**
   * Handles text, number, and checkbox changes.
   *
   * @param e - React change event.
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


  return (
    <div className="flex-1 flex flex-col gap-4 text-[var(--vscode-text-primary)] text-sm">
      {/* Database Engine Selector */}
      <div className="flex flex-col gap-2 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
        <label
          htmlFor="dbSinkEngine"
          className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]"
        >
          <span>Database Engine</span>
          <InfoTooltip text="Select the target database engine to automatically configure driver defaults and URL templates." />
        </label>
        <select
          id="dbSinkEngine"
          name="engine"
          value={engine}
          onChange={handleEngineChange}
          className="bg-[var(--vscode-input-bg)] text-[var(--vscode-text-primary)] p-2 rounded border border-[var(--vscode-border)] text-xs focus:outline-none focus:border-[var(--vscode-highlight)]"
        >
          {Object.entries(DATABASE_ENGINES).map(([key, item]) => (
            <option key={key} value={key}>
              {item.label}
            </option>
          ))}
        </select>
      </div>

      {/* Target Destination: URL, Driver, and Table */}
      <div className="flex flex-col gap-3 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
        <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          <span>Target Destination</span>
          <InfoTooltip text="Connection and destination table details for writing records." />
        </label>

        <PropertyField
          id="dbSinkUrl"
          name="url"
          label="JDBC URL"
          required="JDBC URL is required"
          tooltip="Standard JDBC connection URL for your database engine."
          value={url}
          invalid={isUrlEmpty}
          error={isUrlEmpty ? 'JDBC URL is required' : null}
          placeholder={DATABASE_ENGINES[engine]?.urlTemplate || 'jdbc:<subprotocol>://<host>:<port>/<db>'}
          onChange={handleChange}
          mono={true}
        />

        <PropertyField
          id="dbSinkDriverClassName"
          name="driverClassName"
          label="Driver Class Name"
          required="Driver class name is required"
          tooltip="Fully-qualified class name of the JDBC driver."
          value={driverClassName}
          invalid={isDriverEmpty}
          error={isDriverEmpty ? 'Driver class name is required' : null}
          placeholder="org.postgresql.Driver"
          onChange={handleChange}
          mono={true}
        />

        <PropertyField
          id="dbSinkTable"
          name="table"
          label="Destination Table"
          required="Destination table is required"
          tooltip="Target database table to insert records into."
          value={table}
          invalid={isTableEmpty}
          error={isTableEmpty ? 'Destination table is required' : null}
          placeholder="e.g. customers"
          onChange={handleChange}
          mono={true}
        />
      </div>

      {/* Statement Mode Section */}
      <StatementModeSection
        statementMode={statementMode}
        statement={statement}
        onChange={handleChange}
      />

      {/* Throughput & Commit Controls */}
      <div className="flex flex-col gap-3 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
        <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          <span>Batching &amp; Reliability</span>
          <InfoTooltip text="Tuning insertion batch size, transaction autocommit, and retry strategy." />
        </label>

        <div className="grid grid-cols-2 gap-2">
          <PropertyField
            id="dbSinkBatchSize"
            name="batchSize"
            label="Batch Size"
            type="number"
            tooltip="Number of rows per batch insertion transaction."
            value={batchSize}
            onChange={handleChange}
            placeholder="1000"
            mono={true}
          />
          <PropertyField
            id="dbSinkMaxRetries"
            name="maxRetries"
            label="Max Retries"
            type="number"
            tooltip="Maximum retry attempts on transient database insertion failure."
            value={maxRetries}
            onChange={handleChange}
            placeholder="3"
            mono={true}
          />
        </div>

        <div className="flex items-center gap-2 p-2 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
          <input
            id="dbSinkAutocommit"
            type="checkbox"
            name="autocommit"
            checked={autocommit}
            onChange={handleChange}
            className="rounded border-[var(--vscode-border)] text-[var(--vscode-highlight)] accent-[var(--vscode-highlight)] focus:ring-0 cursor-pointer"
          />
          <label
            htmlFor="dbSinkAutocommit"
            className="flex items-center gap-1.5 text-xs text-[var(--vscode-text-secondary)] cursor-pointer"
          >
            <span>Enable Autocommit</span>
            <InfoTooltip text="Configures autocommit mode for the JDBC write connection." />
          </label>
        </div>
      </div>

      {/* Authentication */}
      <div className="flex flex-col gap-2 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
        <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          <span>Authentication</span>
          <InfoTooltip text="Select authentication strategy: None or Google Cloud Secret Manager." />
        </label>
        <div className="flex gap-4 mt-1">
          <label className="flex items-center gap-1.5 cursor-pointer text-xs text-[var(--vscode-text-secondary)]">
            <input
              type="radio"
              name="authMode"
              value="none"
              checked={authMode === 'none'}
              onChange={handleChange}
              className="accent-[var(--vscode-highlight)]"
            />
            <span>None</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer text-xs text-[var(--vscode-text-secondary)]">
            <input
              type="radio"
              name="authMode"
              value="secret_manager"
              checked={authMode === 'secret_manager'}
              onChange={handleChange}
              className="accent-[var(--vscode-highlight)]"
            />
            <span>Secret Manager</span>
          </label>
        </div>

        {authMode === 'secret_manager' && (
          <div className="flex flex-col gap-3 mt-2 pl-2 border-l-2 border-[var(--vscode-highlight)]/50">
            {secretError && (
              <span className="text-xs text-[var(--vscode-errorForeground)]" role="alert">
                Failed to load secrets: {secretError}
              </span>
            )}
            <PropertyField
              id="dbSinkUsernameSecret"
              name="usernameSecret"
              label="Username Secret"
              tooltip="GCP Secret Manager secret containing database username."
              value={usernameSecret}
              onChange={handleChange}
              list="databaseio-sink-secret-options"
              datalist={secrets.map((s) => ({ value: s.id || s.name, label: s.name || s.id }))}
              placeholder="e.g. db-username"
              mono={true}
            />
            <PropertyField
              id="dbSinkPasswordSecret"
              name="passwordSecret"
              label="Password Secret"
              tooltip="GCP Secret Manager secret containing database password."
              value={passwordSecret}
              onChange={handleChange}
              list="databaseio-sink-secret-options"
              datalist={secrets.map((s) => ({ value: s.id || s.name, label: s.name || s.id }))}
              placeholder="e.g. db-password"
              mono={true}
            />
          </div>
        )}
      </div>

      {/* Advanced Sink Settings */}
      <AdvancedSinkSection
        showAdvanced={showAdvanced}
        onToggle={() => setShowAdvanced(!showAdvanced)}
        connectTimeout={connectTimeout}
        sslMode={sslMode}
        connectionProperties={connectionProperties}
        onChange={handleChange}
      />

      <SystemInstructionsField
        id="dbSinkInstructions"
        value={systemInstructions}
        tooltip="Optional instructions passed to LLM code generator when synthesizing database mutation pipelines."
        placeholder="e.g. Write elements using JdbcIO.write() with StatementPreparer or Python WriteToJdbc"
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
