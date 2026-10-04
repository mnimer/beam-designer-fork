/**
 * MqttIOSinkProperties Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Renders the property configuration panel for Apache Beam MqttIO Streaming Sink nodes.
 * Supports both Java native MqttIO (MqttIO.write()) and Python Cross-Language API (WriteToMqtt).
 * 
 * Architectural Decisions:
 * - Broker connection controls with quick-select protocol helper pills (tcp://, ssl://, ws://).
 * - Queries the VS Code extension for Google Cloud Secret Manager secrets ('getSecrets') to prevent hardcoding credentials.
 * - Queries Compute Engine instances ('getComputeInstances') to suggest broker VM host endpoints.
 * - Enforces required field validation with semantic red borders for empty serverUri or topic.
 * - Active wildcard validation: Displays a warning if topic contains '+' or '#' because MQTT publication topics must be concrete.
 * - Message retention toggle ('retain') with detailed documentation on MQTT broker retained message mechanics.
 * - Fixed/informational badge indicating QoS 1 (At Least Once), guaranteed by Beam MqttIO.write() for retry safety.
 * - Integrates InfoTooltip components linking field definitions to official Apache Beam documentation.
 * - Adheres strictly to the 8pt grid system for spacing and sizing.
 */

import React from 'react';
import { Server, Key, Lock, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { InfoTooltip } from '../../components/InfoTooltip';
import { PropertyField } from '../../components/common/PropertyField';
import { SystemInstructionsField } from '../../components/common/SystemInstructionsField';
import { resolveSystemInstructions } from '../../utils/systemInstructions';
import { useSecretOptions } from '../../hooks/useSecretOptions';
import { useAssetLoader } from '../../hooks/useAssetLoader';

/**
 * Secret item loaded from Secret Manager for MQTT broker authentication.
 */
export interface SecretItem {
  name: string;
  fullName?: string;
  value: string;
}

/**
 * Compute Engine instance information for MQTT broker resolution.
 */
export interface ComputeInstanceItem {
  name: string;
  status: string;
  internalIp: string;
  externalIp: string;
}

/**
 * React Flow node shape for the MQTT sink panel, including its persisted configuration data.
 */
export interface MqttIOSinkNode {
  data: {
    label: string;
    beam_transform?: string;
    system_instructions?: string;
    special_instructions?: string;
    properties?: {
      serverUri?: string;
      topic?: string;
      clientId?: string;
      username?: string;
      password?: string;
      passwordSource?: 'secretManager';
      secretName?: string;
      retain?: boolean;
      connectionTimeout?: number | string;
      keepAlive?: number | string;
      system_instructions?: string;
      special_instructions?: string;
      codeGenerationPrompt?: string;
      prompt?: string;
      [key: string]: any;
    };
  };
}

/**
 * Props for the MqttIOSinkProperties component.
 */
export interface MqttIOSinkPropertiesProps {
  node: MqttIOSinkNode;
  onChange: (properties: any) => void;
}

/**
 * MqttIOSinkProperties renders the configuration form for MQTT streaming sink writes.
 * 
 * @param props Component properties containing the active node data and onChange callback.
 * @returns React component.
 */
export const MqttIOSinkProperties: React.FC<MqttIOSinkPropertiesProps> = ({ node, onChange }) => {
  const properties = node.data.properties || {};

  // Form field state values with fallbacks
  const serverUri = properties.serverUri || '';
  const topic = properties.topic || '';
  const clientId = properties.clientId || '';
  const username = properties.username || '';
  const secretName = properties.secretName || '';
  const retain = properties.retain ?? false;
  const connectionTimeout = properties.connectionTimeout ?? '30';
  const keepAlive = properties.keepAlive ?? '60';

  const secrets = useSecretOptions();
  const { items: instances } = useAssetLoader<ComputeInstanceItem>('computeInstances');

  // System instructions text with fallback
  const systemInstructions = resolveSystemInstructions(node);

  /**
   * Handles generic text, select, and checkbox input changes.
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

    delete newProperties.password;
    newProperties.passwordSource = 'secretManager';

    onChange(newProperties);
  };

  /**
   * Applies protocol prefix helper to server URI.
   * 
   * @param protocol URI scheme prefix (e.g., 'tcp://', 'ssl://').
   */
  const handleApplyProtocol = (protocol: string) => {
    let cleanUri = serverUri.replace(/^[a-zA-Z]+:\/\//, '');
    if (!cleanUri) {
      cleanUri = protocol === 'ssl://' ? 'localhost:8883' : 'localhost:1883';
    }
    onChange({
      ...properties,
      serverUri: `${protocol}${cleanUri}`
    });
  };

  /**
   * Applies a selected Compute Engine instance internal/external IP to the server URI.
   * 
   * @param ip IP address of the VM instance.
   */
  const handleSelectInstanceIp = (ip: string) => {
    const currentProtocol = serverUri.startsWith('ssl://') ? 'ssl://' : 'tcp://';
    const port = currentProtocol === 'ssl://' ? '8883' : '1883';
    onChange({
      ...properties,
      serverUri: `${currentProtocol}${ip}:${port}`
    });
  };

  // Field validation flags
  const isServerUriMissing = !serverUri.trim();
  const isTopicMissing = !topic.trim();
  const hasWildcardInTopic = topic.includes('+') || topic.includes('#');

  return (
    <div className="flex-1 flex flex-col gap-4">
      {/* 1. Connection Configuration */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label htmlFor="mqtt-sink-server-uri" className="flex items-center text-xs font-bold uppercase text-slate-500">
            <span>Broker Server URI</span>
            <span className="text-red-400 ml-1 font-bold" title="Required">*</span>
            <InfoTooltip
              text="Connection URI for destination MQTT broker (e.g. tcp://broker:1883, ssl://broker:8883). Used by MqttIO.write().withConnectionConfiguration()."
              position="auto"
            />
          </label>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handleApplyProtocol('tcp://')}
              className="px-1.5 py-0.5 rounded text-[10px] bg-slate-700 text-slate-200 hover:bg-slate-600 transition-colors"
              title="Set tcp:// scheme"
            >
              tcp://
            </button>
            <button
              type="button"
              onClick={() => handleApplyProtocol('ssl://')}
              className="px-1.5 py-0.5 rounded text-[10px] bg-slate-700 text-slate-200 hover:bg-slate-600 transition-colors"
              title="Set ssl:// scheme"
            >
              ssl://
            </button>
          </div>
        </div>

        <PropertyField
          id="mqtt-sink-server-uri"
          name="serverUri"
          required
          aria-required="true"
          aria-invalid={isServerUriMissing}
          value={serverUri}
          onChange={handleChange}
          placeholder="tcp://localhost:1883"
          error={isServerUriMissing ? 'Broker Server URI is required.' : undefined}
          containerClassName="flex flex-col"
        />

        {/* Compute Engine Instance Suggestions */}
        {instances.length > 0 && (
          <div className="p-2 bg-[#252836]/60 rounded border border-slate-700/80 space-y-1">
            <div className="flex items-center gap-1 text-xs text-slate-400">
              <Server size={12} />
              <span>Discovered GCP Compute VMs:</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {instances.map((inst) => {
                const targetIp = inst.internalIp || inst.externalIp;
                if (!targetIp) return null;
                return (
                  <button
                    key={inst.name}
                    type="button"
                    onClick={() => handleSelectInstanceIp(targetIp)}
                    className="px-1.5 py-0.5 rounded text-[10px] bg-slate-700 text-slate-200 hover:bg-slate-600 transition-colors"
                    title={`Use IP ${targetIp} for VM ${inst.name} (${inst.status})`}
                  >
                    {inst.name} ({targetIp})
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 2. Destination Publish Topic */}
      <PropertyField
        id="mqtt-sink-topic"
        name="topic"
        label="Publish Topic"
        required
        tooltip="Destination MQTT topic where pipeline elements will be published as byte messages. Wildcards (+ or #) are not permitted when publishing."
        aria-required="true"
        aria-invalid={isTopicMissing || hasWildcardInTopic}
        value={topic}
        onChange={handleChange}
        placeholder="e.g. telemetry/device/status or alerts/hvac"
        error={isTopicMissing ? 'Publish topic is required.' : undefined}
      >
        {hasWildcardInTopic && (
          <div className="p-2.5 rounded bg-amber-500/10 border border-amber-500/30 text-xs text-amber-400 flex items-start gap-2">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Wildcard detected: </span>
              MQTT publishers cannot send messages to wildcard topics (<code className="text-amber-300 bg-amber-500/20 px-1 py-0.5 rounded font-mono">+</code> or <code className="text-amber-300 bg-amber-500/20 px-1 py-0.5 rounded font-mono">#</code>). Please specify a concrete target topic.
            </div>
          </div>
        )}
      </PropertyField>

      {/* 3. Client ID */}
      <PropertyField
        id="mqtt-sink-client-id"
        name="clientId"
        label="Client ID"
        tooltip="Explicit identifier for publishing messages. If left blank, Beam and the MQTT client will generate a unique connection name automatically."
        value={clientId}
        onChange={handleChange}
        placeholder="e.g. beam-mqtt-sink-publisher (optional, auto-generated)"
      />

      {/* 4. Authentication & Secret Manager */}
      <div className="p-3 bg-[#252836]/60 rounded border border-slate-700 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="flex items-center text-xs font-bold uppercase text-slate-400 gap-1.5">
            <Lock size={12} className="text-blue-400" />
            <span>Authentication & Credentials</span>
          </span>
        </div>

        {/* Username Secret */}
        <PropertyField
          id="mqtt-sink-username"
          name="username"
          label="Username Secret"
          value={username}
          onChange={handleChange}
          placeholder="e.g. mqtt-broker-username"
          list="mqtt-sink-username-secret-options"
          datalist={secrets.options}
          loading={secrets.loading}
          containerClassName="flex flex-col gap-1.5"
        />

        {/* Secret Manager Selector */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="mqtt-sink-secret-name" className="flex items-center text-xs font-bold uppercase text-slate-500 gap-1">
              <Key size={12} />
              <span>GCP Secret Manager Secret</span>
              <InfoTooltip
                text="Select a secret from Google Cloud Secret Manager to provide broker credentials securely without hardcoding secrets."
                position="auto"
              />
            </label>
            <button
              type="button"
              onClick={secrets.refresh}
              disabled={secrets.loading}
              className="text-xs text-blue-400 hover:underline flex items-center gap-1"
              title="Refresh secrets from Secret Manager"
            >
              <RefreshCw size={11} className={secrets.loading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
          </div>

          <PropertyField
            id="mqtt-sink-secret-name"
            name="secretName"
            value={secretName}
            onChange={handleChange}
            placeholder="e.g. mqtt-broker-password"
            list="mqtt-sink-secret-options"
            datalist={secrets.options}
            loading={secrets.loading}
            error={secrets.error}
            invalid={!!secrets.error}
            containerClassName="flex flex-col gap-1"
          />
        </div>
      </div>

      {/* 5. Publishing Options & Retain Flag */}
      <div className="flex flex-col gap-3">
        <div className="p-2.5 rounded bg-[#252836]/60 border border-slate-700">
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              name="retain"
              checked={retain}
              onChange={handleChange}
              className="mt-0.5 accent-blue-500 rounded"
            />
            <div className="flex flex-col gap-0.5">
              <span className="flex items-center text-xs font-bold text-white gap-1">
                <span>Retain Messages</span>
                <code className="text-[11px] text-blue-400 bg-slate-800/80 px-1 py-0.5 rounded font-mono">withRetain(true)</code>
                <InfoTooltip
                  text="Instructs the MQTT broker to retain the published message as the last-known-good value for the topic. Any new subscriber to this topic will immediately receive this message."
                  position="auto"
                />
              </span>
              <p className="text-xs text-slate-400">
                When enabled, the broker persists the latest message on this topic for newly connected subscribers. Recommended for device configurations, state updates, or last status.
              </p>
            </div>
          </label>
        </div>

        {/* Quality of Service (QoS) - On its own row */}
        <div className="flex flex-col gap-2">
          <span className="flex items-center text-xs font-bold uppercase text-slate-500 gap-1">
            <span>QoS (Quality of Service)</span>
            <InfoTooltip
              text="Beam's MqttIO.write() guarantees QoS 1 (At Least Once) semantics to safely accommodate runner bundle retries and network reconnects."
              position="auto"
            />
          </span>
          <div className="flex items-center gap-1.5 p-2 bg-[#252836] text-slate-300 border border-slate-700 rounded text-xs">
            <CheckCircle2 size={13} className="text-green-400 shrink-0" />
            <span>QoS 1 (At Least Once)</span>
          </div>
        </div>

        {/* Connection Tuning (Timeout & Keep Alive) */}
        <div className="grid grid-cols-2 gap-2">
          <PropertyField
            id="mqtt-sink-timeout"
            type="number"
            min="1"
            name="connectionTimeout"
            label="Timeout (s)"
            tooltip="Connection timeout interval in seconds before the client aborts connection attempts (default 30s)."
            value={connectionTimeout}
            onChange={handleChange}
            placeholder="30"
          />

          <PropertyField
            id="mqtt-sink-keepalive"
            type="number"
            min="1"
            name="keepAlive"
            label="Keep Alive (s)"
            tooltip="Maximum time interval in seconds between ping packets sent to the broker to keep the session alive (default 60s)."
            value={keepAlive}
            onChange={handleChange}
            placeholder="60"
          />
        </div>
      </div>

      {/* 6. Code Generation Instructions */}
      <SystemInstructionsField
        id="mqtt-sink-instructions"
        value={systemInstructions}
        tooltip="Custom instructions passed to the AI code generation model for this specific MQTT sink node (e.g. serialize input POJO/Row to byte[] before publishing)."
        placeholder="e.g. Map elements to byte[] payloads and set retain flag when publishing configuration alerts"
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
