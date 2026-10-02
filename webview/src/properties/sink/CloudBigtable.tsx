/**
 * CloudBigtable Sink Properties Component (IO68)
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Renders the property configuration panel for the Cloud Bigtable (HBase based) Sink
 * (`CloudBigtableIO.writeToTable(CloudBigtableTableConfiguration)` and
 * `CloudBigtableIO.writeToMultipleTables(CloudBigtableConfiguration)`) in Apache Beam Java pipelines.
 *
 * Documentation References:
 * - D0: https://cloud.google.com/bigtable/docs/hbase-dataflow-java
 * - D1: https://github.com/googleapis/java-bigtable-hbase/blob/main/bigtable-dataflow-parent/bigtable-hbase-beam/src/main/java/com/google/cloud/bigtable/beam/CloudBigtableIO.java
 * - D2: https://github.com/googleapis/java-bigtable-hbase/blob/main/bigtable-dataflow-parent/bigtable-hbase-beam/src/main/java/com/google/cloud/bigtable/beam/CloudBigtableConfiguration.java
 * - D3: https://github.com/googleapis/java-bigtable-hbase/blob/main/bigtable-dataflow-parent/bigtable-hbase-beam/src/main/java/com/google/cloud/bigtable/beam/CloudBigtableTableConfiguration.java
 * - D5: https://github.com/googleapis/java-bigtable-hbase/blob/main/bigtable-client-core-parent/bigtable-hbase/src/main/java/com/google/cloud/bigtable/hbase/BigtableOptionsFactory.java
 * - D9: https://github.com/GoogleCloudPlatform/java-docs-samples/tree/main/bigtable/beam/helloworld
 * - D10: https://github.com/googleapis/googleapis/blob/master/google/bigtable/admin/v2/instance.proto
 * - D11: https://cloud.google.com/resource-manager/docs/creating-managing-projects
 *
 * Per-Property Documentation Mapping:
 * - projectId: D2 CloudBigtableConfiguration.Builder.withProjectId (l.66), validate (l.366); D11
 * - instanceId: D2 CloudBigtableConfiguration.Builder.withInstanceId (l.87); D10 instance.proto (l.102)
 * - appProfileId: D2 CloudBigtableConfiguration.Builder.withAppProfileId (l.103); D10 instance.proto (l.488)
 * - credentialsSecret: D5 BigtableOptionsFactory google.bigtable.auth.json.value (l.119-121); D1 (l.100)
 * - writeMode: D1 CloudBigtableIO.writeToTable (l.1222) vs CloudBigtableIO.writeToMultipleTables (l.1250)
 * - tableId: D3 CloudBigtableTableConfiguration.Builder.withTableId (l.46); D1 (l.1213-1221); D10 instance.proto (l.550)
 * - bulkMutationFlowControl: D5 BigtableOptionsFactory.BIGTABLE_ENABLE_BULK_MUTATION_FLOW_CONTROL (l.350-358); D9 HelloWorldWrite (l.100-107)
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

const CLOUD_BIGTABLE_DOCS_URL = 'https://cloud.google.com/bigtable/docs/hbase-dataflow-java';

const CLOUD_BIGTABLE_SINK_CONFIG_KEY_OPTIONS: readonly string[] = [
  'google.bigtable.endpoint.host',
  'google.bigtable.endpoint.port',
  'google.bigtable.emulator.endpoint.host',
  'google.bigtable.universe.domain',
  'google.bigtable.custom.user.agent',
  'google.bigtable.grpc.retry.enable',
  'google.bigtable.grpc.retry.codes',
  'google.bigtable.grpc.retry.initial.elapsed.backoff.ms',
  'google.bigtable.grpc.retry.max.elapsed.backoff.ms',
  'google.bigtable.grpc.channel.count',
  'google.bigtable.rpc.timeout.ms',
  'google.bigtable.rpc.attempt.timeout.ms',
  'google.bigtable.enable.client.side.metrics',
  'google.bigtable.bulk.max.request.size.bytes',
  'google.bigtable.bulk.max.row.key.count',
  'google.bigtable.bulk.autoflush.ms',
  'google.bigtable.buffered.mutator.max.inflight.rpcs',
  'google.bigtable.buffered.mutator.max.memory',
  'google.bigtable.buffered.mutator.throttling.enable',
  'google.bigtable.buffered.mutator.throttling.threshold.ms',
  'google.bigtable.mutate.rpc.timeout.ms',
  'google.bigtable.mutate.rpc.attempt.timeout.ms',
  'google.bigtable.alllow.no.timestamp.retries',
];

const PROJECT_ID_RE = /^(?:[a-z][a-z0-9.-]*[a-z0-9]:)?[a-z][a-z0-9-]{4,28}[a-z0-9]$/;
const INSTANCE_ID_RE = /^[a-z][a-z0-9-]+[a-z0-9]$/;
const TABLE_ID_RE = /^[_a-zA-Z0-9][-_.a-zA-Z0-9]*$/;
const APP_PROFILE_ID_RE = /^[_a-zA-Z0-9][-_.a-zA-Z0-9]*$/;
const TABLE_ID_MAX = 50;
const AUTH_KEY_PREFIX = 'google.bigtable.auth.';

const RESERVED_SINK_CONFIG_KEYS: ReadonlySet<string> = new Set([
  'google.bigtable.project.id',
  'google.bigtable.instance.id',
  'google.bigtable.app_profile.id',
  'google.bigtable.enable.bulk.mutation.flow.control',
]);

/**
 * Custom configuration key-value entry for Cloud Bigtable sink options.
 */
