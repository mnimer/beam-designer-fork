/**
 * ContextualTextIO Sink Properties Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Renders the property configuration panel for Apache Beam ContextualTextIO Sink nodes.
 * 
 * Architectural Decisions:
 * - Read-Only Library Architecture (`ContextualTextIO.write()` does not exist): `ContextualTextIO` is
 *   a read-only source library in Apache Beam (`beam-sdks-java-io-contextual-text-io`). A `ContextualTextIO`
 *   sink node persists formatted text lines via `TextIO.write()` (Java) / `beam.io.WriteToText` (Python),
 *   where all 8 properties (`to`, `suffix`, `delimiter`, `header`, `footer`, `compression`, `numShards`,
 *   `shardTemplate`) map 1:1. This is surfaced prominently in an inline notice banner matching `TikaIO` sink.
 * - Delegates the destination prefix input (.to) to the shared StoragePathField primitive, which owns Google
 *   Cloud Storage bucket auto-discovery, the `gs://` datalist projection, and the inline
 *   discovery error with role="alert" (surfaced regardless of whether the prefix itself is valid).
 * - Default file suffix is set to '.txt' matching standard text output file expectations.
 * - Uses `char[]` signature in the delimiter tooltip (`.withDelimiter(char[])`), matching `TextIO.Write`.
 * - Groups header/footer controls and sharding configuration into reusable local sub-components.
 * - Supports write-safe compression codecs via `BEAM_WRITE_COMPRESSION_TYPES` (`UNCOMPRESSED`, `BZIP2`,
 *   `GZIP`, `DEFLATE`, `ZSTD`), defaulting to `'UNCOMPRESSED'`. `AUTO` and `ZIP` (which throw
 *   `UnsupportedOperationException` on write in Java) as well as `TAR` and `XZ` are excluded.
 * - No `expansionService` field: `TextIO.write()` and `beam.io.WriteToText` are native transforms in
 *   both Java and Python SDKs.
 * - Adheres strictly to the 8pt grid system, VS Code theme variables (`var(--vscode-*)`), and Tailwind CSS classes.
 */

import React from 'react';
import { InfoTooltip } from '../../components/InfoTooltip';
import { PropertyField } from '../../components/common/PropertyField';
import { StoragePathField } from '../../components/common/StoragePathField';
import { BEAM_WRITE_COMPRESSION_TYPES } from '../source/FileIO';

export interface ContextualTextIOSinkNode {
  data: {
    label: string;
    beam_transform?: string;
    system_instructions?: string;
    special_instructions?: string;
    properties?: {
      to?: string;
      suffix?: string;
      delimiter?: string;
      header?: string;
      footer?: string;
      compression?: string;
      numShards?: string | number;
      shardTemplate?: string;
      system_instructions?: string;
      special_instructions?: string;
      [key: string]: any;
    };
  };
}

export interface ContextualTextIOSinkPropertiesProps {
  node: ContextualTextIOSinkNode;
  onChange: (properties: any) => void;
}

/**
 * Sub-component for configuring optional file header and footer text lines.
 */
interface ContextualTextSinkHeaderFooterProps {
  header?: string;
  footer?: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}

const ContextualTextSinkHeaderFooterFields: React.FC<ContextualTextSinkHeaderFooterProps> = ({
  header = '',
  footer = '',
  onChange
}) => {
  return (
    <div className="flex flex-col gap-3">
      <PropertyField
        id="contextualTextSinkHeader"
        name="header"
        label="Header Line (Optional)"
        tooltip="Text written once at the beginning of each output file shard via TextIO.write().withHeader(String) in Java or WriteToText(..., header=...) in Python."
        value={header}
        onChange={onChange}
        placeholder="header1,header2,header3"
      />
      <PropertyField
        id="contextualTextSinkFooter"
        name="footer"
        label="Footer Line (Optional)"
        tooltip="Text written once at the end of each output file shard via TextIO.write().withFooter(String) in Java or WriteToText(..., footer=...) in Python."
        value={footer}
        onChange={onChange}
        placeholder="--- EOF ---"
      />
    </div>
  );
};

/**
 * Sub-component for configuring output file sharding parameters (numShards, shardTemplate).
 */
interface ContextualTextSinkShardingProps {
  numShards?: string | number;
  shardTemplate?: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}

const ContextualTextSinkShardingFields: React.FC<ContextualTextSinkShardingProps> = ({
  numShards = '',
  shardTemplate = '',
  onChange
}) => {
  return (
    <div className="flex flex-col gap-3 p-3 bg-[var(--vscode-subcard-bg)] rounded border border-[var(--vscode-border)]">
      <span className="text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
        Sharding Configuration
      </span>
      <PropertyField
        id="contextualTextSinkNumShards"
        name="numShards"
        label="Number of Shards"
        tooltip="Fixed number of output shards to write (.withNumShards(int) / num_shards). Set to 0 or leave empty for runner-determined sharding."
        type="number"
        min="0"
        value={numShards}
        onChange={onChange}
        placeholder="0 (Runner Determined)"
        mono={true}
      />
      <PropertyField
        id="contextualTextSinkShardTemplate"
        name="shardTemplate"
        label="Shard Name Template (Optional)"
        tooltip="Custom template for shard naming (.withShardNameTemplate(String) / shard_name_template, e.g. -SSSSS-of-NNNNN). Leave blank for default."
        value={shardTemplate}
        onChange={onChange}
        placeholder="-SSSSS-of-NNNNN"
        mono={true}
      />
    </div>
  );
};

