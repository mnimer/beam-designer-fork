/**
 * PulsarIOSinkProperties Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Renders the property configuration panel for Apache Beam PulsarIO Streaming Sink nodes.
 * Supports Apache Beam Java SDK PulsarIO.write() (withClientUrl, withTopic) and Python
 * Cross-Language API via the Java expansion service (WriteToPulsar).
 * 
 * Architectural Decisions:
 * - Broker connection and authentication configuration delegated to modular shared sub-components
 *   (PulsarConnectionFields, PulsarAuthFields) to preserve strict DRY principles and maintainable file sizes.
 * - Adopts shared ExpansionServiceFields primitive for uniform Python Cross-Language (x-lang) settings.
 * - Enforces topic validation against canonical Pulsar format (persistent://tenant/namespace/topic or non-persistent://).
 * - Queries the VS Code extension for Google Cloud Secret Manager secrets ('getSecrets').
 * - Exposes message serialization formats (String, ByteArray, Avro, JSON, Custom) and message partition key routing.
 * - Exposes producer tuning configurations (producerName, blockIfQueueFull, batchingEnabled, compressionType, messageRoutingMode).
 *   NOTE: In Apache Beam Java SDK org.apache.beam.sdk.io.pulsar.PulsarIO, the primary Beam builder methods are
 *   .withClientUrl() and .withTopic(); producer tuning options and client configs are passed through to the underlying
 *   Pulsar ProducerBuilder in generated pipeline code.
 * - Integrates InfoTooltip components linking field definitions to official Apache Beam documentation.
 * - Adheres strictly to the 8pt grid system for spacing and sizing.
 */

import React, { useState, useEffect } from 'react';
import { FileCode } from 'lucide-react';
import { InfoTooltip } from '../../components/InfoTooltip';
import { PropertyField } from '../../components/common/PropertyField';
import { ExpansionServiceFields } from '../../components/common/ExpansionServiceFields';
import { PulsarConnectionFields } from '../../components/common/pulsar/PulsarConnectionFields';
import { PulsarAuthFields } from '../../components/common/pulsar/PulsarAuthFields';
import type { PulsarAuthMode, SecretItem } from '../../components/common/pulsar/PulsarAuthFields';

export type { SecretItem, PulsarAuthMode };
export type PulsarValueType = 'String' | 'UTF8String' | 'ByteArray' | 'Avro' | 'JSON' | 'Protobuf';

export interface PulsarIOSinkPropertiesData {
  clientUrl?: string; topic?: string; authMode?: PulsarAuthMode;
  tokenSecretName?: string;
  oauthIssuerUrl?: string; oauthAudience?: string; oauthKeySecretName?: string;
  tlsCertSecretName?: string; tlsKeySecretName?: string; tlsTrustCertSecretName?: string;
  valueType?: PulsarValueType;
  expansionServiceMode?: 'auto' | 'endpoint'; expansionServiceEndpoint?: string;
  system_instructions?: string; special_instructions?: string;
  codeGenerationPrompt?: string; prompt?: string;
  [key: string]: any;
}

export interface PulsarIOSinkNode {
  data: {
    label: string;
    beam_transform?: string;
    system_instructions?: string;
    special_instructions?: string;
    properties?: PulsarIOSinkPropertiesData;
  };
}

export interface PulsarIOSinkPropertiesProps {
  node: PulsarIOSinkNode;
  onChange: (properties: any) => void;
}

// NOTE: Canonical regex validating Apache Pulsar persistent and non-persistent topic coordinates: (persistent|non-persistent)://tenant/namespace/topic
export const PULSAR_TOPIC_REGEX = /^(persistent|non-persistent):\/\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/;

/**
 * PulsarIOSinkProperties renders the configuration form for Pulsar streaming sink writes.
 * 
 * @param props Component properties containing the active node data and onChange callback.
 * @returns React component.
 */
