/**
 * CdapIOSinkProperties Component
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Renders the property configuration panel for Apache Beam CdapIO.write() Sink nodes.
 * Configures output writing to external services via CDAP (Cask Data Application Platform) BatchSink plugins.
 *
 * Architectural Decisions:
 * - Scoping & Beam SDK Mapping: Verified against Apache Beam CdapIO JavaDoc (org.apache.beam.sdk.io.cdap.CdapIO).
 *   CdapIO.write() configures a write transform consuming PCollection<KV<K, V>> via withCdapPluginClass(Class)
 *   or withCdapPlugin(Plugin), withPluginConfig(PluginConfig), withKeyClass(Class), withValueClass(Class),
 *   and withLocksDirPath(String).
 * - Mandatory Locks Directory: CDAP writes require Hadoop external synchronization locks to coordinate batch outputs.
 *   The locksDirPath property is strictly enforced as required.
 * - Plugin Paradigm: Parameters are supplied via key=value maps to instantiate the target plugin's PluginConfig.
 * - Dynamic discovery: Requests GCP Secret Manager secrets via 'getSecrets' IPC for credentials.
 * - Collapsible Advanced Sink Settings: Hadoop configuration overrides, batch size, and retry count.
 * - Preserves system_instructions / special_instructions fallback chain for LLM code generation.
 * - Follows the 8pt grid system and Tailwind CSS styling using VS Code theme tokens.
 */

import React, { useState } from 'react';
import { InfoTooltip } from '../../components/InfoTooltip';
import { PropertyField } from '../../components/common/PropertyField';
import { useAssetLoader } from '../../hooks/useAssetLoader';
import { normalizeSecretItem } from '../../components/common/SecretManagerAuthFields';
import type { SecretItem, CdapPluginType } from '../source/CdapIO';

export const CDAP_COMMON_SINK_PLUGINS = [
  {
    value: 'io.cdap.plugin.salesforce.plugin.sink.batch.SalesforceBatchSink',
    label: 'Salesforce Batch Sink'
  },
  {
    value: 'io.cdap.plugin.hubspot.sink.batch.HubspotBatchSink',
    label: 'HubSpot Batch Sink'
  },
  {
    value: 'io.cdap.plugin.servicenow.sink.ServiceNowSink',
    label: 'ServiceNow Batch Sink'
  },
  {
    value: 'io.cdap.plugin.zendesk.sink.batch.ZendeskBatchSink',
    label: 'Zendesk Batch Sink'
  }
];

export interface CdapIOSinkPropertiesProps {
  node: {
    data: {
      label?: string;
      beam_transform?: string;
      system_instructions?: string;
      special_instructions?: string;
      properties?: {
        pluginType?: CdapPluginType;
        cdapPluginClass?: string;
        pluginClass?: string;
        referenceName?: string;
        pluginConfig?: string;
        pluginConfigParams?: string;
        keyClass?: string;
        valueClass?: string;
        locksDirPath?: string;
        authMode?: 'none' | 'secret_manager';
        clientIdSecret?: string;
        clientSecretSecret?: string;
        tokenSecret?: string;
        hadoopConfig?: string;
        batchSize?: number | string;
        maxRetries?: number | string;
        retryCount?: number | string;
        system_instructions?: string;
        special_instructions?: string;
        [key: string]: any;
      };
    };
  };
  onChange: (properties: any) => void;
}

/**
 * Presentational component for CDAP sink plugin class, schema types, and locks directory.
 */
interface SinkPluginSectionProps {
  cdapPluginClass: string;
  referenceName: string;
  keyClass: string;
  valueClass: string;
  locksDirPath: string;
  isPluginClassEmpty: boolean;
  isKeyClassEmpty: boolean;
  isValueClassEmpty: boolean;
  isLocksDirEmpty: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}

