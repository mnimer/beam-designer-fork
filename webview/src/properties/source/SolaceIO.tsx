/**
 * SolaceIOSourceProperties Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Renders the property configuration panel for Apache Beam SolaceIO Streaming Source nodes.
 * Supports Apache Beam Java SDK (org.apache.beam.sdk.io.solace.SolaceIO) reading from Solace
 * PubSub+ queues or topics via JCSMP session service and SEMP client factories, and Python pipelines
 * via Apache Beam Cross-Language (x-lang) Java expansion service.
 * 
 * Architectural Decisions:
 * - Broker connectivity via distinct JCSMP host (SMF messaging port e.g. 55555) and SEMP host
 *   (HTTP/HTTPS management port e.g. 943), both strictly validated as required.
 * - Enforces secure credential management: username and VPN name as text, password strictly via
 *   Google Cloud Secret Manager ('getSecrets') with no plaintext fallback.
 * - Broker host suggestions queried from Compute Engine VM instances ('getComputeInstances').
 * - Mutually exclusive destination selector between Solace Queue (point-to-point) and Topic
 *   (pub/sub), displaying only the active destination field and documenting that topic reading
 *   creates a matching temporary or provisioned queue on the Solace broker.
 * - Advanced streaming source options: max concurrent connections, record deduplication, and
 *   custom timestamp function.
 * - Adopts the shared ExpansionServiceFields primitive for Python x-lang configuration.
 * - Integrates InfoTooltip components citing the official Apache Beam SolaceIO APIs and documentation.
 * - Adheres strictly to the 8pt grid system for spacing, padding, and layout.
 */

import React, { useState, useEffect } from 'react';
import { Server, Key, Lock, RefreshCw, Radio } from 'lucide-react';
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

export interface ComputeInstanceItem {
  name: string;
  status: string;
  internalIp: string;
  externalIp: string;
}

