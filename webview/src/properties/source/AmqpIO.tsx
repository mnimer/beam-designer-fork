/**
 * AmqpIOSourceProperties Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Renders the property configuration panel for Apache Beam AmqpIO Streaming Source nodes.
 * Supports Apache Beam Java SDK (org.apache.beam.sdk.io.amqp.AmqpIO) reading AMQP 1.0
 * Proton messages (AmqpIO.read().withAddresses(List<String>)) and Python pipelines
 * via Apache Beam Cross-Language (x-lang) Java expansion service.
 * 
 * Architectural Decisions:
 * - Multi-address endpoint input allowing one or more AMQP 1.0 broker address URIs (newline-separated),
 *   with quick-select protocol helper pills (amqp:// on port 5672, amqps:// on port 5671).
 * - Queries the VS Code extension for Google Cloud Secret Manager secrets ('getSecrets') for runtime credential resolution, without persisting passwords in the pipeline definition.
 * - Enforces required field validation with semantic red borders for empty addresses and expansionServiceEndpoint.
 * - Supports bounded read limits (maxNumRecords, maxReadTime) for hybrid execution and testing,
 *   with tooltips explicitly documenting that limits produce a bounded PCollection.
 * - Python x-lang Expansion Service configuration group supporting 'auto' (automatic Java expansion service)
 *   and 'endpoint' (custom expansion service host:port) modes.
 * - Integrates InfoTooltip components citing the official Apache Beam AmqpIO documentation and APIs.
 * - Adheres strictly to the 8pt grid system for spacing, padding, and layout.
 */

import React, { useState, useEffect } from 'react';
import { Key, Lock, RefreshCw } from 'lucide-react';
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

