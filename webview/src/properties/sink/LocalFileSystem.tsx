/**
 * LocalFileSystem Sink Properties Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Renders the property configuration panel for Apache Beam LocalFileSystem Sink nodes
 * (e.g. TextIO.write().to(...) / FileIO.write().to(...) writing shards to worker-local disk paths
 * or file:// URIs in Java and Python pipelines).
 * 
 * Architectural Decisions:
 * - Unlike cloud file connectors, LocalFileSystem targets worker-local POSIX paths and file:// URIs.
 * - Deliberate deviation: useAssetLoader('storageBuckets') is NOT called because Cloud Storage buckets
 *   are irrelevant to local disk paths. Instead, static datalist path templates (/data/output/results,
 *   /tmp/beam/output/out, ./output/results, file:///var/data/output/processed) are provided.
 * - Prominent warning documentation and helper text caution users that local filesystem paths resolve
 *   strictly on each worker node's local disk, making LocalFileSystem primarily appropriate for
 *   DirectRunner or shared network volumes (NFS/SMB) rather than distributed runners (Dataflow, Flink, Spark)
 *   where output shards would land scattered across worker machines.
 * - Supports configurable writer formats: TextIO (plain text lines), AvroIO (Avro records),
 *   ParquetIO (columnar tables), and FileIO (raw file streams/matches).
 * - Automatic Directory Creation & Worker Umask (NO createDirectories or filePermissions fields):
 *   Beam's LocalFileSystem creates parent directories unconditionally (Files.createDirectories in Java,
 *   os.makedirs(..., exist_ok=True) in Python) and exposes no file-permission (chmod) API in either SDK.
 *   Both controls were removed rather than defaulted.
 * - Exposes sharding controls (numShards, shardTemplate) inside a collapsible accordion.
 * - Decomposes repeated accordion and select markup into reusable CollapsibleSection and SelectField helper components.
 * - Adheres strictly to the 8pt grid system, VS Code theme variables, and Tailwind CSS.
 */

import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Sliders } from 'lucide-react';
import { InfoTooltip } from '../../components/InfoTooltip';
import { PropertyField } from '../../components/common/PropertyField';

