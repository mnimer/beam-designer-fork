/**
 * XmlIO Source Properties Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Renders the property configuration panel for Apache Beam XmlIO Source nodes
 * (XmlIO.<T>read().from(filepattern).withRootElement(root).withRecordElement(record).withRecordClass(Class)...).
 * 
 * Architectural Decisions:
 * - Native Java connector: org.apache.beam.sdk.io.xml.XmlIO requires filepattern, rootElement, and recordElement.
 * - JAXB Unmarshalling: recordClass specifies the fully qualified name of the JAXB-annotated entity class.
 * - Dynamic Discovery: Delegates the file pattern field to the shared StoragePathField, which owns
 *   Cloud Storage bucket discovery, gs:// datalist projection, and the discovery-error alert.
 * - Cross-Language Note: Beam Python has no native XmlIO, requiring cross-language expansion service (ExternalTransform).
 *   Displays read-only informational guidance and optional expansionService configuration.
 * - Read Tuning & Advanced Options: Min bundle size and file validation configurable inside collapsible section.
 * - Adheres strictly to the 8pt grid system, VS Code theme variables, and Tailwind CSS.
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
import { MappingStrategyField, type MappingStrategy } from '../../components/common/MappingStrategyField';
import { resolveSchemaFields, type SchemaField } from '../../components/common/SchemaEditor';

/**
 * Node data structure for XmlIO source nodes.
 */
export interface XmlIOSourceNode {
  data: {
    label: string;
    beam_transform?: string;
    system_instructions?: string;
    special_instructions?: string;
    properties?: {
      filePattern?: string;
      rootElement?: string;
      recordElement?: string;
      mappingStrategy?: MappingStrategy | string;
      schemaString?: string;
      schema?: string;
      schemaFields?: SchemaField[];
      charset?: string;
      compression?: string;
      minBundleSize?: string | number;
      validate?: boolean;
      expansionService?: string;
      system_instructions?: string;
      special_instructions?: string;
      [key: string]: any;
    };
  };
}

/**
 * Props for the XmlIO source properties component.
 */
export interface XmlIOSourcePropertiesProps {
  node: XmlIOSourceNode;
  onChange: (properties: any) => void;
}

export const XML_CHARSETS = [
  { value: 'UTF-8', label: 'UTF-8 (Standard)' },
  { value: 'UTF-16', label: 'UTF-16' },
  { value: 'ISO-8859-1', label: 'ISO-8859-1 (Latin-1)' }
];

export const XML_COMPRESSION_TYPES = [
  { value: 'AUTO', label: 'AUTO (Detect from file extension)' },
  { value: 'UNCOMPRESSED', label: 'UNCOMPRESSED' },
  { value: 'GZIP', label: 'GZIP' },
  { value: 'BZIP2', label: 'BZIP2' },
  { value: 'ZIP', label: 'ZIP' },
  { value: 'DEFLATE', label: 'DEFLATE' },
  { value: 'ZSTD', label: 'ZSTD' }
];

/**
 * Informational note for Python cross-language expansion requirements.
 */
export const PythonCrossLanguageNote: React.FC = () => (
  <div className="text-[11px] text-[var(--vscode-text-muted)] leading-relaxed">
    <strong>Python Cross-Language:</strong> Apache Beam Python does not provide a native <code>XmlIO</code> connector. Python pipelines connect to <code>XmlIO</code> via the Java expansion service (<code>apache_beam.transforms.xlang</code> / <code>ExternalTransform</code>).
  </div>
);

/**
 * XmlIOSourceProperties renders the configuration form for reading XML files with Apache Beam.
 */
