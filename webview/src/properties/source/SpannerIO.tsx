/**
 * SpannerIOSourceProperties Component
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Renders the configuration panel for Apache Beam SpannerIO Source nodes (SpannerIO.read()).
 * Supports reading via Cloud Spanner SQL queries (withQuery) or direct table scans (withTable, withColumns,
 * withIndex, withKeySet), timestamp staleness bounds, partitioning options, and authentication.
 *
 * Architectural Decisions:
 * - Enforces required Instance ID and Database ID, plus mode-dependent fields (query vs table + columns).
 * - Read mode branch reveals and validates only active mode controls (query vs table scan).
 * - Timestamp bound selector supports Strong, Exact Staleness, Read Timestamp, and Max Staleness with dependent values.
 * - Dynamic discovery: fetches GCP Secret Manager secrets via 'getSecrets' IPC message for service account keys.
 * - Provides distinct datalist id 'spanner-source-secret-options' avoiding collisions.
 * - Decomposed into local presentational sub-components (SpannerSourceReadModeCard, SpannerSourceAuthCard,
 *   SpannerSourceAdvancedCard) to maintain readability and modularity.
 * - Uses onToggle callback for collapsible state management.
 * - Preserves system_instructions / special_instructions in the bottom textarea for LLM code generation.
 * - Follows the 8pt grid system and Tailwind CSS styling with VS Code theme tokens.
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

export type SpannerReadMode = 'query' | 'table';
export type SpannerTimestampBoundMode = 'strong' | 'exact_staleness' | 'read_timestamp' | 'max_staleness';

export interface SpannerIOSourcePropertiesProps {
  node: {
    data: {
      label?: string;
      beam_transform?: string;
      system_instructions?: string;
      special_instructions?: string;
      properties?: {
        instanceId?: string;
        databaseId?: string;
        projectId?: string;
        readMode?: SpannerReadMode;
        query?: string;
        table?: string;
        columns?: string;
        index?: string;
        keySet?: string;
        batching?: boolean;
        partitionSizeBytes?: number | string;
        maxPartitions?: number | string;
        timestampBoundMode?: SpannerTimestampBoundMode;
        timestampBoundValue?: string | number;
        authMode?: 'adc' | 'secret_manager';
        serviceAccountKeySecret?: string;
        host?: string;
        databaseRole?: string;
        rpcPriority?: 'HIGH' | 'MEDIUM' | 'LOW' | '';
        system_instructions?: string;
        special_instructions?: string;
        [key: string]: any;
      };
    };
  };
  onChange: (properties: any) => void;
}

/**
 * Normalizes secret payloads received from the VS Code extension host.
 *
 * @param secrets Array of raw secret strings or objects
 * @returns Array of normalized SecretItem entries
 */

interface SpannerSourceReadModeCardProps {
  readMode: SpannerReadMode;
  query: string;
  table: string;
  columns: string;
  index: string;
  keySet: string;
  isQueryEmpty: boolean;
  isTableEmpty: boolean;
  isColumnsEmpty: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}

/**
 * Local presentational sub-component for Spanner Source query vs table read modes.
 */