export interface LocalFileSystemSinkNode {
  data: {
    label: string;
    beam_transform?: string;
    system_instructions?: string;
    special_instructions?: string;
    properties?: {
      to?: string;
      suffix?: string;
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

export interface LocalFileSystemSinkPropertiesProps {
  node: LocalFileSystemSinkNode;
  onChange: (properties: any) => void;
}

export const LOCAL_SINK_PATH_SUGGESTIONS = [
  '/data/output/results',
  '/tmp/beam/output/out',
  './output/results',
  'file:///var/data/output/processed',
  '/var/log/archive/output'
];

export const LOCAL_SINK_FILE_FORMATS = [
  { value: 'TextIO', label: 'TextIO (Plain text / lines)' },
  { value: 'AvroIO', label: 'AvroIO (Avro binary records)' },
  { value: 'ParquetIO', label: 'ParquetIO (Apache Parquet columnar)' },
  { value: 'FileIO', label: 'FileIO (Generic file streams / binary)' }
];

export const LOCAL_SINK_COMPRESSION_TYPES = [
  { value: 'UNCOMPRESSED', label: 'UNCOMPRESSED (Default)' },
  { value: 'GZIP', label: 'GZIP (.gz)' },
  { value: 'BZIP2', label: 'BZIP2 (.bz2)' },
  { value: 'DEFLATE', label: 'DEFLATE / ZLIB' },
  { value: 'ZSTD', label: 'ZSTD (.zst)' }
];

interface CollapsibleSectionProps {
  title: string;
  icon?: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

/**
 * Reusable collapsible section component conforming to the 8pt grid
 * and standard VS Code theme tokens.
 */
const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  icon,
  isOpen,
  onToggle,
  children
}) => {
  return (
    <div className="border border-[var(--vscode-border)] rounded-md bg-[var(--vscode-subcard-bg)] overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 text-xs font-bold uppercase text-[var(--vscode-text-primary)] hover:bg-[var(--vscode-hover)] transition-colors"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span>{title}</span>
        </div>
        {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>

      {isOpen && (
        <div className="p-3 pt-0 flex flex-col gap-3 border-t border-[var(--vscode-border-light)] mt-2">
          {children}
        </div>
      )}
    </div>
  );
};

interface SelectFieldProps {
  id: string;
  name: string;
  label: string;
  tooltip?: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  helperText?: React.ReactNode;
}

/**
 * Standardized dropdown select field conforming to theme styling.
 */
const SelectField: React.FC<SelectFieldProps> = ({
  id,
  name,
  label,
  tooltip,
  value,
  options,
  onChange,
  helperText
}) => {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className="flex items-center text-xs font-bold uppercase text-[var(--vscode-text-muted)] gap-1.5"
      >
        <span>{label}</span>
        {tooltip && <InfoTooltip text={tooltip} />}
      </label>
      <select
        id={id}
        name={name}
        value={value}
        onChange={onChange}
        className="bg-[var(--vscode-input-bg)] text-[var(--vscode-text-primary)] p-2 rounded border border-[var(--vscode-border)] text-sm focus:outline-none focus:border-[var(--vscode-highlight)] font-mono"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {helperText && (
        <span className="text-[11px] text-[var(--vscode-text-muted)]">
          {helperText}
        </span>
      )}
    </div>
  );
};

/**
 * LocalFileSystemSinkProperties renders the property configuration form for LocalFileSystem writes.
 */
export const LocalFileSystemSinkProperties: React.FC<LocalFileSystemSinkPropertiesProps> = ({ node, onChange }) => {
  const properties = node.data.properties || {};
  const to = properties.to || '';
  const suffix = properties.suffix ?? '';
  const format = properties.format || 'TextIO';
  const compression = properties.compression || 'UNCOMPRESSED';
  const numShards = properties.numShards ?? '';
  const shardTemplate = properties.shardTemplate || '';

  const [isShardingOpen, setIsShardingOpen] = useState<boolean>(false);

  // NOTE: Deliberately no useAssetLoader('storageBuckets') call here, as local filesystem paths
  // resolve against local disks rather than cloud object storage buckets.
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
   * Handles generic input and select changes for form fields.
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
   * Updates AI prompt / system instructions
   */
  const handleInstructionsChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    onChange({
      ...properties,
      system_instructions: e.target.value
    });
  };

  /**
   * Toggles the sharding accordion state
   */
  const handleToggleSharding = () => {
    setIsShardingOpen((prev) => !prev);
  };

  return (
    <div className="flex-1 flex flex-col gap-4">
      {/* Destination Directory (.to) Input */}
      <PropertyField
        id="localSinkTo"
        name="to"
        label="Destination Directory / Prefix (.to)"
        required="Destination Directory is required."
        tooltip="Local destination directory path or file prefix where shards will be written (e.g. /data/output/results or file:///data/output/results). Note: Local paths resolve on each worker's own local filesystem; in distributed runners (Dataflow, Flink, Spark), output shards land scattered across workers. LocalFileSystem is primarily intended for DirectRunner or a shared network mount."
        aria-required="true"
        aria-invalid={isToInvalid}
        value={to}
        onChange={handleChange}
        placeholder="/data/output/results or file:///data/output/results"
        invalid={isToInvalid}
        error={isToInvalid ? 'Destination Directory is required.' : null}
        mono={true}
        list="local-sink-path-options"
        datalist={LOCAL_SINK_PATH_SUGGESTIONS}
        helperText={
          <span className="text-xs text-[var(--vscode-text-muted)]">
            Warning: Local paths resolve on each worker&apos;s own filesystem. With distributed runners (Dataflow, Flink, Spark), output shards land scattered across workers; LocalFileSystem is primarily intended for DirectRunner or a shared network mount.
          </span>
        }
      />

      {/* File Suffix Input */}
      <PropertyField
        id="localSinkSuffix"
        name="suffix"
        label="File Name Suffix"
        tooltip="File extension appended to each shard (e.g. .csv, .txt, .json)."
        value={suffix}
        onChange={handleChange}
        placeholder=".txt"
        mono={true}
      />

      {/* Writer Format Select */}
      <SelectField
        id="localSinkFormat"
        name="format"
        label="File Format / Writer"
        tooltip="Underlying Beam I/O writer transform wrapping the local filesystem output (e.g. TextIO for lines, AvroIO for schemas, ParquetIO for columnar data, or FileIO for raw streams)."
        value={format}
        options={LOCAL_SINK_FILE_FORMATS}
        onChange={handleChange}
        helperText={
          <span>
            Beam writer transform used to encode local output files. Defaults to <code>TextIO</code>.
          </span>
        }
      />

      {/* Compression Select */}
      <SelectField
        id="localSinkCompression"
        name="compression"
        label="Compression"
        tooltip="Compression algorithm applied to output files. Defaults to UNCOMPRESSED."
        value={compression}
        options={LOCAL_SINK_COMPRESSION_TYPES}
        onChange={handleChange}
      />

      {/* Sharding & Output Options Accordion */}
      <CollapsibleSection
        title="Sharding & Shard Template Options"
        icon={<Sliders className="w-4 h-4 text-emerald-400" />}
        isOpen={isShardingOpen}
        onToggle={handleToggleSharding}
      >
        {/*
          Replaces the former "Create parent directories automatically" checkbox and
          "File Permissions" input. Beam's LocalFileSystem creates parent directories unconditionally
          (Files.createDirectories in Java / os.makedirs(..., exist_ok=True) in Python) and has no
          chmod API in either SDK.
        */}
        <p className="text-[11px] text-[var(--vscode-text-muted)] mt-1">
          Parent directories are <strong>created automatically</strong> (<code>Files.createDirectories</code> in Java / <code>os.makedirs(..., exist_ok=True)</code> in Python), and output shard modes follow the worker process <code>umask</code>. Neither behaviour is configurable through Beam.
        </p>
        {/* Number of Shards */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="localSinkNumShards"
            className="flex items-center text-xs font-bold uppercase text-[var(--vscode-text-muted)] gap-1.5"
          >
            <span>Number of Shards</span>
            <InfoTooltip text="Fixed number of output shards. Set to 0 to let the Beam runner automatically determine sharding dynamically." />
          </label>
          <input
            id="localSinkNumShards"
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
          id="localSinkShardTemplate"
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
          id="localSinkInstructions"
          name="system_instructions"
          label="Code Generation Instructions"
          tooltip="Custom instructions provided directly to Gemini when generating pipeline source code for this LocalFileSystem writer step."
          type="textarea"
          rows={3}
          value={systemInstructions}
          onChange={handleInstructionsChange}
          placeholder="e.g. Write results to /data/output/results with prefix and .csv suffix."
          mono={false}
          className="resize-y h-24"
          helperText="Additional guidance appended to prompt when synthesizing Java/Python code."
        />
      </div>
    </div>
  );
};
