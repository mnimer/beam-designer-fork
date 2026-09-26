/**
 * CsvIO Source Properties Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Renders the property configuration panel for Apache Beam CsvIO Source nodes
 * (e.g. org.apache.beam.sdk.io.TextIO.read().from(...) + org.apache.beam.sdk.io.csv.CsvIO.parseRows(schema, csvFormat)
 * in Java, or apache_beam.io.textio.ReadFromCsv(path, splittable=True, **pandas_kwargs) in Python).
 * 
 * Architectural Decisions:
 * - CsvIO read operations require a target file or glob pattern (.from(...) / path).
 * - Delegates the file pattern input to the shared StoragePathField primitive, which owns Google
 *   Cloud Storage bucket auto-discovery, the `gs://` datalist projection, and the inline
 *   discovery error (surfaced regardless of whether the path itself is valid).
 * - Supports predefined Apache Commons CSV formats (DEFAULT, RFC4180, EXCEL, INFORMIX_UNLOAD, MYSQL, POSTGRESQL_CSV, TDF).
 * - Extracts CSV dialect controls (delimiter, quoteChar, nullString, commentMarker) into a reusable local sub-component.
 * - Provides a Beam Schema / column type configuration textarea with a 1-click sample schema generator.
 * - Supports header configuration (hasHeader toggle, explicit header list, skipHeaderLines).
 *   Persists only `header` (the legacy duplicate `headerRow` shadow key was removed to avoid split-brain state).
 *   Documents that Java `CsvIOParseHelpers.validateCsvFormat` requires a non-null, non-empty header on `CSVFormat`
 *   (with `skipHeaderRecord=false`) for `CsvIO.parseRows(schema, csvFormat)`, while Python maps `header` to `names=[...]`.
 * - Defaults `splittable` to `true` to match Python `ReadFromCsv(splittable=True)` so liquid sharding is not silently
 *   disabled, and badges it `(Python ReadFromCsv only)`.
 * - Omits unroutable `minBundleSize` and `validate` controls (neither Java `TextIO.read()` + `CsvIO.parseRows`
 *   nor Python `ReadFromCsv` exposes a bundle-size parameter or configurable validation toggle).
 * - Adheres strictly to the 8pt grid system, VS Code theme variables, and Tailwind CSS classes.
 */

import React, { useState } from 'react';
import { InfoTooltip } from '../../components/InfoTooltip';
import { PropertyField } from '../../components/common/PropertyField';
import { CollapsibleSection } from '../../components/common/CollapsibleSection';
import { SelectField } from '../../components/common/SelectField';
import { StoragePathField } from '../../components/common/StoragePathField';
import { FileCode, Sparkles } from 'lucide-react';

export interface CsvIOSourceNode {
  data: {
    label: string;
    beam_transform?: string;
    system_instructions?: string;
    special_instructions?: string;
    properties?: {
      filePattern?: string;
      csvFormat?: string;
      delimiter?: string;
      quoteChar?: string;
      header?: string;
      hasHeader?: boolean;
      skipHeaderLines?: string | number;
      nullString?: string;
      commentMarker?: string;
      schema?: string;
      splittable?: boolean;
      system_instructions?: string;
      special_instructions?: string;
      [key: string]: any;
    };
  };
}

export interface CsvIOSourcePropertiesProps {
  node: CsvIOSourceNode;
  onChange: (properties: any) => void;
}

/**
 * Predefined Apache Commons CSV CSVFormat specifications supported by Beam CsvIO.
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
 * Sample Beam Schema representing structured typed records parsed from CSV rows.
 */
const SAMPLE_CSV_SCHEMA = JSON.stringify(
  {
    fields: [
      { name: 'id', type: 'STRING' },
      { name: 'name', type: 'STRING' },
      { name: 'email', type: 'STRING' },
      { name: 'amount', type: 'DOUBLE' },
      { name: 'timestamp', type: 'INT64' }
    ]
  },
  null,
  2
);

/**
 * Sub-component for CSV dialect controls (delimiter, quote character, null string, comment marker).
 */
interface CsvSourceDialectProps {
  delimiter?: string;
  quoteChar?: string;
  nullString?: string;
  commentMarker?: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}

