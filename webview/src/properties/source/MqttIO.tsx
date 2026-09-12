/**
 * MqttIOSourceProperties Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Renders the property configuration panel for Apache Beam MqttIO Streaming Source nodes.
 * Supports both Java native MqttIO (MqttIO.read(), MqttIO.readWithMetadata()) and
 * Python Cross-Language API (ReadFromMqtt).
 * 
 * Architectural Decisions:
 * - Broker connection controls with quick-select protocol helper pills (tcp://, ssl://, ws://).
 * - Queries the VS Code extension for Google Cloud Secret Manager secrets ('getSecrets') to prevent hardcoding credentials.
 * - Queries Compute Engine instances ('getComputeInstances') to suggest broker VM host endpoints.
 * - Enforces required field validation with semantic red borders for empty serverUri or topic.
 * - Provides QoS configuration (0, 1, 2) aligned with MQTT specifications and Beam stream processing best practices.
 * - Supports bounded read limits (maxNumRecords, maxReadTime) for hybrid testing and batch execution.
 * - Supports payload toggle between raw byte[] payload and MqttRecord metadata (topic + payload).
 * - Integrates InfoTooltip components linking field definitions to official Apache Beam documentation.
 * - Adheres strictly to the 8pt grid system for spacing and sizing.
 */

import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Server, Key, Lock, RefreshCw, AlertCircle } from 'lucide-react';
import { InfoTooltip } from '../../components/InfoTooltip';

export interface SecretItem {
  name: string;
  fullName?: string;
  value: string;
}

export interface ComputeInstanceItem {
  name: string;
  status: string;
  internalIp: string;
  externalIp: string;
}

export interface MqttIOSourceNode {
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
      passwordSource?: 'secretManager' | 'direct';
      secretName?: string;
      qos?: '0' | '1' | '2' | number;
      connectionTimeout?: number | string;
      keepAlive?: number | string;
      useMetadata?: boolean;
      maxNumRecords?: number | string;
      maxReadTime?: number | string;
      system_instructions?: string;
      special_instructions?: string;
      codeGenerationPrompt?: string;
      prompt?: string;
      [key: string]: any;
    };
  };
}

export interface MqttIOSourcePropertiesProps {
  node: MqttIOSourceNode;
  onChange: (properties: any) => void;
}

/**
 * MqttIOSourceProperties renders the configuration form for MQTT streaming source reads.
 * 
 * @param props Component properties containing the active node data and onChange callback.
 * @returns React component.
 */
