/**
 * ContextualTextIO Source Properties Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Renders the property configuration panel for Apache Beam ContextualTextIO file read operations
 * (org.apache.beam.sdk.io.contextualtextio.ContextualTextIO.read().from(...)).
 * 
 * ContextualTextIO reads text files and emits PCollection<Row> records carrying rich line-context
 * metadata defined by `RecordWithMetadata.getSchema()`: `value` (`STRING`), `resourceId`
 * (`LogicalType<Row{resource: STRING, is_directory: BOOLEAN}>`), `recordOffset` (`INT64`),
 * `recordNumInOffset` (`INT64`), `rangeOffset` (`INT64`), and `recordNum` (`NULLABLE INT64`,
 * populated when `.withRecordNumMetadata()` is enabled).
 * 
 * Architectural Decisions:
 * - In Apache Beam, ContextualTextIO.read() requires a target file or glob pattern (.from(...)).
 * - Enforces required field indicators, error messages, and aria attributes on filePattern.
 * - Delegates the file pattern input to the shared StoragePathField primitive, which owns Google
 *   Cloud Storage bucket auto-discovery, the `gs://` datalist projection, and the inline
 *   discovery error with role="alert" (surfaced regardless of whether the path itself is valid).
 * - Emitted line-context metadata fields from `RecordWithMetadata.getSchema()` are summarized in
 *   a read-only schema preview component without advertising a non-existent `fileName` column.
 * - Supports multiline CSV records (.withHasMultilineCSVRecords(...)), custom byte delimiter (.withDelimiter(byte[])),
 *   compression algorithms (.withCompression(...)), empty match treatment (.withEmptyMatchTreatment(...),
 *   defaulting to `DISALLOW` matching `ContextualTextIO.read()`), and large file set expansion hints
 *   (.withHintMatchesManyFiles()).
 * - No `minBundleSize`, `matchConfiguration`, or `withCompression` fields: `ContextualTextIO.Read`
 *   has no public bundle-size setter (`ReadFiles.withDesiredBundleSizeBytes` is `@VisibleForTesting`
 *   package-private), and `emptyMatchTreatment` is persisted as a single canonical key.
 * - Java-Only Transform (NO `expansionService` field): `ContextualTextIO` lives in
 *   `beam-sdks-java-io-contextual-text-io` with no `ExternalTransformRegistrar`, no
 *   `SchemaTransformProvider`, and no registered cross-language URN. Stated honestly in an inline banner.
 * - Adheres strictly to the 8pt grid system, VS Code theme variables (`var(--vscode-*)`), and Tailwind CSS classes.
 */

import React, { useState } from 'react';
import { InfoTooltip } from '../../components/InfoTooltip';
import { PropertyField } from '../../components/common/PropertyField';
import { CollapsibleSection } from '../../components/common/CollapsibleSection';
import { StoragePathField } from '../../components/common/StoragePathField';
import { FileText } from 'lucide-react';
import { BEAM_COMPRESSION_TYPES } from './FileIO';

export interface ContextualTextIOSourceNode {
  data: {
    label: string;
    beam_transform?: string;
    system_instructions?: string;
    special_instructions?: string;
    properties?: {
      filePattern?: string;
      delimiter?: string;
      hasMultilineCSVRecords?: boolean;
      compression?: string;
      hintMatchesManyFiles?: boolean;
      emptyMatchTreatment?: 'ALLOW' | 'DISALLOW' | 'ALLOW_IF_WILDCARD';
      watchForNewFilesInterval?: string | number;
      system_instructions?: string;
      special_instructions?: string;
      [key: string]: any;
    };
  };
}

export interface ContextualTextIOSourcePropertiesProps {
  node: ContextualTextIOSourceNode;
  onChange: (properties: any) => void;
}

/**
 * Sub-component displaying a read-only schema preview of the line context metadata
 * emitted by ContextualTextIO.read().from(...) via RecordWithMetadata.getSchema().
 */