export interface AmqpIOSourceNode {
  data: {
    label: string;
    beam_transform?: string;
    system_instructions?: string;
    special_instructions?: string;
    properties?: {
      addresses?: string | string[];
      username?: string;
      secretName?: string;
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

export interface AmqpIOSourcePropertiesProps {
  node: AmqpIOSourceNode;
  onChange: (properties: any) => void;
}

/**
 * AmqpIOSourceProperties renders the configuration form for AMQP 1.0 streaming source reads.
 * 
 * @param props Component properties containing the active node data and onChange callback.
 * @returns React functional component.
 */
export const AmqpIOSourceProperties: React.FC<AmqpIOSourcePropertiesProps> = ({ node, onChange }) => {
  const properties = node.data.properties || {};

  // Form field state values with fallbacks
  // NOTE: Normalize addresses so both newline-separated strings and string arrays resolve cleanly
  const rawAddresses = properties.addresses;
  const addresses = Array.isArray(rawAddresses) ? rawAddresses.join('\n') : (rawAddresses || '');
  const username = properties.username || '';
  const secretName = properties.secretName || '';
  const maxNumRecords = properties.maxNumRecords ?? '';
  const maxReadTime = properties.maxReadTime ?? '';
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
   * Applies protocol prefix helper to all broker addresses, swapping default ports where appropriate.
   * 
   * @param protocol URI scheme prefix (e.g. 'amqp://', 'amqps://').
   */
  const handleApplyProtocol = (protocol: string) => {
    const targetDefaultPort = protocol === 'amqps://' ? '5671' : '5672';
    const sourceDefaultPort = protocol === 'amqps://' ? '5672' : '5671';
    const lines = addresses.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) {
      onChange({
        ...properties,
        addresses: `${protocol}localhost:${targetDefaultPort}/queue`
      });
      return;
    }
    const convertedLines = lines.map((line) => {
      let withoutScheme = line.replace(/^[a-zA-Z]+:\/\//, '');
      if (!withoutScheme) {
        return `${protocol}localhost:${targetDefaultPort}/queue`;
      }
      withoutScheme = withoutScheme.replace(new RegExp(`:${sourceDefaultPort}(?=[/?#]|$)`), `:${targetDefaultPort}`);
      return `${protocol}${withoutScheme}`;
    });
    onChange({
      ...properties,
      addresses: convertedLines.join('\n')
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
  const isAddressesMissing = !addresses.trim();

  return (
    <div className="flex-1 flex flex-col gap-4">
      {/* 1. Address Configuration */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label htmlFor="amqp-source-addresses" className="flex items-center text-xs font-bold uppercase text-slate-500">
            <span>Broker Addresses</span>
            <span className="text-red-400 ml-1 font-bold" title="Required">*</span>
            <InfoTooltip
              text="One or more AMQP 1.0 broker address URIs to consume from (one per line, e.g. amqp://host:5672/queue or amqps://host:5671/topic). Used by AmqpIO.read().withAddresses(List<String>)."
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
          id="amqp-source-addresses"
          name="addresses"
          type="textarea"
          rows={3}
          required="At least one AMQP address is required."
          aria-required="true"
          aria-invalid={isAddressesMissing}
          value={addresses}
          onChange={handleChange}
          placeholder="amqp://localhost:5672/queue&#10;amqp://backup-broker:5672/queue"
          error={isAddressesMissing ? 'At least one AMQP address is required.' : null}
          invalid={isAddressesMissing}
          mono={true}
          helperText="Enter one AMQP 1.0 address URI per line (e.g. amqp://host:5672/queue or amqps://host:5671/topic)."
        />
      </div>

      {/* 2. Authentication & Secret Manager */}
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
          id="amqp-source-username"
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
            <label htmlFor="amqp-source-secret-name" className="flex items-center text-xs font-bold uppercase text-slate-500 gap-1">
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
            id="amqp-source-secret-name"
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

      {/* 3. Stream Bounding Limits (Testing / Hybrid) */}
      <div className="border border-slate-700 rounded p-2.5 bg-[#252836]/40 flex flex-col gap-2">
        <span className="flex items-center text-xs font-bold uppercase text-slate-500 gap-1">
          <span>Bounded Stream Limits (Testing / Hybrid)</span>
          <InfoTooltip
            text="Bound the AMQP read by record count (AmqpIO.read().withMaxNumRecords(long)) or duration (AmqpIO.read().withMaxReadTime(Duration)). Specifying either option turns the streaming ingestion into a bounded PCollection for integration testing or batch pipelines."
            position="auto"
          />
        </span>

        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-700/60">
          <PropertyField
            id="amqp-source-max-records"
            type="number"
            min="1"
            name="maxNumRecords"
            label="Max Records"
            tooltip="Maximum number of records to read before completing (AmqpIO.read().withMaxNumRecords(long)). Produces a bounded read."
            value={maxNumRecords}
            onChange={handleChange}
            placeholder="e.g. 1000"
            mono={true}
          />
          <PropertyField
            id="amqp-source-max-time"
            type="number"
            min="1"
            name="maxReadTime"
            label="Max Read Time (s)"
            tooltip="Maximum read duration in seconds before completing (AmqpIO.read().withMaxReadTime(Duration)). Produces a bounded read."
            value={maxReadTime}
            onChange={handleChange}
            placeholder="e.g. 60"
            mono={true}
          />
        </div>
      </div>

      {/* 4. Python Cross-Language Expansion Service */}
      <ExpansionServiceFields
        transformName="AmqpIO"
        idPrefix="amqp-source"
        mode={expansionServiceMode}
        endpoint={expansionServiceEndpoint}
        onChange={handleChange}
      />

      {/* Flexible Spacer */}
      <div className="flex-1 min-h-4" />

      {/* 5. Code Generation Instructions */}
      <div className="pt-2 border-t border-slate-700/60">
        <PropertyField
          id="amqp-source-instructions"
          name="system_instructions"
          label="Code Generation Instructions"
          tooltip="Custom instructions passed to the AI code generation model for this specific AMQP source node (e.g. Proton Message decoding, custom filter headers, or dead-letter routing)."
          type="textarea"
          rows={3}
          value={systemInstructions}
          onChange={handleInstructionsChange}
          placeholder="e.g. Extract JSON string from AMQP Proton Message body and route malformed records to DLQ"
          mono={false}
          className="resize-y"
        />
      </div>
    </div>
  );
};
