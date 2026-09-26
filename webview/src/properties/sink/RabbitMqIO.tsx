/**
 * RabbitMqIOSinkProperties Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Renders the property configuration panel for Apache Beam RabbitMqIO Streaming Sink nodes.
 * Supports Apache Beam Java SDK (org.apache.beam.sdk.io.rabbitmq.RabbitMqIO) publishing to RabbitMQ
 * via RabbitMqIO.write() accepting PCollection<RabbitMqMessage>, and Python pipelines via Apache Beam
 * Cross-Language (x-lang) Java expansion service (apache_beam.transforms.external).
 * 
 * Architectural Decisions:
 * - AMQP Connection URI security: RabbitMqIO.write().withUri() embeds credentials (amqp://user:pass@host:5672/vhost).
 *   To eliminate plaintext credential exposure in .beam pipeline specifications, the panel separates host, port,
 *   virtualHost, username, and password/secretName, integrating with GCP Secret Manager ('getSecrets') so the
 *   runtime pipeline code dynamically constructs the URI with secret credentials.
 * - Mutually exclusive publishing mode: In RabbitMQ, publication targets either a specific Queue
 *   (.withQueue(name) + optional .withQueueDeclare(boolean)) OR an Exchange (.withExchange(name, type)).
 *   The panel provides an interactive selector displaying only the fields relevant to the selected mode and enforces
 *   validation on whichever target mode is active.
 * - Discovered Compute Engine instances ('getComputeInstances') suggest RabbitMQ broker VM host IPs.
 * - Protocol & TLS support: Provides a toggle for TLS/SSL (amqps://) and port auto-selection (5672 for AMQP, 5671 for AMQPS).
 * - Message durability & delivery guarantees: Message persistence toggle ('persistentDelivery') configuring delivery
 *   mode 2 so published messages survive broker restarts, and MIME content type configuration ('contentType').
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

export interface RabbitMqIOSinkNode {
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
      publishMode?: 'queue' | 'exchange';
      queue?: string;
      queueDeclare?: boolean;
      exchange?: string;
      exchangeDeclare?: boolean;
      exchangeType?: 'direct' | 'fanout' | 'topic' | 'headers';
      routingKey?: string;
      persistentDelivery?: boolean;
      contentType?: string;
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

export interface RabbitMqIOSinkPropertiesProps {
  node: RabbitMqIOSinkNode;
  onChange: (properties: any) => void;
}

/**
 * RabbitMqIOSinkProperties renders the configuration form for RabbitMQ streaming sink writes.
 * 
 * @param props Component properties containing the active node data and onChange callback.
 * @returns React functional component.
 */
