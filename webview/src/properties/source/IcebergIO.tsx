/**
 * IcebergIO Source Properties Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Renders the property configuration panel for Apache Beam Iceberg source nodes.
 * Configures batch and streaming reads from Apache Iceberg tables across Cloud Storage (gs://),
 * Amazon S3 (s3://), HDFS (hdfs://), or local filesystems using various Iceberg catalogs.
 * 
 * Architectural Decisions:
 * - Managed I/O Architecture: Beam accesses Iceberg through Managed I/O, not a bespoke IcebergIO class.
 *   In Java, this is invoked via `org.apache.beam.sdk.managed.Managed.read(Managed.ICEBERG)` with a
 *   configuration map; in Python, via `apache_beam.transforms.managed.Read(managed.ICEBERG, config=...)`.
 *   Config keys include `table` (fully-qualified `db.table`), `catalog_name`, `catalog_properties` (a map
 *   containing `type`, `warehouse`, `uri`), and `config_properties`. There is no standalone `IcebergIO.read()` class.
 * - Warehouse Location Autocomplete: Delegates the required warehouse location field to the shared
 *   StoragePathField primitive. Because Iceberg warehouses on Google Cloud commonly live in Cloud Storage (`gs://`),
 *   GCS bucket discovery is active and provides datalist suggestions alongside always-visible discovery error alerting.
 * - Time-Travel Exclusivity: Iceberg supports querying historical snapshots either by snapshot ID (`snapshotId`)
 *   or commit timestamp (`asOfTimestamp`). These two modes are mutually exclusive; setting both triggers an inline
 *   validation error and marks both input controls as invalid.
 * - Conditional Catalog URI: The `catalogUri` property field is conditionally rendered only when `catalogType` is
 *   `rest` or `hive` (the two catalog types requiring external network endpoints).
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
import { InfoTooltip } from '../../components/InfoTooltip';
import { PropertyField } from '../../components/common/PropertyField';
import { CollapsibleSection } from '../../components/common/CollapsibleSection';
import { SelectField } from '../../components/common/SelectField';
import type { SelectFieldOption } from '../../components/common/SelectField';
import { StoragePathField } from '../../components/common/StoragePathField';
import { SecretManagerAuthFields } from '../../components/common/SecretManagerAuthFields';

export interface IcebergIOSourceNode {
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
      snapshotId?: string | number;
      asOfTimestamp?: string;
      filterExpression?: string;
      columnProjection?: string;
      authMode?: string;
      secretName?: string;
      configProperties?: string;
      system_instructions?: string;
      special_instructions?: string;
      [key: string]: any;
    };
  };
}

export interface IcebergIOSourcePropertiesProps {
  node: IcebergIOSourceNode;
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

/**
 * IcebergIOSourceProperties component renders configuration fields for Beam Managed I/O Iceberg reads.
 */
