/**
 * TikaIO Source Properties Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Renders the property configuration panel for Apache Beam TikaIO Source nodes
 * (`TikaIO.parse().filepattern(...)` and `TikaIO.parseFiles()`, producing `ParseResult` elements).
 * 
 * Architectural Decisions:
 * - Java-Only Connector (`beam-sdks-java-io-tika`): `org.apache.beam.sdk.io.tika.TikaIO` parses diverse
 *   document formats (PDFs, Office documents, HTML, images with OCR, etc.) and emits `PCollection<ParseResult>`.
 *   TikaIO has no Python wrapper and no `ExternalTransformRegistrar`, so no cross-language URN exists.
 * - Transform Composition (`TikaIO.parse()` vs `TikaIO.parseFiles()`): `TikaIO.parse().filepattern(p)` has
 *   NO `.with*` configuration methods. When `tikaConfigPath`, `contentTypeHint`, or `inputMetadata` is
 *   configured, the pipeline must compose `FileIO.match().filepattern(p)` -> `FileIO.readMatches()` ->
 *   `TikaIO.parseFiles().withTikaConfigPath(...).withContentTypeHint(...).withInputMetadata(...)`.
 * - ParseResult Schema: `ParseResult` exposes `getFileLocation()` (String), `getContent()` (String),
 *   `getMetadata()` (Metadata), `isSuccess()` (boolean), and `getError()` (Throwable).
 * - Dynamic Discovery: Delegates the document file pattern field to the shared `StoragePathField`,
 *   which provides Cloud Storage bucket discovery, `gs://` datalist projection, and the discovery-error alert.
 * - Adheres strictly to the 8pt grid system, VS Code theme variables (`var(--vscode-*)`), and Tailwind CSS.
 */

import React from 'react';
import { InfoTooltip } from '../../components/InfoTooltip';
import { PropertyField } from '../../components/common/PropertyField';
import { StoragePathField } from '../../components/common/StoragePathField';

export interface TikaIOSourceNode {
  data: {
    label: string;
    beam_transform?: string;
    system_instructions?: string;
    special_instructions?: string;
    properties?: {
      filePattern?: string;
      contentTypeHint?: string;
      tikaConfigPath?: string;
      inputMetadata?: string;
      system_instructions?: string;
      special_instructions?: string;
      [key: string]: any;
    };
  };
}

export interface TikaIOSourcePropertiesProps {
  node: TikaIOSourceNode;
  onChange: (properties: any) => void;
}

/**
 * TikaIOSourceProperties renders the configuration form for parsing documents with Apache Beam TikaIO.
 */
