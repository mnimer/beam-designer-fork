/**
 * ParquetIO Sink Properties Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Renders the property configuration panel for Apache Beam ParquetIO Sink nodes
 * (e.g. FileIO.<GenericRecord>write().via(ParquetIO.sink(schema)...).to(...) in Java or
 * beam.io.WriteToParquet(...) in Python).
 * 
 * Architectural Decisions:
 * - ParquetIO write operations require a target destination directory or file path prefix (.to(...)).
 * - Designed for multi-cloud and local file systems (Google Cloud Storage gs://, Amazon S3 s3://, HDFS hdfs://, local files).
 * - Provides an Avro/PyArrow schema configuration textarea with a 1-click sample schema generator.
 * - Supports industry-standard Parquet compression codecs (SNAPPY, GZIP, ZSTD, BROTLI, UNCOMPRESSED).
 * - Exposes sharding controls (numShards, shardTemplate) and advanced row group buffer sizing.
 * - Adheres strictly to the 8pt grid system, VS Code theme variables, and Tailwind CSS.
 */

import React, { useState } from 'react';
import { InfoTooltip } from '../../components/InfoTooltip';
import { PropertyField } from '../../components/common/PropertyField';
import { FileCode, ChevronDown, ChevronRight, Sparkles } from 'lucide-react';

export interface ParquetIOSinkNode {
  data: {
    label: string;
    beam_transform?: string;
    system_instructions?: string;
    special_instructions?: string;
    properties?: {
      to?: string;
      suffix?: string;
      schema?: string;
      codec?: string;
      numShards?: string | number;
      shardTemplate?: string;
      rowGroupBufferSize?: string | number;
      recordBatchSize?: string | number;
      useCompliantNestedType?: boolean;
      useDeprecatedInt96Timestamps?: boolean;
      system_instructions?: string;
      special_instructions?: string;
      [key: string]: any;
    };
  };
}

export interface ParquetIOSinkPropertiesProps {
  node: ParquetIOSinkNode;
  onChange: (properties: any) => void;
}

export const PARQUET_CODECS = [
  { value: 'SNAPPY', label: 'SNAPPY (Default, Fast)' },
  { value: 'GZIP', label: 'GZIP (Higher Compression)' },
  { value: 'ZSTD', label: 'ZSTD (Balanced)' },
  { value: 'BROTLI', label: 'BROTLI' },
  { value: 'UNCOMPRESSED', label: 'UNCOMPRESSED / NONE' }
];

const SAMPLE_AVRO_SINK_SCHEMA = JSON.stringify(
  {
    type: 'record',
    name: 'OutputRecord',
    namespace: 'com.example.beam',
    fields: [
      { name: 'id', type: 'string' },
      { name: 'name', type: 'string' },
      { name: 'amount', type: 'double' },
      { name: 'processed_at', type: 'long' }
    ]
  },
  null,
  2
);

/**
 * ParquetIOSinkProperties renders the property configuration form for ParquetIO writes.
 */
