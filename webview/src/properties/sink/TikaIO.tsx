/**
 * TikaIO Sink Properties Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Renders the property configuration panel for Apache Beam TikaIO Sink nodes.
 * 
 * Architectural Decisions:
 * - No Native TikaIO Sink (`beam-sdks-java-io-tika`): Apache Tika is a document extraction/parsing library
 *   and `TikaIO.write()` does not exist. Persisting formatted `ParseResult` strings uses Beam `TextIO.write()`
 *   (or `FileIO.write()`).
 * - Only Verified Writer Properties: Retains `to`, `suffix`, `compression`, `numShards`, and `shardTemplate`
 *   (`.withShardNameTemplate(String)` on `TextIO.Write`). Former unbacked fields (`outputFormat`,
 *   `includeMetadata`, `metadataFields`, `authMode`, `secretName`, `expansionService`) were removed.
 * - Valid `org.apache.beam.sdk.io.Compression` Enum Values: Supports `UNCOMPRESSED`, `GZIP`, `BZIP2`,
 *   `DEFLATE`, and `ZSTD` (`XZ` does not exist in Beam `Compression`).
 * - Dynamic Discovery: Delegates the destination directory/prefix field (`.to`) to the shared `StoragePathField`.
 * - Adheres strictly to the 8pt grid system, VS Code theme variables (`var(--vscode-*)`), and Tailwind CSS.
 */

import React, { useState } from 'react';
import { Sliders } from 'lucide-react';
import { PropertyField } from '../../components/common/PropertyField';
import { CollapsibleSection } from '../../components/common/CollapsibleSection';
import { SelectField } from '../../components/common/SelectField';
import { StoragePathField } from '../../components/common/StoragePathField';

export interface TikaIOSinkNode {
  data: {
    label: string;
    beam_transform?: string;
    system_instructions?: string;
    special_instructions?: string;
    properties?: {
      to?: string;
      suffix?: string;
      compression?: string;
      numShards?: string | number;
      shardTemplate?: string;
      system_instructions?: string;
      special_instructions?: string;
      [key: string]: any;
    };
  };
}

export interface TikaIOSinkPropertiesProps {
  node: TikaIOSinkNode;
  onChange: (properties: any) => void;
}

export const TIKA_SINK_COMPRESSION_TYPES = [
  { value: 'UNCOMPRESSED', label: 'UNCOMPRESSED (Default)' },
  { value: 'GZIP', label: 'GZIP (.gz)' },
  { value: 'BZIP2', label: 'BZIP2 (.bz2)' },
  { value: 'DEFLATE', label: 'DEFLATE / ZLIB' },
  { value: 'ZSTD', label: 'ZSTD (.zst)' }
];

/**
 * TikaIOSinkProperties renders the configuration form for persisting parsed Tika documents via TextIO.write() / FileIO.write().
 */
