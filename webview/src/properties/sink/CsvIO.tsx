/**
 * CsvIO Sink Properties Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Renders the property configuration panel for Apache Beam CsvIO Sink nodes
 * (e.g. org.apache.beam.sdk.io.csv.CsvIO.writeRows(to, csvFormat) in Java
 * or apache_beam.io.textio.WriteToCsv(path, num_shards=..., ...) in Python).
 * 
 * Architectural Decisions:
 * - CsvIO write operations require a destination directory or file path prefix (.to(...)).
 * - Delegates the destination path input to the shared StoragePathField primitive, which owns Google
 *   Cloud Storage bucket auto-discovery, the `gs://` datalist projection, and the inline
 *   discovery error (surfaced regardless of whether the path itself is valid).
 * - Supports predefined Apache Commons CSV formats (DEFAULT, RFC4180, EXCEL, INFORMIX_UNLOAD, MYSQL, POSTGRESQL_CSV, TDF).
 * - Extracts CSV dialect controls (delimiter, quoteChar, nullString) into a reusable local sub-component.
 * - Supports header configuration (header string, writeHeader toggle).
 * - Composes the shared SelectField primitive instead of redeclaring dropdown markup, exposing
 *   supported Beam Java Compression codecs (UNCOMPRESSED, GZIP, BZIP2, DEFLATE, ZSTD — `XZ` is omitted
 *   because `Compression.java` does not implement XZ) and documenting that compression applies to Java
 *   `CsvIO.writeRows(to, csvFormat).withCompression(Compression)` (while Python `WriteToCsv` raises
 *   `NotImplementedError` if `compression` is passed).
 * - Adheres strictly to the 8pt grid system, VS Code theme variables, and Tailwind CSS classes.
 */

import React from 'react';
import { InfoTooltip } from '../../components/InfoTooltip';
import { PropertyField } from '../../components/common/PropertyField';
import { SelectField } from '../../components/common/SelectField';
import { StoragePathField } from '../../components/common/StoragePathField';

export interface CsvIOSinkNode {
  data: {
    label: string;
    beam_transform?: string;
    system_instructions?: string;
    special_instructions?: string;
    properties?: {
      to?: string;
      suffix?: string;
      csvFormat?: string;
      delimiter?: string;
      quoteChar?: string;
      header?: string;
      writeHeader?: boolean;
      nullString?: string;
      compression?: string;
      numShards?: string | number;
      shardTemplate?: string;
      system_instructions?: string;
      special_instructions?: string;
      [key: string]: any;
    };
  };
}

export interface CsvIOSinkPropertiesProps {
  node: CsvIOSinkNode;
  onChange: (properties: any) => void;
}

/**
 * Predefined Apache Commons CSV CSVFormat specifications supported by Beam CsvIO writes.
 */
export const CSV_FORMATS = [
  { value: 'DEFAULT', label: 'DEFAULT (Standard Apache Commons CSV)' },
  { value: 'RFC4180', label: 'RFC4180 (Strict RFC 4180 Standard)' },
  { value: 'EXCEL', label: 'EXCEL (Microsoft Excel format)' },
  { value: 'INFORMIX_UNLOAD', label: 'INFORMIX_UNLOAD (Informix UNLOAD format)' },
  { value: 'MYSQL', label: 'MYSQL (MySQL format)' },
  { value: 'POSTGRESQL_CSV', label: 'POSTGRESQL_CSV (PostgreSQL CSV format)' },
  { value: 'TDF', label: 'TDF (Tab-Delimited format)' }
] as const;

/**
 * Supported compression algorithms for CSV output files (Java CsvIO.Write.withCompression).
 * Note: 'XZ' is omitted because org.apache.beam.sdk.io.Compression does not include XZ.
 */
export const CSV_COMPRESSION_TYPES = [
  { value: 'UNCOMPRESSED', label: 'UNCOMPRESSED (Standard CSV)' },
  { value: 'GZIP', label: 'GZIP (.gz)' },
  { value: 'BZIP2', label: 'BZIP2 (.bz2)' },
  { value: 'DEFLATE', label: 'DEFLATE' },
  { value: 'ZSTD', label: 'ZSTD' }
] as const;

