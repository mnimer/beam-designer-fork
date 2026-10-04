/**
 * S3FileSystem Sink Properties Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Renders the property configuration panel for Apache Beam S3FileSystem Sink nodes.
 * Configures writing output files to Amazon S3 destination prefixes (s3://) via
 * org.apache.beam.sdk.io.aws2.s3.S3FileSystemRegistrar in Java and apache_beam.io.aws.s3filesystem.S3FileSystem
 * in Python. Provides settings for AWS region, credentials providers, custom S3 endpoints, S3 storage class,
 * server-side encryption (SSE-S3 / SSE-KMS), upload buffer sizing, file formats, compression, sharding,
 * and AI code generation instructions.
 * 
 * Architectural Decisions:
 * - Framing: S3 is registered as a FileSystem scheme (s3://) via S3FileSystemRegistrar in Java and
 *   apache_beam.io.aws.s3filesystem.S3FileSystem in Python. File writing is wrapped by formats like TextIO,
 *   AvroIO, ParquetIO, or FileIO with target path prefix (.to(...)). Configuration flows through AwsOptions
 *   (--awsRegion, --endpoint, --awsCredentialsProvider) and S3Options (--s3StorageClass,
 *   --s3UploadBufferSizeBytes, --SSEAlgorithm, --SSEKMSKeyId) in Java, or CLI flags
 *   (--s3_region_name, --s3_access_key_id, --s3_secret_access_key, --s3_endpoint_url) in Python. The panel
 *   frames this as writing to an S3 path prefix plus region, credentials, SSE encryption, and sharding configuration.
 * - Deliberate deviation: StoragePathField and useAssetLoader('storageBuckets') are deliberately NOT used.
 *   StoragePathField performs Google Cloud Storage bucket discovery (gs://). Offering gs:// bucket
 *   autocompletions for Amazon S3 (s3://) would be actively misleading and result in broken pipelines.
 *   Instead, PropertyField is used directly with static datalist suggestions of canonical S3 URI formats
 *   (s3://my-bucket/output/, s3://my-bucket/data/processed/, etc.). Future maintainers MUST NOT replace
 *   this with StoragePathField or dispatch getStorageBuckets IPC messages.
 * - Security & Credentials: AWS credential secrets (accessKeyId and secretAccessKey) are configured as
 *   Google Cloud Secret Manager secret pickers (using useAssetLoader('secrets') and normalizeSecretItem)
 *   so raw credentials are never stored in the pipeline definition. Conditional rendering displays
 *   accessKeyId and secretAccessKey secret pickers only when StaticCredentialsProvider is selected, and
 *   profileName only when ProfileCredentialsProvider is selected. DefaultCredentialsProvider renders no
 *   secret input fields.
 *   (WebIdentityTokenCredentialsProvider was removed as it is not a supported @type in Beam's AwsOptions.)
 * - Server-Side Encryption (SSE): Exposes sseAlgorithm ('', AES256, aws:kms) mapping to S3Options --SSEAlgorithm.
 *   Because SSEAlgorithm on S3Options is @Nullable, the default is '' (omitting --SSEAlgorithm rather than sending
 *   an invalid 'NONE' sentinel). When aws:kms is selected, ssekmsKeyId (--SSEKMSKeyId) is conditionally exposed
 *   for specifying the customer-managed AWS KMS key ARN or ID.
 * - Reusable UI Primitives: Uses common primitives CollapsibleSection, SelectField, and PropertyField
 *   rather than local reimplementations, adhering strictly to the 8pt grid, VS Code theme variables,
 *   and zero inline styles or raw slate-* classes.
 * - Props in, events up: Fully controlled component taking only node and onChange.
 */

import React, { useState } from 'react';
import { Sliders } from 'lucide-react';
import { PropertyField } from '../../components/common/PropertyField';
import { SystemInstructionsField } from '../../components/common/SystemInstructionsField';
import { resolveSystemInstructions } from '../../utils/systemInstructions';
import { CollapsibleSection } from '../../components/common/CollapsibleSection';
import { SelectField } from '../../components/common/SelectField';
import { type SecretItem, normalizeSecretItem } from '../../components/common/SecretManagerAuthFields';
import { useAssetLoader } from '../../hooks/useAssetLoader';

