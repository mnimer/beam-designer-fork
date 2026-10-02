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
 * - Leverages shared useAssetLoader, PropertyField, and SecretManagerAuthFields primitives
 *   to eliminate boilerplate while upholding the 8pt grid and exact Tailwind styling.
 * - Dynamic Extension Callbacks:
 *   - Requests GCP Secret Manager secrets via useAssetLoader('secrets') for secure credential references.
 *   - Requests local AWS SQS queue URLs via useAssetLoader('queues') (if AWS CLI is configured).
 * - AWS Region dropdown includes common standard regions with custom input fallback.
 * - Delivery Delay: supports delaySeconds (0 to 900s) for deferred message visibility.
 * - Supports authentication mode selection (Default IAM/AwsOptions chain, Secret Manager, or Custom).
 * - Includes a flexible spacer and "Code Generation Instructions" textarea for custom Gemini prompt tuning.
 */

import React from 'react';
import { InfoTooltip } from '../../components/InfoTooltip';
import { PropertyField } from '../../components/common/PropertyField';
import { SystemInstructionsField } from '../../components/common/SystemInstructionsField';
import { resolveSystemInstructions } from '../../utils/systemInstructions';
import { SecretManagerAuthFields } from '../../components/common/SecretManagerAuthFields';
import type { SecretItem } from '../../components/common/SecretManagerAuthFields';
import { useAssetLoader } from '../../hooks/useAssetLoader';

/**
 * Secret item representing AWS credentials in Secret Manager.
 */
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

/**
 * Node definition for SqsIO sink configuration.
 */
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

/**
 * Props for the SqsIOSinkProperties component.
 */
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

  // NOTE: Request AWS queues and GCP secrets via shared useAssetLoader hook
  const { items: discoveredQueues } = useAssetLoader<string>('queues');
  const { items: secrets } = useAssetLoader<SecretItem | string>('secrets');

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
  const systemInstructions = resolveSystemInstructions(node);

  /**
   * Handles text and select input changes
   */
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
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

  return (
    <div className="flex-1 flex flex-col gap-4">
      {/* SQS Queue URL */}
      <PropertyField
        id="sqsSinkQueueUrl"
        name="queueUrl"
        label="Queue URL"
        required="Queue URL is required"
        tooltip="The Amazon SQS queue URL to publish messages to (e.g. https://sqs.us-east-1.amazonaws.com/123456789012/my-queue)."
        value={queueUrl}
        invalid={isInvalid}
        error={isInvalid ? 'Queue URL is required.' : null}
        onChange={handleChange}
        placeholder="https://sqs.us-east-1.amazonaws.com/123456789012/my-queue"
        list="sqs-sink-queue-options"
        datalist={discoveredQueues}
        helperText={
          <span>
            Format: <code className="text-slate-300 bg-slate-800/60 px-1 py-0.5 rounded">https://sqs.&lt;region&gt;.amazonaws.com/&lt;account&gt;/&lt;queue&gt;</code>
          </span>
        }
      />

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
      <PropertyField
        id="sqsSinkDelaySeconds"
        name="delaySeconds"
        label="Delivery Delay (Seconds, Optional)"
        tooltip="The length of time, in seconds, for which the delivery of messages is delayed (0 to 900 seconds / 15 minutes max)."
        type="number"
        min="0"
        max="900"
        value={delaySeconds}
        onChange={handleChange}
        placeholder="e.g. 0"
      />

      {/* Authentication Mode and Secret Manager selection */}
      <SecretManagerAuthFields
        idPrefix="sqsSink"
        datalistId="sqs-sink-secrets-list"
        authMode={authMode}
        secretName={secretName}
        secrets={secrets}
        serviceName="AWS SQS"
        onChange={handleChange}
      />

      {/* Custom Endpoint URL (LocalStack / Testing) */}
      <PropertyField
        id="sqsSinkEndpointUrl"
        name="endpointUrl"
        label="Endpoint Override (Optional)"
        tooltip="Custom endpoint URL for LocalStack, mock services, or private VPC endpoints (e.g. http://localhost:4566)."
        value={endpointUrl}
        onChange={handleChange}
        placeholder="http://localhost:4566"
      />

      {/* Code Generation Instructions */}
      <SystemInstructionsField
        id="sqsSinkInstructions"
        value={systemInstructions}
        tooltip="Optional custom prompt instructions supplied to Gemini during pipeline code generation (e.g. formatting elements into SendMessageRequest or handling FIFO messageGroupId)."
        placeholder="e.g. Map String or POJO elements into SendMessageRequest with body and custom attributes..."
        wrapperClassName="flex flex-col gap-2 pt-2 border-t border-slate-800/80"
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