export const CSV_SINK_COMPRESSION_TYPES = CSV_COMPRESSION_TYPES;

/**
 * Sub-component for CSV dialect controls on sink (delimiter, quote character, null string).
 */
interface CsvSinkDialectProps {
  delimiter?: string;
  quoteChar?: string;
  nullString?: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}

const CsvSinkDialectFields: React.FC<CsvSinkDialectProps> = ({
  delimiter = '',
  quoteChar = '',
  nullString = '',
  onChange
}) => {
  return (
    <div className="flex flex-col gap-3 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border)]">
      <span className="text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
        CSV Dialect Settings
      </span>
      <div className="grid grid-cols-2 gap-3">
        <PropertyField
          id="csvSinkDelimiter"
          name="delimiter"
          label="Delimiter"
          tooltip="Character used to separate columns/fields (e.g. comma ',', tab '\t', pipe '|', semicolon ';'). Defaults to comma or dialect standard."
          value={delimiter}
          onChange={onChange}
          placeholder=","
          mono={true}
        />
        <PropertyField
          id="csvSinkQuoteChar"
          name="quoteChar"
          label="Quote Character"
          tooltip={'Character used to quote values containing delimiters or special characters (e.g. \'"\'). Defaults to double quote.'}
          value={quoteChar}
          onChange={onChange}
          placeholder='"'
          mono={true}
        />
      </div>
      <PropertyField
        id="csvSinkNullString"
        name="nullString"
        label="Null String"
        tooltip="String representation to output for null/empty values (e.g. '' (empty), '\\N', 'NA', 'NULL')."
        value={nullString}
        onChange={onChange}
        placeholder='"" or \N'
        mono={true}
      />
    </div>
  );
};

/**
 * CsvIOSinkProperties renders the property configuration form for CsvIO writes.
 */
