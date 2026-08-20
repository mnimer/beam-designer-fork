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
      ignoreEmptyFiles?: boolean;
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

export const FileIOSinkProperties: React.FC<FileIOSinkPropertiesProps> = ({ node, onChange }) => {
  const properties = node.data.properties || {};
  const to = properties.to || '';
  const prefix = properties.prefix || '';
  const suffix = properties.suffix || '';
  const withCompression = properties.withCompression ?? false;
  const compression = properties.compression || 'AUTO';
  const numShards = properties.numShards ?? '';
  const ignoreEmptyFiles = properties.ignoreEmptyFiles ?? false;

  const isToInvalid = !to.trim();

  // System instructions text with fallback
  const systemInstructions =
    node.data.system_instructions ??
    node.data.special_instructions ??
    properties.system_instructions ??
    properties.special_instructions ??
    '';

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const isCheckbox = type === 'checkbox';
    const checked = isCheckbox ? (e.target as HTMLInputElement).checked : undefined;

    onChange({
      ...properties,
      [name]: isCheckbox ? checked : value
    });
  };

  const handleInstructionsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange({
      ...properties,
      system_instructions: e.target.value
    });
  };

  return (
    <div className="flex-1 flex flex-col gap-4">
      {/* Destination Directory */}
      <div className="flex flex-col gap-2">
        <label htmlFor="fileSinkTo" className="flex items-center text-xs font-bold uppercase text-slate-500">
          <span>Destination Directory (.to)</span>
          <span className="text-red-400 ml-1 font-bold" title="Required">*</span>
          <InfoTooltip text="Base output directory path where files are written (e.g. gs://my-bucket/output/ or /local/output/). Required." />
        </label>
        <input
          id="fileSinkTo"
          type="text"
          name="to"
          aria-required="true"
          aria-invalid={isToInvalid}
          value={to}
          onChange={handleChange}
          placeholder="gs://my-bucket/output/ or /local/output/"
          className={`bg-[#252836] text-white p-2 rounded border text-sm focus:outline-none font-mono ${
            isToInvalid
              ? 'border-red-500/80 focus:border-red-500'
              : 'border-slate-700 focus:border-blue-500'
          }`}
        />
        {isToInvalid ? (
          <span className="text-xs text-red-400">Destination directory is required.</span>
        ) : (
          <span className="text-xs text-slate-400">
            Root folder or GCS directory where output files are written.
          </span>
        )}
      </div>

      {/* Prefix */}
      <div className="flex flex-col gap-2">
        <label htmlFor="fileSinkPrefix" className="flex items-center text-xs font-bold uppercase text-slate-500">
          <span>Filename Prefix (.withPrefix)</span>
          <InfoTooltip text="Prefix string prepended to all output file shard names (e.g. output-)." />
        </label>
        <input
          id="fileSinkPrefix"
          type="text"
          name="prefix"
          value={prefix}
          onChange={handleChange}
          placeholder="output-"
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500 font-mono"
        />
      </div>

      {/* Suffix */}
      <div className="flex flex-col gap-2">
        <label htmlFor="fileSinkSuffix" className="flex items-center text-xs font-bold uppercase text-slate-500">
          <span>Filename Suffix (.withSuffix)</span>
          <InfoTooltip text="Suffix or file extension appended to output shard names (e.g. .parquet, .avro, .csv)." />
        </label>
        <input
          id="fileSinkSuffix"
          type="text"
          name="suffix"
          value={suffix}
          onChange={handleChange}
          placeholder=".csv, .json, .parquet"
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500 font-mono"
        />
      </div>

      {/* Number of Shards */}
      <div className="flex flex-col gap-2">
        <label htmlFor="fileSinkNumShards" className="flex items-center text-xs font-bold uppercase text-slate-500">
          <span>Number of Shards (.withNumShards)</span>
          <InfoTooltip text="Fixed number of shards to write. Set to 0 or leave empty for runner-determined sharding." />
        </label>
        <input
          id="fileSinkNumShards"
          type="number"
          name="numShards"
          min="0"
          value={numShards}
          onChange={handleChange}
          placeholder="0 (Runner Determined)"
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
        />
      </div>

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

      {/* Ignore Empty Files */}
      <div className="p-3 bg-slate-800/40 rounded border border-slate-700/50">
        <label htmlFor="fileSinkIgnoreEmptyFiles" className="flex items-center gap-2 cursor-pointer">
          <input
            id="fileSinkIgnoreEmptyFiles"
            type="checkbox"
            name="ignoreEmptyFiles"
            checked={ignoreEmptyFiles}
            onChange={handleChange}
            className="w-4 h-4 rounded border-slate-700 text-blue-600 focus:ring-0 focus:ring-offset-0 bg-[#252836]"
          />
          <span className="text-sm font-medium text-slate-300">Ignore Empty Files (.withIgnoreEmptyFiles)</span>
          <InfoTooltip text="Skips writing empty output files if no elements are processed for a shard." />
        </label>
      </div>

      {/* Flexible Spacer */}
      <div className="flex-1 min-h-4" />

      {/* Code Generation Instructions */}
      <div className="flex flex-col gap-2 pt-2 border-t border-slate-700/60">
        <label htmlFor="fileSinkSystemInstructions" className="text-xs font-bold uppercase text-slate-500">
          Code Generation Instructions
        </label>
        <textarea
          id="fileSinkSystemInstructions"
          name="system_instructions"
          value={systemInstructions}
          onChange={handleInstructionsChange}
          placeholder="Enter custom instructions for FileIO sink code generation..."
          rows={3}
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500 resize-y"
        />
      </div>
    </div>
  );
};
