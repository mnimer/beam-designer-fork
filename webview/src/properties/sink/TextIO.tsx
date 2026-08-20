/**
 * TextIO Sink Properties Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Renders the property panel for Apache Beam TextIO Write Sink nodes (TextIO.write().to(...)).
 * 
 * Architectural Decisions:
 * - In Apache Beam, TextIO.write() requires a destination output file prefix or path (`.to(...)`).
 * - Enforces required field indicators, error messages, and aria attributes on `to`.
 * - Integrates InfoTooltip components explaining sharding, compression formats, and file naming templates.
 * - Provides Code Generation Instructions textarea for custom LLM prompts.
 */

import React from 'react';
import { BEAM_COMPRESSION_TYPES } from '../source/FileIO';
import { InfoTooltip } from '../../components/InfoTooltip';

interface TextIOSinkNode {
  data: {
    label: string;
    beam_transform?: string;
    system_instructions?: string;
    special_instructions?: string;
    properties?: {
      to?: string;
      suffix?: string;
      numShards?: string | number;
      withoutSharding?: boolean;
      withCompression?: boolean;
      compression?: string;
      header?: string;
      footer?: string;
      system_instructions?: string;
      special_instructions?: string;
      codeGenerationPrompt?: string;
      prompt?: string;
      [key: string]: any;
    };
  };
}

interface TextIOSinkPropertiesProps {
  node: TextIOSinkNode;
  onChange: (properties: any) => void;
}

export const TextIOSinkProperties: React.FC<TextIOSinkPropertiesProps> = ({ node, onChange }) => {
  const properties = node.data.properties || {};
  const to = properties.to || '';
  const suffix = properties.suffix || '';
  const numShards = properties.numShards ?? '';
  const withoutSharding = properties.withoutSharding ?? false;
  const withCompression = properties.withCompression ?? false;
  const compression = properties.compression || 'AUTO';
  const header = properties.header || '';
  const footer = properties.footer || '';

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
      {/* Destination File Prefix / Path */}
      <div className="flex flex-col gap-2">
        <label htmlFor="textSinkTo" className="flex items-center text-xs font-bold uppercase text-slate-500">
          <span>Destination File Prefix (.to)</span>
          <span className="text-red-400 ml-1 font-bold" title="Required">*</span>
          <InfoTooltip text="File prefix or path where output shards will be written (e.g. gs://my-bucket/output/data or /local/path/output). Required." />
        </label>
        <input
          id="textSinkTo"
          type="text"
          name="to"
          aria-required="true"
          aria-invalid={isToInvalid}
          value={to}
          onChange={handleChange}
          placeholder="gs://my-bucket/output/results or /local/out/file"
          className={`bg-[#252836] text-white p-2 rounded border text-sm focus:outline-none font-mono ${
            isToInvalid
              ? 'border-red-500/80 focus:border-red-500'
              : 'border-slate-700 focus:border-blue-500'
          }`}
        />
        {isToInvalid ? (
          <span className="text-xs text-red-400">Destination file prefix is required.</span>
        ) : (
          <span className="text-xs text-slate-400">
            Output prefix for shards (e.g. gs://bucket/output/data)
          </span>
        )}
      </div>

      {/* Suffix */}
      <div className="flex flex-col gap-2">
        <label htmlFor="textSinkSuffix" className="flex items-center text-xs font-bold uppercase text-slate-500">
          <span>File Suffix / Extension</span>
          <InfoTooltip text="File extension or suffix added to each output shard (e.g. .txt, .csv, .json)." />
        </label>
        <input
          id="textSinkSuffix"
          type="text"
          name="suffix"
          value={suffix}
          onChange={handleChange}
          placeholder=".txt, .csv, .json"
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500 font-mono"
        />
      </div>

      {/* Sharding */}
      <div className="flex flex-col gap-3 p-3 bg-slate-800/40 rounded border border-slate-700/50">
        <label htmlFor="textSinkWithoutSharding" className="flex items-center gap-2 cursor-pointer">
          <input
            id="textSinkWithoutSharding"
            type="checkbox"
            name="withoutSharding"
            checked={withoutSharding}
            onChange={handleChange}
            className="w-4 h-4 rounded border-slate-700 text-blue-600 focus:ring-0 focus:ring-offset-0 bg-[#252836]"
          />
          <span className="text-sm font-medium text-slate-300">Without Sharding (Single File)</span>
          <InfoTooltip text="Forces the runner to collect all elements and write into a single un-sharded file. Caution: limits write throughput." />
        </label>

        {!withoutSharding && (
          <div className="flex flex-col gap-1 mt-1">
            <label htmlFor="textSinkNumShards" className="flex items-center text-xs font-semibold text-slate-400">
              <span>Number of Shards</span>
              <InfoTooltip text="Fixed number of shards to write. Set to 0 or leave empty for runner-determined sharding." />
            </label>
            <input
              id="textSinkNumShards"
              type="number"
              name="numShards"
              min="0"
              value={numShards}
              onChange={handleChange}
              placeholder="0 (Runner Determined)"
              className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
        )}
      </div>

      {/* Compression Row */}
      <div className="flex flex-col gap-2 p-3 bg-slate-800/40 rounded border border-slate-700/50">
        <label htmlFor="textSinkWithCompression" className="flex items-center gap-2 cursor-pointer">
          <input
            id="textSinkWithCompression"
            type="checkbox"
            name="withCompression"
            checked={withCompression}
            onChange={handleChange}
            className="w-4 h-4 rounded border-slate-700 text-blue-600 focus:ring-0 focus:ring-offset-0 bg-[#252836]"
          />
          <span className="text-sm font-medium text-slate-300">With Compression</span>
          <InfoTooltip text="Compresses output files using specified algorithm (e.g. GZIP, BZIP2)." />
        </label>

        {withCompression && (
          <div className="flex flex-col gap-1 mt-2">
            <label htmlFor="textSinkCompression" className="flex items-center text-xs font-semibold text-slate-400">
              <span>Compression Algorithm</span>
              <InfoTooltip text="Compression codec to apply when writing output files." />
            </label>
            <select
              id="textSinkCompression"
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

      {/* Header and Footer */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="textSinkHeader" className="flex items-center text-xs font-bold uppercase text-slate-500">
            <span>Header Line (Optional)</span>
            <InfoTooltip text="Text written once at the beginning of each output file shard (e.g. CSV header line)." />
          </label>
          <input
            id="textSinkHeader"
            type="text"
            name="header"
            value={header}
            onChange={handleChange}
            placeholder="id,name,timestamp"
            className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500 font-mono"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="textSinkFooter" className="flex items-center text-xs font-bold uppercase text-slate-500">
            <span>Footer Line (Optional)</span>
            <InfoTooltip text="Text written once at the end of each output file shard." />
          </label>
          <input
            id="textSinkFooter"
            type="text"
            name="footer"
            value={footer}
            onChange={handleChange}
            placeholder="EOF"
            className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500 font-mono"
          />
        </div>
      </div>

      {/* Flexible Spacer */}
      <div className="flex-1 min-h-4" />

      {/* Code Generation Instructions */}
      <div className="flex flex-col gap-2 pt-2 border-t border-slate-700/60">
        <label htmlFor="textSinkSystemInstructions" className="text-xs font-bold uppercase text-slate-500">
          Code Generation Instructions
        </label>
        <textarea
          id="textSinkSystemInstructions"
          name="system_instructions"
          value={systemInstructions}
          onChange={handleInstructionsChange}
          placeholder="Enter custom instructions for TextIO sink code generation..."
          rows={3}
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500 resize-y"
        />
      </div>
    </div>
  );
};