/**
 * React Flow node shape for the Amazon S3 sink panel, including its persisted configuration data.
 */
export interface S3FileSystemSinkNode {
  data: {
    label: string;
    beam_transform?: string;
    system_instructions?: string;
    special_instructions?: string;
    properties?: {
      to?: string;
      suffix?: string;
      awsRegion?: string;
      credentialsProvider?: string;
      accessKeyId?: string;
      secretAccessKey?: string;
      profileName?: string;
      endpointUrl?: string;
      s3StorageClass?: string;
      sseAlgorithm?: string;
      ssekmsKeyId?: string;
      uploadBufferSizeBytes?: string | number;
      format?: string;
      compression?: string;
      numShards?: string | number;
      shardTemplate?: string;
      system_instructions?: string;
      special_instructions?: string;
      [key: string]: any;
    };
  };
}

/**
 * Props for the S3FileSystemSinkProperties component.
 */
export interface S3FileSystemSinkPropertiesProps {
  node: S3FileSystemSinkNode;
  onChange: (properties: any) => void;
}

/** Static datalist suggestions for canonical S3 sink output paths */
export const S3_SINK_PATH_SUGGESTIONS = [
  's3://my-bucket/output/',
  's3://my-bucket/data/processed/',
  's3://my-bucket/results/output',
  's3://my-bucket/events/partitioned/'
];

/** Standard AWS regions */
export const AWS_REGIONS = [
  { value: 'us-east-1', label: 'us-east-1 (US East, N. Virginia)' },
  { value: 'us-east-2', label: 'us-east-2 (US East, Ohio)' },
  { value: 'us-west-1', label: 'us-west-1 (US West, N. California)' },
  { value: 'us-west-2', label: 'us-west-2 (US West, Oregon)' },
  { value: 'eu-west-1', label: 'eu-west-1 (Europe, Ireland)' },
  { value: 'eu-central-1', label: 'eu-central-1 (Europe, Frankfurt)' },
  { value: 'ap-southeast-1', label: 'ap-southeast-1 (Asia Pacific, Singapore)' },
  { value: 'ap-northeast-1', label: 'ap-northeast-1 (Asia Pacific, Tokyo)' }
];

/** Supported AWS credentials providers in Beam AwsOptions */
export const S3_CREDENTIALS_PROVIDERS = [
  { value: 'DefaultCredentialsProvider', label: 'DefaultCredentialsProvider (Environment / IAM role / Instance metadata)' },
  { value: 'StaticCredentialsProvider', label: 'Google Cloud Secret Manager (StaticCredentialsProvider)' },
  { value: 'ProfileCredentialsProvider', label: 'ProfileCredentialsProvider (Named AWS profile from ~/.aws/credentials)' }
];

export const AWS_CREDENTIALS_PROVIDERS = S3_CREDENTIALS_PROVIDERS;

/** S3 storage class options */
export const S3_STORAGE_CLASSES = [
  { value: 'STANDARD', label: 'STANDARD (Frequently accessed data)' },
  { value: 'STANDARD_IA', label: 'STANDARD_IA (Infrequent Access, millisecond access)' },
  { value: 'INTELLIGENT_TIERING', label: 'INTELLIGENT_TIERING (Automatic cost optimization)' },
  { value: 'GLACIER', label: 'GLACIER (Low-cost archival data)' },
  { value: 'DEEP_ARCHIVE', label: 'DEEP_ARCHIVE (Lowest cost long-term archival)' }
];

/** Server-side encryption algorithms (S3Options --SSEAlgorithm is @Nullable; '' omits the flag) */
export const S3_SSE_ALGORITHMS = [
  { value: '', label: 'None (Default — Omit --SSEAlgorithm)' },
  { value: 'AES256', label: 'AES256 (SSE-S3 Amazon managed keys)' },
  { value: 'aws:kms', label: 'aws:kms (SSE-KMS AWS Key Management Service)' }
];

