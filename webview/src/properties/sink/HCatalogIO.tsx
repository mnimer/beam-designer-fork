/**
 * HCatalogIOSinkProperties Component
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Renders the property configuration panel for Apache Beam HCatalogIO Sink nodes
 * (org.apache.beam.sdk.io.hcatalog.HCatalogIO.write() in Java SDK / cross-language in Python).
 * Configures Hive Metastore connection parameters (hive.metastore.uris via withConfigProperties),
 * database, table, static partition map (withPartition), batch size (withBatchSize),
 * authentication (simple, kerberos, secret_manager), and advanced commit / timeout options.
 *
 * Architectural Decisions:
 * - NOTE: HCatalog is legacy / deprecated in modern cloud-native architectures. Pipelines using
 *   HCatalogIO require org.apache.hive:hive-exec and org.apache.hive.hcatalog dependencies alongside
 *   a running Hive Metastore thrift service.
 * - Element-type contract: The sink consumes PCollection<org.apache.hive.hcatalog.data.HCatRecord>,
 *   and requires the record field order to match the destination table schema exactly.
 * - Controlled inputs adhering to "props in, events up" unidirectional data flow.
 * - Metastore URI validation: Verifies URI presence and flags a format warning if the scheme is not thrift://.
 * - Required Table: Hive destination table name is required for HCatalogIO.write().
 * - Dynamic discovery: Requests GCP Secret Manager secrets via 'getSecrets' IPC message to securely bind Kerberos credentials.
 * - Unique datalist ID: Uses 'hcatalog-sink-secret-options' to avoid datalist collisions across panels.
 * - Collapsible Advanced Sink Settings: Encapsulates hive-site.xml override, client timeout, and commit behavior.
 * - Preserves system_instructions / special_instructions fallback chain for LLM pipeline code generation.
 * - Strictly follows the 8pt grid system and VS Code theme tokens with Tailwind CSS styling.
 */

import React, { useState } from 'react';
import { InfoTooltip } from '../../components/InfoTooltip';
import { PropertyField } from '../../components/common/PropertyField';
import { useAssetLoader } from '../../hooks/useAssetLoader';
import { normalizeSecretItem } from '../../components/common/SecretManagerAuthFields';

/**
 * Secret item descriptor returned from extension host discovery.
 */
export interface SecretItem {
  id: string;
  name: string;
  fullName?: string;
}

/**
 * Props for the HCatalogIOSinkProperties component.
 */
export interface HCatalogIOSinkPropertiesProps {
  node: {
    data: {
      label?: string;
      beam_transform?: string;
      system_instructions?: string;
      special_instructions?: string;
      properties?: {
        metastoreUri?: string;
        database?: string;
        table?: string;
        partition?: string;
        batchSize?: number | string;
        configProperties?: string;
        authMode?: 'simple' | 'kerberos' | 'secret_manager';
        kerberosPrincipal?: string;
        keytabSecret?: string;
        hiveSitePath?: string;
        clientTimeoutSeconds?: number | string;
        commitBehavior?: string;
        system_instructions?: string;
        special_instructions?: string;
        [key: string]: any;
      };
    };
  };
  onChange: (properties: any) => void;
}

/**
 * HCatalogIOSinkProperties renders the configuration panel for HCatalogIO sink writes.
 *
 * @param props Component properties containing the active node and onChange callback
 */
