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

import React, { useState, useEffect } from 'react';
import { InfoTooltip } from '../../components/InfoTooltip';
import { PropertyField } from '../../components/common/PropertyField';

export interface SecretItem {
  id: string;
  name: string;
  fullName?: string;
}

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
  const properties = node.data.properties || {};

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

  // Local state for dynamically loaded GCP resources
  const [secrets, setSecrets] = useState<SecretItem[]>([]);
  const [pubsubTopics, setPubsubTopics] = useState<string[]>([]);
  const [secretError, setSecretError] = useState<string | null>(null);
  const [pubsubError, setPubsubError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Field validation
  const isArnEmpty = !topicArn.trim();
  const isArnInvalid = topicArn.trim().length > 0 && !topicArn.trim().startsWith('arn:aws');
  const isQueueEmpty = ingestionMode === 'sqs' && !queueUrl.trim();
  const isPubsubEmpty = ingestionMode === 'pubsub' && !pubsubTopic.trim();

  // Fallback chain for system instructions
  const systemInstructions =
    node.data.system_instructions ??
    node.data.special_instructions ??
    properties.system_instructions ??
    properties.special_instructions ??
    '';

  // NOTE: Listen for Secret Manager and Pub/Sub responses from VS Code extension host
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message && message.command === 'secretsLoaded') {
        if (Array.isArray(message.secrets)) {
          // NOTE: Normalize secrets so both strings and SecretItem objects resolve correctly with short secret ID
          const loaded: SecretItem[] = message.secrets.map((s: any) => {
            if (typeof s === 'string') {
              const shortId = s.split('/').filter(Boolean).pop() || s;
              return { id: shortId, name: shortId };
            }
            const shortId = s.id || s.name || '';
            return { id: shortId, name: s.name || shortId, fullName: s.fullName };
          });
          setSecrets(loaded);
        }
        setSecretError(message.error || null);
      }
      if (message.command === 'topicsLoaded') {
        if (Array.isArray(message.topics)) {
          setPubsubTopics(message.topics);
        }
        setPubsubError(message.error || null);
      }
    };
    window.addEventListener('message', handleMessage);

    // Request secrets and pubsub topics from extension host
    const vscode = (window as any).vscode;
    if (vscode) {
      vscode.postMessage({ command: 'getSecrets' });
      vscode.postMessage({ command: 'getTopics' });
    }

    return () => window.removeEventListener('message', handleMessage);
  }, []);

  /**
   * Updates a generic property value and triggers onChange callback.
   * 
   * @param name The property name key
   * @param value The updated property value
   */
  const updateProperty = (name: string, value: any) => {
    const updated = { ...properties, [name]: value };
    onChange(updated);
  };

  /**
   * Handles text and select input changes.
   * 
   * @param e Standard React change event
   */
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      updateProperty(name, checked);
    } else {
      updateProperty(name, value);
    }
  };

  /**
   * Handles system instructions textarea modification.
   * 
   * @param e React textarea change event
   */
  const handleInstructionsChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    onChange({
      ...properties,
      system_instructions: e.target.value
    });
  };

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
                    value={accessKeySecret}
                    onChange={handleChange}
                    list="source-secret-options"
                    placeholder="Access Key Secret (e.g. aws-access-key-id)"
                    error={secretError}
                    invalid={!!secretError}
                    mono={true}
                  />
                  <PropertyField
                    id="snsSourceSecretKeySecret"
                    name="secretKeySecret"
                    value={secretKeySecret}
                    onChange={handleChange}
                    list="source-secret-options"
                    placeholder="Secret Key Secret (e.g. aws-secret-access-key)"
                    mono={true}
                  />
                  <datalist id="source-secret-options">
                    {secrets.map(s => (
                      <option key={s.id || s.name} value={s.id || s.name} />
                    ))}
                  </datalist>
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
              mono={true}
            />
            <datalist id="source-pubsub-topics">
              {pubsubTopics.map(t => (
                <option key={t} value={t} />
              ))}
            </datalist>
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

      {/* Flexible Spacer */}
      <div className="flex-1 min-h-[16px]" />

      {/* Code Generation Instructions */}
      <PropertyField
        id="snsSourceInstructions"
        name="system_instructions"
        label="Code Generation Instructions"
        tooltip="Optional instructions passed to LLM code generator when synthesizing streaming ingestion pipelines."
        type="textarea"
        rows={3}
        value={systemInstructions}
        onChange={handleInstructionsChange}
        placeholder="e.g. Parse JSON message body into custom schema PCollection"
        mono={true}
      />
    </div>
  );
};
