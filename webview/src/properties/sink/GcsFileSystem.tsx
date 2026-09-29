/**
 * GcsFileSystem Sink Properties Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Renders the property configuration panel for Apache Beam GcsFileSystem Sink nodes
 * (e.g. org.apache.beam.sdk.extensions.gcp.storage.GcsFileSystemRegistrar registering the gs:// scheme in Java,
 * or apache_beam.io.gcp.gcsfilesystem.GCSFileSystem in Python).
 * 
 * Architectural Decisions:
 * - GCS is a FileSystem registrar and client configuration/metrics surface, not a standalone I/O transform.
 *   File writing is wrapped by formats like TextIO, AvroIO, ParquetIO, or FileIO with target path prefix (.to(...)).
 * - The metrics/tuning surface is the core focus of this panel: exposing GcsOptions (--gcsPerformanceMetrics,
 *   gcsUploadBufferSizeBytes, gcsHttpRequestWriteTimeout) as first-class controls.
 * - Highlights real Beam GCS execution metrics counters (GCS_read_bytes_counter_<bucket> and
 *   GCS_write_bytes_counter_<bucket>, gated by --gcsPerformanceMetrics in Java and
 *   --enable_bucket_write_metric_counter in Python) via dedicated informational tooltips and telemetry sections.
 * - Bucket Storage Class (NO storageClass field): Neither GcsOptions, GcsUtil, nor gcsio.py exposes a storage
 *   class option. Selecting NEARLINE/COLDLINE/ARCHIVE previously degraded silently to the bucket's default
 *   storage class. Removed rather than defaulted.
 * - Destination Location Discovery: Delegates the required destination path/prefix (.to) to the shared StoragePathField primitive.
 *   Provides Cloud Storage bucket datalist suggestions alongside always-visible discovery error alerting.
 * - Sharding and shard template options are grouped into a dedicated CollapsibleSection.
 * - Shared Primitives Composition: Reuses shared primitives (StoragePathField, CollapsibleSection, SelectField,
 *   PropertyField) to eliminate code duplication and prevent UI drift.
 * - Adheres strictly to the 8pt grid system, VS Code theme variables, and Tailwind CSS.
 */

import React, { useState } from 'react';
import { Sliders, Activity } from 'lucide-react';
import { InfoTooltip } from '../../components/InfoTooltip';
import { PropertyField } from '../../components/common/PropertyField';
import { CollapsibleSection } from '../../components/common/CollapsibleSection';
import { SelectField } from '../../components/common/SelectField';
import type { SelectFieldOption } from '../../components/common/SelectField';
import { StoragePathField } from '../../components/common/StoragePathField';

