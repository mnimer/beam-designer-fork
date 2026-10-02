/**
 * KuduIOSourceProperties Component
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Renders the configuration panel for Apache Beam KuduIO Source nodes (KuduIO.read()).
 * Configures connection to Apache Kudu masters, target table scanning, column projections,
 * predicates, row deserialization (withParseFn), fault tolerant scanning, and authentication.
 *
 * Architectural Decisions:
 * - Enforces required master addresses and table name with validation alerts and accessible ARIA attributes.
 * - Supports projection pushdown and predicate filters to optimize tablet server scan efficiency.
 * - Dynamic discovery: fetches GCP Secret Manager secrets via 'getSecrets' IPC message for secure credential binding.
 * - Provides distinct datalist id 'kudu-source-secret-options' to avoid DOM collisions with other panels.
 * - Supports Authentication options: 'none' (anonymous), 'kerberos' (principal/keytab), and 'secret_manager'.
 * - Decomposed into local presentational sub-components (KuduSourceAuthCard, KuduSourceAdvancedCard)
 *   to maintain maintainability and stay under modular size thresholds.
 * - Preserves system_instructions / special_instructions in the bottom textarea for LLM code generation.
 * - Follows the 8pt grid system and Tailwind CSS styling with VS Code theme tokens.
 */

import React, { useState } from 'react';
import { InfoTooltip } from '../../components/InfoTooltip';
import { PropertyField } from '../../components/common/PropertyField';
import { SystemInstructionsField } from '../../components/common/SystemInstructionsField';
import { CollapsibleSection } from '../../components/common/CollapsibleSection';
import { resolveSystemInstructions } from '../../utils/systemInstructions';
import { useAssetLoader } from '../../hooks/useAssetLoader';
import { normalizeSecretItem } from '../../components/common/SecretManagerAuthFields';

/** Secret descriptor loaded from the secret manager for Kudu authentication. */
export interface SecretItem {
  id: string;
  name: string;
  fullName?: string;
}