const SpannerSourceReadModeCard: React.FC<SpannerSourceReadModeCardProps> = ({
  readMode,
  query,
  table,
  columns,
  index,
  keySet,
  isQueryEmpty,
  isTableEmpty,
  isColumnsEmpty,
  onChange
}) => {
  return (
    <div className="flex flex-col gap-3 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
      <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
        <span>Read Mode &amp; Target</span>
        <InfoTooltip text="Choose between executing a SQL query (withQuery) or scanning a table with projection and optional secondary index (withTable)." />
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
          id="spannerSourceQuery"
          name="query"
          label="SQL Query"
          required="SQL Query is required for Query read mode"
          tooltip="Cloud Spanner SQL query string to execute. Maps to withQuery()."
          type="textarea"
          rows={3}
          value={query}
          invalid={isQueryEmpty}
          error={isQueryEmpty ? 'SQL Query is required for Query read mode' : null}
          placeholder="SELECT id, name, status, created_at FROM Users WHERE status = 'ACTIVE'"
          onChange={onChange}
          mono={true}
        />
      ) : (
        <div className="flex flex-col gap-3 mt-1">
          <PropertyField
            id="spannerSourceTable"
            name="table"
            label="Table Name"
            required="Table name is required for Table read mode"
            tooltip="Name of the Cloud Spanner table to read from. Maps to withTable()."
            value={table}
            invalid={isTableEmpty}
            error={isTableEmpty ? 'Table name is required for Table read mode' : null}
            placeholder="e.g. Users"
            onChange={onChange}
            mono={true}
          />
          <PropertyField
            id="spannerSourceColumns"
            name="columns"
            label="Columns"
            required="Columns list is required for Table read mode"
            tooltip="Comma-separated column names to retrieve from the table. Maps to withColumns()."
            value={columns}
            invalid={isColumnsEmpty}
            error={isColumnsEmpty ? 'Columns list is required for Table read mode' : null}
            placeholder="e.g. id, name, status, created_at"
            onChange={onChange}
            mono={true}
          />
          <PropertyField
            id="spannerSourceIndex"
            name="index"
            label="Secondary Index (Optional)"
            tooltip="Optional secondary index to read from instead of the base table. Maps to withIndex()."
            value={index}
            placeholder="e.g. UsersByStatus"
            onChange={onChange}
            mono={true}
          />
          <PropertyField
            id="spannerSourceKeySet"
            name="keySet"
            label="KeySet Filter (Optional)"
            tooltip="Optional KeySet expression specifying key ranges or individual keys to read. Maps to withKeySet()."
            value={keySet}
            placeholder="e.g. KeySet.all() or prefix key expression"
            onChange={onChange}
            mono={true}
          />
        </div>
      )}
    </div>
  );
};

interface SpannerSourceAuthCardProps {
  authMode: 'adc' | 'secret_manager';
  serviceAccountKeySecret: string;
  secrets: SecretItem[];
  secretError: string | null;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}

/**
 * Local presentational sub-component for Spanner Source credentials and authentication.
 */
const SpannerSourceAuthCard: React.FC<SpannerSourceAuthCardProps> = ({
  authMode,
  serviceAccountKeySecret,
  secrets,
  secretError,
  onChange
}) => {
  return (
    <div className="flex flex-col gap-2 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
      <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
        <span>Authentication</span>
        <InfoTooltip text="Choose whether to authenticate using Application Default Credentials (ADC) or a Service Account Key stored in GCP Secret Manager." />
      </label>
      <div className="flex flex-col gap-2 mt-1">
        <label className="flex items-center gap-2 cursor-pointer text-xs text-[var(--vscode-text-secondary)]">
          <input
            type="radio"
            name="authMode"
            value="adc"
            checked={authMode === 'adc'}
            onChange={onChange}
            className="accent-[var(--vscode-highlight)] text-[var(--vscode-highlight)]"
          />
          <span>Application Default Credentials (ADC / Compute Engine SA)</span>
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
          <span>GCP Secret Manager (Service Account Key)</span>
        </label>
      </div>

      {authMode === 'secret_manager' && (
        <div className="flex flex-col gap-3 mt-2 pl-2 border-l-2 border-[var(--vscode-highlight)]/50">
          <PropertyField
            id="spannerSourceServiceAccountKeySecret"
            name="serviceAccountKeySecret"
            label="Service Account Key Secret"
            value={serviceAccountKeySecret}
            onChange={onChange}
            list="spanner-source-secret-options"
            datalist={secrets.map((s) => ({ value: s.id || s.name, label: s.name || s.id }))}
            placeholder="e.g. spanner-sa-key"
            tooltip="GCP Secret Manager secret containing the JSON service account key."
            error={secretError}
            invalid={!!secretError}
            mono={true}
          />
        </div>
      )}
    </div>
  );
};

