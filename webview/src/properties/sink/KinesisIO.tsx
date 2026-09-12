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
import { RefreshCw, Eye, EyeOff, ShieldCheck, KeyRound, Radio, SplitSquareVertical, AlertCircle } from 'lucide-react';
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
      authMode?: 'secretManager' | 'direct' | 'iam';
      awsAccessKey?: string;
      awsSecretKey?: string;
      accessKeySecretName?: string;
      secretKeySecretName?: string;
      roleArn?: string;
      partitionKeyMode?: 'static' | 'recordKey' | 'hash' | 'custom';
      partitionKey?: string;
      dataSerialization?: 'stringUtf8' | 'rawBytes' | 'json' | 'custom';
      customDataSerializer?: string;
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
  const authMode = properties.authMode || 'secretManager';
  const awsAccessKey = properties.awsAccessKey || '';
  const awsSecretKey = properties.awsSecretKey || '';
  const accessKeySecretName = properties.accessKeySecretName || '';
  const secretKeySecretName = properties.secretKeySecretName || '';
  const roleArn = properties.roleArn || '';
  const partitionKeyMode = properties.partitionKeyMode || 'recordKey';
  const partitionKey = properties.partitionKey || '';
  const dataSerialization = properties.dataSerialization || 'stringUtf8';
  const customDataSerializer = properties.customDataSerializer || '';
  const collectionMaxCount = properties.collectionMaxCount ?? '';
  const connectTimeout = properties.connectTimeout ?? '';
  const requestTimeout = properties.requestTimeout ?? '';
  const recordMaxBufferedTime = properties.recordMaxBufferedTime ?? '';
  const producerProperties = properties.producerProperties || '';
  const serviceEndpoint = properties.serviceEndpoint || '';
  const verifyCertificate = properties.verifyCertificate ?? true;
  const expansionService = properties.expansionService || '';

  // Local state for secret fetching and visibility toggling
  const [secrets, setSecrets] = useState<string[]>([]);
  const [isLoadingSecrets, setIsLoadingSecrets] = useState<boolean>(false);
  const [showSecretKey, setShowSecretKey] = useState<boolean>(false);

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
      if (message.command === 'secretsLoaded') {
        setSecrets(message.secrets || []);
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

    onChange(newProperties);
  };

  /**
   * Handles custom system instructions textarea change for LLM prompt overrides.
   * 
   * @param e Form change event from textarea.
   */
  const handleInstructionsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
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
        <div className="flex flex-col gap-1.5">
          <label htmlFor="kinesisSinkStreamName" className="flex items-center text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
            <span>Stream Name</span>
            <span className="text-red-400 ml-1 font-bold" title="Required">*</span>
            <InfoTooltip text="The name of the target Amazon Kinesis stream to publish records to (e.g. processed-events). Required." />
          </label>
          <input
            id="kinesisSinkStreamName"
            type="text"
            name="streamName"
            aria-required="true"
            aria-invalid={isStreamNameInvalid}
            value={streamName}
            onChange={handleChange}
            placeholder="e.g. processed-stream"
            className={`bg-[var(--vscode-input-bg)] text-[var(--vscode-text-primary)] p-2 rounded border text-sm focus:outline-none font-mono ${
              isStreamNameInvalid
                ? 'border-red-500/80 focus:border-red-500'
                : 'border-[var(--vscode-border)] focus:border-rose-500'
            }`}
          />
          {isStreamNameInvalid && (
            <span className="text-xs text-red-400 flex items-center gap-1">
              <AlertCircle size={12} /> Stream Name is required to initialize KinesisIO writer.
            </span>
          )}
        </div>

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
              className="bg-[var(--vscode-input-bg)] text-[var(--vscode-text-primary)] p-2 rounded border border-[var(--vscode-border)] text-sm focus:outline-none focus:border-rose-500 font-mono mt-1"
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
        <div className="grid grid-cols-3 gap-2 p-1 bg-[var(--vscode-subcard-bg)] rounded border border-[var(--vscode-border)]">
          <button
            type="button"
            onClick={() => onChange({ ...properties, authMode: 'secretManager' })}
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
            onClick={() => onChange({ ...properties, authMode: 'direct' })}
            className={`text-xs py-1.5 px-2 rounded font-medium transition-colors ${
              authMode === 'direct'
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/50 shadow-sm'
                : 'bg-[var(--vscode-button-secondary)] text-[var(--vscode-text-secondary)] border border-[var(--vscode-border)] hover:bg-[var(--vscode-hover)]'
            }`}
          >
            Direct Keys
          </button>
          <button
            type="button"
            onClick={() => onChange({ ...properties, authMode: 'iam' })}
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
            <div className="flex flex-col gap-1">
              <label htmlFor="kinesisSinkAccessKeySecret" className="flex items-center text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
                <span>AWS Access Key Secret Name</span>
                <InfoTooltip text="GCP Secret Manager secret resource name containing the AWS Access Key ID." />
              </label>
              <input
                id="kinesisSinkAccessKeySecret"
                type="text"
                name="accessKeySecretName"
                value={accessKeySecretName}
                onChange={handleChange}
                placeholder="e.g. aws-access-key-id"
                list="kinesis-sink-secrets-list"
                className="bg-[var(--vscode-input-bg)] text-[var(--vscode-text-primary)] p-2 rounded border border-[var(--vscode-border)] text-sm focus:outline-none focus:border-rose-500 font-mono"
              />
            </div>

            {/* Secret Key Secret */}
            <div className="flex flex-col gap-1">
              <label htmlFor="kinesisSinkSecretKeySecret" className="flex items-center text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
                <span>AWS Secret Key Secret Name</span>
                <InfoTooltip text="GCP Secret Manager secret resource name containing the AWS Secret Access Key." />
              </label>
              <input
                id="kinesisSinkSecretKeySecret"
                type="text"
                name="secretKeySecretName"
                value={secretKeySecretName}
                onChange={handleChange}
                placeholder="e.g. aws-secret-access-key"
                list="kinesis-sink-secrets-list"
                className="bg-[var(--vscode-input-bg)] text-[var(--vscode-text-primary)] p-2 rounded border border-[var(--vscode-border)] text-sm focus:outline-none focus:border-rose-500 font-mono"
              />
            </div>

            {/* Datalist of Secrets fetched via gcloud */}
            <datalist id="kinesis-sink-secrets-list">
              {secrets.map((sec) => (
                <option key={sec} value={sec} />
              ))}
            </datalist>
          </div>
        )}

        {/* Auth Mode: Direct Keys */}
        {authMode === 'direct' && (
          <div className="flex flex-col gap-2.5 pt-1">
            <div className="flex flex-col gap-1">
              <label htmlFor="kinesisSinkAwsAccessKey" className="flex items-center text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
                <span>AWS Access Key ID</span>
                <InfoTooltip text="20-character key identifier (e.g. AKIA...) used to authenticate pipeline requests with AWS." />
              </label>
              <input
                id="kinesisSinkAwsAccessKey"
                type="text"
                name="awsAccessKey"
                value={awsAccessKey}
                onChange={handleChange}
                placeholder="AKIAIOSFODNN7EXAMPLE"
                className="bg-[var(--vscode-input-bg)] text-[var(--vscode-text-primary)] p-2 rounded border border-[var(--vscode-border)] text-sm focus:outline-none focus:border-rose-500 font-mono"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="kinesisSinkAwsSecretKey" className="flex items-center text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
                <span>AWS Secret Access Key</span>
                <InfoTooltip text="Private token used alongside the key ID to sign and authenticate AWS requests. Masked by default." />
              </label>
              <div className="relative">
                <input
                  id="kinesisSinkAwsSecretKey"
                  type={showSecretKey ? 'text' : 'password'}
                  name="awsSecretKey"
                  value={awsSecretKey}
                  onChange={handleChange}
                  placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
                  className="w-full bg-[var(--vscode-input-bg)] text-[var(--vscode-text-primary)] p-2 pr-8 rounded border border-[var(--vscode-border)] text-sm focus:outline-none focus:border-rose-500 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowSecretKey(!showSecretKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--vscode-text-muted)] hover:text-[var(--vscode-text-primary)]"
                  title={showSecretKey ? 'Hide key' : 'Show key'}
                >
                  {showSecretKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Auth Mode: IAM / Default */}
        {authMode === 'iam' && (
          <div className="flex flex-col gap-2 pt-1 text-xs text-[var(--vscode-text-secondary)]">
            <p>
              Uses AWS Default Credential Provider Chain (environment variables, EC2 instance profile, or EKS/GKE IRSA / Web Identity token).
            </p>
            <div className="flex flex-col gap-1 mt-1">
              <label htmlFor="kinesisSinkRoleArn" className="flex items-center text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
                <span>Assume Role ARN (Optional)</span>
                <InfoTooltip text="AWS IAM Role ARN to assume via STS for cross-account or fine-grained pipeline access." />
              </label>
              <input
                id="kinesisSinkRoleArn"
                type="text"
                name="roleArn"
                value={roleArn}
                onChange={handleChange}
                placeholder="arn:aws:iam::123456789012:role/BeamKinesisRole"
                className="bg-[var(--vscode-input-bg)] text-[var(--vscode-text-primary)] p-2 rounded border border-[var(--vscode-border)] text-sm focus:outline-none focus:border-rose-500 font-mono"
              />
            </div>
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
          <div className="flex flex-col gap-1">
            <label htmlFor="partitionKeyStatic" className="flex items-center text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
              <span>Static Partition Key Value</span>
              <InfoTooltip text="Constant string used as the partition key for all emitted records." />
            </label>
            <input
              id="partitionKeyStatic"
              type="text"
              name="partitionKey"
              value={partitionKey}
              onChange={handleChange}
              placeholder="e.g. default-partition"
              className="bg-[var(--vscode-input-bg)] text-[var(--vscode-text-primary)] p-2 rounded border border-[var(--vscode-border)] text-sm focus:outline-none focus:border-rose-500 font-mono"
            />
          </div>
        )}

        {partitionKeyMode === 'custom' && (
          <div className="flex flex-col gap-1">
            <label htmlFor="partitionKeyCustom" className="flex items-center text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
              <span>Partition Key Expression / Extractor</span>
              <InfoTooltip text="Code snippet or function reference to extract partition key from element." />
            </label>
            <input
              id="partitionKeyCustom"
              type="text"
              name="partitionKey"
              value={partitionKey}
              onChange={handleChange}
              placeholder="e.g. record.getDeviceId() or lambda x: x['user_id']"
              className="bg-[var(--vscode-input-bg)] text-[var(--vscode-text-primary)] p-2 rounded border border-[var(--vscode-border)] text-sm focus:outline-none focus:border-rose-500 font-mono"
            />
          </div>
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
            <option value="custom">Custom Serializer Function</option>
          </select>
        </div>

        {dataSerialization === 'custom' && (
          <div className="flex flex-col gap-1">
            <label htmlFor="customDataSerializer" className="flex items-center text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
              <span>Custom Serializer Function / Class</span>
              <InfoTooltip text="Fully-qualified class name or lambda for custom serialization." />
            </label>
            <input
              id="customDataSerializer"
              type="text"
              name="customDataSerializer"
              value={customDataSerializer}
              onChange={handleChange}
              placeholder="e.g. com.example.AvroToBytesFunction"
              className="bg-[var(--vscode-input-bg)] text-[var(--vscode-text-primary)] p-2 rounded border border-[var(--vscode-border)] text-sm focus:outline-none focus:border-rose-500 font-mono"
            />
          </div>
        )}
      </div>

      {/* SECTION 5: PRODUCER TUNING & BATCHING */}
      <div className="border border-[var(--vscode-border)] rounded-md p-3 bg-[var(--vscode-card-bg)] flex flex-col gap-3">
        <div className="flex items-center gap-2 pb-1 border-b border-[var(--vscode-border-light)]">
          <span className="text-xs font-bold uppercase tracking-wide text-[var(--vscode-text-primary)]">Producer Configuration (KPL)</span>
          <InfoTooltip text="Kinesis Producer Library settings for batching, record aggregation, and connection timeouts." />
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Collection Max Count */}
          <div className="flex flex-col gap-1">
            <label htmlFor="collectionMaxCount" className="flex items-center text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
              <span>Max Batch Items</span>
              <InfoTooltip text="Maximum number of items collected into a single PutRecords call." />
            </label>
            <input
              id="collectionMaxCount"
              type="number"
              name="collectionMaxCount"
              value={collectionMaxCount}
              onChange={handleChange}
              placeholder="e.g. 500"
              min="1"
              className="bg-[var(--vscode-input-bg)] text-[var(--vscode-text-primary)] p-2 rounded border border-[var(--vscode-border)] text-sm focus:outline-none focus:border-rose-500 font-mono"
            />
          </div>

          {/* Record Max Buffered Time */}
          <div className="flex flex-col gap-1">
            <label htmlFor="recordMaxBufferedTime" className="flex items-center text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
              <span>Max Buffer Time (ms)</span>
              <InfoTooltip text="Maximum duration to hold records before flushing batch to Kinesis." />
            </label>
            <input
              id="recordMaxBufferedTime"
              type="number"
              name="recordMaxBufferedTime"
              value={recordMaxBufferedTime}
              onChange={handleChange}
              placeholder="e.g. 100"
              min="0"
              className="bg-[var(--vscode-input-bg)] text-[var(--vscode-text-primary)] p-2 rounded border border-[var(--vscode-border)] text-sm focus:outline-none focus:border-rose-500 font-mono"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Connect Timeout */}
          <div className="flex flex-col gap-1">
            <label htmlFor="connectTimeout" className="flex items-center text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
              <span>Connect Timeout (ms)</span>
              <InfoTooltip text="TCP connection timeout in milliseconds." />
            </label>
            <input
              id="connectTimeout"
              type="number"
              name="connectTimeout"
              value={connectTimeout}
              onChange={handleChange}
              placeholder="e.g. 6000"
              min="0"
              className="bg-[var(--vscode-input-bg)] text-[var(--vscode-text-primary)] p-2 rounded border border-[var(--vscode-border)] text-sm focus:outline-none focus:border-rose-500 font-mono"
            />
          </div>

          {/* Request Timeout */}
          <div className="flex flex-col gap-1">
            <label htmlFor="requestTimeout" className="flex items-center text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
              <span>Request Timeout (ms)</span>
              <InfoTooltip text="HTTP request timeout in milliseconds for Kinesis API calls." />
            </label>
            <input
              id="requestTimeout"
              type="number"
              name="requestTimeout"
              value={requestTimeout}
              onChange={handleChange}
              placeholder="e.g. 6000"
              min="0"
              className="bg-[var(--vscode-input-bg)] text-[var(--vscode-text-primary)] p-2 rounded border border-[var(--vscode-border)] text-sm focus:outline-none focus:border-rose-500 font-mono"
            />
          </div>
        </div>

        {/* Custom Producer Properties Key/Value */}
        <div className="flex flex-col gap-1 pt-1">
          <label htmlFor="producerProperties" className="flex items-center text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
            <span>Additional Producer Properties (key=value)</span>
            <InfoTooltip text="Optional extra properties for the Kinesis Producer Library in key=value format." />
          </label>
          <textarea
            id="producerProperties"
            name="producerProperties"
            value={producerProperties}
            onChange={handleChange}
            placeholder="RateLimit=150&#10;AggregationEnabled=true"
            rows={2}
            className="bg-[var(--vscode-input-bg)] text-[var(--vscode-text-primary)] p-2 rounded border border-[var(--vscode-border)] text-sm focus:outline-none focus:border-rose-500 font-mono resize-y placeholder-[var(--vscode-text-muted)]"
          />
        </div>
      </div>

      {/* SECTION 6: ADVANCED & LOCAL ENDPOINTS */}
      <div className="border border-[var(--vscode-border)] rounded-md p-3 bg-[var(--vscode-card-bg)] flex flex-col gap-3">
        <div className="flex items-center gap-2 pb-1 border-b border-[var(--vscode-border-light)]">
          <span className="text-xs font-bold uppercase tracking-wide text-[var(--vscode-text-primary)]">Advanced Settings</span>
          <InfoTooltip text="Connection overrides for LocalStack or custom mock environments, certificate verification, and expansion service." />
        </div>

        {/* Service Endpoint */}
        <div className="flex flex-col gap-1">
          <label htmlFor="kinesisSinkServiceEndpoint" className="flex items-center text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
            <span>Custom Service Endpoint</span>
            <InfoTooltip text="Custom endpoint URL for LocalStack, moto, or AWS VPC endpoint gateways (e.g. http://localhost:4566)." />
          </label>
          <input
            id="kinesisSinkServiceEndpoint"
            type="text"
            name="serviceEndpoint"
            value={serviceEndpoint}
            onChange={handleChange}
            placeholder="http://localhost:4566 (for LocalStack)"
            className="bg-[var(--vscode-input-bg)] text-[var(--vscode-text-primary)] p-2 rounded border border-[var(--vscode-border)] text-sm focus:outline-none focus:border-rose-500 font-mono"
          />
        </div>

        {/* Expansion Service */}
        <div className="flex flex-col gap-1">
          <label htmlFor="kinesisSinkExpansionService" className="flex items-center text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
            <span>Cross-Language Expansion Service (Optional)</span>
            <InfoTooltip text="Host and port of the Apache Beam Java expansion service used for cross-language KinesisIO in Python pipelines." />
          </label>
          <input
            id="kinesisSinkExpansionService"
            type="text"
            name="expansionService"
            value={expansionService}
            onChange={handleChange}
            placeholder="e.g. localhost:8097"
            className="bg-[var(--vscode-input-bg)] text-[var(--vscode-text-primary)] p-2 rounded border border-[var(--vscode-border)] text-sm focus:outline-none focus:border-rose-500 font-mono"
          />
        </div>

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
      <div className="flex flex-col gap-2 pt-2 border-t border-[var(--vscode-border-light)]">
        <label htmlFor="kinesisSinkSystemInstructions" className="text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          Code Generation Instructions
        </label>
        <textarea
          id="kinesisSinkSystemInstructions"
          name="system_instructions"
          value={systemInstructions}
          onChange={handleInstructionsChange}
          placeholder="Enter custom instructions for Kinesis sink code generation (e.g. partition key hashing, retry policies, dead-letter routing)..."
          rows={3}
          className="bg-[var(--vscode-input-bg)] text-[var(--vscode-text-primary)] p-2 rounded border border-[var(--vscode-border)] text-sm focus:outline-none focus:border-rose-500 resize-y placeholder-[var(--vscode-text-muted)]"
        />
      </div>
    </div>
  );
};
