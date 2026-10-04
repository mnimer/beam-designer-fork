/**
 * ThriftIO Sink Properties Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Renders the property configuration panel for Apache Beam ThriftIO Sink nodes
 * (`FileIO.<T>write().via(ThriftIO.sink(protocolFactory)).to(dir).withSuffix(suffix).withCompression(compression).withNumShards(n)`).
 * 
 * Architectural Decisions:
 * - Java-Only Connector (`beam-sdks-java-io-thrift`): `ThriftIO.sink(TProtocolFactory)` returns a
 *   `FileIO.Sink<T>` generic in `T extends TBase<?, ?>`. There is no `withRecordClass` and no
 *   `withShardTemplate` on `FileIO.Write` or `ThriftIO.Sink`, and no `ExternalTransformRegistrar` exists.
 * - Supports configurable `TProtocolFactory`: `TBinaryProtocol`, `TCompactProtocol`, `TJSONProtocol`, `TSimpleJSONProtocol`.
 * - Valid `org.apache.beam.sdk.io.Compression` Enum Values: Supports `UNCOMPRESSED`, `GZIP`, `BZIP2`,
 *   `DEFLATE`, and `ZSTD` (`XZ` does not exist in Beam `Compression`).
 * - Delegates the destination prefix field to the shared `StoragePathField` for Cloud Storage bucket discovery.
 * - Adheres strictly to the 8pt grid system, VS Code theme variables (`var(--vscode-*)`), and Tailwind CSS.
 */

import React, { useState } from 'react';
import { Sliders } from 'lucide-react';
import { InfoTooltip } from '../../components/InfoTooltip';
import { PropertyField } from '../../components/common/PropertyField';
import { SystemInstructionsField } from '../../components/common/SystemInstructionsField';
import { resolveSystemInstructions } from '../../utils/systemInstructions';
import { CollapsibleSection } from '../../components/common/CollapsibleSection';
import { SelectField } from '../../components/common/SelectField';
import { StoragePathField } from '../../components/common/StoragePathField';

/**
 * Node definition for ThriftIO sink configuration.
 */
export interface ThriftIOSinkNode {
  data: {
    label: string;
    beam_transform?: string;
    system_instructions?: string;
    special_instructions?: string;
    properties?: {
      to?: string;
      suffix?: string;
      protocolFactory?: string;
      compression?: string;
      numShards?: string | number;
      system_instructions?: string;
      special_instructions?: string;
      [key: string]: any;
    };
  };
}

/**
 * Props for the ThriftIOSinkProperties component.
 */
export interface ThriftIOSinkPropertiesProps {
  node: ThriftIOSinkNode;
  onChange: (properties: any) => void;
}

export const THRIFT_SINK_PROTOCOL_FACTORIES = [
  { value: 'TBinaryProtocol', label: 'TBinaryProtocol (Default - compact binary format)' },
  { value: 'TCompactProtocol', label: 'TCompactProtocol (Variable-length zig-zag encoding)' },
  { value: 'TJSONProtocol', label: 'TJSONProtocol (Standard JSON encoding with schema)' },
  { value: 'TSimpleJSONProtocol', label: 'TSimpleJSONProtocol (Simplified JSON encoding, write-only)' }
];

export const THRIFT_SINK_COMPRESSION_TYPES = [
  { value: 'UNCOMPRESSED', label: 'UNCOMPRESSED (Default)' },
  { value: 'GZIP', label: 'GZIP (.gz)' },
  { value: 'BZIP2', label: 'BZIP2 (.bz2)' },
  { value: 'DEFLATE', label: 'DEFLATE / ZLIB' },
  { value: 'ZSTD', label: 'ZSTD (.zst)' }
];

/**
 * Properties panel component for configuring ThriftIO sinks.
 */