export const XmlIOSourceProperties: React.FC<XmlIOSourcePropertiesProps> = ({ node, onChange }) => {
  const properties = node.data.properties || {};
  const filePattern = properties.filePattern || '';
  const rootElement = properties.rootElement || '';
  const recordElement = properties.recordElement || '';
  const schemaFields = React.useMemo(
    () => resolveSchemaFields(properties),
    [properties.schemaFields, properties.schema, properties.schemaString]
  );
  const mappingStrategy =
    properties.mappingStrategy || (schemaFields.length > 0 ? 'schema' : 'infer');
  const charset = properties.charset || 'UTF-8';
  const compression = properties.compression || 'AUTO';
  const minBundleSize = properties.minBundleSize ?? '';
  const validate = properties.validate ?? true;
  const expansionService = properties.expansionService || '';

  const [isAdvancedOpen, setIsAdvancedOpen] = useState<boolean>(false);

  // Validation: filePattern, rootElement, and recordElement are required for XmlIO.read().
  // NOTE: the filePattern rule mirrors StoragePathField's; used here only to gate the helper text.
  const isFilePatternInvalid = !filePattern.trim();
  const isRootElementInvalid = !rootElement.trim();
  const isRecordElementInvalid = !recordElement.trim();

  // Extract system instructions with fallbacks
  const systemInstructions = resolveSystemInstructions(node);

  /**
   * Handles generic form inputs and checkboxes.
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
   * Updates schema fields from SchemaEditor.
   */
  const handleSchemaChange = (data: { schemaFields: SchemaField[]; schema: string; schemaString: string }) => {
    onChange({
      ...properties,
      schemaFields: data.schemaFields,
      schema: data.schema,
      schemaString: data.schemaString
    });
  };

  return (
    <div className="flex-1 flex flex-col gap-4">
      {/* Java Only Notice */}
      <div
        id="xmlSourceJavaOnlyNotice"
        data-testid="xml-source-java-only-notice"
        className="flex items-center justify-between gap-2 p-2.5 rounded border border-[var(--vscode-border)] bg-[var(--vscode-subcard-bg)] text-xs text-[var(--vscode-text-secondary)]"
      >
        <span>
          <strong>Java Only:</strong> <code>XmlIO</code> is a Java-only node type (<code>beam-sdks-java-io-xml</code>) and is only supported in Apache Beam Java pipelines.
        </span>
      </div>

      {/* File Pattern Input with Cloud Storage bucket autocomplete */}
      <StoragePathField
        id="xmlSourceFilePattern"
        name="filePattern"
        label="File Pattern / Path (.from)"
        tooltip="Target XML file path or glob pattern (e.g. gs://bucket/*.xml, s3://bucket/*.xml, or /local/path/*.xml). Required."
        value={filePattern}
        onChange={handleChange}
        placeholder="gs://bucket/data/*.xml, s3://bucket/data/*.xml, or /local/*.xml"
        errorMessage="File Pattern is required."
        helperText={
          !isFilePatternInvalid ? (
            <span className="text-xs text-[var(--vscode-text-muted)]">
              Target file or glob pattern across Cloud Storage, Amazon S3, HDFS, or local storage.
            </span>
          ) : null
        }
      />

      {/* Root Element Input */}
      <PropertyField
        id="xmlSourceRootElement"
        name="rootElement"
        label="Root Element (.withRootElement)"
        required="Root Element is required."
        tooltip="Name of the root XML element of the document (e.g. 'inventory' or 'catalog'). Required."
        aria-required="true"
        aria-invalid={isRootElementInvalid}
        value={rootElement}
        onChange={handleChange}
        placeholder="e.g. inventory, catalog, or root"
        invalid={isRootElementInvalid}
        error={isRootElementInvalid ? 'Root Element is required.' : null}
        mono={true}
        helperText={
          !isRootElementInvalid ? (
            <span className="text-xs text-[var(--vscode-text-muted)]">
              Enclosing root XML element tag name.
            </span>
          ) : null
        }
      />

      {/* Record Element Input */}
      <PropertyField
        id="xmlSourceRecordElement"
        name="recordElement"
        label="Record Element (.withRecordElement)"
        required="Record Element is required."
        tooltip="Name of the XML elements containing individual records to parse (e.g. 'item' or 'record'). Required."
        aria-required="true"
        aria-invalid={isRecordElementInvalid}
        value={recordElement}
        onChange={handleChange}
        placeholder="e.g. item, record, or entry"
        invalid={isRecordElementInvalid}
        error={isRecordElementInvalid ? 'Record Element is required.' : null}
        mono={true}
        helperText={
          !isRecordElementInvalid ? (
            <span className="text-xs text-[var(--vscode-text-muted)]">
              XML tag representing each individual record to unmarshal.
            </span>
          ) : null
        }
      />

      {/* XML Record & Schema Mapping */}
      <div className="flex flex-col gap-3 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
        <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          <span>XML Record &amp; Schema Mapping</span>
          <InfoTooltip text="Configures how XML record elements map to Beam PCollection elements. Gemini automatically synthesizes the JAXB-annotated POJO (@XmlRootElement) and Beam Row mapping from rootElement + recordElement or from a defined schema." />
        </label>

        <MappingStrategyField
          id="xmlSourceMappingStrategy"
          strategyName="mappingStrategy"
          strategy={mappingStrategy}
          options={['infer', 'schema']}
          optionLabels={{
            infer: 'Auto-Infer JAXB Record / Row (Recommended)',
            schema: 'Define Schema (Fields & Types)'
          }}
          label="Record Mapping Strategy"
          tooltip="Select how XML records are mapped. 'Auto-Infer' lets Gemini synthesize the JAXB-annotated POJO (@XmlRootElement) and Beam Row from rootElement + recordElement. 'Define Schema' lets you specify exact fields & types."
          inferDescription={
            <>
              Gemini will automatically synthesize a JAXB{' '}
              <code className="text-slate-200 bg-slate-800/80 px-1 py-0.5 rounded">@XmlRootElement</code>-annotated POJO and{' '}
              <code className="text-slate-200 bg-slate-800/80 px-1 py-0.5 rounded">XmlIO.read()</code> mapping from your root and record elements.
            </>
          }
          schemaFields={schemaFields}
          schemaStringPlaceholder="sku:STRING:REQUIRED, name:STRING, price:DOUBLE, quantity:INTEGER"
          onSchemaChange={handleSchemaChange}
          onChange={handleChange}
        />
      </div>

      {/* Charset Select */}
      <SelectField
        id="xmlSourceCharset"
        name="charset"
        label="Character Set (.withCharset)"
        tooltip="Character encoding of the XML files. Defaults to UTF-8."
        value={charset}
        options={XML_CHARSETS}
        onChange={handleChange}
      />

      {/* Compression Select */}
      <SelectField
        id="xmlSourceCompression"
        name="compression"
        label="Decompression (.withCompression)"
        tooltip="Decompression algorithm used when reading XML files. Defaults to AUTO (detect from file extension)."
        value={compression}
        options={XML_COMPRESSION_TYPES}
        onChange={handleChange}
      />

      {/* Advanced Settings Accordion */}
      <CollapsibleSection
        title="Read Tuning & Options"
        icon={<Sliders className="w-4 h-4 text-emerald-400" />}
        isOpen={isAdvancedOpen}
        onToggle={() => setIsAdvancedOpen(!isAdvancedOpen)}
      >
        {/* Validate file existence */}
        <label htmlFor="xmlSourceValidate" className="flex items-center gap-2 cursor-pointer mt-1">
          <input
            id="xmlSourceValidate"
            type="checkbox"
            name="validate"
            checked={validate}
            onChange={handleChange}
            className="rounded bg-[var(--vscode-input-bg)] border-[var(--vscode-border)] text-blue-500 focus:ring-0 focus:ring-offset-0"
          />
          <span className="text-xs text-[var(--vscode-text-secondary)]">Validate file existence on pipeline startup</span>
          <InfoTooltip text="Checks whether the input file pattern matches files at pipeline construction time." />
        </label>

        {/* Min Bundle Size */}
        <PropertyField
          id="xmlSourceMinBundleSize"
          type="number"
          name="minBundleSize"
          label="Minimum Bundle Size (bytes)"
          tooltip="Minimum byte size to consider when splitting input XML into bundles for parallel worker execution. Default is 0."
          value={minBundleSize}
          onChange={handleChange}
          placeholder="0"
          min="0"
          mono={true}
        />
      </CollapsibleSection>

      {/* Python Cross-Language Section */}
      <div className="flex flex-col gap-2 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border)]">
        <PythonCrossLanguageNote />
        <PropertyField
          id="xmlSourceExpansionService"
          name="expansionService"
          label="Expansion Service (Python xlang, Optional)"
          tooltip="Host and port of the Apache Beam Java expansion service used for cross-language XmlIO in Python pipelines (e.g. localhost:8097)."
          value={expansionService}
          onChange={handleChange}
          placeholder="localhost:8097"
          mono={true}
          helperText={
            <span className="text-[11px] text-[var(--vscode-text-muted)]">
              <strong>Python:</strong> Specify host:port of the Beam expansion service when executing via Python. Not used in Java.
            </span>
          }
        />
      </div>

      {/* Code Generation Instructions */}
      <SystemInstructionsField
        id="xmlSourceInstructions"
        value={systemInstructions}
        placeholder="e.g. Unmarshal XML using com.example.model.InventoryItem and handle namespace prefixes."
        tooltip="Custom instructions provided directly to Gemini when generating pipeline source code for this XmlIO reader step."
        helperText="Additional guidance appended to prompt when synthesizing Java/Python code."
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
