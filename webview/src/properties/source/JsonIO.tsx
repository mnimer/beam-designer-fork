/**
 * JsonIO Source Properties Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Renders the property configuration panel for Apache Beam JSON Source nodes
 * (Java reads via org.apache.beam.sdk.io.TextIO.read().from(...) + org.apache.beam.sdk.transforms.JsonToRow.withSchema(schema)
 * since JsonIO is write-only in Java; Python reads via apache_beam.io.textio.ReadFromJson(path, lines=True, ...)).
 * 
 * Architectural Decisions:
 * - JSON read operations require a target file or glob pattern (.from(...) / path).
 * - Delegates the file pattern input to the shared StoragePathField primitive, which owns Google
 *   Cloud Storage bucket auto-discovery, the `gs://` datalist projection, and the inline
 *   discovery error (surfaced regardless of whether the path itself is valid).
 * - Documents that Java `TextIO.read()` + `JsonToRow` is always newline-delimited JSON (`lines=true`)
 *   and honors `TextIO.read().withCompression(...)`, whereas Python `ReadFromJson` supports `lines`
 *   and auto-detects decompression by file extension (`compression` kwarg is not accepted by `ReadFromJson`).
 * - Exposes supported Beam Java `Compression` values (`AUTO`, `UNCOMPRESSED`, `GZIP`, `BZIP2`, `DEFLATE`, `ZSTD` —
 *   `XZ` is omitted because `Compression.java` does not implement XZ).
 * - Provides a `Schema Configuration (Java TextIO + JsonToRow.withSchema(schema))` accordion with a 1-click
 *   sample schema generator (correcting the former non-existent `JsonIO.readRows(schema)` citation).
 * - Omits unroutable `minBundleSize` and `validate` controls.
 * - Extracts JSON parsing controls into a reusable local sub-component.
 * - Adheres strictly to the 8pt grid system, VS Code theme variables, and Tailwind CSS classes.
 */

import React, { useState } from 'react';
import { InfoTooltip } from '../../components/InfoTooltip';
import { PropertyField } from '../../components/common/PropertyField';
import { CollapsibleSection } from '../../components/common/CollapsibleSection';
import { SelectField } from '../../components/common/SelectField';
import { StoragePathField } from '../../components/common/StoragePathField';
import { FileCode, Sparkles } from 'lucide-react';

export interface JsonIOSourceNode {
  data: {
    label: string;
    beam_transform?: string;
    system_instructions?: string;
    special_instructions?: string;
    properties?: {
      filePattern?: string;
      lines?: boolean;
      compression?: string;
      schema?: string;
      system_instructions?: string;
      special_instructions?: string;
      [key: string]: any;
    };
  };
}

export interface JsonIOSourcePropertiesProps {
  node: JsonIOSourceNode;
  onChange: (properties: any) => void;
}

/**
 * Supported decompression algorithms for reading JSON files (Java TextIO.Read.withCompression).
 * Note: 'XZ' is omitted because org.apache.beam.sdk.io.Compression does not include XZ.
 */
export const JSON_SOURCE_COMPRESSION_TYPES = [
  { value: 'AUTO', label: 'AUTO (Detect from file extension)' },
  { value: 'UNCOMPRESSED', label: 'UNCOMPRESSED (Standard JSON)' },
  { value: 'GZIP', label: 'GZIP (.gz)' },
  { value: 'BZIP2', label: 'BZIP2 (.bz2)' },
  { value: 'DEFLATE', label: 'DEFLATE' },
  { value: 'ZSTD', label: 'ZSTD' }
] as const;

/**
 * Sample Beam Schema representing structured typed records parsed from JSON objects.
 */
const SAMPLE_JSON_SCHEMA = JSON.stringify(
  {
    fields: [
      { name: 'id', type: 'STRING' },
      { name: 'name', type: 'STRING' },
      { name: 'email', type: 'STRING' },
      { name: 'amount', type: 'DOUBLE' },
      { name: 'timestamp', type: 'INT64' }
    ]
  },
  null,
  2
);

/**
 * Sub-component for JSON parsing controls (lines toggle and compression dropdown).
 */
interface JsonSourceFormatProps {
  lines: boolean;
  compression: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
}

const JsonSourceFormatFields: React.FC<JsonSourceFormatProps> = ({
  lines,
  compression,
  onChange
}) => {
  return (
    <div className="flex flex-col gap-3 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border)]">
      <span className="text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
        JSON Parsing Settings
      </span>

      {/* JSON Lines Checkbox */}
      <div className="flex flex-col gap-1">
        <label htmlFor="jsonSourceLines" className="flex items-center gap-2 cursor-pointer">
          <input
            id="jsonSourceLines"
            type="checkbox"
            name="lines"
            checked={lines}
            onChange={onChange}
            className="rounded bg-[var(--vscode-input-bg)] border-[var(--vscode-border)] text-blue-500 focus:ring-0 focus:ring-offset-0"
          />
          <span className="text-xs text-[var(--vscode-text-secondary)]">Newline-delimited JSON Lines (lines=True)</span>
          <InfoTooltip text="Java TextIO.read() + JsonToRow is always newline-delimited JSON (lines=true). Python ReadFromJson supports lines (True for JSON Lines, False for whole-file JSON array)." />
        </label>
        <span className="text-[11px] text-[var(--vscode-text-muted)] pl-6">
          Java <code>TextIO.read()</code> + <code>JsonToRow</code> is always newline-delimited JSON (<code>lines=true</code>); Python <code>ReadFromJson</code> supports <code>lines</code>.
        </span>
      </div>

      {/* Compression Codec Dropdown */}
      <SelectField
        id="jsonSourceCompression"
        name="compression"
        label="Decompression (.withCompression)"
        tooltip="Java TextIO.read().withCompression(...) honors the selected Compression codec. Python ReadFromJson auto-detects decompression by file extension (compression kwarg is not accepted by ReadFromJson)."
        value={compression}
        onChange={onChange}
        options={[...JSON_SOURCE_COMPRESSION_TYPES]}
        helperText={
          <span>
            Honored by Java <code>TextIO.read().withCompression(...)</code>; Python <code>ReadFromJson</code> auto-detects decompression by file extension (<code>compression</code> kwarg is not accepted by <code>ReadFromJson</code>).
          </span>
        }
      />
    </div>
  );
};

