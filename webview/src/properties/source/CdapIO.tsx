/**
 * CdapIOSourceProperties Component
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Renders the property configuration panel for Apache Beam CdapIO.read() Source nodes.
 * Configures ingestion from CDAP (Cask Data Application Platform) plugins such as Salesforce,
 * Hubspot, ServiceNow, Zendesk, and Jira into Beam pipelines.
 *
 * Architectural Decisions:
 * - Scoping & Beam SDK Mapping: Verified against Apache Beam CdapIO JavaDoc
 *   (org.apache.beam.sdk.io.cdap.CdapIO). CdapIO is a bidirectional connector wrapping CDAP plugins.
 *   CdapIO.read() constructs an ingestion transform using withCdapPluginClass(Class) or withCdapPlugin(Plugin),
 *   withPluginConfig(PluginConfig), withKeyClass(Class), and withValueClass(Class).
 * - Plugin Paradigm: CDAP plugins instantiate their configuration via key=value parameter maps
 *   (PluginConfigInstantiationUtils). The panel provides an open key=value configuration editor
 *   alongside common Beam-tested CDAP plugin suggestions.
 * - Plugin Type Toggle: Distinguishes Batch plugins (BatchSource) from Streaming plugins (StreamingSource).
 * - Element Contract: Outputs a PCollection<KV<K, V>> where K and V match the declared keyClass and valueClass.
 * - Real-time validation: Requires CDAP plugin class name, key class, and value class.
 * - Dynamic discovery: Requests GCP Secret Manager secrets via 'getSecrets' IPC for credentials.
 * - Collapsible Advanced Source Settings: Hadoop configuration overrides, streaming pull frequency, start offset, max records.
 * - Preserves system_instructions / special_instructions fallback chain for LLM code generation.
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

export type CdapPluginType = 'batch' | 'streaming';

export const CDAP_COMMON_SOURCE_PLUGINS = [
  {
    value: 'io.cdap.plugin.salesforce.plugin.source.batch.SalesforceBatchSource',
    label: 'Salesforce Batch Source'
  },
  {
    value: 'io.cdap.plugin.hubspot.source.batch.HubspotBatchSource',
    label: 'HubSpot Batch Source'
  },
  {
    value: 'io.cdap.plugin.servicenow.source.ServiceNowSource',
    label: 'ServiceNow Batch Source'
  },
  {
    value: 'io.cdap.plugin.zendesk.source.batch.ZendeskBatchSource',
    label: 'Zendesk Batch Source'
  },
  {
    value: 'io.cdap.plugin.jira.source.batch.JiraBatchSource',
    label: 'Jira Batch Source'
  }
];

export interface CdapIOSourcePropertiesProps {
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
        authMode?: 'none' | 'secret_manager';
        clientIdSecret?: string;
        clientSecretSecret?: string;
        tokenSecret?: string;
        hadoopConfig?: string;
        pullFrequency?: number | string;
        startOffset?: number | string;
        maxRecords?: number | string;
        system_instructions?: string;
        special_instructions?: string;
        [key: string]: any;
      };
    };
  };
  onChange: (properties: any) => void;
}

/**
 * Presentational component for CDAP source plugin details and key/value class specifications.
 */
interface PluginClassSectionProps {
  cdapPluginClass: string;
  referenceName: string;
  keyClass: string;
  valueClass: string;
  isPluginClassEmpty: boolean;
  isKeyClassEmpty: boolean;
  isValueClassEmpty: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}

const PluginClassSection: React.FC<PluginClassSectionProps> = ({
  cdapPluginClass,
  referenceName,
  keyClass,
  valueClass,
  isPluginClassEmpty,
  isKeyClassEmpty,
  isValueClassEmpty,
  onChange
}) => (
  <div className="flex flex-col gap-3 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
    <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
      <span>Plugin Specification &amp; Schema Types</span>
      <InfoTooltip text="CDAP plugin class name and Hadoop InputFormat key/value classes emitted as KV<K, V>." />
    </label>

    <PropertyField
      id="cdapSourcePluginClass"
      name="cdapPluginClass"
      label="CDAP Plugin Class Name"
      required="CDAP plugin class name is required"
      tooltip="Fully-qualified class name of the CDAP Source plugin."
      value={cdapPluginClass}
      invalid={isPluginClassEmpty}
      error={isPluginClassEmpty ? 'CDAP plugin class name is required' : null}
      placeholder="io.cdap.plugin.salesforce.plugin.source.batch.SalesforceBatchSource"
      list="cdap-source-plugin-classes"
      datalist={CDAP_COMMON_SOURCE_PLUGINS}
      onChange={onChange}
      mono={true}
    />

    <PropertyField
      id="cdapSourceReferenceName"
      name="referenceName"
      label="Reference Name"
      tooltip="Unique reference name required by CDAP plugins for dataset identification and metadata lineage."
      value={referenceName}
      onChange={onChange}
      placeholder="e.g. SalesforceAccountSource"
      mono={true}
    />

    <div className="grid grid-cols-2 gap-2">
      <PropertyField
        id="cdapSourceKeyClass"
        name="keyClass"
        label="Key Class"
        required="Key class is required"
        tooltip="Hadoop InputFormat key class (e.g. org.apache.hadoop.io.NullWritable)."
        value={keyClass}
        invalid={isKeyClassEmpty}
        error={isKeyClassEmpty ? 'Key class is required' : null}
        placeholder="org.apache.hadoop.io.NullWritable"
        onChange={onChange}
        mono={true}
      />
      <PropertyField
        id="cdapSourceValueClass"
        name="valueClass"
        label="Value Class"
        required="Value class is required"
        tooltip="Hadoop InputFormat value record class."
        value={valueClass}
        invalid={isValueClassEmpty}
        error={isValueClassEmpty ? 'Value class is required' : null}
        placeholder="org.apache.hadoop.io.Text"
        onChange={onChange}
        mono={true}
      />
    </div>
  </div>
);

