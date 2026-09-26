/**
 * KinesisIOSinkProperties Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Renders the property configuration panel for Apache Beam KinesisIO Streaming Sink nodes.
 * Supports both Java native KinesisIO (KinesisIO.write() via AWS SDK v2) and Python Cross-Language
 * API (WriteToKinesis).
 * 
 * Architectural Decisions:
 * - Emphasizes form usability by grouping settings into intuitive sections: Stream Configuration,
 *   Authentication, Partitioning Strategy, Data Serialization, Producer Tuning, and Advanced Settings.
 * - Integrates with Google Cloud Secret Manager: executes a 'getSecrets' callback to the extension
 *   host to fetch available Secret Manager secrets for secure AWS credential reference without hardcoding.
 * - Supports three Authentication modes: Google Cloud Secret Manager (recommended for Dataflow),
 *   Direct AWS Credentials (with password reveal toggle), and AWS IAM Role / Default Provider Chain.
 * - Exposes Kinesis Partition Key routing strategies (Static Key, Record Key from KV pair, Payload Hash, Custom)
 *   to ensure proper record distribution across Kinesis shards.
 * - Provides pre-configured Data Serialization formats (UTF-8 String bytes, Raw Bytes, JSON, Custom).
 * - Exposes high-throughput Kinesis Producer Library (KPL) batching and timeout properties.
 * - Validates required fields (Stream Name) with visible error states and accessible ARIA attributes.
 * - Fully adheres to the 8pt grid system for spacing, padding, and layout.
 * - Persists custom code generation instructions for LLM prompt tailoring.
 */

import React, { useState, useEffect } from 'react';
import { InfoTooltip } from '../../components/InfoTooltip';
import { PropertyField } from '../../components/common/PropertyField';
import { RefreshCw, ShieldCheck, KeyRound, Radio, SplitSquareVertical } from 'lucide-react';
import { AWS_REGION_PRESETS } from '../source/KinesisIO';

export interface KinesisIOSinkNode {
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
      partitionKeyMode?: 'static' | 'recordKey' | 'hash' | 'custom';
      partitionKey?: string;
      dataSerialization?: 'stringUtf8' | 'rawBytes' | 'json';
      collectionMaxCount?: string | number;
      connectTimeout?: string | number;
      requestTimeout?: string | number;
      recordMaxBufferedTime?: string | number;
      producerProperties?: string;
      serviceEndpoint?: string;
      verifyCertificate?: boolean;
      expansionService?: string;
      system_instructions?: string;
      special_instructions?: string;
      [key: string]: any;
    };
  };
}

interface KinesisIOSinkPropertiesProps {
  node: KinesisIOSinkNode;
  onChange: (properties: any) => void;
}

/**
 * KinesisIOSinkProperties renders the configuration panel for writing records to Amazon Kinesis.
 *
 * @param props Component properties containing the active node data and onChange callback.
 * @returns React component.
 */