export const SSE_ALGORITHMS = S3_SSE_ALGORITHMS;

/** Underlying Beam I/O formats wrapping S3 write */
export const S3_SINK_FORMATS = [
  { value: 'TextIO', label: 'TextIO (Plain text / lines / JSON)' },
  { value: 'AvroIO', label: 'AvroIO (Apache Avro records)' },
  { value: 'ParquetIO', label: 'ParquetIO (Apache Parquet columnar)' },
  { value: 'FileIO', label: 'FileIO (Generic file streams / dynamic)' }
];

/** Output file compression codecs (matches Beam Compression / CompressionTypes; XZ is not supported) */
export const S3_SINK_COMPRESSION_TYPES = [
  { value: 'UNCOMPRESSED', label: 'UNCOMPRESSED (Default)' },
  { value: 'GZIP', label: 'GZIP (.gz)' },
  { value: 'BZIP2', label: 'BZIP2 (.bz2)' },
  { value: 'DEFLATE', label: 'DEFLATE / ZLIB' },
  { value: 'ZSTD', label: 'ZSTD (.zst)' }
];

/**
 * S3FileSystemSinkProperties renders the property configuration form for S3 file writes.
 */
export const S3FileSystemSinkProperties: React.FC<S3FileSystemSinkPropertiesProps> = ({ node, onChange }) => {
  const properties = node.data.properties || {};
  const to = properties.to || '';
  const suffix = properties.suffix || '';
  const awsRegion = properties.awsRegion || 'us-east-1';
  const credentialsProvider = properties.credentialsProvider || 'DefaultCredentialsProvider';
  const accessKeyId = properties.accessKeyId || '';
  const secretAccessKey = properties.secretAccessKey || '';
  const profileName = properties.profileName || '';
  const endpointUrl = properties.endpointUrl || '';
  const s3StorageClass = properties.s3StorageClass || 'STANDARD';
  const sseAlgorithm = properties.sseAlgorithm ?? '';
  const ssekmsKeyId = properties.ssekmsKeyId || '';
  const uploadBufferSizeBytes = properties.uploadBufferSizeBytes ?? '';
  const format = properties.format || 'TextIO';
  const compression = properties.compression || 'UNCOMPRESSED';
  const numShards = properties.numShards ?? '';
  const shardTemplate = properties.shardTemplate || '';

  const [isShardingOpen, setIsShardingOpen] = useState<boolean>(false);

  // Load secrets from Google Cloud Secret Manager via extension host IPC
  // NOTE: Deliberately no useAssetLoader('storageBuckets') call here, as S3 paths
  // resolve against Amazon S3 rather than Google Cloud Storage buckets.
  const { items: loadedSecrets, loading: secretsLoading } = useAssetLoader<SecretItem | string>('secrets');
  const secretOptions = (loadedSecrets || []).map((s) => {
    const normalized = normalizeSecretItem(s);
    return { value: normalized.id, label: normalized.name };
  });

  // Validation: to path prefix is required for writing S3 files
  const isToInvalid = !to.trim();

  // System instructions text with fallback
  const systemInstructions = resolveSystemInstructions(node);

  /**
   * Handles generic input changes for form fields
   * @param e Native change event from input, select, or textarea
   */
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const isCheckbox = type === 'checkbox';
    const checked = isCheckbox ? (e.target as HTMLInputElement).checked : undefined;

    onChange({
      ...properties,
      [name]: isCheckbox ? checked : value
    });
  };

  /**
   * Toggles the sharding options accordion state
   */
  const handleToggleSharding = () => {
    setIsShardingOpen((prev) => !prev);
  };

  return (
    <div className="flex-1 flex flex-col gap-4">
      {/* Target Path Prefix Input */}
      <PropertyField
        id="s3SinkTo"
        name="to"
        label="Output Path Prefix (.to)"
        required="Output Path Prefix is required."
        tooltip="Target S3 path prefix for output files (e.g. s3://my-bucket/output/ or s3://my-bucket/results/out). File naming is completed with shard patterns and suffix. Note: Beam S3 filesystem registers the s3:// scheme via S3FileSystemRegistrar in Java and S3FileSystem in Python. S3 bucket discovery is not performed via Cloud Storage."
        aria-required="true"
        aria-invalid={isToInvalid}
        value={to}
        onChange={handleChange}
        placeholder="s3://my-bucket/output/"
        invalid={isToInvalid}
        error={isToInvalid ? 'Output Path Prefix is required.' : null}
        mono={true}
        list="s3-sink-path-options"
        datalist={S3_SINK_PATH_SUGGESTIONS}
        helperText={
          !isToInvalid ? (
            <span className="text-xs text-[var(--vscode-text-muted)]">
              Output S3 destination prefix. Appended with shard template and file suffix.
            </span>
          ) : null
        }
      />

      {/* Output Suffix */}
      <PropertyField
        id="s3SinkSuffix"
        name="suffix"
        label="Output File Suffix (.withSuffix)"
        tooltip="File extension or suffix appended to each output shard (e.g. .parquet, .csv, .json, .txt)."
        value={suffix}
        onChange={handleChange}
        placeholder=".parquet, .csv, or .txt"
        mono={true}
      />

      {/* Wrapping Writer Format Select */}
      <SelectField
        id="s3SinkFormat"
        name="format"
        label="File Format / Writer"
        tooltip="Underlying Beam I/O writer transform wrapping the S3 filesystem access (TextIO for lines/CSV/JSON, AvroIO for Avro records, ParquetIO for columnar data, or FileIO for raw file streams)."
        value={format}
        options={S3_SINK_FORMATS}
        onChange={handleChange}
        helperText={
          <span>
            Beam writer transform used to serialize and write S3 files. Defaults to <code>TextIO</code>.
          </span>
        }
      />

      {/* Compression Select */}
      <SelectField
        id="s3SinkCompression"
        name="compression"
        label="Compression"
        tooltip="Compression algorithm applied to output files written to S3."
        value={compression}
        options={S3_SINK_COMPRESSION_TYPES}
        onChange={handleChange}
      />

      {/* AWS Region Select */}
      <SelectField
        id="s3SinkAwsRegion"
        name="awsRegion"
        label="AWS Region"
        tooltip="AWS region for Amazon S3 bucket access (e.g. us-east-1, us-west-2, eu-west-1). Configured on AwsOptions: --awsRegion in Java; --s3_region_name in Python."
        value={awsRegion}
        options={AWS_REGIONS}
        onChange={handleChange}
        helperText="AWS region hosting the destination S3 bucket (AwsOptions --awsRegion in Java; --s3_region_name in Python)."
      />

      {/* AWS Credentials Provider Select */}
      <SelectField
        id="s3SinkCredentialsProvider"
        name="credentialsProvider"
        label="AWS Credentials Provider"
        tooltip="AWS credentials provider used to authenticate requests (configured on AwsOptions via --awsCredentialsProvider in Java). StaticCredentialsProvider resolves key pairs from GCP Secret Manager, ProfileCredentialsProvider reads ~/.aws/credentials, and DefaultCredentialsProvider uses the standard AWS credential chain."
        value={credentialsProvider}
        options={S3_CREDENTIALS_PROVIDERS}
        onChange={handleChange}
        helperText="Authentication strategy for S3 access (AwsOptions in Java)."
      />

      {/* Conditional: StaticCredentialsProvider (accessKeyId + secretAccessKey via GCP Secret Manager) */}
      {credentialsProvider === 'StaticCredentialsProvider' && (
        <div className="flex flex-col gap-3 p-3 rounded-md border border-[var(--vscode-border)] bg-[var(--vscode-subcard-bg)]">
          <PropertyField
            id="s3SinkAccessKeyId"
            name="accessKeyId"
            label="AWS Access Key Secret (Secret Manager)"
            tooltip="GCP Secret Manager secret name containing the AWS Access Key ID for static credential authentication."
            value={accessKeyId}
            onChange={handleChange}
            placeholder="e.g. aws-s3-access-key-id"
            datalist={secretOptions}
            loading={secretsLoading}
            mono={true}
            helperText={
              <span className="text-xs text-[var(--vscode-text-muted)]">
                GCP Secret Manager secret containing the AWS Access Key ID resolved at runtime.
              </span>
            }
          />
          <PropertyField
            id="s3SinkSecretAccessKey"
            name="secretAccessKey"
            label="AWS Secret Access Key (Secret Manager)"
            tooltip="GCP Secret Manager secret name containing the AWS Secret Access Key paired with the Access Key ID."
            value={secretAccessKey}
            onChange={handleChange}
            placeholder="e.g. aws-s3-secret-access-key"
            datalist={secretOptions}
            loading={secretsLoading}
            mono={true}
            helperText={
              <span className="text-xs text-[var(--vscode-text-muted)]">
                GCP Secret Manager secret containing the AWS Secret Access Key resolved to worker AwsOptions (Java) / S3Options (Python) at runtime.
              </span>
            }
          />
        </div>
      )}

      {/* Conditional: ProfileCredentialsProvider (profileName) */}
      {credentialsProvider === 'ProfileCredentialsProvider' && (
        <PropertyField
          id="s3SinkProfileName"
          name="profileName"
          label="AWS Profile Name"
          tooltip="Named profile defined in ~/.aws/credentials or ~/.aws/config on worker machines."
          value={profileName}
          onChange={handleChange}
          placeholder="default"
          mono={true}
          helperText={
            <span className="text-xs text-[var(--vscode-text-muted)]">
              Named credentials profile to load from local AWS configuration.
            </span>
          }
        />
      )}

      {/* Custom S3 Endpoint URL (e.g. MinIO / LocalStack) */}
      <PropertyField
        id="s3SinkEndpointUrl"
        name="endpointUrl"
        label="Endpoint URL (Optional)"
        tooltip="Custom endpoint URL for S3-compatible object stores (e.g. MinIO, LocalStack, Ceph). Configured on AwsOptions (--endpoint in Java; --s3_endpoint_url in Python)."
        value={endpointUrl}
        onChange={handleChange}
        placeholder="http://localhost:9000 (MinIO/LocalStack)"
        mono={true}
        helperText={
          <span className="text-xs text-[var(--vscode-text-muted)]">
            Leave empty for standard AWS S3 endpoints. Maps to <code>AwsOptions</code> <code>--endpoint</code> (Java) / <code>--s3_endpoint_url</code> (Python).
          </span>
        }
      />

      {/* S3 Storage Class Select */}
      <SelectField
        id="s3SinkStorageClass"
        name="s3StorageClass"
        label="S3 Storage Class"
        tooltip="Amazon S3 storage class for created objects (STANDARD, STANDARD_IA, INTELLIGENT_TIERING, GLACIER, DEEP_ARCHIVE). In Java: --s3StorageClass=... via S3Options."
        value={s3StorageClass}
        options={S3_STORAGE_CLASSES}
        onChange={handleChange}
        helperText="Target Amazon S3 storage tier for lifecycle cost management (--s3StorageClass on S3Options)."
      />

      {/* Server-Side Encryption Algorithm Select */}
      <SelectField
        id="s3SinkSseAlgorithm"
        name="sseAlgorithm"
        label="Server-Side Encryption Algorithm"
        tooltip="Server-side encryption algorithm for S3 objects. Omit --SSEAlgorithm by default (empty), AES256 for Amazon S3 managed keys (SSE-S3), or aws:kms for AWS KMS customer-managed keys (SSE-KMS). In Java: --SSEAlgorithm=... via S3Options."
        value={sseAlgorithm}
        options={S3_SSE_ALGORITHMS}
        onChange={handleChange}
        helperText="S3 server-side encryption algorithm (--SSEAlgorithm on S3Options)."
      />

      {/* Conditional: SSE-KMS Key ID (shown only for aws:kms) */}
      {sseAlgorithm === 'aws:kms' && (
        <PropertyField
          id="s3SinkSseKmsKeyId"
          name="ssekmsKeyId"
          label="AWS KMS Key ID (SSEKMSKeyId)"
          tooltip="ARN or Key ID of the AWS KMS key used to encrypt S3 objects. In Java: --SSEKMSKeyId=... via S3Options."
          value={ssekmsKeyId}
          onChange={handleChange}
          placeholder="arn:aws:kms:us-east-1:123456789012:key/..."
          mono={true}
          helperText={
            <span className="text-xs text-[var(--vscode-text-muted)]">
              KMS Key ARN or Key ID for SSE-KMS encryption (<code>--SSEKMSKeyId</code> via <code>S3Options</code>).
            </span>
          }
        />
      )}

      {/* Upload Buffer Size in Bytes */}
      <PropertyField
        id="s3SinkUploadBufferSize"
        type="number"
        name="uploadBufferSizeBytes"
        label="Upload Buffer Size (bytes)"
        tooltip="Size of buffer used when uploading files to S3 in bytes. Defaults to 64 MB (67108864 bytes, or 5 MB under 512 MB heap); hard minimum is 5 MB (5242880 bytes). In Java: --s3UploadBufferSizeBytes=... via S3Options."
        value={uploadBufferSizeBytes}
        onChange={handleChange}
        placeholder="67108864"
        min="5242880"
        mono={true}
        helperText={
          <span className="text-xs text-[var(--vscode-text-muted)]">
            Worker in-memory chunk buffer before multipart streaming to S3. Default: 67108864 (64 MB, or 5 MB under 512 MB heap); minimum: 5242880 (5 MB) via <code>--s3UploadBufferSizeBytes</code>.
          </span>
        }
      />

      {/* Sharding Accordion */}
      <CollapsibleSection
        title="Sharding & Output Partitioning Options"
        icon={<Sliders className="w-4 h-4 text-emerald-400" />}
        isOpen={isShardingOpen}
        onToggle={handleToggleSharding}
      >
        {/* Number of Shards */}
        <PropertyField
          id="s3SinkNumShards"
          type="number"
          name="numShards"
          label="Number of Shards"
          tooltip="Fixed number of output shards. Set to 0 or leave empty to let the Beam runner determine sharding dynamically."
          value={numShards}
          onChange={handleChange}
          placeholder="0 (Automatic)"
          min="0"
          mono={true}
          helperText={
            <span className="text-xs text-[var(--vscode-text-muted)]">
              0 or empty lets the runner automatically size output shards.
            </span>
          }
        />

        {/* Shard Template */}
        <PropertyField
          id="s3SinkShardTemplate"
          name="shardTemplate"
          label="Shard Name Template (Optional)"
          tooltip="Custom template for shard naming (e.g. -SSSSS-of-NNNNN). Leave blank for Beam standard default."
          value={shardTemplate}
          onChange={handleChange}
          placeholder="-SSSSS-of-NNNNN"
          mono={true}
          helperText={
            <span className="text-xs text-[var(--vscode-text-muted)]">
              Default template is -SSSSS-of-NNNNN.
            </span>
          }
        />
      </CollapsibleSection>

      {/* Code Generation Instructions */}
      <SystemInstructionsField
        id="s3SinkInstructions"
        value={systemInstructions}
        tooltip="Custom instructions provided directly to Gemini when generating pipeline source code for this S3FileSystem writer step."
        placeholder="e.g. Write Parquet files to S3 destination with AES256 encryption and 10 shards."
        wrapperClassName="pt-2 border-t border-[var(--vscode-border-light)]"
        textareaClassName="resize-y h-24"
        helperText="Additional guidance appended to prompt when synthesizing Java/Python code."
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