export const RabbitMqIOSinkProperties: React.FC<RabbitMqIOSinkPropertiesProps> = ({ node, onChange }) => {
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
  const publishMode = properties.publishMode || (properties.exchange ? 'exchange' : 'queue');
  const queue = properties.queue || '';
  const queueDeclare = properties.queueDeclare ?? false;
  const exchange = properties.exchange || '';
  const exchangeDeclare = properties.exchangeDeclare ?? true;
  const exchangeType = properties.exchangeType || 'direct';
  const routingKey = properties.routingKey || '';
  const persistentDelivery = properties.persistentDelivery ?? false;
  const contentType = properties.contentType || 'application/json';
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

    // Clean up opposing destination fields when publishMode changes
    if (name === 'publishMode') {
      if (value === 'queue') {
        delete newProperties.exchange;
        delete newProperties.exchangeDeclare;
        delete newProperties.exchangeType;
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
        idPrefix="rabbitmq-sink"
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

      {/* 3. Publish Destination (Queue vs Exchange) */}
      <RabbitMqDestinationFields
        idPrefix="rabbitmq-sink"
        mode={publishMode}
        modeFieldName="publishMode"
        legendTitle="Publish Destination"
        legendTooltip="Specify the publishing target: direct to a Queue (RabbitMqIO.write().withQueue(name)) or to an Exchange (RabbitMqIO.write().withExchange(name, type))."
        queue={queue}
        queueDeclare={queueDeclare}
        queueLabel="Queue Name"
        queueTooltip="Target RabbitMQ queue name to publish messages to (RabbitMqIO.write().withQueue(name))."
        queueDeclareTooltip="Automatically declares the target queue on the broker if it does not already exist before writing (RabbitMqIO.write().withQueueDeclare(boolean))."
        queueDeclareHelpText={
          <>
            Calls <code className="text-slate-300 bg-slate-800/60 px-1 py-0.5 rounded font-mono">.withQueueDeclare(true)</code> to ensure queue presence before writing.
          </>
        }
        exchange={exchange}
        exchangeDeclare={exchangeDeclare}
        exchangeType={exchangeType}
        exchangeTooltip="Target RabbitMQ exchange to publish messages to (RabbitMqIO.write().withExchange(name, type))."
        exchangePlaceholder="e.g. amq.topic or orders.processed"
        routingKey={routingKey}
        routingKeyLabel="Message Routing Key"
        routingKeyTooltip="Routing key attached to published RabbitMqMessage objects in generated code (RabbitMqIO.write() sets routing keys per-message)."
        routingKeyPlaceholder="e.g. orders.eu.completed"
        onChange={handleChange}
      />

      {/* 4. Message Properties & Delivery Guarantees */}
      <div className="p-3 bg-[#252836]/60 rounded border border-slate-700 flex flex-col gap-3">
        <span className="flex items-center text-xs font-bold uppercase text-slate-400 gap-1.5">
          <span>Message Durability & Format</span>
          <InfoTooltip
            text="Configure AMQP message persistence (delivery mode 2) so messages survive broker restarts, and MIME content type for downstream consumers."
            position="auto"
          />
        </span>

        <div className="p-2.5 rounded bg-[#252836]/40 border border-slate-700/60">
          <label htmlFor="rabbitmq-sink-persistent-delivery" className="flex items-start gap-2.5 cursor-pointer">
            <input
              id="rabbitmq-sink-persistent-delivery"
              type="checkbox"
              name="persistentDelivery"
              checked={persistentDelivery}
              onChange={handleChange}
              className="mt-0.5 accent-blue-500 rounded"
            />
            <div className="flex flex-col gap-0.5">
              <span className="flex items-center text-xs font-bold text-white gap-1">
                <span>Persistent Delivery Mode</span>
                <InfoTooltip
                  text="When enabled, sets RabbitMQ deliveryMode to 2 (persistent), ensuring messages are logged to disk on the broker before broker acknowledgement."
                  position="auto"
                />
              </span>
              <p className="text-xs text-slate-400">
                Sets message delivery mode 2. Guarantees persistence across broker restarts.
              </p>
            </div>
          </label>
        </div>

        <PropertyField
          id="rabbitmq-sink-content-type"
          name="contentType"
          label="Content Type"
          tooltip="MIME content type header attached to published RabbitMQ messages (e.g. application/json, application/octet-stream, text/plain)."
          value={contentType}
          onChange={handleChange}
          placeholder="application/json"
          mono={true}
        />
      </div>

      {/* 5. Python Cross-Language Expansion Service */}
      <ExpansionServiceFields
        transformName="RabbitMqIO"
        idPrefix="rabbitmq-sink"
        mode={expansionServiceMode}
        endpoint={expansionServiceEndpoint}
        onChange={handleChange}
      />

      {/* Flexible Spacer */}
      <div className="flex-1 min-h-4" />

      {/* 6. Code Generation Instructions */}
      <div className="pt-2 border-t border-slate-700/60">
        <PropertyField
          id="rabbitmq-sink-instructions"
          name="system_instructions"
          label="Code Generation Instructions"
          tooltip="Custom instructions passed to the AI code generation model for this specific RabbitMQ sink node (e.g. RabbitMqMessage serialization, custom headers, or dead-letter publishing)."
          type="textarea"
          rows={3}
          value={systemInstructions}
          onChange={handleInstructionsChange}
          placeholder="e.g. Serialize payload as JSON RabbitMqMessage and set custom header 'x-correlation-id'"
          mono={false}
          className="resize-y"
        />
      </div>
    </div>
  );
};
