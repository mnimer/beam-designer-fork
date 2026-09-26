/**
 * XmlIO Sink Properties Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Renders the property configuration panel for Apache Beam XmlIO Sink nodes
 * (XmlIO.<T>write().to(prefix).withRecordClass(Class).withRootElement(root).withCharset(...)...).
 * 
 * Architectural Decisions:
 * - Native Java connector: org.apache.beam.sdk.io.xml.XmlIO requires destination prefix (.to) and rootElement.
 * - JAXB Marshalling: recordClass specifies the fully qualified name of the JAXB-annotated entity class.
 * - Dynamic Discovery: Delegates the destination prefix field to the shared StoragePathField, which
 *   owns Cloud Storage bucket discovery, gs:// datalist projection, and the discovery-error alert.
 * - Cross-Language Note: Beam Python has no native XmlIO, requiring cross-language expansion service (ExternalTransform).
 *   Displays read-only informational guidance and optional expansionService configuration.
 * - Sharding Controls: Exposes numShards and shardTemplate within a collapsible configuration section.
 * - Adheres strictly to the 8pt grid system, VS Code theme variables, and Tailwind CSS.
 */

import React, { useState } from 'react';
import { Sliders } from 'lucide-react';
import { InfoTooltip } from '../../components/InfoTooltip';
import { PropertyField } from '../../components/common/PropertyField';
import { CollapsibleSection } from '../../components/common/CollapsibleSection';
import { SelectField } from '../../components/common/SelectField';
import { StoragePathField } from '../../components/common/StoragePathField';

export interface XmlIOSinkNode {
  data: {
    label: string;
    beam_transform?: string;
    system_instructions?: string;
    special_instructions?: string;
    properties?: {
      to?: string;
      suffix?: string;
      rootElement?: string;
      recordClass?: string;
      charset?: string;
      numShards?: string | number;
      shardTemplate?: string;
      expansionService?: string;
      system_instructions?: string;
      special_instructions?: string;
      [key: string]: any;
    };
  };
}

export interface XmlIOSinkPropertiesProps {
  node: XmlIOSinkNode;
  onChange: (properties: any) => void;
}