export const IcebergIOSourceProperties: React.FC<IcebergIOSourcePropertiesProps> = ({ node, onChange }) => {
  const properties = node.data.properties || {};
  const table = properties.table || '';
  const catalogName = properties.catalogName || '';
  const catalogType = properties.catalogType || 'hadoop';
  const warehouseLocation = properties.warehouseLocation || '';
  const catalogUri = properties.catalogUri || '';
  const snapshotId = properties.snapshotId ?? '';
  const asOfTimestamp = properties.asOfTimestamp || '';
  const filterExpression = properties.filterExpression || '';
  const columnProjection = properties.columnProjection || '';
  const authMode = properties.authMode || 'default';
  const secretName = properties.secretName || '';
  const configProperties = properties.configProperties || '';

  const [isAdvancedOpen, setIsAdvancedOpen] = useState<boolean>(false);

  // Validation: table and warehouseLocation are required to locate the Iceberg table and catalog metadata.
  const isTableInvalid = !table.trim();
  // NOTE: mirrors StoragePathField's own validation rule; used here to gate helper text.
  const isWarehouseLocationInvalid = !warehouseLocation.trim();

  // NOTE: Iceberg time travel supports querying historical snapshots by snapshot ID OR timestamp,
  // but snapshotId and asOfTimestamp are strictly mutually exclusive.
  const hasSnapshotId = typeof snapshotId === 'string' ? snapshotId.trim().length > 0 : Boolean(snapshotId);
  const hasAsOfTimestamp = typeof asOfTimestamp === 'string' ? asOfTimestamp.trim().length > 0 : Boolean(asOfTimestamp);
  const hasTimeTravelConflict = hasSnapshotId && hasAsOfTimestamp;
  const timeTravelErrorMessage = hasTimeTravelConflict
    ? 'Cannot specify both Snapshot ID and As Of Timestamp. Time travel parameters are mutually exclusive.'
    : null;

  // Conditional render: catalogUri is required only for REST and Hive metastore catalogs
  const showCatalogUri = catalogType === 'rest' || catalogType === 'hive';

  // System instructions text with fallback hierarchy
  const systemInstructions =
    node.data.system_instructions ??
    node.data.special_instructions ??
    properties.system_instructions ??
    properties.special_instructions ??
    '';

  /**
   * Handles generic input, select, and checkbox changes for form fields
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
   * Updates AI prompt / system instructions for code generation
   */
  const handleInstructionsChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    onChange({
      ...properties,
      system_instructions: e.target.value
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
      {/* Table Identifier Input */}
      <PropertyField
        id="icebergSourceTable"
        name="table"
        label="Table Identifier"
        required="Table is required."
        tooltip="Fully-qualified Iceberg table identifier (e.g. db.table or warehouse.db.table). Required."
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
              Fully-qualified database and table name in the Iceberg catalog.
            </span>
          ) : null
        }
      />

      {/* Catalog Name Input */}
      <PropertyField
        id="icebergSourceCatalogName"
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
        id="icebergSourceCatalogType"
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
        id="icebergSourceWarehouseLocation"
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
          id="icebergSourceCatalogUri"
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

      {/* Time-Travel Historical Query Controls */}
      <div className="flex flex-col gap-2 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border)]">
        <span className="text-xs font-bold uppercase text-[var(--vscode-text-muted)] flex items-center gap-1.5">
          <span>Time Travel / Historical Snapshot</span>
          <InfoTooltip text="Query historical snapshots of the Iceberg table either by snapshot ID or timestamp. These modes are mutually exclusive." />
        </span>
        <div className="grid grid-cols-2 gap-3">
          {/* Snapshot ID */}
          <PropertyField
            id="icebergSourceSnapshotId"
            name="snapshotId"
            label="Snapshot ID"
            tooltip="Iceberg snapshot ID (int64) to query for historical time travel. Mutually exclusive with As Of Timestamp."
            value={snapshotId}
            onChange={handleChange}
            placeholder="e.g. 1234567890123456789"
            mono={true}
            invalid={hasTimeTravelConflict}
            helperText="Iceberg snapshot ID integer."
          />

          {/* As Of Timestamp */}
          <PropertyField
            id="icebergSourceAsOfTimestamp"
            name="asOfTimestamp"
            label="As Of Timestamp"
            tooltip="Iceberg commit timestamp string (e.g. 2024-01-01T00:00:00Z) or epoch milliseconds for historical time travel. Mutually exclusive with Snapshot ID."
            value={asOfTimestamp}
            onChange={handleChange}
            placeholder="e.g. 2024-01-01T00:00:00Z"
            mono={true}
            invalid={hasTimeTravelConflict}
            helperText="ISO-8601 timestamp string or epoch ms."
          />
        </div>
        {hasTimeTravelConflict && (
          <span className="text-xs text-red-400 mt-1" role="alert">
            {timeTravelErrorMessage}
          </span>
        )}
      </div>

      {/* Filter Expression (Row filter pushdown) */}
      <PropertyField
        id="icebergSourceFilterExpression"
        name="filterExpression"
        label="Filter Expression (Pushdown)"
        tooltip="SQL row filter expression pushed down to Iceberg during scan planning (e.g. event_date >= '2024-01-01' AND status = 'ACTIVE')."
        value={filterExpression}
        onChange={handleChange}
        placeholder="status = 'ACTIVE' AND amount > 100"
        mono={true}
        helperText={
          <span className="text-[11px] text-[var(--vscode-text-muted)]">
            Pushdown predicate expression evaluated at the storage scan layer.
          </span>
        }
      />

      {/* Column Projection */}
      <PropertyField
        id="icebergSourceColumnProjection"
        name="columnProjection"
        label="Column Projection"
        tooltip="Comma-separated list of columns to read. Iceberg will prune unselected columns from disk scan."
        value={columnProjection}
        onChange={handleChange}
        placeholder="event_id, timestamp, user_id, action, amount"
        mono={true}
        helperText={
          <span className="text-[11px] text-[var(--vscode-text-muted)]">
            Comma-separated column names for Iceberg column projection pushdown (e.g. <code>id, timestamp, payload</code>).
          </span>
        }
      />

      {/* Authentication and Secret Manager Credentials */}
      <SecretManagerAuthFields
        idPrefix="icebergSource"
        datalistId="iceberg-source-secrets-list"
        authMode={authMode}
        secretName={secretName}
        serviceName="Apache Iceberg"
        onChange={handleChange}
      />

      {/* Advanced Tuning Accordion */}
      <CollapsibleSection
        title="Advanced & Catalog Configuration"
        icon={<Sliders className="w-4 h-4 text-emerald-400" />}
        isOpen={isAdvancedOpen}
        onToggle={handleToggleAdvanced}
      >
        <PropertyField
          id="icebergSourceConfigProperties"
          type="textarea"
          name="configProperties"
          label="Configuration Properties"
          tooltip="Key=value pairs (one per line) passed to Iceberg Managed I/O and catalog configuration (e.g. io-impl=org.apache.iceberg.gcp.gcs.GCSFileIO)."
          value={configProperties}
          onChange={handleChange}
          placeholder="io-impl=org.apache.iceberg.gcp.gcs.GCSFileIO&#10;s3.endpoint=https://..."
          rows={3}
          mono={true}
          helperText={
            <span className="text-[11px] text-[var(--vscode-text-muted)]">
              Catalog and Iceberg engine properties passed to Managed I/O config (key=value per line).
            </span>
          }
        />
      </CollapsibleSection>

      {/* Code Generation Instructions */}
      <div className="pt-2 border-t border-[var(--vscode-border-light)]">
        <PropertyField
          id="icebergSourceInstructions"
          name="system_instructions"
          label="Code Generation Instructions"
          tooltip="Custom instructions provided directly to Gemini when generating pipeline source code for this Iceberg reader step via Managed I/O."
          type="textarea"
          rows={3}
          value={systemInstructions}
          onChange={handleInstructionsChange}
          placeholder="e.g. Read Iceberg table records, apply column pruning, and transform rows into PCollection<Row>."
          mono={false}
          className="resize-y h-24"
          helperText="Additional guidance appended to prompt when synthesizing Java/Python code."
        />
      </div>
    </div>
  );
};
