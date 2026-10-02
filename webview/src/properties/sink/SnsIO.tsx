/**
 * SnsIOSinkProperties Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Renders the property configuration panel for Apache Beam SnsIO Write Sink nodes
 * (org.apache.beam.sdk.io.aws2.sns.SnsIO.write() in Java / cross-language external transform in Python).
 * 
 * Architectural Decisions:
 * - Requires target Topic ARN with instant visual validation, red border highlighting, and aria-invalid flags.
 * - Provides AWS Region selector with common AWS region presets and custom region entry.
 * - Supports AWS Credential configuration via GCP Secret Manager integration: requests secrets from the
 *   VS Code extension host via 'getSecrets' callback and populates searchable datalists for secret references.
 * - Allows configuring optional message subject and message structure ('default' vs 'json').
 * - Features collapsible Advanced Client Configuration for custom service endpoints (LocalStack) and retries.
 * - Integrates InfoTooltip components linking form fields to official Apache Beam and AWS documentation.
 * - Preserves system_instructions / special_instructions in the bottom textarea for LLM code generation.
 * - Strictly follows the 8pt grid system (p-2, p-4, gap-2, gap-4) and Tailwind CSS styling.
 */

import React, { useState } from 'react';
import { InfoTooltip } from '../../components/InfoTooltip';
import { PropertyField } from '../../components/common/PropertyField';
import { SystemInstructionsField } from '../../components/common/SystemInstructionsField';
import { resolveSystemInstructions } from '../../utils/systemInstructions';
import { useSecretOptions } from '../../hooks/useSecretOptions';
import { useNodeProperties } from '../../hooks/useNodeProperties';

/**
 * Secret item loaded from Secret Manager for AWS SNS authentication.
 */
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

/**
 * Props for the SnsIOSinkProperties component.
 */
export interface SnsIOSinkPropertiesProps {
  node: {
    data: {
      label?: string;
      beam_transform?: string;
      system_instructions?: string;
      special_instructions?: string;
      properties?: {
        topicArn?: string;
        awsRegion?: string;
        customRegion?: string;
        authMode?: 'default' | 'secret_manager' | 'explicit';
        accessKeySecret?: string;
        secretKeySecret?: string;
        subject?: string;
        messageStructure?: 'default' | 'json';
        endpointOverride?: string;
        maxRetries?: number | string;
        requestTimeoutMs?: number | string;
        system_instructions?: string;
        special_instructions?: string;
        [key: string]: any;
      };
    };
  };
  onChange: (properties: any) => void;
}

/**
 * SnsIOSinkProperties component rendering the property panel for SnsIO Sink.
 * 
 * @param props Component properties containing the active node and onChange callback
 */