export const XML_SINK_CHARSETS = [
  { value: 'UTF-8', label: 'UTF-8 (Standard)' },
  { value: 'UTF-16', label: 'UTF-16' },
  { value: 'ISO-8859-1', label: 'ISO-8859-1 (Latin-1)' }
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
 * XmlIOSinkProperties renders the configuration form for writing XML files with Apache Beam.
 */
export const XmlIOSinkProperties: React.FC<XmlIOSinkPropertiesProps> = ({ node, onChange }) => {
  const properties = node.data.properties || {};
  const to = properties.to || '';
  const suffix = properties.suffix ?? '.xml';
  const rootElement = properties.rootElement || '';
  const recordClass = properties.recordClass || '';
  const charset = properties.charset || 'UTF-8';
  const numShards = properties.numShards ?? '';
  const shardTemplate = properties.shardTemplate || '';
  const expansionService = properties.expansionService || '';

  const [isShardingOpen, setIsShardingOpen] = useState<boolean>(true);

  // Validation: destination directory/prefix (.to) and rootElement are required for XmlIO.write().
  // NOTE: the .to rule mirrors StoragePathField's; used here only to gate the helper text.
  const isToInvalid = !to.trim();
  const isRootElementInvalid = !rootElement.trim();

  // Extract system instructions with fallbacks
  const systemInstructions =
    node.data.system_instructions ??
    node.data.special_instructions ??
    properties.system_instructions ??
    properties.special_instructions ??
    '';

  /**
   * Handles generic form inputs and numbers.
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
   * Handles system instructions textarea edits.
   */
  const handleInstructionsChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    onChange({
      ...properties,
      system_instructions: e.target.value
    });
  };

  return (
    <div className="flex-1 flex flex-col gap-4">
      {/* Java Only Notice */}
      <div
        id="xmlSinkJavaOnlyNotice"
        data-testid="xml-sink-java-only-notice"
        className="flex items-center justify-between gap-2 p-2.5 rounded border border-[var(--vscode-border)] bg-[var(--vscode-subcard-bg)] text-xs text-[var(--vscode-text-secondary)]"
      >
        <span>
          <strong>Java Only:</strong> <code>XmlIO</code> is a Java-only node type (<code>beam-sdks-java-io-xml</code>) and is only supported in Apache Beam Java pipelines.
        </span>
      </div>

      {/* Destination Prefix (.to) Input with Cloud Storage bucket autocomplete */}
      <StoragePathField
        id="xmlSinkTo"
        name="to"
        label="Destination Directory / Prefix (.to)"
        tooltip="Base output directory path or prefix where XML files will be written (e.g. gs://bucket/output/items, s3://bucket/output/items, or /local/output/items). Required."
        value={to}
        onChange={handleChange}
        placeholder="gs://bucket/output/items, s3://bucket/output/items, or /local/output/items"
        errorMessage="Destination Prefix is required."
        helperText={
          !isToInvalid ? (
            <span className="text-xs text-[var(--vscode-text-muted)]">
              Target output directory or prefix across Cloud Storage, Amazon S3, HDFS, or local storage.
            </span>
          ) : null
        }
      />

      {/* File Suffix Input */}
      <PropertyField
        id="xmlSinkSuffix"
        name="suffix"
        label="File Name Suffix (.withSuffix)"
        tooltip="File extension or suffix appended to each output shard (e.g. .xml). Defaults to .xml."
        value={suffix}
        onChange={handleChange}
        placeholder=".xml"
        mono={true}
      />

      {/* Root Element Input */}
      <PropertyField
        id="xmlSinkRootElement"
        name="rootElement"
        label="Root Element (.withRootElement)"
        required="Root Element is required."
        tooltip="Name of the root XML element enclosing all serialized record elements (e.g. 'inventory' or 'catalog'). Required."
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
              Enclosing root tag generated in each written XML document.
            </span>
          ) : null
        }
      />

      {/* Record Class Input */}
      <PropertyField
        id="xmlSinkRecordClass"
        name="recordClass"
        label="Record Class (.withRecordClass)"
        tooltip="Fully qualified name of the JAXB-annotated Java class representing the record (e.g. 'com.example.ItemRecord')."
        value={recordClass}
        onChange={handleChange}
        placeholder="e.g. com.example.model.ItemRecord"
        mono={true}
        helperText={
          <span className="text-[11px] text-[var(--vscode-text-muted)]">
            <strong>Java:</strong> JAXB-annotated class FQN used to marshal records into XML.
          </span>
        }
      />

      {/* Charset Select */}
      <SelectField
        id="xmlSinkCharset"
        name="charset"
        label="Character Set (.withCharset)"
        tooltip="Character encoding of the written XML files. Defaults to UTF-8."
        value={charset}
        options={XML_SINK_CHARSETS}
        onChange={handleChange}
      />

      {/* Sharding Configuration Accordion */}
      <CollapsibleSection
        title="Sharding Configuration"
        icon={<Sliders className="w-4 h-4 text-rose-400" />}
        isOpen={isShardingOpen}
        onToggle={() => setIsShardingOpen(!isShardingOpen)}
      >
        <div className="flex flex-col gap-1.5 mt-1">
          <label htmlFor="xmlSinkNumShards" className="flex items-center text-xs font-bold uppercase text-[var(--vscode-text-muted)] gap-1.5">
            <span>Number of Shards (.withNumShards)</span>
            <InfoTooltip text="Fixed number of output shards. Set to 0 or leave empty to allow the Beam runner to determine sharding dynamically." />
          </label>
          <input
            id="xmlSinkNumShards"
            type="number"
            name="numShards"
            value={numShards}
            onChange={handleChange}
            placeholder="0 (Automatic)"
            min="0"
            className="bg-[var(--vscode-input-bg)] text-[var(--vscode-text-primary)] p-2 rounded border border-[var(--vscode-border)] text-sm focus:outline-none focus:border-[var(--vscode-highlight)] font-mono"
          />
          <span className="text-[11px] text-[var(--vscode-text-muted)]">
            0 or empty lets the runner dynamically size output shards.
          </span>
        </div>

        <PropertyField
          id="xmlSinkShardTemplate"
          name="shardTemplate"
          label="Shard Name Template (Optional)"
          tooltip="Custom template for shard naming (e.g. -SSSSS-of-NNNNN). Leave blank for Beam standard default."
          value={shardTemplate}
          onChange={handleChange}
          placeholder="-SSSSS-of-NNNNN"
          mono={true}
        />
      </CollapsibleSection>

      {/* Python Cross-Language Section */}
      <div className="flex flex-col gap-2 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border)]">
        <PythonCrossLanguageNote />
        <PropertyField
          id="xmlSinkExpansionService"
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
      <div className="pt-2 border-t border-[var(--vscode-border-light)]">
        <PropertyField
          id="xmlSinkInstructions"
          name="system_instructions"
          label="Code Generation Instructions"
          tooltip="Custom instructions provided directly to Gemini when generating pipeline source code for this XmlIO writer step."
          type="textarea"
          rows={3}
          value={systemInstructions}
          onChange={handleInstructionsChange}
          placeholder="e.g. Write XML with custom root attributes or JAXB marshaller formatting properties."
          mono={false}
          className="resize-y h-24"
          helperText="Additional guidance appended to prompt when synthesizing Java/Python code."
        />
      </div>
    </div>
  );
};