export const ThriftIOSinkProperties: React.FC<ThriftIOSinkPropertiesProps> = ({ node, onChange }) => {
  const properties = node.data.properties || {};
  const to = properties.to || '';
  const suffix = properties.suffix ?? '.thrift';
  const protocolFactory = properties.protocolFactory || 'TBinaryProtocol';
  const compression = properties.compression || 'UNCOMPRESSED';
  const numShards = properties.numShards ?? '';

  const [isAdvancedOpen, setIsAdvancedOpen] = useState<boolean>(false);

  // Validation: destination directory/prefix (.to) is required.
  // NOTE: the .to rule mirrors StoragePathField's; used here only to gate the helper text.
  const isToInvalid = !to.trim();

  // System instructions text with fallback
  const systemInstructions = resolveSystemInstructions(node);

  /**
   * Handles generic input changes for form fields.
   * NOTE: this panel renders no checkbox inputs, so no boolean coercion branch is needed here.
   */
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;

    onChange({
      ...properties,
      [name]: value
    });
  };

  /**
   * Toggles the advanced sharding accordion state
   */
  const handleToggleAdvanced = () => {
    setIsAdvancedOpen((prev) => !prev);
  };

  return (
    <div className="flex-1 flex flex-col gap-4">
      {/* Java Only Notice */}
      <div
        id="thriftSinkJavaOnlyNotice"
        data-testid="thrift-sink-java-only-notice"
        className="flex items-center justify-between gap-2 p-2.5 rounded border border-[var(--vscode-border)] bg-[var(--vscode-subcard-bg)] text-xs text-[var(--vscode-text-secondary)]"
      >
        <span>
          <strong>Java Only:</strong> <code>ThriftIO</code> is a Java-only node type (<code>beam-sdks-java-io-thrift</code>) and is only supported in Apache Beam Java pipelines.
        </span>
      </div>

      {/* Destination Directory (.to) Input with Cloud Storage bucket autocomplete */}
      <StoragePathField
        id="thriftSinkTo"
        name="to"
        label="Destination Directory / Prefix (.to)"
        tooltip="Base output directory path or prefix passed to FileIO.write().via(ThriftIO.sink(protocolFactory)).to(...) (e.g. gs://bucket/output/records). Required."
        value={to}
        onChange={handleChange}
        placeholder="gs://bucket/output/records, s3://bucket/output/records, or /local/output/records"
        errorMessage="Destination Directory is required."
        helperText={
          !isToInvalid ? (
            <span className="text-xs text-[var(--vscode-text-muted)]">
              Target storage prefix across Cloud Storage, Amazon S3, HDFS, or local storage.
            </span>
          ) : null
        }
      />

      {/* File Suffix Input */}
      <PropertyField
        id="thriftSinkSuffix"
        name="suffix"
        label="File Name Suffix (.withSuffix)"
        tooltip="File extension appended to each shard via FileIO.write().withSuffix(...) (e.g. .thrift). Defaults to .thrift."
        value={suffix}
        onChange={handleChange}
        placeholder=".thrift"
        mono={true}
      />

      {/* Protocol Factory Select */}
      <SelectField
        id="thriftSinkProtocolFactory"
        name="protocolFactory"
        label="Protocol Factory (ThriftIO.sink)"
        tooltip="Thrift protocol factory passed to ThriftIO.sink(protocolFactory) (TBinaryProtocol.Factory, TCompactProtocol.Factory, TJSONProtocol.Factory, or TSimpleJSONProtocol.Factory)."
        value={protocolFactory}
        options={THRIFT_SINK_PROTOCOL_FACTORIES}
        onChange={handleChange}
        helperText={
          <span>
            Binary or text serialization protocol for <code>ThriftIO.sink(protocolFactory)</code>. Defaults to <code>TBinaryProtocol</code>.
          </span>
        }
      />

      {/* Compression Select */}
      <SelectField
        id="thriftSinkCompression"
        name="compression"
        label="Compression (.withCompression)"
        tooltip="Compression codec from org.apache.beam.sdk.io.Compression applied via FileIO.write().withCompression(...). Defaults to UNCOMPRESSED."
        value={compression}
        options={THRIFT_SINK_COMPRESSION_TYPES}
        onChange={handleChange}
      />

      {/* Sharding & Output Options Accordion */}
      <CollapsibleSection
        title="Sharding & Output Options"
        icon={<Sliders className="w-4 h-4 text-emerald-400" />}
        isOpen={isAdvancedOpen}
        onToggle={handleToggleAdvanced}
      >
        {/* Number of Shards */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="thriftSinkNumShards"
            className="flex items-center text-xs font-bold uppercase text-[var(--vscode-text-muted)] gap-1.5"
          >
            <span>Number of Shards (.withNumShards)</span>
            <InfoTooltip text="Fixed number of output shards configured via FileIO.write().withNumShards(int). Set to 0 to let the Beam runner automatically determine sharding dynamically." />
          </label>
          <input
            id="thriftSinkNumShards"
            type="number"
            name="numShards"
            value={numShards}
            onChange={handleChange}
            placeholder="0 (Automatic)"
            min="0"
            className="bg-[var(--vscode-input-bg)] text-[var(--vscode-text-primary)] p-2 rounded border border-[var(--vscode-border)] text-sm focus:outline-none focus:border-[var(--vscode-highlight)] font-mono"
          />
          <span className="text-[11px] text-[var(--vscode-text-muted)]">
            0 or empty lets the runner automatically size output shards.
          </span>
        </div>
      </CollapsibleSection>

      {/* Code Generation Instructions */}
      <SystemInstructionsField
        id="thriftSinkInstructions"
        value={systemInstructions}
        tooltip="Custom instructions provided directly to Gemini when generating pipeline source code for this ThriftIO writer step."
        placeholder="e.g. Write ProcessedOrderRecord instances via FileIO.write().via(ThriftIO.sink()) using TBinaryProtocol."
        wrapperClassName="pt-2 border-t border-[var(--vscode-border-light)]"
        textareaClassName="resize-y h-24"
        helperText="Additional guidance appended to prompt when synthesizing Java code."
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

