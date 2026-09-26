/**
 * AmqpIOSinkProperties Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Renders the property configuration panel for Apache Beam AmqpIO Streaming Sink nodes.
 * Supports Apache Beam Java SDK (org.apache.beam.sdk.io.amqp.AmqpIO) publishing AMQP 1.0
 * Proton messages via AmqpIO.write() and Python pipelines via Apache Beam Cross-Language (x-lang)
 * Java expansion service.
 * 
 * Architectural Decisions:
 * - In Apache Beam Java SDK, AmqpIO.write() reads the destination address from each individual
 *   Proton Message (message.setAddress(...)) rather than configuring it on the transform directly.
 *   This panel exposes a default target address and message construction options (subject, encoding,
 *   durability, priority, TTL) so preceding DoFn transforms can build well-formed messages.
 * - Broker address controls with quick-select protocol helper pills (amqp:// on 5672, amqps:// on 5671).
 * - Queries the VS Code extension for Google Cloud Secret Manager secrets ('getSecrets') for runtime credential resolution, without persisting passwords in the pipeline definition.
 * - Enforces required field validation with semantic red borders for empty target address and expansionServiceEndpoint.
 * - Message durability toggle ('durable') configuring message.setDurable(true) for persistent broker queues.
 * - Message body type selection (AmqpValue vs Data) supporting UTF-8 text strings, JSON serialized payloads, and raw binary byte arrays.
 * - Optional MIME content-type and transfer content-encoding headers for Proton Messages.
 * - Python x-lang Expansion Service configuration group supporting 'auto' and 'endpoint' modes.
 * - Integrates InfoTooltip components citing the official Apache Beam AmqpIO documentation and APIs.
 * - Adheres strictly to the 8pt grid system for spacing and sizing.
 */

import React, { useState, useEffect } from 'react';
import { Key, Lock, RefreshCw, Layers } from 'lucide-react';
import { InfoTooltip } from '../../components/InfoTooltip';
import { PropertyField } from '../../components/common/PropertyField';
import { ExpansionServiceFields } from '../../components/common/ExpansionServiceFields';

export interface SecretItem {
  name: string;
  fullName?: string;
  value: string;
  id?: string;
  [key: string]: any;
}

