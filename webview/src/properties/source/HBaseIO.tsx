/**
 * HBaseIOSourceProperties Component
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Renders the property configuration panel for Apache Beam HBaseIO Read Source nodes
 * (org.apache.beam.sdk.io.hbase.HBaseIO.read() in Java / cross-language expansion service in Python).
 * Configures ZooKeeper cluster connectivity, target HBase table, key ranges, column family/qualifier
 * filters, server-side filter expressions, authentication (Simple, Kerberos, or Secret Manager),
 * and advanced client scanner tuning.
 *
 * Architectural Decisions:
 * - Real-time validation: Requires ZooKeeper Quorum and Table ID with instant visual cues and ARIA attributes.
 * - Dynamic extension discovery: Requests GCP Secret Manager secrets via 'getSecrets' IPC message to populate
 *   the 'hbase-source-secret-options' datalist for Kerberos keytabs and connection credentials.
 * - Scan configuration group: Houses key range bounds, column filters, scanner caching, and filter expressions.
 * - Security modes: Supports Simple (unauthenticated/OS user), Kerberos (principal + keytab), and GCP Secret Manager.
 * - Collapsible Advanced Source Settings: RPC timeouts, scan batch sizes, and hbase-site.xml key=value overrides.
 * - Preserves system_instructions / special_instructions for LLM code generation.
 * - Follows the 8pt grid system and Tailwind CSS styling using VS Code theme tokens.
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

export type HBaseAuthMode = 'simple' | 'kerberos' | 'secret_manager';

export interface HBaseIOSourcePropertiesProps {
  node: {
    data: {
      label?: string;
      beam_transform?: string;
      system_instructions?: string;
      special_instructions?: string;
      properties?: {
        zkQuorum?: string;
        zkClientPort?: number | string;
        hbaseRootDir?: string;
        znodeParent?: string;
        tableId?: string;
        keyRangeStart?: string;
        keyRangeStop?: string;
        familyFilter?: string;
        qualifierFilter?: string;
        maxVersions?: number | string;
        scanCacheSize?: number | string;
        filterExpression?: string;
        authMode?: HBaseAuthMode | string;
        kerberosPrincipal?: string;
        keytabSecret?: string;
        secretName?: string;
        rpcTimeout?: number | string;
        scanBatchSize?: number | string;
        extraConfig?: string;
        system_instructions?: string;
        special_instructions?: string;
        [key: string]: any;
      };
    };
  };
  onChange: (properties: any) => void;
}

interface ScanConfigSectionProps {
  keyRangeStart: string;
  keyRangeStop: string;
  familyFilter: string;
  qualifierFilter: string;
  maxVersions: number | string;
  scanCacheSize: number | string;
  filterExpression: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
}

/**
 * Presentational component rendering the Scan Configuration group.
 */
const ScanConfigSection: React.FC<ScanConfigSectionProps> = ({
  keyRangeStart,
  keyRangeStop,
  familyFilter,
  qualifierFilter,
  maxVersions,
  scanCacheSize,
  filterExpression,
  onChange,
}) => {
  return (
    <div className="flex flex-col gap-2 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
      <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
        <span>Scan Configuration</span>
        <InfoTooltip text="Configures scan key boundaries (withKeyRange), column filters, caching, and server-side filter expressions." />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <PropertyField
          id="hbase-source-key-range-start"
          name="keyRangeStart"
          label="Row Key Start"
          tooltip="Inclusive start row key for scan bounding (maps to HBaseIO.Read.withKeyRange)."
          value={keyRangeStart}
          onChange={onChange}
          placeholder="e.g. row-0001"
        />
        <PropertyField
          id="hbase-source-key-range-stop"
          name="keyRangeStop"
          label="Row Key Stop"
          tooltip="Exclusive stop row key for scan bounding (maps to HBaseIO.Read.withKeyRange)."
          value={keyRangeStop}
          onChange={onChange}
          placeholder="e.g. row-9999"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <PropertyField
          id="hbase-source-family-filter"
          name="familyFilter"
          label="Column Family Filter"
          tooltip="Restrict scan to a specific HBase column family."
          value={familyFilter}
          onChange={onChange}
          placeholder="e.g. metrics"
        />
        <PropertyField
          id="hbase-source-qualifier-filter"
          name="qualifierFilter"
          label="Column Qualifier Filter"
          tooltip="Restrict scan to a specific HBase column qualifier (column name)."
          value={qualifierFilter}
          onChange={onChange}
          placeholder="e.g. cpu_usage"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <PropertyField
          id="hbase-source-max-versions"
          name="maxVersions"
          label="Max Versions"
          type="number"
          min={1}
          tooltip="Maximum cell timestamp versions to retrieve per row."
          value={maxVersions}
          onChange={onChange}
          placeholder="1"
        />
        <PropertyField
          id="hbase-source-scan-cache-size"
          name="scanCacheSize"
          label="Scan Cache Size (Rows)"
          type="number"
          min={1}
          tooltip="Number of rows fetched and cached per RPC round-trip (hbase.client.scanner.caching)."
          value={scanCacheSize}
          onChange={onChange}
          placeholder="500"
        />
      </div>

      <PropertyField
        id="hbase-source-filter-expression"
        name="filterExpression"
        label="Filter Expression String"
        tooltip="Server-side HBase filter expression or serialized filter (maps to HBaseIO.Read.withFilter)."
        value={filterExpression}
        onChange={onChange}
        placeholder="e.g. RowFilter(EQUAL, 'binary:row-01') or SingleColumnValueFilter(...)"
      />
    </div>
  );
};