export const ParquetIOSinkProperties: React.FC<ParquetIOSinkPropertiesProps> = ({ node, onChange }) => {
  const properties = node.data.properties || {};
  const to = properties.to || '';
  const suffix = properties.suffix ?? '.parquet';
  const schema = properties.schema || '';
  const codec = properties.codec || 'SNAPPY';
  const numShards = properties.numShards ?? '';
  const shardTemplate = properties.shardTemplate || '';
  const rowGroupBufferSize = properties.rowGroupBufferSize ?? 67108864;
  const recordBatchSize = properties.recordBatchSize ?? 1000;
  const useCompliantNestedType = properties.useCompliantNestedType ?? false;
  const useDeprecatedInt96Timestamps = properties.useDeprecatedInt96Timestamps ?? false;

  const [isAdvancedOpen, setIsAdvancedOpen] = useState<boolean>(false);
  const [isSchemaOpen, setIsSchemaOpen] = useState<boolean>(true);

  // Validation: destination directory/prefix (.to) is required
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
   * Inserts a sample Avro schema snippet into the schema field
   */
  const handleInsertSampleSchema = () => {
    onChange({
      ...properties,
      schema: SAMPLE_AVRO_SINK_SCHEMA
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

  return (
    <div className="flex-1 flex flex-col gap-4">
      {/* Destination Directory (.to) Input */}
      <PropertyField
        id="parquetSinkTo"
        name="to"
        label="Destination Directory / Prefix (.to)"
        required={true}
        tooltip="Base output directory path or prefix where Parquet files will be written (e.g. gs://bucket/output/, s3://bucket/output/, hdfs://path/output/, or /local/output/). Required."
        value={to}
        invalid={isToInvalid}
        error={isToInvalid ? 'Destination Directory is required.' : null}
        onChange={handleChange}
        placeholder="gs://bucket/output/, s3://bucket/output/, or /local/output/"
        helperText={
          isToInvalid ? undefined : 'Target storage prefix across Cloud Storage, Amazon S3, HDFS, or local storage.'
        }
      />

      {/* File Suffix Input */}
      <PropertyField
        id="parquetSinkSuffix"
        name="suffix"
        label="File Name Suffix"
        tooltip="File extension appended to each shard (e.g. .parquet). Defaults to .parquet."
        value={suffix}
        onChange={handleChange}
        placeholder=".parquet"
      />

      {/* Compression Codec Dropdown */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="parquetSinkCodec" className="flex items-center text-xs font-bold uppercase text-[var(--vscode-text-muted)] gap-1.5">
          <span>Compression Codec</span>
          <InfoTooltip text="Parquet block-level compression algorithm. SNAPPY is recommended for high read/write throughput; GZIP and ZSTD offer higher compression ratios." />
        </label>
        <select
          id="parquetSinkCodec"
          name="codec"
          value={codec}
          onChange={handleChange}
          className="bg-[var(--vscode-input-bg)] text-[var(--vscode-text-primary)] p-2 rounded border border-[var(--vscode-border)] text-sm focus:outline-none focus:border-[var(--vscode-highlight)] font-mono"
        >
          {PARQUET_CODECS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      {/* Schema Accordion Section */}
      <div className="border border-[var(--vscode-border)] rounded-md bg-[var(--vscode-subcard-bg)] overflow-hidden">
        <button
          type="button"
          onClick={() => setIsSchemaOpen(!isSchemaOpen)}
          className="w-full flex items-center justify-between p-3 text-xs font-bold uppercase text-[var(--vscode-text-primary)] hover:bg-[var(--vscode-hover)] transition-colors"
        >
          <div className="flex items-center gap-2">
            <FileCode className="w-4 h-4 text-rose-400" />
            <span>Schema Specification</span>
          </div>
          {isSchemaOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>

        {isSchemaOpen && (
          <div className="p-3 pt-0 flex flex-col gap-2 border-t border-[var(--vscode-border-light)] mt-2">
            <div className="flex justify-between items-center mt-2">
              <label htmlFor="parquetSinkSchema" className="text-[11px] font-semibold text-[var(--vscode-text-muted)] flex items-center gap-1.5">
                <span>Avro / PyArrow Schema (Required for Java / Strict Python)</span>
                <InfoTooltip text="Target schema definition. In Java, FileIO.write().via(ParquetIO.sink(schema)) requires an Avro schema. In Python WriteToParquet, pyarrow.Schema is required." />
              </label>
              <button
                type="button"
                onClick={handleInsertSampleSchema}
                className="text-[11px] text-[var(--vscode-highlight)] hover:underline flex items-center gap-1 font-medium"
              >
                <Sparkles className="w-3 h-3" />
                <span>Insert Sample</span>
              </button>
            </div>
            <textarea
              id="parquetSinkSchema"
              name="schema"
              value={schema}
              onChange={handleChange}
              rows={4}
              placeholder='{"type": "record", "name": "Output", "fields": [...]} or gs://bucket/schema.avsc'
              className="bg-[var(--vscode-input-bg)] text-[var(--vscode-text-primary)] p-2 rounded border border-[var(--vscode-border)] text-xs focus:outline-none focus:border-[var(--vscode-highlight)] font-mono resize-y"
            />
            <span className="text-[11px] text-[var(--vscode-text-muted)]">
              Provide schema JSON string or path to <code>.avsc</code> file.
            </span>
          </div>
        )}
      </div>

      {/* Sharding Configuration */}
      <div className="flex flex-col gap-2 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border)]">
        <label htmlFor="parquetSinkNumShards" className="flex items-center text-xs font-bold uppercase text-[var(--vscode-text-muted)] gap-1.5">
          <span>Number of Shards</span>
          <InfoTooltip text="Fixed number of output shards. Set to 0 to let the Beam runner automatically determine sharding dynamically." />
        </label>
        <input
          id="parquetSinkNumShards"
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

        <PropertyField
          id="parquetSinkShardTemplate"
          name="shardTemplate"
          label="Shard Name Template (Optional)"
          tooltip="Custom template for shard naming (e.g. -SSSSS-of-NNNNN). Leave blank for Beam standard default."
          value={shardTemplate}
          onChange={handleChange}
          placeholder="-SSSSS-of-NNNNN"
        />
      </div>

      {/* Advanced Settings Accordion */}
      <div className="border border-[var(--vscode-border)] rounded-md bg-[var(--vscode-subcard-bg)] overflow-hidden">
        <button
          type="button"
          onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
          className="w-full flex items-center justify-between p-3 text-xs font-bold uppercase text-[var(--vscode-text-primary)] hover:bg-[var(--vscode-hover)] transition-colors"
        >
          <div className="flex items-center gap-2">
            <span>Advanced Parquet Settings</span>
          </div>
          {isAdvancedOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>

        {isAdvancedOpen && (
          <div className="p-3 pt-0 flex flex-col gap-3 border-t border-[var(--vscode-border-light)] mt-2">
            {/* Row Group Buffer Size */}
            <div className="flex flex-col gap-1 mt-2">
              <label htmlFor="parquetSinkRowGroupBufferSize" className="text-[11px] font-semibold text-[var(--vscode-text-muted)] flex items-center gap-1.5">
                <span>Row Group Buffer Size (bytes)</span>
                <InfoTooltip text="Byte size of the uncompressed in-memory row group buffer before flushing to file. Default: 67108864 (64 MB)." />
              </label>
              <input
                id="parquetSinkRowGroupBufferSize"
                type="number"
                name="rowGroupBufferSize"
                value={rowGroupBufferSize}
                onChange={handleChange}
                placeholder="67108864"
                min="1048576"
                className="bg-[var(--vscode-input-bg)] text-[var(--vscode-text-primary)] p-2 rounded border border-[var(--vscode-border)] text-xs focus:outline-none focus:border-[var(--vscode-highlight)] font-mono"
              />
            </div>

            {/* Record Batch Size */}
            <div className="flex flex-col gap-1">
              <label htmlFor="parquetSinkRecordBatchSize" className="text-[11px] font-semibold text-[var(--vscode-text-muted)] flex items-center gap-1.5">
                <span>Record Batch Size</span>
                <InfoTooltip text="Number of records in each record batch stored within the row group buffer. Default: 1000." />
              </label>
              <input
                id="parquetSinkRecordBatchSize"
                type="number"
                name="recordBatchSize"
                value={recordBatchSize}
                onChange={handleChange}
                placeholder="1000"
                min="1"
                className="bg-[var(--vscode-input-bg)] text-[var(--vscode-text-primary)] p-2 rounded border border-[var(--vscode-border)] text-xs focus:outline-none focus:border-[var(--vscode-highlight)] font-mono"
              />
            </div>

            {/* Use Compliant Nested Types */}
            <label htmlFor="parquetSinkCompliantNested" className="flex items-center gap-2 cursor-pointer">
              <input
                id="parquetSinkCompliantNested"
                type="checkbox"
                name="useCompliantNestedType"
                checked={useCompliantNestedType}
                onChange={handleChange}
                className="rounded bg-[var(--vscode-input-bg)] border-[var(--vscode-border)] text-blue-500 focus:ring-0 focus:ring-offset-0"
              />
              <span className="text-xs text-[var(--vscode-text-secondary)]">Use Compliant Parquet Nested Types (3-level lists)</span>
              <InfoTooltip text="Writes 3-level compliant Parquet list representations for nested arrays." />
            </label>

            {/* Use Deprecated INT96 Timestamps */}
            <label htmlFor="parquetSinkInt96" className="flex items-center gap-2 cursor-pointer">
              <input
                id="parquetSinkInt96"
                type="checkbox"
                name="useDeprecatedInt96Timestamps"
                checked={useDeprecatedInt96Timestamps}
                onChange={handleChange}
                className="rounded bg-[var(--vscode-input-bg)] border-[var(--vscode-border)] text-blue-500 focus:ring-0 focus:ring-offset-0"
              />
              <span className="text-xs text-[var(--vscode-text-secondary)]">Use Deprecated INT96 Timestamps</span>
              <InfoTooltip text="Writes nanosecond-precision timestamps using legacy INT96 format (required by some older query engines like older Hive/Impala)." />
            </label>
          </div>
        )}
      </div>

      {/* Code Generation Instructions */}
      <div className="flex flex-col gap-1.5 pt-2 border-t border-[var(--vscode-border-light)]">
        <PropertyField
          id="parquetSinkInstructions"
          name="system_instructions"
          label="Code Generation Instructions"
          tooltip="Custom instructions provided directly to Gemini when generating pipeline source code for this ParquetIO writer step."
          type="textarea"
          value={systemInstructions}
          onChange={handleInstructionsChange}
          placeholder="e.g. Ensure Parquet writer configures snappy compression and uses Avro SpecificRecord serialization."
          rows={3}
          mono={false}
          helperText="Additional guidance appended to prompt when synthesizing Java/Python code."
        />
      </div>
    </div>
  );
};