export const CsvIOSinkProperties: React.FC<CsvIOSinkPropertiesProps> = ({ node, onChange }) => {
  const properties = node.data.properties || {};
  const to = properties.to || '';
  const suffix = properties.suffix ?? '.csv';
  const csvFormat = properties.csvFormat || 'DEFAULT';
  const delimiter = properties.delimiter || '';
  const quoteChar = properties.quoteChar || '';
  const header = properties.header || '';
  const writeHeader = properties.writeHeader ?? true;
  const nullString = properties.nullString || '';
  const compression = properties.compression || 'UNCOMPRESSED';
  const numShards = properties.numShards ?? '';
  const shardTemplate = properties.shardTemplate || '';

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
   * Handles form input changes for text, select, and checkbox fields.
   *
   * @param e Form change event from input, select, or textarea
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
   * Updates AI prompt / system instructions for code synthesis.
   *
   * @param e Form change event from textarea
   */
  const handleInstructionsChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    onChange({
      ...properties,
      system_instructions: e.target.value
    });
  };

  return (
    <div className="flex-1 flex flex-col gap-4">
      {/* Destination Directory (.to) Input with GCS Bucket Datalist */}
      <StoragePathField
        id="csvSinkTo"
        name="to"
        label="Destination Directory / Prefix (.to)"
        tooltip="Base output directory path or prefix where CSV files will be written (e.g. gs://bucket/output/, s3://bucket/output/, or /local/output/). Required."
        value={to}
        onChange={handleChange}
        placeholder="gs://bucket/output/, s3://bucket/output/, or /local/output/"
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
        id="csvSinkSuffix"
        name="suffix"
        label="File Name Suffix"
        tooltip="File extension appended to each shard (e.g. .csv or .tsv). Defaults to .csv."
        value={suffix}
        onChange={handleChange}
        placeholder=".csv"
        mono={true}
      />

      {/* CSV Format Preset Dropdown */}
      <SelectField
        id="csvSinkFormat"
        name="csvFormat"
        label="CSV Format Specification"
        tooltip="Predefined Apache Commons CSV CSVFormat configuration. In Java, passed to CsvIO.<T>write(to, csvFormat); in Python, configures delimiter/quote rules."
        value={csvFormat}
        onChange={handleChange}
        options={[...CSV_FORMATS]}
      />

      {/* Reusable CSV Dialect Sub-component */}
      <CsvSinkDialectFields
        delimiter={delimiter}
        quoteChar={quoteChar}
        nullString={nullString}
        onChange={handleChange}
      />

      {/* Header Configuration Controls */}
      <div className="flex flex-col gap-3 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border)]">
        <span className="text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          Header Configuration
        </span>

        {/* Write Header Checkbox */}
        <label htmlFor="csvSinkWriteHeader" className="flex items-center gap-2 cursor-pointer">
          <input
            id="csvSinkWriteHeader"
            type="checkbox"
            name="writeHeader"
            checked={writeHeader}
            onChange={handleChange}
            className="rounded bg-[var(--vscode-input-bg)] border-[var(--vscode-border)] text-blue-500 focus:ring-0 focus:ring-offset-0"
          />
          <span className="text-xs text-[var(--vscode-text-secondary)]">Write Header Line to Output Files</span>
          <InfoTooltip text="Whether to write a header row as the first line of each output CSV shard." />
        </label>

        {/* Header line */}
        <PropertyField
          id="csvSinkHeader"
          name="header"
          label="Header Line / Column Names"
          tooltip="Comma-separated column names to emit as the header row (e.g. 'id, name, email, amount, timestamp'). Leave empty to use schema field names."
          value={header}
          onChange={handleChange}
          placeholder="id, name, email, amount, timestamp"
          mono={true}
          helperText="Custom column header line written at the top of each file shard."
        />
      </div>

      {/* Compression Codec Dropdown */}
      <SelectField
        id="csvSinkCompression"
        name="compression"
        label="Compression Codec"
        tooltip="File compression applied to output CSV shards via Java CsvIO.writeRows(to, csvFormat).withCompression(Compression). Python WriteToCsv raises NotImplementedError if compression is passed."
        value={compression}
        onChange={handleChange}
        options={[...CSV_COMPRESSION_TYPES]}
        helperText={
          <span>
            Applies to Java <code>CsvIO.writeRows(to, csvFormat).withCompression(Compression)</code> (Python <code>WriteToCsv</code> raises <code>NotImplementedError</code> if <code>compression</code> is passed).
          </span>
        }
      />

      {/* Sharding Configuration */}
      <div className="flex flex-col gap-3 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border)]">
        <span className="text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          Sharding & File Output
        </span>
        <PropertyField
          id="csvSinkNumShards"
          type="number"
          name="numShards"
          label="Number of Shards"
          tooltip="Fixed number of output shards. Set to 0 or leave empty to let the Beam runner determine sharding dynamically."
          value={numShards}
          onChange={handleChange}
          placeholder="0 (Automatic)"
          min="0"
          mono={true}
          helperText="0 or empty lets the runner automatically size output shards."
        />

        <PropertyField
          id="csvSinkShardTemplate"
          name="shardTemplate"
          label="Shard Name Template (Optional)"
          tooltip="Custom template for shard naming (e.g. -SSSSS-of-NNNNN). Leave blank for Beam standard default."
          value={shardTemplate}
          onChange={handleChange}
          placeholder="-SSSSS-of-NNNNN"
          mono={true}
        />
      </div>

      {/* Code Generation Instructions */}
      <div className="pt-2 border-t border-[var(--vscode-border-light)]">
        <PropertyField
          id="csvSinkInstructions"
          name="system_instructions"
          label="Code Generation Instructions"
          tooltip="Custom instructions provided directly to Gemini when generating pipeline source code for this CsvIO writer step."
          type="textarea"
          rows={3}
          value={systemInstructions}
          onChange={handleInstructionsChange}
          placeholder="e.g. Write CSV rows using RFC4180 dialect with custom date-time formatter and GZIP compression."
          mono={false}
          className="resize-y h-24"
          helperText="Additional guidance appended to prompt when synthesizing Java/Python code."
        />
      </div>
    </div>
  );
};