interface AuthSectionProps {
  authMode: HBaseAuthMode;
  kerberosPrincipal: string;
  keytabSecret: string;
  secretName: string;
  secrets: SecretItem[];
  secretError: string | null;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}

/**
 * Presentational component rendering the Authentication & Security group.
 */
const AuthSection: React.FC<AuthSectionProps> = ({
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
        <label htmlFor="hbase-source-auth-mode" className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          <span>Auth Mode</span>
          <InfoTooltip text="Select authentication method used by HBase client Configuration." />
        </label>
        <select
          id="hbase-source-auth-mode"
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
            id="hbase-source-kerberos-principal"
            name="kerberosPrincipal"
            label="Kerberos Principal"
            tooltip="Kerberos client principal for HBase SASL authentication (e.g. hbase-client@REALM.COM)."
            value={kerberosPrincipal}
            onChange={onChange}
            placeholder="hbase-client@REALM.COM"
          />
          <PropertyField
            id="hbase-source-keytab-secret"
            name="keytabSecret"
            label="Keytab Secret Reference"
            tooltip="GCP Secret Manager secret ID referencing the base64-encoded Kerberos keytab."
            value={keytabSecret}
            onChange={onChange}
            placeholder="e.g. hbase-keytab-secret"
            list="hbase-source-secret-options"
            datalist={secrets.map((s) => ({ value: s.id || s.name, label: s.name || s.id }))}
          />
        </div>
      )}

      {authMode === 'secret_manager' && (
        <PropertyField
          id="hbase-source-secret-name"
          name="secretName"
          label="Secret Manager Secret"
          tooltip="GCP Secret Manager secret containing HBase configuration credentials or tokens."
          value={secretName}
          onChange={onChange}
          placeholder="e.g. hbase-connection-credentials"
          list="hbase-source-secret-options"
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

interface AdvancedSectionProps {
  showAdvanced: boolean;
  /** Emitted when the user toggles the advanced drawer. */
  onToggle: () => void;
  rpcTimeout: number | string;
  scanBatchSize: number | string;
  extraConfig: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
}

/**
 * Presentational component rendering the collapsible Advanced Source Settings group.
 */
const AdvancedSection: React.FC<AdvancedSectionProps> = ({
  showAdvanced,
  onToggle,
  rpcTimeout,
  scanBatchSize,
  extraConfig,
  onChange,
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
          <div className="grid grid-cols-2 gap-2">
            <PropertyField
              id="hbase-source-rpc-timeout"
              name="rpcTimeout"
              label="RPC Timeout (ms)"
              type="number"
              min={0}
              tooltip="HBase client RPC timeout in milliseconds (hbase.rpc.timeout)."
              value={rpcTimeout}
              onChange={onChange}
              placeholder="60000"
            />
            <PropertyField
              id="hbase-source-scan-batch-size"
              name="scanBatchSize"
              label="Scan Batch Size (Cells)"
              type="number"
              min={1}
              tooltip="Maximum number of cells returned in a single Result chunk (hbase.client.scanner.batching)."
              value={scanBatchSize}
              onChange={onChange}
              placeholder="1000"
            />
          </div>

          <PropertyField
            id="hbase-source-extra-config"
            name="extraConfig"
            label="HBase-Site.xml Overrides"
            type="textarea"
            rows={3}
            tooltip="Additional key=value configuration overrides (one per line) loaded into the HBase Configuration."
            value={extraConfig}
            onChange={onChange}
            placeholder="hbase.client.retries.number=3&#10;hbase.client.pause=100"
          />
        </div>
      )}
    </div>
  );
};

/**
 * HBaseIOSourceProperties renders the configuration form for HBaseIO.read().
 *
 * @param props Component properties containing the active node and onChange callback
 */