export const MqttIOSourceProperties: React.FC<MqttIOSourcePropertiesProps> = ({ node, onChange }) => {
  const properties = node.data.properties || {};

  // Form field state values with fallbacks
  const serverUri = properties.serverUri || '';
  const topic = properties.topic || '';
  const clientId = properties.clientId || '';
  const username = properties.username || '';
  const password = properties.password || '';
  const passwordSource = properties.passwordSource || 'secretManager';
  const secretName = properties.secretName || '';
  const qos = properties.qos !== undefined ? String(properties.qos) : '1';
  const connectionTimeout = properties.connectionTimeout ?? '30';
  const keepAlive = properties.keepAlive ?? '60';
  const useMetadata = properties.useMetadata ?? false;
  const maxNumRecords = properties.maxNumRecords ?? '';
  const maxReadTime = properties.maxReadTime ?? '';

  // Local UI states
  const [showPassword, setShowPassword] = useState(false);
  const [secrets, setSecrets] = useState<SecretItem[]>([]);
  const [instances, setInstances] = useState<ComputeInstanceItem[]>([]);
  const [isLoadingSecrets, setIsLoadingSecrets] = useState(false);

  // System instructions text with fallback
  const systemInstructions =
    node.data.system_instructions ??
    node.data.special_instructions ??
    properties.system_instructions ??
    properties.special_instructions ??
    '';

  // NOTE: Listen for Secret Manager secrets and Compute Engine instances from the extension host
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.command === 'secretsLoaded') {
        setSecrets(message.secrets || []);
        setIsLoadingSecrets(false);
      } else if (message.command === 'computeInstancesLoaded') {
        setInstances(message.instances || []);
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

  /**
   * Handles system instructions textarea change for custom LLM prompt overrides.
   * 
   * @param e Form change event from textarea.
   */
  const handleInstructionsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newInstructions = e.target.value;
    onChange({
      ...properties,
      system_instructions: newInstructions
    });
  };

  // Field validation flags
  const isServerUriMissing = !serverUri.trim();
  const isTopicMissing = !topic.trim();

  return (
    <div className="flex-1 flex flex-col gap-4">
      {/* 1. Connection Configuration */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label htmlFor="mqtt-server-uri" className="flex items-center text-xs font-bold uppercase text-slate-500">
            <span>Broker Server URI</span>
            <span className="text-red-400 ml-1 font-bold" title="Required">*</span>
            <InfoTooltip
              text="Connection URI for the MQTT broker (e.g. tcp://broker:1883, ssl://broker:8883). Used by MqttIO.read().withConnectionConfiguration()."
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

        <input
          id="mqtt-server-uri"
          type="text"
          name="serverUri"
          aria-required="true"
          aria-invalid={isServerUriMissing}
          value={serverUri}
          onChange={handleChange}
          placeholder="tcp://localhost:1883"
          className={`bg-[#252836] text-white p-2 rounded border text-sm focus:outline-none font-mono ${
            isServerUriMissing
              ? 'border-red-500/80 focus:border-red-500'
              : 'border-slate-700 focus:border-blue-500'
          }`}
        />
        {isServerUriMissing && (
          <span className="text-xs text-red-400 flex items-center gap-1">
            <AlertCircle size={12} /> Broker Server URI is required.
          </span>
        )}

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

      {/* 2. Topic Configuration */}
      <div className="flex flex-col gap-2">
        <label htmlFor="mqtt-topic" className="flex items-center text-xs font-bold uppercase text-slate-500">
          <span>Subscription Topic / Filter</span>
          <span className="text-red-400 ml-1 font-bold" title="Required">*</span>
          <InfoTooltip
            text="MQTT topic filter to subscribe to. Supports exact topics (sensors/temp) or standard MQTT wildcards: '+' for single level, '#' for multi-level."
            position="auto"
          />
        </label>
        <input
          id="mqtt-topic"
          type="text"
          name="topic"
          aria-required="true"
          aria-invalid={isTopicMissing}
          value={topic}
          onChange={handleChange}
          placeholder="sensors/+/temperature or iot/#"
          className={`bg-[#252836] text-white p-2 rounded border text-sm focus:outline-none font-mono ${
            isTopicMissing
              ? 'border-red-500/80 focus:border-red-500'
              : 'border-slate-700 focus:border-blue-500'
          }`}
        />
        {isTopicMissing ? (
          <span className="text-xs text-red-400 flex items-center gap-1">
            <AlertCircle size={12} /> Subscription topic is required.
          </span>
        ) : (
          <span className="text-xs text-slate-400">
            Tip: Use <code className="text-slate-300 bg-slate-800/60 px-1 py-0.5 rounded">+</code> for single level or <code className="text-slate-300 bg-slate-800/60 px-1 py-0.5 rounded">#</code> for multi-level wildcards.
          </span>
        )}
      </div>

      {/* 3. Client ID */}
      <div className="flex flex-col gap-2">
        <label htmlFor="mqtt-client-id" className="flex items-center text-xs font-bold uppercase text-slate-500">
          <span>Client ID</span>
          <InfoTooltip 
            text="Explicit identifier for the MQTT connection. If left blank, Apache Beam and the MQTT client will generate a unique connection name automatically."
            position="auto"
          />
        </label>
        <input
          id="mqtt-client-id"
          type="text"
          name="clientId"
          value={clientId}
          onChange={handleChange}
          placeholder="e.g. beam-mqtt-source-worker (optional, auto-generated)"
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500 font-mono"
        />
      </div>

      {/* 4. Authentication & Secret Manager */}
      <div className="p-3 bg-[#252836]/60 rounded border border-slate-700 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="flex items-center text-xs font-bold uppercase text-slate-400 gap-1.5">
            <Lock size={12} className="text-blue-400" />
            <span>Authentication & Credentials</span>
          </span>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 cursor-pointer text-xs text-slate-300">
              <input
                type="radio"
                name="passwordSource"
                value="secretManager"
                checked={passwordSource === 'secretManager'}
                onChange={handleChange}
                className="accent-blue-500"
              />
              <span>Secret Manager</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer text-xs text-slate-300">
              <input
                type="radio"
                name="passwordSource"
                value="direct"
                checked={passwordSource === 'direct'}
                onChange={handleChange}
                className="accent-blue-500"
              />
              <span>Direct Entry</span>
            </label>
          </div>
        </div>

        {/* Username */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="mqtt-username" className="text-xs font-bold uppercase text-slate-500">
            Username
          </label>
          <input
            id="mqtt-username"
            type="text"
            name="username"
            value={username}
            onChange={handleChange}
            placeholder="Broker username (optional)"
            className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500 font-mono"
          />
        </div>

        {/* Password or Secret Manager Selector */}
        {passwordSource === 'secretManager' ? (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="mqtt-secret-name" className="flex items-center text-xs font-bold uppercase text-slate-500 gap-1">
                <Key size={12} />
                <span>GCP Secret Manager Secret</span>
                <InfoTooltip
                  text="Select a secret from Google Cloud Secret Manager to provide broker credentials securely without hardcoding secrets."
                  position="auto"
                />
              </label>
              <button
                type="button"
                onClick={handleRefreshSecrets}
                disabled={isLoadingSecrets}
                className="text-xs text-blue-400 hover:underline flex items-center gap-1"
                title="Refresh secrets from Secret Manager"
              >
                <RefreshCw size={11} className={isLoadingSecrets ? 'animate-spin' : ''} />
                <span>Refresh</span>
              </button>
            </div>

            {secrets.length > 0 ? (
              <select
                id="mqtt-secret-name"
                name="secretName"
                value={secretName}
                onChange={handleChange}
                className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="">-- Select a Secret --</option>
                {secrets.map((sec) => (
                  <option key={sec.name} value={sec.name}>
                    {sec.name}
                  </option>
                ))}
              </select>
            ) : (
              <div className="flex flex-col gap-1">
                <input
                  id="mqtt-secret-name"
                  type="text"
                  name="secretName"
                  value={secretName}
                  onChange={handleChange}
                  placeholder="e.g. mqtt-broker-password"
                  className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500 font-mono"
                />
                <span className="text-xs text-slate-400">
                  No secrets automatically loaded. Enter secret resource name directly.
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="mqtt-password" className="text-xs font-bold uppercase text-slate-500">
              Password
            </label>
            <div className="relative">
              <input
                id="mqtt-password"
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={password}
                onChange={handleChange}
                placeholder="Broker password (optional)"
                className="w-full bg-[#252836] text-white p-2 pr-9 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 5. Quality of Service (QoS) - On its own full-width line */}
      <div className="flex flex-col gap-2">
        <label htmlFor="mqtt-qos" className="flex items-center text-xs font-bold uppercase text-slate-500">
          <span>QoS (Quality of Service)</span>
          <InfoTooltip
            text="MQTT Quality of Service level. 1 (At Least Once) is standard for stream ingestion. 0 (At Most Once) is best effort. 2 (Exactly Once) guarantees delivery but adds network overhead."
            position="auto"
          />
        </label>
        <select
          id="mqtt-qos"
          name="qos"
          value={qos}
          onChange={handleChange}
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
        >
          <option value="1">1 - At Least Once (Default)</option>
          <option value="0">0 - At Most Once</option>
          <option value="2">2 - Exactly Once</option>
        </select>
      </div>

      {/* 6. Connection Tuning (Timeout & Keep Alive) */}
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-2">
          <label htmlFor="mqtt-timeout" className="flex items-center text-xs font-bold uppercase text-slate-500">
            <span>Timeout (s)</span>
            <InfoTooltip
              text="Connection timeout interval in seconds before the client aborts connection attempts (default 30s)."
              position="top"
            />
          </label>
          <input
            id="mqtt-timeout"
            type="number"
            min="1"
            name="connectionTimeout"
            value={connectionTimeout}
            onChange={handleChange}
            placeholder="30"
            className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500 font-mono"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="mqtt-keepalive" className="flex items-center text-xs font-bold uppercase text-slate-500">
            <span>Keep Alive (s)</span>
            <InfoTooltip
              text="Maximum time interval in seconds between ping packets sent to the broker to keep the session alive (default 60s)."
              position="top"
            />
          </label>
          <input
            id="mqtt-keepalive"
            type="number"
            min="1"
            name="keepAlive"
            value={keepAlive}
            onChange={handleChange}
            placeholder="60"
            className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500 font-mono"
          />
        </div>
      </div>

      {/* 7. Payload & Metadata Mode */}
      <div className="p-2.5 rounded bg-[#252836]/60 border border-slate-700">
        <label className="flex items-start gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            name="useMetadata"
            checked={useMetadata}
            onChange={handleChange}
            className="mt-0.5 accent-blue-500 rounded"
          />
          <div className="flex flex-col gap-0.5">
            <span className="flex items-center text-xs font-bold text-white gap-1">
              <span>Read with Metadata</span>
              <code className="text-[11px] text-blue-400 bg-slate-800/80 px-1 py-0.5 rounded font-mono">MqttRecord</code>
              <InfoTooltip
                text="When enabled, calls MqttIO.readWithMetadata(), yielding PCollection<MqttRecord> with both topic string and byte[] payload. When disabled, yields raw PCollection<byte[]>."
                position="auto"
              />
            </span>
            <p className="text-xs text-slate-400">
              Outputs <code className="text-slate-300 bg-slate-800/60 px-1 py-0.5 rounded font-mono">MqttRecord</code> containing both topic name and payload. Recommended when subscribing to wildcard topics like <code className="text-slate-300 bg-slate-800/60 px-1 py-0.5 rounded font-mono">sensors/#</code>.
            </p>
          </div>
        </label>
      </div>

      {/* 8. Stream Bounding Limits (Testing / Hybrid) */}
      <div className="border border-slate-700 rounded p-2.5 bg-[#252836]/40 flex flex-col gap-2">
        <span className="flex items-center text-xs font-bold uppercase text-slate-500 gap-1">
          <span>Bounded Stream Limits (Testing / Hybrid)</span>
          <InfoTooltip
            text="Bound the streaming read by maximum record count or maximum duration. Useful for integration testing, demo runs, or bounded batch execution."
            position="auto"
          />
        </span>

        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-700/60">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="mqtt-max-records" className="text-xs font-bold uppercase text-slate-500">Max Records</label>
            <input
              id="mqtt-max-records"
              type="number"
              min="1"
              name="maxNumRecords"
              value={maxNumRecords}
              onChange={handleChange}
              placeholder="e.g. 1000"
              className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="mqtt-max-time" className="text-xs font-bold uppercase text-slate-500">Max Read Time (s)</label>
            <input
              id="mqtt-max-time"
              type="number"
              min="1"
              name="maxReadTime"
              value={maxReadTime}
              onChange={handleChange}
              placeholder="e.g. 60"
              className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>
        </div>
      </div>

      {/* Flexible Spacer */}
      <div className="flex-1 min-h-4" />

      {/* 9. Code Generation Instructions */}
      <div className="flex flex-col gap-2 pt-2 border-t border-slate-700/60">
        <label htmlFor="mqtt-instructions" className="flex items-center text-xs font-bold uppercase text-slate-500">
          <span>Code Generation Instructions</span>
          <InfoTooltip
            text="Custom instructions passed to the AI code generation model for this specific MQTT node (e.g., custom deserialization, payload decoding, or dead-letter topic)."
            position="auto"
          />
        </label>
        <textarea
          id="mqtt-instructions"
          name="system_instructions"
          value={systemInstructions}
          onChange={handleInstructionsChange}
          placeholder="e.g. Convert byte[] payload to UTF-8 JSON String and apply dead-letter queue on malformed packets"
          rows={3}
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500 resize-y"
        />
      </div>
    </div>
  );
};
