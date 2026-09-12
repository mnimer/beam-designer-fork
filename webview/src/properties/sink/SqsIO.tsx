/**
 * SqsIO Sink Properties Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Renders the property configuration panel for Apache Beam SqsIO Sink (Writer) nodes
 * (e.g. SqsIO.write().withQueueUrl(...).withBatchSize(...)) writing messages to Amazon Simple Queue Service.
 * 
 * Architectural Decisions:
 * - Uses AWS SDK v2 connector (org.apache.beam.sdk.io.aws2.sqs.SqsIO).
 * - SQS Queue URL is mandatory; flags validation error and red border when empty.
 * - SQS Batch Size: constrained between 1 and 10 per AWS SendMessageBatch API limits (default 10).
 * - Dynamic Extension Callbacks:
 *   - Requests GCP Secret Manager secrets via 'getSecrets' for secure credential references.
 *   - Requests local AWS SQS queue URLs via 'getAwsQueues' (if AWS CLI is configured).
 * - AWS Region dropdown includes common standard regions with custom input fallback.
 * - Delivery Delay: supports delaySeconds (0 to 900s) for deferred message visibility.
 * - Supports authentication mode selection (Default IAM/AwsOptions chain, Secret Manager, or Custom).
 * - Follows the 8pt grid spacing system and VS Code semantic theme colors.
 * - Includes a flexible spacer and "Code Generation Instructions" textarea for custom Gemini prompt tuning.
 */

import React, { useState, useEffect } from 'react';
import { InfoTooltip } from '../../components/InfoTooltip';

export interface SqsSecretItem {
  name: string;
  id: string;
}

export const AWS_REGIONS = [
  { value: 'us-east-1', label: 'US East (N. Virginia) [us-east-1]' },
  { value: 'us-east-2', label: 'US East (Ohio) [us-east-2]' },
  { value: 'us-west-1', label: 'US West (N. California) [us-west-1]' },
  { value: 'us-west-2', label: 'US West (Oregon) [us-west-2]' },
  { value: 'ca-central-1', label: 'Canada (Central) [ca-central-1]' },
  { value: 'eu-west-1', label: 'Europe (Ireland) [eu-west-1]' },
  { value: 'eu-west-2', label: 'Europe (London) [eu-west-2]' },
  { value: 'eu-central-1', label: 'Europe (Frankfurt) [eu-central-1]' },
  { value: 'ap-northeast-1', label: 'Asia Pacific (Tokyo) [ap-northeast-1]' },
  { value: 'ap-southeast-1', label: 'Asia Pacific (Singapore) [ap-southeast-1]' },
  { value: 'ap-southeast-2', label: 'Asia Pacific (Sydney) [ap-southeast-2]' },
  { value: 'custom', label: 'Custom Region...' },
];

export interface SqsIOSinkNode {
  data: {
    label: string;
    beam_transform?: string;
    system_instructions?: string;
    special_instructions?: string;
    properties?: {
      queueUrl?: string;
      awsRegion?: string;
      customAwsRegion?: string;
      batchSize?: number | string;
      delaySeconds?: number | string;
      authMode?: 'default' | 'secretManager' | 'static';
      secretName?: string;
      endpointUrl?: string;
      system_instructions?: string;
      special_instructions?: string;
      [key: string]: any;
    };
  };
}

export interface SqsIOSinkPropertiesProps {
  node: SqsIOSinkNode;
  onChange: (properties: any) => void;
}

/**
 * SqsIOSinkProperties component rendering the configuration form for SqsIO writes.
 * 
 * @param props Component properties containing the active node and onChange callback.
 * @returns React component.
 */