/**
 * JsonIOSourceProperties renders the property configuration form for JsonIO reads.
 */
export const JsonIOSourceProperties: React.FC<JsonIOSourcePropertiesProps> = ({ node, onChange }) => {
  const properties = node.data.properties || {};
  const filePattern = properties.filePattern || '';
  const lines = properties.lines ?? true;
  const compression = properties.compression || 'AUTO';
  const schema = properties.schema || '';

  const [isSchemaOpen, setIsSchemaOpen] = useState<boolean>(true);

  // Validation: filePattern is required for reading JSON files.
  // NOTE: mirrors StoragePathField's own rule; used here only to gate the helper text.
  const isInvalid = !filePattern.trim();

  // System instructions text with fallback
  const systemInstructions =
    node.data.system_instructions ??
    node.data.special_instructions ??
    properties.system_instructions ??
    properties.special_instructions ??
    '';

  /**
   * Handles form input changes for text, select, and checkbox fields.
   *
   * @param e Form change event from input, select, or textarea
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
   * Inserts a sample Beam Schema definition into the schema field.
   */
  const handleInsertSampleSchema = () => {
    onChange({
      ...properties,
      schema: SAMPLE_JSON_SCHEMA
    });
  };

  /**
   * Updates AI prompt / system instructions for code synthesis.
   *
   * @param e Form change event from textarea
   */
  const handleInstructionsChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    onChange({
      ...properties,
      system_instructions: e.target.value
    });
  };

  return (
    <div className="flex-1 flex flex-col gap-4">
      {/* File Pattern Input with GCS Bucket Datalist */}
      <StoragePathField
        id="jsonSourceFilePattern"
        name="filePattern"
        label="File Pattern / Path (.from)"
        tooltip="Target JSON file path or glob pattern (e.g. gs://bucket/*.json, s3://bucket/*.json, or /local/*.json). Required."
        value={filePattern}
        onChange={handleChange}
        placeholder="gs://bucket/data/*.json, s3://bucket/data/*.json, or /local/*.json"
        errorMessage="File Pattern is required."
        helperText={
          !isInvalid ? (
            <span className="text-xs text-[var(--vscode-text-muted)]">
              Target file or glob pattern across Cloud Storage, Amazon S3, HDFS, or local storage.
            </span>
          ) : null
        }
      />

      {/* JSON Parsing Settings (lines toggle and compression dropdown) */}
      <JsonSourceFormatFields
        lines={lines}
        compression={compression}
        onChange={handleChange}
      />

      {/* Schema Accordion Section */}
      <CollapsibleSection
        title="Schema Configuration (Java TextIO + JsonToRow.withSchema(schema))"
        icon={<FileCode className="w-4 h-4 text-emerald-400" />}
        isOpen={isSchemaOpen}
        onToggle={() => setIsSchemaOpen(!isSchemaOpen)}
      >
        <p className="text-[11px] text-[var(--vscode-text-muted)] mt-1">
          <code>JsonIO</code> is write-only in Beam Java; Java reads via <code>TextIO.read().from(...)</code> + <code>JsonToRow.withSchema(schema)</code>, while Python uses <code>apache_beam.io.textio.ReadFromJson</code>.
        </p>
        <div className="flex justify-between items-center mt-2">
          <label htmlFor="jsonSourceSchema" className="text-[11px] font-semibold text-[var(--vscode-text-muted)] flex items-center gap-1.5">
            <span>Beam Schema Definition (Field names and types)</span>
            <InfoTooltip text="In Java, TextIO.read().from(...) + JsonToRow.withSchema(schema) requires a Beam Schema to parse JSON lines into PCollection<Row>. In Python, ReadFromJson(dtype=...) maps field types via pandas." />
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
          id="jsonSourceSchema"
          name="schema"
          value={schema}
          onChange={handleChange}
          rows={4}
          placeholder='{"fields": [{"name": "id", "type": "STRING"}, ...]}'
          className="bg-[var(--vscode-input-bg)] text-[var(--vscode-text-primary)] p-2 rounded border border-[var(--vscode-border)] text-xs focus:outline-none focus:border-[var(--vscode-highlight)] font-mono resize-y"
        />
        <span className="text-[11px] text-[var(--vscode-text-muted)]">
          Specify Beam Schema JSON or field type definitions for schema-aware row decoding.
        </span>
      </CollapsibleSection>

      {/* Code Generation Instructions */}
      <div className="pt-2 border-t border-[var(--vscode-border-light)]">
        <PropertyField
          id="jsonSourceInstructions"
          name="system_instructions"
          label="Code Generation Instructions"
          tooltip="Custom instructions provided directly to Gemini when generating pipeline source code for this JSON reader step."
          type="textarea"
          rows={3}
          value={systemInstructions}
          onChange={handleInstructionsChange}
          placeholder="e.g. Parse JSON into custom POJO/Row coder, handle malformed lines, or configure custom date format."
          mono={false}
          className="resize-y h-24"
          helperText="Additional guidance appended to prompt when synthesizing Java/Python code."
        />
      </div>
    </div>
  );
};
