/**
 * ThriftIO Source Properties Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Renders the property configuration panel for Apache Beam ThriftIO Source nodes
 * (`FileIO.match().filepattern(...)` -> `FileIO.readMatches().withCompression(...)` -> `ThriftIO.readFiles(RecordClass.class).withProtocol(...)`).
 * 
 * Architectural Decisions:
 * - Java-Only Connector (`beam-sdks-java-io-thrift`): `ThriftIO.readFiles(Class<T>)` consumes a
 *   `PCollection<FileIO.ReadableFile>` produced by `FileIO.match().filepattern(...)` + `FileIO.readMatches()`.
 *   There is no `ExternalTransformRegistrar` in `beam-sdks-java-io-thrift`, so no cross-language URN exists.
 * - Read-Side Protocol Factories: Supports `TBinaryProtocol`, `TCompactProtocol`, and `TJSONProtocol`.
 *   `TSimpleJSONProtocol` is explicitly rejected by `ThriftIO.ReadFiles.withProtocol` (`IllegalArgumentException: TSimpleJSONProtocol is a write only protocol`) and is excluded here.
 * - Valid `org.apache.beam.sdk.io.Compression` Enum Values: Supports `AUTO`, `UNCOMPRESSED`, `GZIP`, `BZIP2`,
 *   `DEFLATE`, and `ZSTD` (`XZ` does not exist in Beam `Compression`).
 * - Delegates the file pattern field to the shared `StoragePathField` for Cloud Storage bucket discovery.
 * - Adheres strictly to the 8pt grid system, VS Code theme variables (`var(--vscode-*)`), and Tailwind CSS.
 */

import React, { useState } from 'react';
import { Sliders } from 'lucide-react';
import { InfoTooltip } from '../../components/InfoTooltip';
import { SystemInstructionsField } from '../../components/common/SystemInstructionsField';
import { resolveSystemInstructions } from '../../utils/systemInstructions';
import { CollapsibleSection } from '../../components/common/CollapsibleSection';
import { SelectField } from '../../components/common/SelectField';
import { StoragePathField } from '../../components/common/StoragePathField';
import { MappingStrategyField, type MappingStrategy } from '../../components/common/MappingStrategyField';
import { resolveSchemaFields, type SchemaField } from '../../components/common/SchemaEditor';

/**
 * Node data structure for ThriftIO source nodes.
 */
export interface ThriftIOSourceNode {
  data: {
    label: string;
    beam_transform?: string;
    system_instructions?: string;
    special_instructions?: string;
    properties?: {
      filePattern?: string;
      mappingStrategy?: MappingStrategy | string;
      schemaString?: string;
      schema?: string;
      schemaFields?: SchemaField[];
      protocolFactory?: string;
      compression?: string;
      validate?: boolean;
      system_instructions?: string;
      special_instructions?: string;
      [key: string]: any;
    };
  };
}

/**
 * Props for the ThriftIOSourceProperties component.
 */
export interface ThriftIOSourcePropertiesProps {
  node: ThriftIOSourceNode;
  onChange: (properties: any) => void;
}

export const THRIFT_PROTOCOL_OPTIONS = [
  { value: 'TBinaryProtocol', label: 'TBinaryProtocol (Default - compact binary format)' },
  { value: 'TCompactProtocol', label: 'TCompactProtocol (Variable-length zig-zag encoding)' },
  { value: 'TJSONProtocol', label: 'TJSONProtocol (Standard JSON encoding with schema)' }
];

export const THRIFT_PROTOCOL_FACTORIES = THRIFT_PROTOCOL_OPTIONS;

export const THRIFT_SOURCE_COMPRESSION_TYPES = [
  { value: 'AUTO', label: 'AUTO (Detect from file extension)' },
  { value: 'UNCOMPRESSED', label: 'UNCOMPRESSED (Standard Thrift files)' },
  { value: 'GZIP', label: 'GZIP (.gz)' },
  { value: 'BZIP2', label: 'BZIP2 (.bz2)' },
  { value: 'DEFLATE', label: 'DEFLATE / ZLIB' },
  { value: 'ZSTD', label: 'ZSTD (.zst)' }
];

