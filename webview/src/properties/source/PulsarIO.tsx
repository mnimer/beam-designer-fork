/**
 * PulsarIOSourceProperties Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Renders the property configuration panel for Apache Beam PulsarIO Streaming Source nodes.
 * Supports Apache Beam Java SDK PulsarIO.read() (withClientUrl, withAdminUrl, withTopic,
 * withStartTimestamp, withEndTimestamp, withPublishTime) emitting PCollection<PulsarMessage>,
 * and Python Cross-Language API via the Java expansion service (ReadFromPulsar).
 * 
 * Architectural Decisions:
 * - Broker connection and authentication configuration delegated to modular shared sub-components
 *   (PulsarConnectionFields, PulsarAuthFields) to preserve strict DRY principles and maintainable file sizes.
 * - Adopts shared ExpansionServiceFields primitive for uniform Python Cross-Language (x-lang) settings.
 * - Enforces topic validation against canonical Pulsar format (persistent://tenant/namespace/topic or non-persistent://).
 * - Queries the VS Code extension for Google Cloud Secret Manager secrets ('getSecrets').
 * - Supports message timestamp policy configuration: Publish Time (withPublishTime) vs processing time, plus epoch timestamp ranges.
 * - Supports bounded stream limits (maxNumRecords, maxReadTime) for hybrid testing and batch execution.
 * - Integrates InfoTooltip components linking field definitions to official Apache Beam documentation.
 * - Adheres strictly to the 8pt grid system for spacing and sizing.
 */

import React from 'react';
import { Layers } from 'lucide-react';
import { InfoTooltip } from '../../components/InfoTooltip';
import { PropertyField } from '../../components/common/PropertyField';
import { SystemInstructionsField } from '../../components/common/SystemInstructionsField';
import { resolveSystemInstructions } from '../../utils/systemInstructions';
import { ExpansionServiceFields } from '../../components/common/ExpansionServiceFields';
import { PulsarConnectionFields } from '../../components/common/pulsar/PulsarConnectionFields';
import { PulsarAuthFields } from '../../components/common/pulsar/PulsarAuthFields';
import type { PulsarAuthMode, SecretItem } from '../../components/common/pulsar/PulsarAuthFields';
import { useNodeProperties } from '../../hooks/useNodeProperties';
import { useSecretOptions } from '../../hooks/useSecretOptions';

export type { SecretItem, PulsarAuthMode };

/** Persisted configuration properties for the Apache Pulsar source node. */
export interface PulsarIOSourcePropertiesData {
  clientUrl?: string;
  adminUrl?: string;
  topic?: string;
  authMode?: PulsarAuthMode;
  tokenSecretName?: string;
  oauthIssuerUrl?: string;
  oauthAudience?: string;
  oauthKeySecretName?: string;
  tlsCertSecretName?: string;
  tlsKeySecretName?: string;
  tlsTrustCertSecretName?: string;
  timestampType?: 'publishTime' | 'processingTime';
  consumerPollingTimeout?: string | number;
  startTimestamp?: string | number;
  endTimestamp?: string | number;
  expansionServiceMode?: 'auto' | 'endpoint';
  expansionServiceEndpoint?: string;
  system_instructions?: string;
  special_instructions?: string;
  codeGenerationPrompt?: string;
  prompt?: string;
  [key: string]: any;
}

/** React Flow node shape for the PulsarIO source panel, including its persisted configuration data. */
export interface PulsarIOSourceNode {
  data: {
    label: string;
    beam_transform?: string;
    system_instructions?: string;
    special_instructions?: string;
    properties?: PulsarIOSourcePropertiesData;
  };
}

/** Props for the {@link PulsarIOSourceProperties} component. */
export interface PulsarIOSourcePropertiesProps {
  node: PulsarIOSourceNode;
  onChange: (properties: any) => void;
}

// NOTE: Canonical regex validating Apache Pulsar persistent and non-persistent topic coordinates: (persistent|non-persistent)://tenant/namespace/topic
export const PULSAR_TOPIC_REGEX = /^(persistent|non-persistent):\/\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/;