/**
 * Presentational component for collapsible advanced source settings.
 */
interface AdvancedSourceSectionProps {
  showAdvanced: boolean;
  onToggle: () => void;
  pluginType: CdapPluginType;
  pullFrequency: number | string;
  startOffset: number | string;
  maxRecords: number | string;
  hadoopConfig: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}

const AdvancedSourceSection: React.FC<AdvancedSourceSectionProps> = ({
  showAdvanced,
  onToggle,
  pluginType,
  pullFrequency,
  startOffset,
  maxRecords,
  hadoopConfig,
  onChange
}) => (
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
        {pluginType === 'streaming' && (
          <PropertyField
            id="cdapSourcePullFrequency"
            name="pullFrequency"
            label="Pull Frequency (s)"
            type="number"
            tooltip="Streaming pull frequency in seconds for streaming plugins."
            value={pullFrequency}
            onChange={onChange}
            placeholder="60"
            mono={true}
          />
        )}

        <div className="grid grid-cols-2 gap-2">
          <PropertyField
            id="cdapSourceStartOffset"
            name="startOffset"
            label="Start Offset"
            type="number"
            tooltip="Initial record or partition offset for plugin reading."
            value={startOffset}
            onChange={onChange}
            placeholder="0"
            mono={true}
          />
          <PropertyField
            id="cdapSourceMaxRecords"
            name="maxRecords"
            label="Max Records"
            type="number"
            tooltip="Bounded reading limit for records."
            value={maxRecords}
            onChange={onChange}
            placeholder="Unlimited"
            mono={true}
          />
        </div>

        <PropertyField
          id="cdapSourceHadoopConfig"
          name="hadoopConfig"
          label="Hadoop Configuration Overrides"
          type="textarea"
          rows={3}
          tooltip="Hadoop Configuration properties as key=value per line."
          value={hadoopConfig}
          onChange={onChange}
          placeholder="fs.defaultFS=hdfs://namenode:8020&#10;mapreduce.input.fileinputformat.split.minsize=1048576"
          mono={true}
        />
      </div>
    )}
  </div>
);

/**
 * CdapIOSourceProperties renders the configuration form for CdapIO.read() transforms.
 *
 * @param props - Component props containing active node data and onChange dispatch callback.
 */