export interface AmqpIOSinkNode {
  data: {
    label: string;
    beam_transform?: string;
    system_instructions?: string;
    special_instructions?: string;
    properties?: {
      address?: string;
      subject?: string;
      bodyType?: 'utf8String' | 'json' | 'bytes';
      contentType?: string;
      contentEncoding?: string;
      durable?: boolean;
      priority?: number | string;
      ttlMillis?: number | string;
      username?: string;
      secretName?: string;
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

export interface AmqpIOSinkPropertiesProps {
  node: AmqpIOSinkNode;
  onChange: (properties: any) => void;
}

/**
 * AmqpIOSinkProperties renders the configuration form for AMQP 1.0 streaming sink writes.
 * 
 * @param props Component properties containing the active node data and onChange callback.
 * @returns React functional component.
 */
export const AmqpIOSinkProperties: React.FC<AmqpIOSinkPropertiesProps> = ({ node, onChange }) => {
  const properties = node.data.properties || {};

  // Form field state values with fallbacks
  const address = properties.address || '';
  const subject = properties.subject || '';
  const bodyType = properties.bodyType ?? properties.contentEncoding ?? 'utf8String';
  const contentType = properties.contentType || '';
  const contentEncoding = properties.bodyType !== undefined
    ? (properties.contentEncoding || '')
    : (['utf8String', 'json', 'bytes'].includes(properties.contentEncoding || '') ? '' : (properties.contentEncoding || ''));
  const durable = properties.durable ?? false;
  const priority = properties.priority !== undefined ? String(properties.priority) : '4';
  const ttlMillis = properties.ttlMillis ?? '';
  const username = properties.username || '';
  const secretName = properties.secretName || '';
  const expansionServiceMode = properties.expansionServiceMode || 'auto';
  const expansionServiceEndpoint = properties.expansionServiceEndpoint || '';

  // Local UI states
  const [secrets, setSecrets] = useState<SecretItem[]>([]);
  const [secretError, setSecretError] = useState<string | null>(null);
  const [isLoadingSecrets, setIsLoadingSecrets] = useState(false);

  // System instructions text with fallback
  const systemInstructions =
    node.data.system_instructions ??
    node.data.special_instructions ??
    properties.system_instructions ??
    properties.special_instructions ??
    '';

  // NOTE: Listen for Secret Manager secrets from the extension host
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
   * Applies protocol prefix helper to the target address, swapping default ports where appropriate.
   * 
   * @param protocol URI scheme prefix (e.g. 'amqp://', 'amqps://').
   */
  const handleApplyProtocol = (protocol: string) => {
    const targetDefaultPort = protocol === 'amqps://' ? '5671' : '5672';
    const sourceDefaultPort = protocol === 'amqps://' ? '5672' : '5671';
    let withoutScheme = address.trim().replace(/^[a-zA-Z]+:\/\//, '');
    if (!withoutScheme) {
      withoutScheme = `localhost:${targetDefaultPort}/queue`;
    } else {
      withoutScheme = withoutScheme.replace(new RegExp(`:${sourceDefaultPort}(?=[/?#]|$)`), `:${targetDefaultPort}`);
    }
    onChange({
      ...properties,
      address: `${protocol}${withoutScheme}`
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

  // Field validation flags
  const isAddressMissing = !address.trim();
  const priorityStr = priority !== undefined ? String(priority).trim() : '';
  const priorityNum = Number(priority);
  const isPriorityInvalid =
    priorityStr !== '' &&
    (isNaN(priorityNum) || priorityNum < 0 || priorityNum > 9 || !Number.isInteger(priorityNum));
  const priorityError = isPriorityInvalid ? 'Priority must be an integer between 0 and 9.' : undefined;

  return (
    <div className="flex-1 flex flex-col gap-4">
      {/* 1. Destination Address Configuration */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label htmlFor="amqp-sink-address" className="flex items-center text-xs font-bold uppercase text-slate-500">
            <span>Target AMQP Address</span>
            <span className="text-red-400 ml-1 font-bold" title="Required">*</span>
            <InfoTooltip
              text="Target AMQP 1.0 address URI (e.g. amqp://broker:5672/queue). NOTE: Beam's AmqpIO.write() reads destination address from each individual Message (message.setAddress(...)), configured during message construction."
              position="auto"
            />
          </label>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handleApplyProtocol('amqp://')}
              className="px-1.5 py-0.5 rounded text-[10px] bg-slate-700 text-slate-200 hover:bg-slate-600 transition-colors"
              title="Set amqp:// scheme (standard port 5672)"
            >
              amqp://
            </button>
            <button
              type="button"
              onClick={() => handleApplyProtocol('amqps://')}
              className="px-1.5 py-0.5 rounded text-[10px] bg-slate-700 text-slate-200 hover:bg-slate-600 transition-colors"
              title="Set amqps:// scheme (TLS port 5671)"
            >
              amqps://
            </button>
          </div>
        </div>

        <PropertyField
          id="amqp-sink-address"
          name="address"
          required="Target AMQP address is required."
          aria-required="true"
          aria-invalid={isAddressMissing}
          value={address}
          onChange={handleChange}
          placeholder="amqp://localhost:5672/queue"
          error={isAddressMissing ? 'Target AMQP address is required.' : null}
          invalid={isAddressMissing}
          mono={true}
          helperText={
            <span>
              NOTE: Beam&apos;s <code className="text-slate-300 bg-slate-800/60 px-1 py-0.5 rounded font-mono">AmqpIO.write()</code> reads destination address from each individual Proton <code className="text-slate-300 bg-slate-800/60 px-1 py-0.5 rounded font-mono">Message</code> (<code className="text-slate-300 bg-slate-800/60 px-1 py-0.5 rounded font-mono">message.setAddress(...)</code>).
            </span>
          }
        />
      </div>

      {/* 2. Message Construction & Delivery Options */}
      {/* NOTE: In Apache Beam Java SDK, AmqpIO.write() takes no address argument directly on the transform.
          Instead, each incoming Message must carry its destination address (message.setAddress(...)).
          This panel configures the default/target address and delivery attributes used during message construction. */}
      <div className="p-3 bg-[#252836]/60 rounded border border-slate-700 flex flex-col gap-3">
        <span className="flex items-center text-xs font-bold uppercase text-slate-400 gap-1.5">
          <Layers size={12} className="text-blue-400" />
          <span>Message Construction & Delivery</span>
          <InfoTooltip
            text="Options applied when constructing Proton Messages before passing them to AmqpIO.write()."
            position="auto"
          />
        </span>

        {/* Subject / Message Type */}
        <PropertyField
          id="amqp-sink-subject"
          name="subject"
          label="Subject / Message Type (Optional)"
          tooltip="AMQP message subject set via message.setSubject(String), identifying the message purpose or event type."
          value={subject}
          onChange={handleChange}
          placeholder="e.g. order.created or telemetry.event"
          mono={true}
        />

        {/* Message Body Type */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="amqp-sink-body-type" className="flex items-center text-xs font-bold uppercase text-slate-500">
            <span>Message Body Type</span>
            <InfoTooltip
              text="Format used to construct the Proton Message body section (AmqpValue for strings/JSON, Data for raw bytes)."
              position="auto"
            />
          </label>
          <select
            id="amqp-sink-body-type"
            name="bodyType"
            value={bodyType}
            onChange={handleChange}
            className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
          >
            <option value="utf8String">UTF-8 String (AmqpValue)</option>
            <option value="json">JSON Object (AmqpValue)</option>
            <option value="bytes">Raw Binary (Data)</option>
          </select>
        </div>

        {/* Content Type & Content Encoding */}
        <div className="grid grid-cols-2 gap-2">
          <PropertyField
            id="amqp-sink-content-type"
            name="contentType"
            label="Content-Type (Optional)"
            tooltip="MIME content type header (e.g. application/json, text/plain) set via message.setContentType(String)."
            value={contentType}
            onChange={handleChange}
            placeholder="application/json"
            mono={true}
          />
          <PropertyField
            id="amqp-sink-content-encoding"
            name="contentEncoding"
            label="Content-Encoding (Optional)"
            tooltip="Transfer encoding/compression header (e.g. gzip) set via message.setContentEncoding(String)."
            value={contentEncoding}
            onChange={handleChange}
            placeholder="gzip"
            mono={true}
          />
        </div>

        {/* Durable Flag */}
        <div className="p-2.5 rounded bg-[#252836]/60 border border-slate-700">
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              name="durable"
              checked={durable}
              onChange={handleChange}
              className="mt-0.5 accent-blue-500 rounded"
            />
            <div className="flex flex-col gap-0.5">
              <span className="flex items-center text-xs font-bold text-white gap-1">
                <span>Durable Messages</span>
                <code className="text-[11px] text-blue-400 bg-slate-800/80 px-1 py-0.5 rounded font-mono">message.setDurable(true)</code>
                <InfoTooltip
                  text="Instructs AMQP brokers to persist the message to disk before acknowledging, ensuring durability across broker restarts."
                  position="auto"
                />
              </span>
              <p className="text-xs text-slate-400">
                When enabled, sets message header durable flag to ensure messages survive broker restarts.
              </p>
            </div>
          </label>
        </div>

        {/* Priority & TTL */}
        <div className="grid grid-cols-2 gap-2">
          <PropertyField
            id="amqp-sink-priority"
            type="number"
            min="0"
            max="9"
            step="1"
            name="priority"
            label="Message Priority (0-9)"
            tooltip="AMQP message priority between 0 (lowest) and 9 (highest). Default is 4 (standard priority)."
            value={priority}
            onChange={handleChange}
            placeholder="4"
            invalid={isPriorityInvalid}
            error={priorityError}
            mono={true}
          />
          <PropertyField
            id="amqp-sink-ttl"
            type="number"
            min="0"
            name="ttlMillis"
            label="TTL (ms)"
            tooltip="Message time-to-live in milliseconds before the broker expires and discards unconsumed messages (0 or blank for no expiry)."
            value={ttlMillis}
            onChange={handleChange}
            placeholder="e.g. 60000"
            mono={true}
          />
        </div>
      </div>

      {/* 3. Authentication & Secret Manager */}
      <div className="p-3 bg-[#252836]/60 rounded border border-slate-700 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="flex items-center text-xs font-bold uppercase text-slate-400 gap-1.5">
            <Lock size={12} className="text-blue-400" />
            <span>Authentication & Credentials</span>
          </span>
        </div>

        <p className="text-xs text-slate-400">
          AMQP 1.0 broker credentials are authenticated via Google Cloud Secret Manager. Generated pipeline code resolves the username and secret to construct connection URIs without storing passwords in the pipeline definition.
        </p>

        {/* Username */}
        <PropertyField
          id="amqp-sink-username"
          name="username"
          label="Username"
          value={username}
          onChange={handleChange}
          placeholder="Broker username (optional)"
          mono={true}
        />

        {/* Secret Manager Secret */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="amqp-sink-secret-name" className="flex items-center text-xs font-bold uppercase text-slate-500 gap-1">
              <Key size={12} />
              <span>GCP Secret Manager Secret</span>
              <InfoTooltip
                text="Select a secret from Google Cloud Secret Manager to provide AMQP broker credentials securely without hardcoding secrets."
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

          <PropertyField
            id="amqp-sink-secret-name"
            name="secretName"
            value={secretName}
            onChange={handleChange}
            placeholder="e.g. amqp-broker-password"
            datalist={secrets.map((sec) => ({ value: sec.name, label: sec.name }))}
            error={secretError}
            invalid={!!secretError}
            helperText={
              secrets.length > 0
                ? 'Select from discovered secrets or type a custom secret ID.'
                : 'No secrets automatically loaded. Enter secret resource name directly.'
            }
            mono={true}
          />
        </div>
      </div>

      {/* 4. Python Cross-Language Expansion Service */}
      <ExpansionServiceFields
        transformName="AmqpIO"
        idPrefix="amqp-sink"
        mode={expansionServiceMode}
        endpoint={expansionServiceEndpoint}
        onChange={handleChange}
      />

      {/* Flexible Spacer */}
      <div className="flex-1 min-h-4" />

      {/* 5. Code Generation Instructions */}
      <div className="pt-2 border-t border-slate-700/60">
        <PropertyField
          id="amqp-sink-instructions"
          name="system_instructions"
          label="Code Generation Instructions"
          tooltip="Custom instructions passed to the AI code generation model for this specific AMQP sink node (e.g. mapping POJO fields to Proton Message body, headers, or correlation IDs)."
          type="textarea"
          rows={3}
          value={systemInstructions}
          onChange={handleInstructionsChange}
          placeholder="e.g. Map output elements to Proton Message instances with destination address and durable delivery flag"
          mono={false}
          className="resize-y"
        />
      </div>
    </div>
  );
};
