/**
 * KuduIOSinkProperties Component
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Renders the configuration panel for Apache Beam KuduIO Sink nodes (KuduIO.write()).
 * Configures connection to Apache Kudu masters, target table mutations, write operations
 * (insert, upsert, update, delete), session flush modes, mutation buffer space, and client timeouts.
 *
 * Architectural Decisions:
 * - Enforces required master addresses and target table name with inline alerts and accessible ARIA attributes.
 * - Supports write operation mode selection (insert, upsert, update, delete) mapping to withFormatFn.
 * - Provides session delivery controls including flush mode (AUTO_FLUSH_BACKGROUND, AUTO_FLUSH_SYNC, MANUAL_FLUSH)
 *   and mutation buffer space sizing.
 * - Dynamic discovery: fetches GCP Secret Manager secrets via 'getSecrets' IPC message for secure credential binding.
 * - Provides distinct datalist id 'kudu-sink-secret-options' to prevent collisions with source panel.
 * - Supports Authentication options: 'none' (anonymous), 'kerberos' (principal/keytab), and 'secret_manager'.
 * - Decomposed into local presentational sub-components (KuduSinkAuthCard, KuduSinkAdvancedCard)
 *   to maintain modularity.
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

export type KuduWriteOperation = 'insert' | 'upsert' | 'update' | 'delete';
export type KuduFlushMode = 'AUTO_FLUSH_SYNC' | 'AUTO_FLUSH_BACKGROUND' | 'MANUAL_FLUSH';

export interface KuduIOSinkPropertiesProps {
  node: {
    data: {
      label?: string;
      beam_transform?: string;
      system_instructions?: string;
      special_instructions?: string;
      properties?: {
        masterAddresses?: string;
        table?: string;
        operation?: KuduWriteOperation | string;
        flushMode?: KuduFlushMode | string;
        mutationBufferSpace?: number | string;
        ignoreDuplicateRows?: boolean;
        authMode?: 'none' | 'kerberos' | 'secret_manager' | string;
        principal?: string;
        keytabSecret?: string;
        credentialsSecret?: string;
        operationTimeoutMs?: number | string;
        maxPendingErrors?: number | string;
        batchSize?: number | string;
        system_instructions?: string;
        special_instructions?: string;
        [key: string]: any;
      };
    };
  };
  onChange: (properties: any) => void;
}

/**
 * Normalizes secret items received from the VS Code extension host.
 *
 * @param secrets Array of raw secret strings or objects
 * @returns Array of normalized SecretItem entries
 */

interface KuduSinkAuthCardProps {
  authMode: 'none' | 'kerberos' | 'secret_manager';
  principal: string;
  keytabSecret: string;
  credentialsSecret: string;
  secrets: SecretItem[];
  secretError: string | null;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}

/**
 * Local presentational sub-component for Kudu Sink authentication settings.
 */
const KuduSinkAuthCard: React.FC<KuduSinkAuthCardProps> = ({
  authMode,
  principal,
  keytabSecret,
  credentialsSecret,
  secrets,
  secretError,
  onChange
}) => {
  return (
    <div className="flex flex-col gap-2 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
      <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
        <span>Authentication</span>
        <InfoTooltip text="Authentication mode used to establish connection to the Kudu cluster." />
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
          <span>None / Anonymous</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer text-xs text-[var(--vscode-text-secondary)]">
          <input
            type="radio"
            name="authMode"
            value="kerberos"
            checked={authMode === 'kerberos'}
            onChange={onChange}
            className="accent-[var(--vscode-highlight)] text-[var(--vscode-highlight)]"
          />
          <span>Kerberos Authentication</span>
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

      {authMode === 'kerberos' && (
        <div className="flex flex-col gap-3 mt-2 pl-2 border-l-2 border-[var(--vscode-highlight)]/50">
          <PropertyField
            id="kuduSinkPrincipal"
            name="principal"
            label="Kerberos Principal"
            value={principal}
            onChange={onChange}
            placeholder="e.g. kudu/master@EXAMPLE.COM"
            tooltip="Kerberos principal name used for Kudu client authentication."
            mono={true}
          />
          <PropertyField
            id="kuduSinkKeytabSecret"
            name="keytabSecret"
            label="Keytab Secret"
            value={keytabSecret}
            onChange={onChange}
            list="kudu-sink-secret-options"
            datalist={secrets.map((s) => ({ value: s.id || s.name, label: s.name || s.id }))}
            placeholder="e.g. kudu-keytab-secret"
            tooltip="GCP Secret Manager secret or keytab reference used for Kerberos authentication."
            error={secretError}
            invalid={!!secretError}
            mono={true}
          />
        </div>
      )}

      {authMode === 'secret_manager' && (
        <div className="flex flex-col gap-3 mt-2 pl-2 border-l-2 border-[var(--vscode-highlight)]/50">
          <PropertyField
            id="kuduSinkCredentialsSecret"
            name="credentialsSecret"
            label="Credentials Secret"
            value={credentialsSecret}
            onChange={onChange}
            list="kudu-sink-secret-options"
            datalist={secrets.map((s) => ({ value: s.id || s.name, label: s.name || s.id }))}
            placeholder="e.g. kudu-client-credentials"
            tooltip="GCP Secret Manager secret containing Kudu client credentials or configuration."
            error={secretError}
            invalid={!!secretError}
            mono={true}
          />
        </div>
      )}
    </div>
  );
};