export interface GcsFileSystemSinkNode {
  data: {
    label: string;
    beam_transform?: string;
    system_instructions?: string;
    special_instructions?: string;
    properties?: {
      to?: string;
      suffix?: string;
      projectId?: string;
      enablePerformanceMetrics?: boolean;
      writeTimeoutMs?: string | number;
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

export interface GcsFileSystemSinkPropertiesProps {
  node: GcsFileSystemSinkNode;
  onChange: (properties: any) => void;
}

// NOTE: GCS_STORAGE_CLASSES (STANDARD / NEARLINE / COLDLINE / ARCHIVE) was removed because
// neither GcsOptions, GcsUtil, nor gcsio.py exposes any storage-class parameter — written objects
// always inherit the bucket's default storage class or lifecycle rule.

export const GCS_SINK_FORMATS: SelectFieldOption[] = [
  { value: 'TextIO', label: 'TextIO (Text / JSON Lines / CSV)' },
  { value: 'AvroIO', label: 'AvroIO (Apache Avro records)' },
  { value: 'ParquetIO', label: 'ParquetIO (Apache Parquet columnar)' },
  { value: 'FileIO', label: 'FileIO (Generic FileIO.write / dynamic)' }
];

export const GCS_SINK_COMPRESSION_TYPES: SelectFieldOption[] = [
  { value: 'UNCOMPRESSED', label: 'UNCOMPRESSED (Default)' },
  { value: 'GZIP', label: 'GZIP (.gz)' },
  { value: 'BZIP2', label: 'BZIP2 (.bz2)' },
  { value: 'DEFLATE', label: 'DEFLATE / ZLIB' },
  { value: 'ZSTD', label: 'ZSTD (.zst)' }
];

export const GcsFileSystemSinkProperties: React.FC<GcsFileSystemSinkPropertiesProps> = ({ node, onChange }) => {
  const properties = node.data.properties || {};
  const to = properties.to || '';
  const suffix = properties.suffix ?? '';
  const projectId = properties.projectId || '';
  const enablePerformanceMetrics = properties.enablePerformanceMetrics ?? false;
  const writeTimeoutMs = properties.writeTimeoutMs ?? '';
  const uploadBufferSizeBytes = properties.uploadBufferSizeBytes ?? '';
  const format = properties.format || 'TextIO';
  const compression = properties.compression || 'UNCOMPRESSED';
  const numShards = properties.numShards ?? '';
  const shardTemplate = properties.shardTemplate || '';

  const [isMetricsOpen, setIsMetricsOpen] = useState<boolean>(false);
  const [isShardingOpen, setIsShardingOpen] = useState<boolean>(false);

  // NOTE: mirrors StoragePathField's own validation rule; used here to gate helper text.
  const isToInvalid = !to.trim();

  // System instructions text with fallback
  const systemInstructions =
    node.data.system_instructions ??
    node.data.special_instructions ??
    properties.system_instructions ??
    properties.special_instructions ??
    '';

  /**
   * Handles generic input changes for form fields
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
   */
  const handleInstructionsChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    onChange({
      ...properties,
      system_instructions: e.target.value
    });
  };

  /**
   * Toggles the GCS metrics telemetry accordion state
   */
  const handleToggleMetrics = () => {
    setIsMetricsOpen((prev) => !prev);
  };

  /**
   * Toggles the sharding options accordion state
   */
  const handleToggleSharding = () => {
    setIsShardingOpen((prev) => !prev);
  };

  return (
    <div className="flex-1 flex flex-col gap-4">
      {/* Destination Directory (.to) Input with Cloud Storage bucket autocomplete */}
      <StoragePathField
        id="gcsSinkTo"
        name="to"
        label="Destination Directory / Prefix (gs://)"
        tooltip="Target Google Cloud Storage directory path or prefix where files will be written (e.g. gs://bucket/output/data). Scheme gs:// is registered by GcsFileSystemRegistrar."
        value={to}
        onChange={handleChange}
        placeholder="gs://bucket/output/"
        errorMessage="Destination Directory is required."
        helperText={
          !isToInvalid ? (
            <span className="text-xs text-[var(--vscode-text-muted)]">
              Base Cloud Storage prefix for output files (registered scheme: <code>gs://</code>).
            </span>
          ) : null
        }
      />

      {/* File Name Suffix */}
      <PropertyField
        id="gcsSinkSuffix"
        name="suffix"
        label="File Name Suffix"
        tooltip="File extension appended to each shard (e.g. .json, .csv, .parquet). Default is empty or determined by format."
        value={suffix}
        onChange={handleChange}
        placeholder=".json"
        mono={true}
      />

      {/* Project ID Input */}
      <PropertyField
        id="gcsSinkProjectId"
        name="projectId"
        label="GCP Project ID (Optional)"
        tooltip="Google Cloud Project ID. Maps to GcsOptions.setProject(String) (--project in Java GcpOptions and Python GoogleCloudOptions)."
        value={projectId}
        onChange={handleChange}
        placeholder="my-gcp-project"
        mono={true}
        helperText={
          <span className="text-xs text-[var(--vscode-text-muted)]">
            Maps to <code>GcsOptions.setProject(String)</code> (<code>--project</code> in Java and Python <code>GoogleCloudOptions</code>).
          </span>
        }
      />

      {/* GCS Performance Metrics Checkbox */}
      <label htmlFor="gcsSinkPerformanceMetrics" className="flex items-center gap-2 cursor-pointer mt-1">
        <input
          id="gcsSinkPerformanceMetrics"
          type="checkbox"
          name="enablePerformanceMetrics"
          checked={enablePerformanceMetrics}
          onChange={handleChange}
          className="rounded bg-[var(--vscode-input-bg)] border-[var(--vscode-border)] text-blue-500 focus:ring-0 focus:ring-offset-0"
        />
        <span className="text-xs text-[var(--vscode-text-secondary)]">
          Enable GCS Performance Metrics (--gcsPerformanceMetrics)
        </span>
        <InfoTooltip text="Enables per-bucket GCS byte counters. Maps to --gcsPerformanceMetrics (GcsOptions.setGcsPerformanceMetrics(Boolean)) in Java and --enable_bucket_write_metric_counter in Python GoogleCloudOptions." />
      </label>

      {/* HTTP Write Timeout Input */}
      <PropertyField
        id="gcsSinkWriteTimeoutMs"
        type="number"
        name="writeTimeoutMs"
        label="HTTP Write Timeout (ms)"
        tooltip="HTTP request write timeout in milliseconds for GCS API calls (maps to GcsOptions.getGcsHttpRequestWriteTimeout()). Default is 20000 ms."
        value={writeTimeoutMs}
        onChange={handleChange}
        placeholder="20000"
        min="0"
        mono={true}
        helperText={
          <span className="text-xs text-[var(--vscode-text-muted)]">
            Timeout in milliseconds for GCS write HTTP requests.
          </span>
        }
      />

      {/* Upload Buffer Size Input */}
      <PropertyField
        id="gcsSinkUploadBufferSizeBytes"
        type="number"
        name="uploadBufferSizeBytes"
        label="Upload Buffer Size (bytes)"
        tooltip="Chunk buffer size for GCS API calls in bytes (maps to GcsOptions.getGcsUploadBufferSizeBytes()). Default is 8388608 (8 MiB)."
        value={uploadBufferSizeBytes}
        onChange={handleChange}
        placeholder="8388608"
        min="0"
        mono={true}
        helperText={
          <span className="text-xs text-[var(--vscode-text-muted)]">
            Chunk buffer size in bytes for GCS operations (e.g. 8388608 for 8 MiB).
          </span>
        }
      />

      {/* Wrapping Writer Format Select */}
      <SelectField
        id="gcsSinkFormat"
        name="format"
        label="Wrapping Writer Format"
        tooltip="Underlying Beam I/O transform used to serialize files to GCS (TextIO, AvroIO, ParquetIO, or FileIO)."
        value={format}
        options={GCS_SINK_FORMATS}
        onChange={handleChange}
        helperText={
          <span>
            Beam I/O sink applied to serialize elements onto GcsFileSystem. Defaults to <code>TextIO</code>.
          </span>
        }
      />

      {/* Compression Select */}
      <SelectField
        id="gcsSinkCompression"
        name="compression"
        label="Compression"
        tooltip="Compression algorithm applied to output files written to Cloud Storage. Defaults to UNCOMPRESSED."
        value={compression}
        options={GCS_SINK_COMPRESSION_TYPES}
        onChange={handleChange}
      />

      {/* GCS Metrics & Telemetry Accordion */}
      <CollapsibleSection
        title="GCS Metrics & Telemetry"
        icon={<Activity className="w-4 h-4 text-emerald-400" />}
        isOpen={isMetricsOpen}
        onToggle={handleToggleMetrics}
      >
        <div className="text-xs text-[var(--vscode-text-secondary)] leading-relaxed">
          When performance metrics are enabled (<code className="text-[var(--vscode-text-primary)]">--gcsPerformanceMetrics</code> in Java / <code className="text-[var(--vscode-text-primary)]">--enable_bucket_write_metric_counter</code> in Python), Beam emits per-bucket byte counters into execution telemetry:
        </div>

        <div className="flex flex-col gap-2 pt-1">
          <div className="flex items-center justify-between p-2 rounded bg-[var(--vscode-input-bg)] border border-[var(--vscode-border)]">
            <div className="flex flex-col">
              <span className="text-xs font-medium text-[var(--vscode-text-primary)]">Bytes Read from GCS Bucket</span>
              <span className="text-[11px] font-mono text-[var(--vscode-text-muted)]">GCS_read_bytes_counter_&lt;bucket&gt;</span>
            </div>
            <InfoTooltip text="Beam counter tracking payload bytes read per Cloud Storage bucket (configurable prefix via GcsOptions.getGcsReadCounterPrefix(), default GCS_read_bytes_counter_<bucket>; gated by --enable_bucket_read_metric_counter in Python)." />
          </div>

          <div className="flex items-center justify-between p-2 rounded bg-[var(--vscode-input-bg)] border border-[var(--vscode-border)]">
            <div className="flex flex-col">
              <span className="text-xs font-medium text-[var(--vscode-text-primary)]">Bytes Written to GCS Bucket</span>
              <span className="text-[11px] font-mono text-[var(--vscode-text-muted)]">GCS_write_bytes_counter_&lt;bucket&gt;</span>
            </div>
            <InfoTooltip text="Beam counter tracking payload bytes written per Cloud Storage bucket (configurable prefix via GcsOptions.getGcsWriteCounterPrefix(), default GCS_write_bytes_counter_<bucket>; gated by --enable_bucket_write_metric_counter in Python)." />
          </div>
        </div>
      </CollapsibleSection>

      {/* Sharding & Output Options Accordion */}
      <CollapsibleSection
        title="Sharding & Shard Template Options"
        icon={<Sliders className="w-4 h-4 text-emerald-400" />}
        isOpen={isShardingOpen}
        onToggle={handleToggleSharding}
      >
        {/* Number of Shards */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="gcsSinkNumShards"
            className="flex items-center text-xs font-bold uppercase text-[var(--vscode-text-muted)] gap-1.5"
          >
            <span>Number of Shards</span>
            <InfoTooltip text="Fixed number of output shards. Set to 0 to let the Beam runner automatically determine sharding dynamically." />
          </label>
          <input
            id="gcsSinkNumShards"
            type="number"
            name="numShards"
            value={numShards}
            onChange={handleChange}
            placeholder="0 (Automatic)"
            min="0"
            className="bg-[var(--vscode-input-bg)] text-[var(--vscode-text-primary)] p-2 rounded border border-[var(--vscode-border)] text-sm focus:outline-none focus:border-[var(--vscode-highlight)] font-mono"
          />
          <span className="text-[11px] text-[var(--vscode-text-muted)]">
            0 or empty lets the runner automatically size output shards.
          </span>
        </div>

        {/* Shard Template */}
        <PropertyField
          id="gcsSinkShardTemplate"
          name="shardTemplate"
          label="Shard Name Template (Optional)"
          tooltip="Custom template for shard naming (e.g. -SSSSS-of-NNNNN). Leave blank for Beam standard default."
          value={shardTemplate}
          onChange={handleChange}
          placeholder="-SSSSS-of-NNNNN"
          mono={true}
        />
      </CollapsibleSection>

      {/* Code Generation Instructions */}
      <div className="pt-2 border-t border-[var(--vscode-border-light)]">
        <PropertyField
          id="gcsSinkInstructions"
          name="system_instructions"
          label="Code Generation Instructions"
          tooltip="Custom instructions provided directly to Gemini when generating pipeline source code for this GcsFileSystem writer step."
          type="textarea"
          rows={3}
          value={systemInstructions}
          onChange={handleInstructionsChange}
          placeholder="e.g. Write processed events to gs://my-bucket/output/ with GCS performance metrics enabled."
          mono={false}
          className="resize-y h-24"
          helperText="Additional guidance appended to prompt when synthesizing Java/Python code."
        />
      </div>
    </div>
  );
};
