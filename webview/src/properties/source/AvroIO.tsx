/**
 * AvroIO Source Properties Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Renders the property panel for Apache Beam AvroIO read operations
 * (Java: `AvroIO.read()` / `AvroIO.readGenericRecords()`, Python: `beam.io.ReadFromAvro`).
 * 
 * Architectural Decisions:
 * - In Apache Beam, Avro reading requires a file pattern or path (`.from(...)` or `file_pattern`).
 * - Supports reading both `GenericRecord` (dynamic/untyped schema) and `SpecificRecord` (compiled Java class).
 * - For GenericRecord, supports automatic schema detection from the Avro container header,
 *   an inline JSON schema with real-time validation and a sample generator button, or an external `.avsc` path.
 * - Exposes file matching semantics (`emptyMatchTreatment`, file validation).
 * - Supports continuous ingestion streaming mode (`watchForNewFiles` in Java / `ReadAllFromAvroContinuously` in Python).
 * - Exposes performance optimizations: `use_fastavro` (Python) and `hintMatchesManyFiles` (Java).
 * - Adheres strictly to the 8pt grid system for spacing (multiples of 8px).
 * - Provides a code generation instructions textarea for custom LLM prompts.
 * 
 * Instructions for Next Model Session:
 * - When extending this component, maintain backward compatibility with existing saved `.beam` property objects.
 * - Any new inputs should provide sensible defaults and InfoTooltip components.
 */

import React, { useMemo } from 'react';
import { InfoTooltip } from '../../components/InfoTooltip';
import { SystemInstructionsField } from '../../components/common/SystemInstructionsField';
import { resolveSystemInstructions } from '../../utils/systemInstructions';
import { StoragePathField } from '../../components/common/StoragePathField';
import { SchemaEditor, BEAM_SCHEMA_TYPES, resolveSchemaFields, type SchemaField } from '../../components/common/SchemaEditor';

/**
 * Standard sample Avro record schema for quick prefilling.
 */
export const SAMPLE_AVRO_SCHEMA = JSON.stringify(
  {
    type: 'record',
    name: 'SampleRecord',
    namespace: 'com.example.avro',
    doc: 'Sample Apache Avro schema',
    fields: [
      { name: 'id', type: 'string', doc: 'Unique identifier' },
      { name: 'name', type: 'string', doc: 'Entity name' },
      { name: 'timestamp', type: 'long', doc: 'Epoch milliseconds' },
      { name: 'active', type: 'boolean', default: true }
    ]
  },
  null,
  2
);

/** React Flow node shape for the AvroIO source panel, including its persisted configuration data. */
export interface AvroIOSourceNode {
  data: {
    label: string;
    beam_transform?: string;
    system_instructions?: string;
    special_instructions?: string;
    properties?: {
      filePattern?: string;
      recordType?: 'GENERIC_RECORD' | 'SPECIFIC_RECORD' | 'PARSE_GENERIC';
      schemaMode?: 'AUTO' | 'INLINE' | 'FILE';
      schemaFields?: SchemaField[];
      schema?: string;
      schemaString?: string;
      schemaPath?: string;
      emptyMatchTreatment?: 'ALLOW' | 'DISALLOW' | 'ALLOW_IF_WILDCARD';
      validate?: boolean;
      watchForNewFiles?: boolean;
      watchInterval?: string | number;
      watchIntervalUnit?: 'SECONDS' | 'MINUTES' | 'HOURS' | 'DAYS';
      useFastavro?: boolean;
      hintMatchesManyFiles?: boolean;
      minBundleSize?: string | number;
      system_instructions?: string;
      special_instructions?: string;
      [key: string]: any;
    };
  };
}

/** Props for the {@link AvroIOSourceProperties} component. */
export interface AvroIOSourcePropertiesProps {
  node: AvroIOSourceNode;
  onChange: (properties: any) => void;
}

/**
 * AvroIOSourceProperties renders the configuration form for reading Avro files.
 */
