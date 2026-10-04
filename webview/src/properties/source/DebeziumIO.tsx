/**
 * DebeziumIOSourceProperties Component
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Renders the property configuration panel for Apache Beam DebeziumIO Source nodes.
 * Maps to Java SDK `org.apache.beam.io.debezium.DebeziumIO.read()` and `readAsJson()`.
 *
 * Architectural Decisions:
 * // NOTE: DebeziumIO is a read-only Change Data Capture (CDC) connector in Apache Beam.
 * // There is no DebeziumIO.write(). Beam consumes database change events and converts
 * // them to either JSON strings (readAsJson) or mapped objects (read with formatFunction).
 * - Python SDK uses cross-language expansion service via `apache_beam.io.debezium.ReadFromDebezium`.
 * - Controlled input architecture with props in / events up pattern.
 * - Validates required Hostname, Database Name, and format-specific requirements.
 * - Selecting a connector class (MySQL, PostgreSQL, SQL Server, Oracle, DB2) automatically provisions the default port.
 * - Datalist id `debezium-source-secret-options` fed by `getSecrets` IPC.
 * - Single error display on usernameSecret field to avoid duplicate alert rendering.
 * - Collapsible Advanced Source Settings decomposed into local presentational component with semantic toggle event callback.
 * - Preserves system_instructions / special_instructions for LLM code generation.
 * - Strictly adheres to 8pt grid system (p-2, p-3, gap-2, gap-3, gap-4) and Tailwind CSS with VS Code tokens.
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

/**
 * Debezium connector preset definition.
 */
export interface DebeziumConnectorPreset {
  value: string;
  label: string;
  defaultPort: number;
}

const CONNECTOR_CLASSES: DebeziumConnectorPreset[] = [
  { value: 'io.debezium.connector.mysql.MySqlConnector', label: 'MySQL (MySqlConnector)', defaultPort: 3306 },
  { value: 'io.debezium.connector.postgresql.PostgresConnector', label: 'PostgreSQL (PostgresConnector)', defaultPort: 5432 },
  { value: 'io.debezium.connector.sqlserver.SqlServerConnector', label: 'SQL Server (SqlServerConnector)', defaultPort: 1433 },
  { value: 'io.debezium.connector.oracle.OracleConnector', label: 'Oracle (OracleConnector)', defaultPort: 1521 },
  { value: 'io.debezium.connector.db2.Db2Connector', label: 'IBM DB2 (Db2Connector)', defaultPort: 50000 },
];

/**
 * Props for the DebeziumSourceAuthSection sub-component.
 */
interface DebeziumSourceAuthSectionProps {
  authMode: 'none' | 'secret_manager';
  usernameSecret: string;
  passwordSecret: string;
  secretOptions: { value: string; label: string }[];
  secretError: string | null;
  secretsLoading?: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}

/**
 * Presentational component for source authentication configuration.
 *
 * @param props Sub-component properties
 */
const DebeziumSourceAuthSection: React.FC<DebeziumSourceAuthSectionProps> = ({
  authMode,
  usernameSecret,
  passwordSecret,
  secretOptions,
  secretError,
  secretsLoading,
  onChange
}) => {
  return (
    <div className="flex flex-col gap-2 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
      <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
        <span>Database Credentials</span>
        <InfoTooltip text="Database user credentials required by Debezium to read change data capture logs." />
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
          <span>None (Default)</span>
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
          <span>GCP Secret Manager (Username &amp; Password)</span>
        </label>
      </div>

      {authMode === 'secret_manager' && (
        <div className="flex flex-col gap-3 mt-2 pl-2 border-l-2 border-[var(--vscode-highlight)]/50">
          <PropertyField
            id="debeziumSourceUsernameSecret"
            name="usernameSecret"
            label="Username Secret"
            value={usernameSecret}
            onChange={onChange}
            list="debezium-source-secret-options"
            datalist={secretOptions}
            error={secretError}
            invalid={!!secretError}
            loading={secretsLoading}
            placeholder="e.g. debezium-db-username"
            tooltip="GCP Secret Manager secret containing the database username."
            mono={true}
            helperText={
              <span>
                Values auto-populated from{' '}
                <code className="text-slate-300 bg-slate-800/60 px-1 py-0.5 rounded">
                  gcloud secrets list
                </code>
              </span>
            }
          />

          <PropertyField
            id="debeziumSourcePasswordSecret"
            name="passwordSecret"
            label="Password Secret"
            value={passwordSecret}
            onChange={onChange}
            list="debezium-source-secret-options"
            datalist={secretOptions}
            invalid={!!secretError}
            loading={secretsLoading}
            placeholder="e.g. debezium-db-password"
            tooltip="GCP Secret Manager secret containing the database password."
            mono={true}
            helperText={
              <span>
                Values auto-populated from{' '}
                <code className="text-slate-300 bg-slate-800/60 px-1 py-0.5 rounded">
                  gcloud secrets list
                </code>
              </span>
            }
          />
        </div>
      )}
    </div>
  );
};

