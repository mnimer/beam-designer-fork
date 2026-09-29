/**
 * KinesisIOSourceProperties Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Renders the property configuration panel for Apache Beam KinesisIO Streaming Source nodes.
 * Supports both Java native KinesisIO (KinesisIO.read() via AWS SDK v2) and Python Cross-Language
 * API (ReadDataFromKinesis).
 * 
 * Architectural Decisions:
 * - Emphasizes form usability by grouping settings into intuitive sections: Stream Configuration,
 *   Authentication, Stream Position, Watermark & Performance, and Advanced Connection Settings.
 * - Integrates with Google Cloud Secret Manager: executes a 'getSecrets' callback to the extension
 *   host to fetch available Secret Manager secrets for secure AWS credential reference without hardcoding.
 * - Supports three Authentication modes: Google Cloud Secret Manager (recommended for Dataflow),
 *   Direct AWS Credentials (with password reveal toggle), and AWS IAM Role / Default Provider Chain.
 * - Validates required fields (Stream Name) with visible error states and accessible ARIA attributes.
 * - Interactive InfoTooltip components attached to each field linking to Beam/AWS documentation.
 * - Fully adheres to the 8pt grid system for spacing, padding, and layout.
 * - Persists custom code generation instructions for LLM prompt tailoring.
 */

import React, { useState, useEffect } from 'react';
import { InfoTooltip } from '../../components/InfoTooltip';
import { PropertyField } from '../../components/common/PropertyField';
import { RefreshCw, ShieldCheck, KeyRound, Radio } from 'lucide-react';

export interface AwsRegionPreset {
  label: string;
  value: string;
}

export const AWS_REGION_PRESETS: AwsRegionPreset[] = [
  { label: 'US East (N. Virginia) [us-east-1]', value: 'us-east-1' },
  { label: 'US East (Ohio) [us-east-2]', value: 'us-east-2' },
  { label: 'US West (N. California) [us-west-1]', value: 'us-west-1' },
  { label: 'US West (Oregon) [us-west-2]', value: 'us-west-2' },
  { label: 'Europe (Ireland) [eu-west-1]', value: 'eu-west-1' },
  { label: 'Europe (Frankfurt) [eu-central-1]', value: 'eu-central-1' },
  { label: 'Europe (London) [eu-west-2]', value: 'eu-west-2' },
  { label: 'Asia Pacific (Tokyo) [ap-northeast-1]', value: 'ap-northeast-1' },
  { label: 'Asia Pacific (Singapore) [ap-southeast-1]', value: 'ap-southeast-1' },
  { label: 'Asia Pacific (Sydney) [ap-southeast-2]', value: 'ap-southeast-2' },
  { label: 'Custom Region...', value: 'custom' },
];

export interface KinesisIOSourceNode {
  data: {
    label: string;
    beam_transform?: string;
    system_instructions?: string;
    special_instructions?: string;
    properties?: {
      streamName?: string;
      region?: string;
      customRegion?: string;
      authMode?: 'secretManager' | 'iam' | string;
      awsAccessKey?: string;
      awsSecretKey?: string;
      accessKeySecretName?: string;
      secretKeySecretName?: string;
      roleArn?: string;
      initialPositionInStream?: 'LATEST' | 'TRIM_HORIZON' | 'AT_TIMESTAMP';
      initialTimestampInStream?: string;
      watermarkPolicy?: 'ArrivalTime' | 'ProcessingTime' | 'Custom';
      watermarkIdleDurationThreshold?: string | number;
      maxNumRecords?: string | number;
      maxReadTime?: string | number;
      requestRecordsLimit?: string | number;
      rateLimit?: string | number;
      serviceEndpoint?: string;
      verifyCertificate?: boolean;
      expansionService?: string;
      system_instructions?: string;
      special_instructions?: string;
      [key: string]: any;
    };
  };
}

