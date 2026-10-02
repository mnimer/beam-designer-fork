/**
 * CloudBigtable Source Properties Component (IO68)
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Renders the property configuration panel for the Cloud Bigtable (HBase based) Source
 * (`Read.from(CloudBigtableIO.read(CloudBigtableScanConfiguration))`) in Apache Beam Java pipelines.
 *
 * Documentation References:
 * - D0: https://cloud.google.com/bigtable/docs/hbase-dataflow-java
 * - D1: https://github.com/googleapis/java-bigtable-hbase/blob/main/bigtable-dataflow-parent/bigtable-hbase-beam/src/main/java/com/google/cloud/bigtable/beam/CloudBigtableIO.java
 * - D2: https://github.com/googleapis/java-bigtable-hbase/blob/main/bigtable-dataflow-parent/bigtable-hbase-beam/src/main/java/com/google/cloud/bigtable/beam/CloudBigtableConfiguration.java
 * - D3: https://github.com/googleapis/java-bigtable-hbase/blob/main/bigtable-dataflow-parent/bigtable-hbase-beam/src/main/java/com/google/cloud/bigtable/beam/CloudBigtableTableConfiguration.java
 * - D4: https://github.com/googleapis/java-bigtable-hbase/blob/main/bigtable-dataflow-parent/bigtable-hbase-beam/src/main/java/com/google/cloud/bigtable/beam/CloudBigtableScanConfiguration.java
 * - D5: https://github.com/googleapis/java-bigtable-hbase/blob/main/bigtable-client-core-parent/bigtable-hbase/src/main/java/com/google/cloud/bigtable/hbase/BigtableOptionsFactory.java
 * - D6: https://hbase.apache.org/2.6/apidocs/org/apache/hadoop/hbase/client/Scan.html
 * - D7: https://github.com/googleapis/java-bigtable-hbase/blob/main/bigtable-client-core-parent/bigtable-hbase/src/main/java/com/google/cloud/bigtable/hbase/adapters/read/ScanAdapter.java
 * - D8: https://github.com/googleapis/java-bigtable-hbase/blob/main/bigtable-client-core-parent/bigtable-hbase/src/main/java/com/google/cloud/bigtable/hbase/adapters/filters/FilterAdapter.java
 * - D9: https://github.com/GoogleCloudPlatform/java-docs-samples/tree/main/bigtable/beam/helloworld
 * - D10: https://github.com/googleapis/googleapis/blob/master/google/bigtable/admin/v2/instance.proto
 * - D11: https://cloud.google.com/resource-manager/docs/creating-managing-projects
 *
 * Per-Property Documentation Mapping:
 * - projectId: D2 CloudBigtableConfiguration.Builder.withProjectId (l.66), validate (l.366); D11
 * - instanceId: D2 CloudBigtableConfiguration.Builder.withInstanceId (l.87); D10 instance.proto (l.102)
 * - tableId: D3 CloudBigtableTableConfiguration.Builder.withTableId (l.46); D10 instance.proto (l.550)
 * - appProfileId: D2 CloudBigtableConfiguration.Builder.withAppProfileId (l.103); D10 instance.proto (l.488)
 * - credentialsSecret: D5 BigtableOptionsFactory.BIGTABLE_USE_CACHED_DATA_CHANNEL_POOL / google.bigtable.auth.json.value (l.119-121); D1 (l.100)
 * - rowPrefix: D6 Scan.setStartStopRowForPrefixScan (l.596)
 * - startRow: D6 Scan.withStartRow (l.455)
 * - stopRow: D6 Scan.withStopRow (l.524)
 * - columnFamilies: D6 Scan.addFamily (l.336); D7 ScanAdapter familyMap
 * - columns: D6 Scan.addColumn (l.349)
 * - maxVersions: D6 Scan.readVersions (l.644) / setMaxVersions
 * - timeRangeMin: D6 Scan.setTimeRange (l.362-374)
 * - timeRangeMax: D6 Scan.setTimeRange (l.362-374), TimeRange.check
 * - rowFilter: D6 Scan.setFilter (l.713); D8 FilterAdapter FirstKeyOnlyFilter (l.82), KeyOnlyFilter (l.70); D9 HelloWorldRead (l.40)
 * - configuration: D2 CloudBigtableConfiguration.Builder.withConfiguration (l.118); D5 BigtableOptionsFactory
 */

