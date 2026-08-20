/**
 * TextIO Source Properties Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Renders the property panel for Apache Beam TextIO file read operations (TextIO.read().from(...)).
 * 
 * Architectural Decisions:
 * - In Apache Beam, TextIO.read() requires a file pattern or path (.from(...)).
 * - Enforces required field indicators, error messages, and aria attributes on filePattern.
 * - Integrates InfoTooltip components explaining file match semantics, compression, and sharding hints.
 * - Provides Code Generation Instructions textarea at the bottom for custom LLM prompts.
 */

import React from 'react';
import { BEAM_COMPRESSION_TYPES } from './FileIO';
import { InfoTooltip } from '../../components/InfoTooltip';

interface TextIOSourceNode {
  data: {
    label: string;
    beam_transform?: string;
    system_instructions?: string;
    special_instructions?: string;
    properties?: {
      filePattern?: string;
      withCompression?: boolean;
      compression?: string;
      emptyMatchTreatment?: 'ALLOW' | 'DISALLOW' | 'ALLOW_IF_WILDCARD';
      skipHeaderLines?: string | number;
      delimiter?: string;
      hintMatchesManyFiles?: boolean;
      system_instructions?: string;
      special_instructions?: string;
      [key: string]: any;
    };
  };
}

interface TextIOSourcePropertiesProps {
  node: TextIOSourceNode;
  onChange: (properties: any) => void;
}

