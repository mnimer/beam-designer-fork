import React from 'react';
import { BEAM_COMPRESSION_TYPES } from '../source/FileIO';

/**
 * FileIO Sink Properties Component
 * 
 * Provides configuration for FileIO.write():
 * - to: Target directory path
 * - prefix: Dynamic or static prefix for output filenames
 * - suffix: File extension (e.g. .parquet, .avro, .txt)
 * - withCompression: Compression algorithm
 * - numShards: Shard count
 * - ignoreEmptyFiles: Boolean flag
 */

interface FileIOSinkNode {
  data: {
    label: string;
    beam_transform?: string;
    properties?: {
      to?: string;
      prefix?: string;
      suffix?: string;
      withCompression?: boolean;
      compression?: string;
      numShards?: string | number;
      ignoreEmptyFiles?: boolean;
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
      {/* Destination Directory */}
      <div className="flex flex-col gap-2">
        <label htmlFor="fileSinkTo" className="text-xs font-bold uppercase text-slate-500">Destination Directory (.to)</label>
        <input
          id="fileSinkTo"
          type="text"
          name="to"
          value={to}
          onChange={handleChange}
          placeholder="gs://my-bucket/output/ or /local/output/"
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500 font-mono"
        />
        <span className="text-xs text-slate-500">
          Root folder or GCS directory where output files are written.
        </span>
      </div>

      {/* Prefix */}
      <div className="flex flex-col gap-2">
        <label htmlFor="fileSinkPrefix" className="text-xs font-bold uppercase text-slate-500">Filename Prefix (.withPrefix)</label>
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
        <label htmlFor="fileSinkSuffix" className="text-xs font-bold uppercase text-slate-500">Filename Suffix (.withSuffix)</label>
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
        <label htmlFor="fileSinkNumShards" className="text-xs font-bold uppercase text-slate-500">Number of Shards (.withNumShards)</label>
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
        </label>

        {withCompression && (
          <div className="flex flex-col gap-1 mt-2">
            <label htmlFor="fileSinkCompression" className="text-xs font-semibold text-slate-400">Compression Algorithm</label>
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
        </label>
      </div>
    </div>
  );
};
