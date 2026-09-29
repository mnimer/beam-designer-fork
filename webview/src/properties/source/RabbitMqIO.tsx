/**
 * RabbitMqIOSourceProperties Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Renders the property configuration panel for Apache Beam RabbitMqIO Streaming Source nodes.
 * Supports Apache Beam Java SDK (org.apache.beam.sdk.io.rabbitmq.RabbitMqIO) reading from RabbitMQ
 * via RabbitMqIO.read() emitting PCollection<RabbitMqMessage>, and Python pipelines via Apache Beam
 * Cross-Language (x-lang) Java expansion service (apache_beam.transforms.external).
 * 
 * Architectural Decisions:
 * - AMQP Connection URI security: RabbitMqIO.read().withUri() embeds credentials (amqp://user:pass@host:5672/vhost).
 *   To eliminate plaintext credential exposure in .beam pipeline specifications, the panel separates host, port,
 *   virtualHost, username, and password/secretName, integrating with GCP Secret Manager ('getSecrets') so the
 *   runtime pipeline code dynamically constructs the URI with secret credentials.
 * - Mutually exclusive consumption mode: In RabbitMQ, consumption targets either a specific Queue
 *   (.withQueue(name) + optional .withQueueDeclare(boolean)) OR an Exchange (.withExchange(name, type, routingKey)).
 *   The panel provides an interactive selector displaying only the fields relevant to the selected mode and enforces
 *   validation on whichever target mode is active.
 * - Discovered Compute Engine instances ('getComputeInstances') suggest RabbitMQ broker VM host IPs.
 * - Protocol & TLS support: Provides a toggle for TLS/SSL (amqps://) and port auto-selection (5672 for AMQP, 5671 for AMQPS).
 * - Bounded stream limits (.withMaxNumRecords, .withMaxReadTime) for hybrid testing and bounded pipeline execution.
 * - Deduplication and tracking via message correlation ID (.withUseCorrelationId(boolean)).
 * - Python x-lang Expansion Service configuration group adopting shared ExpansionServiceFields primitive.
 * - Decomposed connection and destination controls into reusable child components in components/common/rabbitmq/.
 * - Integrates InfoTooltip components citing the official Apache Beam RabbitMqIO documentation and APIs.
 * - Adheres strictly to the 8pt grid system for spacing, padding, and layout.
 */

import React, { useState, useEffect } from 'react';
import { InfoTooltip } from '../../components/InfoTooltip';
import { PropertyField } from '../../components/common/PropertyField';
import { ExpansionServiceFields } from '../../components/common/ExpansionServiceFields';
import {
  RabbitMqConnectionFields,
  type SecretItem,
  type ComputeInstanceItem
} from '../../components/common/rabbitmq/RabbitMqConnectionFields';
import { RabbitMqDestinationFields } from '../../components/common/rabbitmq/RabbitMqDestinationFields';

export type { SecretItem, ComputeInstanceItem };

export interface RabbitMqIOSourceNode {
  data: {
    label: string;
    beam_transform?: string;
    system_instructions?: string;
    special_instructions?: string;
    properties?: {
      host?: string;
      port?: number | string;
      virtualHost?: string;
      useTls?: boolean;
      username?: string;
      secretName?: string;
      consumeMode?: 'queue' | 'exchange';
      queue?: string;
      queueDeclare?: boolean;
      exchange?: string;
      exchangeDeclare?: boolean;
      exchangeType?: 'direct' | 'fanout' | 'topic' | 'headers';
      routingKey?: string;
      useCorrelationId?: boolean;
      maxNumRecords?: number | string;
      maxReadTime?: number | string;
      expansionServiceMode?: 'auto' | 'endpoint';
      expansionServiceEndpoint?: string;
      system_instructions?: string;
      special_instructions?: string;
      codeGenerationPrompt?: string;
      prompt?: string;
      [key: string]: any;
    };
  };
}