/**
 * Properties panel component for configuring ThriftIO source transforms.
 */
export const ThriftIOSourceProperties: React.FC<ThriftIOSourcePropertiesProps> = ({ node, onChange }) => {
  const properties = node.data.properties || {};
  const filePattern = properties.filePattern || '';
  const schemaFields = React.useMemo(
    () => resolveSchemaFields(properties),
    [properties.schemaFields, properties.schema, properties.schemaString]
  );
  const mappingStrategy =
    properties.mappingStrategy || (schemaFields.length > 0 ? 'schema' : 'infer');
  const protocolFactory = properties.protocolFactory || 'TBinaryProtocol';
  const compression = properties.compression || 'AUTO';
  const validate = properties.validate ?? true;

  const [isAdvancedOpen, setIsAdvancedOpen] = useState<boolean>(false);

  // Validation: filePattern is required for Thrift reading.
  // NOTE: the filePattern rule mirrors StoragePathField's; used here only to gate the helper text.
  const isFilePatternInvalid = !filePattern.trim();

  // System instructions text with fallback
  const systemInstructions = resolveSystemInstructions(node);

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
   * Updates schema fields from SchemaEditor
   */
  const handleSchemaChange = (data: { schemaFields: SchemaField[]; schema: string; schemaString: string }) => {
    onChange({
      ...properties,
      schemaFields: data.schemaFields,
      schema: data.schema,
      schemaString: data.schemaString
    });
  };

  /**
   * Toggles the advanced tuning accordion state
   */
  const handleToggleAdvanced = () => {
    setIsAdvancedOpen((prev) => !prev);
  };

  return (
    <div className="flex-1 flex flex-col gap-4">
      {/* Java Only Notice */}
      <div
        id="thriftSourceJavaOnlyNotice"
        data-testid="thrift-source-java-only-notice"
        className="flex items-center justify-between gap-2 p-2.5 rounded border border-[var(--vscode-border)] bg-[var(--vscode-subcard-bg)] text-xs text-[var(--vscode-text-secondary)]"
      >
        <span>
          <strong>Java Only:</strong> <code>ThriftIO</code> is a Java-only node type (<code>beam-sdks-java-io-thrift</code>) and is only supported in Apache Beam Java pipelines.
        </span>
      </div>

      {/* File Pattern Input with Cloud Storage bucket autocomplete */}
      <StoragePathField
        id="thriftSourceFilePattern"
        name="filePattern"
        label="File Pattern / Path (FileIO.match().filepattern)"
        tooltip="Target Thrift file path or glob pattern configured on FileIO.match().filepattern(...) (composed as FileIO.match().filepattern(...) -> FileIO.readMatches().withCompression(...) -> ThriftIO.readFiles(...).withProtocol(...)). Required."
        value={filePattern}
        onChange={handleChange}
        placeholder="gs://bucket/data/*.thrift, s3://bucket/*.thrift, or /local/*.thrift"
        errorMessage="File Pattern is required."
        helperText={
          !isFilePatternInvalid ? (
            <span className="text-xs text-[var(--vscode-text-muted)]">
              Passed to <code>FileIO.match().filepattern(...)</code> &rarr; <code>FileIO.readMatches().withCompression(...)</code> &rarr; <code>ThriftIO.readFiles(...).withProtocol(...)</code>.
            </span>
          ) : null
        }
      />

      {/* Thrift Struct & Schema Mapping */}
      <div className="flex flex-col gap-3 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
        <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          <span>Thrift Struct &amp; Schema Mapping</span>
          <InfoTooltip text="Configures how Thrift binary/JSON records map to Beam PCollection elements. Gemini automatically synthesizes the TBase struct / Beam Row from pipeline context or from a defined schema." />
        </label>

        <MappingStrategyField
          id="thriftSourceMappingStrategy"
          strategyName="mappingStrategy"
          strategy={mappingStrategy}
          options={['infer', 'schema']}
          optionLabels={{
            infer: 'Auto-Infer Thrift Struct / Row (Recommended)',
            schema: 'Define Schema (Fields & Types)'
          }}
          label="Record Mapping Strategy"
          tooltip="Select how Thrift records are mapped. 'Auto-Infer' lets Gemini synthesize the TBase Thrift struct and Beam Row mapping from pipeline context. 'Define Schema' lets you specify exact fields & types."
          inferDescription={
            <>
              Gemini will automatically synthesize the Apache Thrift{' '}
              <code className="text-slate-200 bg-slate-800/80 px-1 py-0.5 rounded">TBase</code> struct and{' '}
              <code className="text-slate-200 bg-slate-800/80 px-1 py-0.5 rounded">ThriftIO.readFiles(...)</code> mapping from your pipeline context.
            </>
          }
          schemaFields={schemaFields}
          schemaStringPlaceholder="order_id:STRING:REQUIRED, customer_id:STRING, amount:DOUBLE, created_at:TIMESTAMP"
          onSchemaChange={handleSchemaChange}
          onChange={handleChange}
        />
      </div>

      {/* Protocol Factory Select */}
      <SelectField
        id="thriftSourceProtocolFactory"
        name="protocolFactory"
        label="Protocol Factory (.withProtocol)"
        tooltip="Thrift protocol factory passed to ThriftIO.ReadFiles.withProtocol(...) (TBinaryProtocol.Factory, TCompactProtocol.Factory, or TJSONProtocol.Factory). TSimpleJSONProtocol is write-only and rejected by ThriftIO.ReadFiles."
        value={protocolFactory}
        options={THRIFT_PROTOCOL_OPTIONS}
        onChange={handleChange}
        helperText={
          <span>
            Binary or text deserialization protocol for Thrift records. Defaults to <code>TBinaryProtocol</code>.
          </span>
        }
      />

      {/* Compression Select */}
      <SelectField
        id="thriftSourceCompression"
        name="compression"
        label="Compression (FileIO.readMatches().withCompression)"
        tooltip="Compression codec applied on FileIO.readMatches().withCompression(Compression). AUTO detects from file extension."
        value={compression}
        options={THRIFT_SOURCE_COMPRESSION_TYPES}
        onChange={handleChange}
      />

      {/* Advanced Tuning Accordion */}
      <CollapsibleSection
        title="Read Tuning & Options"
        icon={<Sliders className="w-4 h-4 text-emerald-400" />}
        isOpen={isAdvancedOpen}
        onToggle={handleToggleAdvanced}
      >
        {/* Validate Checkbox */}
        <label htmlFor="thriftSourceValidate" className="flex items-center gap-2 cursor-pointer mt-1">
          <input
            id="thriftSourceValidate"
            type="checkbox"
            name="validate"
            checked={validate}
            onChange={handleChange}
            className="rounded bg-[var(--vscode-input-bg)] border-[var(--vscode-border)] text-blue-500 focus:ring-0 focus:ring-offset-0"
          />
          <span className="text-xs text-[var(--vscode-text-secondary)]">
            Disallow empty file pattern match (EmptyMatchTreatment.DISALLOW)
          </span>
          <InfoTooltip text="Configures FileIO.match().withEmptyMatchTreatment(EmptyMatchTreatment.DISALLOW) so an empty file pattern match raises an error." />
        </label>
      </CollapsibleSection>

      {/* Code Generation Instructions */}
      <SystemInstructionsField
        id="thriftSourceInstructions"
        value={systemInstructions}
        placeholder="e.g. Read OrderRecord instances and unpack payload attributes into PCollection."
        tooltip="Custom instructions provided directly to Gemini when generating pipeline source code for this ThriftIO reader step."
        helperText="Additional guidance appended to prompt when synthesizing Java code."
        wrapperClassName="pt-2 border-t border-[var(--vscode-border-light)]"
        textareaClassName="h-24"
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

