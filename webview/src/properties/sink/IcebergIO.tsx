/**
 * IcebergIO Sink Properties Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Renders the property configuration panel for Apache Beam Iceberg sink nodes.
 * Configures batch and streaming writes to Apache Iceberg tables across Cloud Storage (gs://),
 * Amazon S3 (s3://), HDFS (hdfs://), or local filesystems using various Iceberg catalogs.
 * 
 * Architectural Decisions:
 * - Managed I/O Architecture: Beam accesses Iceberg through Managed I/O, not a bespoke IcebergIO class.
 *   In Java, this is invoked via `org.apache.beam.sdk.managed.Managed.write(Managed.ICEBERG)` with a
 *   configuration map; in Python, via `apache_beam.transforms.managed.Write(managed.ICEBERG, config=...)`.
 *   Config keys include `table` (fully-qualified `db.table`), `catalog_name`, `catalog_properties` (a map
 *   containing `type`, `warehouse`, `uri`), and `config_properties`. There is no standalone `IcebergIO.write()` class.
 * - Warehouse Location Autocomplete: Delegates the required warehouse location field to the shared
 *   StoragePathField primitive. Because Iceberg warehouses commonly live on Cloud Storage (`gs://`),
 *   GCS bucket discovery is active and provides datalist suggestions alongside always-visible discovery error alerting.
 * - Append-Only Semantics (NO Write Mode field): Beam's Managed Iceberg connector writes are
 *   **append-only**. Its config schema has no `write_mode` key, so `overwrite` and `upsert` are not
 *   reachable. This panel previously offered a Write Mode dropdown with all three; selecting
 *   "upsert" produced silent appends — duplicate rows where the user expected a merge. The field
 *   was removed rather than defaulted, because an inert control still communicates a choice.
 * - Automatic Table Creation (NO checkbox): the connector creates the target table from the
 *   incoming schema when it is missing, unconditionally. There is no `create_table_if_not_exists`
 *   key to bind, so the former checkbox could neither enable nor disable anything.
 * - Streaming Commit Cadence: Exposes `triggeringFrequencySeconds` for configuring commit intervals on streaming
 *   pipelines, explicitly documenting via tooltip and helper text that it only applies to streaming pipelines.
 *   This one IS real — it maps to the `triggering_frequency_seconds` config key.
 * - Conditional Catalog URI: The `catalogUri` property field is conditionally rendered only when `catalogType` is
 *   `rest` or `hive`.
 * - Shared Primitives Composition: Reuses shared primitives (StoragePathField, CollapsibleSection, SelectField,
 *   PropertyField, SecretManagerAuthFields) to eliminate code duplication and prevent UI drift.
 * - Credential Management: Integrates SecretManagerAuthFields to securely reference Google Cloud Secret Manager
 *   secrets for catalog or object storage authentication without hardcoding credentials in pipeline specifications.
 * - Design System & Theming: Strictly adheres to the 8pt grid system, VS Code theme tokens (`var(--vscode-*)`),
 *   and Tailwind utility classes without inline styles or raw slate color tokens.
 * - Controlled Component Pattern: Strictly controlled via `node` (props in) and `onChange` (events up).
 */

import React, { useState } from 'react';
import { Sliders } from 'lucide-react';
import { PropertyField } from '../../components/common/PropertyField';
import { SystemInstructionsField } from '../../components/common/SystemInstructionsField';
import { resolveSystemInstructions } from '../../utils/systemInstructions';
import { CollapsibleSection } from '../../components/common/CollapsibleSection';
import { SelectField } from '../../components/common/SelectField';
import type { SelectFieldOption } from '../../components/common/SelectField';
import { StoragePathField } from '../../components/common/StoragePathField';
import { SecretManagerAuthFields } from '../../components/common/SecretManagerAuthFields';

/**
 * React Flow node shape for the Iceberg sink panel, including its persisted configuration data.
 */
export interface IcebergIOSinkNode {
  data: {
    label: string;
    beam_transform?: string;
    system_instructions?: string;
    special_instructions?: string;
    properties?: {
      table?: string;
      catalogName?: string;
      catalogType?: string;
      warehouseLocation?: string;
      catalogUri?: string;
      partitionFields?: string;
      tableProperties?: string;
      triggeringFrequencySeconds?: string | number;
      authMode?: string;
      secretName?: string;
      system_instructions?: string;
      special_instructions?: string;
      [key: string]: any;
    };
  };
}

/**
 * Props for the IcebergIOSinkProperties component.
 */
export interface IcebergIOSinkPropertiesProps {
  node: IcebergIOSinkNode;
  onChange: (properties: any) => void;
}

