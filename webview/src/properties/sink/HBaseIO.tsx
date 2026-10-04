/**
 * HBaseIOSinkProperties Component
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Renders the property configuration panel for Apache Beam HBaseIO Write Sink nodes
 * (org.apache.beam.sdk.io.hbase.HBaseIO.write() in Java / cross-language expansion service in Python).
 * Configures ZooKeeper cluster connectivity, target HBase table, mutation mode (Put, Delete, Increment),
 * default column family, client write buffer size, WAL durability levels, authentication
 * (Simple, Kerberos, or Secret Manager), batch size, RPC timeouts, retry counts, and hbase-site.xml overrides.
 *
 * Architectural Decisions:
 * - Real-time validation: Requires ZooKeeper Quorum and Table ID with instant visual cues and ARIA attributes.
 * - Dynamic extension discovery: Requests GCP Secret Manager secrets via 'getSecrets' IPC message to populate
 *   the 'hbase-sink-secret-options' datalist for Kerberos keytabs and connection credentials.
 * - Mutation configuration group: Configures mutation operation mode, default column family, buffer sizing, and durability.
 * - Security modes: Supports Simple (unauthenticated/OS user), Kerberos (principal + keytab), and GCP Secret Manager.
 * - Collapsible Advanced Sink Settings: Write batch sizes, RPC timeouts, retry counts, and extra config overrides.
 * - Preserves system_instructions / special_instructions for LLM code generation.
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
 * Secret item loaded from Secret Manager for HBase authentication.
 */
export interface SecretItem {
  id: string;
  name: string;
  fullName?: string;
}

export type HBaseMutationMode = 'put' | 'delete' | 'increment';
export type HBaseDurability = 'SYNC_WAL' | 'ASYNC_WAL' | 'SKIP_WAL';
export type HBaseAuthMode = 'simple' | 'kerberos' | 'secret_manager';

/**
 * Props for the HBaseIOSinkProperties component.
 */
export interface HBaseIOSinkPropertiesProps {
  node: {
    data: {
      label?: string;
      beam_transform?: string;
      system_instructions?: string;
      special_instructions?: string;
      properties?: {
        zkQuorum?: string;
        zkClientPort?: number | string;
        znodeParent?: string;
        tableId?: string;
        mutationMode?: HBaseMutationMode | string;
        defaultColumnFamily?: string;
        writeBufferSize?: number | string;
        durability?: HBaseDurability | string;
        authMode?: HBaseAuthMode | string;
        kerberosPrincipal?: string;
        keytabSecret?: string;
        secretName?: string;
        batchSize?: number | string;
        rpcTimeout?: number | string;
        retryCount?: number | string;
        extraConfig?: string;
        system_instructions?: string;
        special_instructions?: string;
        [key: string]: any;
      };
    };
  };
  onChange: (properties: any) => void;
}

/**
 * Props for the MutationConfigSection component.
 */
interface MutationConfigSectionProps {
  mutationMode: HBaseMutationMode;
  defaultColumnFamily: string;
  writeBufferSize: number | string;
  durability: HBaseDurability;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}

/**
 * Presentational component rendering the Mutation & Write Configuration group.
 */