/** Props for the {@link KuduIOSourceProperties} component. */
export interface KuduIOSourcePropertiesProps {
  node: {
    data: {
      label?: string;
      beam_transform?: string;
      system_instructions?: string;
      special_instructions?: string;
      properties?: {
        masterAddresses?: string;
        table?: string;
        projectedColumns?: string;
        predicates?: string;
        faultTolerant?: boolean;
        authMode?: 'none' | 'kerberos' | 'secret_manager' | string;
        principal?: string;
        keytabSecret?: string;
        credentialsSecret?: string;
        batchSizeBytes?: number | string;
        scanRequestTimeoutMs?: number | string;
        socketReadTimeoutMs?: number | string;
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

/** Props for the Kudu authentication settings card. */
interface KuduSourceAuthCardProps {
  authMode: 'none' | 'kerberos' | 'secret_manager';
  principal: string;
  keytabSecret: string;
  credentialsSecret: string;
  secrets: SecretItem[];
  secretError: string | null;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}

/**
 * Local presentational sub-component for Kudu Source authentication options.
 */
const KuduSourceAuthCard: React.FC<KuduSourceAuthCardProps> = ({
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
            id="kuduSourcePrincipal"
            name="principal"
            label="Kerberos Principal"
            value={principal}
            onChange={onChange}
            placeholder="e.g. kudu/master@EXAMPLE.COM"
            tooltip="Kerberos principal name used for Kudu client authentication."
            mono={true}
          />
          <PropertyField
            id="kuduSourceKeytabSecret"
            name="keytabSecret"
            label="Keytab Secret"
            value={keytabSecret}
            onChange={onChange}
            list="kudu-source-secret-options"
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
            id="kuduSourceCredentialsSecret"
            name="credentialsSecret"
            label="Credentials Secret"
            value={credentialsSecret}
            onChange={onChange}
            list="kudu-source-secret-options"
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

/** Props for the Kudu advanced performance tuning card. */
interface KuduSourceAdvancedCardProps {
  showAdvanced: boolean;
  onToggle: () => void;
  batchSizeBytes: number | string;
  scanRequestTimeoutMs: number | string;
  socketReadTimeoutMs: number | string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}

/**
 * Local presentational sub-component for Kudu Source advanced tuning parameters.
 */
const KuduSourceAdvancedCard: React.FC<KuduSourceAdvancedCardProps> = ({
  showAdvanced,
  onToggle,
  batchSizeBytes,
  scanRequestTimeoutMs,
  socketReadTimeoutMs,
  onChange
}) => {
  return (
    <CollapsibleSection
      title="Advanced Source Settings"
      isOpen={showAdvanced}
      onToggle={onToggle}
    >
      <PropertyField
        id="kuduSourceBatchSizeBytes"
        name="batchSizeBytes"
        label="Batch Size (Bytes)"
        type="number"
        value={batchSizeBytes}
        onChange={onChange}
        placeholder="e.g. 1048576 (1MB)"
        tooltip="Target batch size in bytes for scanner RPC requests from tablet servers. Maps to withBatchSize()."
        min={0}
      />

      <PropertyField
        id="kuduSourceScanRequestTimeoutMs"
        name="scanRequestTimeoutMs"
        label="Scan Request Timeout (ms)"
        type="number"
        value={scanRequestTimeoutMs}
        onChange={onChange}
        placeholder="e.g. 30000"
        tooltip="Timeout in milliseconds for individual Kudu scanner RPC requests."
        min={0}
      />

      <PropertyField
        id="kuduSourceSocketReadTimeoutMs"
        name="socketReadTimeoutMs"
        label="Socket Read Timeout (ms)"
        type="number"
        value={socketReadTimeoutMs}
        onChange={onChange}
        placeholder="e.g. 10000"
        tooltip="Socket read timeout in milliseconds for Kudu tablet server connections."
        min={0}
      />
    </CollapsibleSection>
  );
};

/**
 * KuduIOSourceProperties renders the configuration form for reading from Apache Kudu.
 *
 * @param props Component properties containing the active node and onChange callback
 */
export const KuduIOSourceProperties: React.FC<KuduIOSourcePropertiesProps> = ({ node, onChange }) => {
  const properties = node.data.properties || {};

  // Form field state extracted from node properties
  const masterAddresses = properties.masterAddresses || '';
  const table = properties.table || '';
  const projectedColumns = properties.projectedColumns || '';
  const predicates = properties.predicates || '';
  const faultTolerant = properties.faultTolerant ?? false;
  const authMode: 'none' | 'kerberos' | 'secret_manager' =
    (properties.authMode as 'none' | 'kerberos' | 'secret_manager') || 'none';
  const principal = properties.principal || '';
  const keytabSecret = properties.keytabSecret || '';
  const credentialsSecret = properties.credentialsSecret || '';
  const batchSizeBytes = properties.batchSizeBytes ?? '';
  const scanRequestTimeoutMs = properties.scanRequestTimeoutMs ?? '';
  const socketReadTimeoutMs = properties.socketReadTimeoutMs ?? '';

  // Local state for dynamically loaded secrets and accordion toggle
  const { items: rawSecrets, error: secretError } = useAssetLoader<SecretItem | string>('secrets');
  const secrets: SecretItem[] = (rawSecrets || []).map(normalizeSecretItem);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Field validation
  const isMasterAddressesEmpty = !masterAddresses.trim();
  const isTableEmpty = !table.trim();

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
      {/* Master Addresses & Table Connection */}
      <div className="flex flex-col gap-3 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
        <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          <span>Kudu Connection</span>
          <InfoTooltip text="Connection details for the Apache Kudu cluster and target table to scan." />
        </label>

        <PropertyField
          id="kuduSourceMasterAddresses"
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
          id="kuduSourceTable"
          name="table"
          label="Table Name"
          required="Table name is required"
          tooltip="Name of the Apache Kudu table to scan. Maps to withTable()."
          value={table}
          invalid={isTableEmpty}
          error={isTableEmpty ? 'Table name is required' : null}
          placeholder="e.g. impala::default.sensor_telemetry"
          onChange={handleChange}
          mono={true}
        />
      </div>

      {/* Projection & Filtering */}
      <div className="flex flex-col gap-3 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
        <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          <span>Scan Projection &amp; Filters</span>
          <InfoTooltip text="Optimize scanner throughput by projecting only needed columns and pushing filter predicates to tablet servers." />
        </label>

        <PropertyField
          id="kuduSourceProjectedColumns"
          name="projectedColumns"
          label="Projected Columns"
          tooltip="Comma-separated column names to project in the scan. If omitted, all columns are scanned. Maps to withProjectedColumns()."
          value={projectedColumns}
          placeholder="e.g. id, timestamp, metric_name, value"
          onChange={handleChange}
          mono={true}
        />

        <PropertyField
          id="kuduSourcePredicates"
          name="predicates"
          label="Scan Predicates / Filters"
          tooltip="Scan filter predicates expression to push down to Kudu tablet servers. Maps to withPredicates()."
          value={predicates}
          placeholder="e.g. timestamp >= 1600000000"
          onChange={handleChange}
          mono={true}
        />

        <div className="flex items-center gap-2 mt-1">
          <input
            id="kuduSourceFaultTolerant"
            type="checkbox"
            name="faultTolerant"
            checked={faultTolerant}
            onChange={handleChange}
            className="rounded border-[var(--vscode-border)] text-[var(--vscode-highlight)] accent-[var(--vscode-highlight)]"
          />
          <label
            htmlFor="kuduSourceFaultTolerant"
            className="flex items-center gap-1.5 text-xs text-[var(--vscode-text-secondary)] cursor-pointer"
          >
            <span>Fault Tolerant Scan (.withFaultTolerent)</span>
            <InfoTooltip text="Enforces scan resumption on another tablet server if the current tablet server fails mid-scan (Beam method: .withFaultTolerent(boolean))." />
          </label>
        </div>
      </div>

      {/* Authentication */}
      <KuduSourceAuthCard
        authMode={authMode}
        principal={principal}
        keytabSecret={keytabSecret}
        credentialsSecret={credentialsSecret}
        secrets={secrets}
        secretError={secretError}
        onChange={handleChange}
      />

      {/* Collapsible Advanced Source Settings */}
      <KuduSourceAdvancedCard
        showAdvanced={showAdvanced}
        onToggle={() => setShowAdvanced(!showAdvanced)}
        batchSizeBytes={batchSizeBytes}
        scanRequestTimeoutMs={scanRequestTimeoutMs}
        socketReadTimeoutMs={socketReadTimeoutMs}
        onChange={handleChange}
      />

      {/* Code Generation Instructions */}
      <SystemInstructionsField
        id="kuduSourceSystemInstructions"
        value={systemInstructions}
        placeholder="Custom prompt instructions for generating the Apache Beam KuduIO source step..."
        tooltip="Optional custom prompt instructions injected into LLM code generation for this transform."
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
