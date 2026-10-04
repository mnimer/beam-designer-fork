/**
 * FileIO Source and ReadMatches Properties Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Renders property panels for Apache Beam FileIO match operations (FileIO.match())
 * and file content reading (FileIO.readMatches()).
 * 
 * Architectural Decisions:
 * - In Apache Beam, FileIO.match() requires a file pattern or path (.filepattern(...)).
 * - Enforces required validation, visual error feedback, and aria attributes on filePattern.
 * - Integrates InfoTooltip components for streaming watch, empty match treatments, and compression algorithms.
 * - Provides Code Generation Instructions textarea for custom LLM prompts.
 */

import React from 'react';
import { InfoTooltip } from '../../components/InfoTooltip';
import { PropertyField } from '../../components/common/PropertyField';
import { SystemInstructionsField } from '../../components/common/SystemInstructionsField';
import { resolveSystemInstructions } from '../../utils/systemInstructions';

/**
 * Valid members of org.apache.beam.sdk.io.Compression for read operations.
 * NOTE: TAR and XZ do not exist on Beam's Compression enum and were removed.
 */
export const BEAM_COMPRESSION_TYPES = [
  'AUTO',
  'UNCOMPRESSED',
  'BZIP2',
  'GZIP',
  'ZIP',
  'DEFLATE',
  'ZSTD'
] as const;

/**
 * Valid members of org.apache.beam.sdk.io.Compression for write operations.
 * NOTE: Compression.AUTO.writeCompressed() and Compression.ZIP.writeCompressed()
 * both throw UnsupportedOperationException in Beam Java, so write panels must not offer them.
 */
export const BEAM_WRITE_COMPRESSION_TYPES = [
  'UNCOMPRESSED',
  'BZIP2',
  'GZIP',
  'DEFLATE',
  'ZSTD'
] as const;

/** React Flow node shape for the FileIO source panel, including its persisted configuration data. */
interface FileIOSourceNode {
  data: {
    label: string;
    beam_transform?: string;
    system_instructions?: string;
    special_instructions?: string;
    properties?: {
      filePattern?: string;
      emptyMatchTreatment?: 'ALLOW' | 'DISALLOW' | 'ALLOW_IF_WILDCARD';
      continuously?: boolean;
      continuousDuration?: string | number;
      continuousDurationUnit?: 'SECONDS' | 'MINUTES' | 'HOURS' | 'DAYS';
      system_instructions?: string;
      special_instructions?: string;
      [key: string]: any;
    };
  };
}

/** Props for the {@link FileIOSourceProperties} component. */
interface FileIOSourcePropertiesProps {
  node: FileIOSourceNode;
  onChange: (properties: any) => void;
}

/**
 * Dedicated property panel for the FileIO.match/matchAll source node. Configures file pattern matching and continuous polling.
 *
 * @param props The selected node and the onChange callback used to persist edits.
 */