interface SpannerSourceAdvancedCardProps {
  showAdvanced: boolean;
  onToggle: () => void;
  host: string;
  databaseRole: string;
  rpcPriority: 'HIGH' | 'MEDIUM' | 'LOW' | '';
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}

/**
 * Local presentational sub-component for Spanner Source advanced endpoint and client settings.
 */
const SpannerSourceAdvancedCard: React.FC<SpannerSourceAdvancedCardProps> = ({
  showAdvanced,
  onToggle,
  host,
  databaseRole,
  rpcPriority,
  onChange
}) => {
  return (
    <div className="flex flex-col border border-[var(--vscode-border-light)] rounded-md overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center justify-between p-2 bg-[var(--vscode-subcard-bg)] text-xs font-bold uppercase text-[var(--vscode-text-muted)] hover:text-[var(--vscode-text-primary)] transition-colors cursor-pointer"
      >
        <span>Advanced Source Settings</span>
        <span>{showAdvanced ? '▲' : '▼'}</span>
      </button>

      {showAdvanced && (
        <div className="p-3 bg-[var(--vscode-workbench-bg)] flex flex-col gap-3 border-t border-[var(--vscode-border-light)]">
          <PropertyField
            id="spannerSourceHost"
            name="host"
            label="Spanner Host / Emulator Endpoint"
            value={host}
            onChange={onChange}
            placeholder="e.g. localhost:9010"
            tooltip="Custom Cloud Spanner endpoint override or local emulator host. Maps to withHost()."
            mono={true}
          />

          <PropertyField
            id="spannerSourceDatabaseRole"
            name="databaseRole"
            label="Database Role"
            value={databaseRole}
            onChange={onChange}
            placeholder="e.g. analytics_reader"
            tooltip="Fine-grained access control (FGAC) database role passed to SpannerConfig.withDatabaseRole()."
            mono={true}
          />

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="spannerSourceRpcPriority"
              className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]"
            >
              <span>RPC Priority</span>
              <InfoTooltip text="Priority of RPC requests sent to Cloud Spanner (HIGH, MEDIUM, LOW). Maps to withRpcPriority()." />
            </label>
            <select
              id="spannerSourceRpcPriority"
              name="rpcPriority"
              value={rpcPriority}
              onChange={onChange}
              className="bg-[var(--vscode-input-bg)] text-[var(--vscode-text-primary)] p-2 rounded border border-[var(--vscode-border)] text-xs focus:outline-none focus:border-[var(--vscode-highlight)]"
            >
              <option value="">Default (Unspecified)</option>
              <option value="HIGH">HIGH Priority</option>
              <option value="MEDIUM">MEDIUM Priority</option>
              <option value="LOW">LOW Priority</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * SpannerIOSourceProperties renders the configuration form for reading from Google Cloud Spanner.
 *
 * @param props Component properties containing the active node and onChange callback
 */
export const SpannerIOSourceProperties: React.FC<SpannerIOSourcePropertiesProps> = ({ node, onChange }) => {
  const properties = node.data.properties || {};

  // Form field state extracted from node properties
  const instanceId = properties.instanceId || '';
  const databaseId = properties.databaseId || '';
  const projectId = properties.projectId || '';
  const readMode: SpannerReadMode = properties.readMode || 'query';
  const query = properties.query || '';
  const table = properties.table || '';
  const columns = properties.columns || '';
  const index = properties.index || '';
  const keySet = properties.keySet || '';
  const batching = properties.batching ?? true;
  const partitionSizeBytes = properties.partitionSizeBytes ?? '';
  const maxPartitions = properties.maxPartitions ?? '';
  const timestampBoundMode: SpannerTimestampBoundMode = properties.timestampBoundMode || 'strong';
  const timestampBoundValue = properties.timestampBoundValue ?? '';
  const authMode = properties.authMode || 'adc';
  const serviceAccountKeySecret = properties.serviceAccountKeySecret || '';
  const host = properties.host || '';
  const databaseRole = properties.databaseRole || '';
  const rpcPriority = properties.rpcPriority || '';

  // Local state for dynamically loaded secrets and accordion toggle
  const { items: rawSecrets, error: secretError } = useAssetLoader<SecretItem | string>('secrets');
  const secrets: SecretItem[] = (rawSecrets || []).map(normalizeSecretItem);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Field validation
  const isInstanceEmpty = !instanceId.trim();
  const isDatabaseEmpty = !databaseId.trim();
  const isQueryEmpty = readMode === 'query' && !query.trim();
  const isTableEmpty = readMode === 'table' && !table.trim();
  const isColumnsEmpty = readMode === 'table' && !columns.trim();

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
    onChange({
      ...properties,
      system_instructions: e.target.value
    });
  };

  return (
    <div className="flex-1 flex flex-col gap-4 text-[var(--vscode-text-primary)] text-sm">
      {/* Instance & Database Identifiers */}
      <div className="flex flex-col gap-3 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
        <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          <span>Spanner Database Connection</span>
          <InfoTooltip text="Cloud Spanner instance and database coordinates. Required." />
        </label>

        <PropertyField
          id="spannerSourceInstanceId"
          name="instanceId"
          label="Instance ID"
          required="Spanner instance ID is required"
          tooltip="Cloud Spanner instance identifier. Maps to withInstanceId()."
          value={instanceId}
          invalid={isInstanceEmpty}
          error={isInstanceEmpty ? 'Spanner instance ID is required' : null}
          placeholder="e.g. production-spanner-instance"
          onChange={handleChange}
          mono={true}
        />

        <PropertyField
          id="spannerSourceDatabaseId"
          name="databaseId"
          label="Database ID"
          required="Spanner database ID is required"
          tooltip="Cloud Spanner database identifier. Maps to withDatabaseId()."
          value={databaseId}
          invalid={isDatabaseEmpty}
          error={isDatabaseEmpty ? 'Spanner database ID is required' : null}
          placeholder="e.g. customer_records"
          onChange={handleChange}
          mono={true}
        />

        <PropertyField
          id="spannerSourceProjectId"
          name="projectId"
          label="Project ID (Optional)"
          tooltip="GCP Project ID hosting the Spanner instance. Defaults to the pipeline runner project if omitted. Maps to withProjectId()."
          value={projectId}
          placeholder="e.g. my-gcp-project"
          onChange={handleChange}
          mono={true}
        />
      </div>

      {/* Read Mode (Query vs Table) */}
      <SpannerSourceReadModeCard
        readMode={readMode}
        query={query}
        table={table}
        columns={columns}
        index={index}
        keySet={keySet}
        isQueryEmpty={isQueryEmpty}
        isTableEmpty={isTableEmpty}
        isColumnsEmpty={isColumnsEmpty}
        onChange={handleChange}
      />

      {/* Batching & Partitioning */}
      <div className="flex flex-col gap-3 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
        <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          <span>Batching &amp; Partitioning</span>
          <InfoTooltip text="Configure Cloud Spanner Batch API usage and PartitionOptions for distributed parallel execution." />
        </label>

        <div className="flex items-center gap-2 mt-1">
          <input
            id="spannerSourceBatching"
            type="checkbox"
            name="batching"
            checked={batching}
            onChange={handleChange}
            className="rounded border-[var(--vscode-border)] text-[var(--vscode-highlight)] accent-[var(--vscode-highlight)]"
          />
          <label
            htmlFor="spannerSourceBatching"
            className="flex items-center gap-1.5 text-xs text-[var(--vscode-text-secondary)] cursor-pointer"
          >
            <span>Enable Batch API</span>
            <InfoTooltip text="When enabled, uses the Cloud Spanner Batch API for distributed partitioned reads across workers. Maps to withBatching()." />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-1">
          <PropertyField
            id="spannerSourcePartitionSizeBytes"
            name="partitionSizeBytes"
            label="Partition Size (Bytes)"
            type="number"
            value={partitionSizeBytes}
            onChange={handleChange}
            placeholder="e.g. 1073741824 (1GB)"
            tooltip="Target partition size in bytes used by Spanner PartitionOptions.withPartitionSizeBytes()."
            min={0}
          />
          <PropertyField
            id="spannerSourceMaxPartitions"
            name="maxPartitions"
            label="Max Partitions"
            type="number"
            value={maxPartitions}
            onChange={handleChange}
            placeholder="e.g. 100"
            tooltip="Maximum number of partitions generated by Spanner PartitionOptions.withMaxPartitions()."
            min={0}
          />
        </div>
      </div>

      {/* Transaction Staleness / Timestamp Bound */}
      <div className="flex flex-col gap-3 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
        <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          <span>Transaction Staleness</span>
          <InfoTooltip text="Configures the timestamp bound for read consistency and staleness tolerance. Maps to withTimestampBound()." />
        </label>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="spannerSourceTimestampBoundMode"
            className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]"
          >
            <span>Timestamp Bound Mode</span>
            <InfoTooltip text="Controls read staleness: Strong reads the most recent data; Exact Staleness / Max Staleness allows bounded out-of-date reads; Read Timestamp reads at a fixed point in time." />
          </label>
          <select
            id="spannerSourceTimestampBoundMode"
            name="timestampBoundMode"
            value={timestampBoundMode}
            onChange={handleChange}
            className="bg-[var(--vscode-input-bg)] text-[var(--vscode-text-primary)] p-2 rounded border border-[var(--vscode-border)] text-xs focus:outline-none focus:border-[var(--vscode-highlight)]"
          >
            <option value="strong">Strong (Read Most Recent Data)</option>
            <option value="exact_staleness">Exact Staleness (Duration in Seconds)</option>
            <option value="read_timestamp">Read Timestamp (RFC 3339 / ISO 8601)</option>
            <option value="max_staleness">Max Staleness (Duration in Seconds)</option>
          </select>
        </div>

        {timestampBoundMode !== 'strong' && (
          <PropertyField
            id="spannerSourceTimestampBoundValue"
            name="timestampBoundValue"
            label={
              timestampBoundMode === 'read_timestamp'
                ? 'Read Timestamp Value'
                : 'Staleness Duration (Seconds)'
            }
            value={timestampBoundValue}
            onChange={handleChange}
            placeholder={
              timestampBoundMode === 'read_timestamp'
                ? 'e.g. 2026-09-23T00:00:00Z'
                : 'e.g. 15'
            }
            tooltip="Dependent value for the chosen TimestampBound mode."
            mono={true}
          />
        )}
      </div>

      {/* Authentication */}
      <SpannerSourceAuthCard
        authMode={authMode}
        serviceAccountKeySecret={serviceAccountKeySecret}
        secrets={secrets}
        secretError={secretError}
        onChange={handleChange}
      />

      {/* Collapsible Advanced Source Settings */}
      <SpannerSourceAdvancedCard
        showAdvanced={showAdvanced}
        onToggle={() => setShowAdvanced(!showAdvanced)}
        host={host}
        databaseRole={databaseRole}
        rpcPriority={rpcPriority}
        onChange={handleChange}
      />

      <div className="flex-1 min-h-[16px]" />

      {/* Code Generation Instructions */}
      <PropertyField
        id="spannerSourceSystemInstructions"
        name="system_instructions"
        label="Code Generation Instructions"
        type="textarea"
        rows={4}
        value={systemInstructions}
        onChange={handleInstructionsChange}
        placeholder="Custom prompt instructions for generating the Apache Beam SpannerIO source step..."
        tooltip="Optional custom prompt instructions injected into LLM code generation for this transform."
      />
    </div>
  );
};
