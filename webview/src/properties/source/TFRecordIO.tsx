/**
 * TFRecordIO Source Properties Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Renders the property configuration panel for Apache Beam TFRecordIO Source nodes
 * (e.g. TFRecordIO.read().from(...) in Java or beam.io.ReadFromTFRecord(...) in Python).
 * 
 * Architectural Decisions:
 * - TFRecordIO read operations require a target file or glob pattern (.from(...)).
 * - Designed for multi-cloud and local file systems (Google Cloud Storage gs://, Amazon S3 s3://, HDFS hdfs://, local files).
 * - Delegates the file pattern field to the shared StoragePathField, which owns Cloud Storage
 *   bucket discovery, gs:// datalist projection, and the discovery-error alert.
 * - Supports standard TFRecord compression codecs (AUTO, UNCOMPRESSED, GZIP, DEFLATE).
 * - Exposes coder options for deserializing binary records (BytesCoder or ProtoCoder). In Python,
 *   `coder=` maps directly to `beam.coders.BytesCoder()` or `beam.coders.ProtoCoder(tf.train.Example)`,
 *   whereas in Java `TFRecordIO.read()` always emits `PCollection<byte[]>` and requires a downstream
 *   `MapElements` / `ParDo` transform when a non-bytes coder is chosen.
 * - Non-Splittable Source (NO `minBundleSize` field): TFRecord sources are hardcoded non-splittable in
 *   both Java (`Long.MAX_VALUE`, `isSplittable() = false`) and Python (`splittable=False`), so
 *   `minBundleSize` is intentionally absent.
 * - Supports pipeline startup file existence validation toggle (.withoutValidation()).
 * - Composes the shared SelectField and StoragePathField primitives instead of redeclaring them.
 * - Adheres strictly to the 8pt grid system, VS Code theme variables, and Tailwind CSS.
 */

import React from 'react';
import { InfoTooltip } from '../../components/InfoTooltip';
import { PropertyField } from '../../components/common/PropertyField';
import { SelectField } from '../../components/common/SelectField';
import { StoragePathField } from '../../components/common/StoragePathField';

export interface TFRecordIOSourceNode {
  data: {
    label: string;
    beam_transform?: string;
    system_instructions?: string;
    special_instructions?: string;
    properties?: {
      filePattern?: string;
      compressionType?: string;
      coder?: string;
      validate?: boolean;
      system_instructions?: string;
      special_instructions?: string;
      [key: string]: any;
    };
  };
}

export interface TFRecordIOSourcePropertiesProps {
  node: TFRecordIOSourceNode;
  onChange: (properties: any) => void;
}

export const TFRECORD_COMPRESSION_TYPES = [
  { value: 'AUTO', label: 'AUTO (Detect from file extension)' },
  { value: 'UNCOMPRESSED', label: 'UNCOMPRESSED (Standard TFRecord)' },
  { value: 'GZIP', label: 'GZIP (.gz)' },
  { value: 'DEFLATE', label: 'DEFLATE / ZLIB' }
];

export const TFRECORD_CODER_OPTIONS = [
  { value: 'BytesCoder', label: 'BytesCoder (Default - raw byte[] / beam.coders.BytesCoder())' },
  { value: 'ProtoCoder', label: 'ProtoCoder (beam.coders.ProtoCoder(tf.train.Example))' }
];

export const TFRECORD_CODERS = TFRECORD_CODER_OPTIONS;