const MutationConfigSection: React.FC<MutationConfigSectionProps> = ({
  mutationMode,
  defaultColumnFamily,
  writeBufferSize,
  durability,
  onChange,
}) => {
  return (
    <div className="flex flex-col gap-2 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
      <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
        <span>Mutation Configuration</span>
        <InfoTooltip text="Configures mutation type (Put, Delete, Increment), column family defaults, client buffering, and WAL durability." />
      </label>

      <div className="flex flex-col gap-2">
        <label htmlFor="hbase-sink-mutation-mode" className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          <span>Mutation Mode</span>
          <InfoTooltip text="Type of HBase Mutation to generate for each incoming pipeline record." />
        </label>
        <select
          id="hbase-sink-mutation-mode"
          name="mutationMode"
          value={mutationMode}
          onChange={onChange}
          className="bg-[var(--vscode-input-bg)] text-[var(--vscode-text-primary)] p-2 rounded border border-[var(--vscode-border)] text-xs focus:outline-none focus:border-[var(--vscode-highlight)]"
        >
          <option value="put">Put (Insert / Upsert rows)</option>
          <option value="delete">Delete (Remove rows / columns)</option>
          <option value="increment">Increment (Atomic counter increments)</option>
        </select>
      </div>

      <PropertyField
        id="hbase-sink-default-column-family"
        name="defaultColumnFamily"
        label="Default Column Family"
        tooltip="Default column family applied to generated mutations if not specified per cell."
        value={defaultColumnFamily}
        onChange={onChange}
        placeholder="e.g. cf"
      />

      <div className="grid grid-cols-2 gap-2">
        <PropertyField
          id="hbase-sink-write-buffer-size"
          name="writeBufferSize"
          label="Write Buffer Size (Bytes)"
          type="number"
          min={0}
          tooltip="Client-side mutation write buffer size in bytes before automatic flush (hbase.client.write.buffer)."
          value={writeBufferSize}
          onChange={onChange}
          placeholder="2097152"
        />

        <div className="flex flex-col gap-2">
          <label htmlFor="hbase-sink-durability" className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
            <span>Durability</span>
            <InfoTooltip text="Write-Ahead Log (WAL) durability level for HBase mutations." />
          </label>
          <select
            id="hbase-sink-durability"
            name="durability"
            value={durability}
            onChange={onChange}
            className="bg-[var(--vscode-input-bg)] text-[var(--vscode-text-primary)] p-2 rounded border border-[var(--vscode-border)] text-xs focus:outline-none focus:border-[var(--vscode-highlight)]"
          >
            <option value="SYNC_WAL">SYNC_WAL (Synchronous disk flush)</option>
            <option value="ASYNC_WAL">ASYNC_WAL (Asynchronous disk flush)</option>
            <option value="SKIP_WAL">SKIP_WAL (Fastest, risk of data loss)</option>
          </select>
        </div>
      </div>
    </div>
  );
};

/**
 * Props for the SinkAuthSection component.
 */
interface SinkAuthSectionProps {
  authMode: HBaseAuthMode;
  kerberosPrincipal: string;
  keytabSecret: string;
  secretName: string;
  secrets: SecretItem[];
  secretError: string | null;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}

/**
 * Presentational component rendering the Authentication & Security group for Sink.
 */
const SinkAuthSection: React.FC<SinkAuthSectionProps> = ({
  authMode,
  kerberosPrincipal,
  keytabSecret,
  secretName,
  secrets,
  secretError,
  onChange,
}) => {
  return (
    <div className="flex flex-col gap-2 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
      <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
        <span>Authentication & Security</span>
        <InfoTooltip text="HBase authentication mechanism: Simple (unauthenticated/OS user), Kerberos, or Google Cloud Secret Manager." />
      </label>

      <div className="flex flex-col gap-2">
        <label htmlFor="hbase-sink-auth-mode" className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          <span>Auth Mode</span>
          <InfoTooltip text="Select authentication method used by HBase client Configuration." />
        </label>
        <select
          id="hbase-sink-auth-mode"
          name="authMode"
          value={authMode}
          onChange={onChange}
          className="bg-[var(--vscode-input-bg)] text-[var(--vscode-text-primary)] p-2 rounded border border-[var(--vscode-border)] text-xs focus:outline-none focus:border-[var(--vscode-highlight)]"
        >
          <option value="simple">Simple (Unauthenticated / Default OS User)</option>
          <option value="kerberos">Kerberos (Principal + Keytab)</option>
          <option value="secret_manager">Google Cloud Secret Manager</option>
        </select>
      </div>

      {authMode === 'kerberos' && (
        <div className="flex flex-col gap-2">
          <PropertyField
            id="hbase-sink-kerberos-principal"
            name="kerberosPrincipal"
            label="Kerberos Principal"
            tooltip="Kerberos client principal for HBase SASL authentication (e.g. hbase-writer@REALM.COM)."
            value={kerberosPrincipal}
            onChange={onChange}
            placeholder="hbase-writer@REALM.COM"
          />
          <PropertyField
            id="hbase-sink-keytab-secret"
            name="keytabSecret"
            label="Keytab Secret Reference"
            tooltip="GCP Secret Manager secret ID referencing the base64-encoded Kerberos keytab."
            value={keytabSecret}
            onChange={onChange}
            placeholder="e.g. hbase-keytab-secret"
            list="hbase-sink-secret-options"
            datalist={secrets.map((s) => ({ value: s.id || s.name, label: s.name || s.id }))}
          />
        </div>
      )}

      {authMode === 'secret_manager' && (
        <PropertyField
          id="hbase-sink-secret-name"
          name="secretName"
          label="Secret Manager Secret"
          tooltip="GCP Secret Manager secret containing HBase configuration credentials or tokens."
          value={secretName}
          onChange={onChange}
          placeholder="e.g. hbase-connection-credentials"
          list="hbase-sink-secret-options"
          datalist={secrets.map((s) => ({ value: s.id || s.name, label: s.name || s.id }))}
        />
      )}

      {/* Datalist populated dynamically from VS Code extension host */}

      {secretError && (
        <span className="text-xs text-red-400 mt-1" role="alert">
          {secretError}
        </span>
      )}
    </div>
  );
};