/** Supported Iceberg catalog integration types for Managed I/O table resolution */
export const ICEBERG_CATALOG_TYPES: SelectFieldOption[] = [
  { value: 'hadoop', label: 'Hadoop (Filesystem catalog)' },
  { value: 'hive', label: 'Hive Metastore (HMS)' },
  { value: 'rest', label: 'REST Catalog' },
  { value: 'glue', label: 'AWS Glue Data Catalog' },
  { value: 'nessie', label: 'Project Nessie Catalog' },
  { value: 'bigquery', label: 'BigQuery Metastore' }
];

// NOTE: an exported ICEBERG_WRITE_MODES list (append / overwrite / upsert) lived here. Beam's
// Managed Iceberg connector is append-only and exposes no `write_mode` config key, so two of the
// three options silently degraded to append. Removed rather than trimmed to a single option: a
// one-choice dropdown still implies a decision the connector does not offer.

/**
 * IcebergIOSinkProperties component renders configuration fields for Beam Managed I/O Iceberg writes.
 */
export const IcebergIOSinkProperties: React.FC<IcebergIOSinkPropertiesProps> = ({ node, onChange }) => {
  const properties = node.data.properties || {};
  const table = properties.table || '';
  const catalogName = properties.catalogName || '';
  const catalogType = properties.catalogType || 'hadoop';
  const warehouseLocation = properties.warehouseLocation || '';
  const catalogUri = properties.catalogUri || '';
  const partitionFields = properties.partitionFields || '';
  const tableProperties = properties.tableProperties || '';
  const triggeringFrequencySeconds = properties.triggeringFrequencySeconds ?? '';
  const authMode = properties.authMode || 'default';
  const secretName = properties.secretName || '';

  const [isAdvancedOpen, setIsAdvancedOpen] = useState<boolean>(false);

  // Validation: table and warehouseLocation are required to write to the Iceberg table.
  const isTableInvalid = !table.trim();
  // NOTE: mirrors StoragePathField's own validation rule; used here to gate helper text.
  const isWarehouseLocationInvalid = !warehouseLocation.trim();

  // Conditional render: catalogUri is required only for REST and Hive metastore catalogs
  const showCatalogUri = catalogType === 'rest' || catalogType === 'hive';

  // System instructions text with fallback hierarchy
  const systemInstructions = resolveSystemInstructions(node);

  /**
   * Handles generic input and select changes for form fields.
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
   * Toggles the table write tuning accordion state
   */
  const handleToggleAdvanced = () => {
    setIsAdvancedOpen((prev) => !prev);
  };

  return (
    <div className="flex-1 flex flex-col gap-4">
      {/* Table Identifier Input */}
      <PropertyField
        id="icebergSinkTable"
        name="table"
        label="Table Identifier"
        required="Table is required."
        tooltip="Fully-qualified Iceberg target table identifier (e.g. db.table). Required."
        aria-required="true"
        aria-invalid={isTableInvalid}
        value={table}
        onChange={handleChange}
        placeholder="db.table"
        invalid={isTableInvalid}
        error={isTableInvalid ? 'Table is required.' : null}
        mono={true}
        helperText={
          !isTableInvalid ? (
            <span className="text-xs text-[var(--vscode-text-muted)]">
              Fully-qualified target database and table name in the Iceberg catalog.
            </span>
          ) : null
        }
      />

      {/* Catalog Name Input */}
      <PropertyField
        id="icebergSinkCatalogName"
        name="catalogName"
        label="Catalog Name"
        tooltip="Name of the Iceberg catalog instance (e.g. lakehouse, default, or prod_catalog)."
        value={catalogName}
        onChange={handleChange}
        placeholder="lakehouse"
        mono={true}
        helperText={
          <span className="text-[11px] text-[var(--vscode-text-muted)]">
            Logical catalog name passed in Managed I/O configuration (<code>catalog_name</code>).
          </span>
        }
      />

      {/* Catalog Type Select */}
      <SelectField
        id="icebergSinkCatalogType"
        name="catalogType"
        label="Catalog Type"
        tooltip="Iceberg catalog implementation type (hadoop, hive, rest, glue, nessie, bigquery)."
        value={catalogType}
        options={ICEBERG_CATALOG_TYPES}
        onChange={handleChange}
        helperText={
          <span>
            Catalog implementation type configuring table metadata lookup. Defaults to <code>hadoop</code>.
          </span>
        }
      />

      {/* Warehouse Location Input with Cloud Storage bucket autocomplete */}
      <StoragePathField
        id="icebergSinkWarehouseLocation"
        name="warehouseLocation"
        label="Warehouse Location"
        tooltip="Base storage path for Iceberg metadata and data files (e.g. gs://lakehouse/iceberg/warehouse). Required."
        value={warehouseLocation}
        onChange={handleChange}
        placeholder="gs://lakehouse/iceberg/warehouse"
        errorMessage="Warehouse Location is required."
        helperText={
          !isWarehouseLocationInvalid ? (
            <span className="text-xs text-[var(--vscode-text-muted)]">
              Base storage path where Iceberg table metadata and data files reside.
            </span>
          ) : null
        }
      />

      {/* Conditional Catalog URI (Shown for REST and Hive metastore catalogs) */}
      {showCatalogUri && (
        <PropertyField
          id="icebergSinkCatalogUri"
          name="catalogUri"
          label="Catalog URI"
          tooltip="Endpoint URI for the Iceberg REST catalog or Hive Metastore (e.g. http://rest-catalog:8181 or thrift://metastore:9083)."
          value={catalogUri}
          onChange={handleChange}
          placeholder={catalogType === 'hive' ? 'thrift://metastore:9083' : 'http://rest-catalog:8181'}
          mono={true}
          helperText={
            <span className="text-[11px] text-[var(--vscode-text-muted)]">
              {catalogType === 'hive'
                ? 'Thrift URI for Hive Metastore (HMS).'
                : 'HTTP/HTTPS endpoint for Iceberg REST Catalog server.'}
            </span>
          }
        />
      )}

      {/* Partition Fields */}
      <PropertyField
        id="icebergSinkPartitionFields"
        name="partitionFields"
        label="Partition Fields"
        tooltip="Comma-separated list of table partition fields (e.g. date, region, hour(event_time))."
        value={partitionFields}
        onChange={handleChange}
        placeholder="date, category, region"
        mono={true}
        helperText={
          <span className="text-[11px] text-[var(--vscode-text-muted)]">
            Comma-separated partition fields or transform expressions (e.g. <code>date, region, hour(event_time)</code>).
          </span>
        }
      />

      {/* Table Write Options Accordion */}
      <CollapsibleSection
        title="Table & Write Options"
        icon={<Sliders className="w-4 h-4 text-emerald-400" />}
        isOpen={isAdvancedOpen}
        onToggle={handleToggleAdvanced}
      >
        {/*
          Replaces the former "Create Table If Not Exists" checkbox and "Write Mode" dropdown.
          Managed Iceberg creates a missing table from the incoming schema unconditionally and
          every write appends; neither behaviour has a config key, so a control here would imply
          a choice the connector does not offer. Stated explicitly so the absence of the fields
          reads as a documented constraint rather than an oversight.
        */}
        <p className="text-[11px] text-[var(--vscode-text-muted)] mt-1">
          Writes are <strong>append-only</strong>, and a missing table is created automatically from
          the incoming schema. Neither behaviour is configurable through Beam.
        </p>

        {/* Triggering Frequency Seconds (Streaming Commit Cadence) */}
        <PropertyField
          id="icebergSinkTriggeringFrequencySeconds"
          type="number"
          name="triggeringFrequencySeconds"
          label="Triggering Frequency (Seconds)"
          tooltip="Commit cadence in seconds for streaming writes (e.g. 60). Applies to streaming writes only; ignored in batch mode."
          value={triggeringFrequencySeconds}
          onChange={handleChange}
          placeholder="60"
          min="1"
          mono={true}
          helperText={
            <span className="text-[11px] text-[var(--vscode-text-muted)]">
              Commit cadence for streaming writes only (e.g. 60s). Ignored for batch execution.
            </span>
          }
        />

        {/* Table Properties Textarea */}
        <PropertyField
          id="icebergSinkTableProperties"
          type="textarea"
          name="tableProperties"
          label="Table Properties"
          tooltip="Key=value pairs (one per line) specifying Iceberg table write and format properties (e.g. write.format.default=parquet, commit.retry.num-retries=4)."
          value={tableProperties}
          onChange={handleChange}
          placeholder="write.format.default=parquet&#10;commit.retry.num-retries=4"
          rows={3}
          mono={true}
          helperText={
            <span className="text-[11px] text-[var(--vscode-text-muted)]">
              Iceberg table and writer configuration properties (key=value per line).
            </span>
          }
        />
      </CollapsibleSection>

      {/* Authentication and Secret Manager Credentials */}
      <SecretManagerAuthFields
        idPrefix="icebergSink"
        datalistId="iceberg-sink-secrets-list"
        authMode={authMode}
        secretName={secretName}
        serviceName="Apache Iceberg"
        onChange={handleChange}
      />

      {/* Code Generation Instructions */}
      <SystemInstructionsField
        id="icebergSinkInstructions"
        value={systemInstructions}
        tooltip="Custom instructions provided directly to Gemini when generating pipeline sink code for this Iceberg writer step via Managed I/O."
        placeholder="e.g. Write PCollection<Row> to Iceberg table in append mode, partitioned by date."
        helperText="Additional guidance appended to prompt when synthesizing Java/Python code."
        textareaClassName="h-24"
        wrapperClassName="pt-2 border-t border-[var(--vscode-border-light)]"
        onChange={(value) => onChange({ ...properties, system_instructions: value })}
      />
    </div>
  );
};