const SinkPluginSection: React.FC<SinkPluginSectionProps> = ({
  cdapPluginClass,
  referenceName,
  keyClass,
  valueClass,
  locksDirPath,
  isPluginClassEmpty,
  isKeyClassEmpty,
  isValueClassEmpty,
  isLocksDirEmpty,
  onChange
}) => (
  <div className="flex flex-col gap-3 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
    <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
      <span>Sink Plugin &amp; Locks Directory</span>
      <InfoTooltip text="CDAP sink plugin class name, key/value record classes, and required Hadoop external locks path." />
    </label>

    <PropertyField
      id="cdapSinkPluginClass"
      name="cdapPluginClass"
      label="CDAP Plugin Class Name"
      required="CDAP plugin class name is required"
      tooltip="Fully-qualified class name of the CDAP BatchSink plugin."
      value={cdapPluginClass}
      invalid={isPluginClassEmpty}
      error={isPluginClassEmpty ? 'CDAP plugin class name is required' : null}
      placeholder="io.cdap.plugin.salesforce.plugin.sink.batch.SalesforceBatchSink"
      list="cdap-sink-plugin-classes"
      datalist={CDAP_COMMON_SINK_PLUGINS}
      onChange={onChange}
      mono={true}
    />

    <PropertyField
      id="cdapSinkReferenceName"
      name="referenceName"
      label="Reference Name"
      tooltip="Unique reference name required by CDAP plugins for dataset lineage identification."
      value={referenceName}
      onChange={onChange}
      placeholder="e.g. SalesforceAccountSink"
      mono={true}
    />

    <div className="grid grid-cols-2 gap-2">
      <PropertyField
        id="cdapSinkKeyClass"
        name="keyClass"
        label="Key Class"
        required="Key class is required"
        tooltip="Hadoop OutputFormat key class (e.g. org.apache.hadoop.io.NullWritable)."
        value={keyClass}
        invalid={isKeyClassEmpty}
        error={isKeyClassEmpty ? 'Key class is required' : null}
        placeholder="org.apache.hadoop.io.NullWritable"
        onChange={onChange}
        mono={true}
      />
      <PropertyField
        id="cdapSinkValueClass"
        name="valueClass"
        label="Value Class"
        required="Value class is required"
        tooltip="Hadoop OutputFormat value record class."
        value={valueClass}
        invalid={isValueClassEmpty}
        error={isValueClassEmpty ? 'Value class is required' : null}
        placeholder="org.apache.hadoop.io.Text"
        onChange={onChange}
        mono={true}
      />
    </div>

    <PropertyField
      id="cdapSinkLocksDirPath"
      name="locksDirPath"
      label="Locks Directory Path"
      required="Locks directory path is required for CDAP writes"
      tooltip="Mandatory directory path for CDAP Hadoop external synchronization locks during batch writing. Maps to withLocksDirPath(String)."
      value={locksDirPath}
      invalid={isLocksDirEmpty}
      error={isLocksDirEmpty ? 'Locks directory path is required for CDAP writes' : null}
      placeholder="gs://my-bucket/cdap-locks/ or /tmp/cdap-locks"
      onChange={onChange}
      mono={true}
    />
  </div>
);

/**
 * Presentational component for collapsible advanced sink settings.
 */
interface AdvancedSinkSectionProps {
  showAdvanced: boolean;
  onToggle: () => void;
  batchSize: number | string;
  maxRetries: number | string;
  hadoopConfig: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}

const AdvancedSinkSection: React.FC<AdvancedSinkSectionProps> = ({
  showAdvanced,
  onToggle,
  batchSize,
  maxRetries,
  hadoopConfig,
  onChange
}) => (
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
        <div className="grid grid-cols-2 gap-2">
          <PropertyField
            id="cdapSinkBatchSize"
            name="batchSize"
            label="Batch Size"
            type="number"
            tooltip="Number of records per output write batch."
            value={batchSize}
            onChange={onChange}
            placeholder="1000"
            mono={true}
          />
          <PropertyField
            id="cdapSinkMaxRetries"
            name="maxRetries"
            label="Max Retries"
            type="number"
            tooltip="Maximum retry attempts on transient output flush failures."
            value={maxRetries}
            onChange={onChange}
            placeholder="3"
            mono={true}
          />
        </div>

        <PropertyField
          id="cdapSinkHadoopConfig"
          name="hadoopConfig"
          label="Hadoop Configuration Overrides"
          type="textarea"
          rows={3}
          tooltip="Hadoop Configuration properties as key=value per line."
          value={hadoopConfig}
          onChange={onChange}
          placeholder="fs.defaultFS=hdfs://namenode:8020&#10;mapreduce.output.fileoutputformat.compress=false"
          mono={true}
        />
      </div>
    )}
  </div>
);