export const TextIOSourceProperties: React.FC<TextIOSourcePropertiesProps> = ({ node, onChange }) => {
  const properties = node.data.properties || {};
  const filePattern = properties.filePattern || '';
  const withCompression = properties.withCompression ?? false;
  const compression = properties.compression || 'AUTO';
  const emptyMatchTreatment = properties.emptyMatchTreatment || 'ALLOW_IF_WILDCARD';
  const skipHeaderLines = properties.skipHeaderLines ?? '';
  const delimiter = properties.delimiter || '';
  const hintMatchesManyFiles = properties.hintMatchesManyFiles ?? false;

  const isInvalid = !filePattern.trim();

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
      {/* File Pattern Input */}
      <div className="flex flex-col gap-2">
        <label htmlFor="textFilePattern" className="flex items-center text-xs font-bold uppercase text-slate-500">
          <span>File Pattern / Path (.from)</span>
          <span className="text-red-400 ml-1 font-bold" title="Required">*</span>
          <InfoTooltip text="File or glob pattern to read from (e.g. gs://bucket/data/*.csv or /path/to/files/*.txt). Required." />
        </label>
        <input
          id="textFilePattern"
          type="text"
          name="filePattern"
          aria-required="true"
          aria-invalid={isInvalid}
          value={filePattern}
          onChange={handleChange}
          placeholder="gs://my-bucket/data/*.txt or /path/to/files/*.csv"
          className={`bg-[#252836] text-white p-2 rounded border text-sm focus:outline-none font-mono ${
            isInvalid
              ? 'border-red-500/80 focus:border-red-500'
              : 'border-slate-700 focus:border-blue-500'
          }`}
        />
        {isInvalid ? (
          <span className="text-xs text-red-400">File Pattern is required.</span>
        ) : (
          <span className="text-xs text-slate-400">
            Target file or glob pattern (e.g. gs://bucket/*.txt)
          </span>
        )}
      </div>

      {/* Compression Row */}
      <div className="flex flex-col gap-2 p-3 bg-slate-800/40 rounded border border-slate-700/50">
        <label htmlFor="textWithCompression" className="flex items-center gap-2 cursor-pointer">
          <input
            id="textWithCompression"
            type="checkbox"
            name="withCompression"
            checked={withCompression}
            onChange={handleChange}
            className="w-4 h-4 rounded border-slate-700 text-blue-600 focus:ring-0 focus:ring-offset-0 bg-[#252836]"
          />
          <span className="text-sm font-medium text-slate-300">With Compression</span>
          <InfoTooltip text="Enables decompressing files on read using the specified algorithm or automatic detection." />
        </label>

        {withCompression && (
          <div className="flex flex-col gap-1 mt-2">
            <label htmlFor="textCompression" className="flex items-center text-xs font-semibold text-slate-400">
              <span>Compression Algorithm</span>
              <InfoTooltip text="Compression algorithm used by source files (AUTO, GZIP, BZIP2, ZIP, DEFLATE, etc.)." />
            </label>
            <select
              id="textCompression"
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

      {/* Empty Match Treatment */}
      <div className="flex flex-col gap-2">
        <label htmlFor="textEmptyMatchTreatment" className="flex items-center text-xs font-bold uppercase text-slate-500">
          <span>Empty Match Treatment</span>
          <InfoTooltip text="Determines behavior when no files match the pattern: ALLOW (ignore), DISALLOW (fail pipeline), ALLOW_IF_WILDCARD (allow only for wildcards)." />
        </label>
        <select
          id="textEmptyMatchTreatment"
          name="emptyMatchTreatment"
          value={emptyMatchTreatment}
          onChange={handleChange}
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
        >
          <option value="ALLOW_IF_WILDCARD">ALLOW_IF_WILDCARD</option>
          <option value="ALLOW">ALLOW</option>
          <option value="DISALLOW">DISALLOW</option>
        </select>
      </div>

      {/* Skip Header Lines */}
      <div className="flex flex-col gap-2">
        <label htmlFor="skipHeaderLines" className="flex items-center text-xs font-bold uppercase text-slate-500">
          <span>Skip Header Lines</span>
          <InfoTooltip text="Number of lines to skip at the beginning of each file before reading records (useful for header rows in CSV/TSV)." />
        </label>
        <input
          id="skipHeaderLines"
          type="number"
          name="skipHeaderLines"
          min="0"
          value={skipHeaderLines}
          onChange={handleChange}
          placeholder="0 (Do not skip)"
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
        />
        <span className="text-xs text-slate-400">
          Number of lines to skip at the top of each file (useful for CSV headers).
        </span>
      </div>

      {/* Custom Delimiter */}
      <div className="flex flex-col gap-2">
        <label htmlFor="textDelimiter" className="flex items-center text-xs font-bold uppercase text-slate-500">
          <span>Custom Delimiter (Optional)</span>
          <InfoTooltip text="Custom byte delimiter separating records (default is newline '\n')." />
        </label>
        <input
          id="textDelimiter"
          type="text"
          name="delimiter"
          value={delimiter}
          onChange={handleChange}
          placeholder="\n (Default newline)"
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500 font-mono"
        />
      </div>

      {/* Hint Matches Many Files */}
      <div className="p-3 bg-slate-800/40 rounded border border-slate-700/50">
        <label htmlFor="hintMatchesManyFiles" className="flex items-center gap-2 cursor-pointer">
          <input
            id="hintMatchesManyFiles"
            type="checkbox"
            name="hintMatchesManyFiles"
            checked={hintMatchesManyFiles}
            onChange={handleChange}
            className="w-4 h-4 rounded border-slate-700 text-blue-600 focus:ring-0 focus:ring-offset-0 bg-[#252836]"
          />
          <span className="text-sm font-medium text-slate-300">Hint Matches Many Files (Optimization)</span>
          <InfoTooltip text="Hints to the runner that this file pattern expands into a very large number of files, optimizing parallel expansion." />
        </label>
      </div>

      {/* Flexible Spacer */}
      <div className="flex-1 min-h-4" />

      {/* Code Generation Instructions */}
      <div className="flex flex-col gap-2 pt-2 border-t border-slate-700/60">
        <label htmlFor="textSourceSystemInstructions" className="text-xs font-bold uppercase text-slate-500">
          Code Generation Instructions
        </label>
        <textarea
          id="textSourceSystemInstructions"
          name="system_instructions"
          value={systemInstructions}
          onChange={handleInstructionsChange}
          placeholder="Enter custom instructions for TextIO source code generation..."
          rows={3}
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500 resize-y"
        />
      </div>
    </div>
  );
};