interface KinesisIOSourcePropertiesProps {
  node: KinesisIOSourceNode;
  onChange: (properties: any) => void;
}

/**
 * KinesisIOSourceProperties renders the configuration panel for reading from Amazon Kinesis.
 *
 * @param props Component properties containing the active node data and onChange callback.
 * @returns React component.
 */
export const KinesisIOSourceProperties: React.FC<KinesisIOSourcePropertiesProps> = ({ node, onChange }) => {
  const properties = node?.data?.properties || {};

  // Form Field State Values
  const streamName = properties.streamName || '';
  const region = properties.region || 'us-east-1';
  const customRegion = properties.customRegion || '';
  const authMode = properties.authMode === 'iam' ? 'iam' : 'secretManager';
  const accessKeySecretName = properties.accessKeySecretName || '';
  const secretKeySecretName = properties.secretKeySecretName || '';
  const roleArn = properties.roleArn || '';
  const initialPositionInStream = properties.initialPositionInStream || 'LATEST';
  const initialTimestampInStream = properties.initialTimestampInStream || '';
  const watermarkPolicy = properties.watermarkPolicy || 'ArrivalTime';
  const watermarkIdleDurationThreshold = properties.watermarkIdleDurationThreshold ?? '';
  const maxNumRecords = properties.maxNumRecords ?? '';
  const maxReadTime = properties.maxReadTime ?? '';
  const requestRecordsLimit = properties.requestRecordsLimit ?? '';
  const rateLimit = properties.rateLimit ?? '';
  const serviceEndpoint = properties.serviceEndpoint || '';
  const verifyCertificate = properties.verifyCertificate ?? true;
  const expansionService = properties.expansionService || '';

  // Local UI State
  const [secrets, setSecrets] = useState<string[]>([]);
  const [secretsError, setSecretsError] = useState<string | null>(null);
  const [isLoadingSecrets, setIsLoadingSecrets] = useState(false);

  // System instructions text with fallbacks
  const systemInstructions =
    node.data.system_instructions ??
    node.data.special_instructions ??
    properties.system_instructions ??
    properties.special_instructions ??
    '';

  // Listen for secrets loaded message from extension host IPC
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message && message.command === 'secretsLoaded') {
        const rawSecrets = Array.isArray(message.secrets) ? message.secrets : [];
        // NOTE: Normalize secrets payload to short secret IDs so source and sink are consistent
        // and avoid emitting [object Object] or full resource paths to the pipeline.
        const secretIds = rawSecrets.map((s: any) =>
          typeof s === 'string' ? (s.split('/').filter(Boolean).pop() || s) : (s.id || s.name || '')
        ).filter(Boolean);
        setSecrets(secretIds);
        setIsLoadingSecrets(false);
        setSecretsError(message.error || null);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  /**
   * Dispatches a request to the extension to load GCP Secret Manager secrets.
   */
  const requestSecrets = () => {
    const vscode = (window as any).vscode;
    if (vscode) {
      setIsLoadingSecrets(true);
      setSecretsError(null);
      vscode.postMessage({ command: 'getSecrets' });
    }
  };

  // Automatically request secrets on mount or when switching to secretManager auth mode
  useEffect(() => {
    if (authMode === 'secretManager') {
      requestSecrets();
    }
  }, [authMode]);

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

    delete newProperties.awsAccessKey;
    delete newProperties.awsSecretKey;

    onChange(newProperties);
  };

  /**
   * Handles custom system instructions textarea change for LLM prompt overrides.
   * 
   * @param e Form change event from textarea.
   */
  const handleInstructionsChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    onChange({
      ...properties,
      system_instructions: e.target.value
    });
  };

  // Region preset handling
  const isRegionPreset = AWS_REGION_PRESETS.some(r => r.value === region && r.value !== 'custom');
  const selectedRegionPreset = isRegionPreset ? region : 'custom';
  const customRegionValue = isRegionPreset ? customRegion : (customRegion || (region !== 'custom' ? region : ''));

  // Validation state: Stream Name is mandatory in Apache Beam KinesisIO
  const isStreamNameInvalid = !streamName.trim();

  return (
    <div className="flex-1 flex flex-col gap-4">
      {/* SECTION 1: STREAM CONFIGURATION */}
      <div className="border border-[var(--vscode-border)] rounded-md p-3 bg-[var(--vscode-card-bg)] flex flex-col gap-3">
        <div className="flex items-center gap-2 pb-1 border-b border-[var(--vscode-border-light)]">
          <Radio className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-bold uppercase tracking-wide text-[var(--vscode-text-primary)]">Stream Configuration</span>
        </div>

        {/* Stream Name Input */}
        <PropertyField
          id="kinesisStreamName"
          name="streamName"
          label="Stream Name"
          required="Stream Name is required to initialize KinesisIO reader."
          tooltip="The name of the Amazon Kinesis stream to read from (e.g. telemetry-events). Required by KinesisIO."
          aria-required="true"
          aria-invalid={isStreamNameInvalid}
          value={streamName}
          onChange={handleChange}
          placeholder="e.g. telemetry-stream"
          invalid={isStreamNameInvalid}
          error={isStreamNameInvalid ? 'Stream Name is required to initialize KinesisIO reader.' : null}
          mono={true}
        />

        {/* AWS Region Selector */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="kinesisRegion" className="flex items-center text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
            <span>AWS Region</span>
            <InfoTooltip text="Target cloud region where the stream resides, such as us-east-1 or us-west-2." />
          </label>
          <select
            id="kinesisRegion"
            name="region"
            value={selectedRegionPreset}
            onChange={(e) => {
              const val = e.target.value;
              if (val === 'custom') {
                onChange({ ...properties, region: 'custom', customRegion: customRegionValue });
              } else {
                onChange({ ...properties, region: val, customRegion: '' });
              }
            }}
            className="bg-[var(--vscode-input-bg)] text-[var(--vscode-text-primary)] p-2 rounded border border-[var(--vscode-border)] text-sm focus:outline-none focus:border-emerald-500"
          >
            {AWS_REGION_PRESETS.map((preset) => (
              <option key={preset.value} value={preset.value}>
                {preset.label}
              </option>
            ))}
          </select>

          {selectedRegionPreset === 'custom' && (
            <input
              type="text"
              name="customRegion"
              aria-label="Custom AWS Region"
              value={customRegionValue}
              onChange={(e) => {
                onChange({
                  ...properties,
                  region: 'custom',
                  customRegion: e.target.value
                });
              }}
              placeholder="e.g. us-gov-west-1 or me-central-1"
              className="bg-[var(--vscode-input-bg)] text-[var(--vscode-text-primary)] p-2 rounded border border-[var(--vscode-border)] text-sm focus:outline-none focus:border-emerald-500 font-mono mt-1"
            />
          )}
        </div>
      </div>

      {/* SECTION 2: AUTHENTICATION & CREDENTIALS */}
      <div className="border border-[var(--vscode-border)] rounded-md p-3 bg-[var(--vscode-card-bg)] flex flex-col gap-3">
        <div className="flex items-center justify-between pb-1 border-b border-[var(--vscode-border-light)]">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold uppercase tracking-wide text-[var(--vscode-text-primary)]">Authentication</span>
          </div>
          <InfoTooltip text="Choose how credentials are provided. For Google Cloud Dataflow, Secret Manager references are recommended to prevent credential leakage." />
        </div>

        {/* Auth Mode Radio Selector */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-[var(--vscode-subcard-bg)] rounded border border-[var(--vscode-border)]">
          <button
            type="button"
            onClick={() => {
              const next = { ...properties, authMode: 'secretManager' };
              delete next.awsAccessKey;
              delete next.awsSecretKey;
              onChange(next);
            }}
            className={`text-xs py-1.5 px-2 rounded font-medium transition-colors ${
              authMode === 'secretManager'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 shadow-sm'
                : 'bg-[var(--vscode-button-secondary)] text-[var(--vscode-text-secondary)] border border-[var(--vscode-border)] hover:bg-[var(--vscode-hover)]'
            }`}
          >
            Secret Manager
          </button>
          <button
            type="button"
            onClick={() => {
              const next = { ...properties, authMode: 'iam' };
              delete next.awsAccessKey;
              delete next.awsSecretKey;
              onChange(next);
            }}
            className={`text-xs py-1.5 px-2 rounded font-medium transition-colors ${
              authMode === 'iam'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 shadow-sm'
                : 'bg-[var(--vscode-button-secondary)] text-[var(--vscode-text-secondary)] border border-[var(--vscode-border)] hover:bg-[var(--vscode-hover)]'
            }`}
          >
            IAM / Default
          </button>
        </div>

        {/* Auth Mode: Secret Manager */}
        {authMode === 'secretManager' && (
          <div className="flex flex-col gap-2.5 pt-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-emerald-400/90 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                GCP Secret Manager (Live suggestions from gcloud)
              </span>
              <button
                type="button"
                onClick={requestSecrets}
                title="Refresh secrets from gcloud"
                className="text-xs text-[var(--vscode-text-muted)] hover:text-emerald-400 flex items-center gap-1 cursor-pointer transition-colors"
              >
                <RefreshCw className={`w-3 h-3 ${isLoadingSecrets ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>

            {/* Access Key Secret */}
            <PropertyField
              id="accessKeySecretName"
              name="accessKeySecretName"
              label="AWS Access Key Secret Name"
              tooltip="GCP Secret Manager secret resource name containing the AWS Access Key ID."
              value={accessKeySecretName}
              onChange={handleChange}
              placeholder="e.g. aws-access-key-id"
              list="gcloud-secrets-list"
              datalist={secrets}
              error={secretsError}
              invalid={!!secretsError}
              mono={true}
            />

            {/* Secret Key Secret */}
            <PropertyField
              id="secretKeySecretName"
              name="secretKeySecretName"
              label="AWS Secret Key Secret Name"
              tooltip="GCP Secret Manager secret resource name containing the AWS Secret Access Key."
              value={secretKeySecretName}
              onChange={handleChange}
              placeholder="e.g. aws-secret-access-key"
              list="gcloud-secrets-list"
              datalist={secrets}
              error={secretsError}
              invalid={!!secretsError}
              mono={true}
            />
          </div>
        )}

        {/* Auth Mode: IAM / Default */}
        {authMode === 'iam' && (
          <div className="flex flex-col gap-2 pt-1 text-xs text-[var(--vscode-text-secondary)]">
            <p>
              Uses AWS Default Credential Provider Chain (environment variables, EC2 instance profile, or EKS/GKE IRSA / Web Identity token).
            </p>
            <PropertyField
              id="roleArn"
              name="roleArn"
              label="Assume Role ARN (Optional)"
              tooltip="AWS IAM Role ARN to assume via STS for cross-account or fine-grained pipeline access."
              value={roleArn}
              onChange={handleChange}
              placeholder="arn:aws:iam::123456789012:role/BeamKinesisRole"
              mono={true}
            />
          </div>
        )}
      </div>

      {/* SECTION 3: STREAM POSITION */}
      <div className="border border-[var(--vscode-border)] rounded-md p-3 bg-[var(--vscode-card-bg)] flex flex-col gap-3">
        <div className="flex items-center gap-2 pb-1 border-b border-[var(--vscode-border-light)]">
          <span className="text-xs font-bold uppercase tracking-wide text-[var(--vscode-text-primary)]">Stream Position</span>
          <InfoTooltip text="Configures where in the Kinesis shards the reader begins consuming when no prior checkpoint exists." />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="initialPositionInStream" className="flex items-center text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
            <span>Initial Position</span>
            <InfoTooltip text="Shard iterator position: LATEST starts with new records, TRIM_HORIZON starts with oldest retained, AT_TIMESTAMP starts from a designated point in time." />
          </label>
          <select
            id="initialPositionInStream"
            name="initialPositionInStream"
            value={initialPositionInStream}
            onChange={handleChange}
            className="bg-[var(--vscode-input-bg)] text-[var(--vscode-text-primary)] p-2 rounded border border-[var(--vscode-border)] text-sm focus:outline-none focus:border-emerald-500"
          >
            <option value="LATEST">LATEST - Start after most recent record (New incoming data)</option>
            <option value="TRIM_HORIZON">TRIM_HORIZON - Start from oldest available record in stream</option>
            <option value="AT_TIMESTAMP">AT_TIMESTAMP - Start reading from specific timestamp</option>
          </select>
        </div>

        {initialPositionInStream === 'AT_TIMESTAMP' && (
          <PropertyField
            id="initialTimestampInStream"
            name="initialTimestampInStream"
            label="Initial Timestamp"
            tooltip="Point in time from which to start reading (ISO-8601 string or epoch milliseconds). Must be in the past."
            value={initialTimestampInStream}
            onChange={handleChange}
            placeholder="e.g. 2026-09-01T00:00:00Z or 1788220800000"
            mono={true}
          />
        )}
      </div>

      {/* SECTION 4: WATERMARK & PERFORMANCE LIMITS */}
      <div className="border border-[var(--vscode-border)] rounded-md p-3 bg-[var(--vscode-card-bg)] flex flex-col gap-3">
        <div className="flex items-center gap-2 pb-1 border-b border-[var(--vscode-border-light)]">
          <span className="text-xs font-bold uppercase tracking-wide text-[var(--vscode-text-primary)]">Watermark & Limits</span>
          <InfoTooltip text="Throttling, watermarks, and testing limit policies for Kinesis streaming reads." />
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Watermark Policy */}
          <div className="flex flex-col gap-1">
            <label htmlFor="watermarkPolicy" className="flex items-center text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
              <span>Watermark Policy</span>
              <InfoTooltip text="Determines event timestamp and watermark progression: ArrivalTime (Kinesis record arrival), ProcessingTime (worker wall-clock), or Custom." />
            </label>
            <select
              id="watermarkPolicy"
              name="watermarkPolicy"
              value={watermarkPolicy}
              onChange={handleChange}
              className="bg-[var(--vscode-input-bg)] text-[var(--vscode-text-primary)] p-2 rounded border border-[var(--vscode-border)] text-sm focus:outline-none focus:border-emerald-500"
            >
              <option value="ArrivalTime">Arrival Time (Default)</option>
              <option value="ProcessingTime">Processing Time</option>
              <option value="Custom">Custom Policy</option>
            </select>
          </div>

          {/* Idle Threshold */}
          <PropertyField
            id="watermarkIdleDurationThreshold"
            type="number"
            name="watermarkIdleDurationThreshold"
            label="Idle Threshold (sec)"
            tooltip="Duration in seconds before an idle shard advances its watermark to keep pipeline processing alive."
            value={watermarkIdleDurationThreshold}
            onChange={handleChange}
            placeholder="e.g. 60"
            min="0"
            mono={true}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Max Records (bounded) */}
          <PropertyField
            id="maxNumRecords"
            type="number"
            name="maxNumRecords"
            label="Max Records (Test)"
            tooltip="Limits the total records ingested to convert an unbounded streaming source into bounded batch testing execution."
            value={maxNumRecords}
            onChange={handleChange}
            placeholder="Unlimited"
            min="1"
            mono={true}
          />

          {/* Max Read Time (bounded) */}
          <PropertyField
            id="maxReadTime"
            type="number"
            name="maxReadTime"
            label="Max Read Time (sec)"
            tooltip="Maximum duration in seconds to read records before completing the read transform."
            value={maxReadTime}
            onChange={handleChange}
            placeholder="Unlimited"
            min="1"
            mono={true}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Request Records Limit */}
          <PropertyField
            id="requestRecordsLimit"
            type="number"
            name="requestRecordsLimit"
            label="Per-Request Limit"
            tooltip="Maximum number of records requested per GetRecords call to AWS Kinesis API (up to 10,000)."
            value={requestRecordsLimit}
            onChange={handleChange}
            placeholder="Max 10000"
            min="1"
            max="10000"
            mono={true}
          />

          {/* Rate Limit */}
          <PropertyField
            id="rateLimit"
            type="number"
            name="rateLimit"
            label="Rate Limit (events/sec)"
            tooltip="Throttles the read throughput to a fixed maximum number of events per second."
            value={rateLimit}
            onChange={handleChange}
            placeholder="Unlimited"
            min="1"
            mono={true}
          />
        </div>
      </div>

      {/* SECTION 5: ADVANCED & LOCAL ENDPOINTS */}
      <div className="border border-[var(--vscode-border)] rounded-md p-3 bg-[var(--vscode-card-bg)] flex flex-col gap-3">
        <div className="flex items-center gap-2 pb-1 border-b border-[var(--vscode-border-light)]">
          <span className="text-xs font-bold uppercase tracking-wide text-[var(--vscode-text-primary)]">Advanced Settings</span>
          <InfoTooltip text="Connection overrides for LocalStack or custom mock environments, certificate verification, and expansion service." />
        </div>

        {/* Service Endpoint */}
        <PropertyField
          id="serviceEndpoint"
          name="serviceEndpoint"
          label="Custom Service Endpoint"
          tooltip="Custom endpoint URL for LocalStack, moto, or AWS VPC endpoint gateways (e.g. http://localhost:4566)."
          value={serviceEndpoint}
          onChange={handleChange}
          placeholder="http://localhost:4566 (for LocalStack)"
          mono={true}
        />

        {/* Expansion Service */}
        <PropertyField
          id="kinesisSourceExpansionService"
          name="expansionService"
          label="Cross-Language Expansion Service (Optional)"
          tooltip="Host and port of the Apache Beam Java expansion service used for cross-language KinesisIO in Python pipelines."
          value={expansionService}
          onChange={handleChange}
          placeholder="e.g. localhost:8097"
          mono={true}
        />

        {/* Verify Certificate */}
        <div className="flex items-center gap-2 pt-1">
          <input
            id="verifyCertificate"
            type="checkbox"
            name="verifyCertificate"
            checked={verifyCertificate}
            onChange={handleChange}
            className="rounded border-[var(--vscode-border)] text-emerald-500 focus:ring-0 cursor-pointer"
          />
          <label htmlFor="verifyCertificate" className="text-xs text-[var(--vscode-text-primary)] cursor-pointer">
            Verify SSL Certificates
          </label>
          <InfoTooltip text="Enforce SSL verification for AWS endpoints. Keep checked for production environments." />
        </div>
      </div>

      {/* Flexible Spacer adhering to 8pt grid */}
      <div className="flex-1 min-h-4" />

      {/* SECTION 6: CODE GENERATION INSTRUCTIONS */}
      <div className="pt-2 border-t border-[var(--vscode-border-light)]">
        <PropertyField
          id="kinesisSourceSystemInstructions"
          name="system_instructions"
          label="Code Generation Instructions"
          type="textarea"
          rows={3}
          value={systemInstructions}
          onChange={handleInstructionsChange}
          placeholder="Enter custom instructions for Kinesis source code generation (e.g. AWS credential loading logic, error handling, dead-letter routing)..."
          mono={false}
          className="resize-y"
        />
      </div>
    </div>
  );
};