export const HBaseIOSourceProperties: React.FC<HBaseIOSourcePropertiesProps> = ({ node, onChange }) => {
  const properties = node?.data?.properties || {};

  // Form field state extracted from node properties
  const zkQuorum = properties.zkQuorum || '';
  const zkClientPort = properties.zkClientPort ?? '2181';
  const hbaseRootDir = properties.hbaseRootDir || '';
  const znodeParent = properties.znodeParent || '';
  const tableId = properties.tableId || '';

  const keyRangeStart = properties.keyRangeStart || '';
  const keyRangeStop = properties.keyRangeStop || '';
  const familyFilter = properties.familyFilter || '';
  const qualifierFilter = properties.qualifierFilter || '';
  const maxVersions = properties.maxVersions ?? '';
  const scanCacheSize = properties.scanCacheSize ?? '';
  const filterExpression = properties.filterExpression || '';

  const authMode: HBaseAuthMode = (properties.authMode as HBaseAuthMode) || 'simple';
  const kerberosPrincipal = properties.kerberosPrincipal || '';
  const keytabSecret = properties.keytabSecret || '';
  const secretName = properties.secretName || '';

  const rpcTimeout = properties.rpcTimeout ?? '';
  const scanBatchSize = properties.scanBatchSize ?? '';
  const extraConfig = properties.extraConfig || '';

  // Local state for dynamically loaded secrets and accordion
  const { items: rawSecrets, error: secretError } = useAssetLoader<SecretItem | string>('secrets');
  const secrets: SecretItem[] = (rawSecrets || []).map(normalizeSecretItem);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Field validation: ZooKeeper Quorum and Table ID are required
  const isZkQuorumEmpty = !zkQuorum.trim();
  const isTableIdEmpty = !tableId.trim();

  // Fallback chain for system instructions
  const systemInstructions =
    node?.data?.system_instructions ??
    node?.data?.special_instructions ??
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

  /**
   * Handles system instructions textarea modifications.
   *
   * @param e React textarea change event
   */
  const handleInstructionsChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    onChange({
      ...properties,
      system_instructions: e.target.value,
    });
  };

  return (
    <div className="flex-1 flex flex-col gap-4 text-[var(--vscode-text-primary)] text-sm">
      {/* Connection & Table Target Card */}
      <div className="flex flex-col gap-2 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
        <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          <span>Cluster & Table Target</span>
          <InfoTooltip text="Configures ZooKeeper quorum and target HBase table for HBaseIO.read()." />
        </label>

        <PropertyField
          id="hbase-source-zk-quorum"
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
            id="hbase-source-zk-port"
            name="zkClientPort"
            label="ZK Client Port"
            type="number"
            tooltip="ZooKeeper client port (hbase.zookeeper.property.clientPort). Defaults to 2181."
            value={zkClientPort}
            onChange={handleChange}
            placeholder="2181"
          />
          <PropertyField
            id="hbase-source-znode-parent"
            name="znodeParent"
            label="ZNode Parent"
            tooltip="ZooKeeper root node for HBase (zookeeper.znode.parent). Defaults to /hbase."
            value={znodeParent}
            onChange={handleChange}
            placeholder="/hbase"
          />
        </div>

        <PropertyField
          id="hbase-source-rootdir"
          name="hbaseRootDir"
          label="HBase Root Directory"
          tooltip="Shared filesystem directory for HBase storage (hbase.rootdir), e.g. hdfs://namenode:8020/hbase."
          value={hbaseRootDir}
          onChange={handleChange}
          placeholder="hdfs://namenode:8020/hbase"
        />

        <PropertyField
          id="hbase-source-table-id"
          name="tableId"
          label="Table ID"
          tooltip="HBase table identifier string (maps to HBaseIO.Read.withTableId)."
          value={tableId}
          onChange={handleChange}
          placeholder="e.g. sensor_readings"
          required="Table ID is required"
          invalid={isTableIdEmpty}
          error={isTableIdEmpty ? 'Table ID is required' : null}
        />
      </div>

      {/* Scan Configuration Group */}
      <ScanConfigSection
        keyRangeStart={keyRangeStart}
        keyRangeStop={keyRangeStop}
        familyFilter={familyFilter}
        qualifierFilter={qualifierFilter}
        maxVersions={maxVersions}
        scanCacheSize={scanCacheSize}
        filterExpression={filterExpression}
        onChange={handleChange}
      />

      {/* Authentication & Security Group */}
      <AuthSection
        authMode={authMode}
        kerberosPrincipal={kerberosPrincipal}
        keytabSecret={keytabSecret}
        secretName={secretName}
        secrets={secrets}
        secretError={secretError}
        onChange={handleChange}
      />

      {/* Collapsible Advanced Source Settings */}
      <AdvancedSection
        showAdvanced={showAdvanced}
        onToggle={() => setShowAdvanced(!showAdvanced)}
        rpcTimeout={rpcTimeout}
        scanBatchSize={scanBatchSize}
        extraConfig={extraConfig}
        onChange={handleChange}
      />

      {/* Spacer before Instructions textarea */}
      <div className="flex-1 min-h-[16px]" />

      {/* Code Generation Instructions Textarea */}
      <PropertyField
        id="hbase-source-instructions"
        name="system_instructions"
        label="Code Generation Instructions"
        tooltip="Custom system instructions passed to the LLM when generating code for this HBase source transform."
        type="textarea"
        rows={4}
        mono={false}
        value={systemInstructions}
        onChange={handleInstructionsChange}
        placeholder="e.g. Read HBase table using HBaseIO.read().withConfiguration(conf).withTableId('sensor_readings').withKeyRange(startKey, stopKey)"
      />
    </div>
  );
};
