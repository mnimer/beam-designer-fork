import React from 'react';

/**
 * FileIO Source and ReadMatches Properties Component
 * 
 * Supports:
 * - FileIOSourceProperties: For FileIO.match() / matchAll()
 * - FileIOReadMatchesProperties: For FileIO.readMatches()
 */

export const BEAM_COMPRESSION_TYPES = [
  'AUTO',
  'UNCOMPRESSED',
  'BZIP2',
  'GZIP',
  'ZIP',
  'DEFLATE',
  'TAR',
  'XZ',
  'ZSTD'
] as const;

interface FileIOSourceNode {
  data: {
    label: string;
    beam_transform?: string;
    properties?: {
      filePattern?: string;
      emptyMatchTreatment?: 'ALLOW' | 'DISALLOW' | 'ALLOW_IF_WILDCARD';
      continuously?: boolean;
      continuousDuration?: string | number;
      continuousDurationUnit?: 'SECONDS' | 'MINUTES' | 'HOURS' | 'DAYS';
    };
  };
}

interface FileIOSourcePropertiesProps {
  node: FileIOSourceNode;
  onChange: (properties: any) => void;
}

export const FileIOSourceProperties: React.FC<FileIOSourcePropertiesProps> = ({ node, onChange }) => {
  const properties = node.data.properties || {};
  const filePattern = properties.filePattern || '';
  const emptyMatchTreatment = properties.emptyMatchTreatment || 'ALLOW_IF_WILDCARD';
  const continuously = properties.continuously ?? false;
  const continuousDuration = properties.continuousDuration ?? '1';
  const continuousDurationUnit = properties.continuousDurationUnit || 'MINUTES';

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
        <label htmlFor="filePattern" className="text-xs font-bold uppercase text-slate-500">File Pattern (.filepattern)</label>
        <input
          id="filePattern"
          type="text"
          name="filePattern"
          value={filePattern}
          onChange={handleChange}
          placeholder="gs://my-bucket/path/*.csv or /local/path/*.json"
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500 font-mono"
        />
        <span className="text-xs text-slate-500">
          File glob pattern or exact file path to match.
        </span>
      </div>

      {/* Empty Match Treatment */}
      <div className="flex flex-col gap-2">
        <label htmlFor="emptyMatchTreatment" className="text-xs font-bold uppercase text-slate-500">Empty Match Treatment</label>
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
    </div>
  );
};

interface FileIOReadMatchesNode {
  data: {
    label: string;
    beam_transform?: string;
    properties?: {
      withCompression?: boolean;
      compression?: string;
      directoryTreatment?: 'SKIP' | 'PROHIBIT';
    };
  };
}

interface FileIOReadMatchesPropertiesProps {
  node: FileIOReadMatchesNode;
  onChange: (properties: any) => void;
}

export const FileIOReadMatchesProperties: React.FC<FileIOReadMatchesPropertiesProps> = ({ node, onChange }) => {
  const properties = node.data.properties || {};
  const withCompression = properties.withCompression ?? false;
  const compression = properties.compression || 'AUTO';
  const directoryTreatment = properties.directoryTreatment || 'SKIP';

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
        </label>

        {withCompression && (
          <div className="flex flex-col gap-1 mt-2">
            <label htmlFor="readMatchesCompression" className="text-xs font-semibold text-slate-400">Compression Algorithm</label>
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
        <label htmlFor="directoryTreatment" className="text-xs font-bold uppercase text-slate-500">Directory Treatment</label>
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
    </div>
  );
};