export interface CloudBigtableSinkConfigEntry {
  key: string;
  value: string;
}

/**
 * Props for the CloudBigtableSinkProperties component.
 */
export interface CloudBigtableSinkPropertiesProps {
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
 * Validates a Google Cloud project ID string.
 *
 * @param value The candidate project ID.
 * @returns Error message if invalid, or null if valid.
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
 * Validates a Cloud Bigtable instance ID string.
 *
 * @param value The candidate instance ID.
 * @returns Error message if invalid, or null if valid.
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
 * Validates a Cloud Bigtable table ID string.
 *
 * @param value The candidate table ID.
 * @returns Error message if invalid, or null if valid.
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
 * Validates an optional Cloud Bigtable app profile ID string.
 *
 * @param value The candidate app profile ID.
 * @returns Error message if invalid, or null if valid.
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
 * Validates a custom configuration key-value entry for the Bigtable sink.
 *
 * @param entry The config entry to validate.
 * @param index Index of the entry within the full config list.
 * @param allEntries Full list of configured entries for duplicate detection.
 * @returns Error message if invalid, or null if valid.
 */
function validateConfigEntry(
  entry: CloudBigtableSinkConfigEntry,
  index: number,
  allEntries: CloudBigtableSinkConfigEntry[]
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
  if (RESERVED_SINK_CONFIG_KEYS.has(key)) {
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
 * Dedicated property panel for the Cloud Bigtable sink node. Configures target instance, table, write mode, and credentials.
 *
 * @param props The selected node and the onChange callback used to persist edits.
 */
export const CloudBigtableSinkProperties: React.FC<CloudBigtableSinkPropertiesProps> = ({ node, onChange }) => {
  const properties = node.data.properties || {};

  const projectId = String(properties.projectId ?? '');
  const instanceId = String(properties.instanceId ?? '');
  const appProfileId = String(properties.appProfileId ?? '');
  const credentialsSecret = String(properties.credentialsSecret ?? '');
  const writeMode = String(properties.writeMode || 'singleTable');
  const tableId = String(properties.tableId ?? '');
  const bulkMutationFlowControl = Boolean(properties.bulkMutationFlowControl);
  const configuration: CloudBigtableSinkConfigEntry[] = Array.isArray(properties.configuration)
    ? (properties.configuration as CloudBigtableSinkConfigEntry[])
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
    params: { instance: writeMode === 'singleTable' ? tablesInstanceParam : '' }
  });

  // Field validations
  const projectValidationError = validateProjectId(projectId);
  const instanceValidationError = validateInstanceId(instanceId);
  const appProfileValidationError = validateAppProfileId(appProfileId);
  const tableValidationError = writeMode === 'singleTable' ? validateTableId(tableId) : null;


  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const isCheckbox = type === 'checkbox';
    const checked = isCheckbox ? (e.target as HTMLInputElement).checked : undefined;

    const nextProps: Record<string, unknown> = {
      ...properties,
      [name]: isCheckbox ? checked : value
    };

    if (name === 'writeMode' && value === 'multipleTables') {
      delete nextProps.tableId;
    }

    onChange(nextProps);
  };

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
          <span className="font-semibold text-slate-200">Cloud Bigtable (HBase) Sink</span>
          <ExternalDocsLink url={CLOUD_BIGTABLE_DOCS_URL} />
        </div>
        <p className="text-slate-400">
          Writes HBase Put and Delete mutations to a Google Cloud Bigtable table (CloudBigtableIO.writeToTable).
        </p>
      </div>