/**
 * ContextualTextIOSinkProperties renders the property configuration form for persisting
 * formatted text lines via TextIO.write() (Java) / beam.io.WriteToText (Python).
 */
export const ContextualTextIOSinkProperties: React.FC<ContextualTextIOSinkPropertiesProps> = ({
  node,
  onChange
}) => {
  const properties = node.data.properties || {};
  const to = properties.to || '';
  const suffix = properties.suffix ?? '.txt';
  const delimiter = properties.delimiter || '';
  const header = properties.header || '';
  const footer = properties.footer || '';
  const compression =
    properties.compression && (BEAM_WRITE_COMPRESSION_TYPES as readonly string[]).includes(properties.compression)
      ? properties.compression
      : 'UNCOMPRESSED';
  const numShards = properties.numShards ?? '';
  const shardTemplate = properties.shardTemplate || '';

  // Validation: destination path prefix (.to) is required.
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
   * Handles text, number, and select input updates.
   *
   * @param e Form change event from input, select, or textarea
   */
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
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
  const handleInstructionsChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    onChange({
      ...properties,
      system_instructions: e.target.value
    });
  };

  return (
    <div className="flex-1 flex flex-col gap-4">
      {/* Java Only Notice */}
      <div
        id="contextualTextSinkNotice"
        data-testid="contextual-text-sink-notice"
        className="flex items-center justify-between gap-2 p-2.5 rounded border border-[var(--vscode-border)] bg-[var(--vscode-subcard-bg)] text-xs text-[var(--vscode-text-secondary)]"
      >
        <span>
          <strong>Java Only:</strong> <code>ContextualTextIO</code> is a Java-only node type (<code>beam-sdks-java-io-contextual-text-io</code>) and is only supported in Apache Beam Java pipelines.
        </span>
      </div>

      {/* Destination File Prefix / Path (.to) with GCS Bucket Datalist */}
      <StoragePathField
        id="contextualTextSinkTo"
        name="to"
        label="Destination File Prefix (.to)"
        tooltip="File prefix or path where output shards will be written via TextIO.write().to(...) / WriteToText(...) (e.g. gs://my-bucket/output/data or /local/path/output). Required."
        value={to}
        onChange={handleChange}
        placeholder="gs://my-bucket/output/results or /local/out/file"
        errorMessage="Destination file prefix is required."
        helperText={
          !isToInvalid ? (
            <span className="text-xs text-[var(--vscode-text-muted)]">
              Output prefix for shards (e.g. gs://bucket/output/data).
            </span>
          ) : null
        }
      />

      {/* File Suffix / Extension */}
      <PropertyField
        id="contextualTextSinkSuffix"
        name="suffix"
        label="File Suffix / Extension"
        tooltip="File extension or suffix added to each output shard via .withSuffix(String) / file_name_suffix (e.g. .txt, .csv, .log). Defaults to .txt."
        value={suffix}
        onChange={handleChange}
        placeholder=".txt"
        mono={true}
      />

      {/* Custom Delimiter */}
      <PropertyField
        id="contextualTextSinkDelimiter"
        name="delimiter"
        label="Record Delimiter (Optional)"
        tooltip="Custom character delimiter separating written records (default is newline '\n'). Passed to .withDelimiter(char[]) on TextIO.Write in Java."
        value={delimiter}
        onChange={handleChange}
        placeholder="\n (Default newline)"
        mono={true}
      />

      {/* Compression Algorithm Select */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="contextualTextSinkCompression"
          className="flex items-center text-xs font-bold uppercase text-[var(--vscode-text-muted)] gap-1.5"
        >
          <span>Compression</span>
          <InfoTooltip text="Compression codec applied when writing output shards (.withCompression(Compression) / compression_type): UNCOMPRESSED, BZIP2, GZIP, DEFLATE, or ZSTD." />
        </label>
        <select
          id="contextualTextSinkCompression"
          name="compression"
          value={compression}
          onChange={handleChange}
          className="bg-[var(--vscode-input-bg)] text-[var(--vscode-text-primary)] p-2 rounded border border-[var(--vscode-border)] text-sm focus:outline-none focus:border-[var(--vscode-highlight)] font-mono"
        >
          {BEAM_WRITE_COMPRESSION_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </div>

      {/* Header and Footer Controls */}
      <ContextualTextSinkHeaderFooterFields
        header={header}
        footer={footer}
        onChange={handleChange}
      />

      {/* Sharding Group */}
      <ContextualTextSinkShardingFields
        numShards={numShards}
        shardTemplate={shardTemplate}
        onChange={handleChange}
      />

      {/* Flexible Spacer */}
      <div className="flex-1 min-h-4" />

      {/* Code Generation Instructions */}
      <div className="flex flex-col gap-2 pt-2 border-t border-[var(--vscode-border-light)]">
        <PropertyField
          id="contextualTextSinkSystemInstructions"
          name="system_instructions"
          label="Code Generation Instructions"
          type="textarea"
          value={systemInstructions}
          onChange={handleInstructionsChange}
          placeholder="Enter custom instructions for TextIO.write() / WriteToText sink code generation..."
          rows={3}
          mono={false}
          helperText="Additional guidance appended to prompt when synthesizing Java/Python code."
        />
      </div>
    </div>
  );
};
