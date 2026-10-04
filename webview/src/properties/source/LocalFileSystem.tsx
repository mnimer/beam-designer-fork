/**
 * LocalFileSystem Source Properties Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Renders the property configuration panel for Apache Beam LocalFileSystem Source nodes
 * (e.g. FileIO.match().filepattern(...) / TextIO.read().from(...) reading from worker-local disk paths
 * or file:// URIs in Java and Python pipelines).
 * 
 * Architectural Decisions:
 * - Unlike cloud file connectors, LocalFileSystem targets worker-local POSIX paths and file:// URIs.
 * - Deliberate deviation: useAssetLoader('storageBuckets') is NOT called because Cloud Storage buckets
 *   are irrelevant to local disk paths. Instead, static datalist path templates (/data/input/*.csv,
 *   /tmp/beam/input/*.txt, ./data/*.json, file:///var/data/*.csv) are provided.
 * - Prominent warning documentation and helper text caution users that local filesystem paths resolve
 *   strictly on each worker node's local disk, making LocalFileSystem primarily appropriate for
 *   DirectRunner or shared network volumes (NFS/SMB) rather than distributed runners (Dataflow, Flink, Spark)
 *   where files are isolated per node.
 * - Configurable wrapping reader formats: TextIO (plain text lines), AvroIO (Avro records),
 *   ParquetIO (columnar tables), and FileIO (raw file streams/matches).
 * - Configurable emptyMatchTreatment options: ALLOW, DISALLOW, ALLOW_IF_WILDCARD.
 * - Advanced tuning accordion provides bundle size optimization (minBundleSize), startup file
 *   existence validation (validate), and continuous streaming directory polling (watchForNewFilesInterval).
 * - Decomposes repeated accordion and select markup into reusable CollapsibleSection and SelectField helper components.
 * - Adheres strictly to the 8pt grid system, VS Code theme variables, and Tailwind CSS.
 */

import React, { useState } from 'react';
import { Sliders } from 'lucide-react';
import { InfoTooltip } from '../../components/InfoTooltip';
import { PropertyField } from '../../components/common/PropertyField';
import { SystemInstructionsField } from '../../components/common/SystemInstructionsField';
import { CollapsibleSection } from '../../components/common/CollapsibleSection';
import { resolveSystemInstructions } from '../../utils/systemInstructions';

/** React Flow node shape for the LocalFileSystem source panel, including its persisted configuration data. */
export interface LocalFileSystemSourceNode {
  data: {
    label: string;
    beam_transform?: string;
    system_instructions?: string;
    special_instructions?: string;
    properties?: {
      filePattern?: string;
      format?: string;
      compression?: string;
      emptyMatchTreatment?: string;
      validate?: boolean;
      minBundleSize?: string | number;
      watchForNewFilesInterval?: string | number;
      system_instructions?: string;
      special_instructions?: string;
      [key: string]: any;
    };
  };
}

/** Props for the {@link LocalFileSystemSourceProperties} component. */
export interface LocalFileSystemSourcePropertiesProps {
  node: LocalFileSystemSourceNode;
  onChange: (properties: any) => void;
}

export const LOCAL_SOURCE_PATH_SUGGESTIONS = [
  '/data/input/*.csv',
  '/tmp/beam/input/*.txt',
  './data/*.json',
  'file:///var/data/*.csv',
  '/var/log/app/*.log'
];

export const LOCAL_FILE_FORMATS = [
  { value: 'TextIO', label: 'TextIO (Plain text / lines)' },
  { value: 'AvroIO', label: 'AvroIO (Avro binary records)' },
  { value: 'ParquetIO', label: 'ParquetIO (Apache Parquet columnar)' },
  { value: 'FileIO', label: 'FileIO (Generic file streams / binary)' }
];

export const LOCAL_SOURCE_COMPRESSION_TYPES = [
  { value: 'AUTO', label: 'AUTO (Detect from file extension)' },
  { value: 'UNCOMPRESSED', label: 'UNCOMPRESSED (Standard uncompressed files)' },
  { value: 'GZIP', label: 'GZIP (.gz)' },
  { value: 'BZIP2', label: 'BZIP2 (.bz2)' },
  { value: 'DEFLATE', label: 'DEFLATE / ZLIB' },
  { value: 'ZSTD', label: 'ZSTD (.zst)' }
];

export const EMPTY_MATCH_TREATMENT_OPTIONS = [
  { value: 'ALLOW', label: 'ALLOW (Proceed silently if pattern matches zero files)' },
  { value: 'DISALLOW', label: 'DISALLOW (Throw error if pattern matches zero files)' },
  { value: 'ALLOW_IF_WILDCARD', label: 'ALLOW_IF_WILDCARD (Allow zero files only when pattern contains wildcards)' }
];

/** Props for the select dropdown input field. */
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
 * LocalFileSystemSourceProperties renders the property configuration form for LocalFileSystem reads.
 */