export const FileIOSourceProperties: React.FC<FileIOSourcePropertiesProps> = ({ node, onChange }) => {
  const properties = node.data.properties || {};
  const filePattern = properties.filePattern || '';
  const emptyMatchTreatment = properties.emptyMatchTreatment || 'ALLOW_IF_WILDCARD';
  const continuously = properties.continuously ?? false;
  const continuousDuration = properties.continuousDuration ?? '1';
  const continuousDurationUnit = properties.continuousDurationUnit || 'MINUTES';

  const isInvalid = !filePattern.trim();

  // System instructions text with fallback
  const systemInstructions = resolveSystemInstructions(node);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const isCheckbox = type === 'checkbox';
    const checked = isCheckbox ? (e.target as HTMLInputElement).checked : undefined;

    onChange({
      ...properties,
      [name]: isCheckbox ? checked : value
    });
  };

  return (
    <div className="flex-1 flex flex-col gap-4">
      {/* File Pattern Input */}
      <PropertyField
        id="filePattern"
        name="filePattern"
        label="File Pattern (.filepattern)"
        required="Required"
        tooltip="File or glob pattern to match (e.g. gs://my-bucket/path/*.csv or /local/path/*.json). Required."
        value={filePattern}
        invalid={isInvalid}
        error={isInvalid ? 'File Pattern is required.' : null}
        helperText={!isInvalid ? 'File glob pattern or exact file path to match.' : null}
        placeholder="gs://my-bucket/path/*.csv or /local/path/*.json"
        onChange={handleChange}
        mono={true}
      />

      {/* Empty Match Treatment */}
      <div className="flex flex-col gap-2">
        <label htmlFor="emptyMatchTreatment" className="flex items-center text-xs font-bold uppercase text-slate-500">
          <span>Empty Match Treatment</span>
          <InfoTooltip text="Specifies behavior when pattern matches zero files: ALLOW (proceed), DISALLOW (fail job), ALLOW_IF_WILDCARD (allow for glob patterns)." />
        </label>
        <select
          id="emptyMatchTreatment"
          name="emptyMatchTreatment"
          value={emptyMatchTreatment}
          onChange={handleChange}
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
        >
          <option value="ALLOW_IF_WILDCARD">ALLOW_IF_WILDCARD (Default)</option>
          <option value="ALLOW">ALLOW</option>
          <option value="DISALLOW">DISALLOW</option>
        </select>
      </div>

      {/* Continuously Watching */}
      <div className="flex flex-col gap-3 p-3 bg-slate-800/40 rounded border border-slate-700/50">
        <label htmlFor="continuously" className="flex items-center gap-2 cursor-pointer">
          <input
            id="continuously"
            type="checkbox"
            name="continuously"
            checked={continuously}
            onChange={handleChange}
            className="w-4 h-4 rounded border-slate-700 text-blue-600 focus:ring-0 focus:ring-offset-0 bg-[#252836]"
          />
          <span className="text-sm font-medium text-slate-300">Continuously (Stream Watch)</span>
          <InfoTooltip text="Enables streaming watch for new matching files arriving continuously over time." />
        </label>

        {continuously && (
          <div className="flex items-center gap-2 mt-2">
            <div className="flex-1 flex flex-col gap-1">
              <label htmlFor="continuousDuration" className="text-xs font-semibold text-slate-400">Check Interval</label>
              <input
                id="continuousDuration"
                type="number"
                name="continuousDuration"
                min="1"
                value={continuousDuration}
                onChange={handleChange}
                placeholder="1"
                className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="w-32 flex flex-col gap-1">
              <label htmlFor="continuousDurationUnit" className="text-xs font-semibold text-slate-400">Unit</label>
              <select
                id="continuousDurationUnit"
                name="continuousDurationUnit"
                value={continuousDurationUnit}
                onChange={handleChange}
                className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="SECONDS">Seconds</option>
                <option value="MINUTES">Minutes</option>
                <option value="HOURS">Hours</option>
                <option value="DAYS">Days</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Code Generation Instructions */}
      <SystemInstructionsField
        id="fileSourceSystemInstructions"
        value={systemInstructions}
        placeholder="Enter custom instructions for FileIO match code generation..."
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

/** React Flow node shape for the FileIO read matches panel, including its persisted configuration data. */
interface FileIOReadMatchesNode {
  data: {
    label: string;
    beam_transform?: string;
    system_instructions?: string;
    special_instructions?: string;
    properties?: {
      withCompression?: boolean;
      compression?: string;
      directoryTreatment?: 'SKIP' | 'PROHIBIT';
      system_instructions?: string;
      special_instructions?: string;
      [key: string]: any;
    };
  };
}

/** Props for the {@link FileIOReadMatchesProperties} component. */
interface FileIOReadMatchesPropertiesProps {
  node: FileIOReadMatchesNode;
  onChange: (properties: any) => void;
}

/**
 * Dedicated property panel for the FileIO.readMatches node. Configures compression handling and directory treatments.
 *
 * @param props The selected node and the onChange callback used to persist edits.
 */
export const FileIOReadMatchesProperties: React.FC<FileIOReadMatchesPropertiesProps> = ({ node, onChange }) => {
  const properties = node.data.properties || {};
  const withCompression = properties.withCompression ?? false;
  const compression = properties.compression || 'AUTO';
  const directoryTreatment = properties.directoryTreatment || 'SKIP';

  // System instructions text with fallback
  const systemInstructions = resolveSystemInstructions(node);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const isCheckbox = type === 'checkbox';
    const checked = isCheckbox ? (e.target as HTMLInputElement).checked : undefined;

    onChange({
      ...properties,
      [name]: isCheckbox ? checked : value
    });
  };

  return (
    <div className="flex-1 flex flex-col gap-4">
      <div className="text-xs text-slate-400 p-2 bg-slate-800/40 rounded border border-slate-700/50">
        Converts <code className="text-blue-400">PCollection&lt;MatchResult.Metadata&gt;</code> into <code className="text-blue-400">PCollection&lt;FileIO.ReadableFile&gt;</code>.
      </div>

      {/* Compression Row */}
      <div className="flex flex-col gap-2 p-3 bg-slate-800/40 rounded border border-slate-700/50">
        <label htmlFor="readMatchesWithCompression" className="flex items-center gap-2 cursor-pointer">
          <input
            id="readMatchesWithCompression"
            type="checkbox"
            name="withCompression"
            checked={withCompression}
            onChange={handleChange}
            className="w-4 h-4 rounded border-slate-700 text-blue-600 focus:ring-0 focus:ring-offset-0 bg-[#252836]"
          />
          <span className="text-sm font-medium text-slate-300">With Compression</span>
          <InfoTooltip text="Specifies file decompression algorithm when reading matched file contents." />
        </label>

        {withCompression && (
          <div className="flex flex-col gap-1 mt-2">
            <label htmlFor="readMatchesCompression" className="flex items-center text-xs font-semibold text-slate-400">
              <span>Compression Algorithm</span>
              <InfoTooltip text="Compression algorithm used by matched files (AUTO, GZIP, BZIP2, ZIP, DEFLATE, etc.)." />
            </label>
            <select
              id="readMatchesCompression"
              name="compression"
              value={compression}
              onChange={handleChange}
              className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
            >
              {BEAM_COMPRESSION_TYPES.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Directory Treatment */}
      <div className="flex flex-col gap-2">
        <label htmlFor="directoryTreatment" className="flex items-center text-xs font-bold uppercase text-slate-500">
          <span>Directory Treatment</span>
          <InfoTooltip text="Determines how directories matched in metadata are handled: SKIP (silently ignore directories) or PROHIBIT (throw error on directory)." />
        </label>
        <select
          id="directoryTreatment"
          name="directoryTreatment"
          value={directoryTreatment}
          onChange={handleChange}
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
        >
          <option value="SKIP">SKIP (Skip directories in match)</option>
          <option value="PROHIBIT">PROHIBIT (Throw error if directory matched)</option>
        </select>
      </div>

      {/* Code Generation Instructions */}
      <SystemInstructionsField
        id="readMatchesSystemInstructions"
        value={systemInstructions}
        placeholder="Enter custom instructions for FileIO.readMatches() code generation..."
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
