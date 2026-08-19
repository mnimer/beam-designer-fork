import React from 'react';
import { BEAM_COMPRESSION_TYPES } from './FileIO';

/**
 * TextIO Source Properties Component
 * 
 * This component provides configuration forms for TextIO Source:
 * - filePattern: File or glob pattern to read (via TextIO.read().from(...))
 * - withCompression: Checkbox + compression algorithm selector
 * - emptyMatchTreatment: ALLOW, DISALLOW, ALLOW_IF_WILDCARD
 * - skipHeaderLines: Number of lines to skip at beginning of each file
 * - delimiter: Custom record delimiter (default is newline)
 * - hintMatchesManyFiles: Optimizer hint when matching many files
 */

interface TextIOSourceNode {
  data: {
    label: string;
    beam_transform?: string;
    properties?: {
      filePattern?: string;
      withCompression?: boolean;
      compression?: string;
      emptyMatchTreatment?: 'ALLOW' | 'DISALLOW' | 'ALLOW_IF_WILDCARD';
      skipHeaderLines?: string | number;
      delimiter?: string;
      hintMatchesManyFiles?: boolean;
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const isCheckbox = type === 'checkbox';
    const checked = isCheckbox ? (e.target as HTMLInputElement).checked : undefined;

    onChange({
      ...properties,
      [name]: isCheckbox ? checked : value
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {/* File Pattern Input */}
      <div className="flex flex-col gap-2">
        <label htmlFor="textFilePattern" className="text-xs font-bold uppercase text-slate-500">File Pattern / Path (.from)</label>
        <input
          id="textFilePattern"
          type="text"
          name="filePattern"
          value={filePattern}
          onChange={handleChange}
          placeholder="gs://my-bucket/data/*.txt or /path/to/files/*.csv"
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500 font-mono"
        />
        <span className="text-xs text-slate-500">
          Target file or glob pattern (e.g. gs://bucket/*.txt)
        </span>
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
        </label>

        {withCompression && (
          <div className="flex flex-col gap-1 mt-2">
            <label htmlFor="textCompression" className="text-xs font-semibold text-slate-400">Compression Algorithm</label>
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
        <label htmlFor="textEmptyMatchTreatment" className="text-xs font-bold uppercase text-slate-500">Empty Match Treatment</label>
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
        <label htmlFor="skipHeaderLines" className="text-xs font-bold uppercase text-slate-500">Skip Header Lines</label>
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
        <span className="text-xs text-slate-500">
          Number of lines to skip at the top of each file (useful for CSV headers).
        </span>
      </div>

      {/* Custom Delimiter */}
      <div className="flex flex-col gap-2">
        <label htmlFor="textDelimiter" className="text-xs font-bold uppercase text-slate-500">Custom Delimiter (Optional)</label>
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
        </label>
      </div>
    </div>
  );
};