/**
 * Props for the DebeziumSourceAdvancedSection sub-component.
 */
interface DebeziumSourceAdvancedSectionProps {
  showAdvanced: boolean;
  /** Emitted when the user toggles the advanced drawer. */
  onToggleAdvanced: () => void;
  snapshotMode: string;
  heartbeatIntervalMs: number | string;
  offsetStorage: string;
  slotName: string;
  serverId: number | string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}

/**
 * Presentational component for collapsible Advanced Source Settings.
 *
 * @param props Sub-component properties
 */
const DebeziumSourceAdvancedSection: React.FC<DebeziumSourceAdvancedSectionProps> = ({
  showAdvanced,
  onToggleAdvanced,
  snapshotMode,
  heartbeatIntervalMs,
  offsetStorage,
  slotName,
  serverId,
  onChange
}) => {
  return (
    <CollapsibleSection
      title="Advanced Source Settings"
      isOpen={showAdvanced}
      onToggle={onToggleAdvanced}
    >
      {/* Snapshot Mode */}
      <div className="flex flex-col gap-1">
        <label
          htmlFor="debeziumSourceSnapshotMode"
          className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]"
        >
          <span>Snapshot Mode</span>
          <InfoTooltip text="Specifies how Debezium initializes data before streaming WAL/binlog changes." />
        </label>
        <select
          id="debeziumSourceSnapshotMode"
          name="snapshotMode"
          value={snapshotMode}
          onChange={onChange}
          className="bg-[var(--vscode-input-bg)] text-[var(--vscode-text-primary)] p-2 rounded border border-[var(--vscode-border)] text-xs focus:outline-none focus:border-[var(--vscode-highlight)]"
        >
          <option value="initial">initial (Full snapshot then stream)</option>
          <option value="when_needed">when_needed (Snapshot if no existing offset)</option>
          <option value="never">never (Stream changes only)</option>
          <option value="schema_only">schema_only (Capture schema without data)</option>
        </select>
      </div>

      {/* Heartbeat & Server ID */}
      <div className="grid grid-cols-2 gap-2">
        <PropertyField
          id="debeziumSourceHeartbeatIntervalMs"
          name="heartbeatIntervalMs"
          label="Heartbeat Interval (ms)"
          type="number"
          value={heartbeatIntervalMs}
          onChange={onChange}
          placeholder="0 (Disabled)"
          min={0}
          tooltip="Frequency in milliseconds to send heartbeat change events to ensure offset advancement."
        />
        <PropertyField
          id="debeziumSourceServerId"
          name="serverId"
          label="Server ID"
          type="number"
          value={serverId}
          onChange={onChange}
          placeholder="e.g. 5400"
          tooltip="Unique MySQL/MariaDB replication client server ID (must differ from MySQL server and other replica IDs)."
        />
      </div>

      {/* Slot Name & Offset Storage */}
      <PropertyField
        id="debeziumSourceSlotName"
        name="slotName"
        label="Replication Slot / Publication Name"
        value={slotName}
        onChange={onChange}
        placeholder="e.g. debezium_slot"
        tooltip="PostgreSQL logical replication slot name or SQL Server CDC publication identifier."
        mono={true}
      />

      <PropertyField
        id="debeziumSourceOffsetStorage"
        name="offsetStorage"
        label="Offset Storage File Path"
        value={offsetStorage}
        onChange={onChange}
        placeholder="e.g. /tmp/offsets.dat"
        tooltip="Local file path or durable store URI for persisting Debezium replication offsets."
        mono={true}
      />
    </CollapsibleSection>
  );
};