      {/* Group 1: Connection */}
      <div className="flex flex-col gap-3 p-3 bg-slate-800/40 rounded border border-slate-700/50">
        <span className="text-xs font-bold uppercase text-slate-400">Connection</span>

        <PropertyField
          id="cbtSinkProjectId"
          name="projectId"
          label="Project ID"
          required
          tooltip="Google Cloud project ID that owns the Cloud Bigtable instance (CloudBigtableTableConfiguration.Builder.withProjectId)."
          value={projectId}
          error={projectValidationError ?? projectsError}
          onChange={handleChange}
          placeholder="my-project"
          list="cbtSinkProjectOptions"
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
          id="cbtSinkInstanceId"
          name="instanceId"
          label="Instance ID"
          required
          tooltip="Cloud Bigtable instance ID, e.g. my-instance (not the full resource name). Values are auto-populated from gcloud bigtable instances list."
          value={instanceId}
          error={instanceValidationError ?? instancesError}
          onChange={handleChange}
          placeholder="my-instance"
          list="cbtSinkInstanceOptions"
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
          id="cbtSinkAppProfileId"
          name="appProfileId"
          label="App Profile ID"
          tooltip="Optional app profile that routes this job's requests (withAppProfileId). Leave empty to use the instance's default app profile."
          value={appProfileId}
          error={appProfileValidationError}
          onChange={handleChange}
          placeholder="default"
        />

        <SecretManagerSecretField
          id="cbtSinkCredentialsSecret"
          name="credentialsSecret"
          label="Service Account Key Secret"
          value={credentialsSecret}
          onChange={handleChange}
          placeholder="e.g. bigtable-sa-key"
          tooltip="Optional. Short ID of a Secret Manager secret holding a service-account JSON key. The generated code reads it at pipeline construction and passes it as google.bigtable.auth.json.value. Leave empty to use Application Default Credentials / the worker service account."
        />
      </div>

      {/* Group 2: Write Target */}
      <div className="flex flex-col gap-3 p-3 bg-slate-800/40 rounded border border-slate-700/50">
        <span className="text-xs font-bold uppercase text-slate-400">Write Target</span>

        <div className="flex flex-col gap-2">
          <label htmlFor="cbtSinkWriteMode" className="flex items-center text-xs font-bold uppercase text-slate-500">
            <span>Write Mode</span>
            <span className="text-red-400 ml-1 font-bold" title="Required">*</span>
            <InfoTooltip text="Single table: input is PCollection<Mutation> written to Table ID. Multiple tables: input is PCollection<KV<String, Iterable<Mutation>>> where the key is the destination table ID." />
          </label>
          <select
            id="cbtSinkWriteMode"
            name="writeMode"
            value={writeMode}
            onChange={handleChange}
            className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
          >
            <option value="singleTable">Single table (writeToTable)</option>
            <option value="multipleTables">Multiple tables (writeToMultipleTables)</option>
          </select>
        </div>

