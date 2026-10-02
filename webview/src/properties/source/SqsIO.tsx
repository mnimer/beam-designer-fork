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
 * - Leverages shared useAssetLoader, PropertyField, and SecretManagerAuthFields primitives
 *   to eliminate boilerplate while upholding the 8pt grid and exact Tailwind styling.
 * - Dynamic Extension Callbacks:
 *   - Requests GCP Secret Manager secrets via useAssetLoader('secrets') for secure credential references.
 *   - Requests local AWS SQS queue URLs via useAssetLoader('queues') (if AWS CLI is configured).
 * - AWS Region dropdown includes common standard regions with custom input fallback.
 * - Supports bounded read limits (maxNumRecords, maxReadTime) for testing or hybrid streaming.
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
 * Secret item interface for AWS SQS secrets.
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
 * Node data structure for SqsIO source nodes.
 */
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

/**
 * Props for the SqsIO source properties component.
 */
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

  // NOTE: Request AWS queues and GCP secrets via shared useAssetLoader hook
  const { items: discoveredQueues } = useAssetLoader<string>('queues');
  const { items: secrets } = useAssetLoader<SecretItem | string>('secrets');

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
  const systemInstructions = resolveSystemInstructions(node);

  /**
   * Handles text and select input changes
   */
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    onChange({
      ...properties,
      [name]: value,
    });
  };

  return (
    <div className="flex-1 flex flex-col gap-4">
      {/* SQS Queue URL */}
      <PropertyField
        id="sqsSourceQueueUrl"
        name="queueUrl"
        label="Queue URL"
        required="Queue URL is required"
        tooltip="The Amazon SQS queue URL to read messages from (e.g. https://sqs.us-east-1.amazonaws.com/123456789012/my-queue)."
        value={queueUrl}
        invalid={isInvalid}
        onChange={handleChange}
        placeholder="https://sqs.us-east-1.amazonaws.com/123456789012/my-queue"
        list="sqs-source-queue-options"
        datalist={discoveredQueues}
        helperText={
          <span>
            Format: <code className="text-slate-300 bg-slate-800/60 px-1 py-0.5 rounded">https://sqs.&lt;region&gt;.amazonaws.com/&lt;account&gt;/&lt;queue&gt;</code>
          </span>
        }
      />

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

      {/* Authentication Mode and Secret Manager selection */}
      <SecretManagerAuthFields
        idPrefix="sqsSource"
        datalistId="sqs-source-secrets-list"
        authMode={authMode}
        secretName={secretName}
        secrets={secrets}
        serviceName="AWS SQS"
        onChange={handleChange}
      />

      {/* Custom Endpoint URL (LocalStack / Testing) */}
      <PropertyField
        id="sqsSourceEndpointUrl"
        name="endpointUrl"
        label="Endpoint Override (Optional)"
        tooltip="Custom endpoint URL for LocalStack, mock services, or private VPC endpoints (e.g. http://localhost:4566)."
        value={endpointUrl}
        onChange={handleChange}
        placeholder="http://localhost:4566"
      />

      {/* Bounded Read Settings */}
      <div className="flex flex-col gap-3 p-3 bg-slate-900/40 rounded border border-slate-800">
        <div className="flex items-center gap-1.5 text-xs font-bold uppercase text-slate-400">
          <span>Bounded Read Limits</span>
          <InfoTooltip text="Optional limits for reading from SQS. Specifying these bounds transforms the unbounded stream into a bounded read suitable for batch testing." />
        </div>
        <div className="grid grid-cols-2 items-end gap-3">
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

      {/* Code Generation Instructions */}
      <SystemInstructionsField
        id="sqsSourceInstructions"
        value={systemInstructions}
        tooltip="Optional custom prompt instructions supplied to Gemini during pipeline code generation (e.g. deserialize custom JSON message payload, map attributes, or x-lang expansion details)."
        placeholder="e.g. Extract JSON string payload from Message body and parse into Order model..."
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
