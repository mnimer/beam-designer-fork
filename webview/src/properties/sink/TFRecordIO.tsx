/**
 * TFRecordIO Sink Properties Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Renders the property configuration panel for Apache Beam TFRecordIO Sink nodes
 * (e.g. TFRecordIO.write().to(...) in Java or beam.io.WriteToTFRecord(...) in Python).
 * 
 * Architectural Decisions:
 * - TFRecordIO write operations require a target destination directory or file path prefix (.to(...)).
 * - Designed for multi-cloud and local file systems (Google Cloud Storage gs://, Amazon S3 s3://, HDFS hdfs://, local files).
 * - Delegates the destination prefix field to the shared StoragePathField, which owns Cloud Storage
 *   bucket discovery, gs:// datalist projection, and the discovery-error alert.
 * - Supports valid write compression codecs (UNCOMPRESSED, GZIP, DEFLATE). `AUTO` is intentionally
 *   excluded from write compression options because `Compression.AUTO.writeCompressed()` throws
 *   `UnsupportedOperationException("AUTO is applicable only to reading files")` in Beam Java.
 * - Exposes sharding controls (numShards, shardTemplate) inside a collapsible accordion.
 * - Supports element coder configuration (BytesCoder, ProtoCoder): in Python `coder=` maps to
 *   `beam.coders.BytesCoder()` or `beam.coders.ProtoCoder(tf.train.Example)`, whereas in Java
 *   `TFRecordIO.write()` accepts `PCollection<byte[]>` and requires upstream serialization.
 * - Composes the shared CollapsibleSection and SelectField primitives instead of redeclaring them.
 * - Adheres strictly to the 8pt grid system, VS Code theme variables, and Tailwind CSS.
 */

import React, { useState } from 'react';
import { InfoTooltip } from '../../components/InfoTooltip';
import { PropertyField } from '../../components/common/PropertyField';
import { CollapsibleSection } from '../../components/common/CollapsibleSection';
import { SelectField } from '../../components/common/SelectField';
import { StoragePathField } from '../../components/common/StoragePathField';
import { Sliders } from 'lucide-react';

export interface TFRecordIOSinkNode {
  data: {
    label: string;
    beam_transform?: string;
    system_instructions?: string;
    special_instructions?: string;
    properties?: {
      to?: string;
      suffix?: string;
      compressionType?: string;
      coder?: string;
      numShards?: string | number;
      shardTemplate?: string;
      system_instructions?: string;
      special_instructions?: string;
      [key: string]: any;
    };
  };
}

export interface TFRecordIOSinkPropertiesProps {
  node: TFRecordIOSinkNode;
  onChange: (properties: any) => void;
}

export const TFRECORD_SINK_COMPRESSION_TYPES = [
  { value: 'UNCOMPRESSED', label: 'UNCOMPRESSED (Standard TFRecord)' },
  { value: 'GZIP', label: 'GZIP (.gz)' },
  { value: 'DEFLATE', label: 'DEFLATE / ZLIB' }
];

export const TFRECORD_SINK_CODER_OPTIONS = [
  { value: 'BytesCoder', label: 'BytesCoder (Default - raw byte[] / beam.coders.BytesCoder())' },
  { value: 'ProtoCoder', label: 'ProtoCoder (beam.coders.ProtoCoder(tf.train.Example))' }
];

export const TFRECORD_SINK_CODERS = TFRECORD_SINK_CODER_OPTIONS;

