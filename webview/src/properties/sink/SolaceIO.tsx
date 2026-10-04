/**
 * SolaceIOSinkProperties Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Renders the property configuration panel for Apache Beam SolaceIO Streaming Sink nodes.
 * Supports Apache Beam Java SDK (org.apache.beam.sdk.io.solace.SolaceIO) writing to Solace
 * PubSub+ topics or queues via JCSMP session service factory, and Python pipelines
 * via Apache Beam Cross-Language (x-lang) Java expansion service.
 * 
 * Architectural Decisions:
 * - JCSMP host configuration for messaging data plane (SMF port e.g. 55555), strictly validated as required.
 * - Enforces secure credential management: username and VPN name as text, password strictly via
 *   Google Cloud Secret Manager ('getSecrets') with no plaintext fallback.
 * - Broker host suggestions queried from Compute Engine VM instances ('getComputeInstances').
 * - Mutually exclusive destination selector between Solace Topic (recommended for publishing) and Queue.
 * - Exposes Beam SolaceIO writer enums with comprehensive documentation tooltips on throughput/latency tradeoffs:
 *   - SubmissionMode: HIGHER_THROUGHPUT vs LOWER_LATENCY
 *   - DeliveryMode: DIRECT vs PERSISTENT vs NON_PERSISTENT (com.solacesystems.jcsmp.DeliveryMode)
 *   - WriterType: BATCHED vs STREAMING
 *   - NumberOfClientsPerWorker: concurrent client sessions per worker node (default: 4).
 *   - NumberOfShards: number of workers used by the job to write to Solace (default: 20).
 *   - PublishLatencyMetrics: reporting of latency metrics when delivery mode is PERSISTENT.
 * - Adopts the shared ExpansionServiceFields primitive for Python x-lang configuration.
 * - Integrates InfoTooltip components citing the official Apache Beam SolaceIO APIs and documentation.
 * - Adheres strictly to the 8pt grid system for spacing, padding, and layout.
 */

import React from 'react';
import { Server, Lock, RefreshCw, Radio, Send } from 'lucide-react';
import { InfoTooltip } from '../../components/InfoTooltip';
import { PropertyField } from '../../components/common/PropertyField';
import { SystemInstructionsField } from '../../components/common/SystemInstructionsField';
import { resolveSystemInstructions } from '../../utils/systemInstructions';
import { ExpansionServiceFields } from '../../components/common/ExpansionServiceFields';
import { useSecretOptions } from '../../hooks/useSecretOptions';
import { useAssetLoader } from '../../hooks/useAssetLoader';
import { useNodeProperties } from '../../hooks/useNodeProperties';

/**
 * Secret item loaded from Secret Manager for Solace broker authentication.
 */
export interface SecretItem {
  name: string;
  fullName?: string;
  value: string;
  id?: string;
  [key: string]: any;
}

/**
 * Compute Engine instance information for Solace broker resolution.
 */
export interface ComputeInstanceItem {
  name: string;
  status: string;
  internalIp: string;
  externalIp: string;
}

/**
 * React Flow node shape for the Solace sink panel, including its persisted configuration data.
 */
