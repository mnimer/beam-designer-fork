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

import React, { useState, useEffect } from 'react';
import { InfoTooltip } from '../../components/InfoTooltip';

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
  const properties = node.data.properties || {};

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
  const [secrets, setSecrets] = useState<SecretItem[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Validation: Topic ARN is required for SnsIO.write()
  const isArnEmpty = !topicArn.trim();
  const isArnInvalid = topicArn.trim().length > 0 && !topicArn.trim().startsWith('arn:aws');

  // Fallback chain for system instructions
  const systemInstructions =
    node.data.system_instructions ??
    node.data.special_instructions ??
    properties.system_instructions ??
    properties.special_instructions ??
    '';

  // NOTE: Listen for Secret Manager secret entries from the VS Code extension host
  useEffect(() => {
    // Message handler to receive secretsLoaded IPC message
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.command === 'secretsLoaded' && Array.isArray(message.secrets)) {
        setSecrets(message.secrets);
      }
    };
    window.addEventListener('message', handleMessage);

    // Request secrets from VS Code extension
    const vscode = (window as any).vscode;
    if (vscode) {
      vscode.postMessage({ command: 'getSecrets' });
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
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    updateProperty(name, value);
  };

  /**
   * Handles system instructions textarea modification.
   * 
   * @param e React textarea change event
   */
  const handleInstructionsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange({
      ...properties,
      system_instructions: e.target.value
    });
  };

  return (
    <div className="flex-1 flex flex-col gap-4 text-[var(--vscode-text-primary)] text-sm">
      {/* Target Topic ARN Input */}
      <div className="flex flex-col gap-1">
        <label htmlFor="snsSinkTopicArn" className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          <span>Topic ARN</span>
          <span className="text-red-400 font-bold" title="Required">*</span>
          <InfoTooltip text="Amazon SNS Topic ARN to publish messages to (e.g., arn:aws:sns:us-east-1:123456789012:MyTopic). Required." />
        </label>
        <input
          id="snsSinkTopicArn"
          type="text"
          name="topicArn"
          aria-required="true"
          aria-invalid={isArnEmpty}
          value={topicArn}
          onChange={handleChange}
          placeholder="arn:aws:sns:us-east-1:123456789012:my-topic"
          className={`bg-[var(--vscode-input-bg)] text-[var(--vscode-text-primary)] p-2 rounded border text-sm font-mono focus:outline-none transition-colors ${
            isArnEmpty
              ? 'border-red-500/80 focus:border-red-500'
              : isArnInvalid
              ? 'border-amber-500/80 focus:border-amber-500'
              : 'border-[var(--vscode-border)] focus:border-[var(--vscode-highlight)]'
          }`}
        />
        {isArnEmpty && (
          <p className="text-red-400 text-xs mt-1" role="alert">
            Topic ARN is required for SnsIO.write()
          </p>
        )}
        {!isArnEmpty && isArnInvalid && (
          <p className="text-amber-400 text-xs mt-1" role="alert">
            Warning: Standard SNS topic ARNs start with &quot;arn:aws&quot;
          </p>
        )}
      </div>

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
          <input
            id="snsSinkCustomRegion"
            type="text"
            name="customRegion"
            value={customRegion}
            onChange={handleChange}
            placeholder="e.g. me-central-1"
            className="bg-[var(--vscode-input-bg)] text-[var(--vscode-text-primary)] p-2 rounded border border-[var(--vscode-border)] text-sm focus:outline-none focus:border-[var(--vscode-highlight)] mt-1 font-mono"
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
            <div className="flex flex-col gap-1">
              <label htmlFor="snsSinkAccessKeySecret" className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
                <span>AWS Access Key Secret</span>
              </label>
              <input
                id="snsSinkAccessKeySecret"
                type="text"
                name="accessKeySecret"
                value={accessKeySecret}
                onChange={handleChange}
                list="secret-options"
                placeholder="e.g. aws-access-key-id"
                className="bg-[var(--vscode-input-bg)] text-[var(--vscode-text-primary)] p-2 rounded border border-[var(--vscode-border)] text-xs font-mono focus:outline-none focus:border-[var(--vscode-highlight)]"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="snsSinkSecretKeySecret" className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
                <span>AWS Secret Key Secret</span>
              </label>
              <input
                id="snsSinkSecretKeySecret"
                type="text"
                name="secretKeySecret"
                value={secretKeySecret}
                onChange={handleChange}
                list="secret-options"
                placeholder="e.g. aws-secret-access-key"
                className="bg-[var(--vscode-input-bg)] text-[var(--vscode-text-primary)] p-2 rounded border border-[var(--vscode-border)] text-xs font-mono focus:outline-none focus:border-[var(--vscode-highlight)]"
              />
            </div>
            <datalist id="secret-options">
              {secrets.map(s => (
                <option key={s.id || s.name} value={s.id || s.name} />
              ))}
            </datalist>
          </div>
        )}
      </div>

      {/* Message Subject */}
      <div className="flex flex-col gap-1">
        <label htmlFor="snsSinkSubject" className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          <span>Subject (Optional)</span>
          <InfoTooltip text="Optional subject line used when delivering messages to email or mobile endpoints." />
        </label>
        <input
          id="snsSinkSubject"
          type="text"
          name="subject"
          value={subject}
          onChange={handleChange}
          placeholder="e.g. Pipeline Notification"
          className="bg-[var(--vscode-input-bg)] text-[var(--vscode-text-primary)] p-2 rounded border border-[var(--vscode-border)] text-sm focus:outline-none focus:border-[var(--vscode-highlight)]"
        />
      </div>

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
            <div className="flex flex-col gap-1">
              <label htmlFor="snsSinkEndpointOverride" className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
                <span>Endpoint Override URL</span>
                <InfoTooltip text="Custom SNS service endpoint (e.g., http://localhost:4566 for LocalStack integration testing or VPC private endpoint)." />
              </label>
              <input
                id="snsSinkEndpointOverride"
                type="text"
                name="endpointOverride"
                value={endpointOverride}
                onChange={handleChange}
                placeholder="http://localhost:4566"
                className="bg-[var(--vscode-input-bg)] text-[var(--vscode-text-primary)] p-2 rounded border border-[var(--vscode-border)] text-xs font-mono focus:outline-none focus:border-[var(--vscode-highlight)]"
              />
            </div>

            {/* Max Retries & Request Timeout */}
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <label htmlFor="snsSinkMaxRetries" className="flex items-center gap-1 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
                  <span>Max Retries</span>
                </label>
                <input
                  id="snsSinkMaxRetries"
                  type="number"
                  name="maxRetries"
                  value={maxRetries}
                  onChange={handleChange}
                  placeholder="3"
                  className="bg-[var(--vscode-input-bg)] text-[var(--vscode-text-primary)] p-2 rounded border border-[var(--vscode-border)] text-xs font-mono focus:outline-none focus:border-[var(--vscode-highlight)]"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="snsSinkRequestTimeoutMs" className="flex items-center gap-1 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
                  <span>Request Timeout (ms)</span>
                </label>
                <input
                  id="snsSinkRequestTimeoutMs"
                  type="number"
                  name="requestTimeoutMs"
                  value={requestTimeoutMs}
                  onChange={handleChange}
                  placeholder="5000"
                  className="bg-[var(--vscode-input-bg)] text-[var(--vscode-text-primary)] p-2 rounded border border-[var(--vscode-border)] text-xs font-mono focus:outline-none focus:border-[var(--vscode-highlight)]"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Flexible Spacer */}
      <div className="flex-1 min-h-[16px]" />

      {/* Code Generation Instructions */}
      <div className="flex flex-col gap-1">
        <label htmlFor="snsSinkInstructions" className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          <span>Code Generation Instructions</span>
          <InfoTooltip text="Optional custom instructions passed to the LLM code generator when synthesizing Java or Python pipeline scripts." />
        </label>
        <textarea
          id="snsSinkInstructions"
          rows={3}
          value={systemInstructions}
          onChange={handleInstructionsChange}
          placeholder="e.g. Map incoming PCollection elements to custom PublishRequest with message attributes"
          className="bg-[var(--vscode-input-bg)] text-[var(--vscode-text-primary)] p-2 rounded border border-[var(--vscode-border)] text-xs focus:outline-none focus:border-[var(--vscode-highlight)] resize-none font-mono"
        />
      </div>
    </div>
  );
};
