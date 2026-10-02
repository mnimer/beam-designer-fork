/**
 * SnsIOSourceProperties Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Renders the property configuration panel for Apache Beam SnsIO Streaming Source nodes.
 * Since Amazon SNS is a push/fan-out messaging service, Beam streaming ingestion operates via
 * either an Amazon SQS Fan-Out Queue (AWS standard) or a GCP Pub/Sub Bridge (Dataflow hybrid).
 * Supports Java SDK and Python Cross-Language (x-lang) expansion service pipelines.
 * 
 * Architectural Decisions:
 * - Ingestion Pattern Toggle: Supports both SQS Fan-out Queue (AWS native) and GCP Pub/Sub Bridge.
 * - Dynamic extension callbacks:
 *   - Fetches GCP Secret Manager secrets via 'getSecrets' IPC message for secure AWS credential binding.
 *   - Fetches GCP Pub/Sub topics via 'getTopics' IPC message when using the Pub/Sub bridge.
 * - Real-time validation: Requires Topic ARN and ingestion destination (Queue URL or Pub/Sub topic).
 * - SNS Envelope Unwrapping: Toggles extraction of the raw user message and attributes from the SNS JSON envelope.
 * - Collapsible Advanced Settings for SQS polling (visibility timeout, wait time) and endpoint override.
 * - Integrates InfoTooltip components for Apache Beam and AWS SNS documentation.
 * - Preserves system_instructions / special_instructions in the bottom textarea for LLM code generation.
 * - Follows the 8pt grid system (p-2, p-4, gap-2, gap-4) and Tailwind CSS styling.
 */

import React, { useState } from 'react';
import { InfoTooltip } from '../../components/InfoTooltip';
import { PropertyField } from '../../components/common/PropertyField';
import { SystemInstructionsField } from '../../components/common/SystemInstructionsField';
import { resolveSystemInstructions } from '../../utils/systemInstructions';
import { useNodeProperties } from '../../hooks/useNodeProperties';
import { useAssetLoader } from '../../hooks/useAssetLoader';
import { useSecretOptions } from '../../hooks/useSecretOptions';

export const AWS_REGIONS = [
  { value: 'us-east-1', label: 'US East (N. Virginia) [us-east-1]' },
  { value: 'us-east-2', label: 'US East (Ohio) [us-east-2]' },
  { value: 'us-west-1', label: 'US West (N. California) [us-west-1]' },
  { value: 'us-west-2', label: 'US West (Oregon) [us-west-2]' },
  { value: 'eu-west-1', label: 'Europe (Ireland) [eu-west-1]' },
  { value: 'eu-central-1', label: 'Europe (Frankfurt) [eu-central-1]' },
  { value: 'ap-northeast-1', label: 'Asia Pacific (Tokyo) [ap-northeast-1]' },
  { value: 'ap-southeast-1', label: 'Asia Pacific (Singapore) [ap-southeast-1]' },
  { value: 'sa-east-1', label: 'South America (São Paulo) [sa-east-1]' },
];

/**
 * Props for the SnsIO source properties component.
 */
export interface SnsIOSourcePropertiesProps {
  node: {
    data: {
      label?: string;
      beam_transform?: string;
      system_instructions?: string;
      special_instructions?: string;
      properties?: {
        topicArn?: string;
        ingestionMode?: 'sqs' | 'pubsub';
        queueUrl?: string;
        pubsubTopic?: string;
        awsRegion?: string;
        customRegion?: string;
        authMode?: 'default' | 'secret_manager';
        accessKeySecret?: string;
        secretKeySecret?: string;
        unwrapEnvelope?: boolean;
        maxNumRecords?: number | string;
        maxReadTime?: number | string;
        endpointOverride?: string;
        visibilityTimeout?: number | string;
        waitTimeSeconds?: number | string;
        system_instructions?: string;
        special_instructions?: string;
        [key: string]: any;
      };
    };
  };
  onChange: (properties: any) => void;
}

/**
 * SnsIOSourceProperties renders the configuration form for SNS streaming consumption.
 * 
 * @param props Component properties containing the active node and onChange callback
 */