/**
 * CdapIOSinkProperties renders the configuration form for CdapIO.write() transforms.
 *
 * @param props - Component props containing active node data and onChange dispatch callback.
 */
export const CdapIOSinkProperties: React.FC<CdapIOSinkPropertiesProps> = ({ node, onChange }) => {
  const properties = node.data.properties || {};

  // Form field state extracted from node properties
  const pluginType = (properties.pluginType || 'batch') as CdapPluginType;
  const cdapPluginClass = properties.cdapPluginClass ?? properties.pluginClass ?? '';
  const referenceName = properties.referenceName ?? '';
  const pluginConfig = properties.pluginConfig ?? properties.pluginConfigParams ?? '';
  const keyClass = properties.keyClass ?? '';
  const valueClass = properties.valueClass ?? '';
  const locksDirPath = properties.locksDirPath ?? '';
  const authMode = properties.authMode ?? 'none';
  const clientIdSecret = properties.clientIdSecret ?? '';
  const clientSecretSecret = properties.clientSecretSecret ?? '';
  const tokenSecret = properties.tokenSecret ?? '';
  const hadoopConfig = properties.hadoopConfig ?? '';
  const batchSize = properties.batchSize ?? '';
  const maxRetries = properties.maxRetries ?? properties.retryCount ?? '';

  // Local UI state
  const { items: rawSecrets, error: secretError } = useAssetLoader<SecretItem | string>('secrets');
  const secrets: SecretItem[] = (rawSecrets || []).map(normalizeSecretItem);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Field validation
  const isPluginClassEmpty = !String(cdapPluginClass).trim();
  const isKeyClassEmpty = !String(keyClass).trim();
  const isValueClassEmpty = !String(valueClass).trim();
  const isLocksDirEmpty = !String(locksDirPath).trim();

  // NOTE: Fallback chain for system instructions per architecture spec
  const systemInstructions =
    node.data.system_instructions ??
    node.data.special_instructions ??
    properties.system_instructions ??
    properties.special_instructions ??
    '';

  /**
   * Updates a single property key and invokes onChange while pruning legacy alias keys.
   *
   * @param name - The property field name to update.
   * @param value - The new value for the property.
   */
  const updateProperty = (name: string, value: any) => {
    const updated = { ...properties, [name]: value };
    if (name === 'cdapPluginClass') {
      delete updated.pluginClass;
    } else if (name === 'pluginConfig') {
      delete updated.pluginConfigParams;
    } else if (name === 'maxRetries') {
      delete updated.retryCount;
    }
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

  /**
   * Handles system instructions change.
   *
   * @param e - Textarea change event.
   */
  const handleInstructionsChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    onChange({
      ...properties,
      system_instructions: e.target.value
    });
  };

  return (
    <div className="flex-1 flex flex-col gap-4 text-[var(--vscode-text-primary)] text-sm">
      {/* Plugin Type Selector */}
      <div className="flex flex-col gap-2 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
        <label
          htmlFor="cdapSinkPluginType"
          className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]"
        >
          <span>Plugin Type</span>
          <InfoTooltip text="CDAP sink plugins operate in batch mode (BatchSink)." />
        </label>
        <select
          id="cdapSinkPluginType"
          name="pluginType"
          value={pluginType}
          onChange={handleChange}
          className="bg-[var(--vscode-input-bg)] text-[var(--vscode-text-primary)] p-2 rounded border border-[var(--vscode-border)] text-xs focus:outline-none focus:border-[var(--vscode-highlight)]"
        >
          <option value="batch">Batch Plugin (BatchSink)</option>
        </select>
      </div>

      {/* Sink Plugin Specification & Locks Directory */}
      <SinkPluginSection
        cdapPluginClass={cdapPluginClass}
        referenceName={referenceName}
        keyClass={keyClass}
        valueClass={valueClass}
        locksDirPath={locksDirPath}
        isPluginClassEmpty={isPluginClassEmpty}
        isKeyClassEmpty={isKeyClassEmpty}
        isValueClassEmpty={isValueClassEmpty}
        isLocksDirEmpty={isLocksDirEmpty}
        onChange={handleChange}
      />

      {/* Plugin Configuration Parameters */}
      <div className="flex flex-col gap-3 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
        <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          <span>Plugin Configuration (PluginConfig)</span>
          <InfoTooltip text="Parameters passed to the CDAP PluginConfig class as key=value pairs per line." />
        </label>

        <PropertyField
          id="cdapSinkPluginConfig"
          name="pluginConfig"
          label="Configuration Parameters"
          type="textarea"
          rows={4}
          tooltip="Plugin-specific configuration properties (e.g. sObject=Account, operation=insert)."
          value={pluginConfig}
          onChange={handleChange}
          placeholder="consumerKey=my-consumer-key&#10;loginUrl=https://login.salesforce.com&#10;sObject=Account&#10;operation=insert"
          mono={true}
        />
      </div>

      {/* Authentication */}
      <div className="flex flex-col gap-2 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
        <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          <span>Plugin Authentication</span>
          <InfoTooltip text="Credentials for the external destination service accessed by the CDAP sink plugin." />
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
              id="cdapSinkClientIdSecret"
              name="clientIdSecret"
              label="Client ID Secret"
              tooltip="Secret Manager secret containing the client ID / consumer key."
              value={clientIdSecret}
              onChange={handleChange}
              list="cdap-sink-secret-options"
              datalist={secrets.map((s) => ({ value: s.id || s.name, label: s.name || s.id }))}
              placeholder="e.g. salesforce-client-id"
              mono={true}
            />
            <PropertyField
              id="cdapSinkClientSecretSecret"
              name="clientSecretSecret"
              label="Client Secret Secret"
              tooltip="Secret Manager secret containing the client secret."
              value={clientSecretSecret}
              onChange={handleChange}
              list="cdap-sink-secret-options"
              datalist={secrets.map((s) => ({ value: s.id || s.name, label: s.name || s.id }))}
              placeholder="e.g. salesforce-client-secret"
              mono={true}
            />
            <PropertyField
              id="cdapSinkTokenSecret"
              name="tokenSecret"
              label="Access / Refresh Token Secret"
              tooltip="Secret Manager secret containing the API token or refresh token."
              value={tokenSecret}
              onChange={handleChange}
              list="cdap-sink-secret-options"
              datalist={secrets.map((s) => ({ value: s.id || s.name, label: s.name || s.id }))}
              placeholder="e.g. salesforce-refresh-token"
              mono={true}
            />
          </div>
        )}
      </div>

      {/* Advanced Sink Settings */}
      <AdvancedSinkSection
        showAdvanced={showAdvanced}
        onToggle={() => setShowAdvanced(!showAdvanced)}
        batchSize={batchSize}
        maxRetries={maxRetries}
        hadoopConfig={hadoopConfig}
        onChange={handleChange}
      />

      {/* Flexible Spacer */}
      <div className="flex-1 min-h-[16px]" />

      {/* Code Generation Instructions */}
      <PropertyField
        id="cdapSinkInstructions"
        name="system_instructions"
        label="Code Generation Instructions"
        tooltip="Optional instructions passed to LLM code generator when synthesizing CDAP write pipelines. Note: withLocksDirPath is mandatory."
        type="textarea"
        rows={3}
        value={systemInstructions}
        onChange={handleInstructionsChange}
        placeholder="e.g. Write elements using CdapIO.write() with withLocksDirPath(locksPath) consuming PCollection<KV<NullWritable, SalesforceRecord>>"
        mono={true}
      />
    </div>
  );
};