export interface SolaceIOSinkNode {
  data: {
    label: string;
    beam_transform?: string;
    system_instructions?: string;
    special_instructions?: string;
    properties?: {
      jcsmpHost?: string;
      vpnName?: string;
      username?: string;
      passwordSecret?: string;
      destinationType?: 'topic' | 'queue';
      topic?: string;
      queue?: string;
      submissionMode?: 'HIGHER_THROUGHPUT' | 'LOWER_LATENCY';
      deliveryMode?: 'DIRECT' | 'PERSISTENT' | 'NON_PERSISTENT';
      writerType?: 'BATCHED' | 'STREAMING';
      numberOfClientsPerWorker?: number | string;
      numShards?: number | string;
      publishLatencyMetrics?: boolean;
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

/**
 * Props for the SolaceIOSinkProperties component.
 */
export interface SolaceIOSinkPropertiesProps {
  node: SolaceIOSinkNode;
  onChange: (properties: any) => void;
}

/**
 * SolaceIOSinkProperties renders the configuration form for Solace streaming sink publishing.
 * 
 * @param props Component properties containing the active node data and onChange callback.
 * @returns React functional component.
 */
export const SolaceIOSinkProperties: React.FC<SolaceIOSinkPropertiesProps> = ({ node, onChange }) => {
  const { properties, handleChange } = useNodeProperties(node, onChange);

  // Form field state values with fallbacks
  const jcsmpHost = properties.jcsmpHost || '';
  const vpnName = properties.vpnName !== undefined ? properties.vpnName : 'default';
  const username = properties.username || '';
  const passwordSecret = properties.passwordSecret || '';
  const destinationType = properties.destinationType || (properties.queue ? 'queue' : 'topic');
  const topic = properties.topic || '';
  const queue = properties.queue || '';
  const submissionMode = properties.submissionMode || 'HIGHER_THROUGHPUT';
  const deliveryMode = properties.deliveryMode || 'DIRECT';
  const writerType = properties.writerType || 'BATCHED';
  const numberOfClientsPerWorker = properties.numberOfClientsPerWorker ?? '4';
  const numShards = properties.numShards ?? '20';
  const publishLatencyMetrics = properties.publishLatencyMetrics ?? false;
  const expansionServiceMode = properties.expansionServiceMode || 'auto';
  const expansionServiceEndpoint = properties.expansionServiceEndpoint || '';

  // Asset loaders
  const secrets = useSecretOptions();
  const { items: instances, error: instanceError } = useAssetLoader<ComputeInstanceItem>('computeInstances');

  // System instructions text with fallback
  const systemInstructions = resolveSystemInstructions(node);

  /**
   * Handles switching destination type between Topic and Queue.
   * 
   * @param e Select change event.
   */
  const handleDestinationTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newType = e.target.value as 'topic' | 'queue';
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
   * Applies a selected Compute Engine instance IP to JCSMP host endpoint.
   * 
   * @param ip IP address of the VM instance.
   */
  const handleSelectInstanceIp = (ip: string) => {
    onChange({
      ...properties,
      jcsmpHost: `${ip}:55555`
    });
  };

  // Field validation flags
  const isJcsmpHostMissing = !jcsmpHost.trim();
  const isVpnNameMissing = !vpnName.trim();
  const isUsernameMissing = !username.trim();
  const isPasswordSecretMissing = !passwordSecret.trim();
  const isTopicMissing = destinationType === 'topic' && !topic.trim();
  const isQueueMissing = destinationType === 'queue' && !queue.trim();

  return (
    <div className="flex-1 flex flex-col gap-4">
      {/* 1. Connection & Authentication */}
      <div className="p-3 bg-[#252836]/60 rounded border border-slate-700 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="flex items-center text-xs font-bold uppercase text-slate-400 gap-1.5">
            <Server size={12} className="text-blue-400" />
            <span>Broker Connection & Credentials</span>
            <InfoTooltip
              text="Connection endpoints and credentials for Apache Beam SolaceIO writer. Uses BasicAuthJcsmpSessionServiceFactory to establish publisher sessions."
              position="auto"
            />
          </span>
        </div>

        {/* JCSMP Host */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="solace-sink-jcsmp-host" className="flex items-center text-xs font-bold uppercase text-slate-500">
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
            id="solace-sink-jcsmp-host"
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
          id="solace-sink-vpn-name"
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
          tooltip="Solace Message VPN name configured on the broker for JCSMP publisher session connections."
          mono={true}
        />

        {/* Username via Secret Manager */}
        <PropertyField
          id="solace-sink-username"
          name="username"
          label="Username (Secret Manager)"
          value={username}
          onChange={handleChange}
          placeholder="e.g. solace-username-secret"
          required="Username is required."
          aria-required="true"
          aria-invalid={isUsernameMissing}
          invalid={isUsernameMissing}
          error={isUsernameMissing ? 'Username is required.' : null}
          datalist={secrets.options}
          loading={secrets.loading}
          tooltip="Google Cloud Secret Manager secret resource containing the client username for basic authentication to the Solace broker."
          mono={true}
        />

        {/* Password via Secret Manager */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="solace-sink-password-secret" className="flex items-center text-xs font-bold uppercase text-slate-500 gap-1">
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
            id="solace-sink-password-secret"
            name="passwordSecret"
            value={passwordSecret}
            onChange={handleChange}
            placeholder="e.g. solace-client-password"
            required="Password secret name is required."
            aria-required="true"
            aria-invalid={isPasswordSecretMissing}
            invalid={isPasswordSecretMissing}
            error={isPasswordSecretMissing ? 'Password secret is required.' : (secrets.error || null)}
            list="solace-sink-secrets-datalist"
            datalist={secrets.options}
            loading={secrets.loading}
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
          />
          {/* NOTE: Generated code resolves the secret from Google Cloud Secret Manager at runtime. */}
          {secrets.error && (
            <span className="text-xs text-red-400 mt-1" role="alert">
              {secrets.error}
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
              text="Select whether to publish to a Solace Topic or Queue (.to(Solace.Topic.fromName(name)) or .to(Solace.Queue.fromName(name)))."
              position="auto"
            />
          </span>
        </div>

        {/* Destination Type Selector */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="solace-sink-destination-type" className="flex items-center text-xs font-bold uppercase text-slate-500">
            <span>Destination Type</span>
            <InfoTooltip
              text="Target Solace destination for published messages. Topics are recommended for publish-subscribe patterns, while Queues provide direct point-to-point delivery."
              position="auto"
            />
          </label>
          <select
            id="solace-sink-destination-type"
            name="destinationType"
            value={destinationType}
            onChange={handleDestinationTypeChange}
            className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
          >
            <option value="topic">Topic (Solace.Topic.fromName)</option>
            <option value="queue">Queue (Solace.Queue.fromName)</option>
          </select>
        </div>

        {/* Mutually exclusive destination input */}
        {destinationType === 'topic' ? (
          <PropertyField
            id="solace-sink-topic"
            name="topic"
            label="Topic Name"
            value={topic}
            onChange={handleChange}
            placeholder="e.g. events/orders/created"
            required="Topic name is required when publishing to a Topic."
            aria-required="true"
            aria-invalid={isTopicMissing}
            invalid={isTopicMissing}
            error={isTopicMissing ? 'Topic name is required when publishing to a Topic.' : null}
            tooltip="Solace Topic name to publish messages to (Solace.Topic.fromName(name))."
            mono={true}
          />
        ) : (
          <PropertyField
            id="solace-sink-queue"
            name="queue"
            label="Queue Name"
            value={queue}
            onChange={handleChange}
            placeholder="e.g. orders-processing-queue"
            required="Queue name is required when publishing to a Queue."
            aria-required="true"
            aria-invalid={isQueueMissing}
            invalid={isQueueMissing}
            error={isQueueMissing ? 'Queue name is required when publishing to a Queue.' : null}
            tooltip="Solace Queue name to publish messages to (Solace.Queue.fromName(name))."
            mono={true}
          />
        )}
      </div>

      {/* 3. Publishing & Execution Settings */}
      <div className="p-3 bg-[#252836]/60 rounded border border-slate-700 flex flex-col gap-3">
        <span className="flex items-center text-xs font-bold uppercase text-slate-400 gap-1.5">
          <Send size={12} className="text-blue-400" />
          <span>Publishing & Delivery Settings</span>
        </span>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Submission Mode */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="solace-sink-submission-mode" className="flex items-center text-xs font-bold uppercase text-slate-500">
              <span>Submission Mode</span>
              <InfoTooltip
                text="Solace submission mode (.withSubmissionMode(SubmissionMode.HIGHER_THROUGHPUT | LOWER_LATENCY)). HIGHER_THROUGHPUT maximizes throughput via batching and asynchronous session commits, whereas LOWER_LATENCY immediately flushes messages with sub-millisecond dispatch."
                position="auto"
              />
            </label>
            <select
              id="solace-sink-submission-mode"
              name="submissionMode"
              value={submissionMode}
              onChange={handleChange}
              className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
            >
              <option value="HIGHER_THROUGHPUT">HIGHER_THROUGHPUT (Batching & async flush)</option>
              <option value="LOWER_LATENCY">LOWER_LATENCY (Immediate flush)</option>
            </select>
          </div>

          {/* Delivery Mode */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="solace-sink-delivery-mode" className="flex items-center text-xs font-bold uppercase text-slate-500">
              <span>Delivery Mode</span>
              <InfoTooltip
                text="Solace message delivery mode (.withDeliveryMode(DeliveryMode.DIRECT | PERSISTENT | NON_PERSISTENT) from com.solacesystems.jcsmp.DeliveryMode). DIRECT delivers non-guaranteed at-most-once messages with maximum throughput (default); PERSISTENT provides guaranteed delivery with broker disk spooling and ACKs; NON_PERSISTENT delivers non-persistent messages."
                position="auto"
              />
            </label>
            <select
              id="solace-sink-delivery-mode"
              name="deliveryMode"
              value={deliveryMode}
              onChange={handleChange}
              className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
            >
              <option value="DIRECT">DIRECT (At-Most-Once Streaming - default)</option>
              <option value="PERSISTENT">PERSISTENT (Guaranteed Messaging)</option>
              <option value="NON_PERSISTENT">NON_PERSISTENT (Non-Persistent Messaging)</option>
            </select>
          </div>

          {/* Writer Type */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="solace-sink-writer-type" className="flex items-center text-xs font-bold uppercase text-slate-500">
              <span>Writer Type</span>
              <InfoTooltip
                text="Solace writer execution type (.withWriterType(WriterType.BATCHED | STREAMING)). BATCHED aggregates elements into micro-batches for efficient publication (default), whereas STREAMING writes elements continuously as they flow through the pipeline."
                position="auto"
              />
            </label>
            <select
              id="solace-sink-writer-type"
              name="writerType"
              value={writerType}
              onChange={handleChange}
              className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
            >
              <option value="BATCHED">BATCHED (Micro-batched writing - default)</option>
              <option value="STREAMING">STREAMING (Continuous writing)</option>
            </select>
          </div>

          {/* Number of Clients Per Worker */}
          <PropertyField
            id="solace-sink-clients-per-worker"
            name="numberOfClientsPerWorker"
            label="Clients Per Worker"
            type="number"
            min={1}
            value={numberOfClientsPerWorker}
            onChange={handleChange}
            placeholder="4"
            tooltip="Number of concurrent Solace JCSMP producer client sessions created per Apache Beam worker (.withNumberOfClientsPerWorker(int)). Higher values allow more parallel producer threads. Default is 4."
            helperText="Number of concurrent client sessions per worker (default: 4)"
            mono={true}
          />

          {/* Number of Shards */}
          <PropertyField
            id="solace-sink-num-shards"
            name="numShards"
            label="Number of Shards"
            type="number"
            min={1}
            value={numShards}
            onChange={handleChange}
            placeholder="20"
            tooltip="The number of workers used by the job to write to Solace (.withNumShards(int))."
            helperText="The number of workers used by the job to write to Solace (default: 20)"
            mono={true}
          />
        </div>

        {/* Publish Latency Metrics Checkbox */}
        <div className="flex items-center gap-2 pt-1">
          <input
            id="solace-sink-publish-latency-metrics"
            type="checkbox"
            name="publishLatencyMetrics"
            checked={publishLatencyMetrics}
            onChange={handleChange}
            className="w-4 h-4 rounded border-slate-700 bg-[#252836] text-blue-500 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer accent-blue-500"
          />
          <label htmlFor="solace-sink-publish-latency-metrics" className="text-xs text-slate-300 cursor-pointer flex items-center gap-1.5">
            <span>Publish Latency Metrics</span>
            <InfoTooltip
              text="Enables reporting of latency metrics when delivery mode is PERSISTENT (.publishLatencyMetrics())."
              position="auto"
            />
          </label>
        </div>
      </div>

      {/* 4. Expansion Service (Python x-lang) */}
      <ExpansionServiceFields
        transformName="SolaceIO"
        idPrefix="solace-sink"
        mode={expansionServiceMode}
        endpoint={expansionServiceEndpoint}
        onChange={handleChange}
      />

      {/* 5. Code Generation Instructions */}
      <SystemInstructionsField
        id="solace-sink-instructions"
        value={systemInstructions}
        tooltip="Custom instructions passed to the AI code generation model for this specific Solace sink node (e.g. custom message payload serialization, correlation ID setting, or header mapping)."
        placeholder="e.g. Serialize domain POJO into JSON BytesXMLMessage with delivery mode PERSISTENT..."
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