/**
 * PulsarIOSourceProperties renders the configuration form for Pulsar streaming source reads.
 * 
 * @param props Component properties containing the active node data and onChange callback.
 * @returns React component.
 */
export const PulsarIOSourceProperties: React.FC<PulsarIOSourcePropertiesProps> = ({ node, onChange }) => {
  const { properties, handleChange } = useNodeProperties<PulsarIOSourcePropertiesData>(node, onChange);

  const clientUrl = properties.clientUrl || '';
  const adminUrl = properties.adminUrl || '';
  const topic = properties.topic || '';
  const authMode = properties.authMode || 'none';
  const tokenSecretName = properties.tokenSecretName || '';
  const oauthIssuerUrl = properties.oauthIssuerUrl || '';
  const oauthAudience = properties.oauthAudience || '';
  const oauthKeySecretName = properties.oauthKeySecretName || '';
  const tlsCertSecretName = properties.tlsCertSecretName || '';
  const tlsKeySecretName = properties.tlsKeySecretName || '';
  const tlsTrustCertSecretName = properties.tlsTrustCertSecretName || '';
  const timestampType = properties.timestampType || 'publishTime';
  const consumerPollingTimeout = properties.consumerPollingTimeout ?? '';
  const startTimestamp = properties.startTimestamp ?? '';
  const endTimestamp = properties.endTimestamp ?? '';
  const expansionServiceMode = properties.expansionServiceMode || 'auto';
  const expansionServiceEndpoint = properties.expansionServiceEndpoint || '';

  const secrets = useSecretOptions();

  const systemInstructions = resolveSystemInstructions(node);

  const handlePropertyPatch = (name: string, value: any) => {
    onChange({ ...properties, [name]: value });
  };

  const isTopicMissing = !topic.trim();
  const isTopicFormatInvalid = !!topic.trim() && !PULSAR_TOPIC_REGEX.test(topic.trim());
  const topicError = isTopicMissing
    ? 'Pulsar topic name is required.'
    : isTopicFormatInvalid
      ? 'Topic must follow format (persistent|non-persistent)://tenant/namespace/topic (e.g. persistent://public/default/my-topic).'
      : null;

  return (
    <div className="flex-1 flex flex-col gap-4">
      {/* 1. Broker & Admin Connection */}
      <PulsarConnectionFields
        idPrefix="pulsar"
        clientUrl={clientUrl}
        adminUrl={adminUrl}
        direction="source"
        onChange={handleChange}
        onPropertyChange={handlePropertyPatch}
      />

      {/* 2. Topic Configuration */}
      <PropertyField
        id="pulsar-topic"
        name="topic"
        label="Pulsar Topic"
        required="Pulsar topic name is required."
        tooltip="Canonical topic coordinates (e.g. persistent://public/default/telemetry). Validated against persistent:// or non-persistent:// format. Configured via PulsarIO.read().withTopic()."
        aria-required="true"
        aria-invalid={isTopicMissing || isTopicFormatInvalid}
        value={topic}
        onChange={handleChange}
        placeholder="persistent://public/default/telemetry"
        invalid={isTopicMissing || isTopicFormatInvalid}
        error={topicError}
        mono={true}
        helperText={
          !isTopicMissing && !isTopicFormatInvalid ? (
            <span>
              Pulsar topic format: <code className="text-slate-300 bg-slate-800/60 px-1 py-0.5 rounded font-mono">persistent://tenant/namespace/topic</code>
            </span>
          ) : null
        }
      />

      {/* 3. Authentication & Credentials */}
      <PulsarAuthFields
        idPrefix="pulsar"
        authMode={authMode}
        tokenSecretName={tokenSecretName}
        oauthIssuerUrl={oauthIssuerUrl}
        oauthAudience={oauthAudience}
        oauthKeySecretName={oauthKeySecretName}
        tlsCertSecretName={tlsCertSecretName}
        tlsKeySecretName={tlsKeySecretName}
        tlsTrustCertSecretName={tlsTrustCertSecretName}
        secrets={secrets.secrets.map((s) => ({ name: s.id, value: s.id, id: s.id, fullName: s.fullName }))}
        secretError={secrets.error}
        isLoadingSecrets={secrets.loading}
        onRefreshSecrets={secrets.refresh}
        onChange={handleChange}
      />

      {/* 4. Timestamp & Consumer Polling Configuration */}
      <div className="p-3 bg-[#252836]/60 rounded border border-slate-700 flex flex-col gap-3">
        <span className="flex items-center text-xs font-bold uppercase text-slate-400 gap-1.5">
          <Layers size={12} className="text-blue-400" />
          <span>Timestamp & Consumer Polling</span>
        </span>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="pulsar-timestamp-type" className="flex items-center text-xs font-bold uppercase text-slate-500">
            <span>Element Timestamp Policy</span>
            <InfoTooltip
              text="Determines how Beam assigns element timestamps. Publish Time assigns when the message was published to Pulsar (.withPublishTime()); Processing Time assigns pipeline ingestion time (.withProcessingTime())."
              position="auto"
            />
          </label>
          <select
            id="pulsar-timestamp-type"
            name="timestampType"
            value={timestampType}
            onChange={handleChange}
            className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
          >
            <option value="publishTime">Publish Time (Beam Default)</option>
            <option value="processingTime">Processing Time</option>
          </select>
          <p className="text-xs text-slate-400">
            {timestampType === 'publishTime'
              ? 'Calls PulsarIO.read().withPublishTime() to use message publication epoch timestamp for windowing.'
              : 'Calls PulsarIO.read().withProcessingTime() to use pipeline processing timestamp.'}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-700/60">
          <PropertyField
            id="pulsar-start-timestamp"
            type="number"
            min="0"
            name="startTimestamp"
            label="Start Timestamp (ms)"
            tooltip="Filter messages starting at this epoch timestamp in milliseconds. Configured via PulsarIO.read().withStartTimestamp(long)."
            value={startTimestamp}
            onChange={handleChange}
            placeholder="e.g. 1695400000000"
            mono={true}
          />
          <PropertyField
            id="pulsar-end-timestamp"
            type="number"
            min="0"
            name="endTimestamp"
            label="End Timestamp (ms)"
            tooltip="Filter messages up to this epoch timestamp in milliseconds. Configured via PulsarIO.read().withEndTimestamp(long)."
            value={endTimestamp}
            onChange={handleChange}
            placeholder="e.g. 1695486400000"
            mono={true}
          />
        </div>

        <div className="pt-2 border-t border-slate-700/40">
          <PropertyField
            id="pulsar-consumer-polling-timeout"
            type="number"
            min="1"
            name="consumerPollingTimeout"
            label="Consumer Polling Timeout (s)"
            tooltip="Timeout in seconds for Pulsar consumer polling request (calls withConsumerPollingTimeout(long), default: 2)."
            helperText="Timeout in seconds for Pulsar consumer polling request (calls withConsumerPollingTimeout(long), default: 2)."
            value={consumerPollingTimeout}
            onChange={handleChange}
            placeholder="2"
            mono={true}
          />
        </div>
      </div>

      {/* 5. Python Cross-Language (x-lang) Expansion Service */}
      <ExpansionServiceFields
        transformName="PulsarIO"
        idPrefix="pulsar-source"
        mode={expansionServiceMode}
        endpoint={expansionServiceEndpoint}
        onChange={handleChange}
      />

      {/* 6. Code Generation Instructions */}
      <SystemInstructionsField
        id="pulsar-instructions"
        value={systemInstructions}
        tooltip="Custom instructions passed to the AI code generation model for this specific Pulsar Source node (e.g. custom deserializer, message routing, dead-letter queue handling)."
        placeholder="e.g. Parse PulsarMessage payload as UTF-8 JSON, extract event timestamp from metadata, and route malformed records to DLQ."
        wrapperClassName="pt-2 border-t border-slate-700/60"
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