export const TFRecordIOSinkProperties: React.FC<TFRecordIOSinkPropertiesProps> = ({ node, onChange }) => {
  const properties = node.data.properties || {};
  const to = properties.to || '';
  const suffix = properties.suffix ?? '.tfrecord';
  const compressionType =
    properties.compressionType && properties.compressionType !== 'AUTO'
      ? properties.compressionType
      : 'UNCOMPRESSED';
  const coder = properties.coder || '';
  const numShards = properties.numShards ?? '';
  const shardTemplate = properties.shardTemplate || '';

  const [isAdvancedOpen, setIsAdvancedOpen] = useState<boolean>(false);

  // Validation: destination directory/prefix (.to) is required.
  // NOTE: mirrors StoragePathField's own rule; used here only to gate the helper text.
  const isToInvalid = !to.trim();

  // System instructions text with fallback
  const systemInstructions =
    node.data.system_instructions ??
    node.data.special_instructions ??
    properties.system_instructions ??
    properties.special_instructions ??
    '';

  /**
   * Handles generic input changes for form fields
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
   * Updates AI prompt / system instructions
   */
  const handleInstructionsChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    onChange({
      ...properties,
      system_instructions: e.target.value
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
      {/* Destination Directory (.to) Input with Cloud Storage bucket autocomplete */}
      <StoragePathField
        id="tfrecordSinkTo"
        name="to"
        label="Destination Directory / Prefix (.to)"
        tooltip="Base output directory path or prefix where TFRecord files will be written (e.g. gs://bucket/output/records, s3://bucket/output/records, or /local/output/records). Required."
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
        id="tfrecordSinkSuffix"
        name="suffix"
        label="File Name Suffix"
        tooltip="File extension appended to each shard (e.g. .tfrecord). Defaults to .tfrecord."
        value={suffix}
        onChange={handleChange}
        placeholder=".tfrecord"
        mono={true}
      />

      {/* Compression Type Select */}
      <SelectField
        id="tfrecordSinkCompressionType"
        name="compressionType"
        label="Compression Type"
        tooltip="Compression algorithm applied to output TFRecord files. In Java: TFRecordIO.write().withCompression(Compression) (defaults to UNCOMPRESSED; AUTO is read-only in Java). In Python: WriteToTFRecord(compression_type=...)."
        value={compressionType}
        options={TFRECORD_SINK_COMPRESSION_TYPES}
        onChange={handleChange}
      />

      {/* Record Coder */}
      <PropertyField
        id="tfrecordSinkCoder"
        name="coder"
        label="Record Coder (Optional)"
        tooltip="Coder used to serialize elements to bytes. In Python, coder= maps to beam.coders.BytesCoder() or beam.coders.ProtoCoder(tf.train.Example). In Java, TFRecordIO.write() accepts PCollection<byte[]> and requires upstream serialization (e.g. MapElements via Example::toByteArray)."
        value={coder}
        onChange={handleChange}
        placeholder="BytesCoder"
        mono={true}
        list="tfrecord-sink-coder-options"
        datalist={TFRECORD_SINK_CODER_OPTIONS}
        helperText={
          <span className="text-[11px] text-[var(--vscode-text-muted)]">
            In Python, <code>coder=</code> maps to <code>beam.coders.BytesCoder()</code> / <code>beam.coders.ProtoCoder(tf.train.Example)</code>. In Java, <code>TFRecordIO.write()</code> accepts <code>PCollection&lt;byte[]&gt;</code> (upstream serialization).
          </span>
        }
      />

      {/* Sharding & Output Options Accordion */}
      <CollapsibleSection
        title="Sharding & Shard Template Options"
        icon={<Sliders className="w-4 h-4 text-emerald-400" />}
        isOpen={isAdvancedOpen}
        onToggle={handleToggleAdvanced}
      >
        {/* Number of Shards */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="tfrecordSinkNumShards"
            className="flex items-center text-xs font-bold uppercase text-[var(--vscode-text-muted)] gap-1.5"
          >
            <span>Number of Shards</span>
            <InfoTooltip text="Fixed number of output shards. Set to 0 to let the Beam runner automatically determine sharding dynamically." />
          </label>
          <input
            id="tfrecordSinkNumShards"
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

        {/* Shard Template */}
        <PropertyField
          id="tfrecordSinkShardTemplate"
          name="shardTemplate"
          label="Shard Name Template (Optional)"
          tooltip="Custom template for shard naming (e.g. -SSSSS-of-NNNNN). Leave blank for Beam standard default."
          value={shardTemplate}
          onChange={handleChange}
          placeholder="-SSSSS-of-NNNNN"
          mono={true}
        />
      </CollapsibleSection>

      {/* Code Generation Instructions */}
      <div className="pt-2 border-t border-[var(--vscode-border-light)]">
        <PropertyField
          id="tfrecordSinkInstructions"
          name="system_instructions"
          label="Code Generation Instructions"
          tooltip="Custom instructions provided directly to Gemini when generating pipeline source code for this TFRecordIO writer step."
          type="textarea"
          rows={3}
          value={systemInstructions}
          onChange={handleInstructionsChange}
          placeholder="e.g. Ensure TFRecord writer configures GZIP compression and shards into 10 partitions."
          mono={false}
          className="resize-y h-24"
          helperText="Additional guidance appended to prompt when synthesizing Java/Python code."
        />
      </div>
    </div>
  );
};
