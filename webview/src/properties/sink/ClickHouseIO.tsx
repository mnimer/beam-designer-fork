/**
 * ClickHouseIOSinkProperties Component
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Renders the property configuration panel for ClickHouseIO.write(jdbcUrl, table) Database Sink nodes.
 * Writes a PCollection of Beam Row elements to a target ClickHouse table.
 *
 * Architectural Decisions:
 * - Positional arguments: ClickHouse JDBC URL and target table name are required.
 * - Format validation warning if JDBC URL does not begin with 'jdbc:clickhouse:'.
 * - Throughput controls: withMaxInsertBlockSize, withInsertQuorum, withInsertDistributedSync, withInsertDeduplicate.
 * - Flush & retry controls: withMaxRetries, withInitialBackoff, withMaxCumulativeBackoff.
 * - Dynamic discovery: Loads GCP Secret Manager secrets via 'getSecrets' IPC message to populate datalist.
 * - Secret normalization supports both raw resource strings and SecretItem objects with short ID extraction.
 * - Collapsible Advanced Sink Settings: extra JDBC/HTTP properties, compression toggle, socket timeout.
 * - Explicitly notes that ClickHouseIO.write requires a PCollection<Row> with an attached Schema.
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

/**
 * Secret item loaded from Secret Manager for ClickHouse authentication.
 */
export interface SecretItem {
  id: string;
  name: string;
  fullName?: string;
}

/**
 * Props for the ClickHouseIOSinkProperties component.
 */
export interface ClickHouseIOSinkPropertiesProps {
  node: {
    data: {
      label?: string;
      beam_transform?: string;
      system_instructions?: string;
      special_instructions?: string;
      properties?: {
        url?: string;
        jdbcUrl?: string;
        table?: string;
        tableName?: string;
        maxInsertBlockSize?: number | string;
        insertQuorum?: number | string;
        insertDistributedSync?: boolean;
        insertDeduplicate?: boolean;
        maxRetries?: number | string;
        maxCumulativeBackoff?: number | string;
        initialBackoff?: number | string;
        authMode?: 'none' | 'secret_manager';
        usernameSecret?: string;
        passwordSecret?: string;
        socketTimeout?: number | string;
        compress?: boolean;
        extraJdbcProperties?: string;
        connectionProperties?: string;
        system_instructions?: string;
        special_instructions?: string;
        [key: string]: any;
      };
    };
  };
  onChange: (properties: any) => void;
}

/**
 * ClickHouseIOSinkProperties renders the configuration form for ClickHouseIO.write() transforms.
 *
 * @param props - Component props containing the active node data and onChange dispatch callback.
 */