export const AvroIOSourceProperties: React.FC<AvroIOSourcePropertiesProps> = ({ node, onChange }) => {
  // Extract node properties with fallback defaults
  const properties = node.data.properties || {};
  const filePattern = properties.filePattern || '';
  const recordType = properties.recordType || 'GENERIC_RECORD';
  const schemaMode = properties.schemaMode || 'AUTO';
  const schemaPath = properties.schemaPath || '';
  const emptyMatchTreatment = properties.emptyMatchTreatment || 'ALLOW_IF_WILDCARD';
  const validate = properties.validate ?? true;
  const watchForNewFiles = properties.watchForNewFiles ?? false;
  const watchInterval = properties.watchInterval ?? '1';
  const watchIntervalUnit = properties.watchIntervalUnit || 'MINUTES';
  const useFastavro = properties.useFastavro ?? true;
  const hintMatchesManyFiles = properties.hintMatchesManyFiles ?? false;
  const minBundleSize = properties.minBundleSize ?? '';

  // Required field validation
  const isPatternInvalid = !filePattern.trim();

  // Resolve SchemaField[] from properties
  const schemaFields = useMemo(
    () => resolveSchemaFields(properties),
    [properties.schemaFields, properties.schema, properties.schemaString]
  );

  // Extract instructions with fallbacks
  const systemInstructions = resolveSystemInstructions(node);

  /**
   * Dispatches property change updates to the parent pipeline coordinator.
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
   * Updates schema properties when SchemaEditor changes.
   */
  const handleSchemaChange = (data: {
    schemaFields: SchemaField[];
    schema: string;
    schemaString: string;
  }) => {
    onChange({
      ...properties,
      schemaFields: data.schemaFields,
      schema: data.schema,
      schemaString: data.schemaString
    });
  };

  return (
    <div className="flex-1 flex flex-col gap-4">
      {/* Section 1: File Pattern & Target with GCS Bucket Datalist */}
      <StoragePathField
        id="avroFilePattern"
        name="filePattern"
        label="File Pattern / Path (.from / file_pattern)"
        tooltip="File path or glob pattern to read from (e.g. gs://bucket/data/*.avro or /local/path/*.avro). Required."
        value={filePattern}
        onChange={handleChange}
        placeholder="gs://my-bucket/data/*.avro or /path/to/files/*.avro"
        errorMessage="File Pattern is required."
        helperText={!isPatternInvalid ? 'Path or glob matching Avro files (e.g. gs://bucket/*.avro)' : null}
      />

      {/* Section 2: Record Type & Schema Configuration */}
      <div className="flex flex-col gap-3 p-4 bg-slate-800/40 rounded border border-slate-700/50">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase text-slate-400">Record Type & Schema</span>
          <InfoTooltip text="Choose whether to deserialize into dynamic GenericRecords or generated SpecificRecord classes." />
        </div>

        {/* Record Type Selection */}
        <div className="flex flex-col gap-1">
          <label htmlFor="avroRecordType" className="text-xs font-semibold text-slate-400">
            Record Type
          </label>
          <select
            id="avroRecordType"
            name="recordType"
            value={recordType}
            onChange={handleChange}
            className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
          >
            <option value="GENERIC_RECORD">GenericRecord (Dynamic / Untyped Schema)</option>
            <option value="SPECIFIC_RECORD">SpecificRecord (Generated Record Schema)</option>
            <option value="PARSE_GENERIC">Parse GenericRecord (Custom Parse Function)</option>
          </select>
        </div>

        {/* Options for GenericRecord */}
        {recordType === 'GENERIC_RECORD' && (
          <div className="flex flex-col gap-3 mt-1 pt-3 border-t border-slate-700/40">
            <div className="flex flex-col gap-1">
              <label htmlFor="avroSchemaMode" className="flex items-center text-xs font-semibold text-slate-400">
                <span>Schema Definition Mode</span>
                <InfoTooltip text="Embedded: Reads the schema directly from the Avro file header. Inline: Define reader schema fields or JSON. File: Reference an external .avsc file." />
              </label>
              <select
                id="avroSchemaMode"
                name="schemaMode"
                value={schemaMode}
                onChange={handleChange}
                className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="AUTO">Auto-detect (Embedded in Avro File Header)</option>
                <option value="INLINE">Inline Schema (Reader Schema)</option>
                <option value="FILE">External Schema File (.avsc)</option>
              </select>
            </div>

            {/* Inline Schema Editor */}
            {schemaMode === 'INLINE' && (
              <div className="flex flex-col gap-2">
                <SchemaEditor
                  fields={schemaFields}
                  types={BEAM_SCHEMA_TYPES}
                  schemaTitle="Avro Reader Schema Specification"
                  stringTitle="Avro Schema String"
                  stringPlaceholder="e.g. id:STRING:REQUIRED, name:STRING, timestamp:BIGINT, active:BOOLEAN"
                  jsonTextareaId="avroSourceSchemaJson"
                  stringTextareaId="avroSourceSchemaString"
                  onChange={handleSchemaChange}
                />
                <span className="text-xs text-slate-400">
                  Optional reader schema used for projection or schema evolution.
                </span>
              </div>
            )}

            {/* External Schema File Path */}
            {schemaMode === 'FILE' && (
              <div className="flex flex-col gap-1">
                <label htmlFor="avroSchemaPath" className="text-xs font-semibold text-slate-400">
                  Schema File Path (.avsc)
                </label>
                <input
                  id="avroSchemaPath"
                  type="text"
                  name="schemaPath"
                  value={schemaPath}
                  onChange={handleChange}
                  placeholder="gs://my-bucket/schemas/record.avsc or /path/to/schema.avsc"
                  className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>
            )}
          </div>
        )}

        {/* Options for SpecificRecord: Visual SchemaEditor (Gemini synthesizes the SpecificRecord automatically) */}
        {recordType === 'SPECIFIC_RECORD' && (
          <div className="flex flex-col gap-2.5 mt-1 pt-3 border-t border-slate-700/40">
            <div className="p-2 bg-blue-950/30 rounded border border-blue-900/40 text-xs text-slate-300">
              Define your record fields below. Gemini automatically generates the typed Avro <code className="text-blue-300 font-mono">SpecificRecord</code> / schema class from these fields.
            </div>
            <SchemaEditor
              fields={schemaFields}
              types={BEAM_SCHEMA_TYPES}
              schemaTitle="Avro SpecificRecord Schema"
              stringTitle="Avro SpecificRecord Schema String"
              stringPlaceholder="e.g. id:STRING:REQUIRED, name:STRING, timestamp:BIGINT, active:BOOLEAN"
              jsonTextareaId="avroSourceSpecificSchemaJson"
              stringTextareaId="avroSourceSpecificSchemaString"
              onChange={handleSchemaChange}
            />
          </div>
        )}

        {/* Options for Custom Parse */}
        {recordType === 'PARSE_GENERIC' && (
          <div className="p-2 bg-blue-950/30 rounded border border-blue-900/40 text-xs text-slate-300">
            Generates <code className="text-blue-300 font-mono">AvroIO.parseGenericRecords()</code> using a custom mapping lambda to parse GenericRecords into your custom domain type.
          </div>
        )}
      </div>

      {/* Section 3: File Matching & Ingestion Behavior */}
      <div className="flex flex-col gap-3">
        {/* Empty Match Treatment */}
        <div className="flex flex-col gap-2">
          <label htmlFor="avroEmptyMatchTreatment" className="flex items-center text-xs font-bold uppercase text-slate-500">
            <span>Empty Match Treatment</span>
            <InfoTooltip text="Determines behavior when no files match the pattern: ALLOW_IF_WILDCARD (allow only if pattern contains a wildcard), ALLOW (ignore silently), DISALLOW (fail pipeline)." />
          </label>
          <select
            id="avroEmptyMatchTreatment"
            name="emptyMatchTreatment"
            value={emptyMatchTreatment}
            onChange={handleChange}
            className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
          >
            <option value="ALLOW_IF_WILDCARD">ALLOW_IF_WILDCARD (Recommended)</option>
            <option value="ALLOW">ALLOW</option>
            <option value="DISALLOW">DISALLOW</option>
          </select>
        </div>

        {/* Validate Source Files */}
        <div className="p-3 bg-slate-800/40 rounded border border-slate-700/50">
          <label htmlFor="avroValidate" className="flex items-center gap-2 cursor-pointer">
            <input
              id="avroValidate"
              type="checkbox"
              name="validate"
              checked={validate}
              onChange={handleChange}
              className="w-4 h-4 rounded border-slate-700 text-blue-600 focus:ring-0 focus:ring-offset-0 bg-[#252836]"
            />
            <span className="text-sm font-medium text-slate-300">Validate File Existence</span>
            <InfoTooltip text="Verify that target files exist during pipeline initialization (Python validate=True)." />
          </label>
        </div>

        {/* Continuous Watching (Streaming) */}
        <div className="flex flex-col gap-2 p-3 bg-slate-800/40 rounded border border-slate-700/50">
          <label htmlFor="avroWatchForNewFiles" className="flex items-center gap-2 cursor-pointer">
            <input
              id="avroWatchForNewFiles"
              type="checkbox"
              name="watchForNewFiles"
              checked={watchForNewFiles}
              onChange={handleChange}
              className="w-4 h-4 rounded border-slate-700 text-blue-600 focus:ring-0 focus:ring-offset-0 bg-[#252836]"
            />
            <span className="text-sm font-medium text-slate-300">Watch for New Files (Streaming)</span>
            <InfoTooltip text="Continuously watches for newly created files matching the pattern, converting this source into an unbounded stream." />
          </label>

          {watchForNewFiles && (
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-700/40">
              <div className="flex-1 flex flex-col gap-1">
                <label htmlFor="avroWatchInterval" className="text-xs font-semibold text-slate-400">
                  Polling Interval
                </label>
                <input
                  id="avroWatchInterval"
                  type="number"
                  name="watchInterval"
                  min="1"
                  value={watchInterval}
                  onChange={handleChange}
                  className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="w-32 flex flex-col gap-1">
                <label htmlFor="avroWatchIntervalUnit" className="text-xs font-semibold text-slate-400">
                  Unit
                </label>
                <select
                  id="avroWatchIntervalUnit"
                  name="watchIntervalUnit"
                  value={watchIntervalUnit}
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

      {/* Section 4: Performance & Optimization */}
      <div className="flex flex-col gap-3 p-3 bg-slate-800/40 rounded border border-slate-700/50">
        <span className="text-xs font-bold uppercase text-slate-400">Performance & Tuning</span>

        {/* Use FastAvro (Python) */}
        <label htmlFor="avroUseFastavro" className="flex items-center gap-2 cursor-pointer">
          <input
            id="avroUseFastavro"
            type="checkbox"
            name="useFastavro"
            checked={useFastavro}
            onChange={handleChange}
            className="w-4 h-4 rounded border-slate-700 text-blue-600 focus:ring-0 focus:ring-offset-0 bg-[#252836]"
          />
          <span className="text-sm font-medium text-slate-300">Use FastAvro (Python)</span>
          <InfoTooltip text="Uses the high-performance fastavro library instead of standard avro for significantly faster parsing in Python." />
        </label>

        {/* Hint Matches Many Files (Java) */}
        <label htmlFor="avroHintMatchesManyFiles" className="flex items-center gap-2 cursor-pointer">
          <input
            id="avroHintMatchesManyFiles"
            type="checkbox"
            name="hintMatchesManyFiles"
            checked={hintMatchesManyFiles}
            onChange={handleChange}
            className="w-4 h-4 rounded border-slate-700 text-blue-600 focus:ring-0 focus:ring-offset-0 bg-[#252836]"
          />
          <span className="text-sm font-medium text-slate-300">Hint Matches Many Files (Java)</span>
          <InfoTooltip text="Optimization hint for file patterns matching thousands of files to improve bundle distribution." />
        </label>

        {/* Min Bundle Size */}
        <div className="flex flex-col gap-1 mt-1">
          <label htmlFor="avroMinBundleSize" className="flex items-center text-xs font-semibold text-slate-400">
            <span>Minimum Bundle Size (Bytes)</span>
            <InfoTooltip text="Minimum size in bytes to consider when splitting files into parallel bundles (default 0)." />
          </label>
          <input
            id="avroMinBundleSize"
            type="number"
            name="minBundleSize"
            min="0"
            value={minBundleSize}
            onChange={handleChange}
            placeholder="0 (Runner Default)"
            className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Section 5: Code Generation Instructions */}
      <SystemInstructionsField
        id="avroSourceSystemInstructions"
        value={systemInstructions}
        placeholder="Enter custom instructions for AvroIO source code generation..."
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