const LineContextSummary: React.FC = () => {
  return (
    <div className="flex flex-col gap-2 p-3 bg-[var(--vscode-subcard-bg)] rounded border border-[var(--vscode-border)]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <FileText className="w-4 h-4 text-[var(--vscode-highlight)]" />
          <span className="text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
            Emitted Line-Context Schema (RecordWithMetadata Row)
          </span>
        </div>
        <InfoTooltip text="ContextualTextIO.read().from(...) emits PCollection<Row> matching RecordWithMetadata.getSchema(): value, resourceId, recordOffset, recordNumInOffset, rangeOffset, and nullable recordNum." />
      </div>
      <div className="flex flex-col gap-1 text-xs">
        <div className="flex items-center justify-between font-mono bg-[var(--vscode-input-bg)] px-2 py-1.5 rounded">
          <span className="text-[var(--vscode-highlight)] font-semibold">value</span>
          <span className="text-[var(--vscode-text-muted)]">STRING (Record text content)</span>
        </div>
        <div className="flex items-center justify-between font-mono bg-[var(--vscode-input-bg)] px-2 py-1.5 rounded">
          <span className="text-[var(--vscode-highlight)] font-semibold">resourceId</span>
          <span className="text-[var(--vscode-text-muted)]">LogicalType&lt;Row&#123;resource: STRING, is_directory: BOOLEAN&#125;&gt;</span>
        </div>
        <div className="flex items-center justify-between font-mono bg-[var(--vscode-input-bg)] px-2 py-1.5 rounded">
          <span className="text-[var(--vscode-highlight)] font-semibold">recordOffset</span>
          <span className="text-[var(--vscode-text-muted)]">INT64 (Starting byte offset)</span>
        </div>
        <div className="flex items-center justify-between font-mono bg-[var(--vscode-input-bg)] px-2 py-1.5 rounded">
          <span className="text-[var(--vscode-highlight)] font-semibold">recordNumInOffset</span>
          <span className="text-[var(--vscode-text-muted)]">INT64 (0-based index within offset)</span>
        </div>
        <div className="flex items-center justify-between font-mono bg-[var(--vscode-input-bg)] px-2 py-1.5 rounded">
          <span className="text-[var(--vscode-highlight)] font-semibold">rangeOffset</span>
          <span className="text-[var(--vscode-text-muted)]">INT64 (Split range starting offset)</span>
        </div>
        <div className="flex items-center justify-between font-mono bg-[var(--vscode-input-bg)] px-2 py-1.5 rounded">
          <span className="text-[var(--vscode-highlight)] font-semibold">recordNum</span>
          <span className="text-[var(--vscode-text-muted)]">NULLABLE INT64 (Populated when .withRecordNumMetadata() is enabled)</span>
        </div>
      </div>
    </div>
  );
};

/**
 * ContextualTextIOSourceProperties renders the property configuration form for ContextualTextIO reads.
 */
