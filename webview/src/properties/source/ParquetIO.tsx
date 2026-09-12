/**
 * ParquetIO Source Properties Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Renders the property configuration panel for Apache Beam ParquetIO Source nodes
 * (e.g. ParquetIO.read(schema).from(...) in Java or beam.io.ReadFromParquet(...) in Python).
 * 
 * Architectural Decisions:
 * - ParquetIO read operations require a target file or glob pattern (.from(...)).
 * - Designed for multi-cloud and local file systems (Google Cloud Storage gs://, Amazon S3 s3://, HDFS hdfs://, local files).
 * - Provides an Avro/PyArrow schema configuration textarea with a 1-click sample schema generator.
 * - Supports column projection pushdown (.withProjection(...) / columns=[...]) for columnar efficiency.
 * - Supports vectorized batched read mode (ReadFromParquetBatched) and construction-time validation.
 * - Adheres strictly to the 8pt grid system, VS Code theme variables, and Tailwind CSS.
 */

import React, { useState } from 'react';
import { InfoTooltip } from '../../components/InfoTooltip';
import { FileCode, ChevronDown, ChevronRight, Sparkles } from 'lucide-react';

export interface ParquetIOSourceNode {
  data: {
    label: string;
    beam_transform?: string;
    system_instructions?: string;
    special_instructions?: string;
    properties?: {
      filePattern?: string;
      schema?: string;
      columns?: string;
      validate?: boolean;
      batched?: boolean;
      minBundleSize?: string | number;
      system_instructions?: string;
      special_instructions?: string;
      [key: string]: any;
    };
  };
}

export interface ParquetIOSourcePropertiesProps {
  node: ParquetIOSourceNode;
  onChange: (properties: any) => void;
}

const SAMPLE_AVRO_SCHEMA = JSON.stringify(
  {
    type: 'record',
    name: 'UserRecord',
    namespace: 'com.example.beam',
    fields: [
      { name: 'id', type: 'string' },
      { name: 'name', type: 'string' },
      { name: 'email', type: ['null', 'string'], default: null },
      { name: 'timestamp', type: 'long' }
    ]
  },
  null,
  2
);