export const SnsIOSourceProperties: React.FC<SnsIOSourcePropertiesProps> = ({ node, onChange }) => {
  const { properties, handleChange } = useNodeProperties(node, onChange);
  const secrets = useSecretOptions();
  const { items: pubsubTopics, error: pubsubError } = useAssetLoader<string>('topics');

  // Form field state extracted from node properties
  const topicArn = properties.topicArn || '';
  const ingestionMode = properties.ingestionMode || 'sqs';
  const queueUrl = properties.queueUrl || '';
  const pubsubTopic = properties.pubsubTopic || '';
  const awsRegion = properties.awsRegion || 'us-east-1';
  const customRegion = properties.customRegion || '';
  const authMode = properties.authMode || 'default';
  const accessKeySecret = properties.accessKeySecret || '';
  const secretKeySecret = properties.secretKeySecret || '';
  const unwrapEnvelope = properties.unwrapEnvelope ?? true;
  const maxNumRecords = properties.maxNumRecords ?? '';
  const maxReadTime = properties.maxReadTime ?? '';
  const endpointOverride = properties.endpointOverride || '';
  const visibilityTimeout = properties.visibilityTimeout ?? '';
  const waitTimeSeconds = properties.waitTimeSeconds ?? '';

  const [showAdvanced, setShowAdvanced] = useState(false);

  // Field validation
  const isArnEmpty = !topicArn.trim();
  const isArnInvalid = topicArn.trim().length > 0 && !topicArn.trim().startsWith('arn:aws');
  const isQueueEmpty = ingestionMode === 'sqs' && !queueUrl.trim();
  const isPubsubEmpty = ingestionMode === 'pubsub' && !pubsubTopic.trim();

  // Fallback chain for system instructions
  const systemInstructions = resolveSystemInstructions(node);

  return (
    <div className="flex-1 flex flex-col gap-4 text-[var(--vscode-text-primary)] text-sm">
      {/* Upstream SNS Topic ARN Input */}
      <PropertyField
        id="snsSourceTopicArn"
        name="topicArn"
        label="Source Topic ARN"
        required="Source Topic ARN is required"
        tooltip="Amazon SNS Topic ARN producing the streaming events (e.g., arn:aws:sns:us-east-1:123456789012:MyTopic). Required."
        value={topicArn}
        invalid={isArnEmpty}
        error={isArnEmpty ? 'Source Topic ARN is required' : null}
        helperText={
          !isArnEmpty && isArnInvalid ? (
            <span className="text-amber-400" role="alert">
              Warning: Standard SNS topic ARNs start with &quot;arn:aws&quot;
            </span>
          ) : null
        }
        placeholder="arn:aws:sns:us-east-1:123456789012:my-topic"
        onChange={handleChange}
        mono={true}
      />

      {/* Streaming Ingestion Architecture Selector */}
      <div className="flex flex-col gap-2 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
        <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          <span>Ingestion Pattern</span>
          <InfoTooltip text="SNS delivers messages via push. Beam ingests SNS streams either via SQS Subscription Fan-Out (AWS standard) or via GCP Pub/Sub Bridge (Dataflow hybrid)." />
        </label>
        <div className="flex flex-col gap-2 mt-1">
          <label className="flex items-center gap-2 cursor-pointer text-xs text-[var(--vscode-text-secondary)]">
            <input
              type="radio"
              name="ingestionMode"
              value="sqs"
              checked={ingestionMode === 'sqs'}
              onChange={handleChange}
              className="accent-[var(--vscode-highlight)] text-[var(--vscode-highlight)]"
            />
            <span>Amazon SQS Fan-Out Queue (AWS Standard)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-xs text-[var(--vscode-text-secondary)]">
            <input
              type="radio"
              name="ingestionMode"
              value="pubsub"
              checked={ingestionMode === 'pubsub'}
              onChange={handleChange}
              className="accent-[var(--vscode-highlight)] text-[var(--vscode-highlight)]"
            />
            <span>GCP Pub/Sub Bridge (Dataflow Hybrid)</span>
          </label>
        </div>

        {/* SQS Fan-Out Configuration */}
        {ingestionMode === 'sqs' && (
          <div className="flex flex-col gap-3 mt-2 pl-2 border-l-2 border-[var(--vscode-highlight)]/50">
            <PropertyField
              id="snsSourceQueueUrl"
              name="queueUrl"
              label="SQS Queue URL or ARN"
              required="Queue URL is required for SQS Fan-Out mode"
              tooltip="The Amazon SQS queue subscribed to the SNS topic that Beam reads from (e.g., https://sqs.us-east-1.amazonaws.com/123456789012/my-queue). Required."
              value={queueUrl}
              invalid={isQueueEmpty}
              error={isQueueEmpty ? 'Queue URL is required for SQS Fan-Out mode' : null}
              placeholder="https://sqs.us-east-1.amazonaws.com/123456789012/my-queue"
              onChange={handleChange}
              mono={true}
            />

            {/* AWS Region */}
            <div className="flex flex-col gap-1">
              <label htmlFor="snsSourceAwsRegion" className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
                <span>AWS Region</span>
                <InfoTooltip text="The AWS Region hosting the SQS Queue and SNS Topic." />
              </label>
              <select
                id="snsSourceAwsRegion"
                name="awsRegion"
                value={awsRegion}
                onChange={handleChange}
                className="bg-[var(--vscode-input-bg)] text-[var(--vscode-text-primary)] p-2 rounded border border-[var(--vscode-border)] text-xs focus:outline-none focus:border-[var(--vscode-highlight)]"
              >
                {AWS_REGIONS.map(r => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
                <option value="custom">Custom Region...</option>
              </select>
              {awsRegion === 'custom' && (
                <input
                  id="snsSourceCustomRegion"
                  type="text"
                  name="customRegion"
                  aria-label="Custom AWS Region"
                  value={customRegion}
                  onChange={handleChange}
                  placeholder="e.g. me-central-1"
                  className="bg-[var(--vscode-input-bg)] text-[var(--vscode-text-primary)] p-2 rounded border border-[var(--vscode-border)] text-xs focus:outline-none focus:border-[var(--vscode-highlight)] mt-1 font-mono"
                />
              )}
            </div>

            {/* AWS Credentials */}
            <div className="flex flex-col gap-2 mt-1">
              <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
                <span>AWS Credentials</span>
                <InfoTooltip text="Choose AWS credential resolution strategy: default AWS provider chain or secret manager reference." />
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-1.5 cursor-pointer text-xs text-[var(--vscode-text-secondary)]">
                  <input
                    type="radio"
                    name="authMode"
                    value="default"
                    checked={authMode === 'default'}
                    onChange={handleChange}
                    className="accent-[var(--vscode-highlight)]"
                  />
                  <span>Default Chain</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer text-xs text-[var(--vscode-text-secondary)]">
                  <input
                    type="radio"
                    name="authMode"
                    value="secret_manager"
                    checked={authMode === 'secret_manager'}
                    onChange={handleChange}
                    className="accent-[var(--vscode-highlight)]"
                  />
                  <span>Secret Manager</span>
                </label>
              </div>

              {authMode === 'secret_manager' && (
                <div className="flex flex-col gap-2 mt-1">
                  <PropertyField
                    id="snsSourceAccessKeySecret"
                    name="accessKeySecret"
                    label="AWS Access Key Secret"
                    tooltip="Secret Manager secret name for AWS access key ID."
                    value={accessKeySecret}
                    onChange={handleChange}
                    list="source-secret-options"
                    datalist={secrets.options}
                    placeholder="Access Key Secret (e.g. aws-access-key-id)"
                    error={secrets.error}
                    invalid={!!secrets.error}
                    mono={true}
                  />
                  <PropertyField
                    id="snsSourceSecretKeySecret"
                    name="secretKeySecret"
                    label="AWS Secret Key Secret"
                    tooltip="Secret Manager secret name for AWS secret access key."
                    value={secretKeySecret}
                    onChange={handleChange}
                    list="source-secret-options"
                    datalist={secrets.options}
                    placeholder="Secret Key Secret (e.g. aws-secret-access-key)"
                    mono={true}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* GCP Pub/Sub Bridge Configuration */}
        {ingestionMode === 'pubsub' && (
          <div className="flex flex-col gap-2 mt-2 pl-2 border-l-2 border-[var(--vscode-highlight)]/50">
            <PropertyField
              id="snsSourcePubsubTopic"
              name="pubsubTopic"
              label="Bridge Pub/Sub Topic"
              required="Pub/Sub topic is required for Pub/Sub Bridge mode"
              tooltip="The GCP Pub/Sub topic receiving forwarded SNS events (populated from gcloud pubsub topics list)."
              value={pubsubTopic}
              invalid={isPubsubEmpty || !!pubsubError}
              error={isPubsubEmpty ? 'Pub/Sub topic is required for Pub/Sub Bridge mode' : pubsubError}
              placeholder="projects/my-project/topics/my-topic"
              onChange={handleChange}
              list="source-pubsub-topics"
              datalist={pubsubTopics}
              mono={true}
            />
          </div>
        )}
      </div>

      {/* Payload Unwrapping Option */}
      <div className="flex items-center gap-2 p-2 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
        <input
          id="snsSourceUnwrapEnvelope"
          type="checkbox"
          name="unwrapEnvelope"
          checked={unwrapEnvelope}
          onChange={handleChange}
          className="rounded border-[var(--vscode-border)] text-[var(--vscode-highlight)] accent-[var(--vscode-highlight)] focus:ring-0"
        />
        <label htmlFor="snsSourceUnwrapEnvelope" className="flex items-center gap-1.5 text-xs text-[var(--vscode-text-secondary)] cursor-pointer">
          <span>Unwrap SNS Envelope</span>
          <InfoTooltip text="Automatically parses the SNS JSON delivery wrapper and extracts the inner 'Message' payload and attributes." />
        </label>
      </div>

      {/* Collapsible Advanced Settings */}
      <div className="flex flex-col border border-[var(--vscode-border-light)] rounded-md overflow-hidden">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center justify-between p-2 bg-[var(--vscode-subcard-bg)] text-xs font-bold uppercase text-[var(--vscode-text-muted)] hover:text-[var(--vscode-text-primary)] transition-colors cursor-pointer"
        >
          <span>Advanced Source Settings</span>
          <span>{showAdvanced ? '▲' : '▼'}</span>
        </button>

        {showAdvanced && (
          <div className="p-3 bg-[var(--vscode-workbench-bg)] flex flex-col gap-3 border-t border-[var(--vscode-border-light)]">
            {/* Custom Endpoint Override */}
            <PropertyField
              id="snsSourceEndpointOverride"
              name="endpointOverride"
              label="Service Endpoint Override"
              tooltip="Custom endpoint URL (e.g. http://localhost:4566 for LocalStack integration testing)."
              value={endpointOverride}
              onChange={handleChange}
              placeholder="http://localhost:4566"
              mono={true}
            />

            {/* Bounded Read Limits */}
            <div className="grid grid-cols-2 gap-2">
              <PropertyField
                id="snsSourceMaxNumRecords"
                name="maxNumRecords"
                label="Max Records"
                type="number"
                value={maxNumRecords}
                onChange={handleChange}
                placeholder="Unlimited"
                mono={true}
              />
              <PropertyField
                id="snsSourceMaxReadTime"
                name="maxReadTime"
                label="Max Read Time (s)"
                type="number"
                value={maxReadTime}
                onChange={handleChange}
                placeholder="Unlimited"
                mono={true}
              />
            </div>

            {/* SQS Visibility Timeout & Long Polling */}
            {ingestionMode === 'sqs' && (
              <div className="grid grid-cols-2 gap-2">
                <PropertyField
                  id="snsSourceVisibilityTimeout"
                  name="visibilityTimeout"
                  label="Visibility Timeout (s)"
                  type="number"
                  value={visibilityTimeout}
                  onChange={handleChange}
                  placeholder="30"
                  mono={true}
                />
                <PropertyField
                  id="snsSourceWaitTimeSeconds"
                  name="waitTimeSeconds"
                  label="Wait Time (s)"
                  type="number"
                  value={waitTimeSeconds}
                  onChange={handleChange}
                  placeholder="20"
                  mono={true}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Code Generation Instructions */}
      <SystemInstructionsField
        id="snsSourceInstructions"
        value={systemInstructions}
        tooltip="Optional instructions passed to LLM code generator when synthesizing streaming ingestion pipelines."
        placeholder="e.g. Parse JSON message body into custom schema PCollection"
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
