/**
 * S3FileSystem Source Properties Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Renders the property configuration panel for Apache Beam S3FileSystem Source nodes.
 * Configures reading from Amazon S3 object paths (s3://) via org.apache.beam.sdk.io.aws2.s3.S3FileSystemRegistrar
 * in Java and apache_beam.io.aws.s3filesystem.S3FileSystem in Python, providing settings for AWS region,
 * credentials providers, custom S3 endpoints (MinIO/LocalStack), underlying file formats, and read tuning.
 * 
 * Architectural Decisions:
 * - Framing: S3 is registered as a FileSystem scheme (s3://) via S3FileSystemRegistrar in Java and
 *   apache_beam.io.aws.s3filesystem.S3FileSystem in Python. File reading is wrapped by format transforms
 *   (TextIO, AvroIO, ParquetIO, FileIO) configured through AwsOptions (--awsRegion, --endpoint,
 *   --awsCredentialsProvider) and S3Options (--s3UploadBufferSizeBytes, --s3ClientFactoryClass) in Java,
 *   or CLI flags (--s3_region_name, --s3_access_key_id, --s3_secret_access_key, --s3_endpoint_url) in Python.
 *   The panel frames this as reading from an S3 path plus region, credentials, and tuning configuration.
 * - Deliberate deviation: StoragePathField and useAssetLoader('storageBuckets') are deliberately NOT used.
 *   StoragePathField performs Google Cloud Storage bucket discovery (gs://). Offering gs:// bucket
 *   autocompletions for Amazon S3 (s3://) would be actively misleading and result in broken pipelines.
 *   Instead, PropertyField is used directly with static datalist suggestions of canonical S3 URI formats
 *   (s3://my-bucket/data/, s3://my-bucket/year=2024/*.parquet, etc.). Future maintainers MUST NOT replace
 *   this with StoragePathField or dispatch getStorageBuckets IPC messages.
 * - Security & Credentials: AWS credential secrets (secretAccessKey) are rendered strictly with type='password'
 *   and are never echoed, logged, or exposed in plaintext. Conditional rendering displays accessKeyId and
 *   secretAccessKey only when StaticCredentialsProvider is selected, and profileName only when
 *   ProfileCredentialsProvider is selected. DefaultCredentialsProvider renders no secret input fields.
 *   (WebIdentityTokenCredentialsProvider was removed as it is not a supported @type in Beam's AwsOptions.)
 * - Reusable UI Primitives: Uses common primitives CollapsibleSection, SelectField, and PropertyField
 *   rather than local reimplementations, adhering strictly to the 8pt grid, VS Code theme variables,
 *   and zero inline styles or raw slate-* classes.
 * - Props in, events up: Fully controlled component taking only node and onChange.
 */

import React, { useState } from 'react';
import { Sliders } from 'lucide-react';
import { InfoTooltip } from '../../components/InfoTooltip';
import { PropertyField } from '../../components/common/PropertyField';
import { CollapsibleSection } from '../../components/common/CollapsibleSection';
import { SelectField } from '../../components/common/SelectField';

export interface S3FileSystemSourceNode {
  data: {
    label: string;
    beam_transform?: string;
    system_instructions?: string;
    special_instructions?: string;
    properties?: {
      filePattern?: string;
      awsRegion?: string;
      credentialsProvider?: string;
      accessKeyId?: string;
      secretAccessKey?: string;
      profileName?: string;
      endpointUrl?: string;
      format?: string;
      compression?: string;
      validate?: boolean;
      minBundleSize?: string | number;
      system_instructions?: string;
      special_instructions?: string;
      [key: string]: any;
    };
  };
}

export interface S3FileSystemSourcePropertiesProps {
  node: S3FileSystemSourceNode;
  onChange: (properties: any) => void;
}

/** Static datalist suggestions for canonical S3 URI shapes */
export const S3_SOURCE_PATH_SUGGESTIONS = [
  's3://my-bucket/data/',
  's3://my-bucket/data/*.parquet',
  's3://my-bucket/year=2024/*.parquet',
  's3://my-bucket/input/*.csv',
  's3://my-bucket/events/*.json'
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
  { value: 'StaticCredentialsProvider', label: 'StaticCredentialsProvider (Explicit Access Key ID & Secret Access Key)' },
  { value: 'ProfileCredentialsProvider', label: 'ProfileCredentialsProvider (Named AWS profile from ~/.aws/credentials)' }
];

export const AWS_CREDENTIALS_PROVIDERS = S3_CREDENTIALS_PROVIDERS;

/** Underlying Beam I/O formats wrapping S3 read */
export const S3_SOURCE_FORMATS = [
  { value: 'TextIO', label: 'TextIO (Plain text / lines / JSON)' },
  { value: 'AvroIO', label: 'AvroIO (Apache Avro records)' },
  { value: 'ParquetIO', label: 'ParquetIO (Apache Parquet columnar)' },
  { value: 'FileIO', label: 'FileIO (Generic file streams / binary)' }
];

