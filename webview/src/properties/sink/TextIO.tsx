import React from 'react';
import { BEAM_COMPRESSION_TYPES } from '../source/FileIO';

/**
 * TextIO Sink Properties Component
 * 
 * This component provides configuration forms for TextIO Sink:
 * - to: Output file prefix / directory
 * - suffix: Output file extension (.txt, .csv, etc.)
 * - numShards: Number of shards to produce
 * - withoutSharding: Write all output elements to a single file
 * - withCompression: Checkbox + compression algorithm selector
 * - header: Optional header line added to the top of each shard
 * - footer: Optional footer line added to the end of each shard
 */

interface TextIOSinkNode {
  data: {
    label: string;
    beam_transform?: string;
    properties?: {
      to?: string;
      suffix?: string;
      numShards?: string | number;
      withoutSharding?: boolean;
      withCompression?: boolean;
      compression?: string;
      header?: string;
      footer?: string;
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
      {/* Destination File Prefix / Path */}
      <div className="flex flex-col gap-2">
        <label htmlFor="textSinkTo" className="text-xs font-bold uppercase text-slate-500">Destination File Prefix (.to)</label>
        <input
          id="textSinkTo"
          type="text"
          name="to"
          value={to}
          onChange={handleChange}
          placeholder="gs://my-bucket/output/results or /local/out/file"
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500 font-mono"
        />
        <span className="text-xs text-slate-500">
          Output prefix for shards (e.g. gs://bucket/output/data)
        </span>
      </div>

      {/* Suffix */}
      <div className="flex flex-col gap-2">
        <label htmlFor="textSinkSuffix" className="text-xs font-bold uppercase text-slate-500">File Suffix / Extension</label>
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
        </label>

        {!withoutSharding && (
          <div className="flex flex-col gap-1 mt-1">
            <label htmlFor="textSinkNumShards" className="text-xs font-semibold text-slate-400">Number of Shards</label>
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
        </label>

        {withCompression && (
          <div className="flex flex-col gap-1 mt-2">
            <label htmlFor="textSinkCompression" className="text-xs font-semibold text-slate-400">Compression Algorithm</label>
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
          <label htmlFor="textSinkHeader" className="text-xs font-bold uppercase text-slate-500">Header Line (Optional)</label>
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
          <label htmlFor="textSinkFooter" className="text-xs font-bold uppercase text-slate-500">Footer Line (Optional)</label>
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
    </div>
  );
};
