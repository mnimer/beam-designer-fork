/**
 * CogniteDataFusion Sink Properties Component (IO69)
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Renders the property configuration panel for Cognite Data Fusion (CDF) Sink nodes
 * in Apache Beam Java pipelines (`com.cognite:beam-connector-java`, `CogniteIO.write*()`,
 * `CogniteIO.writeDirect*()`, `CogniteIO.delete*()`, `CogniteIO.writeAssetsMultipleHierarchies()`,
 * and `CogniteIO.synchronizeHierarchies()`).
 *
 * Architectural Decisions:
 * - Supports both OpenID Connect client-credentials authentication (`authType: 'clientCredentials'`)
 *   and legacy API key authentication (`authType: 'apiKey'`), enforcing mutual exclusion on mode switch.
 * - Credentials (`clientSecretSecret`, `apiKeySecret`) are selected exclusively via GCP Secret Manager
 *   pickers (`SecretManagerSecretField`) and resolved natively on workers via `GcpSecretConfig`.
 * - Non-credential OAuth token endpoint uses `authServerUrl` (never `tokenUrl`) to avoid false-positive
 *   credential redaction.
 * - Optional `secretProject` uses `useAssetLoader('projects')` with the PubSubIO datalist pattern.
 * - Omitted upstream options:
 *   - `withProjectConfigFile`: omitted under R3/D4 because the TOML file embeds plaintext `client_secret`/`api_key`.
 *   - `ProjectConfig.withApiKey(String)` / `withClientSecret(String)`: omitted under R3 (replaced by `GcpSecretConfig`).
 *   - `SequenceRows.Write.withWorkerParallelizationFactor`: undocumented upstream option.
 */

import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { InfoTooltip } from '../../components/InfoTooltip';
import { PropertyField } from '../../components/common/PropertyField';
import { SecretManagerSecretField } from '../../components/common/SecretManagerSecretField';
import type { SecretItem } from '../../components/common/SecretManagerAuthFields';
import { useAssetLoader } from '../../hooks/useAssetLoader';

export const CDF_DOCS_URL = 'https://github.com/cognitedata/cdf-beam-connector-java';

export type SinkWriteOperation =
  | 'upsert'
  | 'delete'
  | 'writeMultipleHierarchies'
  | 'synchronizeHierarchies';

export interface SinkResourceMeta {
  value: string;
  label: string;
  upsertInputType: string;
  deleteInputType?: string;
  supportsDirect: boolean;
  operations: ReadonlyArray<SinkWriteOperation>;
}

const SINK_RESOURCES: ReadonlyArray<SinkResourceMeta> = [
  {
    value: 'assets',
    label: 'Assets',
    upsertInputType: 'Asset',
    deleteInputType: 'Item',
    supportsDirect: false,
    operations: ['upsert', 'delete', 'writeMultipleHierarchies', 'synchronizeHierarchies'],
  },
  {
    value: 'events',
    label: 'Events',
    upsertInputType: 'Event',
    deleteInputType: 'Item',
    supportsDirect: true,
    operations: ['upsert', 'delete'],
  },
  {
    value: 'files',
    label: 'Files (metadata + binary)',
    upsertInputType: 'FileContainer',
    deleteInputType: 'Item',
    supportsDirect: true,
    operations: ['upsert', 'delete'],
  },
  {
    value: 'filesMetadata',
    label: 'Files (metadata only)',
    upsertInputType: 'FileMetadata',
    supportsDirect: true,
    operations: ['upsert'],
  },
  {
    value: 'timeseriesMetadata',
    label: 'Time series (headers)',
    upsertInputType: 'TimeseriesMetadata',
    deleteInputType: 'Item',
    supportsDirect: false,
    operations: ['upsert', 'delete'],
  },
  {
    value: 'timeseriesPoints',
    label: 'Time series data points',
    upsertInputType: 'TimeseriesPointPost',
    supportsDirect: true,
    operations: ['upsert'],
  },
  {
    value: 'sequencesMetadata',
    label: 'Sequences (headers)',
    upsertInputType: 'SequenceMetadata',
    deleteInputType: 'Item',
    supportsDirect: false,
    operations: ['upsert', 'delete'],
  },
  {
    value: 'sequenceRows',
    label: 'Sequence rows',
    upsertInputType: 'SequenceBody',
    deleteInputType: 'SequenceBody',
    supportsDirect: false,
    operations: ['upsert', 'delete'],
  },
  {
    value: 'rawRows',
    label: 'Raw rows',
    upsertInputType: 'RawRow',
    deleteInputType: 'RawRow',
    supportsDirect: true,
    operations: ['upsert', 'delete'],
  },
  {
    value: 'dataSets',
    label: 'Data sets',
    upsertInputType: 'DataSet',
    supportsDirect: false,
    operations: ['upsert'],
  },
  {
    value: 'relationships',
    label: 'Relationships',
    upsertInputType: 'Relationship',
    deleteInputType: 'Item',
    supportsDirect: false,
    operations: ['upsert', 'delete'],
  },
  {
    value: 'labels',
    label: 'Labels',
    upsertInputType: 'Label',
    deleteInputType: 'Item',
    supportsDirect: false,
    operations: ['upsert', 'delete'],
  },
];