const CsvSourceDialectFields: React.FC<CsvSourceDialectProps> = ({
  delimiter = '',
  quoteChar = '',
  nullString = '',
  commentMarker = '',
  onChange
}) => {
  return (
    <div className="flex flex-col gap-3 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border)]">
      <span className="text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
        CSV Dialect Settings
      </span>
      <div className="grid grid-cols-2 gap-3">
        <PropertyField
          id="csvSourceDelimiter"
          name="delimiter"
          label="Delimiter"
          tooltip="Character used to separate columns/fields (e.g. comma ',', tab '\t', pipe '|', semicolon ';'). Defaults to comma or format default."
          value={delimiter}
          onChange={onChange}
          placeholder=","
          mono={true}
        />
        <PropertyField
          id="csvSourceQuoteChar"
          name="quoteChar"
          label="Quote Character"
          tooltip={'Character used to quote values containing delimiters or special characters (e.g. \'"\'). Defaults to double quote.'}
          value={quoteChar}
          onChange={onChange}
          placeholder='"'
          mono={true}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <PropertyField
          id="csvSourceNullString"
          name="nullString"
          label="Null String"
          tooltip="String representation of null values (e.g. '' (empty), '\\N', 'NA', 'NULL')."
          value={nullString}
          onChange={onChange}
          placeholder='"" or \N'
          mono={true}
        />
        <PropertyField
          id="csvSourceCommentMarker"
          name="commentMarker"
          label="Comment Marker"
          tooltip="Character indicating that a line should be treated as a comment and ignored (e.g. '#')."
          value={commentMarker}
          onChange={onChange}
          placeholder="#"
          mono={true}
        />
      </div>
    </div>
  );
};

/**
 * CsvIOSourceProperties renders the property configuration form for CsvIO reads.
 */