export interface SolaceIOSourceNode {
  data: {
    label: string;
    beam_transform?: string;
    system_instructions?: string;
    special_instructions?: string;
    properties?: {
      jcsmpHost?: string;
      sempHost?: string;
      vpnName?: string;
      username?: string;
      passwordSecret?: string;
      destinationType?: 'queue' | 'topic';
      queue?: string;
      topic?: string;
      maxNumConnections?: number | string;
      deduplicateRecords?: boolean;
      timestampFn?: string;
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

export interface SolaceIOSourcePropertiesProps {
  node: SolaceIOSourceNode;
  onChange: (properties: any) => void;
}

/**
 * SolaceIOSourceProperties renders the configuration form for Solace streaming source reads.
 * 
 * @param props Component properties containing the active node data and onChange callback.
 * @returns React functional component.
 */
export const SolaceIOSourceProperties: React.FC<SolaceIOSourcePropertiesProps> = ({ node, onChange }) => {
  const properties = node.data.properties || {};

  // Form field state values with fallbacks
  const jcsmpHost = properties.jcsmpHost || '';
  const sempHost = properties.sempHost || '';
  const vpnName = properties.vpnName !== undefined ? properties.vpnName : 'default';
  const username = properties.username || '';
  const passwordSecret = properties.passwordSecret || '';
  const destinationType = properties.destinationType || (properties.topic ? 'topic' : 'queue');
  const queue = properties.queue || '';
  const topic = properties.topic || '';
  const maxNumConnections = properties.maxNumConnections ?? '';
  const deduplicateRecords = properties.deduplicateRecords ?? false;
  const timestampFn = properties.timestampFn || '';
  const expansionServiceMode = properties.expansionServiceMode || 'auto';
  const expansionServiceEndpoint = properties.expansionServiceEndpoint || '';

  // Local UI states
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

  // NOTE: Listen for Secret Manager secrets and Compute Engine instances from the extension host
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
   * Handles switching destination type between Queue and Topic.
   * 
   * @param e Select change event.
   */
  const handleDestinationTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newType = e.target.value as 'queue' | 'topic';
    onChange({
      ...properties,
      destinationType: newType
    });
  };

  /**
   * Applies helper value to JCSMP host.
   * 
   * @param host Endpoint host:port string.
   */
  const handleApplyJcsmpHelper = (host: string) => {
    onChange({
      ...properties,
      jcsmpHost: host
    });
  };

  /**
   * Applies helper value to SEMP host.
   * 
   * @param host Endpoint URI string.
   */
  const handleApplySempHelper = (host: string) => {
    onChange({
      ...properties,
      sempHost: host
    });
  };

  /**
   * Applies a selected Compute Engine instance IP to JCSMP and SEMP host endpoints.
   * 
   * @param ip IP address of the VM instance.
   */
  const handleSelectInstanceIp = (ip: string) => {
    const newProps = {
      ...properties,
      jcsmpHost: `${ip}:55555`
    };
    if (!sempHost || sempHost.includes('localhost')) {
      newProps.sempHost = `https://${ip}:943`;
    }
    onChange(newProps);
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
  const isJcsmpHostMissing = !jcsmpHost.trim();
  const isSempHostMissing = !sempHost.trim();
  const isVpnNameMissing = !vpnName.trim();
  const isUsernameMissing = !username.trim();
  const isPasswordSecretMissing = !passwordSecret.trim();
  const isQueueMissing = destinationType === 'queue' && !queue.trim();
  const isTopicMissing = destinationType === 'topic' && !topic.trim();

  return (
    <div className="flex-1 flex flex-col gap-4">
      {/* 1. Connection & Authentication */}
      <div className="p-3 bg-[#252836]/60 rounded border border-slate-700 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="flex items-center text-xs font-bold uppercase text-slate-400 gap-1.5">
            <Server size={12} className="text-blue-400" />
            <span>Broker Connection & Credentials</span>
            <InfoTooltip
              text="Connection endpoints and credentials for Apache Beam SolaceIO reader. Uses BasicAuthJcsmpSessionServiceFactory for data streaming and BasicAuthSempClientFactory for queue inspection."
              position="auto"
            />
          </span>
        </div>

        {/* JCSMP Host */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="solace-source-jcsmp-host" className="flex items-center text-xs font-bold uppercase text-slate-500">
              <span>JCSMP Host (SMF Messaging)</span>
              <span className="text-red-400 ml-1 font-bold" title="Required">*</span>
              <InfoTooltip
                text="Solace SMF messaging host and port (e.g. host:55555 or tcp://host:55555). Used by BasicAuthJcsmpSessionServiceFactory.builder().host(...)."
                position="auto"
              />
            </label>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleApplyJcsmpHelper('localhost:55555')}
                className="px-1.5 py-0.5 rounded text-[10px] bg-slate-700 text-slate-200 hover:bg-slate-600 transition-colors"
                title="Use localhost:55555 default"
              >
                localhost:55555
              </button>
            </div>
          </div>
          <PropertyField
            id="solace-source-jcsmp-host"
            name="jcsmpHost"
            value={jcsmpHost}
            onChange={handleChange}
            placeholder="e.g. localhost:55555 or tcp://broker.solace:55555"
            required="JCSMP host is required."
            aria-required="true"
            aria-invalid={isJcsmpHostMissing}
            invalid={isJcsmpHostMissing}
            error={isJcsmpHostMissing ? 'JCSMP host is required.' : null}
            helperText="Format: Host[:Port] (e.g. localhost:55555)"
            mono={true}
          />
        </div>

        {/* SEMP Host */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="solace-source-semp-host" className="flex items-center text-xs font-bold uppercase text-slate-500">
              <span>SEMP Host (Management HTTPS)</span>
              <span className="text-red-400 ml-1 font-bold" title="Required">*</span>
              <InfoTooltip
                text="Solace Element Management Protocol (SEMP) client host and port (e.g. https://host:943). Used by BasicAuthSempClientFactory.builder().host(...)."
                position="auto"
              />
            </label>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleApplySempHelper('https://localhost:943')}
                className="px-1.5 py-0.5 rounded text-[10px] bg-slate-700 text-slate-200 hover:bg-slate-600 transition-colors"
                title="Use https://localhost:943 default"
              >
                https://localhost:943
              </button>
            </div>
          </div>
          <PropertyField
            id="solace-source-semp-host"
            name="sempHost"
            value={sempHost}
            onChange={handleChange}
            placeholder="e.g. https://localhost:943 or https://broker.solace:943"
            required="SEMP host is required."
            aria-required="true"
            aria-invalid={isSempHostMissing}
            invalid={isSempHostMissing}
            error={isSempHostMissing ? 'SEMP host is required.' : null}
            helperText="Format: [Protocol://]Host[:Port] (e.g. https://localhost:943)"
            mono={true}
          />
        </div>

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
        {instanceError && (
          <span className="text-xs text-red-400 mt-1" role="alert">
            {instanceError}
          </span>
        )}

        {/* VPN Name */}
        <PropertyField
          id="solace-source-vpn-name"
          name="vpnName"
          label="Message VPN Name"
          value={vpnName}
          onChange={handleChange}
          placeholder="default"
          required="Message VPN name is required."
          aria-required="true"
          aria-invalid={isVpnNameMissing}
          invalid={isVpnNameMissing}
          error={isVpnNameMissing ? 'Message VPN name is required.' : null}
          tooltip="Solace Message VPN name configured on the broker for SEMP client and JCSMP session connections."
          mono={true}
        />

        {/* Username */}
        <PropertyField
          id="solace-source-username"
          name="username"
          label="Username"
          value={username}
          onChange={handleChange}
          placeholder="e.g. solace-client-user"
          required="Username is required."
          aria-required="true"
          aria-invalid={isUsernameMissing}
          invalid={isUsernameMissing}
          error={isUsernameMissing ? 'Username is required.' : null}
          tooltip="Client username for basic authentication to the Solace broker."
          mono={true}
        />

        {/* Password via Secret Manager */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="solace-source-password-secret" className="flex items-center text-xs font-bold uppercase text-slate-500 gap-1">
              <Lock size={12} className="text-blue-400" />
              <span>Password (Secret Manager)</span>
              <span className="text-red-400 ml-1 font-bold" title="Required">*</span>
              <InfoTooltip
                text="Google Cloud Secret Manager secret resource containing the Solace password. Passwords are never stored in plaintext."
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
            id="solace-source-password-secret"
            name="passwordSecret"
            value={passwordSecret}
            onChange={handleChange}
            placeholder="e.g. solace-client-password"
            required="Password secret name is required."
            aria-required="true"
            aria-invalid={isPasswordSecretMissing}
            invalid={isPasswordSecretMissing}
            error={isPasswordSecretMissing ? 'Password secret is required.' : (secretError || null)}
            list="solace-source-secrets-datalist"
            helperText={
              <span>
                Values auto-populated from{' '}
                <code className="text-slate-300 bg-slate-800/60 px-1 py-0.5 rounded">
                  gcloud secrets list
                </code>
                . Manual entry supported.
              </span>
            }
            mono={true}
          >
            <datalist id="solace-source-secrets-datalist">
              {secrets.map((sec, idx) => (
                <option key={`${sec.name}-${idx}`} value={sec.value || sec.name}>
                  {sec.fullName ? `${sec.name} (${sec.fullName})` : sec.name}
                </option>
              ))}
            </datalist>
          </PropertyField>
          {/* NOTE: Generated code resolves the secret from Google Cloud Secret Manager at runtime. */}
          {secretError && (
            <span className="text-xs text-red-400 mt-1" role="alert">
              {secretError}
            </span>
          )}
        </div>
      </div>

      {/* 2. Destination Configuration */}
      <div className="p-3 bg-[#252836]/60 rounded border border-slate-700 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="flex items-center text-xs font-bold uppercase text-slate-400 gap-1.5">
            <Radio size={12} className="text-blue-400" />
            <span>Destination Configuration</span>
            <InfoTooltip
              text="Select whether to read from a Solace Queue or Topic. In Apache Beam SolaceIO, reading from a Topic requires creating a matching queue on the broker."
              position="auto"
            />
          </span>
        </div>

        {/* Destination Type Selector */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="solace-source-destination-type" className="flex items-center text-xs font-bold uppercase text-slate-500">
            <span>Destination Type</span>
            <InfoTooltip
              text="Solace destination to read from. SolaceIO.read() can consume from a Solace Queue (.from(Solace.Queue.fromName(name))) or a Solace Topic (.from(Solace.Topic.fromName(name)))."
              position="auto"
            />
          </label>
          <select
            id="solace-source-destination-type"
            name="destinationType"
            value={destinationType}
            onChange={handleDestinationTypeChange}
            className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
          >
            <option value="queue">Queue (Solace.Queue.fromName)</option>
            <option value="topic">Topic (Solace.Topic.fromName)</option>
          </select>
        </div>

        {/* Mutually exclusive destination input */}
        {destinationType === 'queue' ? (
          <PropertyField
            id="solace-source-queue"
            name="queue"
            label="Queue Name"
            value={queue}
            onChange={handleChange}
            placeholder="e.g. incoming-orders-queue"
            required="Queue name is required when reading from a Queue."
            aria-required="true"
            aria-invalid={isQueueMissing}
            invalid={isQueueMissing}
            error={isQueueMissing ? 'Queue name is required when reading from a Queue.' : null}
            tooltip="Solace Queue name to consume guaranteed messages from (Solace.Queue.fromName(name))."
            mono={true}
          />
        ) : (
          <PropertyField
            id="solace-source-topic"
            name="topic"
            label="Topic Name"
            value={topic}
            onChange={handleChange}
            placeholder="e.g. events/orders/>"
            required="Topic name is required when reading from a Topic."
            aria-required="true"
            aria-invalid={isTopicMissing}
            invalid={isTopicMissing}
            error={isTopicMissing ? 'Topic name is required when reading from a Topic.' : null}
            tooltip="Solace Topic subscription string to consume from (Solace.Topic.fromName(name)). NOTE: Reading from a Topic requires the Solace connector to create a matching temporary or provisioned queue to subscribe to the topic on the broker."
            helperText="NOTE: Reading from a Topic requires the connector to create a matching queue on the Solace broker."
            mono={true}
          />
        )}
      </div>

      {/* 3. Stream Performance & Advanced Read Options */}
      <div className="p-3 bg-[#252836]/60 rounded border border-slate-700 flex flex-col gap-3">
        <span className="flex items-center text-xs font-bold uppercase text-slate-400 gap-1.5">
          <Key size={12} className="text-blue-400" />
          <span>Stream Performance & Read Options</span>
        </span>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Max Connections */}
          <PropertyField
            id="solace-source-max-connections"
            name="maxNumConnections"
            label="Max Concurrent Connections"
            type="number"
            min={1}
            value={maxNumConnections}
            onChange={handleChange}
            placeholder="1"
            tooltip="Maximum number of concurrent client connections/consumers to establish (.withMaxNumConnections(int))."
            mono={true}
          />

          {/* Timestamp Function */}
          <PropertyField
            id="solace-source-timestamp-fn"
            name="timestampFn"
            label="Timestamp Function"
            value={timestampFn}
            onChange={handleChange}
            placeholder="e.g. record -> Instant.ofEpochMilli(...)"
            tooltip="Custom timestamp extractor function to assign event timestamps to records (.withTimestampFn(SerializableFunction))."
            helperText="Java lambda expression (e.g. record -> Instant.ofEpochMilli(...)). Applicable only to Java pipelines; not supported in Python cross-language pipelines."
            mono={true}
          />
        </div>

        {/* Deduplicate Records Checkbox */}
        <div className="flex items-center gap-2 pt-1">
          <input
            id="solace-source-deduplicate-records"
            type="checkbox"
            name="deduplicateRecords"
            checked={deduplicateRecords}
            onChange={handleChange}
            className="w-4 h-4 rounded border-slate-700 bg-[#252836] text-blue-500 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer accent-blue-500"
          />
          <label htmlFor="solace-source-deduplicate-records" className="text-xs text-slate-300 cursor-pointer flex items-center gap-1.5">
            <span>Deduplicate Records</span>
            <InfoTooltip
              text="Whether to deduplicate received Solace records based on replication or message IDs (.withDeduplicateRecords(boolean))."
              position="auto"
            />
          </label>
        </div>
      </div>

      {/* 4. Expansion Service (Python x-lang) */}
      <ExpansionServiceFields
        transformName="SolaceIO"
        idPrefix="solace-source"
        mode={expansionServiceMode}
        endpoint={expansionServiceEndpoint}
        onChange={handleChange}
      />

      {/* Flexible Spacer */}
      <div className="flex-1 min-h-4" />

      {/* 5. Code Generation Instructions */}
      <div className="pt-2 border-t border-slate-700/60">
        <PropertyField
          id="solace-source-instructions"
          name="system_instructions"
          label="Code Generation Instructions"
          tooltip="Custom instructions passed to the AI code generation model for this specific Solace source node (e.g. custom message payload decoding, error handling, or schema mappings)."
          type="textarea"
          rows={3}
          value={systemInstructions}
          onChange={handleInstructionsChange}
          placeholder="e.g. Deserialize Solace BytesXMLMessage payload into domain records..."
          mono={false}
          className="resize-y"
        />
      </div>
    </div>
  );
};
