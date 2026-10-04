/**
 * AvroIO Sink Properties Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Renders the property panel for Apache Beam AvroIO write operations
 * (Java: `AvroIO.write()` / `AvroIO.writeGenericRecords()`, Python: `beam.io.WriteToAvro`).
 * 
 * Architectural Decisions:
 * - In Apache Beam, writing Avro files requires a destination file prefix (`.to(...)` or `file_path_prefix`)
 *   and an Avro schema (for GenericRecords) or compiled class (for SpecificRecords).
 * - Enforces required field indicators and real-time validation on `to` and schema inputs.
 * - Provides an "Insert Sample Schema" shortcut and live JSON schema validation for GenericRecord writes.
 * - Exposes Avro container block compression codecs (Deflate, Snappy, Bzip2, XZ, Zstandard, Null/Uncompressed)
 *   with Deflate compression level tuning (1-9).
 * - Provides full sharding configuration (runner-determined sharding, fixed numShards, or single un-sharded file).
 * - Exposes performance optimizations (Python `use_fastavro`) and custom Avro file container header metadata.
 * - Strictly follows the 8pt grid system for spacing (multiples of 8px).
 * - Includes a dedicated code generation instructions textarea for custom LLM prompts.
 * 
 * Instructions for Next Model Session:
 * - When extending this component, maintain backward compatibility with existing saved `.beam` property objects.
 * - Any new inputs should provide sensible defaults and InfoTooltip components.
 */

import React, { useMemo } from 'react';
import { InfoTooltip } from '../../components/InfoTooltip';
import { PropertyField } from '../../components/common/PropertyField';
import { SystemInstructionsField } from '../../components/common/SystemInstructionsField';
import { resolveSystemInstructions } from '../../utils/systemInstructions';
import { StoragePathField } from '../../components/common/StoragePathField';
import { SchemaEditor, BEAM_SCHEMA_TYPES, resolveSchemaFields, type SchemaField } from '../../components/common/SchemaEditor';

export const AVRO_CODECS = [
  { value: 'DEFLATE', label: 'DEFLATE (Balanced / Standard Default)', tooltip: 'Standard Avro container compression offering good compression ratio and speed.' },
  { value: 'SNAPPY', label: 'SNAPPY (High Throughput / Low CPU)', tooltip: 'Ultra-fast compression codec widely used in big data processing pipelines.' },
  { value: 'BZIP2', label: 'BZIP2 (High Compression)', tooltip: 'High compression ratio at the expense of higher CPU overhead.' },
  { value: 'XZ', label: 'XZ (Extreme Compression)', tooltip: 'Very high compression ratio, ideal for long-term archiving.' },
  { value: 'ZSTANDARD', label: 'ZSTANDARD (Modern Fast & High Ratio)', tooltip: 'Modern high-performance compression with tunable ratio.' },
  { value: 'NULL', label: 'NULL / UNCOMPRESSED', tooltip: 'No compression applied to data blocks.' },
] as const;

/**
 * React Flow node shape for the Avro sink panel, including its persisted configuration data.
 */
export interface AvroIOSinkNode {
  data: {
    label: string;
    beam_transform?: string;
    system_instructions?: string;
    special_instructions?: string;
    properties?: {
      to?: string;
      suffix?: string;
      shardNameTemplate?: string;
      schemaType?: 'GENERIC_RECORD' | 'SPECIFIC_RECORD';
      schemaMode?: 'INLINE' | 'FILE';
      schemaFields?: SchemaField[];
      schema?: string;
      schemaString?: string;
      schemaPath?: string;
      codec?: 'DEFLATE' | 'SNAPPY' | 'BZIP2' | 'XZ' | 'ZSTANDARD' | 'NULL';
      deflateLevel?: string | number;
      withoutSharding?: boolean;
      numShards?: string | number;
      useFastavro?: boolean;
      metadata?: string;
      system_instructions?: string;
      special_instructions?: string;
      [key: string]: any;
    };
  };
}