export const CsvIOSourceProperties: React.FC<CsvIOSourcePropertiesProps> = ({ node, onChange }) => {
  const properties = node.data.properties || {};
  const filePattern = properties.filePattern || '';
  const csvFormat = properties.csvFormat || 'DEFAULT';
  const delimiter = properties.delimiter || '';
  const quoteChar = properties.quoteChar || '';
  const header = properties.header || '';
  const hasHeader = properties.hasHeader ?? true;
  const skipHeaderLines = properties.skipHeaderLines ?? '';
  const nullString = properties.nullString || '';
  const commentMarker = properties.commentMarker || '';
  const schema = properties.schema || '';
  const splittable = properties.splittable ?? true;

  const [isAdvancedOpen, setIsAdvancedOpen] = useState<boolean>(false);
  const [isSchemaOpen, setIsSchemaOpen] = useState<boolean>(true);

  // Validation: filePattern is required for reading CSV files.
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
   * Inserts a sample Beam Schema definition into the schema field.
   */
  const handleInsertSampleSchema = () => {
    onChange({
      ...properties,
      schema: SAMPLE_CSV_SCHEMA
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
      {/* File Pattern Input with GCS Bucket Datalist */}
      <StoragePathField
        id="csvSourceFilePattern"
        name="filePattern"
        label="File Pattern / Path (.from)"
        tooltip="Target CSV file path or glob pattern (e.g. gs://bucket/*.csv, s3://bucket/*.csv, or /local/*.csv). Required."
        value={filePattern}
        onChange={handleChange}
        placeholder="gs://bucket/data/*.csv, s3://bucket/data/*.csv, or /local/*.csv"
        errorMessage="File Pattern is required."
        helperText={
          !isInvalid ? (
            <span className="text-xs text-[var(--vscode-text-muted)]">
              Target file or glob pattern across Cloud Storage, Amazon S3, HDFS, or local storage.
            </span>
          ) : null
        }
      />

      {/* CSV Format Preset Dropdown */}
      <SelectField
        id="csvSourceFormat"
        name="csvFormat"
        label="CSV Format Specification"
        tooltip="Predefined Apache Commons CSV CSVFormat configuration. In Java, passed to CsvIO.parseRows(schema, csvFormat); in Python, configures delimiter/quote rules."
        value={csvFormat}
        onChange={handleChange}
        options={[...CSV_FORMATS]}
      />

      {/* Reusable CSV Dialect Sub-component */}
      <CsvSourceDialectFields
        delimiter={delimiter}
        quoteChar={quoteChar}
        nullString={nullString}
        commentMarker={commentMarker}
        onChange={handleChange}
      />

      {/* Header Configuration Controls */}
      <div className="flex flex-col gap-3 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border)]">
        <span className="text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          Header Configuration
        </span>

        {/* Has Header Checkbox */}
        <label htmlFor="csvSourceHasHeader" className="flex items-center gap-2 cursor-pointer">
          <input
            id="csvSourceHasHeader"
            type="checkbox"
            name="hasHeader"
            checked={hasHeader}
            onChange={handleChange}
            className="rounded bg-[var(--vscode-input-bg)] border-[var(--vscode-border)] text-blue-500 focus:ring-0 focus:ring-offset-0"
          />
          <span className="text-xs text-[var(--vscode-text-secondary)]">File contains header row (skip/use header)</span>
          <InfoTooltip text="Specifies whether the source CSV files include a header row. In Java CsvIO.parseRows, skipHeaderRecord must remain false on CSVFormat because CsvIOStringToCsvRecord automatically filters lines matching the configured header." />
        </label>

        {/* Explicit Header Row Definition */}
        <PropertyField
          id="csvSourceHeader"
          name="header"
          label="Column Headers / Header Row (Required for Java CsvIO.parseRows)"
          tooltip="Comma-separated column names (e.g. 'id, name, email, amount, timestamp'). Required for Java CsvIO.parseRows(schema, csvFormat) where CsvIOParseHelpers.validateCsvFormat enforces a non-null, non-empty header on CSVFormat (and skipHeaderRecord=false). Maps to names=[...] in Python ReadFromCsv."
          value={header}
          onChange={handleChange}
          placeholder="id, name, email, amount, timestamp"
          mono={true}
          helperText="Explicit header column names are required for Java CsvIO.parseRows(schema, csvFormat) (with skipHeaderRecord=false) and map to names=[...] in Python ReadFromCsv."
        />

        {/* Skip Header Lines Count */}
        <PropertyField
          id="csvSourceSkipHeaderLines"
          name="skipHeaderLines"
          label="Skip Header Lines (Optional)"
          type="number"
          min="0"
          tooltip="Number of lines to skip from the beginning of each file before parsing CSV records."
          value={skipHeaderLines}
          onChange={handleChange}
          placeholder="0"
          mono={true}
        />
      </div>

      {/* Schema Accordion Section */}
      <CollapsibleSection
        title={<>Beam Schema / Column Types (<code>CsvIO.parseRows(schema)</code>)</>}
        icon={<FileCode className="w-4 h-4 text-emerald-400" />}
        isOpen={isSchemaOpen}
        onToggle={() => setIsSchemaOpen(!isSchemaOpen)}
      >
        <div className="flex justify-between items-center mt-2">
          <label htmlFor="csvSourceSchema" className="text-[11px] font-semibold text-[var(--vscode-text-muted)] flex items-center gap-1.5">
            <span>Beam Schema Definition (Field names and types)</span>
            <InfoTooltip text="In Java, CsvIO.parseRows requires a Beam Schema to parse records into PCollection<Row>. In Python, pandas/NamedTuple type annotations map to these types." />
          </label>
          <button
            type="button"
            onClick={handleInsertSampleSchema}
            className="text-[11px] text-[var(--vscode-highlight)] hover:underline flex items-center gap-1 font-medium"
          >
            <Sparkles className="w-3 h-3" />
            <span>Insert Sample</span>
          </button>
        </div>
        <textarea
          id="csvSourceSchema"
          name="schema"
          value={schema}
          onChange={handleChange}
          rows={4}
          placeholder='{"fields": [{"name": "id", "type": "STRING"}, ...]}'
          className="bg-[var(--vscode-input-bg)] text-[var(--vscode-text-primary)] p-2 rounded border border-[var(--vscode-border)] text-xs focus:outline-none focus:border-[var(--vscode-highlight)] font-mono resize-y"
        />
        <span className="text-[11px] text-[var(--vscode-text-muted)]">
          Specify Beam Schema JSON or column definitions for type conversions.
        </span>
      </CollapsibleSection>

      {/* Advanced Settings Accordion */}
      <CollapsibleSection
        title="Advanced Read Tuning & Options"
        isOpen={isAdvancedOpen}
        onToggle={() => setIsAdvancedOpen(!isAdvancedOpen)}
      >
        {/* Splittable Reading Mode */}
        <div className="flex flex-col gap-1 mt-2">
          <label htmlFor="csvSourceSplittable" className="flex items-center gap-2 cursor-pointer">
            <input
              id="csvSourceSplittable"
              type="checkbox"
              name="splittable"
              checked={splittable}
              onChange={handleChange}
              className="rounded bg-[var(--vscode-input-bg)] border-[var(--vscode-border)] text-blue-500 focus:ring-0 focus:ring-offset-0"
            />
            <span className="text-xs text-[var(--vscode-text-secondary)]">
              Splittable Reading Mode (Python ReadFromCsv only)
            </span>
            <InfoTooltip text="Applies to Python ReadFromCsv(splittable=True) only. Controls whether reading can split individual uncompressed CSV files across multiple workers. Java TextIO.read() splits uncompressed files automatically." />
          </label>
          <span className="text-[11px] text-[var(--vscode-text-muted)] pl-6">
            Defaults to <code>true</code> matching Python <code>ReadFromCsv(splittable=True)</code> (Python ReadFromCsv only).
          </span>
        </div>
      </CollapsibleSection>

      {/* Code Generation Instructions */}
      <div className="pt-2 border-t border-[var(--vscode-border-light)]">
        <PropertyField
          id="csvSourceInstructions"
          name="system_instructions"
          label="Code Generation Instructions"
          tooltip="Custom instructions provided directly to Gemini when generating pipeline source code for this CsvIO reader step."
          type="textarea"
          rows={3}
          value={systemInstructions}
          onChange={handleInstructionsChange}
          placeholder="e.g. Parse timestamp using ISO-8601 format, handle empty strings as null, or use specific Row coder."
          mono={false}
          className="resize-y h-24"
          helperText="Additional guidance appended to prompt when synthesizing Java/Python code."
        />
      </div>
    </div>
  );
};