/**
 * Component props interface for DebeziumIOSourceProperties.
 */
export interface DebeziumIOSourcePropertiesProps {
  node: {
    data: {
      label?: string;
      beam_transform?: string;
      system_instructions?: string;
      special_instructions?: string;
      properties?: {
        connectorClass?: string;
        hostName?: string;
        port?: number | string;
        databaseName?: string;
        tableIncludeList?: string;
        columnIncludeList?: string;
        columnExcludeList?: string;
        format?: 'json' | 'typed';
        formatFunction?: string;
        maxNumberOfRecords?: number | string;
        maxTimeToRunMs?: number | string;
        connectionProperties?: string;
        authMode?: 'none' | 'secret_manager';
        usernameSecret?: string;
        passwordSecret?: string;
        snapshotMode?: string;
        heartbeatIntervalMs?: number | string;
        offsetStorage?: string;
        slotName?: string;
        serverId?: number | string;
        system_instructions?: string;
        special_instructions?: string;
        [key: string]: any;
      };
    };
  };
  onChange: (properties: any) => void;
}

/**
 * DebeziumIOSourceProperties renders the configuration panel for reading CDC events with Debezium.
 *
 * @param props Component properties containing the active node and onChange callback
 */
export const DebeziumIOSourceProperties: React.FC<DebeziumIOSourcePropertiesProps> = ({
  node,
  onChange
}) => {
  const properties = node.data.properties || {};

  // Form field state extracted from node properties
  const connectorClass = properties.connectorClass || 'io.debezium.connector.mysql.MySqlConnector';
  const hostName = properties.hostName || '';
  const port = properties.port ?? 3306;
  const databaseName = properties.databaseName || '';
  const tableIncludeList = properties.tableIncludeList || '';
  const columnIncludeList = properties.columnIncludeList || '';
  const columnExcludeList = properties.columnExcludeList || '';
  const format = properties.format || 'json';
  const formatFunction = properties.formatFunction || '';
  const maxNumberOfRecords = properties.maxNumberOfRecords ?? '';
  const maxTimeToRunMs = properties.maxTimeToRunMs ?? '';
  const connectionProperties = properties.connectionProperties || '';
  const authMode = properties.authMode === 'none' ? 'none' : 'secret_manager';
  const usernameSecret = properties.usernameSecret || '';
  const passwordSecret = properties.passwordSecret || '';
  const snapshotMode = properties.snapshotMode || 'initial';
  const heartbeatIntervalMs = properties.heartbeatIntervalMs ?? '';
  const offsetStorage = properties.offsetStorage || '';
  const slotName = properties.slotName || '';
  const serverId = properties.serverId ?? '';

  // NOTE: Request Secret Manager secrets via useAssetLoader hook
  const { items: rawSecrets, error: secretError, loading: secretsLoading } = useAssetLoader<SecretItem | string>('secrets');
  const normalizedSecrets = (rawSecrets || []).map(normalizeSecretItem);
  const secretOptions = normalizedSecrets.map(s => ({ value: s.id, label: s.name }));
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Field validation
  const isHostEmpty = !hostName.trim();
  const isDatabaseEmpty = !databaseName.trim();
  const isFormatFunctionEmpty = format === 'typed' && !formatFunction.trim();

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
   * Handles connector class selection change, auto-provisioning the default database port.
   *
   * @param e Select change event
   */
  const handleConnectorClassChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newClass = e.target.value;
    const preset = CONNECTOR_CLASSES.find(c => c.value === newClass);
    const updated: any = {
      ...properties,
      connectorClass: newClass
    };
    if (preset) {
      // NOTE: Auto-update default port if port is empty or matches prior preset port
      const priorPreset = CONNECTOR_CLASSES.find(c => c.value === connectorClass);
      if (!port || (priorPreset && Number(port) === priorPreset.defaultPort)) {
        updated.port = preset.defaultPort;
      }
    }
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
      {/* Debezium Connector Class Preset */}
      <div className="flex flex-col gap-1">
        <label
          htmlFor="debeziumSourceConnectorClass"
          className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]"
        >
          <span>Connector Class</span>
          <InfoTooltip text="Target database Debezium connector implementation (Java: ConnectorConfiguration.withConnectorClass)." />
        </label>
        <select
          id="debeziumSourceConnectorClass"
          name="connectorClass"
          value={connectorClass}
          onChange={handleConnectorClassChange}
          className="bg-[var(--vscode-input-bg)] text-[var(--vscode-text-primary)] p-2 rounded border border-[var(--vscode-border)] text-xs focus:outline-none focus:border-[var(--vscode-highlight)]"
        >
          {CONNECTOR_CLASSES.map(c => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      {/* Hostname, Port & Database */}
      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-2">
          <PropertyField
            id="debeziumSourceHostName"
            name="hostName"
            label="Database Hostname"
            required="Database hostname is required"
            tooltip="Hostname or IP address of the source database instance (Java: withHostName)."
            value={hostName}
            invalid={isHostEmpty}
            error={isHostEmpty ? 'Database hostname is required' : null}
            placeholder="e.g. db.example.internal"
            onChange={handleChange}
            mono={true}
          />
        </div>
        <PropertyField
          id="debeziumSourcePort"
          name="port"
          label="Port"
          type="number"
          value={port}
          onChange={handleChange}
          placeholder="3306"
          min={1}
          tooltip="Database listener port (Java: withPort)."
        />
      </div>

      <PropertyField
        id="debeziumSourceDatabaseName"
        name="databaseName"
        label="Database Name"
        required="Database name is required"
        tooltip="Database schema or catalog name to capture CDC events from (Java: withConnectionProperty('database.dbname', ...))."
        value={databaseName}
        invalid={isDatabaseEmpty}
        error={isDatabaseEmpty ? 'Database name is required' : null}
        placeholder="e.g. inventory_production"
        onChange={handleChange}
        mono={true}
      />

      {/* Table & Column Filtering */}
      <div className="flex flex-col gap-2 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
        <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          <span>Table &amp; Column Filtering</span>
          <InfoTooltip text="Regex or comma-separated lists to filter which tables and columns are captured." />
        </label>
        <PropertyField
          id="debeziumSourceTableIncludeList"
          name="tableIncludeList"
          label="Table Include List"
          value={tableIncludeList}
          onChange={handleChange}
          placeholder="e.g. inventory\.orders,inventory\.customers"
          tooltip="Comma-separated list of regular expressions matching fully-qualified table identifiers (database.table) to capture."
          mono={true}
        />
        <div className="grid grid-cols-2 gap-2">
          <PropertyField
            id="debeziumSourceColumnIncludeList"
            name="columnIncludeList"
            label="Column Include List"
            value={columnIncludeList}
            onChange={handleChange}
            placeholder="e.g. .*\.id,.*\.status"
            tooltip="Regular expressions matching columns to include in captured events."
            mono={true}
          />
          <PropertyField
            id="debeziumSourceColumnExcludeList"
            name="columnExcludeList"
            label="Column Exclude List"
            value={columnExcludeList}
            onChange={handleChange}
            placeholder="e.g. .*\.ssn,.*\.password"
            tooltip="Regular expressions matching columns to exclude/mask from captured events."
            mono={true}
          />
        </div>
      </div>

      {/* Output Format Selection */}
      <div className="flex flex-col gap-2 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
        <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          <span>Output Format</span>
          <InfoTooltip text="Choose whether to emit JSON string events (DebeziumIO.readAsJson) or custom typed records via SourceRecordMapper (withFormatFunction)." />
        </label>
        <div className="flex gap-4 mt-1">
          <label className="flex items-center gap-2 cursor-pointer text-xs text-[var(--vscode-text-secondary)]">
            <input
              type="radio"
              name="format"
              value="json"
              checked={format === 'json'}
              onChange={handleChange}
              className="accent-[var(--vscode-highlight)] text-[var(--vscode-highlight)]"
            />
            <span>JSON String</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-xs text-[var(--vscode-text-secondary)]">
            <input
              type="radio"
              name="format"
              value="typed"
              checked={format === 'typed'}
              onChange={handleChange}
              className="accent-[var(--vscode-highlight)] text-[var(--vscode-highlight)]"
            />
            <span>Custom Typed</span>
          </label>
        </div>

        {format === 'typed' && (
          <div className="mt-2 pl-2 border-l-2 border-[var(--vscode-highlight)]/50">
            <PropertyField
              id="debeziumSourceFormatFunction"
              name="formatFunction"
              label="SourceRecordMapper Class"
              required="SourceRecordMapper class is required for custom typed output"
              value={formatFunction}
              onChange={handleChange}
              invalid={isFormatFunctionEmpty}
              error={isFormatFunctionEmpty ? 'SourceRecordMapper class is required for custom typed output' : null}
              placeholder="e.g. com.example.MyCustomRecordMapper"
              tooltip="Fully-qualified class name of the SourceRecordMapper / SerializableFunction passed to withFormatFunction()."
              mono={true}
            />
          </div>
        )}
      </div>

      {/* Dev / Test Bounds */}
      <div className="grid grid-cols-2 gap-2">
        <PropertyField
          id="debeziumSourceMaxNumberOfRecords"
          name="maxNumberOfRecords"
          label="Max Records"
          type="number"
          value={maxNumberOfRecords}
          onChange={handleChange}
          placeholder="Unlimited"
          min={1}
          tooltip="Bounds testing runs by terminating reading after N records (Java: withMaxNumberOfRecords)."
        />
        <PropertyField
          id="debeziumSourceMaxTimeToRunMs"
          name="maxTimeToRunMs"
          label="Max Run Time (ms)"
          type="number"
          value={maxTimeToRunMs}
          onChange={handleChange}
          placeholder="Unlimited"
          min={1}
          tooltip="Bounds test runs by terminating reading after the specified duration in milliseconds (Java: withMaxTimeToRun)."
        />
      </div>

      {/* Additional Connector Properties */}
      <PropertyField
        id="debeziumSourceConnectionProperties"
        name="connectionProperties"
        label="Additional Connector Properties"
        type="textarea"
        rows={3}
        value={connectionProperties}
        onChange={handleChange}
        placeholder="database.server.name=dbserver1&#10;tombstones.on.delete=false"
        tooltip="Custom key=value properties passed line-by-line to ConnectorConfiguration.withConnectionProperty()."
        mono={true}
      />

      {/* Authentication Configuration Sub-section */}
      <DebeziumSourceAuthSection
        authMode={authMode}
        usernameSecret={usernameSecret}
        passwordSecret={passwordSecret}
        secretOptions={secretOptions}
        secretError={secretError}
        secretsLoading={secretsLoading}
        onChange={handleChange}
      />

      {/* Collapsible Advanced Source Settings Sub-section */}
      <DebeziumSourceAdvancedSection
        showAdvanced={showAdvanced}
        onToggleAdvanced={() => setShowAdvanced(!showAdvanced)}
        snapshotMode={snapshotMode}
        heartbeatIntervalMs={heartbeatIntervalMs}
        offsetStorage={offsetStorage}
        slotName={slotName}
        serverId={serverId}
        onChange={handleChange}
      />

      {/* Code Generation Instructions */}
      <SystemInstructionsField
        id="debeziumSourceInstructions"
        value={systemInstructions}
        tooltip="Custom instructions passed to LLM code generator when synthesizing Debezium CDC ingestion pipelines."
        placeholder="e.g. Read MySQL binlog CDC stream as JSON, deserialize change envelopes, and route mutations"
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