import React from 'react';
import { InfoTooltip } from '../../components/InfoTooltip';
import { PropertyField } from '../../components/common/PropertyField';
import { SystemInstructionsField } from '../../components/common/SystemInstructionsField';
import { resolveSystemInstructions } from '../../utils/systemInstructions';
import { SecretManagerSecretField } from '../../components/common/SecretManagerSecretField';
import { ExternalDocsLink } from '../../components/common/ExternalDocsLink';
import { useAssetLoader } from '../../hooks/useAssetLoader';
import { useNodeProperties } from '../../hooks/useNodeProperties';

const CLOUD_BIGTABLE_DOCS_URL = 'https://cloud.google.com/bigtable/docs/hbase-dataflow-java';

const CLOUD_BIGTABLE_SOURCE_CONFIG_KEY_OPTIONS: readonly string[] = [
  'google.bigtable.endpoint.host',
  'google.bigtable.endpoint.port',
  'google.bigtable.emulator.endpoint.host',
  'google.bigtable.universe.domain',
  'google.bigtable.custom.user.agent',
  'google.bigtable.grpc.retry.enable',
  'google.bigtable.grpc.retry.codes',
  'google.bigtable.grpc.retry.deadlineexceeded.enable',
  'google.bigtable.grpc.retry.initial.elapsed.backoff.ms',
  'google.bigtable.grpc.retry.max.elapsed.backoff.ms',
  'google.bigtable.grpc.read.partial.row.timeout.ms',
  'google.bigtable.grpc.retry.max.scan.timeout.retries',
  'google.bigtable.grpc.read.streaming.buffer.size',
  'google.bigtable.grpc.channel.count',
  'google.bigtable.rpc.timeout.ms',
  'google.bigtable.rpc.attempt.timeout.ms',
  'google.bigtable.read.rpc.timeout.ms',
  'google.bigtable.read.rpc.attempt.timeout.ms',
  'google.bigtable.enable.client.side.metrics',
];

const PROJECT_ID_RE = /^(?:[a-z][a-z0-9.-]*[a-z0-9]:)?[a-z][a-z0-9-]{4,28}[a-z0-9]$/;
const INSTANCE_ID_RE = /^[a-z][a-z0-9-]+[a-z0-9]$/;
const TABLE_ID_RE = /^[_a-zA-Z0-9][-_.a-zA-Z0-9]*$/;
const APP_PROFILE_ID_RE = /^[_a-zA-Z0-9][-_.a-zA-Z0-9]*$/;
const TABLE_ID_MAX = 50;
const AUTH_KEY_PREFIX = 'google.bigtable.auth.';
const POSITIVE_INT_RE = /^[1-9]\d*$/;
const NON_NEGATIVE_INT_RE = /^\d+$/;
const COLUMN_PAIR_RE = /^[^:\s,]+:[^\s,]+$/;

const RESERVED_SOURCE_CONFIG_KEYS: ReadonlySet<string> = new Set([
  'google.bigtable.project.id',
  'google.bigtable.instance.id',
  'google.bigtable.app_profile.id',
]);

/** Key-value configuration entry for Cloud Bigtable settings. */
export interface CloudBigtableConfigEntry {
  key: string;
  value: string;
}

/** Props for the {@link CloudBigtableSourceProperties} component. */
export interface CloudBigtableSourcePropertiesProps {
  node: {
    data: {
      properties?: Record<string, unknown>;
      system_instructions?: string;
      special_instructions?: string;
    };
  };
  onChange: (properties: Record<string, unknown>) => void;
}

/**
 * Validates the Google Cloud project ID format.
 *
 * @param value The project ID string to validate.
 * @returns An error message string if invalid, or null if valid.
 */
function validateProjectId(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return 'Project ID is required';
  }
  if (!PROJECT_ID_RE.test(trimmed)) {
    return 'Invalid project ID (6–30 lowercase letters, digits or hyphens; must start with a letter)';
  }
  return null;
}

/**
 * Validates the Cloud Bigtable instance ID format.
 *
 * @param value The instance ID string to validate.
 * @returns An error message string if invalid, or null if valid.
 */
function validateInstanceId(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return 'Instance ID is required';
  }
  if (!INSTANCE_ID_RE.test(trimmed)) {
    return 'Invalid instance ID (lowercase letters, digits and hyphens; must start with a letter and end with a letter or digit)';
  }
  return null;
}

/**
 * Validates the Cloud Bigtable table ID format and length.
 *
 * @param value The table ID string to validate.
 * @returns An error message string if invalid, or null if valid.
 */