export const ContextualTextIOSourceProperties: React.FC<ContextualTextIOSourcePropertiesProps> = ({
  node,
  onChange
}) => {
  const properties = node.data.properties || {};
  const filePattern = properties.filePattern || '';
  const delimiter = properties.delimiter || '';
  const hasMultilineCSVRecords = properties.hasMultilineCSVRecords ?? false;
  const compression = properties.compression || 'AUTO';
  const hintMatchesManyFiles = properties.hintMatchesManyFiles ?? false;
  const emptyMatchTreatment = properties.emptyMatchTreatment || 'DISALLOW';
  const watchForNewFilesInterval = properties.watchForNewFilesInterval ?? '';

  const [isAdvancedOpen, setIsAdvancedOpen] = useState<boolean>(false);

  // Validation: filePattern is required for reading files.
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
   * Handles text, number, select, and checkbox input updates.
   *
   * @param e Form change event from input, select, or textarea
   */
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
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
  const handleInstructionsChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    onChange({
      ...properties,
      system_instructions: e.target.value
    });
  };

  return (
    <div className="flex-1 flex flex-col gap-4">
      {/* Java Only Notice */}
      <div
        id="contextualTextSourceNotice"
        data-testid="contextual-text-source-notice"
        className="flex items-center justify-between gap-2 p-2.5 rounded border border-[var(--vscode-border)] bg-[var(--vscode-subcard-bg)] text-xs text-[var(--vscode-text-secondary)]"
      >
        <span>
          <strong>Java Only:</strong> <code>ContextualTextIO</code> is a Java-only node type (<code>beam-sdks-java-io-contextual-text-io</code>) and is only supported in Apache Beam Java pipelines.
        </span>
      </div>

      {/* File Pattern Input with GCS Bucket Datalist */}
      <StoragePathField
        id="contextualTextSourceFilePattern"
        name="filePattern"
        label="File Pattern / Path (.from)"
        tooltip="File or glob pattern to read from (e.g. gs://bucket/data/*.txt or /path/to/files/*.csv). Required."
        value={filePattern}
        onChange={handleChange}
        placeholder="gs://my-bucket/data/*.txt or /path/to/files/*.csv"
        errorMessage="File Pattern is required."
        helperText={
          !isInvalid ? (
            <span className="text-xs text-[var(--vscode-text-muted)]">
              Target file or glob pattern across Cloud Storage, Amazon S3, or local storage.
            </span>
          ) : null
        }
      />

      {/* Emitted Line Context Summary Preview */}
      <LineContextSummary />

      {/* Multiline CSV Records Checkbox */}
      <div className="p-3 bg-[var(--vscode-subcard-bg)] rounded border border-[var(--vscode-border)]">
        <label htmlFor="contextualTextSourceMultiline" className="flex items-center gap-2 cursor-pointer">
          <input
            id="contextualTextSourceMultiline"
            type="checkbox"
            name="hasMultilineCSVRecords"
            checked={hasMultilineCSVRecords}
            onChange={handleChange}
            className="w-4 h-4 rounded border-[var(--vscode-border)] text-blue-600 focus:ring-0 focus:ring-offset-0 bg-[var(--vscode-input-bg)]"
          />
          <span className="text-sm font-medium text-[var(--vscode-text-secondary)]">Multiline CSV Records</span>
          <InfoTooltip text="Configures reader to support CSV records that span multiple lines (.withHasMultilineCSVRecords(true))." />
        </label>
      </div>

      {/* Custom Delimiter */}
      <PropertyField
        id="contextualTextSourceDelimiter"
        name="delimiter"
        label="Record Delimiter (Optional)"
        tooltip="Custom byte delimiter separating records (default is newline '\n'). Passed to .withDelimiter(byte[])."
        value={delimiter}
        onChange={handleChange}
        placeholder="\n (Default newline)"
        mono={true}
      />

      {/* Compression Algorithm Select */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="contextualTextSourceCompression"
          className="flex items-center text-xs font-bold uppercase text-[var(--vscode-text-muted)] gap-1.5"
        >
          <span>Compression</span>
          <InfoTooltip text="Decompression algorithm applied when reading files (e.g. AUTO, UNCOMPRESSED, GZIP, BZIP2, ZIP, DEFLATE, ZSTD)." />
        </label>
        <select
          id="contextualTextSourceCompression"
          name="compression"
          value={compression}
          onChange={handleChange}
          className="bg-[var(--vscode-input-bg)] text-[var(--vscode-text-primary)] p-2 rounded border border-[var(--vscode-border)] text-sm focus:outline-none focus:border-[var(--vscode-highlight)] font-mono"
        >
          {BEAM_COMPRESSION_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </div>

      {/* Empty Match Treatment Select */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="contextualTextSourceEmptyMatchTreatment"
          className="flex items-center text-xs font-bold uppercase text-[var(--vscode-text-muted)] gap-1.5"
        >
          <span>Empty Match Treatment</span>
          <InfoTooltip text="Specifies behavior when pattern matches zero files (.withEmptyMatchTreatment(...)): DISALLOW (default in ContextualTextIO.read(); fail pipeline execution), ALLOW_IF_WILDCARD (allow zero matches only when pattern contains wildcards), ALLOW (proceed with empty collection)." />
        </label>
        <select
          id="contextualTextSourceEmptyMatchTreatment"
          name="emptyMatchTreatment"
          value={emptyMatchTreatment}
          onChange={handleChange}
          className="bg-[var(--vscode-input-bg)] text-[var(--vscode-text-primary)] p-2 rounded border border-[var(--vscode-border)] text-sm focus:outline-none focus:border-[var(--vscode-highlight)] font-mono"
        >
          <option value="DISALLOW">DISALLOW</option>
          <option value="ALLOW_IF_WILDCARD">ALLOW_IF_WILDCARD</option>
          <option value="ALLOW">ALLOW</option>
        </select>
      </div>

      {/* Hint Matches Many Files Checkbox */}
      <div className="p-3 bg-[var(--vscode-subcard-bg)] rounded border border-[var(--vscode-border)]">
        <label
          htmlFor="contextualTextSourceHintMatchesManyFiles"
          className="flex items-center gap-2 cursor-pointer"
        >
          <input
            id="contextualTextSourceHintMatchesManyFiles"
            type="checkbox"
            name="hintMatchesManyFiles"
            checked={hintMatchesManyFiles}
            onChange={handleChange}
            className="w-4 h-4 rounded border-[var(--vscode-border)] text-blue-600 focus:ring-0 focus:ring-offset-0 bg-[var(--vscode-input-bg)]"
          />
          <span className="text-sm font-medium text-[var(--vscode-text-secondary)]">Hint Matches Many Files (Optimization)</span>
          <InfoTooltip text="Hints to the runner that this file pattern expands into a very large number of files (.withHintMatchesManyFiles()), optimizing parallel file expansion." />
        </label>
      </div>

      {/* Advanced Tuning Accordion */}
      <CollapsibleSection
        title="Advanced Options"
        isOpen={isAdvancedOpen}
        onToggle={() => setIsAdvancedOpen(!isAdvancedOpen)}
      >
        {/* Watch For New Files Interval */}
        <PropertyField
          id="contextualTextSourceWatchInterval"
          name="watchForNewFilesInterval"
          label="Watch For New Files Interval (seconds)"
          type="number"
          min="0"
          tooltip="Interval (in seconds) to continuously watch for new files matching the pattern via FileIO.MatchConfiguration.continuously(...). Leave 0 or empty for batch execution."
          value={watchForNewFilesInterval}
          onChange={handleChange}
          placeholder="0 (Batch - do not watch)"
          mono={true}
        />
      </CollapsibleSection>

      {/* Flexible Spacer */}
      <div className="flex-1 min-h-4" />

      {/* Code Generation Instructions */}
      <div className="flex flex-col gap-2 pt-2 border-t border-[var(--vscode-border-light)]">
        <PropertyField
          id="contextualTextSourceSystemInstructions"
          name="system_instructions"
          label="Code Generation Instructions"
          type="textarea"
          value={systemInstructions}
          onChange={handleInstructionsChange}
          placeholder="Enter custom instructions for ContextualTextIO source code generation..."
          rows={3}
          mono={false}
          helperText="Additional guidance appended to prompt when synthesizing Java code."
        />
      </div>
    </div>
  );
};
