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
import { SAMPLE_AVRO_SCHEMA } from '../source/AvroIO';

export const AVRO_CODECS = [
  { value: 'DEFLATE', label: 'DEFLATE (Balanced / Standard Default)', tooltip: 'Standard Avro container compression offering good compression ratio and speed.' },
  { value: 'SNAPPY', label: 'SNAPPY (High Throughput / Low CPU)', tooltip: 'Ultra-fast compression codec widely used in big data processing pipelines.' },
  { value: 'BZIP2', label: 'BZIP2 (High Compression)', tooltip: 'High compression ratio at the expense of higher CPU overhead.' },
  { value: 'XZ', label: 'XZ (Extreme Compression)', tooltip: 'Very high compression ratio, ideal for long-term archiving.' },
  { value: 'ZSTANDARD', label: 'ZSTANDARD (Modern Fast & High Ratio)', tooltip: 'Modern high-performance compression with tunable ratio.' },
  { value: 'NULL', label: 'NULL / UNCOMPRESSED', tooltip: 'No compression applied to data blocks.' },
] as const;

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
      schema?: string;
      schemaPath?: string;
      recordClass?: string;
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
  const schema = properties.schema || '';
  const schemaPath = properties.schemaPath || '';
  const recordClass = properties.recordClass || '';
  const codec = properties.codec || 'DEFLATE';
  const deflateLevel = properties.deflateLevel ?? '6';
  const withoutSharding = properties.withoutSharding ?? false;
  const numShards = properties.numShards ?? '';
  const useFastavro = properties.useFastavro ?? true;
  const metadata = properties.metadata || '';

  // Required field validations
  const isToInvalid = !to.trim();
  const isSchemaMissing = schemaType === 'GENERIC_RECORD' && schemaMode === 'INLINE' && !schema.trim();
  const isSchemaPathMissing = schemaType === 'GENERIC_RECORD' && schemaMode === 'FILE' && !schemaPath.trim();
  const isClassMissing = schemaType === 'SPECIFIC_RECORD' && !recordClass.trim();

  // Validate inline JSON schema
  const jsonSchemaValidation = useMemo(() => {
    if (schemaType !== 'GENERIC_RECORD' || schemaMode !== 'INLINE' || !schema.trim()) {
      return { isValid: true, error: null };
    }
    try {
      JSON.parse(schema);
      return { isValid: true, error: null };
    } catch (err: any) {
      return { isValid: false, error: err?.message || 'Invalid JSON syntax' };
    }
  }, [schemaType, schemaMode, schema]);

  // Extract instructions with fallbacks
  const systemInstructions =
    node.data.system_instructions ??
    node.data.special_instructions ??
    properties.system_instructions ??
    properties.special_instructions ??
    '';

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
   * Inserts the default sample Avro schema into the inline schema textarea.
   */
  const handleInsertSampleSchema = () => {
    onChange({
      ...properties,
      schema: SAMPLE_AVRO_SCHEMA
    });
  };

  /**
   * Updates custom instructions for code generation.
   */
  const handleInstructionsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange({
      ...properties,
      system_instructions: e.target.value
    });
  };

  return (
    <div className="flex-1 flex flex-col gap-4">
      {/* Section 1: Destination & Shard Naming */}
      <div className="flex flex-col gap-2">
        <label htmlFor="avroSinkTo" className="flex items-center text-xs font-bold uppercase text-slate-500">
          <span>Destination File Prefix (.to / file_path_prefix)</span>
          <span className="text-red-400 ml-1 font-bold" title="Required">*</span>
          <InfoTooltip text="File prefix or path where Avro output shards will be written (e.g. gs://my-bucket/output/data or /local/path/output). Required." />
        </label>
        <input
          id="avroSinkTo"
          type="text"
          name="to"
          aria-required="true"
          aria-invalid={isToInvalid}
          value={to}
          onChange={handleChange}
          placeholder="gs://my-bucket/output/records or /path/to/output"
          className={`bg-[#252836] text-white p-2 rounded border text-sm focus:outline-none font-mono ${
            isToInvalid
              ? 'border-red-500/80 focus:border-red-500'
              : 'border-slate-700 focus:border-blue-500'
          }`}
        />
        {isToInvalid ? (
          <span className="text-xs text-red-400">Destination file prefix is required.</span>
        ) : (
          <span className="text-xs text-slate-400">
            Output file prefix (e.g. gs://bucket/output/records)
          </span>
        )}
      </div>

      {/* Suffix / Extension */}
      <div className="flex flex-col gap-2">
        <label htmlFor="avroSinkSuffix" className="flex items-center text-xs font-bold uppercase text-slate-500">
          <span>Suffix / Extension</span>
          <InfoTooltip text="File extension appended to each shard (default: .avro)." />
        </label>
        <input
          id="avroSinkSuffix"
          type="text"
          name="suffix"
          value={suffix}
          onChange={handleChange}
          placeholder=".avro"
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500 font-mono"
        />
      </div>

      {/* Shard Template */}
      <div className="flex flex-col gap-2">
        <label htmlFor="avroSinkShardTemplate" className="flex items-center text-xs font-bold uppercase text-slate-500">
          <span>Shard Template</span>
          <InfoTooltip text="Shard naming template pattern (e.g. -SS-of-NN). Leave empty for Beam default." />
        </label>
        <input
          id="avroSinkShardTemplate"
          type="text"
          name="shardNameTemplate"
          value={shardNameTemplate}
          onChange={handleChange}
          placeholder="-SS-of-NN"
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500 font-mono"
        />
      </div>

      {/* Section 2: Output Schema Configuration (Mandatory in Avro) */}
      <div className="flex flex-col gap-3 p-4 bg-slate-800/40 rounded border border-slate-700/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <span className="text-xs font-bold uppercase text-slate-400">Output Schema</span>
            <span className="text-red-400 ml-1 font-bold" title="Required">*</span>
          </div>
          <InfoTooltip text="Apache Avro requires a schema or compiled class to serialize data blocks into container files." />
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
            <option value="SPECIFIC_RECORD">SpecificRecord (Compiled Java Class)</option>
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
                <option value="INLINE">Inline JSON Schema (Defined Here)</option>
                <option value="FILE">External Schema File (.avsc)</option>
              </select>
            </div>

            {/* Inline Schema Input */}
            {schemaMode === 'INLINE' && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="avroSinkInlineSchema" className="text-xs font-semibold text-slate-400">
                    Avro JSON Schema
                  </label>
                  <button
                    type="button"
                    onClick={handleInsertSampleSchema}
                    className="text-xs text-blue-400 hover:text-blue-300 font-medium cursor-pointer"
                  >
                    Insert Sample Schema
                  </button>
                </div>
                <textarea
                  id="avroSinkInlineSchema"
                  name="schema"
                  value={schema}
                  onChange={handleChange}
                  placeholder={`{\n  "type": "record",\n  "name": "User",\n  "fields": [...]\n}`}
                  rows={5}
                  className={`bg-[#252836] text-white p-2 rounded border text-xs focus:outline-none font-mono ${
                    isSchemaMissing || !jsonSchemaValidation.isValid
                      ? 'border-red-500/80 focus:border-red-500'
                      : 'border-slate-700 focus:border-blue-500'
                  }`}
                />
                {isSchemaMissing ? (
                  <span className="text-xs text-red-400">Avro schema definition is required to write Avro files.</span>
                ) : !jsonSchemaValidation.isValid ? (
                  <span className="text-xs text-red-400">
                    JSON Error: {jsonSchemaValidation.error}
                  </span>
                ) : (
                  <span className="text-xs text-slate-400">
                    Valid Avro JSON record schema for element serialization.
                  </span>
                )}
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

        {/* Options for SpecificRecord */}
        {schemaType === 'SPECIFIC_RECORD' && (
          <div className="flex flex-col gap-1 mt-1 pt-3 border-t border-slate-700/40">
            <label htmlFor="avroSinkRecordClass" className="flex items-center text-xs font-semibold text-slate-400">
              <span>Generated Java Record Class</span>
              <span className="text-red-400 ml-1 font-bold" title="Required">*</span>
              <InfoTooltip text="Fully qualified name of the Avro-generated Java class (e.g. com.example.models.OrderRecord)." />
            </label>
            <input
              id="avroSinkRecordClass"
              type="text"
              name="recordClass"
              value={recordClass}
              onChange={handleChange}
              placeholder="com.example.avro.UserRecord"
              className={`bg-[#252836] text-white p-2 rounded border text-sm focus:outline-none font-mono ${
                isClassMissing
                  ? 'border-red-500/80 focus:border-red-500'
                  : 'border-slate-700 focus:border-blue-500'
              }`}
            />
            {isClassMissing && (
              <span className="text-xs text-red-400">Generated record class is required.</span>
            )}
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

      {/* Flexible Spacer */}
      <div className="flex-1 min-h-4" />

      {/* Section 6: Code Generation Instructions */}
      <div className="flex flex-col gap-2 pt-2 border-t border-slate-700/60">
        <label htmlFor="avroSinkSystemInstructions" className="text-xs font-bold uppercase text-slate-500">
          Code Generation Instructions
        </label>
        <textarea
          id="avroSinkSystemInstructions"
          name="system_instructions"
          value={systemInstructions}
          onChange={handleInstructionsChange}
          placeholder="Enter custom instructions for AvroIO sink code generation..."
          rows={3}
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500 resize-y"
        />
      </div>
    </div>
  );
};