function validateTableId(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return 'Table ID is required';
  }
  if (trimmed.length > TABLE_ID_MAX) {
    return 'Table ID must be at most 50 characters';
  }
  if (!TABLE_ID_RE.test(trimmed)) {
    return 'Invalid table ID (letters, digits, _ - . ; must not start with - or .)';
  }
  return null;
}

/**
 * Validates the optional Cloud Bigtable app profile ID format.
 *
 * @param value The app profile ID string to validate.
 * @returns An error message string if invalid, or null if valid.
 */
function validateAppProfileId(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (!APP_PROFILE_ID_RE.test(trimmed)) {
    return 'Invalid app profile ID (letters, digits, _ - . ; must not start with - or .)';
  }
  return null;
}

/**
 * Validates comma-separated Cloud Bigtable column family names.
 *
 * @param value The comma-separated column family string.
 * @returns An error message string if invalid, or null if valid.
 */
function validateColumnFamilies(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const items = value.split(',').map((s) => s.trim());
  if (items.some((item) => !item || /[:\s]/.test(item))) {
    return 'Enter comma-separated column family names (no ":" or spaces)';
  }
  return null;
}

/**
 * Validates comma-separated Cloud Bigtable family:qualifier column pairs.
 *
 * @param value The comma-separated column pairs string.
 * @returns An error message string if invalid, or null if valid.
 */
function validateColumns(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const items = value.split(',').map((s) => s.trim());
  if (items.some((item) => !COLUMN_PAIR_RE.test(item))) {
    return 'Enter comma-separated family:qualifier pairs';
  }
  return null;
}

/**
 * Validates a custom Cloud Bigtable configuration key-value entry.
 *
 * @param entry The key-value configuration entry.
 * @param index The index of the entry in the list.
 * @param allEntries The full list of entries to check for duplicates.
 * @returns An error message string if invalid, or null if valid.
 */
function validateConfigEntry(
  entry: CloudBigtableConfigEntry,
  index: number,
  allEntries: CloudBigtableConfigEntry[]
): string | null {
  const key = entry.key.trim();
  const val = entry.value.trim();
  if (!key && !val) {
    return null;
  }
  if (!key) {
    return 'Key is required';
  }
  if (key.startsWith(AUTH_KEY_PREFIX)) {
    return 'Credential settings are not allowed here. Use the Service Account Key Secret field (or leave empty for Application Default Credentials).';
  }
  if (RESERVED_SOURCE_CONFIG_KEYS.has(key)) {
    return 'Set this with the dedicated field above';
  }
  for (let i = 0; i < index; i++) {
    if (allEntries[i].key.trim() === key) {
      return 'Duplicate key';
    }
  }
  if (!val) {
    return 'Value is required';
  }
  return null;
}

/**
 * Dedicated property panel for the Cloud Bigtable source node. Configures project, instance, table, and scan filters.
 *
 * @param props The selected node and the onChange callback used to persist edits.
 */