export const CdapIOSourceProperties: React.FC<CdapIOSourcePropertiesProps> = ({ node, onChange }) => {
  const properties = node.data.properties || {};

  // Form field state extracted from node properties
  const pluginType = (properties.pluginType || 'batch') as CdapPluginType;
  const cdapPluginClass = properties.cdapPluginClass ?? properties.pluginClass ?? '';
  const referenceName = properties.referenceName ?? '';
  const pluginConfig = properties.pluginConfig ?? properties.pluginConfigParams ?? '';
  const keyClass = properties.keyClass ?? '';
  const valueClass = properties.valueClass ?? '';
  const authMode = properties.authMode ?? 'none';
  const clientIdSecret = properties.clientIdSecret ?? '';
  const clientSecretSecret = properties.clientSecretSecret ?? '';
  const tokenSecret = properties.tokenSecret ?? '';
  const hadoopConfig = properties.hadoopConfig ?? '';
  const pullFrequency = properties.pullFrequency ?? '';
  const startOffset = properties.startOffset ?? '';
  const maxRecords = properties.maxRecords ?? '';

  // Local UI state
  const { items: rawSecrets, error: secretError } = useAssetLoader<SecretItem | string>('secrets');
  const secrets: SecretItem[] = (rawSecrets || []).map(normalizeSecretItem);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Field validation
  const isPluginClassEmpty = !String(cdapPluginClass).trim();
  const isKeyClassEmpty = !String(keyClass).trim();
  const isValueClassEmpty = !String(valueClass).trim();

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
    // NOTE: Controlled update creating new properties object while pruning aliases
    const updated = { ...properties, [name]: value };
    if (name === 'cdapPluginClass') {
      delete updated.pluginClass;
    } else if (name === 'pluginConfig') {
      delete updated.pluginConfigParams;
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
          htmlFor="cdapSourcePluginType"
          className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]"
        >
          <span>Plugin Type</span>
          <InfoTooltip text="CDAP source plugin execution model: BatchSource (batch execution) or StreamingSource (streaming ingestion)." />
        </label>
        <select
          id="cdapSourcePluginType"
          name="pluginType"
          value={pluginType}
          onChange={handleChange}
          className="bg-[var(--vscode-input-bg)] text-[var(--vscode-text-primary)] p-2 rounded border border-[var(--vscode-border)] text-xs focus:outline-none focus:border-[var(--vscode-highlight)]"
        >
          <option value="batch">Batch Plugin (BatchSource)</option>
          <option value="streaming">Streaming Plugin (StreamingSource)</option>
        </select>
      </div>

      {/* Plugin Class & Schema Types */}
      <PluginClassSection
        cdapPluginClass={cdapPluginClass}
        referenceName={referenceName}
        keyClass={keyClass}
        valueClass={valueClass}
        isPluginClassEmpty={isPluginClassEmpty}
        isKeyClassEmpty={isKeyClassEmpty}
        isValueClassEmpty={isValueClassEmpty}
        onChange={handleChange}
      />

      {/* Plugin Configuration Parameters */}
      <div className="flex flex-col gap-3 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
        <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          <span>Plugin Configuration (PluginConfig)</span>
          <InfoTooltip text="Parameters passed to the CDAP PluginConfig class as key=value pairs per line." />
        </label>

        <PropertyField
          id="cdapSourcePluginConfig"
          name="pluginConfig"
          label="Configuration Parameters"
          type="textarea"
          rows={4}
          tooltip="Plugin-specific configuration properties (e.g. consumerKey=xyz, loginUrl=https://login.salesforce.com)."
          value={pluginConfig}
          onChange={handleChange}
          placeholder="consumerKey=my-consumer-key&#10;loginUrl=https://login.salesforce.com&#10;query=SELECT Id, Name FROM Account"
          mono={true}
        />
      </div>

      {/* Authentication */}
      <div className="flex flex-col gap-2 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
        <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          <span>Plugin Authentication</span>
          <InfoTooltip text="Credentials for the external service accessed by the CDAP plugin (OAuth client ID/secret or tokens)." />
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
              id="cdapSourceClientIdSecret"
              name="clientIdSecret"
              label="Client ID Secret"
              tooltip="Secret Manager secret containing the client ID / consumer key."
              value={clientIdSecret}
              onChange={handleChange}
              list="cdap-source-secret-options"
              datalist={secrets.map((s) => ({ value: s.id || s.name, label: s.name || s.id }))}
              placeholder="e.g. salesforce-client-id"
              mono={true}
            />
            <PropertyField
              id="cdapSourceClientSecretSecret"
              name="clientSecretSecret"
              label="Client Secret Secret"
              tooltip="Secret Manager secret containing the client secret."
              value={clientSecretSecret}
              onChange={handleChange}
              list="cdap-source-secret-options"
              datalist={secrets.map((s) => ({ value: s.id || s.name, label: s.name || s.id }))}
              placeholder="e.g. salesforce-client-secret"
              mono={true}
            />
            <PropertyField
              id="cdapSourceTokenSecret"
              name="tokenSecret"
              label="Access / Refresh Token Secret"
              tooltip="Secret Manager secret containing the API token or refresh token."
              value={tokenSecret}
              onChange={handleChange}
              list="cdap-source-secret-options"
              datalist={secrets.map((s) => ({ value: s.id || s.name, label: s.name || s.id }))}
              placeholder="e.g. salesforce-refresh-token"
              mono={true}
            />
          </div>
        )}
      </div>

      {/* Advanced Source Settings */}
      <AdvancedSourceSection
        showAdvanced={showAdvanced}
        onToggle={() => setShowAdvanced(!showAdvanced)}
        pluginType={pluginType}
        pullFrequency={pullFrequency}
        startOffset={startOffset}
        maxRecords={maxRecords}
        hadoopConfig={hadoopConfig}
        onChange={handleChange}
      />

      {/* Flexible Spacer */}
      <div className="flex-1 min-h-[16px]" />

      {/* Code Generation Instructions */}
      <PropertyField
        id="cdapSourceInstructions"
        name="system_instructions"
        label="Code Generation Instructions"
        tooltip="Optional instructions passed to LLM code generator when synthesizing CDAP ingestion pipelines."
        type="textarea"
        rows={3}
        value={systemInstructions}
        onChange={handleInstructionsChange}
        placeholder="e.g. Ingest Salesforce accounts using CdapIO.read() producing PCollection<KV<NullWritable, SalesforceRecord>>"
        mono={true}
      />
    </div>
  );
};