export const LocalFileSystemSourceProperties: React.FC<LocalFileSystemSourcePropertiesProps> = ({ node, onChange }) => {
  const properties = node.data.properties || {};
  const filePattern = properties.filePattern || '';
  const format = properties.format || 'TextIO';
  const compression = properties.compression || 'AUTO';
  const emptyMatchTreatment = properties.emptyMatchTreatment || 'ALLOW_IF_WILDCARD';
  const validate = properties.validate ?? true;
  const minBundleSize = properties.minBundleSize ?? '';
  const watchForNewFilesInterval = properties.watchForNewFilesInterval ?? '';

  const [isAdvancedOpen, setIsAdvancedOpen] = useState<boolean>(false);

  // NOTE: Deliberately no useAssetLoader('storageBuckets') call here, as local filesystem paths
  // resolve against local disks rather than cloud object storage buckets.
  // Validation: filePattern is required for reading local files
  const isFilePatternInvalid = !filePattern.trim();

  // System instructions text with fallback
  const systemInstructions = resolveSystemInstructions(node);

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
        id="localSourceFilePattern"
        name="filePattern"
        label="File Pattern / Path (.filepattern)"
        required="File Pattern is required."
        tooltip="Local filesystem path or glob pattern (e.g. /data/input/*.csv or file:///data/input/*.csv). Note: Local paths resolve on each worker's own local filesystem; distributed runners (Dataflow, Flink, Spark) cannot access files across workers without a shared network mount (NFS/SMB). Primarily intended for DirectRunner."
        aria-required="true"
        aria-invalid={isFilePatternInvalid}
        value={filePattern}
        onChange={handleChange}
        placeholder="/data/input/*.csv or file:///data/input/*.csv"
        invalid={isFilePatternInvalid}
        error={isFilePatternInvalid ? 'File Pattern is required.' : null}
        mono={true}
        list="local-source-path-options"
        datalist={LOCAL_SOURCE_PATH_SUGGESTIONS}
        helperText={
          <span className="text-xs text-[var(--vscode-text-muted)]">
            Warning: Local paths resolve on each worker&apos;s own filesystem. With distributed runners (Dataflow, Flink, Spark), workers cannot access files across machines; LocalFileSystem is primarily intended for DirectRunner or a shared network mount.
          </span>
        }
      />

      {/* Wrapping Reader Format Select */}
      <SelectField
        id="localSourceFormat"
        name="format"
        label="File Format / Reader"
        tooltip="Underlying Beam I/O reader transform wrapping the local filesystem access (e.g. TextIO for lines, AvroIO for schemas, ParquetIO for columnar data, or FileIO for raw file streams)."
        value={format}
        options={LOCAL_FILE_FORMATS}
        onChange={handleChange}
        helperText={
          <span>
            Beam reader transform used to decode local files. Defaults to <code>TextIO</code>.
          </span>
        }
      />

      {/* Compression Select */}
      <SelectField
        id="localSourceCompression"
        name="compression"
        label="Compression"
        tooltip="Compression codec used for input files. AUTO detects from file extension."
        value={compression}
        options={LOCAL_SOURCE_COMPRESSION_TYPES}
        onChange={handleChange}
      />

      {/* Empty Match Treatment Select */}
      <SelectField
        id="localSourceEmptyMatchTreatment"
        name="emptyMatchTreatment"
        label="Empty Match Treatment"
        tooltip="Determines pipeline behavior if the input file pattern matches zero files at pipeline start."
        value={emptyMatchTreatment}
        options={EMPTY_MATCH_TREATMENT_OPTIONS}
        onChange={handleChange}
        helperText="Treatment behavior when zero input files match the specified pattern."
      />

      {/* Advanced Tuning Accordion */}
      <CollapsibleSection
        title="Read Tuning & Options"
        icon={<Sliders className="w-4 h-4 text-emerald-400" />}
        isOpen={isAdvancedOpen}
        onToggle={handleToggleAdvanced}
      >
        {/* Validate Checkbox */}
        <label htmlFor="localSourceValidate" className="flex items-center gap-2 cursor-pointer mt-1">
          <input
            id="localSourceValidate"
            type="checkbox"
            name="validate"
            checked={validate}
            onChange={handleChange}
            className="rounded bg-[var(--vscode-input-bg)] border-[var(--vscode-border)] text-blue-500 focus:ring-0 focus:ring-offset-0"
          />
          <span className="text-xs text-[var(--vscode-text-secondary)]">
            Validate file existence on pipeline startup
          </span>
          <InfoTooltip text="Validates input file pattern matches at pipeline construction time." />
        </label>

        {/* Minimum Bundle Size */}
        <PropertyField
          id="localSourceMinBundleSize"
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

        {/* Watch For New Files Interval */}
        <PropertyField
          id="localSourceWatchInterval"
          type="number"
          name="watchForNewFilesInterval"
          label="Watch For New Files Interval (seconds)"
          tooltip="Interval in seconds for continuously watching for new files. In Java, TextIO.read().watchForNewFiles(Duration.standardSeconds(n), Watch.Growth.afterTimeSinceNewOutput(...)) requires a TerminationCondition and turns the PCollection unbounded; in Python, it maps to MatchContinuously(file_pattern, interval=n). 0 or empty disables continuous watching (standard batch mode)."
          value={watchForNewFilesInterval}
          onChange={handleChange}
          placeholder="0 (Disabled / Batch)"
          min="0"
          mono={true}
          helperText={
            <span className="text-[11px] text-[var(--vscode-text-muted)]">
              In Java, <code>TextIO.read().watchForNewFiles(Duration.standardSeconds(n), Watch.Growth.afterTimeSinceNewOutput(...))</code> requires a <code>TerminationCondition</code> and turns the <code>PCollection</code> unbounded; in Python, it maps to <code>MatchContinuously(file_pattern, interval=n)</code>.
            </span>
          }
        />
      </CollapsibleSection>

      {/* Code Generation Instructions */}
      <SystemInstructionsField
        id="localSourceInstructions"
        value={systemInstructions}
        tooltip="Custom instructions provided directly to Gemini when generating pipeline source code for this LocalFileSystem reader step."
        placeholder="e.g. Read CSV files from local directory /data/input/ and parse each row."
        helperText="Additional guidance appended to prompt when synthesizing Java/Python code."
        textareaClassName="h-24"
        wrapperClassName="pt-2 border-t border-[var(--vscode-border-light)]"
        onChange={(value) =>
          onChange({
            ...properties,
            system_instructions: value,
          })
        }
      />
    </div>
  );
};