/**
 * Props for the AvroIOSinkProperties component.
 */
export interface AvroIOSinkPropertiesProps {
  node: AvroIOSinkNode;
  onChange: (properties: any) => void;
}

/**
 * AvroIOSinkProperties renders the configuration form for writing Avro files.
 */
export const AvroIOSinkProperties: React.FC<AvroIOSinkPropertiesProps> = ({ node, onChange }) => {
  // Extract node properties with defaults
  const properties = node.data.properties || {};
  const to = properties.to || '';
  const suffix = properties.suffix ?? '.avro';
  const shardNameTemplate = properties.shardNameTemplate || '';
  const schemaType = properties.schemaType || 'GENERIC_RECORD';
  const schemaMode = properties.schemaMode || 'INLINE';
  const schemaPath = properties.schemaPath || '';
  const codec = properties.codec || 'DEFLATE';
  const deflateLevel = properties.deflateLevel ?? '6';
  const withoutSharding = properties.withoutSharding ?? false;
  const numShards = properties.numShards ?? '';
  const useFastavro = properties.useFastavro ?? true;
  const metadata = properties.metadata || '';

  // Required field validations
  const isToInvalid = !to.trim();
  const isSchemaPathMissing = schemaType === 'GENERIC_RECORD' && schemaMode === 'FILE' && !schemaPath.trim();

  // Resolve SchemaField[] from properties
  const schemaFields = useMemo(
    () => resolveSchemaFields(properties),
    [properties.schemaFields, properties.schema, properties.schemaString]
  );

  // Extract instructions with fallbacks
  const systemInstructions = resolveSystemInstructions(node);

  /**
   * Dispatches updates to parent pipeline coordinator.
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
      {/* Section 1: Destination & Shard Naming with GCS Bucket Datalist */}
      <StoragePathField
        id="avroSinkTo"
        name="to"
        label="Destination File Prefix (.to / file_path_prefix)"
        tooltip="File prefix or path where Avro output shards will be written (e.g. gs://my-bucket/output/data or /local/path/output). Required."
        value={to}
        onChange={handleChange}
        placeholder="gs://my-bucket/output/records or /path/to/output"
        errorMessage="Destination file prefix is required."
        helperText={isToInvalid ? undefined : 'Output file prefix (e.g. gs://bucket/output/records)'}
      />

      {/* Suffix / Extension */}
      <PropertyField
        id="avroSinkSuffix"
        name="suffix"
        label="Suffix / Extension"
        tooltip="File extension appended to each shard (default: .avro)."
        value={suffix}
        onChange={handleChange}
        placeholder=".avro"
      />

      {/* Shard Template */}
      <PropertyField
        id="avroSinkShardTemplate"
        name="shardNameTemplate"
        label="Shard Template"
        tooltip="Shard naming template pattern (e.g. -SS-of-NN). Leave empty for Beam default."
        value={shardNameTemplate}
        onChange={handleChange}
        placeholder="-SS-of-NN"
      />

      {/* Section 2: Output Schema Configuration (Mandatory in Avro) */}
      <div className="flex flex-col gap-3 p-4 bg-slate-800/40 rounded border border-slate-700/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <span className="text-xs font-bold uppercase text-slate-400">Output Schema</span>
            <span className="text-red-400 ml-1 font-bold" title="Required">*</span>
          </div>
          <InfoTooltip text="Apache Avro requires a schema to serialize data blocks into container files." />
        </div>

        {/* Schema Type Selection */}
        <div className="flex flex-col gap-1">
          <label htmlFor="avroSinkSchemaType" className="text-xs font-semibold text-slate-400">
            Record Type
          </label>
          <select
            id="avroSinkSchemaType"
            name="schemaType"
            value={schemaType}
            onChange={handleChange}
            className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
          >
            <option value="GENERIC_RECORD">GenericRecord (Schema Definition)</option>
            <option value="SPECIFIC_RECORD">SpecificRecord (Generated Record Schema)</option>
          </select>
        </div>

        {/* Options for GenericRecord */}
        {schemaType === 'GENERIC_RECORD' && (
          <div className="flex flex-col gap-3 mt-1 pt-3 border-t border-slate-700/40">
            <div className="flex flex-col gap-1">
              <label htmlFor="avroSinkSchemaMode" className="text-xs font-semibold text-slate-400">
                Schema Specification Mode
              </label>
              <select
                id="avroSinkSchemaMode"
                name="schemaMode"
                value={schemaMode}
                onChange={handleChange}
                className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="INLINE">Inline Schema (Defined Here)</option>
                <option value="FILE">External Schema File (.avsc)</option>
              </select>
            </div>

            {/* Inline Schema Editor */}
            {schemaMode === 'INLINE' && (
              <div className="flex flex-col gap-2">
                <SchemaEditor
                  fields={schemaFields}
                  types={BEAM_SCHEMA_TYPES}
                  schemaTitle="Avro Writer Schema Specification"
                  stringTitle="Avro Schema String"
                  stringPlaceholder="e.g. id:STRING:REQUIRED, name:STRING, timestamp:BIGINT, active:BOOLEAN"
                  jsonTextareaId="avroSinkSchemaJson"
                  stringTextareaId="avroSinkSchemaString"
                  onChange={handleSchemaChange}
                />
              </div>
            )}

            {/* External Schema File Path */}
            {schemaMode === 'FILE' && (
              <div className="flex flex-col gap-1">
                <label htmlFor="avroSinkSchemaPath" className="text-xs font-semibold text-slate-400">
                  Schema File Path (.avsc)
                </label>
                <input
                  id="avroSinkSchemaPath"
                  type="text"
                  name="schemaPath"
                  value={schemaPath}
                  onChange={handleChange}
                  placeholder="gs://my-bucket/schemas/record.avsc or /path/to/schema.avsc"
                  className={`bg-[#252836] text-white p-2 rounded border text-sm focus:outline-none font-mono ${
                    isSchemaPathMissing
                      ? 'border-red-500/80 focus:border-red-500'
                      : 'border-slate-700 focus:border-blue-500'
                  }`}
                />
                {isSchemaPathMissing && (
                  <span className="text-xs text-red-400">Schema file path is required.</span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Options for SpecificRecord: Visual SchemaEditor (Gemini synthesizes SpecificRecord automatically) */}
        {schemaType === 'SPECIFIC_RECORD' && (
          <div className="flex flex-col gap-2.5 mt-1 pt-3 border-t border-slate-700/40">
            <div className="p-2 bg-blue-950/30 rounded border border-blue-900/40 text-xs text-slate-300">
              Define your output record fields below. Gemini automatically generates the typed Avro <code className="text-blue-300 font-mono">SpecificRecord</code> / schema class from these fields.
            </div>
            <SchemaEditor
              fields={schemaFields}
              types={BEAM_SCHEMA_TYPES}
              schemaTitle="Avro SpecificRecord Schema"
              stringTitle="Avro SpecificRecord Schema String"
              stringPlaceholder="e.g. id:STRING:REQUIRED, name:STRING, timestamp:BIGINT, active:BOOLEAN"
              jsonTextareaId="avroSinkSpecificSchemaJson"
              stringTextareaId="avroSinkSpecificSchemaString"
              onChange={handleSchemaChange}
            />
          </div>
        )}
      </div>

      {/* Section 3: Compression Codec */}
      <div className="flex flex-col gap-2 p-3 bg-slate-800/40 rounded border border-slate-700/50">
        <label htmlFor="avroSinkCodec" className="flex items-center text-xs font-bold uppercase text-slate-400">
          <span>Block Compression Codec</span>
          <InfoTooltip text="Avro block compression codec. Deflate and Snappy are standard; Snappy offers high throughput with minimal CPU usage." />
        </label>
        <select
          id="avroSinkCodec"
          name="codec"
          value={codec}
          onChange={handleChange}
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
        >
          {AVRO_CODECS.map(c => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>

        {/* Deflate / XZ Compression Level */}
        {(codec === 'DEFLATE' || codec === 'XZ') && (
          <div className="flex items-center justify-between gap-4 mt-2 pt-2 border-t border-slate-700/40">
            <label htmlFor="avroDeflateLevel" className="text-xs font-semibold text-slate-400">
              Compression Level (1-9)
            </label>
            <input
              id="avroDeflateLevel"
              type="number"
              name="deflateLevel"
              min="1"
              max="9"
              value={deflateLevel}
              onChange={handleChange}
              className="w-20 bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500 text-center"
            />
          </div>
        )}
      </div>

      {/* Section 4: Sharding & File Output Control */}
      <div className="flex flex-col gap-3 p-3 bg-slate-800/40 rounded border border-slate-700/50">
        <label htmlFor="avroSinkWithoutSharding" className="flex items-center gap-2 cursor-pointer">
          <input
            id="avroSinkWithoutSharding"
            type="checkbox"
            name="withoutSharding"
            checked={withoutSharding}
            onChange={handleChange}
            className="w-4 h-4 rounded border-slate-700 text-blue-600 focus:ring-0 focus:ring-offset-0 bg-[#252836]"
          />
          <span className="text-sm font-medium text-slate-300">Without Sharding (Single File)</span>
          <InfoTooltip text="Forces writing all elements into a single file. Limits write parallelism and throughput." />
        </label>

        {!withoutSharding && (
          <div className="flex flex-col gap-1 mt-1">
            <label htmlFor="avroSinkNumShards" className="flex items-center text-xs font-semibold text-slate-400">
              <span>Number of Shards</span>
              <InfoTooltip text="Fixed number of shards to write. Set to 0 or leave empty for runner-determined sharding." />
            </label>
            <input
              id="avroSinkNumShards"
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

      {/* Section 5: Performance & Metadata */}
      <div className="flex flex-col gap-3 p-3 bg-slate-800/40 rounded border border-slate-700/50">
        <span className="text-xs font-bold uppercase text-slate-400">Performance & Metadata</span>

        {/* Use FastAvro (Python) */}
        <label htmlFor="avroSinkUseFastavro" className="flex items-center gap-2 cursor-pointer">
          <input
            id="avroSinkUseFastavro"
            type="checkbox"
            name="useFastavro"
            checked={useFastavro}
            onChange={handleChange}
            className="w-4 h-4 rounded border-slate-700 text-blue-600 focus:ring-0 focus:ring-offset-0 bg-[#252836]"
          />
          <span className="text-sm font-medium text-slate-300">Use FastAvro (Python)</span>
          <InfoTooltip text="Uses fastavro library in Python for high-performance block serialization." />
        </label>

        {/* Custom Avro Metadata */}
        <div className="flex flex-col gap-1 mt-1">
          <label htmlFor="avroSinkMetadata" className="flex items-center text-xs font-semibold text-slate-400">
            <span>Custom Header Metadata (JSON / Key-Value)</span>
            <InfoTooltip text="Custom key-value metadata to store in the Avro file header container (e.g. { 'version': '1.0' })." />
          </label>
          <input
            id="avroSinkMetadata"
            type="text"
            name="metadata"
            value={metadata}
            onChange={handleChange}
            placeholder='{"schema_version": "1.0", "source": "beam"}'
            className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500 font-mono"
          />
        </div>
      </div>

      <SystemInstructionsField
        id="avroSinkSystemInstructions"
        value={systemInstructions}
        placeholder="Enter custom instructions for AvroIO sink code generation..."
        wrapperClassName="flex flex-col gap-2 pt-2 border-t border-slate-700/60"
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