/** File compression options (matches Beam Compression / CompressionTypes; XZ is not supported) */
export const S3_SOURCE_COMPRESSION_TYPES = [
  { value: 'AUTO', label: 'AUTO (Detect from file extension)' },
  { value: 'UNCOMPRESSED', label: 'UNCOMPRESSED (Standard uncompressed files)' },
  { value: 'GZIP', label: 'GZIP (.gz)' },
  { value: 'BZIP2', label: 'BZIP2 (.bz2)' },
  { value: 'DEFLATE', label: 'DEFLATE / ZLIB' },
  { value: 'ZSTD', label: 'ZSTD (.zst)' }
];

/**
 * S3FileSystemSourceProperties renders the property configuration form for S3 source reads.
 */
export const S3FileSystemSourceProperties: React.FC<S3FileSystemSourcePropertiesProps> = ({ node, onChange }) => {
  const properties = node.data.properties || {};
  const filePattern = properties.filePattern || '';
  const awsRegion = properties.awsRegion || 'us-east-1';
  const credentialsProvider = properties.credentialsProvider || 'DefaultCredentialsProvider';
  const accessKeyId = properties.accessKeyId || '';
  const secretAccessKey = properties.secretAccessKey || '';
  const profileName = properties.profileName || '';
  const endpointUrl = properties.endpointUrl || '';
  const format = properties.format || 'TextIO';
  const compression = properties.compression || 'AUTO';
  const validate = properties.validate ?? true;
  const minBundleSize = properties.minBundleSize ?? '';

  const [isAdvancedOpen, setIsAdvancedOpen] = useState<boolean>(false);

  // NOTE: Deliberately no useAssetLoader('storageBuckets') call here, as S3 paths
  // resolve against Amazon S3 rather than Google Cloud Storage buckets.
  // Validation: filePattern is required for reading S3 files
  const isFilePatternInvalid = !filePattern.trim();

  // System instructions text with fallback
  const systemInstructions =
    node.data.system_instructions ??
    node.data.special_instructions ??
    properties.system_instructions ??
    properties.special_instructions ??
    '';

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
   * Updates AI prompt / system instructions
   * @param e Native change event from textarea
   */
  const handleInstructionsChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    onChange({
      ...properties,
      system_instructions: e.target.value
    });
  };

  /**
   * Toggles the advanced tuning accordion state
   */
  const handleToggleAdvanced = () => {
    setIsAdvancedOpen((prev) => !prev);
  };

  return (
    <div className="flex-1 flex flex-col gap-4">
      {/* File Pattern Input */}
      <PropertyField
        id="s3SourceFilePattern"
        name="filePattern"
        label="File Pattern / S3 Path (.filepattern)"
        required="File Pattern is required."
        tooltip="S3 file path or glob pattern (e.g. s3://my-bucket/data/*.parquet). Note: Beam S3 filesystem registers the s3:// scheme via S3FileSystemRegistrar in Java and S3FileSystem in Python. S3 bucket discovery is not performed via Cloud Storage."
        aria-required="true"
        aria-invalid={isFilePatternInvalid}
        value={filePattern}
        onChange={handleChange}
        placeholder="s3://my-bucket/data/*.parquet"
        invalid={isFilePatternInvalid}
        error={isFilePatternInvalid ? 'File Pattern is required.' : null}
        mono={true}
        list="s3-source-path-options"
        datalist={S3_SOURCE_PATH_SUGGESTIONS}
        helperText={
          !isFilePatternInvalid ? (
            <span className="text-xs text-[var(--vscode-text-muted)]">
              Target S3 URI pattern. Uses AWS S3FileSystemRegistrar (Java) or apache_beam.io.aws.s3filesystem (Python).
            </span>
          ) : null
        }
      />

      {/* AWS Region Select */}
      <SelectField
        id="s3SourceAwsRegion"
        name="awsRegion"
        label="AWS Region"
        tooltip="AWS region for Amazon S3 bucket access (e.g. us-east-1, us-west-2, eu-west-1). Configured on AwsOptions: --awsRegion in Java; --s3_region_name in Python."
        value={awsRegion}
        options={AWS_REGIONS}
        onChange={handleChange}
        helperText="AWS region hosting the S3 bucket (AwsOptions --awsRegion in Java; --s3_region_name in Python)."
      />

      {/* AWS Credentials Provider Select */}
      <SelectField
        id="s3SourceCredentialsProvider"
        name="credentialsProvider"
        label="AWS Credentials Provider"
        tooltip="AWS credentials provider used to authenticate requests (configured on AwsOptions via --awsCredentialsProvider in Java). StaticCredentialsProvider allows explicit key pairs, ProfileCredentialsProvider reads ~/.aws/credentials, and DefaultCredentialsProvider uses the standard AWS credential chain."
        value={credentialsProvider}
        options={S3_CREDENTIALS_PROVIDERS}
        onChange={handleChange}
        helperText="Authentication strategy for S3 access (AwsOptions in Java)."
      />

      {/* Conditional: StaticCredentialsProvider (accessKeyId + secretAccessKey) */}
      {credentialsProvider === 'StaticCredentialsProvider' && (
        <div className="flex flex-col gap-3 p-3 rounded-md border border-[var(--vscode-border)] bg-[var(--vscode-subcard-bg)]">
          <PropertyField
            id="s3SourceAccessKeyId"
            name="accessKeyId"
            label="AWS Access Key ID"
            tooltip="AWS Access Key ID for static credential authentication."
            value={accessKeyId}
            onChange={handleChange}
            placeholder="AKIAIOSFODNN7EXAMPLE"
            mono={true}
            helperText={
              <span className="text-xs text-[var(--vscode-text-muted)]">
                20-character alphanumeric AWS Access Key ID.
              </span>
            }
          />
          <PropertyField
            id="s3SourceSecretAccessKey"
            name="secretAccessKey"
            type="password"
            label="AWS Secret Access Key"
            tooltip="AWS Secret Access Key paired with the Access Key ID. Never echoed or logged in plaintext."
            value={secretAccessKey}
            onChange={handleChange}
            placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
            mono={true}
            helperText={
              <span className="text-xs text-[var(--vscode-text-muted)]">
                Secret key is masked and securely provided to worker AwsOptions (Java) / S3Options (Python) at runtime.
              </span>
            }
          />
        </div>
      )}

      {/* Conditional: ProfileCredentialsProvider (profileName) */}
      {credentialsProvider === 'ProfileCredentialsProvider' && (
        <PropertyField
          id="s3SourceProfileName"
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
        id="s3SourceEndpointUrl"
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

      {/* Wrapping Reader Format Select */}
      <SelectField
        id="s3SourceFormat"
        name="format"
        label="File Format / Reader"
        tooltip="Underlying Beam I/O reader transform wrapping the S3 filesystem access (TextIO for lines/CSV/JSON, AvroIO for Avro records, ParquetIO for columnar data, or FileIO for raw file streams)."
        value={format}
        options={S3_SOURCE_FORMATS}
        onChange={handleChange}
        helperText={
          <span>
            Beam reader transform used to decode S3 files. Defaults to <code>TextIO</code>.
          </span>
        }
      />

      {/* Compression Select */}
      <SelectField
        id="s3SourceCompression"
        name="compression"
        label="Compression"
        tooltip="Compression codec used for input S3 files. AUTO detects from file extension."
        value={compression}
        options={S3_SOURCE_COMPRESSION_TYPES}
        onChange={handleChange}
      />

      {/* Advanced Tuning Accordion */}
      <CollapsibleSection
        title="Read Tuning & Options"
        icon={<Sliders className="w-4 h-4 text-emerald-400" />}
        isOpen={isAdvancedOpen}
        onToggle={handleToggleAdvanced}
      >
        {/* Validate Checkbox */}
        <label htmlFor="s3SourceValidate" className="flex items-center gap-2 cursor-pointer mt-1">
          <input
            id="s3SourceValidate"
            type="checkbox"
            name="validate"
            checked={validate}
            onChange={handleChange}
            className="rounded bg-[var(--vscode-input-bg)] border-[var(--vscode-border)] text-blue-500 focus:ring-0 focus:ring-offset-0"
          />
          <span className="text-xs text-[var(--vscode-text-secondary)]">
            Validate file existence on pipeline startup
          </span>
          <InfoTooltip text="Validates that the input S3 file pattern matches at pipeline construction time." />
        </label>

        {/* Minimum Bundle Size */}
        <PropertyField
          id="s3SourceMinBundleSize"
          type="number"
          name="minBundleSize"
          label="Minimum Bundle Size (bytes)"
          tooltip="Minimum byte size to consider when splitting input S3 files into bundles for parallel worker execution. Default 0."
          value={minBundleSize}
          onChange={handleChange}
          placeholder="0"
          min="0"
          mono={true}
        />
      </CollapsibleSection>

      {/* Code Generation Instructions */}
      <div className="pt-2 border-t border-[var(--vscode-border-light)]">
        <PropertyField
          id="s3SourceInstructions"
          name="system_instructions"
          label="Code Generation Instructions"
          tooltip="Custom instructions provided directly to Gemini when generating pipeline source code for this S3FileSystem reader step."
          type="textarea"
          rows={3}
          value={systemInstructions}
          onChange={handleInstructionsChange}
          placeholder="e.g. Read Parquet files from S3 with AWS region us-west-2 and parse records into Beam Rows."
          mono={false}
          className="resize-y h-24"
          helperText="Additional guidance appended to prompt when synthesizing Java/Python code."
        />
      </div>
    </div>
  );
};