export const ClickHouseIOSinkProperties: React.FC<ClickHouseIOSinkPropertiesProps> = ({ node, onChange }) => {
  const properties = node.data.properties || {};

  // Form field state extracted from node properties
  const url = properties.url ?? properties.jdbcUrl ?? '';
  const table = properties.table ?? properties.tableName ?? '';
  const maxInsertBlockSize = properties.maxInsertBlockSize ?? '';
  const insertQuorum = properties.insertQuorum ?? '';
  const insertDistributedSync = properties.insertDistributedSync ?? false;
  const insertDeduplicate = properties.insertDeduplicate ?? false;
  const maxRetries = properties.maxRetries ?? '';
  const maxCumulativeBackoff = properties.maxCumulativeBackoff ?? '';
  const initialBackoff = properties.initialBackoff ?? '';
  const authMode = properties.authMode ?? 'none';
  const usernameSecret = properties.usernameSecret ?? '';
  const passwordSecret = properties.passwordSecret ?? '';
  const socketTimeout = properties.socketTimeout ?? '';
  const compress = properties.compress ?? false;
  const extraJdbcProperties = properties.extraJdbcProperties ?? properties.connectionProperties ?? '';

  // Local state for dynamically loaded Secret Manager secrets and UI state
  const { items: rawSecrets, error: secretError } = useAssetLoader<SecretItem | string>('secrets');
  const secrets: SecretItem[] = (rawSecrets || []).map(normalizeSecretItem);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Field validation
  const isUrlEmpty = !String(url).trim();
  const isUrlFormatWarning = !isUrlEmpty && !String(url).trim().startsWith('jdbc:clickhouse:');
  const isTableEmpty = !String(table).trim();

  // NOTE: Fallback chain for system instructions per architecture spec
  const systemInstructions = resolveSystemInstructions(node);

  /**
   * Updates a single property key and invokes the parent onChange callback.
   *
   * @param name - The property field name to update.
   * @param value - The new value for the property.
   */
  const updateProperty = (name: string, value: any) => {
    // NOTE: Controlled update creating a new properties dictionary while removing legacy alias keys to prevent desync
    const updated = { ...properties, [name]: value };
    if (name === 'url') {
      delete updated.jdbcUrl;
    } else if (name === 'table') {
      delete updated.tableName;
    } else if (name === 'extraJdbcProperties') {
      delete updated.connectionProperties;
    }
    onChange(updated);
  };

  /**
   * Handles text, number, and checkbox change events.
   *
   * @param e - React change event from inputs or textareas.
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
      {/* Schema Requirement Notice Banner */}
      <div className="p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)] text-xs text-[var(--vscode-descriptionForeground)]">
        <span className="font-semibold text-[var(--vscode-text-primary)]">Important: </span>
        ClickHouseIO.write requires an input <code className="text-[var(--vscode-text-primary)] font-mono">PCollection&lt;Row&gt;</code> with
        an explicit Beam Schema matching the destination ClickHouse table columns.
      </div>

      {/* Target Destination: JDBC URL & Table Name (ClickHouseIO.write arguments) */}
      <div className="flex flex-col gap-3 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
        <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          <span>Target Destination (ClickHouseIO.write)</span>
          <InfoTooltip text="Configures the JDBC connection URL and target table name passed as arguments to ClickHouseIO.write(jdbcUrl, table)." />
        </label>

        <PropertyField
          id="clickhouseSinkUrl"
          name="url"
          label="JDBC URL"
          required="ClickHouse JDBC URL is required"
          tooltip="ClickHouse JDBC connection URL (e.g. jdbc:clickhouse://localhost:8123/default). Required positional argument."
          value={url}
          invalid={isUrlEmpty}
          error={isUrlEmpty ? 'ClickHouse JDBC URL is required' : null}
          helperText={
            isUrlFormatWarning ? (
              <span className="text-amber-400" role="alert">
                Warning: ClickHouse JDBC URL should start with &quot;jdbc:clickhouse:&quot;
              </span>
            ) : null
          }
          placeholder="jdbc:clickhouse://localhost:8123/default"
          onChange={handleChange}
          mono={true}
        />

        <PropertyField
          id="clickhouseSinkTable"
          name="table"
          label="Target Table"
          required="Target table name is required"
          tooltip="Destination ClickHouse table name. Required positional argument."
          value={table}
          invalid={isTableEmpty}
          error={isTableEmpty ? 'Target table name is required' : null}
          placeholder="my_table"
          onChange={handleChange}
          mono={true}
        />
      </div>

      {/* Throughput & Consistency Controls */}
      <div className="flex flex-col gap-3 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
        <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          <span>Throughput &amp; Consistency</span>
          <InfoTooltip text="Batch size and consistency guarantees for ClickHouse block insertion." />
        </label>

        <div className="grid grid-cols-2 gap-2">
          <PropertyField
            id="clickhouseSinkMaxInsertBlockSize"
            name="maxInsertBlockSize"
            label="Max Insert Block Size"
            type="number"
            tooltip="Maximum number of rows per insert block via ClickHouseIO.write().withMaxInsertBlockSize(long)."
            value={maxInsertBlockSize}
            onChange={handleChange}
            placeholder="100000"
            mono={true}
          />

          <PropertyField
            id="clickhouseSinkInsertQuorum"
            name="insertQuorum"
            label="Insert Quorum"
            type="number"
            tooltip="Number of replicas that must confirm write for ReplicatedMergeTree tables (0 disables quorum) via withInsertQuorum(long)."
            value={insertQuorum}
            onChange={handleChange}
            placeholder="0"
            mono={true}
          />
        </div>

        <div className="flex flex-col gap-2 mt-1">
          <div className="flex items-center gap-2 p-2 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
            <input
              id="clickhouseSinkInsertDistributedSync"
              type="checkbox"
              name="insertDistributedSync"
              checked={insertDistributedSync}
              onChange={handleChange}
              className="rounded border-[var(--vscode-border)] text-[var(--vscode-highlight)] accent-[var(--vscode-highlight)] focus:ring-0 cursor-pointer"
            />
            <label
              htmlFor="clickhouseSinkInsertDistributedSync"
              className="flex items-center gap-1.5 text-xs text-[var(--vscode-text-secondary)] cursor-pointer"
            >
              <span>Wait for Distributed Sync</span>
              <InfoTooltip text="Configures withInsertDistributedSync(boolean). If enabled, writes to Distributed tables block until data is written to all shard replicas." />
            </label>
          </div>

          <div className="flex items-center gap-2 p-2 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
            <input
              id="clickhouseSinkInsertDeduplicate"
              type="checkbox"
              name="insertDeduplicate"
              checked={insertDeduplicate}
              onChange={handleChange}
              className="rounded border-[var(--vscode-border)] text-[var(--vscode-highlight)] accent-[var(--vscode-highlight)] focus:ring-0 cursor-pointer"
            />
            <label
              htmlFor="clickhouseSinkInsertDeduplicate"
              className="flex items-center gap-1.5 text-xs text-[var(--vscode-text-secondary)] cursor-pointer"
            >
              <span>Enable Deduplication</span>
              <InfoTooltip text="Configures withInsertDeduplicate(boolean). Enables block-level deduplication for ReplicatedMergeTree tables to guarantee idempotent retries." />
            </label>
          </div>
        </div>
      </div>

      {/* Flush & Retry Controls */}
      <div className="flex flex-col gap-3 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
        <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          <span>Flush &amp; Retry Behaviour</span>
          <InfoTooltip text="Configures retry counts and exponential backoff parameters on transient insertion failures." />
        </label>

        <PropertyField
          id="clickhouseSinkMaxRetries"
          name="maxRetries"
          label="Max Retries"
          type="number"
          tooltip="Maximum retry attempts on failed insert via withMaxRetries(int)."
          value={maxRetries}
          onChange={handleChange}
          placeholder="3"
          mono={true}
        />

        <div className="grid grid-cols-2 gap-2">
          <PropertyField
            id="clickhouseSinkInitialBackoff"
            name="initialBackoff"
            label="Initial Backoff (ms)"
            type="number"
            tooltip="Initial backoff duration before first retry via withInitialBackoff(Duration)."
            value={initialBackoff}
            onChange={handleChange}
            placeholder="1000"
            mono={true}
          />
          <PropertyField
            id="clickhouseSinkMaxCumulativeBackoff"
            name="maxCumulativeBackoff"
            label="Max Cumulative Backoff (ms)"
            type="number"
            tooltip="Maximum cumulative backoff duration across all retries via withMaxCumulativeBackoff(Duration)."
            value={maxCumulativeBackoff}
            onChange={handleChange}
            placeholder="300000"
            mono={true}
          />
        </div>
      </div>

      {/* Authentication */}
      <div className="flex flex-col gap-2 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
        <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          <span>Authentication</span>
          <InfoTooltip text="Select authentication strategy for ClickHouse sink connection: None or Google Cloud Secret Manager." />
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
              id="clickhouseSinkUsernameSecret"
              name="usernameSecret"
              label="Username Secret"
              tooltip="GCP Secret Manager secret holding ClickHouse username."
              value={usernameSecret}
              onChange={handleChange}
              list="clickhouse-sink-secret-options"
              datalist={secrets.map((s) => ({ value: s.id || s.name, label: s.name || s.id }))}
              placeholder="e.g. clickhouse-username"
              mono={true}
            />
            <PropertyField
              id="clickhouseSinkPasswordSecret"
              name="passwordSecret"
              label="Password Secret"
              tooltip="GCP Secret Manager secret holding ClickHouse password."
              value={passwordSecret}
              onChange={handleChange}
              list="clickhouse-sink-secret-options"
              datalist={secrets.map((s) => ({ value: s.id || s.name, label: s.name || s.id }))}
              placeholder="e.g. clickhouse-password"
              mono={true}
            />
          </div>
        )}
      </div>

      {/* Collapsible Advanced Sink Settings */}
      <CollapsibleSection
        title="Advanced Sink Settings"
        isOpen={showAdvanced}
        onToggle={() => setShowAdvanced(!showAdvanced)}
      >
        <PropertyField
          id="clickhouseSinkSocketTimeout"
          name="socketTimeout"
          label="Socket Timeout (ms)"
          type="number"
          tooltip="ClickHouse socket timeout in milliseconds for sink client."
          value={socketTimeout}
          onChange={handleChange}
          placeholder="30000"
          mono={true}
        />

        <div className="flex items-center gap-2 p-2 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
          <input
            id="clickhouseSinkCompress"
            type="checkbox"
            name="compress"
            checked={compress}
            onChange={handleChange}
            className="rounded border-[var(--vscode-border)] text-[var(--vscode-highlight)] accent-[var(--vscode-highlight)] focus:ring-0 cursor-pointer"
          />
          <label
            htmlFor="clickhouseSinkCompress"
            className="flex items-center gap-1.5 text-xs text-[var(--vscode-text-secondary)] cursor-pointer"
          >
            <span>Enable Compression</span>
            <InfoTooltip text="Enables HTTP transport compression when streaming insert blocks to ClickHouse." />
          </label>
        </div>

        <PropertyField
          id="clickhouseSinkExtraJdbcProperties"
          name="extraJdbcProperties"
          label="Extra JDBC / HTTP Properties"
          type="textarea"
          rows={3}
          tooltip="Additional ClickHouse connection properties as key=value pairs per line passed to withProperties()."
          value={extraJdbcProperties}
          onChange={handleChange}
          placeholder="ssl=true&#10;sslmode=strict"
          mono={true}
        />
      </CollapsibleSection>

      <SystemInstructionsField
        id="clickhouseSinkInstructions"
        value={systemInstructions}
        tooltip="Optional instructions passed to LLM code generator. Explicitly emphasizes that ClickHouseIO.write requires a PCollection<Row> with an attached Schema."
        placeholder="e.g. Ingest PCollection<Row> with schema matching destination ClickHouse table using ClickHouseIO.write(url, table).withMaxInsertBlockSize(100000)"
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