export const PulsarIOSinkProperties: React.FC<PulsarIOSinkPropertiesProps> = ({ node, onChange }) => {
  const properties = node.data.properties || {};

  const { clientUrl = '', topic = '', authMode = 'none' } = properties;
  const { tokenSecretName = '', oauthIssuerUrl = '', oauthAudience = '' } = properties;
  const { oauthKeySecretName = '', tlsCertSecretName = '', tlsKeySecretName = '', tlsTrustCertSecretName = '' } = properties;
  const { valueType = 'String' } = properties;
  const { expansionServiceMode = 'auto', expansionServiceEndpoint = '' } = properties;

  const [secrets, setSecrets] = useState<SecretItem[]>([]);
  const [secretError, setSecretError] = useState<string | null>(null);
  const [isLoadingSecrets, setIsLoadingSecrets] = useState(false);

  const systemInstructions =
    node.data.system_instructions ?? node.data.special_instructions ??
    properties.system_instructions ?? properties.special_instructions ?? '';

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message?.command === 'secretsLoaded') {
        const raw = Array.isArray(message.secrets) ? message.secrets : [];
        const loaded: SecretItem[] = raw.map((s: any) => {
          if (typeof s === 'string') {
            const shortId = s.split('/').filter(Boolean).pop() || s;
            return { name: shortId, value: shortId };
          }
          const shortId = s.id || s.name || s.value || '';
          return { name: shortId, value: shortId, fullName: s.fullName };
        });
        setSecrets(loaded);
        setIsLoadingSecrets(false);
        setSecretError(message.error || null);
      }
    };

    window.addEventListener('message', handleMessage);
    const vscode = (window as any).vscode;
    if (vscode) {
      setIsLoadingSecrets(true);
      vscode.postMessage({ command: 'getSecrets' });
    }
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleRefreshSecrets = () => {
    const vscode = (window as any).vscode;
    if (vscode) {
      setIsLoadingSecrets(true);
      vscode.postMessage({ command: 'getSecrets' });
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const isCheckbox = type === 'checkbox';
    onChange({
      ...properties,
      [name]: isCheckbox ? (e.target as HTMLInputElement).checked : value
    });
  };

  const handlePropertyPatch = (name: string, value: any) => {
    onChange({ ...properties, [name]: value });
  };

  const handleInstructionsChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    onChange({ ...properties, system_instructions: e.target.value });
  };

  const isTopicMissing = !topic.trim();
  const isTopicFormatInvalid = !!topic.trim() && !PULSAR_TOPIC_REGEX.test(topic.trim());
  const topicError = isTopicMissing
    ? 'Pulsar destination topic is required.'
    : isTopicFormatInvalid
      ? 'Topic must follow format (persistent|non-persistent)://tenant/namespace/topic (e.g. persistent://public/default/my-topic).'
      : null;

  return (
    <div className="flex-1 flex flex-col gap-4">
      {/* 1. Broker Connection */}
      <PulsarConnectionFields
        idPrefix="pulsar-sink"
        clientUrl={clientUrl}
        showAdminUrl={false}
        direction="sink"
        onChange={handleChange}
        onPropertyChange={handlePropertyPatch}
      />

      {/* 2. Topic Configuration */}
      <PropertyField
        id="pulsar-sink-topic"
        name="topic"
        label="Destination Pulsar Topic"
        required="Pulsar destination topic is required."
        tooltip="Canonical Pulsar topic coordinates to publish to (e.g. persistent://public/default/alerts). Configured via PulsarIO.write().withTopic()."
        aria-required="true"
        aria-invalid={isTopicMissing || isTopicFormatInvalid}
        value={topic}
        onChange={handleChange}
        placeholder="persistent://public/default/alerts"
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
        idPrefix="pulsar-sink"
        authMode={authMode}
        tokenSecretName={tokenSecretName}
        oauthIssuerUrl={oauthIssuerUrl}
        oauthAudience={oauthAudience}
        oauthKeySecretName={oauthKeySecretName}
        tlsCertSecretName={tlsCertSecretName}
        tlsKeySecretName={tlsKeySecretName}
        tlsTrustCertSecretName={tlsTrustCertSecretName}
        secrets={secrets}
        secretError={secretError}
        isLoadingSecrets={isLoadingSecrets}
        onRefreshSecrets={handleRefreshSecrets}
        onChange={handleChange}
      />

      {/* 4. Serialization & Message Encoding */}
      <div className="p-3 bg-[#252836]/60 rounded border border-slate-700 flex flex-col gap-3">
        <span className="flex items-center text-xs font-bold uppercase text-slate-400 gap-1.5">
          <FileCode size={12} className="text-blue-400" />
          <span>Message Serialization</span>
        </span>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="pulsar-sink-value-type" className="flex items-center text-xs font-bold uppercase text-slate-500">
            <span>Message Payload Encoding</span>
            <InfoTooltip
              text="Format used to encode elements before sending them to Pulsar. Beam generated code formats elements into Pulsar byte[] payloads."
              position="auto"
            />
          </label>
          <select
            id="pulsar-sink-value-type"
            name="valueType"
            value={valueType}
            onChange={handleChange}
            className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
          >
            <option value="String">String (UTF-8)</option>
            <option value="ByteArray">Byte Array (byte[])</option>
            <option value="JSON">JSON Document</option>
            <option value="Avro">Apache Avro Schema</option>
            <option value="Protobuf">Protocol Buffers (Protobuf)</option>
          </select>
        </div>
      </div>

      {/* 5. Python Cross-Language (x-lang) Expansion Service */}
      <ExpansionServiceFields
        transformName="PulsarIO"
        idPrefix="pulsar-sink"
        mode={expansionServiceMode}
        endpoint={expansionServiceEndpoint}
        onChange={handleChange}
      />

      {/* Flexible Spacer */}
      <div className="flex-1 min-h-4" />

      {/* 6. Code Generation Instructions */}
      <div className="pt-2 border-t border-slate-700/60">
        <PropertyField
          id="pulsar-sink-instructions"
          name="system_instructions"
          label="Code Generation Instructions"
          tooltip="Custom instructions passed to the AI code generation model for this specific Pulsar Sink node (e.g. message serialization, dead-letter routing)."
          type="textarea"
          rows={3}
          value={systemInstructions}
          onChange={handleInstructionsChange}
          placeholder="e.g. Serialize POJO element to JSON bytes and publish to Pulsar."
          mono={false}
          className="resize-y"
        />
      </div>
    </div>
  );
};