export const CloudBigtableSourceProperties: React.FC<CloudBigtableSourcePropertiesProps> = ({ node, onChange }) => {
  const { properties, handleChange } = useNodeProperties(node, onChange);

  const projectId = String(properties.projectId ?? '');
  const instanceId = String(properties.instanceId ?? '');
  const tableId = String(properties.tableId ?? '');
  const appProfileId = String(properties.appProfileId ?? '');
  const credentialsSecret = String(properties.credentialsSecret ?? '');
  const rowPrefix = String(properties.rowPrefix ?? '');
  const startRow = String(properties.startRow ?? '');
  const stopRow = String(properties.stopRow ?? '');
  const columnFamilies = String(properties.columnFamilies ?? '');
  const columns = String(properties.columns ?? '');
  const maxVersions = String(properties.maxVersions ?? '');
  const timeRangeMin = String(properties.timeRangeMin ?? '');
  const timeRangeMax = String(properties.timeRangeMax ?? '');
  const rowFilter = String(properties.rowFilter ?? '');
  const configuration: CloudBigtableConfigEntry[] = Array.isArray(properties.configuration)
    ? (properties.configuration as CloudBigtableConfigEntry[])
    : [];

  const systemInstructions = resolveSystemInstructions(node);

  // Dynamic asset discovery (R2 PubSubIO datalist pattern)
  const { items: projects, loading: projectsLoading, error: projectsError } = useAssetLoader<string>('projects');
  const { items: instances, loading: instancesLoading, error: instancesError } = useAssetLoader<string>('bigtableInstances');

  const trimmedProject = projectId.trim();
  const trimmedInstance = instanceId.trim();
  const tablesInstanceParam = INSTANCE_ID_RE.test(trimmedInstance)
    ? PROJECT_ID_RE.test(trimmedProject)
      ? `projects/${trimmedProject}/instances/${trimmedInstance}`
      : trimmedInstance
    : '';

  const { items: tables, loading: tablesLoading, error: tablesError } = useAssetLoader<string>('bigtableTables', {
    params: { instance: tablesInstanceParam }
  });

  // Field validations
  const projectValidationError = validateProjectId(projectId);
  const instanceValidationError = validateInstanceId(instanceId);
  const tableValidationError = validateTableId(tableId);
  const appProfileValidationError = validateAppProfileId(appProfileId);

  const rowPrefixError =
    rowPrefix.trim() && (startRow.trim() || stopRow.trim())
      ? 'Row Key Prefix cannot be combined with Start Row / Stop Row'
      : null;

  const stopRowError =
    startRow.trim() && stopRow.trim() && stopRow.trim() <= startRow.trim()
      ? 'Stop Row must sort after Start Row'
      : null;

  const columnFamiliesError = validateColumnFamilies(columnFamilies);
  const columnsError = validateColumns(columns);

  const maxVersionsError =
    maxVersions.trim() && !POSITIVE_INT_RE.test(maxVersions.trim())
      ? 'Max Versions must be a positive integer'
      : null;

  const minTrimmed = timeRangeMin.trim();
  const maxTrimmed = timeRangeMax.trim();
  const minFormatValid = !minTrimmed || NON_NEGATIVE_INT_RE.test(minTrimmed);
  const maxFormatValid = !maxTrimmed || NON_NEGATIVE_INT_RE.test(maxTrimmed);

  const timeRangeMinError = !minFormatValid
    ? 'Timestamp must be a non-negative integer (epoch milliseconds)'
    : null;

  const timeRangeMaxError = !maxFormatValid
    ? 'Timestamp must be a non-negative integer (epoch milliseconds)'
    : minTrimmed && maxTrimmed && Number(maxTrimmed) < Number(minTrimmed)
      ? 'Max Timestamp must not be smaller than Min Timestamp'
      : null;


  const handleAddConfig = () => {
    onChange({
      ...properties,
      configuration: [...configuration, { key: '', value: '' }]
    });
  };

  const handleUpdateConfig = (index: number, field: 'key' | 'value', value: string) => {
    const updated = configuration.map((entry, idx) => (idx === index ? { ...entry, [field]: value } : entry));
    onChange({
      ...properties,
      configuration: updated
    });
  };

  const handleRemoveConfig = (index: number) => {
    const remaining = configuration.filter((_, idx) => idx !== index);
    const nextProps = { ...properties };
    if (remaining.length === 0) {
      delete nextProps.configuration;
    } else {
      nextProps.configuration = remaining;
    }
    onChange(nextProps);
  };

  return (
    <div className="flex-1 flex flex-col gap-4">
      {/* Header & Documentation Link */}
      <div className="flex flex-col gap-1.5 p-2.5 rounded bg-slate-800/40 border border-slate-700/60 text-xs text-slate-300">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-slate-200">Cloud Bigtable (HBase) Source</span>
          <ExternalDocsLink url={CLOUD_BIGTABLE_DOCS_URL} />
        </div>
        <p className="text-slate-400">
          Scans rows and cell versions from a Google Cloud Bigtable table using the HBase client API (CloudBigtableIO.read).
        </p>
      </div>

      {/* Group 1: Connection */}
      <div className="flex flex-col gap-3 p-3 bg-slate-800/40 rounded border border-slate-700/50">
        <span className="text-xs font-bold uppercase text-slate-400">Connection</span>

        <PropertyField
          id="cbtSourceProjectId"
          name="projectId"
          label="Project ID"
          required
          tooltip="Google Cloud project ID that owns the Cloud Bigtable instance (CloudBigtableScanConfiguration.Builder.withProjectId)."
          value={projectId}
          error={projectValidationError ?? projectsError}
          onChange={handleChange}
          placeholder="my-project"
          list="cbtSourceProjectOptions"
          datalist={projects}
          loading={projectsLoading}
          helperText={
            <span>
              Values auto-populated from{' '}
              <code className="text-slate-300 bg-slate-800/60 px-1 py-0.5 rounded">gcloud projects list</code>
            </span>
          }
        />

        <PropertyField
          id="cbtSourceInstanceId"
          name="instanceId"
          label="Instance ID"
          required
          tooltip="Cloud Bigtable instance ID, e.g. my-instance (not the full resource name). Values are auto-populated from gcloud bigtable instances list."
          value={instanceId}
          error={instanceValidationError ?? instancesError}
          onChange={handleChange}
          placeholder="my-instance"
          list="cbtSourceInstanceOptions"
          datalist={instances}
          loading={instancesLoading}
          helperText={
            <span>
              Values auto-populated from{' '}
              <code className="text-slate-300 bg-slate-800/60 px-1 py-0.5 rounded">gcloud bigtable instances list</code>
            </span>
          }
        />

        <PropertyField
          id="cbtSourceTableId"
          name="tableId"
          label="Table ID"
          required
          tooltip="Table to read. Values are auto-populated from gcloud bigtable instances tables list once a valid Instance ID is entered."
          value={tableId}
          error={tableValidationError ?? tablesError}
          onChange={handleChange}
          placeholder="my-table"
          list="cbtSourceTableOptions"
          datalist={tables}
          loading={tablesLoading}
          helperText={
            <span>
              Values auto-populated from{' '}
              <code className="text-slate-300 bg-slate-800/60 px-1 py-0.5 rounded">gcloud bigtable instances tables list</code>
            </span>
          }
        />

        <PropertyField
          id="cbtSourceAppProfileId"
          name="appProfileId"
          label="App Profile ID"
          tooltip="Optional app profile that routes this job's requests (withAppProfileId). Leave empty to use the instance's default app profile."
          value={appProfileId}
          error={appProfileValidationError}
          onChange={handleChange}
          placeholder="default"
        />

        <SecretManagerSecretField
          id="cbtSourceCredentialsSecret"
          name="credentialsSecret"
          label="Service Account Key Secret"
          value={credentialsSecret}
          onChange={handleChange}
          placeholder="e.g. bigtable-sa-key"
          tooltip="Optional. Short ID of a Secret Manager secret holding a service-account JSON key. The generated code reads it at pipeline construction and passes it as google.bigtable.auth.json.value. Leave empty to use Application Default Credentials / the worker service account."
        />
      </div>

      {/* Group 2: Row Range & Scan */}
      <div className="flex flex-col gap-3 p-3 bg-slate-800/40 rounded border border-slate-700/50">
        <span className="text-xs font-bold uppercase text-slate-400">Row Range &amp; Scan</span>

        <PropertyField
          id="cbtSourceRowPrefix"
          name="rowPrefix"
          label="Row Key Prefix"
          tooltip="Only read rows whose key starts with this prefix (Scan.setStartStopRowForPrefixScan). Overrides Start/Stop Row, so use one or the other."
          value={rowPrefix}
          error={rowPrefixError}
          onChange={handleChange}
          placeholder="user#"
        />

        <PropertyField
          id="cbtSourceStartRow"
          name="startRow"
          label="Start Row (inclusive)"
          tooltip="First row key to read, inclusive (Scan.withStartRow). Leave empty to start at the beginning of the table."
          value={startRow}
          onChange={handleChange}
        />

        <PropertyField
          id="cbtSourceStopRow"
          name="stopRow"
          label="Stop Row (exclusive)"
          tooltip="Row key at which to stop reading, exclusive (Scan.withStopRow). Leave empty to read to the end of the table."
          value={stopRow}
          error={stopRowError}
          onChange={handleChange}
        />

        <PropertyField
          id="cbtSourceColumnFamilies"
          name="columnFamilies"
          label="Column Families"
          tooltip="Comma-separated column families to return (Scan.addFamily). Leave empty to return all families."
          value={columnFamilies}
          error={columnFamiliesError}
          onChange={handleChange}
          placeholder="cf1, cf2"
        />

        <PropertyField
          id="cbtSourceColumns"
          name="columns"
          label="Columns"
          tooltip="Comma-separated family:qualifier columns to return (Scan.addColumn). Can be combined with Column Families."
          value={columns}
          error={columnsError}
          onChange={handleChange}
          placeholder="cf1:qualifier, cf2:name"
        />

        <PropertyField
          id="cbtSourceMaxVersions"
          name="maxVersions"
          label="Max Versions per Cell"
          type="number"
          min={1}
          tooltip="Number of cell versions to return per column (Scan.readVersions). Leave empty for the HBase default of 1 (latest version only)."
          value={maxVersions}
          error={maxVersionsError}
          onChange={handleChange}
          placeholder="1"
        />

        <PropertyField
          id="cbtSourceTimeRangeMin"
          name="timeRangeMin"
          label="Min Timestamp (ms, inclusive)"
          type="number"
          min={0}
          tooltip="Lower bound of the cell timestamp range in epoch milliseconds, inclusive (Scan.setTimeRange). Leave both empty for all time."
          value={timeRangeMin}
          error={timeRangeMinError}
          onChange={handleChange}
        />

        <PropertyField
          id="cbtSourceTimeRangeMax"
          name="timeRangeMax"
          label="Max Timestamp (ms, exclusive)"
          type="number"
          min={0}
          tooltip="Upper bound of the cell timestamp range in epoch milliseconds, exclusive (Scan.setTimeRange). If only Min is set, the range is open-ended."
          value={timeRangeMax}
          error={timeRangeMaxError}
          onChange={handleChange}
        />

        <div className="flex flex-col gap-2">
          <label htmlFor="cbtSourceRowFilter" className="flex items-center text-xs font-bold uppercase text-slate-500">
            <span>Row Filter</span>
            <InfoTooltip text="Optional HBase filter applied server-side (Scan.setFilter). FirstKeyOnlyFilter is used in Google's Dataflow HBase sample to count rows cheaply. Use Code Generation Instructions for other supported HBase filters." />
          </label>
          <select
            id="cbtSourceRowFilter"
            name="rowFilter"
            value={rowFilter}
            onChange={handleChange}
            className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
          >
            <option value="">None</option>
            <option value="FirstKeyOnlyFilter">First cell of each row (FirstKeyOnlyFilter)</option>
            <option value="KeyOnlyFilter">Keys only, strip values (KeyOnlyFilter)</option>
          </select>
        </div>
      </div>

      {/* Group 3: Advanced Connection Settings */}
      <div className="flex flex-col gap-3 p-3 bg-slate-800/40 rounded border border-slate-700/50">
        <div className="flex items-center text-xs font-bold uppercase text-slate-400">
          <span>Advanced Connection Settings</span>
          <InfoTooltip text="Extra BigtableOptionsFactory settings passed with withConfiguration(key, value), e.g. google.bigtable.read.rpc.timeout.ms = 600000. Credential keys (google.bigtable.auth.*) are not allowed here." />
        </div>

        <datalist id="cbtSrcConfigKeyOptions">
          {CLOUD_BIGTABLE_SOURCE_CONFIG_KEY_OPTIONS.map((keyOption) => (
            <option key={keyOption} value={keyOption} />
          ))}
        </datalist>

        {configuration.map((entry, idx) => {
          const rowError = validateConfigEntry(entry, idx, configuration);
          return (
            <div key={idx} className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <PropertyField
                  id={`cbtSrcConfigKey-${idx}`}
                  aria-label={`Configuration key ${idx + 1}`}
                  value={entry.key}
                  onChange={(e) => handleUpdateConfig(idx, 'key', e.target.value)}
                  placeholder="google.bigtable.read.rpc.timeout.ms"
                  datalist={[...CLOUD_BIGTABLE_SOURCE_CONFIG_KEY_OPTIONS]}
                  containerClassName="flex-1"
                />
                <input
                  id={`cbtSrcConfigValue-${idx}`}
                  type="text"
                  aria-label={`Configuration value ${idx + 1}`}
                  value={entry.value}
                  onChange={(e) => handleUpdateConfig(idx, 'value', e.target.value)}
                  placeholder="600000"
                  className="w-32 bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm font-mono focus:outline-none focus:border-blue-500"
                />
                <button
                  type="button"
                  aria-label={`Remove configuration entry ${idx + 1}`}
                  onClick={() => handleRemoveConfig(idx)}
                  className="px-2 py-1 text-xs text-red-400 hover:text-red-300 border border-slate-700 rounded"
                >
                  Remove
                </button>
              </div>
              {rowError && (
                <span className="text-xs text-red-400" role="alert">
                  {rowError}
                </span>
              )}
            </div>
          );
        })}

        <button
          type="button"
          onClick={handleAddConfig}
          className="self-start px-3 py-1.5 text-xs font-medium text-blue-400 hover:text-blue-300 border border-slate-700 rounded bg-[#252836]"
        >
          Add configuration entry
        </button>
      </div>

      {/* Code Generation Instructions */}
      <SystemInstructionsField
        id="cbtSourceSystemInstructions"
        value={systemInstructions}
        placeholder="Enter custom instructions for Cloud Bigtable (HBase) source code generation..."
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