export const KinesisIOSinkProperties: React.FC<KinesisIOSinkPropertiesProps> = ({ node, onChange }) => {
  // Extract existing properties or fallback to sensible defaults
  const properties = node.data.properties || {};

  const streamName = properties.streamName || '';
  const region = properties.region || 'us-east-1';
  const customRegion = properties.customRegion || '';
  const authMode = properties.authMode === 'iam' ? 'iam' : 'secretManager';
  const accessKeySecretName = properties.accessKeySecretName || '';
  const secretKeySecretName = properties.secretKeySecretName || '';
  const roleArn = properties.roleArn || '';
  const partitionKeyMode = properties.partitionKeyMode || 'recordKey';
  const partitionKey = properties.partitionKey || '';
  const dataSerialization = properties.dataSerialization || 'stringUtf8';
  const collectionMaxCount = properties.collectionMaxCount ?? '';
  const connectTimeout = properties.connectTimeout ?? '';
  const requestTimeout = properties.requestTimeout ?? '';
  const recordMaxBufferedTime = properties.recordMaxBufferedTime ?? '';
  const producerProperties = properties.producerProperties || '';
  const serviceEndpoint = properties.serviceEndpoint || '';
  const verifyCertificate = properties.verifyCertificate ?? true;
  const expansionService = properties.expansionService || '';

  // Local state for secret fetching
  const [secrets, setSecrets] = useState<string[]>([]);
  const [secretError, setSecretError] = useState<string | null>(null);
  const [isLoadingSecrets, setIsLoadingSecrets] = useState<boolean>(false);

  // System instructions text with fallback
  const systemInstructions =
    node.data.system_instructions ??
    node.data.special_instructions ??
    properties.system_instructions ??
    properties.special_instructions ??
    '';

  // Request Secret Manager secrets from the extension host
  const requestSecrets = () => {
    setIsLoadingSecrets(true);
    const vscode = (window as any).vscode;
    if (vscode) {
      vscode.postMessage({ command: 'getSecrets' });
    }
  };

  // Listen for secretsLoaded event from the VS Code extension host
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message && message.command === 'secretsLoaded') {
        setSecretError(message.error || null);
        const rawSecrets = Array.isArray(message.secrets) ? message.secrets : [];
        // NOTE: Normalize secrets payload so both legacy string arrays and SecretItem objects ({name, id, fullName, value})
        // resolve to the short secret ID, preventing "[object Object]" rendering in dropdown options.
        const secretIds = rawSecrets.map((s: any) =>
          typeof s === 'string' ? (s.split('/').filter(Boolean).pop() || s) : (s.id || s.name || '')
        ).filter(Boolean);
        setSecrets(secretIds);
        setIsLoadingSecrets(false);
      }
    };

    window.addEventListener('message', handleMessage);

    // Initial fetch on mount
    requestSecrets();

    return () => window.removeEventListener('message', handleMessage);
  }, []);

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
          <Radio className="w-4 h-4 text-rose-400" />
          <span className="text-xs font-bold uppercase tracking-wide text-[var(--vscode-text-primary)]">Target Stream</span>
        </div>

        {/* Stream Name Input */}
        <PropertyField
          id="kinesisSinkStreamName"
          name="streamName"
          label="Stream Name"
          required
          tooltip="The name of the target Amazon Kinesis stream to publish records to (e.g. processed-events). Required."
          value={streamName}
          onChange={handleChange}
          placeholder="e.g. processed-stream"
          error={isStreamNameInvalid ? 'Stream Name is required to initialize KinesisIO writer.' : undefined}
        />

        {/* AWS Region Selector */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="kinesisSinkRegion" className="flex items-center text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
            <span>AWS Region</span>
            <InfoTooltip text="Target cloud region where the stream resides, such as us-east-1 or us-west-2." />
          </label>
          <select
            id="kinesisSinkRegion"
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
            className="bg-[var(--vscode-input-bg)] text-[var(--vscode-text-primary)] p-2 rounded border border-[var(--vscode-border)] text-sm focus:outline-none focus:border-rose-500"
          >
            {AWS_REGION_PRESETS.map((preset) => (
              <option key={preset.value} value={preset.value}>
                {preset.label}
              </option>
            ))}
          </select>

          {selectedRegionPreset === 'custom' && (
            <PropertyField
              id="kinesisSinkCustomRegion"
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
              className="mt-1 font-mono"
            />
          )}
        </div>
      </div>

      {/* SECTION 2: AUTHENTICATION & CREDENTIALS */}
      <div className="border border-[var(--vscode-border)] rounded-md p-3 bg-[var(--vscode-card-bg)] flex flex-col gap-3">
        <div className="flex items-center justify-between pb-1 border-b border-[var(--vscode-border-light)]">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-rose-400" />
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
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/50 shadow-sm'
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
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/50 shadow-sm'
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
              <span className="text-[11px] text-rose-400/90 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                GCP Secret Manager (Live suggestions from gcloud)
              </span>
              <button
                type="button"
                onClick={requestSecrets}
                title="Refresh secrets from gcloud"
                className="text-xs text-[var(--vscode-text-muted)] hover:text-rose-400 flex items-center gap-1 cursor-pointer transition-colors"
              >
                <RefreshCw className={`w-3 h-3 ${isLoadingSecrets ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>

            {/* Access Key Secret */}
            <PropertyField
              id="kinesisSinkAccessKeySecret"
              name="accessKeySecretName"
              label="AWS Access Key Secret Name"
              tooltip="GCP Secret Manager secret resource name containing the AWS Access Key ID."
              value={accessKeySecretName}
              onChange={handleChange}
              placeholder="e.g. aws-access-key-id"
              list="kinesis-sink-secrets-list"
              datalist={secrets}
              error={secretError}
            />

            {/* Secret Key Secret */}
            <PropertyField
              id="kinesisSinkSecretKeySecret"
              name="secretKeySecretName"
              label="AWS Secret Key Secret Name"
              tooltip="GCP Secret Manager secret resource name containing the AWS Secret Access Key."
              value={secretKeySecretName}
              onChange={handleChange}
              placeholder="e.g. aws-secret-access-key"
              list="kinesis-sink-secrets-list"
              datalist={secrets}
              error={secretError}
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
              id="kinesisSinkRoleArn"
              name="roleArn"
              label="Assume Role ARN (Optional)"
              tooltip="AWS IAM Role ARN to assume via STS for cross-account or fine-grained pipeline access."
              value={roleArn}
              onChange={handleChange}
              placeholder="arn:aws:iam::123456789012:role/BeamKinesisRole"
              containerClassName="flex flex-col gap-1 mt-1"
            />
          </div>
        )}
      </div>

      {/* SECTION 3: PARTITIONING STRATEGY */}
      <div className="border border-[var(--vscode-border)] rounded-md p-3 bg-[var(--vscode-card-bg)] flex flex-col gap-3">
        <div className="flex items-center gap-2 pb-1 border-b border-[var(--vscode-border-light)]">
          <SplitSquareVertical className="w-4 h-4 text-rose-400" />
          <span className="text-xs font-bold uppercase tracking-wide text-[var(--vscode-text-primary)]">Partitioning Strategy</span>
          <InfoTooltip text="Kinesis determines shard placement via partition keys. Choose how partition keys are extracted or generated." />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="partitionKeyMode" className="flex items-center text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
            <span>Partition Key Source</span>
            <InfoTooltip text="Strategy used to determine partition key: upstream key-value pair, static fixed key, hash of payload, or custom expression." />
          </label>
          <select
            id="partitionKeyMode"
            name="partitionKeyMode"
            value={partitionKeyMode}
            onChange={handleChange}
            className="bg-[var(--vscode-input-bg)] text-[var(--vscode-text-primary)] p-2 rounded border border-[var(--vscode-border)] text-sm focus:outline-none focus:border-rose-500"
          >
            <option value="recordKey">Record Key - Use upstream KV pair key (element[0])</option>
            <option value="static">Static Key - All records use fixed partition key</option>
            <option value="hash">Payload Hash - Even distribution via SHA-256 / UUID</option>
            <option value="custom">Custom Expression - Custom partition key lambda / function</option>
          </select>
        </div>

        {partitionKeyMode === 'static' && (
          <PropertyField
            id="partitionKeyStatic"
            name="partitionKey"
            label="Static Partition Key Value"
            tooltip="Constant string used as the partition key for all emitted records."
            value={partitionKey}
            onChange={handleChange}
            placeholder="e.g. default-partition"
          />
        )}

        {partitionKeyMode === 'custom' && (
          <PropertyField
            id="partitionKeyCustom"
            name="partitionKey"
            label="Partition Key Expression / Extractor"
            tooltip="Code snippet or function reference to extract partition key from element."
            value={partitionKey}
            onChange={handleChange}
            placeholder="e.g. record.getDeviceId() or lambda x: x['user_id']"
          />
        )}
      </div>

      {/* SECTION 4: DATA SERIALIZATION */}
      <div className="border border-[var(--vscode-border)] rounded-md p-3 bg-[var(--vscode-card-bg)] flex flex-col gap-3">
        <div className="flex items-center gap-2 pb-1 border-b border-[var(--vscode-border-light)]">
          <span className="text-xs font-bold uppercase tracking-wide text-[var(--vscode-text-primary)]">Data Serialization</span>
          <InfoTooltip text="How elements in the PCollection are converted into binary byte payloads for Kinesis PutRecords." />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="dataSerialization" className="flex items-center text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
            <span>Serialization Format</span>
            <InfoTooltip text="Encoding applied to pipeline elements before writing to Amazon Kinesis." />
          </label>
          <select
            id="dataSerialization"
            name="dataSerialization"
            value={dataSerialization}
            onChange={handleChange}
            className="bg-[var(--vscode-input-bg)] text-[var(--vscode-text-primary)] p-2 rounded border border-[var(--vscode-border)] text-sm focus:outline-none focus:border-rose-500"
          >
            <option value="stringUtf8">String (UTF-8 Bytes)</option>
            <option value="rawBytes">Raw Byte Array / Pass-through</option>
            <option value="json">JSON String (json.dumps / Jackson)</option>
          </select>
        </div>
      </div>

      {/* SECTION 5: PRODUCER TUNING & BATCHING */}
      <div className="border border-[var(--vscode-border)] rounded-md p-3 bg-[var(--vscode-card-bg)] flex flex-col gap-3">
        <div className="flex items-center gap-2 pb-1 border-b border-[var(--vscode-border-light)]">
          <span className="text-xs font-bold uppercase tracking-wide text-[var(--vscode-text-primary)]">Producer Configuration (KPL)</span>
          <InfoTooltip text="Kinesis Producer Library settings for batching, record aggregation, and connection timeouts." />
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Collection Max Count */}
          <PropertyField
            id="collectionMaxCount"
            type="number"
            name="collectionMaxCount"
            label="Max Batch Items"
            tooltip="Maximum number of items collected into a single PutRecords call."
            value={collectionMaxCount}
            onChange={handleChange}
            placeholder="e.g. 500"
            min="1"
          />

          {/* Record Max Buffered Time */}
          <PropertyField
            id="recordMaxBufferedTime"
            type="number"
            name="recordMaxBufferedTime"
            label="Max Buffer Time (ms)"
            tooltip="Maximum duration to hold records before flushing batch to Kinesis."
            value={recordMaxBufferedTime}
            onChange={handleChange}
            placeholder="e.g. 100"
            min="0"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Connect Timeout */}
          <PropertyField
            id="connectTimeout"
            type="number"
            name="connectTimeout"
            label="Connect Timeout (ms)"
            tooltip="TCP connection timeout in milliseconds."
            value={connectTimeout}
            onChange={handleChange}
            placeholder="e.g. 6000"
            min="0"
          />

          {/* Request Timeout */}
          <PropertyField
            id="requestTimeout"
            type="number"
            name="requestTimeout"
            label="Request Timeout (ms)"
            tooltip="HTTP request timeout in milliseconds for Kinesis API calls."
            value={requestTimeout}
            onChange={handleChange}
            placeholder="e.g. 6000"
            min="0"
          />
        </div>

        {/* Custom Producer Properties Key/Value */}
        <PropertyField
          id="producerProperties"
          type="textarea"
          name="producerProperties"
          label="Additional Producer Properties (key=value)"
          tooltip="Optional extra properties for the Kinesis Producer Library in key=value format."
          value={producerProperties}
          onChange={handleChange}
          placeholder="RateLimit=150&#10;AggregationEnabled=true"
          rows={2}
          containerClassName="flex flex-col gap-1 pt-1"
        />
      </div>

      {/* SECTION 6: ADVANCED & LOCAL ENDPOINTS */}
      <div className="border border-[var(--vscode-border)] rounded-md p-3 bg-[var(--vscode-card-bg)] flex flex-col gap-3">
        <div className="flex items-center gap-2 pb-1 border-b border-[var(--vscode-border-light)]">
          <span className="text-xs font-bold uppercase tracking-wide text-[var(--vscode-text-primary)]">Advanced Settings</span>
          <InfoTooltip text="Connection overrides for LocalStack or custom mock environments, certificate verification, and expansion service." />
        </div>

        {/* Service Endpoint */}
        <PropertyField
          id="kinesisSinkServiceEndpoint"
          name="serviceEndpoint"
          label="Custom Service Endpoint"
          tooltip="Custom endpoint URL for LocalStack, moto, or AWS VPC endpoint gateways (e.g. http://localhost:4566)."
          value={serviceEndpoint}
          onChange={handleChange}
          placeholder="http://localhost:4566 (for LocalStack)"
        />

        {/* Expansion Service */}
        <PropertyField
          id="kinesisSinkExpansionService"
          name="expansionService"
          label="Cross-Language Expansion Service (Optional)"
          tooltip="Host and port of the Apache Beam Java expansion service used for cross-language KinesisIO in Python pipelines."
          value={expansionService}
          onChange={handleChange}
          placeholder="e.g. localhost:8097"
        />

        {/* Verify Certificate */}
        <div className="flex items-center gap-2 pt-1">
          <input
            id="kinesisSinkVerifyCert"
            type="checkbox"
            name="verifyCertificate"
            checked={verifyCertificate}
            onChange={handleChange}
            className="rounded border-[var(--vscode-border)] text-rose-500 focus:ring-0 cursor-pointer"
          />
          <label htmlFor="kinesisSinkVerifyCert" className="text-xs text-[var(--vscode-text-primary)] cursor-pointer">
            Verify SSL Certificates
          </label>
          <InfoTooltip text="Enforce SSL verification for AWS endpoints. Keep checked for production environments." />
        </div>
      </div>

      {/* Flexible Spacer adhering to 8pt grid */}
      <div className="flex-1 min-h-4" />

      {/* SECTION 7: CODE GENERATION INSTRUCTIONS */}
      <PropertyField
        id="kinesisSinkSystemInstructions"
        type="textarea"
        name="system_instructions"
        label="Code Generation Instructions"
        value={systemInstructions}
        onChange={handleInstructionsChange}
        placeholder="Enter custom instructions for Kinesis sink code generation (e.g. partition key hashing, retry policies, dead-letter routing)..."
        rows={3}
        mono={false}
        containerClassName="flex flex-col gap-2 pt-2 border-t border-[var(--vscode-border-light)]"
      />
    </div>
  );
};
