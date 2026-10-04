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
import { BEAM_WRITE_COMPRESSION_TYPES } from '../source/FileIO';
import { InfoTooltip } from '../../components/InfoTooltip';
import { PropertyField } from '../../components/common/PropertyField';
import { SystemInstructionsField } from '../../components/common/SystemInstructionsField';
import { resolveSystemInstructions } from '../../utils/systemInstructions';

/**
 * Node definition for TextIO sink configuration.
 */
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

/**
 * Props for the TextIOSinkProperties component.
 */
interface TextIOSinkPropertiesProps {
  node: TextIOSinkNode;
  onChange: (properties: any) => void;
}

/**
 * TextIOSinkProperties renders the property configuration form for TextIO writes.
 */
export const TextIOSinkProperties: React.FC<TextIOSinkPropertiesProps> = ({ node, onChange }) => {
  const properties = node.data.properties || {};
  const to = properties.to || '';
  const suffix = properties.suffix || '';
  const numShards = properties.numShards ?? '';
  const withoutSharding = properties.withoutSharding ?? false;
  const withCompression = properties.withCompression ?? false;
  const rawCompression = properties.compression || 'UNCOMPRESSED';
  const compression = (rawCompression === 'AUTO' || rawCompression === 'ZIP') ? 'UNCOMPRESSED' : rawCompression;
  const header = properties.header || '';
  const footer = properties.footer || '';

  const isToInvalid = !to.trim();

  // System instructions text with fallback
  const systemInstructions = resolveSystemInstructions(node);

  /**
   * Handles text, number, and select input updates.
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

  return (
    <div className="flex-1 flex flex-col gap-4">
      {/* Destination File Prefix / Path */}
      <PropertyField
        id="textSinkTo"
        name="to"
        label="Destination File Prefix (.to)"
        required={true}
        tooltip="File prefix or path where output shards will be written (e.g. gs://my-bucket/output/data or /local/path/output). Required."
        value={to}
        invalid={isToInvalid}
        error={isToInvalid ? 'Destination file prefix is required.' : null}
        onChange={handleChange}
        placeholder="gs://my-bucket/output/results or /local/out/file"
        helperText={
          isToInvalid ? undefined : 'Output prefix for shards (e.g. gs://bucket/output/data)'
        }
      />

      {/* Suffix */}
      <PropertyField
        id="textSinkSuffix"
        name="suffix"
        label="File Suffix / Extension"
        tooltip="File extension or suffix added to each output shard (e.g. .txt, .csv, .json)."
        value={suffix}
        onChange={handleChange}
        placeholder=".txt, .csv, .json"
      />

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
            <PropertyField
              id="textSinkNumShards"
              name="numShards"
              label="Number of Shards"
              tooltip="Fixed number of shards to write. Set to 0 or leave empty for runner-determined sharding."
              type="number"
              min="0"
              value={numShards}
              onChange={handleChange}
              placeholder="0 (Runner Determined)"
              mono={false}
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
              {BEAM_WRITE_COMPRESSION_TYPES.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Header and Footer */}
      <div className="flex flex-col gap-3">
        <PropertyField
          id="textSinkHeader"
          name="header"
          label="Header Line (Optional)"
          tooltip="Text written once at the beginning of each output file shard (e.g. CSV header line)."
          value={header}
          onChange={handleChange}
          placeholder="id,name,timestamp"
        />
        <PropertyField
          id="textSinkFooter"
          name="footer"
          label="Footer Line (Optional)"
          tooltip="Text written once at the end of each output file shard."
          value={footer}
          onChange={handleChange}
          placeholder="EOF"
        />
      </div>

      {/* Code Generation Instructions */}
      <SystemInstructionsField
        id="textSinkSystemInstructions"
        value={systemInstructions}
        placeholder="Enter custom instructions for TextIO sink code generation..."
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
