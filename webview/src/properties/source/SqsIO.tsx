/**
 * SqsIO Source Properties Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Renders the property configuration panel for Apache Beam SqsIO Source (Reader) nodes
 * (e.g. SqsIO.read().withQueueUrl(...)) reading from Amazon Simple Queue Service.
 * 
 * Architectural Decisions:
 * - Uses AWS SDK v2 connector (org.apache.beam.sdk.io.aws2.sqs.SqsIO).
 * - SQS Queue URL is mandatory; flags validation error and red border when empty.
 * - Dynamic Extension Callbacks:
 *   - Requests GCP Secret Manager secrets via 'getSecrets' for secure credential references.
 *   - Requests local AWS SQS queue URLs via 'getAwsQueues' (if AWS CLI is configured).
 * - AWS Region dropdown includes common standard regions with custom input fallback.
 * - Supports bounded read limits (maxNumRecords, maxReadTime) for testing or hybrid streaming.
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

export interface SqsIOSourceNode {
  data: {
    label: string;
    beam_transform?: string;
    system_instructions?: string;
    special_instructions?: string;
    properties?: {
      queueUrl?: string;
      awsRegion?: string;
      customAwsRegion?: string;
      authMode?: 'default' | 'secretManager' | 'static';
      secretName?: string;
      endpointUrl?: string;
      maxNumRecords?: string | number;
      maxReadTime?: string | number;
      system_instructions?: string;
      special_instructions?: string;
      [key: string]: any;
    };
  };
}

export interface SqsIOSourcePropertiesProps {
  node: SqsIOSourceNode;
  onChange: (properties: any) => void;
}

/**
 * SqsIOSourceProperties component rendering the configuration form for SqsIO reads.
 * 
 * @param props Component properties containing the active node and onChange callback.
 * @returns React component.
 */
export const SqsIOSourceProperties: React.FC<SqsIOSourcePropertiesProps> = ({ node, onChange }) => {
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
  const authMode = properties.authMode || 'default';
  const secretName = properties.secretName || '';
  const endpointUrl = properties.endpointUrl || '';
  const maxNumRecords = properties.maxNumRecords ?? '';
  const maxReadTime = properties.maxReadTime ?? '';

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
    const { name, value } = e.target;
    onChange({
      ...properties,
      [name]: value,
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
        <label htmlFor="sqsSourceQueueUrl" className="flex items-center text-xs font-bold uppercase text-slate-500">
          <span>Queue URL</span>
          <span className="text-red-400 ml-1 font-bold" title="Queue URL is required">*</span>
          <InfoTooltip text="The Amazon SQS queue URL to read messages from (e.g. https://sqs.us-east-1.amazonaws.com/123456789012/my-queue)." />
        </label>
        <input
          id="sqsSourceQueueUrl"
          type="text"
          name="queueUrl"
          aria-required="true"
          aria-invalid={isInvalid}
          value={queueUrl}
          onChange={handleChange}
          placeholder="https://sqs.us-east-1.amazonaws.com/123456789012/my-queue"
          list="sqs-source-queue-options"
          className={`bg-[#252836] text-white p-2 rounded border text-sm focus:outline-none font-mono ${
            isInvalid
              ? 'border-red-500/80 focus:border-red-500'
              : 'border-slate-700 focus:border-blue-500'
          }`}
        />
        <datalist id="sqs-source-queue-options">
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
        <label htmlFor="sqsSourceAwsRegion" className="flex items-center text-xs font-bold uppercase text-slate-500">
          <span>AWS Region</span>
          <InfoTooltip text="The AWS region where your SQS queue is hosted." />
        </label>
        <select
          id="sqsSourceAwsRegion"
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

      {/* Authentication Mode */}
      <div className="flex flex-col gap-2">
        <label htmlFor="sqsSourceAuthMode" className="flex items-center text-xs font-bold uppercase text-slate-500">
          <span>Authentication / Credentials</span>
          <InfoTooltip text="How the Apache Beam worker should authenticate to AWS SQS. Using GCP Secret Manager avoids hardcoding AWS keys." />
        </label>
        <select
          id="sqsSourceAuthMode"
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
          <label htmlFor="sqsSourceSecretName" className="flex items-center text-xs font-bold uppercase text-slate-500">
            <span>Secret Manager Secret</span>
            <InfoTooltip text="Name or resource ID of the Google Cloud secret containing AWS credentials." />
          </label>
          <input
            id="sqsSourceSecretName"
            type="text"
            name="secretName"
            value={secretName}
            onChange={handleChange}
            placeholder="e.g. aws-sqs-credentials or projects/.../secrets/..."
            list="sqs-source-secrets-list"
            className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500 font-mono"
          />
          <datalist id="sqs-source-secrets-list">
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
        <label htmlFor="sqsSourceEndpointUrl" className="flex items-center text-xs font-bold uppercase text-slate-500">
          <span>Endpoint Override (Optional)</span>
          <InfoTooltip text="Custom endpoint URL for LocalStack, mock services, or private VPC endpoints (e.g. http://localhost:4566)." />
        </label>
        <input
          id="sqsSourceEndpointUrl"
          type="text"
          name="endpointUrl"
          value={endpointUrl}
          onChange={handleChange}
          placeholder="http://localhost:4566"
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500 font-mono"
        />
      </div>

      {/* Bounded Read Settings */}
      <div className="flex flex-col gap-3 p-3 bg-slate-900/40 rounded border border-slate-800">
        <div className="flex items-center gap-1.5 text-xs font-bold uppercase text-slate-400">
          <span>Bounded Read Limits</span>
          <InfoTooltip text="Optional limits for reading from SQS. Specifying these bounds transforms the unbounded stream into a bounded read suitable for batch testing." />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="sqsSourceMaxRecords" className="text-[11px] font-bold uppercase text-slate-500">
              Max Records
            </label>
            <input
              id="sqsSourceMaxRecords"
              type="number"
              name="maxNumRecords"
              min="1"
              value={maxNumRecords}
              onChange={handleChange}
              placeholder="e.g. 1000"
              className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="sqsSourceMaxReadTime" className="text-[11px] font-bold uppercase text-slate-500">
              Max Time (sec)
            </label>
            <input
              id="sqsSourceMaxReadTime"
              type="number"
              name="maxReadTime"
              min="1"
              value={maxReadTime}
              onChange={handleChange}
              placeholder="e.g. 60"
              className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>
        </div>
      </div>

      {/* Spacer to push instructions to the bottom */}
      <div className="flex-1 min-h-[16px]" />

      {/* Code Generation Instructions */}
      <div className="flex flex-col gap-2 pt-2 border-t border-slate-800/80">
        <label htmlFor="sqsSourceInstructions" className="flex items-center text-xs font-bold uppercase text-slate-500">
          <span>Code Generation Instructions</span>
          <InfoTooltip text="Optional custom prompt instructions supplied to Gemini during pipeline code generation (e.g. deserialize custom JSON message payload, map attributes, or x-lang expansion details)." />
        </label>
        <textarea
          id="sqsSourceInstructions"
          rows={3}
          value={systemInstructions}
          onChange={handleInstructionsChange}
          placeholder="e.g. Extract JSON string payload from Message body and parse into Order model..."
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500 font-mono resize-y"
        />
      </div>
    </div>
  );
};