interface KuduSinkAdvancedCardProps {
  showAdvanced: boolean;
  onToggle: () => void;
  operationTimeoutMs: number | string;
  maxPendingErrors: number | string;
  batchSize: number | string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}

/**
 * Local presentational sub-component for Kudu Sink advanced configuration parameters.
 */
const KuduSinkAdvancedCard: React.FC<KuduSinkAdvancedCardProps> = ({
  showAdvanced,
  onToggle,
  operationTimeoutMs,
  maxPendingErrors,
  batchSize,
  onChange
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
          <PropertyField
            id="kuduSinkOperationTimeoutMs"
            name="operationTimeoutMs"
            label="Operation Timeout (ms)"
            type="number"
            value={operationTimeoutMs}
            onChange={onChange}
            placeholder="e.g. 30000"
            tooltip="Timeout in milliseconds for Kudu write operations."
            min={0}
          />

          <PropertyField
            id="kuduSinkMaxPendingErrors"
            name="maxPendingErrors"
            label="Max Pending Errors"
            type="number"
            value={maxPendingErrors}
            onChange={onChange}
            placeholder="e.g. 100"
            tooltip="Maximum number of pending session mutation errors retained before failing."
            min={0}
          />

          <PropertyField
            id="kuduSinkBatchSize"
            name="batchSize"
            label="Batch Size"
            type="number"
            value={batchSize}
            onChange={onChange}
            placeholder="e.g. 1000"
            tooltip="Batch size for buffering mutations prior to RPC dispatch."
            min={0}
          />
        </div>
      )}
    </div>
  );
};

/**
 * KuduIOSinkProperties renders the configuration form for writing mutations to Apache Kudu.
 *
 * @param props Component properties containing the active node and onChange callback
 */