const WRITE_OPERATION_LABELS: Readonly<Record<SinkWriteOperation, string>> = {
  upsert: 'Upsert (write)',
  delete: 'Delete',
  writeMultipleHierarchies: 'Write multiple asset hierarchies',
  synchronizeHierarchies: 'Synchronize asset hierarchies (adds/updates/removes)',
};

const TS_UPDATE_FREQUENCIES: ReadonlyArray<string> = [
  'DAY',
  'HOUR',
  'MINUTE',
  'SECOND',
  'HZ_10',
  'HZ_100',
  'HZ_1000',
];

/**
 * Parses an ISO-8601 duration subset (`PnDTnHnMn.nS`) into milliseconds.
 * Returns null if the string is not a valid duration or has no components.
 */
function parseIsoDurationMs(input: string): number | null {
  const trimmed = input.trim();
  const match = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d{1,9})?)S)?)?$/i.exec(trimmed);
  if (!match) {
    return null;
  }
  const [, days, hours, minutes, seconds] = match;
  if (days === undefined && hours === undefined && minutes === undefined && seconds === undefined) {
    return null;
  }
  const dMs = days ? Number(days) * 86_400_000 : 0;
  const hMs = hours ? Number(hours) * 3_600_000 : 0;
  const mMs = minutes ? Number(minutes) * 60_000 : 0;
  const sMs = seconds ? Number(seconds) * 1_000 : 0;
  return dMs + hMs + mMs + sMs;
}

function isIntegerInRange(val: string, min: number, max: number): boolean {
  if (!/^-?\d+$/.test(val.trim())) {
    return false;
  }
  const n = Number(val.trim());
  return n >= min && n <= max;
}

interface VsCodeApi {
  postMessage: (message: Record<string, unknown>) => void;
}

export interface CogniteDataFusionSinkPropertiesProps {
  node: {
    data: {
      properties?: Record<string, unknown>;
      system_instructions?: string;
      special_instructions?: string;
    };
  };
  onChange: (properties: Record<string, unknown>) => void;
}