export const TikaIOSourceProperties: React.FC<TikaIOSourcePropertiesProps> = ({ node, onChange }) => {
  const properties = node.data.properties || {};
  const filePattern = properties.filePattern || '';
  const contentTypeHint = properties.contentTypeHint || '';
  const tikaConfigPath = properties.tikaConfigPath || '';
  const inputMetadata = properties.inputMetadata || '';

  // Validation: filePattern is required for TikaIO reading
  const isFilePatternInvalid = !filePattern.trim();

  // System instructions text with fallback cascade
  const systemInstructions =
    node.data.system_instructions ??
    node.data.special_instructions ??
    properties.system_instructions ??
    properties.special_instructions ??
    '';

  /**
   * Handles input and textarea changes for form fields.
   * NOTE: this panel renders no checkbox inputs, so no boolean coercion branch is needed here.
   */
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;

    onChange({
      ...properties,
      [name]: value
    });
  };

  /**
   * Updates AI prompt / system instructions for pipeline code generation
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
        id="tikaSourceCompositionNotice"
        data-testid="tika-source-composition-notice"
        className="flex items-center justify-between gap-2 p-2.5 rounded border border-[var(--vscode-border)] bg-[var(--vscode-subcard-bg)] text-xs text-[var(--vscode-text-secondary)]"
      >
        <span>
          <strong>Java Only:</strong> <code>TikaIO</code> is a Java-only node type (<code>beam-sdks-java-io-tika</code>) and is only supported in Apache Beam Java pipelines.
        </span>
      </div>

      {/* Document File Pattern with Cloud Storage bucket autocomplete */}
      <StoragePathField
        id="tikaSourceFilePattern"
        name="filePattern"
        label="Document File Pattern (.filepattern)"
        tooltip="File pattern or glob of documents to parse (e.g. gs://bucket/documents/**.pdf). Used directly on TikaIO.parse().filepattern(p) or via FileIO.match().filepattern(p) -> FileIO.readMatches() -> TikaIO.parseFiles() when Tika options are set. Required."
        value={filePattern}
        onChange={handleChange}
        placeholder="gs://bucket/documents/**.pdf"
        errorMessage="File Pattern is required."
        helperText={
          !isFilePatternInvalid ? (
            <span className="text-xs text-[var(--vscode-text-muted)]">
              Passed to <code>TikaIO.parse().filepattern(p)</code>, or <code>FileIO.match().filepattern(p)</code> when{' '}
              <code>TikaIO.parseFiles()</code> options are configured.
            </span>
          ) : null
        }
      />

      {/* Content Type Hint */}
      <PropertyField
        id="tikaSourceContentTypeHint"
        name="contentTypeHint"
        label="Content Type Hint (TikaIO.parseFiles().withContentTypeHint)"
        tooltip="Optional MIME type hint (e.g. application/pdf) on TikaIO.parseFiles().withContentTypeHint(...). Requires composing FileIO.match().filepattern(p) -> FileIO.readMatches() -> TikaIO.parseFiles()."
        value={contentTypeHint}
        onChange={handleChange}
        placeholder="application/pdf"
        mono={true}
        helperText="Applied via TikaIO.parseFiles().withContentTypeHint(...) after FileIO.match() + FileIO.readMatches()."
      />

      {/* Tika Config Path */}
      <PropertyField
        id="tikaSourceTikaConfigPath"
        name="tikaConfigPath"
        label="Tika Config Path (TikaIO.parseFiles().withTikaConfigPath)"
        tooltip="Optional path to a custom tika-config.xml file applied on TikaIO.parseFiles().withTikaConfigPath(...). Requires composing FileIO.match().filepattern(p) -> FileIO.readMatches() -> TikaIO.parseFiles()."
        value={tikaConfigPath}
        onChange={handleChange}
        placeholder="gs://bucket/config/tika-config.xml"
        mono={true}
        helperText="Applied via TikaIO.parseFiles().withTikaConfigPath(...) after FileIO.match() + FileIO.readMatches()."
      />

      {/* Input Metadata Textarea */}
      <PropertyField
        id="tikaSourceInputMetadata"
        name="inputMetadata"
        label="Input Metadata (TikaIO.parseFiles().withInputMetadata)"
        tooltip="Initial metadata key=value pairs (one per line) marshalled into an org.apache.tika.metadata.Metadata instance and passed to TikaIO.parseFiles().withInputMetadata(...)."
        type="textarea"
        rows={3}
        value={inputMetadata}
        onChange={handleChange}
        placeholder="Content-Type=application/pdf&#10;Author=Acme Corp"
        mono={true}
        className="resize-y"
        helperText="Key=value pairs (one per line) passed to TikaIO.parseFiles().withInputMetadata(metadata)."
      />

      {/* Emitted Record Shape Summary (ParseResult) */}
      <div
        id="tikaSourceParseResultSummary"
        data-testid="tika-source-parse-result"
        className="flex flex-col gap-2 p-3 rounded border border-[var(--vscode-border)] bg-[var(--vscode-subcard-bg)]"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
            Emitted Record Schema (ParseResult)
          </span>
          <InfoTooltip text="TikaIO.parse() and TikaIO.parseFiles() emit ParseResult elements exposing getFileLocation(), getContent(), getMetadata(), isSuccess(), and getError()." />
        </div>
        <div className="text-xs font-mono text-[var(--vscode-text-secondary)] flex flex-col gap-1">
          <div>
            <span className="font-semibold text-[var(--vscode-text-primary)]">getFileLocation()</span> /{' '}
            <span className="font-semibold text-[var(--vscode-text-primary)]">fileLocation</span> — String (source document path or URI)
          </div>
          <div>
            <span className="font-semibold text-[var(--vscode-text-primary)]">getContent()</span> /{' '}
            <span className="font-semibold text-[var(--vscode-text-primary)]">content</span> — String (extracted plain text content)
          </div>
          <div>
            <span className="font-semibold text-[var(--vscode-text-primary)]">getMetadata()</span> /{' '}
            <span className="font-semibold text-[var(--vscode-text-primary)]">metadata</span> — Metadata (extracted document metadata key-value map)
          </div>
          <div>
            <span className="font-semibold text-[var(--vscode-text-primary)]">isSuccess() — boolean</span> (whether document parsing succeeded)
          </div>
          <div>
            <span className="font-semibold text-[var(--vscode-text-primary)]">getError() — Throwable</span> (error captured if parsing failed)
          </div>
        </div>
      </div>

      {/* Code Generation Instructions */}
      <div className="pt-2 border-t border-[var(--vscode-border-light)]">
        <PropertyField
          id="tikaSourceInstructions"
          name="system_instructions"
          label="Code Generation Instructions"
          tooltip="Custom instructions provided directly to Gemini when generating pipeline source code for this TikaIO reader step."
          type="textarea"
          rows={3}
          value={systemInstructions}
          onChange={handleInstructionsChange}
          placeholder="e.g. Parse PDF and Word documents and extract contract clauses into PCollection<ParseResult>."
          mono={false}
          className="resize-y h-24"
          helperText="Additional guidance appended to prompt when synthesizing Java code."
        />
      </div>
    </div>
  );
};