export const SnsIOSinkProperties: React.FC<SnsIOSinkPropertiesProps> = ({ node, onChange }) => {
  const { properties, handleChange } = useNodeProperties(node, onChange);

  // Form field state extracted from node properties
  const topicArn = properties.topicArn || '';
  const awsRegion = properties.awsRegion || 'us-east-1';
  const customRegion = properties.customRegion || '';
  const authMode = properties.authMode || 'default';
  const accessKeySecret = properties.accessKeySecret || '';
  const secretKeySecret = properties.secretKeySecret || '';
  const subject = properties.subject || '';
  const messageStructure = properties.messageStructure || 'default';
  const endpointOverride = properties.endpointOverride || '';
  const maxRetries = properties.maxRetries ?? '';
  const requestTimeoutMs = properties.requestTimeoutMs ?? '';

  // Local UI state
  const secrets = useSecretOptions();
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Validation: Topic ARN is required for SnsIO.write()
  const isArnEmpty = !topicArn.trim();
  const isArnInvalid = topicArn.trim().length > 0 && !topicArn.trim().startsWith('arn:aws');

  // Fallback chain for system instructions
  const systemInstructions = resolveSystemInstructions(node);

  return (
    <div className="flex-1 flex flex-col gap-4 text-[var(--vscode-text-primary)] text-sm">
      {/* Target Topic ARN Input */}
      <PropertyField
        id="snsSinkTopicArn"
        name="topicArn"
        label="Topic ARN"
        required
        tooltip="Amazon SNS Topic ARN to publish messages to (e.g., arn:aws:sns:us-east-1:123456789012:MyTopic). Required."
        value={topicArn}
        onChange={handleChange}
        placeholder="arn:aws:sns:us-east-1:123456789012:my-topic"
        error={isArnEmpty ? 'Topic ARN is required for SnsIO.write()' : undefined}
      >
        {!isArnEmpty && isArnInvalid && (
          <p className="text-amber-400 text-xs mt-1" role="alert">
            Warning: Standard SNS topic ARNs start with &quot;arn:aws&quot;
          </p>
        )}
      </PropertyField>

      {/* AWS Region Selector */}
      <div className="flex flex-col gap-1">
        <label htmlFor="snsSinkAwsRegion" className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          <span>AWS Region</span>
          <InfoTooltip text="The AWS Region hosting the SNS Topic (e.g. us-east-1). Inferred from ARN if omitted." />
        </label>
        <select
          id="snsSinkAwsRegion"
          name="awsRegion"
          value={awsRegion}
          onChange={handleChange}
          className="bg-[var(--vscode-input-bg)] text-[var(--vscode-text-primary)] p-2 rounded border border-[var(--vscode-border)] text-sm focus:outline-none focus:border-[var(--vscode-highlight)]"
        >
          {AWS_REGIONS.map(r => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
          <option value="custom">Custom Region...</option>
        </select>
        {awsRegion === 'custom' && (
          <PropertyField
            id="snsSinkCustomRegion"
            name="customRegion"
            label="Custom AWS Region"
            value={customRegion}
            onChange={handleChange}
            placeholder="e.g. me-central-1"
            className="mt-1 font-mono"
          />
        )}
      </div>

      {/* AWS Credentials & Secrets Configuration */}
      <div className="flex flex-col gap-2 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
        <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          <span>Authentication &amp; Credentials</span>
          <InfoTooltip text="Choose how Beam / Dataflow authenticates to AWS. When running on GCP Dataflow, referencing credentials via Secret Manager avoids hardcoding secrets." />
        </label>
        
        {/* Auth Mode Radio Selector */}
        <div className="flex flex-col gap-2 mt-1">
          <label className="flex items-center gap-2 cursor-pointer text-xs text-[var(--vscode-text-secondary)]">
            <input
              type="radio"
              name="authMode"
              value="default"
              checked={authMode === 'default'}
              onChange={handleChange}
              className="accent-[var(--vscode-highlight)]"
            />
            <span>Default AWS Credential Provider Chain / Environment</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-xs text-[var(--vscode-text-secondary)]">
            <input
              type="radio"
              name="authMode"
              value="secret_manager"
              checked={authMode === 'secret_manager'}
              onChange={handleChange}
              className="accent-[var(--vscode-highlight)]"
            />
            <span>GCP Secret Manager (Recommended for Dataflow)</span>
          </label>
        </div>

        {/* Secret Manager Reference Inputs */}
        {authMode === 'secret_manager' && (
          <div className="flex flex-col gap-3 mt-2 pl-2 border-l-2 border-[var(--vscode-highlight)]/50">
            <PropertyField
              id="snsSinkAccessKeySecret"
              name="accessKeySecret"
              label="AWS Access Key Secret"
              value={accessKeySecret}
              onChange={handleChange}
              list="secret-options"
              datalist={secrets.options}
              loading={secrets.loading}
              placeholder="e.g. aws-access-key-id"
              error={secrets.error}
            />
            <PropertyField
              id="snsSinkSecretKeySecret"
              name="secretKeySecret"
              label="AWS Secret Key Secret"
              value={secretKeySecret}
              onChange={handleChange}
              list="secret-options"
              datalist={secrets.options}
              loading={secrets.loading}
              placeholder="e.g. aws-secret-access-key"
              error={secrets.error}
            />
          </div>
        )}
      </div>

      {/* Message Subject */}
      <PropertyField
        id="snsSinkSubject"
        name="subject"
        label="Subject (Optional)"
        tooltip="Optional subject line used when delivering messages to email or mobile endpoints."
        value={subject}
        onChange={handleChange}
        placeholder="e.g. Pipeline Notification"
        mono={false}
      />

      {/* Message Structure Toggle */}
      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          <span>Message Structure</span>
          <InfoTooltip text="Set to 'json' if your payload contains separate protocol-specific endpoints (email, sqs, default) as a JSON string." />
        </label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer text-xs text-[var(--vscode-text-secondary)]">
            <input
              type="radio"
              name="messageStructure"
              value="default"
              checked={messageStructure === 'default'}
              onChange={handleChange}
              className="accent-[var(--vscode-highlight)]"
            />
            <span>Default (Raw String)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-xs text-[var(--vscode-text-secondary)]">
            <input
              type="radio"
              name="messageStructure"
              value="json"
              checked={messageStructure === 'json'}
              onChange={handleChange}
              className="accent-[var(--vscode-highlight)]"
            />
            <span>JSON (Protocol Payloads)</span>
          </label>
        </div>
      </div>

      {/* Collapsible Advanced Client Configuration */}
      <div className="flex flex-col border border-[var(--vscode-border-light)] rounded-md overflow-hidden">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center justify-between p-2 bg-[var(--vscode-subcard-bg)] text-xs font-bold uppercase text-[var(--vscode-text-muted)] hover:text-[var(--vscode-text-primary)] transition-colors cursor-pointer"
        >
          <span>Advanced Client Configuration</span>
          <span>{showAdvanced ? '▲' : '▼'}</span>
        </button>

        {showAdvanced && (
          <div className="p-3 bg-[var(--vscode-workbench-bg)] flex flex-col gap-3 border-t border-[var(--vscode-border-light)]">
            {/* Service Endpoint Override */}
            <PropertyField
              id="snsSinkEndpointOverride"
              name="endpointOverride"
              label="Endpoint Override URL"
              tooltip="Custom SNS service endpoint (e.g., http://localhost:4566 for LocalStack integration testing or VPC private endpoint)."
              value={endpointOverride}
              onChange={handleChange}
              placeholder="http://localhost:4566"
            />

            {/* Max Retries & Request Timeout */}
            <div className="grid grid-cols-2 gap-2">
              <PropertyField
                id="snsSinkMaxRetries"
                type="number"
                name="maxRetries"
                label="Max Retries"
                value={maxRetries}
                onChange={handleChange}
                placeholder="3"
              />
              <PropertyField
                id="snsSinkRequestTimeoutMs"
                type="number"
                name="requestTimeoutMs"
                label="Request Timeout (ms)"
                value={requestTimeoutMs}
                onChange={handleChange}
                placeholder="5000"
              />
            </div>
          </div>
        )}
      </div>

      {/* Code Generation Instructions */}
      <SystemInstructionsField
        id="snsSinkInstructions"
        value={systemInstructions}
        tooltip="Optional custom instructions passed to the LLM code generator when synthesizing Java or Python pipeline scripts."
        placeholder="e.g. Map incoming PCollection elements to custom PublishRequest with message attributes"
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