        {writeMode === 'singleTable' && (
          <PropertyField
            id="cbtSinkTableId"
            name="tableId"
            label="Table ID"
            required
            tooltip="Destination table. Only Put and Delete mutations are supported; Append and Increment are rejected by the connector because retries could apply them twice."
            value={tableId}
            error={tableValidationError ?? tablesError}
            onChange={handleChange}
            placeholder="my-table"
            list="cbtSinkTableOptions"
            datalist={tables}
            loading={tablesLoading}
            helperText={
              <span>
                Values auto-populated from{' '}
                <code className="text-slate-300 bg-slate-800/60 px-1 py-0.5 rounded">gcloud bigtable instances tables list</code>
              </span>
            }
          />
        )}
      </div>

      {/* Group 3: Write Tuning */}
      <div className="flex flex-col gap-3 p-3 bg-slate-800/40 rounded border border-slate-700/50">
        <span className="text-xs font-bold uppercase text-slate-400">Write Tuning</span>

        <label htmlFor="cbtSinkBulkMutationFlowControl" className="flex items-center gap-2 cursor-pointer">
          <input
            id="cbtSinkBulkMutationFlowControl"
            type="checkbox"
            name="bulkMutationFlowControl"
            checked={bulkMutationFlowControl}
            onChange={handleChange}
            className="w-4 h-4 rounded border-slate-700 text-blue-600 focus:ring-0 focus:ring-offset-0 bg-[#252836]"
          />
          <span className="text-sm font-medium text-slate-300">Enable Bulk Mutation Flow Control</span>
          <InfoTooltip text="Rate-limits writes based on current Bigtable load so large batch writes don't overload the cluster while still triggering autoscaling (google.bigtable.enable.bulk.mutation.flow.control = true, as in Google's Dataflow write sample)." />
        </label>
      </div>

      {/* Group 4: Advanced Connection Settings */}
      <div className="flex flex-col gap-3 p-3 bg-slate-800/40 rounded border border-slate-700/50">
        <div className="flex items-center text-xs font-bold uppercase text-slate-400">
          <span>Advanced Connection Settings</span>
          <InfoTooltip text="Extra BigtableOptionsFactory settings passed with withConfiguration(key, value), e.g. google.bigtable.bulk.max.row.key.count = 100. Credential keys (google.bigtable.auth.*) are not allowed here." />
        </div>

        <datalist id="cbtSnkConfigKeyOptions">
          {CLOUD_BIGTABLE_SINK_CONFIG_KEY_OPTIONS.map((keyOption) => (
            <option key={keyOption} value={keyOption} />
          ))}
        </datalist>

        {configuration.map((entry, idx) => {
          const rowError = validateConfigEntry(entry, idx, configuration);
          return (
            <div key={idx} className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <PropertyField
                  id={`cbtSnkConfigKey-${idx}`}
                  aria-label={`Configuration key ${idx + 1}`}
                  value={entry.key}
                  onChange={(e) => handleUpdateConfig(idx, 'key', e.target.value)}
                  placeholder="google.bigtable.bulk.max.row.key.count"
                  datalist={[...CLOUD_BIGTABLE_SINK_CONFIG_KEY_OPTIONS]}
                  containerClassName="flex-1"
                />
                <input
                  id={`cbtSnkConfigValue-${idx}`}
                  type="text"
                  aria-label={`Configuration value ${idx + 1}`}
                  value={entry.value}
                  onChange={(e) => handleUpdateConfig(idx, 'value', e.target.value)}
                  placeholder="100"
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

      <SystemInstructionsField
        id="cbtSinkSystemInstructions"
        value={systemInstructions}
        placeholder="Enter custom instructions for Cloud Bigtable (HBase) sink code generation..."
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
