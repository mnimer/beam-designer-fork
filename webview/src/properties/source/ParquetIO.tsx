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
import { PropertyField } from '../../components/common/PropertyField';
import { StoragePathField } from '../../components/common/StoragePathField';
import { SchemaEditor, resolveSchemaFields, type SchemaField } from '../../components/common/SchemaEditor';
import { FileCode, ChevronDown, ChevronRight } from 'lucide-react';

export interface ParquetIOSourceNode {
  data: {
    label: string;
    beam_transform?: string;
    system_instructions?: string;
    special_instructions?: string;
    properties?: {
      filePattern?: string;
      schema?: string;
      schemaString?: string;
      schemaFields?: SchemaField[];
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

export const ParquetIOSourceProperties: React.FC<ParquetIOSourcePropertiesProps> = ({ node, onChange }) => {
  const properties = node.data.properties || {};
  const filePattern = properties.filePattern || '';
  const schemaFields: SchemaField[] = resolveSchemaFields(properties);
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
      {/* File Pattern Input */}
      <StoragePathField
        id="parquetSourceFilePattern"
        name="filePattern"
        label="File Pattern / Path (.from)"
        tooltip="Target Parquet file path or glob pattern (e.g. gs://bucket/*.parquet, s3://bucket/*.parquet, hdfs://path/*.parquet, or /local/path/*.parquet). Required."
        value={filePattern}
        onChange={handleChange}
        placeholder="gs://bucket/data/*.parquet, s3://bucket/data/*.parquet, or /local/*.parquet"
        errorMessage={isInvalid ? 'File Pattern is required.' : undefined}
        helperText="Target file or glob pattern across Cloud Storage, Amazon S3, HDFS, or local storage."
      />

      {/* Projected Columns (Python: columns=[...]) */}
      <PropertyField
        id="parquetSourceColumns"
        name="columns"
        label="Projected Columns (Python columns=[...])"
        tooltip="For Python pipelines: Comma-separated column names to read (e.g. 'id, name, timestamp'). PyArrow reads types directly from the Parquet footer and skips unselected columns. In Java, use the Avro Schema below instead."
        value={columns}
        onChange={handleChange}
        placeholder="id, name, email, timestamp"
        mono={true}
        helperText={
          <span className="text-[11px] text-[var(--vscode-text-muted)]">
            <strong>Python:</strong> Specify comma-separated column names for projection pruning (leave blank to read all). Not used in Java.
          </span>
        }
      />

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
            <div className="mt-2">
              <SchemaEditor
                fields={schemaFields}
                schemaTitle="Avro Schema (Required for Java, Leave blank for Python)"
                jsonTextareaId="parquetSourceSchema"
                stringTextareaId="parquetSourceSchemaString"
                onChange={({ schemaFields: nextFields, schema: nextSchema, schemaString: nextStr }) => {
                  onChange({
                    ...properties,
                    schemaFields: nextFields,
                    schema: nextSchema,
                    schemaString: nextStr
                  });
                }}
              />
            </div>
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
            <PropertyField
              id="parquetSourceMinBundleSize"
              type="number"
              name="minBundleSize"
              label="Minimum Bundle Size (bytes)"
              tooltip="Minimum byte size to consider when splitting input into bundles for parallel worker execution. Default 0."
              value={minBundleSize}
              onChange={handleChange}
              placeholder="0"
              min="0"
              mono={true}
            />
          </div>
        )}
      </div>

      {/* Code Generation Instructions */}
      <div className="pt-2 border-t border-[var(--vscode-border-light)]">
        <PropertyField
          id="parquetSourceInstructions"
          name="system_instructions"
          label="Code Generation Instructions"
          tooltip="Custom instructions provided directly to Gemini when generating pipeline source code for this ParquetIO reader step."
          type="textarea"
          rows={3}
          value={systemInstructions}
          onChange={handleInstructionsChange}
          placeholder="e.g. Filter records where status is active, or use specific Avro SpecificRecord model class."
          mono={false}
          className="resize-y h-24"
          helperText="Additional guidance appended to prompt when synthesizing Java/Python code."
        />
      </div>
    </div>
  );
};