export interface RabbitMqIOSourcePropertiesProps {
  node: RabbitMqIOSourceNode;
  onChange: (properties: any) => void;
}

/**
 * RabbitMqIOSourceProperties renders the configuration form for RabbitMQ streaming source reads.
 * 
 * @param props Component properties containing the active node data and onChange callback.
 * @returns React functional component.
 */
export const RabbitMqIOSourceProperties: React.FC<RabbitMqIOSourcePropertiesProps> = ({ node, onChange }) => {
  const properties = node.data.properties || {};

  // NOTE: The URI embeds credentials (amqp://user:pass@host:5672/vhost). For security,
  // host, port, vhost, username, and password/secretName are captured separately.
  // Generated pipeline code must securely assemble the connection URI at runtime
  // (retrieving the password from Secret Manager), never persisting plaintext credentials
  // in the .beam pipeline specification.

  const host = properties.host || '';
  const port = properties.port !== undefined && properties.port !== '' ? String(properties.port) : (properties.useTls ? '5671' : '5672');
  const virtualHost = properties.virtualHost ?? '/';
  const useTls = properties.useTls ?? false;
  const username = properties.username || '';
  const secretName = properties.secretName || '';
  const consumeMode = properties.consumeMode || (properties.exchange ? 'exchange' : 'queue');
  const queue = properties.queue || '';
  const queueDeclare = properties.queueDeclare ?? false;
  const exchange = properties.exchange || '';
  const exchangeDeclare = properties.exchangeDeclare ?? true;
  const exchangeType = properties.exchangeType || 'direct';
  const routingKey = properties.routingKey || '';
  const useCorrelationId = properties.useCorrelationId ?? false;
  const maxNumRecords = properties.maxNumRecords ?? '';
  const maxReadTime = properties.maxReadTime ?? '';
  const expansionServiceMode = properties.expansionServiceMode || 'auto';
  const expansionServiceEndpoint = properties.expansionServiceEndpoint || '';

  // Local UI states (resources loaded via VS Code extension host messages)
  const [secrets, setSecrets] = useState<SecretItem[]>([]);
  const [instances, setInstances] = useState<ComputeInstanceItem[]>([]);
  const [secretError, setSecretError] = useState<string | null>(null);
  const [instanceError, setInstanceError] = useState<string | null>(null);
  const [isLoadingSecrets, setIsLoadingSecrets] = useState(false);

  // System instructions text with fallback
  const systemInstructions =
    node.data.system_instructions ??
    node.data.special_instructions ??
    properties.system_instructions ??
    properties.special_instructions ??
    '';

  // Listen for Secret Manager secrets and Compute Engine instances from the extension host
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message && message.command === 'secretsLoaded') {
        const rawSecrets = Array.isArray(message.secrets) ? message.secrets : [];
        // NOTE: Normalize secrets so both strings and SecretItem objects resolve correctly with short secret ID
        const loaded: SecretItem[] = rawSecrets.map((s: any) => {
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
      } else if (message.command === 'computeInstancesLoaded') {
        setInstances(Array.isArray(message.instances) ? message.instances : []);
        setInstanceError(message.error || null);
      }
    };

    window.addEventListener('message', handleMessage);

    const vscode = (window as any).vscode;
    if (vscode) {
      setIsLoadingSecrets(true);
      vscode.postMessage({ command: 'getSecrets' });
      vscode.postMessage({ command: 'getComputeInstances' });
    }

    return () => window.removeEventListener('message', handleMessage);
  }, []);

  /**
   * Refreshes secrets list from Secret Manager via extension message.
   */
  const handleRefreshSecrets = () => {
    const vscode = (window as any).vscode;
    if (vscode) {
      setIsLoadingSecrets(true);
      vscode.postMessage({ command: 'getSecrets' });
    }
  };

  /**
   * Handles generic text, select, radio, and checkbox input changes.
   * 
   * @param e Form change event from input, select, or textarea.
   */
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const isCheckbox = type === 'checkbox';
    const checked = isCheckbox ? (e.target as HTMLInputElement).checked : undefined;

    const newProperties = {
      ...properties,
      [name]: isCheckbox ? checked : value
    };

    // Auto-update port when TLS is toggled, if default port was in use
    if (name === 'useTls') {
      const isTls = Boolean(checked);
      const currentPort = String(properties.port || '');
      if (isTls && (currentPort === '5672' || !currentPort)) {
        newProperties.port = '5671';
      } else if (!isTls && (currentPort === '5671' || !currentPort)) {
        newProperties.port = '5672';
      }
    }

    // Clean up opposing destination fields when consumeMode changes
    if (name === 'consumeMode') {
      if (value === 'queue') {
        delete newProperties.exchange;
        delete newProperties.exchangeDeclare;
        delete newProperties.exchangeType;
        delete newProperties.routingKey;
      } else if (value === 'exchange') {
        delete newProperties.queue;
        delete newProperties.queueDeclare;
        if (!newProperties.exchangeType) {
          newProperties.exchangeType = 'direct';
        }
      }
    }

    onChange(newProperties);
  };

  /**
   * Applies a selected Compute Engine instance internal/external IP to the broker host.
   * 
   * @param ip IP address of the VM instance.
   */
  const handleSelectInstanceIp = (ip: string) => {
    onChange({
      ...properties,
      host: ip
    });
  };

  /**
   * Handles system instructions textarea change for custom LLM prompt overrides.
   * 
   * @param e Form change event from textarea.
   */
  const handleInstructionsChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const newInstructions = e.target.value;
    onChange({
      ...properties,
      system_instructions: newInstructions
    });
  };

  return (
    <div className="flex-1 flex flex-col gap-4">
      {/* 1 & 2: Broker Connection & Credentials */}
      <RabbitMqConnectionFields
        idPrefix="rabbitmq-source"
        host={host}
        port={port}
        virtualHost={virtualHost}
        useTls={useTls}
        username={username}
        secretName={secretName}
        secrets={secrets}
        instances={instances}
        secretError={secretError}
        instanceError={instanceError}
        isLoadingSecrets={isLoadingSecrets}
        onRefreshSecrets={handleRefreshSecrets}
        onSelectInstanceIp={handleSelectInstanceIp}
        onChange={handleChange}
      />

      {/* 3. Consumption Target (Queue vs Exchange) */}
      <RabbitMqDestinationFields
        idPrefix="rabbitmq-source"
        mode={consumeMode}
        modeFieldName="consumeMode"
        legendTitle="Consumption Target"
        legendTooltip="Specify how RabbitMqIO.read() consumes messages: either directly from a Queue (.withQueue(name)) or bound to an Exchange (.withExchange(name, type, routingKey))."
        queue={queue}
        queueDeclare={queueDeclare}
        queueLabel="Queue Name"
        queueTooltip="Name of the RabbitMQ queue to consume messages from (RabbitMqIO.read().withQueue(name))."
        queueDeclareTooltip="Automatically declares the specified queue on the broker if it does not already exist (RabbitMqIO.read().withQueueDeclare(boolean))."
        queueDeclareHelpText={
          <>
            Calls <code className="text-slate-300 bg-slate-800/60 px-1 py-0.5 rounded font-mono">.withQueueDeclare(true)</code> to ensure queue presence before consuming.
          </>
        }
        exchange={exchange}
        exchangeDeclare={exchangeDeclare}
        exchangeType={exchangeType}
        exchangeTooltip="Name of the RabbitMQ exchange to bind and consume from (RabbitMqIO.read().withExchange(name, type, routingKey))."
        exchangePlaceholder="e.g. amq.topic or orders.exchange"
        routingKey={routingKey}
        routingKeyLabel="Routing Key"
        routingKeyTooltip="Binding routing key used to bind the reader queue to the exchange (RabbitMqIO.read().withExchange(name, type, routingKey)). E.g. 'orders.#' or 'critical.*'."
        routingKeyPlaceholder="e.g. orders.* or empty for fanout"
        onChange={handleChange}
      />

      {/* 4. Message Handling & Correlation */}
      <div className="p-2.5 rounded bg-[#252836]/60 border border-slate-700">
        <label htmlFor="rabbitmq-source-correlation-id" className="flex items-start gap-2.5 cursor-pointer">
          <input
            id="rabbitmq-source-correlation-id"
            type="checkbox"
            name="useCorrelationId"
            checked={useCorrelationId}
            onChange={handleChange}
            className="mt-0.5 accent-blue-500 rounded"
          />
          <div className="flex flex-col gap-0.5">
            <span className="flex items-center text-xs font-bold text-white gap-1">
              <span>Use Correlation ID</span>
              <InfoTooltip
                text="Enables correlation ID tracking (RabbitMqIO.read().withUseCorrelationId(boolean)). When true, uses the RabbitMQ message correlation ID property for deduplication and checkpointing in the unbounded reader."
                position="auto"
              />
            </span>
            <p className="text-xs text-slate-400">
              Tracks message correlation IDs across restarts for enhanced deduplication and checkpoint recovery.
            </p>
          </div>
        </label>
      </div>

      {/* 5. Stream Bounding Limits (Testing / Hybrid) */}
      <div className="border border-slate-700 rounded p-2.5 bg-[#252836]/40 flex flex-col gap-2">
        <span className="flex items-center text-xs font-bold uppercase text-slate-500 gap-1">
          <span>Bounded Stream Limits (Testing / Hybrid)</span>
          <InfoTooltip
            text="Bound the RabbitMQ read by record count (RabbitMqIO.read().withMaxNumRecords(long)) or duration (RabbitMqIO.read().withMaxReadTime(Duration)). Specifying either option turns streaming ingestion into a bounded PCollection for integration testing or batch pipelines."
            position="auto"
          />
        </span>

        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-700/60">
          <PropertyField
            id="rabbitmq-source-max-records"
            type="number"
            min="1"
            name="maxNumRecords"
            label="Max Records"
            tooltip="Maximum number of records to read before completing (RabbitMqIO.read().withMaxNumRecords(long)). Produces a bounded read."
            value={maxNumRecords}
            onChange={handleChange}
            placeholder="e.g. 1000"
            mono={true}
          />
          <PropertyField
            id="rabbitmq-source-max-time"
            type="number"
            min="1"
            name="maxReadTime"
            label="Max Read Time (s)"
            tooltip="Maximum read duration in seconds before completing (RabbitMqIO.read().withMaxReadTime(Duration)). Produces a bounded read."
            value={maxReadTime}
            onChange={handleChange}
            placeholder="e.g. 60"
            mono={true}
          />
        </div>
      </div>

      {/* 6. Python Cross-Language Expansion Service */}
      <ExpansionServiceFields
        transformName="RabbitMqIO"
        idPrefix="rabbitmq-source"
        mode={expansionServiceMode}
        endpoint={expansionServiceEndpoint}
        onChange={handleChange}
      />

      {/* Flexible Spacer */}
      <div className="flex-1 min-h-4" />

      {/* 7. Code Generation Instructions */}
      <div className="pt-2 border-t border-slate-700/60">
        <PropertyField
          id="rabbitmq-source-instructions"
          name="system_instructions"
          label="Code Generation Instructions"
          tooltip="Custom instructions passed to the AI code generation model for this specific RabbitMQ source node (e.g. RabbitMqMessage payload deserialization, message ack settings, or dead-letter routing)."
          type="textarea"
          rows={3}
          value={systemInstructions}
          onChange={handleInstructionsChange}
          placeholder="e.g. Deserialize RabbitMqMessage body as UTF-8 JSON OrderRecord and route malformed payloads to DLQ"
          mono={false}
          className="resize-y"
        />
      </div>
    </div>
  );
};