export const HCatalogIOSinkProperties: React.FC<HCatalogIOSinkPropertiesProps> = ({ node, onChange }) => {
  const properties = node.data?.properties || {};

  // Form field state extracted from node properties
  const metastoreUri = properties.metastoreUri || '';
  const database = properties.database !== undefined ? properties.database : 'default';
  const table = properties.table || '';
  const partition = properties.partition || '';
  const batchSize = properties.batchSize !== undefined && properties.batchSize !== null ? properties.batchSize : '';
  const configProperties = properties.configProperties || '';
  const authMode = properties.authMode || 'simple';
  const kerberosPrincipal = properties.kerberosPrincipal || '';
  const keytabSecret = properties.keytabSecret || '';
  const hiveSitePath = properties.hiveSitePath || '';
  const clientTimeoutSeconds = properties.clientTimeoutSeconds !== undefined && properties.clientTimeoutSeconds !== null ? properties.clientTimeoutSeconds : '';
  const commitBehavior = properties.commitBehavior || '';

  // Local state for dynamically loaded secrets and UI toggles
  const { items: rawSecrets, error: secretError } = useAssetLoader<SecretItem | string>('secrets');
  const secrets: SecretItem[] = (rawSecrets || []).map(normalizeSecretItem);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Field validation
  const isMetastoreUriEmpty = !metastoreUri.trim();
  const isMetastoreUriInvalid = !isMetastoreUriEmpty && !metastoreUri.trim().toLowerCase().startsWith('thrift://');
  const isTableEmpty = !table.trim();

  // Fallback chain for system instructions
  const systemInstructions =
    node.data?.system_instructions ??
    node.data?.special_instructions ??
    properties.system_instructions ??
    properties.special_instructions ??
    '';

  /**
   * Updates a generic property value and triggers the onChange callback.
   *
   * @param name The property name key
   * @param value The updated property value
   */
  const updateProperty = (name: string, value: any) => {
    // NOTE: Merges updated key/value into current properties and dispatches to parent
    const updated = { ...properties, [name]: value };
    onChange(updated);
  };

  /**
   * Handles text, select, and checkbox input changes.
   *
   * @param e Standard React change event from input, select, or textarea
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
    // NOTE: LLM generation prompt is stored in system_instructions property
    onChange({
      ...properties,
      system_instructions: e.target.value
    });
  };

  return (
    <div className="flex-1 flex flex-col gap-4 text-[var(--vscode-text-primary)] text-sm">
      {/* Metastore Connection & Table Card */}
      <div className="flex flex-col gap-3 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
        <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          <span>Hive Metastore &amp; Table</span>
          <InfoTooltip text="Hive Metastore connection endpoint and destination table. In HCatalogIO, connection parameters are supplied as a Map to withConfigProperties(Map)." />
        </label>

        <PropertyField
          id="hcatSinkMetastoreUri"
          name="metastoreUri"
          label="Hive Metastore URI"
          required="Hive Metastore URI is required"
          tooltip="Thrift URI for the Hive Metastore service (e.g. thrift://metastore.example.com:9083). Populates hive.metastore.uris in withConfigProperties(Map). Required."
          value={metastoreUri}
          invalid={isMetastoreUriEmpty}
          error={isMetastoreUriEmpty ? 'Hive Metastore URI is required' : null}
          helperText={
            !isMetastoreUriEmpty && isMetastoreUriInvalid ? (
              <span className="text-amber-400" role="alert">
                Warning: Hive Metastore URIs typically start with thrift://
              </span>
            ) : null
          }
          placeholder="thrift://localhost:9083"
          onChange={handleChange}
          mono={true}
        />

        <div className="grid grid-cols-2 gap-2">
          <PropertyField
            id="hcatSinkDatabase"
            name="database"
            label="Database"
            tooltip="Hive database name (withDatabase). Defaults to 'default' if omitted."
            value={database}
            onChange={handleChange}
            placeholder="default"
            mono={true}
          />
          <PropertyField
            id="hcatSinkTable"
            name="table"
            label="Table"
            required="Table is required"
            tooltip="Hive destination table name to write to (withTable). Table must already exist in HCatalog. Required."
            value={table}
            invalid={isTableEmpty}
            error={isTableEmpty ? 'Table is required' : null}
            placeholder="my_table"
            onChange={handleChange}
            mono={true}
          />
        </div>
      </div>

      {/* Partitions & Batching Card */}
      <div className="flex flex-col gap-3 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
        <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          <span>Partitions &amp; Batching</span>
          <InfoTooltip text="Static partition values and batch sizing for HCatalog writes." />
        </label>

        <PropertyField
          id="hcatSinkPartition"
          name="partition"
          label="Static Partition Key/Value Pairs"
          tooltip="Static partition key=value pairs (one per line, e.g. ds=2026-09-23) passed to withPartition(Map<String, String>). The target table must already be partitioned by these keys."
          type="textarea"
          rows={2}
          value={partition}
          onChange={handleChange}
          placeholder="ds=2026-09-23&#10;region=us"
          mono={true}
        />

        <PropertyField
          id="hcatSinkBatchSize"
          name="batchSize"
          label="Batch Size"
          type="number"
          tooltip="Number of records buffered before executing a batch commit to HCatalog (withBatchSize)."
          value={batchSize}
          onChange={handleChange}
          placeholder="1024"
          mono={true}
        />
      </div>

      {/* Additional Metastore Configuration Section */}
      <PropertyField
        id="hcatSinkConfigProperties"
        name="configProperties"
        label="Additional Metastore Configuration"
        tooltip="Custom key=value pairs (one per line) merged into the Hive configuration map passed to withConfigProperties(Map)."
        type="textarea"
        rows={3}
        value={configProperties}
        onChange={handleChange}
        placeholder="hive.metastore.client.socket.timeout=300&#10;hive.metastore.warehouse.dir=/user/hive/warehouse"
        mono={true}
      />

      {/* Authentication Section */}
      <div className="flex flex-col gap-2 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
        <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          <span>Authentication</span>
          <InfoTooltip text="Authentication strategy for connecting to the secure or insecure Hive Metastore service." />
        </label>
        <div className="flex gap-4 mt-1">
          <label className="flex items-center gap-1.5 cursor-pointer text-xs text-[var(--vscode-text-secondary)]">
            <input
              type="radio"
              name="authMode"
              value="simple"
              checked={authMode === 'simple'}
              onChange={handleChange}
              className="accent-[var(--vscode-highlight)]"
            />
            <span>Simple</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer text-xs text-[var(--vscode-text-secondary)]">
            <input
              type="radio"
              name="authMode"
              value="kerberos"
              checked={authMode === 'kerberos'}
              onChange={handleChange}
              className="accent-[var(--vscode-highlight)]"
            />
            <span>Kerberos</span>
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

        {authMode === 'kerberos' && (
          <div className="flex flex-col gap-3 mt-2 pl-2 border-l-2 border-[var(--vscode-highlight)]/50">
            <PropertyField
              id="hcatSinkKerberosPrincipal"
              name="kerberosPrincipal"
              label="Kerberos Principal"
              tooltip="Kerberos service principal name for the Hive Metastore (e.g. hive/_HOST@EXAMPLE.COM)."
              value={kerberosPrincipal}
              onChange={handleChange}
              placeholder="e.g. hive/metastore.example.com@EXAMPLE.COM"
              mono={true}
            />
            <PropertyField
              id="hcatSinkKeytabSecret"
              name="keytabSecret"
              label="Keytab Secret"
              tooltip="Secret Manager secret or file path containing the Kerberos keytab."
              value={keytabSecret}
              onChange={handleChange}
              list="hcatalog-sink-secret-options"
              datalist={secrets.map((s) => ({ value: s.id || s.name, label: s.name || s.id }))}
              placeholder="e.g. hive-metastore-keytab"
              mono={true}
            />
          </div>
        )}

        {authMode === 'secret_manager' && (
          <div className="flex flex-col gap-2 mt-2 pl-2 border-l-2 border-[var(--vscode-highlight)]/50">
            <PropertyField
              id="hcatSinkKeytabSecretDirect"
              name="keytabSecret"
              label="Secret Manager Secret Reference"
              tooltip="GCP Secret Manager secret containing authentication credentials or token."
              value={keytabSecret}
              onChange={handleChange}
              list="hcatalog-sink-secret-options"
              datalist={secrets.map((s) => ({ value: s.id || s.name, label: s.name || s.id }))}
              placeholder="e.g. hive-auth-credentials"
              error={secretError}
              invalid={!!secretError}
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

      {/* Collapsible Advanced Sink Settings */}
      <div className="flex flex-col border border-[var(--vscode-border-light)] rounded-md overflow-hidden">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center justify-between p-2 bg-[var(--vscode-subcard-bg)] text-xs font-bold uppercase text-[var(--vscode-text-muted)] hover:text-[var(--vscode-text-primary)] transition-colors cursor-pointer"
        >
          <span>Advanced Sink Settings</span>
          <span>{showAdvanced ? '▲' : '▼'}</span>
        </button>

        {showAdvanced && (
          <div className="p-3 bg-[var(--vscode-workbench-bg)] flex flex-col gap-3 border-t border-[var(--vscode-border-light)]">
            <PropertyField
              id="hcatSinkHiveSitePath"
              name="hiveSitePath"
              label="hive-site.xml Path"
              tooltip="Optional filesystem path to a custom hive-site.xml configuration file on the worker."
              value={hiveSitePath}
              onChange={handleChange}
              placeholder="/etc/hive/conf/hive-site.xml"
              mono={true}
            />

            <PropertyField
              id="hcatSinkClientTimeoutSeconds"
              name="clientTimeoutSeconds"
              label="Client Timeout (seconds)"
              type="number"
              tooltip="Thrift socket timeout in seconds for Hive Metastore client operations."
              value={clientTimeoutSeconds}
              onChange={handleChange}
              placeholder="120"
              mono={true}
            />

            <PropertyField
              id="hcatSinkCommitBehavior"
              name="commitBehavior"
              label="Commit Behavior"
              tooltip="Specifies partition commit strategy or staging directory cleanup upon write completion."
              value={commitBehavior}
              onChange={handleChange}
              placeholder="e.g. DIRECT_WRITE or STAGED"
              mono={true}
            />
          </div>
        )}
      </div>

      {/* Flexible Spacer */}
      <div className="flex-1 min-h-[16px]" />

      {/* Code Generation Instructions */}
      <PropertyField
        id="hcatSinkInstructions"
        name="system_instructions"
        label="Code Generation Instructions"
        tooltip="Optional custom prompt instructions passed to the LLM code generator when synthesizing HCatalogIO write pipeline transforms."
        type="textarea"
        rows={3}
        value={systemInstructions}
        onChange={handleInstructionsChange}
        placeholder="e.g. Write PCollection<HCatRecord> into partitioned table matching schema field order exactly"
        mono={true}
      />
    </div>
  );
};