/**
 * Props for the AdvancedSinkSection component.
 */
interface AdvancedSinkSectionProps {
  showAdvanced: boolean;
  /** Emitted when the user toggles the advanced drawer. */
  onToggle: () => void;
  batchSize: number | string;
  rpcTimeout: number | string;
  retryCount: number | string;
  extraConfig: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
}

/**
 * Presentational component rendering the collapsible Advanced Sink Settings group.
 */
const AdvancedSinkSection: React.FC<AdvancedSinkSectionProps> = ({
  showAdvanced,
  onToggle,
  batchSize,
  rpcTimeout,
  retryCount,
  extraConfig,
  onChange,
}) => {
  return (
    <CollapsibleSection
      title="Advanced Sink Settings"
      isOpen={showAdvanced}
      onToggle={onToggle}
    >
      <div className="grid grid-cols-3 gap-2">
        <PropertyField
          id="hbase-sink-batch-size"
          name="batchSize"
          label="Batch Size"
          type="number"
          min={1}
          tooltip="Maximum number of mutations buffered before issuing an RPC write call."
          value={batchSize}
          onChange={onChange}
          placeholder="500"
        />
        <PropertyField
          id="hbase-sink-rpc-timeout"
          name="rpcTimeout"
          label="RPC Timeout (ms)"
          type="number"
          min={0}
          tooltip="HBase client RPC timeout in milliseconds for write requests (hbase.rpc.timeout)."
          value={rpcTimeout}
          onChange={onChange}
          placeholder="60000"
        />
        <PropertyField
          id="hbase-sink-retry-count"
          name="retryCount"
          label="Retry Count"
          type="number"
          min={0}
          tooltip="Maximum number of retry attempts for failed write operations (hbase.client.retries.number)."
          value={retryCount}
          onChange={onChange}
          placeholder="5"
        />
      </div>

      <PropertyField
        id="hbase-sink-extra-config"
        name="extraConfig"
        label="HBase-Site.xml Overrides"
        type="textarea"
        rows={3}
        tooltip="Additional key=value configuration overrides (one per line) loaded into the HBase Configuration."
        value={extraConfig}
        onChange={onChange}
        placeholder="hbase.client.retries.number=5&#10;hbase.rpc.timeout=60000"
      />
    </CollapsibleSection>
  );
};

/**
 * HBaseIOSinkProperties renders the configuration form for HBaseIO.write().
 *
 * @param props Component properties containing the active node and onChange callback
 */