export const CogniteDataFusionSinkProperties: React.FC<CogniteDataFusionSinkPropertiesProps> = ({
  node,
  onChange,
}) => {
  const properties = node.data.properties || {};

  const { items: secrets, loading: secretsLoading, error: secretsError } = useAssetLoader<SecretItem | string>('secrets');
  const { items: gcpProjects, loading: gcpProjectsLoading, error: gcpProjectsError } = useAssetLoader<string>('projects');

  const [isWriterConfigOpen, setIsWriterConfigOpen] = useState(false);
  const [isHintsOpen, setIsHintsOpen] = useState(false);

  // Extracted values (never persisted on mount)
  const project = String(properties.project ?? '');
  const baseUrl = String(properties.baseUrl ?? '');
  const authType = String(properties.authType ?? 'clientCredentials');
  const clientId = String(properties.clientId ?? '');
  const clientSecretSecret = String(properties.clientSecretSecret ?? '');
  const azureTenantId = String(properties.azureTenantId ?? '');
  const authServerUrl = String(properties.authServerUrl ?? '');
  const authScopes = String(properties.authScopes ?? '');
  const apiKeySecret = String(properties.apiKeySecret ?? '');
  const secretProject = String(properties.secretProject ?? '');
  const secretVersion = String(properties.secretVersion ?? '');

  const resourceType = String(properties.resourceType ?? '');
  const writeOperation = String(properties.writeOperation ?? 'upsert') as SinkWriteOperation;
  const directWrite = Boolean(properties.directWrite);
  const upsertMode = String(properties.upsertMode ?? 'UPDATE');
  const deleteTempFile = properties.deleteTempFile !== false;

  const extractionPipelineExtId = String(properties.extractionPipelineExtId ?? '');
  const extractionPipelineRunStatus = String(properties.extractionPipelineRunStatus ?? 'SUCCESS');
  const appIdentifier = String(properties.appIdentifier ?? '');
  const sessionIdentifier = String(properties.sessionIdentifier ?? '');
  const enableMetrics = Boolean(properties.enableMetrics);

  const writeShards = String(properties.writeShards ?? '');
  const writeMaxBatchLatency = String(properties.writeMaxBatchLatency ?? '');
  const maxRetries = String(properties.maxRetries ?? '');
  const writeRawMaxBatchSize = String(properties.writeRawMaxBatchSize ?? '');
  const writeFileBatchSize = String(properties.writeFileBatchSize ?? '');
  const writeTsPointsUpdateFrequency = String(properties.writeTsPointsUpdateFrequency ?? 'SECOND');

  const systemInstructions = String(
    node.data.system_instructions ??
      node.data.special_instructions ??
      properties.system_instructions ??
      properties.special_instructions ??
      ''
  );

  const selectedResource = SINK_RESOURCES.find((r) => r.value === resourceType);
  const supportedOperations: ReadonlyArray<SinkWriteOperation> = selectedResource
    ? selectedResource.operations
    : ['upsert'];
  const effectiveOperation: SinkWriteOperation = supportedOperations.includes(writeOperation)
    ? writeOperation
    : 'upsert';

  // Compute input PCollection element type for helper text
  let inputTypeLabel = '';
  if (selectedResource) {
    if (effectiveOperation === 'delete') {
      inputTypeLabel = selectedResource.deleteInputType ?? 'Item';
    } else if (
      effectiveOperation === 'writeMultipleHierarchies' ||
      effectiveOperation === 'synchronizeHierarchies'
    ) {
      inputTypeLabel = 'KV<String, Asset>';
    } else if (directWrite && selectedResource.supportsDirect) {
      inputTypeLabel = `Iterable<${selectedResource.upsertInputType}>`;
    } else {
      inputTypeLabel = selectedResource.upsertInputType;
    }
  }

  // Validation
  const projectError = !project.trim() ? 'CDF project is required' : null;
  const baseUrlError =
    baseUrl.trim().length > 0 && !/^https?:\/\/\S+$/.test(baseUrl.trim())
      ? 'Must be an http(s) URL'
      : null;

  const clientIdError =
    authType !== 'apiKey' && !clientId.trim() ? 'Client ID is required' : null;
  const clientSecretError =
    authType !== 'apiKey' && !clientSecretSecret.trim()
      ? 'Select the Secret Manager secret holding the client secret'
      : null;
  const azureTenantIdError =
    authType !== 'apiKey' &&
    azureTenantId.trim().length > 0 &&
    !/^[A-Za-z0-9.-]+$/.test(azureTenantId.trim())
      ? 'Invalid tenant id'
      : null;
  const authServerUrlError =
    authType !== 'apiKey' &&
    (!authServerUrl.trim() || !/^https?:\/\/\S+$/.test(authServerUrl.trim()))
      ? 'Token URL is required (http(s) URL)'
      : null;
  const apiKeySecretError =
    authType === 'apiKey' && !apiKeySecret.trim()
      ? 'Select the Secret Manager secret holding the API key'
      : null;
  const secretVersionError =
    secretVersion.trim().length > 0 && !/^[A-Za-z0-9_-]+$/.test(secretVersion.trim())
      ? 'Invalid secret version'
      : null;

  const resourceTypeError = !resourceType ? 'Resource type is required' : null;

  const writeShardsError =
    writeShards.trim().length > 0 && !isIntegerInRange(writeShards, 1, 50)
      ? 'Write shards must be an integer between 1 and 50'
      : null;
  const latencyMs =
    writeMaxBatchLatency.trim().length > 0 ? parseIsoDurationMs(writeMaxBatchLatency) : null;
  const writeMaxBatchLatencyError =
    writeMaxBatchLatency.trim().length > 0 &&
    (latencyMs === null || latencyMs <= 10 || latencyMs >= 43_200_000)
      ? 'Must be > 10ms and < 12h, e.g. PT5S'
      : null;
  const maxRetriesError =
    maxRetries.trim().length > 0 && !isIntegerInRange(maxRetries, 1, 20)
      ? 'Max retries must be an integer between 1 and 20'
      : null;
  const writeRawMaxBatchSizeError =
    resourceType === 'rawRows' &&
    writeRawMaxBatchSize.trim().length > 0 &&
    !isIntegerInRange(writeRawMaxBatchSize, 1, 10000)
      ? 'Raw max batch size must be an integer between 1 and 10000'
      : null;
  const writeFileBatchSizeError =
    resourceType === 'files' &&
    writeFileBatchSize.trim().length > 0 &&
    !isIntegerInRange(writeFileBatchSize, 1, 10)
      ? 'File batch size must be an integer between 1 and 10'
      : null;

  const handleOpenDocs = () => {
    const vscode = (window as unknown as { vscode?: VsCodeApi }).vscode;
    if (vscode) {
      vscode.postMessage({ command: 'openExternal', url: CDF_DOCS_URL });
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    const isCheckbox = type === 'checkbox';
    const checked = isCheckbox ? (e.target as HTMLInputElement).checked : false;
    const next: Record<string, unknown> = { ...properties };

    if (name === 'deleteTempFile') {
      // Default is true upstream; only persist false when unchecked
      if (checked) {
        delete next.deleteTempFile;
      } else {
        next.deleteTempFile = false;
      }
    } else {
      const val = isCheckbox ? checked : value;
      if (val === '' || val === false) {
        delete next[name];
      } else {
        next[name] = val;
      }
    }

    if (name === 'authType') {
      if (value === 'apiKey') {
        delete next.clientId;
        delete next.clientSecretSecret;
        delete next.azureTenantId;
        delete next.authServerUrl;
        delete next.authScopes;
      } else {
        delete next.apiKeySecret;
      }
    } else if (name === 'azureTenantId') {
      const trimmed = value.trim();
      if (trimmed.length > 0 && /^[A-Za-z0-9.-]+$/.test(trimmed)) {
        next.authServerUrl = `https://login.microsoftonline.com/${trimmed}/oauth2/v2.0/token`;
      }
    } else if (name === 'resourceType') {
      const meta = SINK_RESOURCES.find((r) => r.value === value);
      const currentOp = String(next.writeOperation ?? 'upsert') as SinkWriteOperation;
      if (!meta || !meta.operations.includes(currentOp)) {
        delete next.writeOperation;
      }
      if (!meta?.supportsDirect) {
        delete next.directWrite;
      }
      if (value !== 'files') {
        delete next.deleteTempFile;
        delete next.writeFileBatchSize;
      }
      if (value !== 'rawRows') {
        delete next.writeRawMaxBatchSize;
      }
      if (value !== 'timeseriesPoints') {
        delete next.writeTsPointsUpdateFrequency;
      }
    } else if (name === 'writeOperation') {
      if (value === 'delete') {
        delete next.upsertMode;
        delete next.directWrite;
        delete next.deleteTempFile;
      } else if (value === 'writeMultipleHierarchies' || value === 'synchronizeHierarchies') {
        delete next.directWrite;
      }
    } else if (name === 'extractionPipelineExtId' && !value.trim()) {
      delete next.extractionPipelineExtId;
      delete next.extractionPipelineRunStatus;
    }

    onChange(next);
  };

  const handleInstructionsChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    onChange({
      ...properties,
      system_instructions: e.target.value,
    });
  };

  return (
    <div className="flex-1 flex flex-col gap-4">
      {/* Header Row with Documentation Link */}
      <div className="flex flex-col gap-1.5 p-2.5 rounded bg-slate-800/40 border border-slate-700/60 text-xs text-slate-300">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-slate-200">
            Cognite Data Fusion Sink
          </span>
          <button
            type="button"
            onClick={handleOpenDocs}
            className="text-blue-400 hover:text-blue-300 font-semibold cursor-pointer shrink-0"
          >
            Docs ↗
          </button>
        </div>
        <p className="text-slate-400">
          Upserts, synchronizes, or deletes industrial assets, events, time series points, files, and RAW rows in Cognite Data Fusion.
        </p>
      </div>

      {/* Connection Group */}
      <div className="flex flex-col gap-3 p-3 bg-slate-800/40 rounded border border-slate-700/50">
        <span className="text-xs font-bold uppercase text-slate-400">
          Connection
        </span>

        <PropertyField
          id="cdfSinkProject"
          name="project"
          label="CDF Project"
          required="CDF project is required"
          tooltip="Cognite Data Fusion project (tenant) name. Maps to ProjectConfig.withProject(String)."
          value={project}
          invalid={Boolean(projectError)}
          error={projectError}
          onChange={handleChange}
          placeholder="my-cdf-project"
        />

        <PropertyField
          id="cdfSinkBaseUrl"
          name="baseUrl"
          label="Base URL"
          tooltip="CDF cluster base URL (e.g. https://westeurope-1.cognitedata.com). Maps to ProjectConfig.withBaseUrl(String) (replaces withHost)."
          value={baseUrl}
          invalid={Boolean(baseUrlError)}
          error={baseUrlError}
          onChange={handleChange}
          placeholder="https://api.cognitedata.com"
        />
      </div>

      {/* Authentication Group */}
      <div className="flex flex-col gap-3 p-3 bg-slate-800/40 rounded border border-slate-700/50">
        <span className="text-xs font-bold uppercase text-slate-400">
          Authentication
        </span>

        <div className="flex flex-col gap-2">
          <label
            htmlFor="cdfSinkAuthType"
            className="flex items-center text-xs font-bold uppercase text-slate-500"
          >
            <span>Authentication</span>
            <InfoTooltip text="Cognite Data Fusion authentication mode: OpenID Connect client credentials (preferred for services) or API keys (legacy)." />
          </label>
          <select
            id="cdfSinkAuthType"
            name="authType"
            value={authType}
            onChange={handleChange}
            className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
          >
            <option value="clientCredentials">OpenID Connect (client credentials)</option>
            <option value="apiKey">API key (legacy)</option>
          </select>
        </div>

        {authType !== 'apiKey' ? (
          <>
            <PropertyField
              id="cdfSinkClientId"
              name="clientId"
              label="Client ID"
              required="Client ID is required"
              tooltip="Identity provider application registration client ID. Maps to ProjectConfig.withClientId(String). Not a secret."
              value={clientId}
              invalid={Boolean(clientIdError)}
              error={clientIdError}
              onChange={handleChange}
              placeholder="00000000-0000-0000-0000-000000000000"
            />

            <SecretManagerSecretField
              id="cdfSinkClientSecretSecret"
              name="clientSecretSecret"
              label="Client Secret (Secret Manager)"
              required="Select the Secret Manager secret holding the client secret"
              tooltip="Short ID of the GCP Secret Manager secret holding the OIDC client secret. Generated code uses ProjectConfig.withClientSecretFromGcpSecret(GcpSecretConfig.of(projectId, secretId))."
              value={clientSecretSecret}
              onChange={handleChange}
              secrets={secrets}
              loading={secretsLoading}
              error={clientSecretError || secretsError}
              invalid={Boolean(clientSecretError || secretsError)}
              placeholder="e.g. cdf-client-secret"
            />

            <PropertyField
              id="cdfSinkAzureTenantId"
              name="azureTenantId"
              label="Azure AD Tenant ID (helper)"
              tooltip="Optional helper that populates Token URL as https://login.microsoftonline.com/<tenant>/oauth2/v2.0/token (= TokenUrl.generateAzureAdURL(tenant))."
              value={azureTenantId}
              invalid={Boolean(azureTenantIdError)}
              error={azureTenantIdError}
              onChange={handleChange}
              placeholder="contoso.onmicrosoft.com"
            />

            <PropertyField
              id="cdfSinkAuthServerUrl"
              name="authServerUrl"
              label="Token URL (OAuth 2.0 token endpoint)"
              required="Token URL is required"
              tooltip="OAuth 2.0 token endpoint URL. Maps to ProjectConfig.withTokenUrl(String). Stored as authServerUrl so it is not redacted as a secret."
              value={authServerUrl}
              invalid={Boolean(authServerUrlError)}
              error={authServerUrlError}
              onChange={handleChange}
              placeholder="https://login.microsoftonline.com/<tenant>/oauth2/v2.0/token"
            />

            <PropertyField
              id="cdfSinkAuthScopes"
              name="authScopes"
              label="Auth Scopes"
              tooltip="Optional custom OAuth2 scopes, comma-separated. Maps to ProjectConfig.withAuthScopes(String...)."
              value={authScopes}
              onChange={handleChange}
              placeholder="https://api.cognitedata.com/.default"
            />
          </>
        ) : (
          <SecretManagerSecretField
            id="cdfSinkApiKeySecret"
            name="apiKeySecret"
            label="API Key (Secret Manager)"
            required="Select the Secret Manager secret holding the API key"
            tooltip="Short ID of the GCP Secret Manager secret holding the CDF API key. Maps to ProjectConfig.withApiKeyFromGcpSecret(GcpSecretConfig.of(projectId, secretId))."
            value={apiKeySecret}
            onChange={handleChange}
            secrets={secrets}
            loading={secretsLoading}
            error={apiKeySecretError || secretsError}
            invalid={Boolean(apiKeySecretError || secretsError)}
            placeholder="e.g. cdf-api-key"
          />
        )}

        <PropertyField
          id="cdfSinkSecretProject"
          name="secretProject"
          label="GCP Secret Project ID"
          tooltip="Optional GCP project ID hosting the Secret Manager secret. Maps to GcpSecretConfig.of(projectId, secretId) / GcpSecretConfig.withProjectId(String). Leave blank to use the pipeline GCP project."
          value={secretProject}
          invalid={Boolean(gcpProjectsError)}
          error={gcpProjectsError}
          onChange={handleChange}
          placeholder="my-gcp-project (blank = pipeline project)"
          list="cdf-sink-secret-project-options"
          datalist={gcpProjects}
          loading={gcpProjectsLoading}
          helperText={
            <span>
              Values auto-populated from{' '}
              <code className="text-slate-300 bg-slate-800/60 px-1 py-0.5 rounded">
                gcloud projects list
              </code>
            </span>
          }
        />

        <PropertyField
          id="cdfSinkSecretVersion"
          name="secretVersion"
          label="Secret Version"
          tooltip="Secret Manager version for the selected secret. Maps to GcpSecretConfig.withSecretVersion(String). Default is latest."
          value={secretVersion}
          invalid={Boolean(secretVersionError)}
          error={secretVersionError}
          onChange={handleChange}
          placeholder="latest"
        />
      </div>

      {/* Resource Group */}
      <div className="flex flex-col gap-3 p-3 bg-slate-800/40 rounded border border-slate-700/50">
        <span className="text-xs font-bold uppercase text-slate-400">
          Resource
        </span>

        <div className="flex flex-col gap-2">
          <label
            htmlFor="cdfSinkResourceType"
            className="flex items-center text-xs font-bold uppercase text-slate-500"
          >
            <span>Resource Type</span>
            <span className="text-red-400 ml-1 font-bold" title="Resource type is required">
              *
            </span>
            <InfoTooltip text="CDF resource type to write. Maps to CogniteIO.write<Type>() / delete<Type>()." />
          </label>
          <select
            id="cdfSinkResourceType"
            name="resourceType"
            aria-required="true"
            aria-invalid={Boolean(resourceTypeError)}
            value={resourceType}
            onChange={handleChange}
            className={`bg-[#252836] text-white p-2 rounded border text-sm focus:outline-none ${
              resourceTypeError
                ? 'border-red-500/80 focus:border-red-500'
                : 'border-slate-700 focus:border-blue-500'
            }`}
          >
            <option value="">Select a resource type…</option>
            {SINK_RESOURCES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          {resourceTypeError && (
            <span className="text-xs text-red-400 mt-1" role="alert">
              {resourceTypeError}
            </span>
          )}
          {selectedResource && (
            <span className="text-xs text-slate-400">
              Input:{' '}
              <code className="text-slate-300 bg-slate-800/60 px-1 py-0.5 rounded">
                {`PCollection<${inputTypeLabel}>`}
              </code>
            </span>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <label
            htmlFor="cdfSinkWriteOperation"
            className="flex items-center text-xs font-bold uppercase text-slate-500"
          >
            <span>Operation</span>
            <InfoTooltip text="write* creates or updates (upsert, batching automatic); delete* removes objects by externalId/id; asset hierarchy modes write or synchronize asset trees." />
          </label>
          <select
            id="cdfSinkWriteOperation"
            name="writeOperation"
            value={effectiveOperation}
            onChange={handleChange}
            className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
          >
            {supportedOperations.map((op) => (
              <option key={op} value={op}>
                {WRITE_OPERATION_LABELS[op]}
              </option>
            ))}
          </select>
        </div>

        {selectedResource?.supportsDirect && effectiveOperation === 'upsert' && (
          <div className="flex items-center gap-2">
            <input
              id="cdfSinkDirectWrite"
              type="checkbox"
              name="directWrite"
              checked={directWrite}
              onChange={handleChange}
              className="rounded border-slate-700 accent-blue-500"
            />
            <label
              htmlFor="cdfSinkDirectWrite"
              className="flex items-center text-xs text-slate-300 cursor-pointer"
            >
              <span>Input is pre-batched (WriteDirect)</span>
              <InfoTooltip text="CogniteIO.writeDirect<Type>(): expects pre-batched input PCollection<Iterable<T>>." />
            </label>
          </div>
        )}

        {effectiveOperation !== 'delete' && (
          <div className="flex flex-col gap-2">
            <label
              htmlFor="cdfSinkUpsertMode"
              className="flex items-center text-xs font-bold uppercase text-slate-500"
            >
              <span>Upsert Mode</span>
              <InfoTooltip text="UPDATE updates only the provided fields; REPLACE replaces the entire object (id/externalId unchanged). Maps to WriterConfig.withUpsertMode(UpsertMode)." />
            </label>
            <select
              id="cdfSinkUpsertMode"
              name="upsertMode"
              value={upsertMode}
              onChange={handleChange}
              className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
            >
              <option value="UPDATE">Update (only provided fields)</option>
              <option value="REPLACE">Replace (entire object)</option>
            </select>
          </div>
        )}

        {resourceType === 'files' && effectiveOperation === 'upsert' && (
          <div className="flex items-center gap-2">
            <input
              id="cdfSinkDeleteTempFile"
              type="checkbox"
              name="deleteTempFile"
              checked={deleteTempFile}
              onChange={handleChange}
              className="rounded border-slate-700 accent-blue-500"
            />
            <label
              htmlFor="cdfSinkDeleteTempFile"
              className="flex items-center text-xs text-slate-300 cursor-pointer"
            >
              <span>Delete temp file after upload</span>
              <InfoTooltip text="Remove the temporary blob after a successful file-binary upload (default true). Maps to Files.Write.enableDeleteTempFile(boolean)." />
            </label>
          </div>
        )}
      </div>

      {/* Writer Config Group (Collapsible, default closed) */}
      <div className="border border-slate-700/50 rounded bg-slate-800/40 overflow-hidden">
        <button
          type="button"
          data-testid="cdf-sink-group-writer"
          aria-expanded={isWriterConfigOpen}
          onClick={() => setIsWriterConfigOpen(!isWriterConfigOpen)}
          className="w-full flex items-center justify-between p-3 text-xs font-bold uppercase text-slate-400 hover:bg-slate-800/60 transition-colors cursor-pointer"
        >
          <span>Writer Config</span>
          {isWriterConfigOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>

        {isWriterConfigOpen && (
          <div className="p-3 flex flex-col gap-3 border-t border-slate-700/50">
            <PropertyField
              id="cdfSinkExtractionPipelineExtId"
              name="extractionPipelineExtId"
              label="Extraction Pipeline External ID"
              tooltip="Report extraction pipeline runs to CDF at the completion of each window. Maps to WriterConfig.withExtractionPipeline(String)."
              value={extractionPipelineExtId}
              onChange={handleChange}
              placeholder="ep-cdf-events-curation"
            />

            <div className="flex flex-col gap-2">
              <label
                htmlFor="cdfSinkExtractionPipelineRunStatus"
                className="flex items-center text-xs font-bold uppercase text-slate-500"
              >
                <span>Run Status</span>
                <InfoTooltip text="Extraction pipeline run status reported on completion: SUCCESS suits batch; SEEN suits streaming. Maps to WriterConfig.withExtractionPipeline(extId, status)." />
              </label>
              <select
                id="cdfSinkExtractionPipelineRunStatus"
                name="extractionPipelineRunStatus"
                value={extractionPipelineRunStatus}
                disabled={!extractionPipelineExtId.trim()}
                onChange={handleChange}
                className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500 disabled:opacity-50"
              >
                <option value="SUCCESS">SUCCESS</option>
                <option value="SEEN">SEEN</option>
              </select>
            </div>

            <PropertyField
              id="cdfSinkAppIdentifier"
              name="appIdentifier"
              label="App Identifier"
              tooltip="Application identifier encoded in API calls for tracing. Maps to WriterConfig.withAppIdentifier(String)."
              value={appIdentifier}
              onChange={handleChange}
              placeholder="cognite-beam-sdk"
            />

            <PropertyField
              id="cdfSinkSessionIdentifier"
              name="sessionIdentifier"
              label="Session Identifier"
              tooltip="Session identifier encoded in API calls. Maps to WriterConfig.withSessionIdentifier(String)."
              value={sessionIdentifier}
              onChange={handleChange}
              placeholder="cognite-beam-sdk"
            />

            <div className="flex items-center gap-2">
              <input
                id="cdfSinkEnableMetrics"
                type="checkbox"
                name="enableMetrics"
                checked={enableMetrics}
                onChange={handleChange}
                className="rounded border-slate-700 accent-blue-500"
              />
              <label
                htmlFor="cdfSinkEnableMetrics"
                className="flex items-center text-xs text-slate-300 cursor-pointer"
              >
                <span>Enable metrics</span>
                <InfoTooltip text="Report Cognite API latency and batch size metrics. Maps to WriterConfig.enableMetrics(boolean)." />
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Hints Group (Collapsible, default closed) */}
      <div className="border border-slate-700/50 rounded bg-slate-800/40 overflow-hidden">
        <button
          type="button"
          data-testid="cdf-sink-group-hints"
          aria-expanded={isHintsOpen}
          onClick={() => setIsHintsOpen(!isHintsOpen)}
          className="w-full flex items-center justify-between p-3 text-xs font-bold uppercase text-slate-400 hover:bg-slate-800/60 transition-colors cursor-pointer"
        >
          <span className="flex items-center">
            <span>Hints</span>
            <InfoTooltip text="Hints are optional and intended for advanced users; the defaults suit most scenarios." />
          </span>
          {isHintsOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>

        {isHintsOpen && (
          <div className="p-3 flex flex-col gap-3 border-t border-slate-700/50">
            <PropertyField
              id="cdfSinkWriteShards"
              name="writeShards"
              label="Write Shards"
              type="number"
              min={1}
              max={50}
              tooltip="Number of shards for the write stream (1-50, default 10). Maps to Hints.withWriteShards(int)."
              value={writeShards}
              invalid={Boolean(writeShardsError)}
              error={writeShardsError}
              onChange={handleChange}
              placeholder="10"
            />

            <PropertyField
              id="cdfSinkWriteMaxBatchLatency"
              name="writeMaxBatchLatency"
              label="Max Batch Latency"
              tooltip="Maximum duration the batcher waits before writing a batch (strictly > 10ms and < 12h, default PT5S). Maps to Hints.withWriteMaxBatchLatency(Duration)."
              value={writeMaxBatchLatency}
              invalid={Boolean(writeMaxBatchLatencyError)}
              error={writeMaxBatchLatencyError}
              onChange={handleChange}
              placeholder="PT5S"
            />

            <PropertyField
              id="cdfSinkMaxRetries"
              name="maxRetries"
              label="Max Retries"
              type="number"
              min={1}
              max={20}
              tooltip="Maximum retries for low-level Cognite API operations (1-20, default 3). Maps to Hints.withRetries(int)."
              value={maxRetries}
              invalid={Boolean(maxRetriesError)}
              error={maxRetriesError}
              onChange={handleChange}
              placeholder="3"
            />

            {resourceType === 'rawRows' && (
              <PropertyField
                id="cdfSinkWriteRawMaxBatchSize"
                name="writeRawMaxBatchSize"
                label="Raw Max Batch Size"
                type="number"
                min={1}
                max={10000}
                tooltip="Maximum batch size when writing Raw rows (1-10000, default 2000). Maps to Hints.withWriteRawMaxBatchSize(int)."
                value={writeRawMaxBatchSize}
                invalid={Boolean(writeRawMaxBatchSizeError)}
                error={writeRawMaxBatchSizeError}
                onChange={handleChange}
                placeholder="2000"
              />
            )}

            {resourceType === 'files' && (
              <PropertyField
                id="cdfSinkWriteFileBatchSize"
                name="writeFileBatchSize"
                label="File Batch Size"
                type="number"
                min={1}
                max={10}
                tooltip="Maximum batch size when writing files (1-10, default 8). Maps to Hints.withWriteFileBatchSize(int)."
                value={writeFileBatchSize}
                invalid={Boolean(writeFileBatchSizeError)}
                error={writeFileBatchSizeError}
                onChange={handleChange}
                placeholder="8"
              />
            )}

            {resourceType === 'timeseriesPoints' && (
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="cdfSinkWriteTsPointsUpdateFrequency"
                  className="flex items-center text-xs font-bold uppercase text-slate-500"
                >
                  <span>TS Points Update Frequency</span>
                  <InfoTooltip text="Average data-point update frequency used to optimize the batch writer. Maps to Hints.withWriteTsPointsUpdateFrequency(UpdateFrequency)." />
                </label>
                <select
                  id="cdfSinkWriteTsPointsUpdateFrequency"
                  name="writeTsPointsUpdateFrequency"
                  value={writeTsPointsUpdateFrequency}
                  onChange={handleChange}
                  className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
                >
                  {TS_UPDATE_FREQUENCIES.map((freq) => (
                    <option key={freq} value={freq}>
                      {freq}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Flexible Spacer */}
      <div className="flex-1 min-h-4" />

      {/* Code Generation Instructions */}
      <div className="flex flex-col gap-2 pt-2 border-t border-slate-700/60">
        <PropertyField
          id="cdfSinkSystemInstructions"
          name="system_instructions"
          label="Code Generation Instructions"
          type="textarea"
          rows={3}
          mono={false}
          value={systemInstructions}
          onChange={handleInstructionsChange}
          placeholder="Enter custom instructions for Cognite Data Fusion sink code generation..."
        />
      </div>
    </div>
  );
};