export const TFRecordIOSourceProperties: React.FC<TFRecordIOSourcePropertiesProps> = ({ node, onChange }) => {
  const properties = node.data.properties || {};
  const filePattern = properties.filePattern || '';
  const compressionType = properties.compressionType || 'AUTO';
  const coder = properties.coder || '';
  const validate = properties.validate ?? true;

  // Validation: filePattern is required for reading TFRecord files.
  // NOTE: mirrors StoragePathField's own rule; used here only to gate the helper text.
  const isInvalid = !filePattern.trim();

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

  return (
    <div className="flex-1 flex flex-col gap-4">
      {/* File Pattern Input with Cloud Storage bucket autocomplete */}
      <StoragePathField
        id="tfrecordSourceFilePattern"
        name="filePattern"
        label="File Pattern / Path (.from)"
        tooltip="Target TFRecord file path or glob pattern (e.g. gs://bucket/data/*.tfrecord, s3://bucket/data/*.tfrecord, or /local/*.tfrecord). Required."
        value={filePattern}
        onChange={handleChange}
        placeholder="gs://bucket/data/*.tfrecord, s3://bucket/*.tfrecord, or /local/*.tfrecord"
        errorMessage="File Pattern is required."
        helperText={
          !isInvalid ? (
            <span className="text-xs text-[var(--vscode-text-muted)]">
              Target file or glob pattern across Cloud Storage, Amazon S3, HDFS, or local storage.
            </span>
          ) : null
        }
      />

      {/* Compression Type Select */}
      <SelectField
        id="tfrecordSourceCompressionType"
        name="compressionType"
        label="Compression Type"
        tooltip="Compression codec used for input TFRecord files. In Java: TFRecordIO.read().withCompression(Compression). In Python: ReadFromTFRecord(compression_type=...). AUTO detects from extension."
        value={compressionType}
        options={TFRECORD_COMPRESSION_TYPES}
        onChange={handleChange}
      />

      {/* Record Coder */}
      <PropertyField
        id="tfrecordSourceCoder"
        name="coder"
        label="Record Coder (Optional)"
        tooltip="Coder used to deserialize binary records. In Python, coder= maps to beam.coders.BytesCoder() or beam.coders.ProtoCoder(tf.train.Example). In Java, TFRecordIO.read() always emits PCollection<byte[]> and uses a downstream MapElements / ParDo when a non-bytes coder is chosen."
        value={coder}
        onChange={handleChange}
        placeholder="BytesCoder"
        mono={true}
        list="tfrecord-source-coder-options"
        datalist={TFRECORD_CODER_OPTIONS}
        helperText={
          <span className="text-[11px] text-[var(--vscode-text-muted)]">
            In Python, <code>coder=</code> maps to <code>beam.coders.BytesCoder()</code> / <code>beam.coders.ProtoCoder(tf.train.Example)</code>. In Java, <code>TFRecordIO.read()</code> always emits <code>PCollection&lt;byte[]&gt;</code> and uses a downstream <code>MapElements</code> / <code>ParDo</code> when a non-bytes coder is chosen.
          </span>
        }
      />

      {/* Validate Checkbox */}
      <label htmlFor="tfrecordSourceValidate" className="flex items-center gap-2 cursor-pointer">
        <input
          id="tfrecordSourceValidate"
          type="checkbox"
          name="validate"
          checked={validate}
          onChange={handleChange}
          className="rounded bg-[var(--vscode-input-bg)] border-[var(--vscode-border)] text-blue-500 focus:ring-0 focus:ring-offset-0"
        />
        <span className="text-xs text-[var(--vscode-text-secondary)]">
          Validate file existence on pipeline startup
        </span>
        <InfoTooltip text="Validates input file pattern matches at pipeline construction time. If disabled in Java, calls .withoutValidation(). In Python, sets validate=False." />
      </label>

      {/* Code Generation Instructions */}
      <div className="pt-2 border-t border-[var(--vscode-border-light)]">
        <PropertyField
          id="tfrecordSourceInstructions"
          name="system_instructions"
          label="Code Generation Instructions"
          tooltip="Custom instructions provided directly to Gemini when generating pipeline source code for this TFRecordIO reader step."
          type="textarea"
          rows={3}
          value={systemInstructions}
          onChange={handleInstructionsChange}
          placeholder="e.g. Parse serialized tf.train.Example proto records into FeatureDict representations."
          mono={false}
          className="resize-y h-24"
          helperText="Additional guidance appended to prompt when synthesizing Java/Python code."
        />
      </div>
    </div>
  );
};