export const TikaIOSinkProperties: React.FC<TikaIOSinkPropertiesProps> = ({ node, onChange }) => {
  const properties = node.data.properties || {};
  const to = properties.to || '';
  const suffix = properties.suffix ?? '.txt';
  const compression = properties.compression || 'UNCOMPRESSED';
  const numShards = properties.numShards ?? '';
  const shardTemplate = properties.shardTemplate || '';

  const [isAdvancedOpen, setIsAdvancedOpen] = useState<boolean>(false);

  // Validation: destination directory/prefix (.to) is required
  const isToInvalid = !to.trim();

  // System instructions text with fallback cascade
  const systemInstructions =
    node.data.system_instructions ??
    node.data.special_instructions ??
    properties.system_instructions ??
    properties.special_instructions ??
    '';

  /**
   * Handles input, textarea, and select changes for form fields.
   * NOTE: this panel renders no checkbox inputs, so no boolean coercion branch is needed here.
   */
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;

    onChange({
      ...properties,
      [name]: value
    });
  };

  /**
   * Updates AI prompt / system instructions for pipeline code generation
   */
  const handleInstructionsChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    onChange({
      ...properties,
      system_instructions: e.target.value
    });
  };

  /**
   * Toggles the advanced sharding and file naming accordion state
   */
  const handleToggleAdvanced = () => {
    setIsAdvancedOpen((prev) => !prev);
  };

  return (
    <div className="flex-1 flex flex-col gap-4">
      {/* Java Only Notice */}
      <div
        id="tikaSinkNotice"
        data-testid="tika-sink-notice"
        className="flex items-center justify-between gap-2 p-2.5 rounded border border-[var(--vscode-border)] bg-[var(--vscode-subcard-bg)] text-xs text-[var(--vscode-text-secondary)]"
      >
        <span>
          <strong>Java Only:</strong> <code>TikaIO</code> is a Java-only node type (<code>beam-sdks-java-io-tika</code>) and is only supported in Apache Beam Java pipelines.
        </span>
      </div>

      {/* Destination Directory (.to) with Cloud Storage bucket autocomplete */}
      <StoragePathField
        id="tikaSinkTo"
        name="to"
        label="Destination Directory / Prefix (.to)"
        tooltip="Base output directory path or prefix where formatted ParseResult strings will be persisted via TextIO.write().to(...) / FileIO.write().to(...) (e.g. gs://bucket/extracted/). Required."
        value={to}
        onChange={handleChange}
        placeholder="gs://bucket/extracted/"
        errorMessage="Destination Directory is required."
        helperText={
          !isToInvalid ? (
            <span className="text-xs text-[var(--vscode-text-muted)]">
              Target storage prefix across Cloud Storage, Amazon S3, or local filesystems.
            </span>
          ) : null
        }
      />

      {/* Output File Suffix */}
      <PropertyField
        id="tikaSinkSuffix"
        name="suffix"
        label="Output File Suffix (.withSuffix)"
        tooltip="Filename suffix/extension appended to output shard files via TextIO.write().withSuffix(...) or FileIO.write().withSuffix(...) (e.g. .txt, .json). Defaults to .txt."
        value={suffix}
        onChange={handleChange}
        placeholder=".txt"
        mono={true}
        helperText="File extension appended to each shard (e.g. .txt, .json)."
      />

      {/* Compression Codec Select */}
      <SelectField
        id="tikaSinkCompression"
        name="compression"
        label="Compression Codec (.withCompression)"
        tooltip="Compression codec from org.apache.beam.sdk.io.Compression applied to output files."
        value={compression}
        options={TIKA_SINK_COMPRESSION_TYPES}
        onChange={handleChange}
        helperText="Compression applied to written output files."
      />

      {/* Sharding & File Naming Accordion */}
      <CollapsibleSection
        title="Sharding & File Naming"
        icon={<Sliders className="w-4 h-4 text-emerald-400" />}
        isOpen={isAdvancedOpen}
        onToggle={handleToggleAdvanced}
      >
        {/* Number of Shards */}
        <PropertyField
          id="tikaSinkNumShards"
          type="number"
          name="numShards"
          label="Number of Shards (.withNumShards)"
          tooltip="Number of output shard files generated via .withNumShards(int). Set to 0 or leave empty for runner-determined sharding."
          value={numShards}
          onChange={handleChange}
          placeholder="0 (runner-determined)"
          min="0"
          mono={true}
        />

        {/* Shard Template */}
        <PropertyField
          id="tikaSinkShardTemplate"
          name="shardTemplate"
          label="Shard Naming Template (.withShardNameTemplate)"
          tooltip="Pattern for output shard filenames configured via TextIO.write().withShardNameTemplate(String) (e.g. -SSSSS-of-NNNNN). Default is runner-specific."
          value={shardTemplate}
          onChange={handleChange}
          placeholder="-SSSSS-of-NNNNN"
          mono={true}
          helperText="Applied via TextIO.write().withShardNameTemplate(String) (e.g. -SSSSS-of-NNNNN)."
        />
      </CollapsibleSection>

      {/* Code Generation Instructions */}
      <div className="pt-2 border-t border-[var(--vscode-border-light)]">
        <PropertyField
          id="tikaSinkInstructions"
          name="system_instructions"
          label="Code Generation Instructions"
          tooltip="Custom instructions provided directly to Gemini when generating pipeline source code for this sink step."
          type="textarea"
          rows={3}
          value={systemInstructions}
          onChange={handleInstructionsChange}
          placeholder="e.g. Format ParseResult content and metadata as JSON strings and write via TextIO.write()."
          mono={false}
          className="resize-y h-24"
          helperText="Additional guidance appended to prompt when synthesizing Java code."
        />
      </div>
    </div>
  );
};