export const ParquetIOSourceProperties: React.FC<ParquetIOSourcePropertiesProps> = ({ node, onChange }) => {
  const properties = node.data.properties || {};
  const filePattern = properties.filePattern || '';
  const schema = properties.schema || '';
  const columns = properties.columns || '';
  const validate = properties.validate ?? true;
  const batched = properties.batched ?? false;
  const minBundleSize = properties.minBundleSize ?? '';

  const [isAdvancedOpen, setIsAdvancedOpen] = useState<boolean>(false);
  const [isSchemaOpen, setIsSchemaOpen] = useState<boolean>(true);

  // Validation: filePattern is required for reading Parquet files
  const isInvalid = !filePattern.trim();

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
      schema: SAMPLE_AVRO_SCHEMA
    });
  };

  /**
   * Updates AI prompt / system instructions
   */
  const handleInstructionsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange({
      ...properties,
      system_instructions: e.target.value
    });
  };

  return (
    <div className="flex-1 flex flex-col gap-4">
      {/* File Pattern Input */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="parquetSourceFilePattern" className="flex items-center text-xs font-bold uppercase text-[var(--vscode-text-muted)] gap-1.5">
          <span>File Pattern / Path (.from)</span>
          <span className="text-red-400 font-bold" title="Required">*</span>
          <InfoTooltip text="Target Parquet file path or glob pattern (e.g. gs://bucket/*.parquet, s3://bucket/*.parquet, hdfs://path/*.parquet, or /local/path/*.parquet). Required." />
        </label>
        <input
          id="parquetSourceFilePattern"
          type="text"
          name="filePattern"
          aria-required="true"
          aria-invalid={isInvalid}
          value={filePattern}
          onChange={handleChange}
          placeholder="gs://bucket/data/*.parquet, s3://bucket/data/*.parquet, or /local/*.parquet"
          className={`bg-[var(--vscode-input-bg)] text-[var(--vscode-text-primary)] p-2 rounded border text-sm focus:outline-none font-mono ${
            isInvalid
              ? 'border-red-500/80 focus:border-red-500'
              : 'border-[var(--vscode-border)] focus:border-[var(--vscode-highlight)]'
          }`}
        />
        {isInvalid ? (
          <span className="text-xs text-red-400 font-medium">File Pattern is required.</span>
        ) : (
          <span className="text-xs text-[var(--vscode-text-muted)]">
            Target file or glob pattern across Cloud Storage, Amazon S3, HDFS, or local storage.
          </span>
        )}
      </div>

      {/* Projected Columns (Python: columns=[...]) */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="parquetSourceColumns" className="flex items-center text-xs font-bold uppercase text-[var(--vscode-text-muted)] gap-1.5">
          <span>Projected Columns (Python <code>columns=[...]</code>)</span>
          <InfoTooltip text="For Python pipelines: Comma-separated column names to read (e.g. 'id, name, timestamp'). PyArrow reads types directly from the Parquet footer and skips unselected columns. In Java, use the Avro Schema below instead." />
        </label>
        <input
          id="parquetSourceColumns"
          type="text"
          name="columns"
          value={columns}
          onChange={handleChange}
          placeholder="id, name, email, timestamp"
          className="bg-[var(--vscode-input-bg)] text-[var(--vscode-text-primary)] p-2 rounded border border-[var(--vscode-border)] text-sm focus:outline-none focus:border-[var(--vscode-highlight)] font-mono"
        />
        <span className="text-[11px] text-[var(--vscode-text-muted)]">
          <strong>Python:</strong> Specify comma-separated column names for projection pruning (leave blank to read all). Not used in Java.
        </span>
      </div>

      {/* Schema Accordion Section (Java: ParquetIO.read(schema)) */}
      <div className="border border-[var(--vscode-border)] rounded-md bg-[var(--vscode-subcard-bg)] overflow-hidden">
        <button
          type="button"
          onClick={() => setIsSchemaOpen(!isSchemaOpen)}
          className="w-full flex items-center justify-between p-3 text-xs font-bold uppercase text-[var(--vscode-text-primary)] hover:bg-[var(--vscode-hover)] transition-colors"
        >
          <div className="flex items-center gap-2">
            <FileCode className="w-4 h-4 text-emerald-400" />
            <span>Avro Schema (Java <code>ParquetIO.read(schema)</code>)</span>
          </div>
          {isSchemaOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>

        {isSchemaOpen && (
          <div className="p-3 pt-0 flex flex-col gap-2 border-t border-[var(--vscode-border-light)] mt-2">
            <div className="flex justify-between items-center mt-2">
              <label htmlFor="parquetSourceSchema" className="text-[11px] font-semibold text-[var(--vscode-text-muted)] flex items-center gap-1.5">
                <span>Avro Schema (Required for Java, Leave blank for Python)</span>
                <InfoTooltip text="For Java pipelines: ParquetIO.read(schema) requires an Avro schema at compile time to define the PCollection<GenericRecord> coder and filter columns. For Python pipelines, leave this empty." />
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
              id="parquetSourceSchema"
              name="schema"
              value={schema}
              onChange={handleChange}
              rows={4}
              placeholder='{"type": "record", "name": "User", "fields": [...]} or gs://bucket/schema.avsc'
              className="bg-[var(--vscode-input-bg)] text-[var(--vscode-text-primary)] p-2 rounded border border-[var(--vscode-border)] text-xs focus:outline-none focus:border-[var(--vscode-highlight)] font-mono resize-y"
            />
            <span className="text-[11px] text-[var(--vscode-text-muted)]">
              <strong>Java:</strong> Provide Avro JSON or path to <code>.avsc</code> to define GenericRecord coder and projected columns. (Leave blank for Python).
            </span>
          </div>
        )}
      </div>

      {/* Advanced Settings Accordion */}
      <div className="border border-[var(--vscode-border)] rounded-md bg-[var(--vscode-subcard-bg)] overflow-hidden">
        <button
          type="button"
          onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
          className="w-full flex items-center justify-between p-3 text-xs font-bold uppercase text-[var(--vscode-text-primary)] hover:bg-[var(--vscode-hover)] transition-colors"
        >
          <div className="flex items-center gap-2">
            <span>Read Tuning & Options</span>
          </div>
          {isAdvancedOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>

        {isAdvancedOpen && (
          <div className="p-3 pt-0 flex flex-col gap-3 border-t border-[var(--vscode-border-light)] mt-2">
            {/* Batched Reading Toggle */}
            <label htmlFor="parquetSourceBatched" className="flex items-center gap-2 cursor-pointer mt-2">
              <input
                id="parquetSourceBatched"
                type="checkbox"
                name="batched"
                checked={batched}
                onChange={handleChange}
                className="rounded bg-[var(--vscode-input-bg)] border-[var(--vscode-border)] text-blue-500 focus:ring-0 focus:ring-offset-0"
              />
              <span className="text-xs text-[var(--vscode-text-secondary)]">Batched Vectorized Mode (ReadFromParquetBatched)</span>
              <InfoTooltip text="Yields pyarrow.Table instances per row group instead of per-record dictionaries. Ideal for vectorized transformations." />
            </label>

            {/* Validate File Existence */}
            <label htmlFor="parquetSourceValidate" className="flex items-center gap-2 cursor-pointer">
              <input
                id="parquetSourceValidate"
                type="checkbox"
                name="validate"
                checked={validate}
                onChange={handleChange}
                className="rounded bg-[var(--vscode-input-bg)] border-[var(--vscode-border)] text-blue-500 focus:ring-0 focus:ring-offset-0"
              />
              <span className="text-xs text-[var(--vscode-text-secondary)]">Validate file existence on pipeline startup</span>
              <InfoTooltip text="Checks whether the input file pattern matches files at pipeline construction time." />
            </label>

            {/* Min Bundle Size */}
            <div className="flex flex-col gap-1">
              <label htmlFor="parquetSourceMinBundleSize" className="text-[11px] font-semibold text-[var(--vscode-text-muted)] flex items-center gap-1.5">
                <span>Minimum Bundle Size (bytes)</span>
                <InfoTooltip text="Minimum byte size to consider when splitting input into bundles for parallel worker execution. Default 0." />
              </label>
              <input
                id="parquetSourceMinBundleSize"
                type="number"
                name="minBundleSize"
                value={minBundleSize}
                onChange={handleChange}
                placeholder="0"
                min="0"
                className="bg-[var(--vscode-input-bg)] text-[var(--vscode-text-primary)] p-2 rounded border border-[var(--vscode-border)] text-xs focus:outline-none focus:border-[var(--vscode-highlight)] font-mono"
              />
            </div>
          </div>
        )}
      </div>

      {/* Code Generation Instructions */}
      <div className="flex flex-col gap-1.5 pt-2 border-t border-[var(--vscode-border-light)]">
        <label htmlFor="parquetSourceInstructions" className="flex items-center text-xs font-bold uppercase text-[var(--vscode-text-muted)] gap-1.5">
          <span>Code Generation Instructions</span>
          <InfoTooltip text="Custom instructions provided directly to Gemini when generating pipeline source code for this ParquetIO reader step." />
        </label>
        <textarea
          id="parquetSourceInstructions"
          value={systemInstructions}
          onChange={handleInstructionsChange}
          placeholder="e.g. Filter records where status is active, or use specific Avro SpecificRecord model class."
          className="bg-[var(--vscode-input-bg)] text-[var(--vscode-text-primary)] p-2 rounded border border-[var(--vscode-border)] text-sm focus:outline-none focus:border-[var(--vscode-highlight)] resize-y h-24"
        />
        <span className="text-xs text-[var(--vscode-text-muted)]">
          Additional guidance appended to prompt when synthesizing Java/Python code.
        </span>
      </div>
    </div>
  );
};
