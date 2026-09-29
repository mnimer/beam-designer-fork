/**
 * JsonIO Sink Properties Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Renders the property configuration panel for Apache Beam JsonIO Sink nodes
 * (e.g. org.apache.beam.sdk.io.json.JsonIO.writeRows(to) in Java
 * or apache_beam.io.textio.WriteToJson(path, lines=True, num_shards=..., ...) in Python).
 * 
 * Architectural Decisions:
 * - JsonIO write operations require a destination directory or file path prefix (.to(...)).
 * - Delegates the destination path input to the shared StoragePathField primitive, which owns Google
 *   Cloud Storage bucket auto-discovery, the `gs://` datalist projection, and the inline
 *   discovery error (surfaced regardless of whether the path itself is valid).
 * - Documents that Java `JsonIO.writeRows(to)` is unconditionally newline-delimited JSON (`lines=true`)
 *   and supports `.withCompression(Compression)`, whereas Python `WriteToJson` honors `lines` and `orient`
 *   (and does not accept a `compression` kwarg).
 * - Configures file naming suffix (default .json).
 * - Composes the shared SelectField primitive instead of redeclaring dropdown markup, exposing
 *   supported Beam Java Compression codecs (UNCOMPRESSED, GZIP, BZIP2, DEFLATE, ZSTD — `XZ` is omitted
 *   because `Compression.java` does not implement XZ) and sharding options (numShards, shardTemplate).
 * - Extracts sharding controls into a reusable local sub-component.
 * - Adheres strictly to the 8pt grid system, VS Code theme variables, and Tailwind CSS classes.
 */

import React from 'react';
import { InfoTooltip } from '../../components/InfoTooltip';
import { PropertyField } from '../../components/common/PropertyField';
import { SelectField } from '../../components/common/SelectField';
import { StoragePathField } from '../../components/common/StoragePathField';

export interface JsonIOSinkNode {
  data: {
    label: string;
    beam_transform?: string;
    system_instructions?: string;
    special_instructions?: string;
    properties?: {
      to?: string;
      suffix?: string;
      lines?: boolean;
      compression?: string;
      numShards?: string | number;
      shardTemplate?: string;
      system_instructions?: string;
      special_instructions?: string;
      [key: string]: any;
    };
  };
}

export interface JsonIOSinkPropertiesProps {
  node: JsonIOSinkNode;
  onChange: (properties: any) => void;
}

/**
 * Supported compression algorithms for JSON output files (Java JsonIO.Write.withCompression).
 * Note: 'XZ' is omitted because org.apache.beam.sdk.io.Compression does not include XZ.
 */
export const JSON_SINK_COMPRESSION_TYPES = [
  { value: 'UNCOMPRESSED', label: 'UNCOMPRESSED (Standard JSON)' },
  { value: 'GZIP', label: 'GZIP (.gz)' },
  { value: 'BZIP2', label: 'BZIP2 (.bz2)' },
  { value: 'DEFLATE', label: 'DEFLATE' },
  { value: 'ZSTD', label: 'ZSTD' }
] as const;

/**
 * Sub-component for JsonIO sink sharding controls (numShards, shardTemplate).
 */
interface JsonSinkShardingProps {
  numShards?: string | number;
  shardTemplate?: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}

const JsonSinkShardingFields: React.FC<JsonSinkShardingProps> = ({
  numShards = '',
  shardTemplate = '',
  onChange
}) => {
  return (
    <div className="flex flex-col gap-3 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border)]">
      <span className="text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
        Sharding & File Output
      </span>
      <PropertyField
        id="jsonSinkNumShards"
        type="number"
        name="numShards"
        label="Number of Shards"
        tooltip="Fixed number of output shards. Set to 0 or leave empty to let the Beam runner determine sharding dynamically."
        value={numShards}
        onChange={onChange}
        placeholder="0 (Automatic)"
        min="0"
        mono={true}
        helperText="0 or empty lets the runner automatically size output shards."
      />

      <PropertyField
        id="jsonSinkShardTemplate"
        name="shardTemplate"
        label="Shard Name Template (Optional)"
        tooltip="Custom template for shard naming (e.g. -SSSSS-of-NNNNN). Leave blank for Beam standard default."
        value={shardTemplate}
        onChange={onChange}
        placeholder="-SSSSS-of-NNNNN"
        mono={true}
      />
    </div>
  );
};

/**
 * JsonIOSinkProperties renders the property configuration form for JsonIO writes.
 */