export const HBaseIOSinkProperties: React.FC<HBaseIOSinkPropertiesProps> = ({ node, onChange }) => {
  const properties = node?.data?.properties || {};

  // Form field state extracted from node properties
  const zkQuorum = properties.zkQuorum || '';
  const zkClientPort = properties.zkClientPort ?? '2181';
  const znodeParent = properties.znodeParent || '';
  const tableId = properties.tableId || '';

  const mutationMode: HBaseMutationMode = (properties.mutationMode as HBaseMutationMode) || 'put';
  const defaultColumnFamily = properties.defaultColumnFamily || '';
  const writeBufferSize = properties.writeBufferSize ?? '';
  const durability: HBaseDurability = (properties.durability as HBaseDurability) || 'SYNC_WAL';

  const authMode: HBaseAuthMode = (properties.authMode as HBaseAuthMode) || 'simple';
  const kerberosPrincipal = properties.kerberosPrincipal || '';
  const keytabSecret = properties.keytabSecret || '';
  const secretName = properties.secretName || '';

  const batchSize = properties.batchSize ?? '';
  const rpcTimeout = properties.rpcTimeout ?? '';
  const retryCount = properties.retryCount ?? '';
  const extraConfig = properties.extraConfig || '';

  // Local state for dynamically loaded secrets and accordion
  const { items: rawSecrets, error: secretError } = useAssetLoader<SecretItem | string>('secrets');
  const secrets: SecretItem[] = (rawSecrets || []).map(normalizeSecretItem);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Field validation: ZooKeeper Quorum and Table ID are required
  const isZkQuorumEmpty = !zkQuorum.trim();
  const isTableIdEmpty = !tableId.trim();

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
      {/* Connection & Table Target Card */}
      <div className="flex flex-col gap-2 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
        <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          <span>Cluster & Destination Table</span>
          <InfoTooltip text="Configures ZooKeeper quorum and destination HBase table for HBaseIO.write()." />
        </label>

        <PropertyField
          id="hbase-sink-zk-quorum"
          name="zkQuorum"
          label="ZooKeeper Quorum"
          tooltip="Comma-separated list of ZooKeeper quorum hostnames (hbase.zookeeper.quorum)."
          value={zkQuorum}
          onChange={handleChange}
          placeholder="zk1.example.com,zk2.example.com"
          required="ZooKeeper Quorum is required"
          invalid={isZkQuorumEmpty}
          error={isZkQuorumEmpty ? 'ZooKeeper Quorum is required' : null}
        />

        <div className="grid grid-cols-2 gap-2">
          <PropertyField
            id="hbase-sink-zk-port"
            name="zkClientPort"
            label="ZK Client Port"
            type="number"
            tooltip="ZooKeeper client port (hbase.zookeeper.property.clientPort). Defaults to 2181."
            value={zkClientPort}
            onChange={handleChange}
            placeholder="2181"
          />
          <PropertyField
            id="hbase-sink-znode-parent"
            name="znodeParent"
            label="ZNode Parent"
            tooltip="ZooKeeper root node for HBase (zookeeper.znode.parent). Defaults to /hbase."
            value={znodeParent}
            onChange={handleChange}
            placeholder="/hbase"
          />
        </div>

        <PropertyField
          id="hbase-sink-table-id"
          name="tableId"
          label="Table ID"
          tooltip="Destination HBase table identifier string (maps to HBaseIO.Write.withTableId)."
          value={tableId}
          onChange={handleChange}
          placeholder="e.g. sensor_aggregates"
          required="Table ID is required"
          invalid={isTableIdEmpty}
          error={isTableIdEmpty ? 'Table ID is required' : null}
        />
      </div>

      {/* Mutation & Write Configuration Group */}
      <MutationConfigSection
        mutationMode={mutationMode}
        defaultColumnFamily={defaultColumnFamily}
        writeBufferSize={writeBufferSize}
        durability={durability}
        onChange={handleChange}
      />

      {/* Authentication & Security Group */}
      <SinkAuthSection
        authMode={authMode}
        kerberosPrincipal={kerberosPrincipal}
        keytabSecret={keytabSecret}
        secretName={secretName}
        secrets={secrets}
        secretError={secretError}
        onChange={handleChange}
      />

      {/* Collapsible Advanced Sink Settings */}
      <AdvancedSinkSection
        showAdvanced={showAdvanced}
        onToggle={() => setShowAdvanced(!showAdvanced)}
        batchSize={batchSize}
        rpcTimeout={rpcTimeout}
        retryCount={retryCount}
        extraConfig={extraConfig}
        onChange={handleChange}
      />

      <SystemInstructionsField
        id="hbase-sink-instructions"
        value={systemInstructions}
        rows={4}
        tooltip="Custom system instructions passed to the LLM when generating code for this HBase sink transform."
        placeholder="e.g. Write Mutation records to HBase table using HBaseIO.write().withConfiguration(conf).withTableId('sensor_aggregates')"
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