export const SqsIOSinkProperties: React.FC<SqsIOSinkPropertiesProps> = ({ node, onChange }) => {
  // Extract existing properties or fallback to defaults
  const properties = node.data.properties || {};

  const [secrets, setSecrets] = useState<SqsSecretItem[]>([]);
  const [discoveredQueues, setDiscoveredQueues] = useState<string[]>([]);

  // NOTE: Listen for Secret Manager and AWS SQS queue events from the VS Code extension host
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.command === 'secretsLoaded') {
        const loaded = Array.isArray(message.secrets) ? message.secrets : [];
        setSecrets(loaded);
      } else if (message.command === 'awsQueuesLoaded') {
        const queues = Array.isArray(message.queues) ? message.queues : [];
        setDiscoveredQueues(queues);
      }
    };
    window.addEventListener('message', handleMessage);

    const vscode = (window as any).vscode;
    if (vscode) {
      vscode.postMessage({ command: 'getSecrets' });
      vscode.postMessage({ command: 'getAwsQueues' });
    }

    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const queueUrl = properties.queueUrl || '';
  const awsRegion = properties.awsRegion || 'us-east-1';
  const customAwsRegion = properties.customAwsRegion || '';
  const batchSize = properties.batchSize !== undefined ? properties.batchSize : 10;
  const delaySeconds = properties.delaySeconds ?? '';
  const authMode = properties.authMode || 'default';
  const secretName = properties.secretName || '';
  const endpointUrl = properties.endpointUrl || '';

  // Validation: queueUrl is required for SqsIO
  const isInvalid = !queueUrl.trim();

  // System instructions text with fallback
  const systemInstructions =
    node.data.system_instructions ??
    node.data.special_instructions ??
    properties.system_instructions ??
    properties.special_instructions ??
    '';

  /**
   * Handles text and select input changes
   */
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    let finalValue: any = value;
    if (type === 'number') {
      finalValue = value === '' ? '' : Number(value);
    }
    onChange({
      ...properties,
      [name]: finalValue,
    });
  };

  /**
   * Handles code generation instructions textarea change
   */
  const handleInstructionsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange({
      ...properties,
      system_instructions: e.target.value,
    });
  };

  return (
    <div className="flex-1 flex flex-col gap-4">
      {/* SQS Queue URL */}
      <div className="flex flex-col gap-2">
        <label htmlFor="sqsSinkQueueUrl" className="flex items-center text-xs font-bold uppercase text-slate-500">
          <span>Queue URL</span>
          <span className="text-red-400 ml-1 font-bold" title="Queue URL is required">*</span>
          <InfoTooltip text="The Amazon SQS queue URL to publish messages to (e.g. https://sqs.us-east-1.amazonaws.com/123456789012/my-queue)." />
        </label>
        <input
          id="sqsSinkQueueUrl"
          type="text"
          name="queueUrl"
          aria-required="true"
          aria-invalid={isInvalid}
          value={queueUrl}
          onChange={handleChange}
          placeholder="https://sqs.us-east-1.amazonaws.com/123456789012/my-queue"
          list="sqs-sink-queue-options"
          className={`bg-[#252836] text-white p-2 rounded border text-sm focus:outline-none font-mono ${
            isInvalid
              ? 'border-red-500/80 focus:border-red-500'
              : 'border-slate-700 focus:border-blue-500'
          }`}
        />
        <datalist id="sqs-sink-queue-options">
          {discoveredQueues.map((q) => (
            <option key={q} value={q} />
          ))}
        </datalist>
        <span className="text-xs text-slate-400">
          Format: <code className="text-slate-300 bg-slate-800/60 px-1 py-0.5 rounded">https://sqs.&lt;region&gt;.amazonaws.com/&lt;account&gt;/&lt;queue&gt;</code>
        </span>
      </div>

      {/* AWS Region */}
      <div className="flex flex-col gap-2">
        <label htmlFor="sqsSinkAwsRegion" className="flex items-center text-xs font-bold uppercase text-slate-500">
          <span>AWS Region</span>
          <InfoTooltip text="The AWS region where your target SQS queue is hosted." />
        </label>
        <select
          id="sqsSinkAwsRegion"
          name="awsRegion"
          value={awsRegion}
          onChange={handleChange}
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
        >
          {AWS_REGIONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        {awsRegion === 'custom' && (
          <input
            type="text"
            name="customAwsRegion"
            aria-label="Custom AWS Region"
            value={customAwsRegion}
            onChange={handleChange}
            placeholder="e.g. eu-south-1"
            className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500 font-mono mt-1"
          />
        )}
      </div>

      {/* Batch Size (1-10 per AWS SQS limits) */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label htmlFor="sqsSinkBatchSize" className="flex items-center text-xs font-bold uppercase text-slate-500">
            <span>Batch Size (1 - 10)</span>
            <InfoTooltip text="Number of messages to batch together when publishing to SQS using SendMessageBatch. AWS strictly enforces a maximum of 10 messages per batch." />
          </label>
          <span className="text-xs font-mono text-blue-400 font-semibold">{batchSize}</span>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="range"
            name="batchSize"
            min="1"
            max="10"
            value={batchSize}
            onChange={handleChange}
            className="flex-1 accent-blue-500 cursor-pointer"
          />
          <input
            id="sqsSinkBatchSize"
            type="number"
            name="batchSize"
            min="1"
            max="10"
            value={batchSize}
            onChange={handleChange}
            className="w-16 bg-[#252836] text-white p-1.5 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500 font-mono text-center"
          />
        </div>
        <span className="text-xs text-slate-400">
          Tip: Higher batch size reduces network round-trips and AWS SQS API costs.
        </span>
      </div>

      {/* Delivery Delay (0-900 seconds) */}
      <div className="flex flex-col gap-2">
        <label htmlFor="sqsSinkDelaySeconds" className="flex items-center text-xs font-bold uppercase text-slate-500">
          <span>Delivery Delay (Seconds, Optional)</span>
          <InfoTooltip text="The length of time, in seconds, for which the delivery of messages is delayed (0 to 900 seconds / 15 minutes max)." />
        </label>
        <input
          id="sqsSinkDelaySeconds"
          type="number"
          name="delaySeconds"
          min="0"
          max="900"
          value={delaySeconds}
          onChange={handleChange}
          placeholder="e.g. 0"
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500 font-mono"
        />
      </div>

      {/* Authentication Mode */}
      <div className="flex flex-col gap-2">
        <label htmlFor="sqsSinkAuthMode" className="flex items-center text-xs font-bold uppercase text-slate-500">
          <span>Authentication / Credentials</span>
          <InfoTooltip text="How the Apache Beam worker should authenticate to AWS SQS. Using GCP Secret Manager avoids hardcoding AWS keys." />
        </label>
        <select
          id="sqsSinkAuthMode"
          name="authMode"
          value={authMode}
          onChange={handleChange}
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
        >
          <option value="default">Default Credentials Chain (IAM Role / AwsOptions)</option>
          <option value="secretManager">Google Cloud Secret Manager</option>
          <option value="static">Static Credentials (Env / Local testing)</option>
        </select>
      </div>

      {/* Secret Manager Secret Selection */}
      {authMode === 'secretManager' && (
        <div className="flex flex-col gap-2">
          <label htmlFor="sqsSinkSecretName" className="flex items-center text-xs font-bold uppercase text-slate-500">
            <span>Secret Manager Secret</span>
            <InfoTooltip text="Name or resource ID of the Google Cloud secret containing AWS credentials." />
          </label>
          <input
            id="sqsSinkSecretName"
            type="text"
            name="secretName"
            value={secretName}
            onChange={handleChange}
            placeholder="e.g. aws-sqs-credentials or projects/.../secrets/..."
            list="sqs-sink-secrets-list"
            className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500 font-mono"
          />
          <datalist id="sqs-sink-secrets-list">
            {secrets.map((s) => (
              <option key={s.name} value={s.id}>
                {s.name}
              </option>
            ))}
          </datalist>
          <span className="text-xs text-slate-400">
            Values auto-populated from <code className="text-slate-300 bg-slate-800/60 px-1 py-0.5 rounded">gcloud secrets list</code>
          </span>
        </div>
      )}

      {/* Custom Endpoint URL (LocalStack / Testing) */}
      <div className="flex flex-col gap-2">
        <label htmlFor="sqsSinkEndpointUrl" className="flex items-center text-xs font-bold uppercase text-slate-500">
          <span>Endpoint Override (Optional)</span>
          <InfoTooltip text="Custom endpoint URL for LocalStack, mock services, or private VPC endpoints (e.g. http://localhost:4566)." />
        </label>
        <input
          id="sqsSinkEndpointUrl"
          type="text"
          name="endpointUrl"
          value={endpointUrl}
          onChange={handleChange}
          placeholder="http://localhost:4566"
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500 font-mono"
        />
      </div>

      {/* Spacer to push instructions to the bottom */}
      <div className="flex-1 min-h-[16px]" />

      {/* Code Generation Instructions */}
      <div className="flex flex-col gap-2 pt-2 border-t border-slate-800/80">
        <label htmlFor="sqsSinkInstructions" className="flex items-center text-xs font-bold uppercase text-slate-500">
          <span>Code Generation Instructions</span>
          <InfoTooltip text="Optional custom prompt instructions supplied to Gemini during pipeline code generation (e.g. formatting elements into SendMessageRequest or handling FIFO messageGroupId)." />
        </label>
        <textarea
          id="sqsSinkInstructions"
          rows={3}
          value={systemInstructions}
          onChange={handleInstructionsChange}
          placeholder="e.g. Map String or POJO elements into SendMessageRequest with body and custom attributes..."
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500 font-mono resize-y"
        />
      </div>
    </div>
  );
};