export const JsonIOSinkProperties: React.FC<JsonIOSinkPropertiesProps> = ({ node, onChange }) => {
  const properties = node.data.properties || {};
  const to = properties.to || '';
  const suffix = properties.suffix ?? '.json';
  const lines = properties.lines ?? true;
  const compression = properties.compression || 'UNCOMPRESSED';
  const numShards = properties.numShards ?? '';
  const shardTemplate = properties.shardTemplate || '';

  // Validation: destination directory/prefix (.to) is required.
  // NOTE: mirrors StoragePathField's own rule; used here only to gate the helper text.
  const isToInvalid = !to.trim();

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
      {/* Destination Directory (.to) Input with GCS Bucket Datalist */}
      <StoragePathField
        id="jsonSinkTo"
        name="to"
        label="Destination Directory / Prefix (.to)"
        tooltip="Base output directory path or prefix where JSON files will be written (e.g. gs://bucket/output/, s3://bucket/output/, or /local/output/). Required."
        value={to}
        onChange={handleChange}
        placeholder="gs://bucket/output/, s3://bucket/output/, or /local/output/"
        errorMessage="Destination Directory is required."
        helperText={
          !isToInvalid ? (
            <span className="text-xs text-[var(--vscode-text-muted)]">
              Target storage prefix across Cloud Storage, Amazon S3, HDFS, or local storage.
            </span>
          ) : null
        }
      />

      {/* File Suffix Input */}
      <PropertyField
        id="jsonSinkSuffix"
        name="suffix"
        label="File Name Suffix"
        tooltip="File extension appended to each shard (e.g. .json or .jsonl). Defaults to .json."
        value={suffix}
        onChange={handleChange}
        placeholder=".json"
        mono={true}
      />

      {/* Output Format Settings */}
      <div className="flex flex-col gap-3 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border)]">
        <span className="text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          JSON Output Format
        </span>

        {/* Lines Checkbox */}
        <div className="flex flex-col gap-1">
          <label htmlFor="jsonSinkLines" className="flex items-center gap-2 cursor-pointer">
            <input
              id="jsonSinkLines"
              type="checkbox"
              name="lines"
              checked={lines}
              onChange={handleChange}
              className="rounded bg-[var(--vscode-input-bg)] border-[var(--vscode-border)] text-blue-500 focus:ring-0 focus:ring-offset-0"
            />
            <span className="text-xs text-[var(--vscode-text-secondary)]">Newline-delimited JSON Lines (lines=True)</span>
            <InfoTooltip text="Java JsonIO.writeRows(to) is unconditionally newline-delimited JSON (lines=true). Python WriteToJson honors lines and orient." />
          </label>
          <span className="text-[11px] text-[var(--vscode-text-muted)] pl-6">
            Java <code>JsonIO.writeRows(to)</code> is unconditionally newline-delimited JSON (<code>lines=true</code>); Python <code>WriteToJson</code> honors <code>lines</code> and <code>orient</code>.
          </span>
        </div>

        {/* Compression Codec Dropdown */}
        <SelectField
          id="jsonSinkCompression"
          name="compression"
          label="Compression Codec"
          tooltip="Java JsonIO.writeRows(to) supports .withCompression(Compression). Python WriteToJson does not accept a compression kwarg (raises NotImplementedError)."
          value={compression}
          onChange={handleChange}
          options={[...JSON_SINK_COMPRESSION_TYPES]}
          helperText={
            <span>
              Java <code>JsonIO.writeRows(to)</code> supports <code>.withCompression(Compression)</code>; Python <code>WriteToJson</code> does not accept a <code>compression</code> kwarg.
            </span>
          }
        />
      </div>

      {/* Sharding Configuration */}
      <JsonSinkShardingFields
        numShards={numShards}
        shardTemplate={shardTemplate}
        onChange={handleChange}
      />

      {/* Code Generation Instructions */}
      <div className="pt-2 border-t border-[var(--vscode-border-light)]">
        <PropertyField
          id="jsonSinkInstructions"
          name="system_instructions"
          label="Code Generation Instructions"
          tooltip="Custom instructions provided directly to Gemini when generating pipeline source code for this JsonIO writer step."
          type="textarea"
          rows={3}
          value={systemInstructions}
          onChange={handleInstructionsChange}
          placeholder="e.g. Format output as JSON Lines using UTF-8 encoding with GZIP compression."
          mono={false}
          className="resize-y h-24"
          helperText="Additional guidance appended to prompt when synthesizing Java/Python code."
        />
      </div>
    </div>
  );
};