export const KuduIOSinkProperties: React.FC<KuduIOSinkPropertiesProps> = ({ node, onChange }) => {
  const properties = node.data.properties || {};

  // Form field state extracted from node properties
  const masterAddresses = properties.masterAddresses || '';
  const table = properties.table || '';
  const operation: KuduWriteOperation = (properties.operation as KuduWriteOperation) || 'upsert';
  const flushMode: KuduFlushMode = (properties.flushMode as KuduFlushMode) || 'AUTO_FLUSH_BACKGROUND';
  const mutationBufferSpace = properties.mutationBufferSpace ?? '';
  const ignoreDuplicateRows = properties.ignoreDuplicateRows ?? false;
  const authMode: 'none' | 'kerberos' | 'secret_manager' =
    (properties.authMode as 'none' | 'kerberos' | 'secret_manager') || 'none';
  const principal = properties.principal || '';
  const keytabSecret = properties.keytabSecret || '';
  const credentialsSecret = properties.credentialsSecret || '';
  const operationTimeoutMs = properties.operationTimeoutMs ?? '';
  const maxPendingErrors = properties.maxPendingErrors ?? '';
  const batchSize = properties.batchSize ?? '';

  // Local state for dynamically loaded secrets and accordion toggle
  const { items: rawSecrets, error: secretError } = useAssetLoader<SecretItem | string>('secrets');
  const secrets: SecretItem[] = (rawSecrets || []).map(normalizeSecretItem);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Field validation
  const isMasterAddressesEmpty = !masterAddresses.trim();
  const isTableEmpty = !table.trim();

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
      {/* Master Addresses & Table Connection */}
      <div className="flex flex-col gap-3 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
        <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          <span>Kudu Destination</span>
          <InfoTooltip text="Connection details for the Apache Kudu cluster and target table for mutations." />
        </label>

        <PropertyField
          id="kuduSinkMasterAddresses"
          name="masterAddresses"
          label="Master Addresses"
          required="Kudu master addresses are required"
          tooltip="Comma-separated list of host:port addresses for Kudu master servers (e.g. host1:7051,host2:7051). Maps to withMasterAddresses()."
          value={masterAddresses}
          invalid={isMasterAddressesEmpty}
          error={isMasterAddressesEmpty ? 'Kudu master addresses are required' : null}
          placeholder="e.g. kudu-master-1:7051,kudu-master-2:7051"
          onChange={handleChange}
          mono={true}
        />

        <PropertyField
          id="kuduSinkTable"
          name="table"
          label="Table Name"
          required="Table name is required"
          tooltip="Name of the target Apache Kudu table. Maps to withTable()."
          value={table}
          invalid={isTableEmpty}
          error={isTableEmpty ? 'Table name is required' : null}
          placeholder="e.g. impala::default.sensor_aggregates"
          onChange={handleChange}
          mono={true}
        />
      </div>

      {/* Mutation & Format Configuration */}
      <div className="flex flex-col gap-3 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
        <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          <span>Mutation &amp; Operation Mode</span>
          <InfoTooltip text="Configures the write operation type and format function used to construct Kudu mutations." />
        </label>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="kuduSinkOperation"
            className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]"
          >
            <span>Write Mode / Operation</span>
            <InfoTooltip text="Operation applied to records. Maps to operation generated within withFormatFn()." />
          </label>
          <select
            id="kuduSinkOperation"
            name="operation"
            value={operation}
            onChange={handleChange}
            className="bg-[var(--vscode-input-bg)] text-[var(--vscode-text-primary)] p-2 rounded border border-[var(--vscode-border)] text-xs focus:outline-none focus:border-[var(--vscode-highlight)]"
          >
            <option value="upsert">UPSERT — Insert or Update Existing</option>
            <option value="insert">INSERT — Insert New Rows</option>
            <option value="update">UPDATE — Modify Existing Rows</option>
            <option value="delete">DELETE — Remove Existing Rows</option>
          </select>
        </div>

      </div>

      {/* Session & Flush Settings */}
      <div className="flex flex-col gap-3 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
        <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          <span>Session &amp; Flush Guarantees</span>
          <InfoTooltip text="Configure Kudu client session execution, mutation buffer sizing, and row collision handling." />
        </label>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="kuduSinkFlushMode"
            className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]"
          >
            <span>Flush Mode</span>
            <InfoTooltip text="AUTO_FLUSH_BACKGROUND asynchronously buffers mutations for highest throughput; AUTO_FLUSH_SYNC flushes each mutation synchronously; MANUAL_FLUSH buffers until explicit flush." />
          </label>
          <select
            id="kuduSinkFlushMode"
            name="flushMode"
            value={flushMode}
            onChange={handleChange}
            className="bg-[var(--vscode-input-bg)] text-[var(--vscode-text-primary)] p-2 rounded border border-[var(--vscode-border)] text-xs focus:outline-none focus:border-[var(--vscode-highlight)]"
          >
            <option value="AUTO_FLUSH_BACKGROUND">AUTO_FLUSH_BACKGROUND (Asynchronous High Throughput)</option>
            <option value="AUTO_FLUSH_SYNC">AUTO_FLUSH_SYNC (Synchronous Immediate)</option>
            <option value="MANUAL_FLUSH">MANUAL_FLUSH (Manual Buffer Control)</option>
          </select>
        </div>

        <PropertyField
          id="kuduSinkMutationBufferSpace"
          name="mutationBufferSpace"
          label="Mutation Buffer Space"
          type="number"
          value={mutationBufferSpace}
          onChange={handleChange}
          placeholder="e.g. 10000"
          tooltip="Number of mutations that can be buffered in memory before blocking or flushing."
          min={0}
        />

        <div className="flex items-center gap-2 mt-1">
          <input
            id="kuduSinkIgnoreDuplicateRows"
            type="checkbox"
            name="ignoreDuplicateRows"
            checked={ignoreDuplicateRows}
            onChange={handleChange}
            className="rounded border-[var(--vscode-border)] text-[var(--vscode-highlight)] accent-[var(--vscode-highlight)]"
          />
          <label
            htmlFor="kuduSinkIgnoreDuplicateRows"
            className="flex items-center gap-1.5 text-xs text-[var(--vscode-text-secondary)] cursor-pointer"
          >
            <span>Ignore Duplicate Rows</span>
            <InfoTooltip text="When enabled, duplicate key collisions during insert operations are safely ignored rather than failing the mutation." />
          </label>
        </div>
      </div>

      {/* Authentication */}
      <KuduSinkAuthCard
        authMode={authMode}
        principal={principal}
        keytabSecret={keytabSecret}
        credentialsSecret={credentialsSecret}
        secrets={secrets}
        secretError={secretError}
        onChange={handleChange}
      />

      {/* Collapsible Advanced Sink Settings */}
      <KuduSinkAdvancedCard
        showAdvanced={showAdvanced}
        onToggle={() => setShowAdvanced(!showAdvanced)}
        operationTimeoutMs={operationTimeoutMs}
        maxPendingErrors={maxPendingErrors}
        batchSize={batchSize}
        onChange={handleChange}
      />

      <div className="flex-1 min-h-[16px]" />

      {/* Code Generation Instructions */}
      <PropertyField
        id="kuduSinkSystemInstructions"
        name="system_instructions"
        label="Code Generation Instructions"
        type="textarea"
        rows={4}
        value={systemInstructions}
        onChange={handleInstructionsChange}
        placeholder="Custom prompt instructions for generating the Apache Beam KuduIO sink step..."
        tooltip="Optional custom prompt instructions injected into LLM code generation for this transform."
      />
    </div>
  );
};
