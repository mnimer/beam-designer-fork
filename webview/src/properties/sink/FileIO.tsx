/**
 * FileIO Sink Properties Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Renders the property panel for Apache Beam FileIO Write Sink nodes (FileIO.write().to(...)).
 * 
 * Architectural Decisions:
 * - In Apache Beam, FileIO.write() requires a destination directory path (`.to(...)`).
 * - Enforces required validation, visual error feedback, and aria attributes on `to`.
 * - Integrates InfoTooltip components explaining file naming templates, sharding, and compression.
 * - Provides Code Generation Instructions textarea for custom LLM prompts.
 */

import React from 'react';
import { BEAM_COMPRESSION_TYPES } from '../source/FileIO';
import { InfoTooltip } from '../../components/InfoTooltip';
import { PropertyField } from '../../components/common/PropertyField';

interface FileIOSinkNode {
  data: {
    label: string;
    beam_transform?: string;
    system_instructions?: string;
    special_instructions?: string;
    properties?: {
      to?: string;
      prefix?: string;
      suffix?: string;
      withCompression?: boolean;
      compression?: string;
      numShards?: string | number;
      system_instructions?: string;
      special_instructions?: string;
      codeGenerationPrompt?: string;
      prompt?: string;
      [key: string]: any;
    };
  };
}

interface FileIOSinkPropertiesProps {
  node: FileIOSinkNode;
  onChange: (properties: any) => void;
}

/**
 * FileIOSinkProperties component renders property controls for FileIO writes.
 */
export const FileIOSinkProperties: React.FC<FileIOSinkPropertiesProps> = ({ node, onChange }) => {
  const properties = node.data.properties || {};
  const to = properties.to || '';
  const prefix = properties.prefix || '';
  const suffix = properties.suffix || '';
  const withCompression = properties.withCompression ?? false;
  const compression = properties.compression || 'AUTO';
  const numShards = properties.numShards ?? '';

  const isToInvalid = !to.trim();

  // System instructions text with fallback
  const systemInstructions =
    node.data.system_instructions ??
    node.data.special_instructions ??
    properties.system_instructions ??
    properties.special_instructions ??
    '';

  /**
   * Handles text, checkbox, and select input changes.
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
   * Updates custom instructions for code generation.
   */
  const handleInstructionsChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    onChange({
      ...properties,
      system_instructions: e.target.value
    });
  };

  return (
    <div className="flex-1 flex flex-col gap-4">
      {/* Destination Directory */}
      <PropertyField
        id="fileSinkTo"
        name="to"
        label="Destination Directory (.to)"
        required={true}
        tooltip="Base output directory path where files are written (e.g. gs://my-bucket/output/ or /local/output/). Required."
        value={to}
        invalid={isToInvalid}
        error={isToInvalid ? 'Destination directory is required.' : null}
        onChange={handleChange}
        placeholder="gs://my-bucket/output/ or /local/output/"
        helperText={
          isToInvalid ? undefined : 'Root folder or GCS directory where output files are written.'
        }
      />

      {/* Prefix */}
      <PropertyField
        id="fileSinkPrefix"
        name="prefix"
        label="Filename Prefix (.withPrefix)"
        tooltip="Prefix string prepended to all output file shard names (e.g. output-)."
        value={prefix}
        onChange={handleChange}
        placeholder="output-"
      />

      {/* Suffix */}
      <PropertyField
        id="fileSinkSuffix"
        name="suffix"
        label="Filename Suffix (.withSuffix)"
        tooltip="Suffix or file extension appended to output shard names (e.g. .parquet, .avro, .csv)."
        value={suffix}
        onChange={handleChange}
        placeholder=".csv, .json, .parquet"
      />

      {/* Number of Shards */}
      <PropertyField
        id="fileSinkNumShards"
        name="numShards"
        label="Number of Shards (.withNumShards)"
        tooltip="Fixed number of shards to write. Set to 0 or leave empty for runner-determined sharding."
        type="number"
        min="0"
        value={numShards}
        onChange={handleChange}
        placeholder="0 (Runner Determined)"
        mono={false}
      />

      {/* Compression Row */}
      <div className="flex flex-col gap-2 p-3 bg-slate-800/40 rounded border border-slate-700/50">
        <label htmlFor="fileSinkWithCompression" className="flex items-center gap-2 cursor-pointer">
          <input
            id="fileSinkWithCompression"
            type="checkbox"
            name="withCompression"
            checked={withCompression}
            onChange={handleChange}
            className="w-4 h-4 rounded border-slate-700 text-blue-600 focus:ring-0 focus:ring-offset-0 bg-[#252836]"
          />
          <span className="text-sm font-medium text-slate-300">With Compression</span>
          <InfoTooltip text="Compresses output files using the selected compression algorithm." />
        </label>

        {withCompression && (
          <div className="flex flex-col gap-1 mt-2">
            <label htmlFor="fileSinkCompression" className="flex items-center text-xs font-semibold text-slate-400">
              <span>Compression Algorithm</span>
              <InfoTooltip text="Compression codec to apply when writing files." />
            </label>
            <select
              id="fileSinkCompression"
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

      {/* Flexible Spacer */}
      <div className="flex-1 min-h-4" />

      {/* Code Generation Instructions */}
      <div className="flex flex-col gap-2 pt-2 border-t border-slate-700/60">
        <PropertyField
          id="fileSinkSystemInstructions"
          name="system_instructions"
          label="Code Generation Instructions"
          type="textarea"
          value={systemInstructions}
          onChange={handleInstructionsChange}
          placeholder="Enter custom instructions for FileIO sink code generation..."
          rows={3}
          mono={false}
        />
      </div>
    </div>
  );
};
