/**
 * CogniteDataFusion Source Properties Component (IO69)
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Renders the property configuration panel for Cognite Data Fusion (CDF) Source nodes
 * in Apache Beam Java pipelines (`com.cognite:beam-connector-java`, `CogniteIO.read*()`
 * and `CogniteIO.readAggregates*()`).
 *
 * Architectural Decisions:
 * - Supports both OpenID Connect client-credentials authentication (`authType: 'clientCredentials'`)
 *   and legacy API key authentication (`authType: 'apiKey'`), enforcing mutual exclusion on mode switch.
 * - Credentials (`clientSecretSecret`, `apiKeySecret`) are selected exclusively via GCP Secret Manager
 *   pickers (`SecretManagerSecretField`) and resolved natively on workers via `GcpSecretConfig`.
 * - Non-credential OAuth token endpoint uses `authServerUrl` (never `tokenUrl`) to avoid false-positive
 *   credential redaction.
 * - Optional `secretProject` uses `useAssetLoader('projects')` with the PubSubIO datalist pattern.
 * - Time-series data points item-ID check renders a non-blocking warning banner per M2 milestone decisions.
 * - Omitted upstream options:
 *   - `withProjectConfigFile`: omitted under R3/D4 because the TOML file embeds plaintext `client_secret`/`api_key`.
 *   - `ProjectConfig.withApiKey(String)` / `withClientSecret(String)`: omitted under R3 (replaced by `GcpSecretConfig`).
 *   - `readAll*` / `readAllDirect*`: take input `PCollection<RequestParameters>`, whereas Source nodes start from `PBegin`.
 *   - `Hints.withReadShards`: `@Deprecated` upstream in favor of `withReadShardsPerWorker`.
 */

import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { InfoTooltip } from '../../components/InfoTooltip';
import { PropertyField } from '../../components/common/PropertyField';
import { SecretManagerSecretField } from '../../components/common/SecretManagerSecretField';
import type { SecretItem } from '../../components/common/SecretManagerAuthFields';
import { useAssetLoader } from '../../hooks/useAssetLoader';

export const CDF_DOCS_URL = 'https://github.com/cognitedata/cdf-beam-connector-java';

export interface SourceResourceMeta {
  value: string;
  label: string;
  outputType: string;
  supportsAggregate: boolean;
  supportsRequestParams: boolean;
  supportsStreaming: boolean;
}

const SOURCE_RESOURCES: ReadonlyArray<SourceResourceMeta> = [
  { value: 'assets', label: 'Assets', outputType: 'Asset', supportsAggregate: true, supportsRequestParams: true, supportsStreaming: true },
  { value: 'events', label: 'Events', outputType: 'Event', supportsAggregate: true, supportsRequestParams: true, supportsStreaming: true },
  { value: 'files', label: 'Files (metadata + binary)', outputType: 'FileContainer', supportsAggregate: true, supportsRequestParams: true, supportsStreaming: true },
  { value: 'filesMetadata', label: 'Files (metadata only)', outputType: 'FileMetadata', supportsAggregate: false, supportsRequestParams: true, supportsStreaming: true },
  { value: 'timeseriesMetadata', label: 'Time series (headers)', outputType: 'TimeseriesMetadata', supportsAggregate: true, supportsRequestParams: true, supportsStreaming: true },
  { value: 'timeseriesPoints', label: 'Time series data points', outputType: 'TimeseriesPoint', supportsAggregate: false, supportsRequestParams: true, supportsStreaming: true },
  { value: 'sequencesMetadata', label: 'Sequences (headers)', outputType: 'SequenceMetadata', supportsAggregate: true, supportsRequestParams: true, supportsStreaming: false },
  { value: 'sequenceRows', label: 'Sequence rows', outputType: 'SequenceBody', supportsAggregate: false, supportsRequestParams: true, supportsStreaming: false },
  { value: 'rawDatabases', label: 'Raw databases', outputType: 'String', supportsAggregate: false, supportsRequestParams: false, supportsStreaming: false },
  { value: 'rawTables', label: 'Raw tables', outputType: 'RawTable', supportsAggregate: false, supportsRequestParams: false, supportsStreaming: false },
  { value: 'rawRows', label: 'Raw rows', outputType: 'RawRow', supportsAggregate: false, supportsRequestParams: true, supportsStreaming: true },
  { value: 'dataSets', label: 'Data sets', outputType: 'DataSet', supportsAggregate: false, supportsRequestParams: true, supportsStreaming: false },
  { value: 'relationships', label: 'Relationships', outputType: 'Relationship', supportsAggregate: false, supportsRequestParams: true, supportsStreaming: false },
  { value: 'labels', label: 'Labels', outputType: 'Label', supportsAggregate: false, supportsRequestParams: true, supportsStreaming: false },
];

const REQUEST_PARAM_KEYS = [
  'filterParameters',
  'metadataFilterParameters',
  'rootParameters',
  'itemExternalIds',
  'itemInternalIds',
  'requestJson',
] as const;

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

function isValidKeyValueLines(text: string): boolean {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  return lines.every((line) => /^\s*[^=\s][^=]*=.*$/.test(line));
}

function isValidInternalIdList(text: string): boolean {
  const tokens = text
    .split(/[,\r\n]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
  return tokens.every((t) => /^\d+$/.test(t));
}

function isPlainJsonObject(text: string): boolean {
  try {
    const parsed: unknown = JSON.parse(text);
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed);
  } catch {
    return false;
  }
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

export interface CogniteDataFusionSourcePropertiesProps {
  node: {
    data: {
      properties?: Record<string, unknown>;
      system_instructions?: string;
      special_instructions?: string;
    };
  };
  onChange: (properties: Record<string, unknown>) => void;
}

export const CogniteDataFusionSourceProperties: React.FC<CogniteDataFusionSourcePropertiesProps> = ({
  node,
  onChange,
}) => {
  const properties = node.data.properties || {};

  const { items: secrets, loading: secretsLoading, error: secretsError } = useAssetLoader<SecretItem | string>('secrets');
  const { items: gcpProjects, loading: gcpProjectsLoading, error: gcpProjectsError } = useAssetLoader<string>('projects');

  const [isRequestOpen, setIsRequestOpen] = useState(true);
  const [isReaderConfigOpen, setIsReaderConfigOpen] = useState(false);
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
  const readMode = String(properties.readMode ?? 'items');
  const rawDbName = String(properties.rawDbName ?? '');
  const rawTableName = String(properties.rawTableName ?? '');

  const filterParameters = String(properties.filterParameters ?? '');
  const metadataFilterParameters = String(properties.metadataFilterParameters ?? '');
  const rootParameters = String(properties.rootParameters ?? '');
  const itemExternalIds = String(properties.itemExternalIds ?? '');
  const itemInternalIds = String(properties.itemInternalIds ?? '');
  const requestJson = String(properties.requestJson ?? '');

  const tempStorageUri = String(properties.tempStorageUri ?? '');
  const forceTempStorage = Boolean(properties.forceTempStorage);

  const appIdentifier = String(properties.appIdentifier ?? '');
  const sessionIdentifier = String(properties.sessionIdentifier ?? '');
  const enableMetrics = Boolean(properties.enableMetrics);
  const deltaReadTable = String(properties.deltaReadTable ?? '');
  const deltaIdentifier = String(properties.deltaIdentifier ?? '');
  const deltaOffset = String(properties.deltaOffset ?? '');
  const fullReadOverride = Boolean(properties.fullReadOverride);
  const watchForNewItems = Boolean(properties.watchForNewItems);
  const pollInterval = String(properties.pollInterval ?? '');
  const pollOffset = String(properties.pollOffset ?? '');
  const readFirstNResults = String(properties.readFirstNResults ?? '');

  const readShardsPerWorker = String(properties.readShardsPerWorker ?? '');
  const maxRetries = String(properties.maxRetries ?? '');
  const readFileBinaryBatchSize = String(properties.readFileBinaryBatchSize ?? '');

  const systemInstructions = String(
    node.data.system_instructions ??
      node.data.special_instructions ??
      properties.system_instructions ??
      properties.special_instructions ??
      ''
  );

  const selectedResource = SOURCE_RESOURCES.find((r) => r.value === resourceType);
  const effectiveReadMode = selectedResource?.supportsAggregate ? readMode : 'items';

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
  const rawDbNameError =
    (resourceType === 'rawTables' || resourceType === 'rawRows') && !rawDbName.trim()
      ? 'Raw database name is required'
      : null;
  const rawTableNameError =
    resourceType === 'rawRows' && !rawTableName.trim() ? 'Raw table name is required' : null;

  const tempStorageUriError =
    resourceType === 'files' &&
    tempStorageUri.trim().length > 0 &&
    !/^(gs|s3|file):\/\/\S+$/.test(tempStorageUri.trim())
      ? 'Must be a gs://, s3:// or file:// URI'
      : null;
  const forceTempStorageError =
    resourceType === 'files' && forceTempStorage && !tempStorageUri.trim()
      ? 'Force temp storage requires a Temp Storage URI'
      : null;

  const filterParamsError =
    filterParameters.trim().length > 0 && !isValidKeyValueLines(filterParameters)
      ? 'Each line must be key=value'
      : null;
  const metadataFilterParamsError =
    metadataFilterParameters.trim().length > 0 && !isValidKeyValueLines(metadataFilterParameters)
      ? 'Each line must be key=value'
      : null;
  const rootParamsError =
    rootParameters.trim().length > 0 && !isValidKeyValueLines(rootParameters)
      ? 'Each line must be key=value'
      : null;
  const itemInternalIdsError =
    itemInternalIds.trim().length > 0 && !isValidInternalIdList(itemInternalIds)
      ? 'Internal IDs must be integers'
      : null;

  const hasOtherRequestParams =
    Boolean(filterParameters.trim()) ||
    Boolean(metadataFilterParameters.trim()) ||
    Boolean(rootParameters.trim()) ||
    Boolean(itemExternalIds.trim()) ||
    Boolean(itemInternalIds.trim());

  let requestJsonError: string | null = null;
  if (requestJson.trim().length > 0) {
    if (!isPlainJsonObject(requestJson.trim())) {
      requestJsonError = 'Request JSON must be a JSON object';
    } else if (hasOtherRequestParams) {
      requestJsonError = 'Request JSON replaces all other request parameters; clear one of them';
    }
  }

  // Per MILESTONE_DECISIONS.md: time-series item-ID rule is a WARNING, not a blocking error
  const showTimeseriesPointsWarning =
    resourceType === 'timeseriesPoints' &&
    !itemExternalIds.trim() &&
    !itemInternalIds.trim() &&
    !requestJson.trim();

  const deltaReadTableError =
    deltaReadTable.trim().length > 0 && !/^[^.\s]+\.[^.\s]+$/.test(deltaReadTable.trim())
      ? 'Must be <dbName.tableName>'
      : null;
  const deltaIdentifierError =
    deltaIdentifier.length >= 1000 ? 'Must be under 1000 characters' : null;
  const deltaOffsetError =
    deltaOffset.trim().length > 0 && parseIsoDurationMs(deltaOffset) === null
      ? 'Use an ISO-8601 duration, e.g. PT2H'
      : null;

  const pollIntervalMs = pollInterval.trim().length > 0 ? parseIsoDurationMs(pollInterval) : null;
  const pollIntervalError =
    pollInterval.trim().length > 0 && (pollIntervalMs === null || pollIntervalMs <= 0)
      ? 'Poll interval must be a positive ISO-8601 duration, e.g. PT10S'
      : null;
  const pollOffsetError =
    pollOffset.trim().length > 0 && parseIsoDurationMs(pollOffset) === null
      ? 'Use an ISO-8601 duration, e.g. PT30S'
      : null;
  const readFirstNResultsError =
    readFirstNResults.trim().length > 0 && !/^-?\d+$/.test(readFirstNResults.trim())
      ? 'Must be an integer'
      : null;

  const readShardsPerWorkerError =
    readShardsPerWorker.trim().length > 0 && !isIntegerInRange(readShardsPerWorker, 1, 10)
      ? 'Read shards per worker must be an integer between 1 and 10'
      : null;
  const maxRetriesError =
    maxRetries.trim().length > 0 && !isIntegerInRange(maxRetries, 1, 20)
      ? 'Max retries must be an integer between 1 and 20'
      : null;
  const readFileBinaryBatchSizeError =
    resourceType === 'files' &&
    readFileBinaryBatchSize.trim().length > 0 &&
    !isIntegerInRange(readFileBinaryBatchSize, 1, 10)
      ? 'File binary batch size must be an integer between 1 and 10'
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
    const val = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    const next: Record<string, unknown> = { ...properties };

    if (val === '' || val === false) {
      delete next[name];
    } else {
      next[name] = val;
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
      const meta = SOURCE_RESOURCES.find((r) => r.value === value);
      if (!meta?.supportsAggregate) {
        delete next.readMode;
      }
      if (value !== 'rawTables' && value !== 'rawRows') {
        delete next.rawDbName;
      }
      if (value !== 'rawRows') {
        delete next.rawTableName;
      }
      if (value !== 'files') {
        delete next.tempStorageUri;
        delete next.forceTempStorage;
        delete next.readFileBinaryBatchSize;
      }
      if (!meta?.supportsRequestParams) {
        for (const k of REQUEST_PARAM_KEYS) {
          delete next[k];
        }
      }
      if (!meta?.supportsStreaming) {
        delete next.watchForNewItems;
        delete next.pollInterval;
        delete next.pollOffset;
      }
    } else if (name === 'readMode' && value === 'aggregate') {
      delete next.watchForNewItems;
      delete next.pollInterval;
      delete next.pollOffset;
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

  const showRequestParams = !selectedResource || selectedResource.supportsRequestParams;

  return (
    <div className="flex-1 flex flex-col gap-4">
      {/* Header Row with Documentation Link */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase text-slate-400">
          Cognite Data Fusion Source
        </span>
        <button
          type="button"
          onClick={handleOpenDocs}
          className="text-xs text-blue-400 hover:text-blue-300 underline cursor-pointer"
        >
          Docs ↗
        </button>
      </div>

      {/* Connection Group */}
      <div className="flex flex-col gap-3 p-3 bg-slate-800/40 rounded border border-slate-700/50">
        <span className="text-xs font-bold uppercase text-slate-400">
          Connection
        </span>

        <PropertyField
          id="cdfSourceProject"
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
          id="cdfSourceBaseUrl"
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
            htmlFor="cdfSourceAuthType"
            className="flex items-center text-xs font-bold uppercase text-slate-500"
          >
            <span>Authentication</span>
            <InfoTooltip text="Cognite Data Fusion authentication mode: OpenID Connect client credentials (preferred for services) or API keys (legacy)." />
          </label>
          <select
            id="cdfSourceAuthType"
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
              id="cdfSourceClientId"
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
              id="cdfSourceClientSecretSecret"
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
              id="cdfSourceAzureTenantId"
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
              id="cdfSourceAuthServerUrl"
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
              id="cdfSourceAuthScopes"
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
            id="cdfSourceApiKeySecret"
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
          id="cdfSourceSecretProject"
          name="secretProject"
          label="GCP Secret Project ID"
          tooltip="Optional GCP project ID hosting the Secret Manager secret. Maps to GcpSecretConfig.of(projectId, secretId) / GcpSecretConfig.withProjectId(String). Leave blank to use the pipeline GCP project."
          value={secretProject}
          invalid={Boolean(gcpProjectsError)}
          error={gcpProjectsError}
          onChange={handleChange}
          placeholder="my-gcp-project (blank = pipeline project)"
          list="cdf-source-secret-project-options"
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
          id="cdfSourceSecretVersion"
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
            htmlFor="cdfSourceResourceType"
            className="flex items-center text-xs font-bold uppercase text-slate-500"
          >
            <span>Resource Type</span>
            <span className="text-red-400 ml-1 font-bold" title="Resource type is required">
              *
            </span>
            <InfoTooltip text="CDF resource type to read. Maps to CogniteIO.read<Type>()." />
          </label>
          <select
            id="cdfSourceResourceType"
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
            {SOURCE_RESOURCES.map((r) => (
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
              Output:{' '}
              <code className="text-slate-300 bg-slate-800/60 px-1 py-0.5 rounded">
                {`PCollection<${effectiveReadMode === 'aggregate' ? 'Aggregate' : selectedResource.outputType}>`}
              </code>
            </span>
          )}
        </div>

        {selectedResource?.supportsAggregate && (
          <div className="flex flex-col gap-2">
            <label
              htmlFor="cdfSourceReadMode"
              className="flex items-center text-xs font-bold uppercase text-slate-500"
            >
              <span>Read Mode</span>
              <InfoTooltip text="CogniteIO.read<Type>() reads individual items; CogniteIO.readAggregates<Type>() performs an aggregate count operation returning PCollection<Aggregate>." />
            </label>
            <select
              id="cdfSourceReadMode"
              name="readMode"
              value={readMode}
              onChange={handleChange}
              className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
            >
              <option value="items">Items (read)</option>
              <option value="aggregate">Aggregate (count)</option>
            </select>
          </div>
        )}

        {(resourceType === 'rawTables' || resourceType === 'rawRows') && (
          <PropertyField
            id="cdfSourceRawDbName"
            name="rawDbName"
            label="Raw Database"
            required="Raw database name is required"
            tooltip="CDF Raw database name. Maps to Raw.ReadTable.withDbName(String) / Raw.ReadRow.withDbName(String)."
            value={rawDbName}
            invalid={Boolean(rawDbNameError)}
            error={rawDbNameError}
            onChange={handleChange}
            placeholder="my-raw-db"
          />
        )}

        {resourceType === 'rawRows' && (
          <PropertyField
            id="cdfSourceRawTableName"
            name="rawTableName"
            label="Raw Table"
            required="Raw table name is required"
            tooltip="CDF Raw table name. Maps to Raw.ReadRow.withTableName(String)."
            value={rawTableName}
            invalid={Boolean(rawTableNameError)}
            error={rawTableNameError}
            onChange={handleChange}
            placeholder="my-raw-table"
          />
        )}

        {resourceType === 'files' && (
          <>
            <PropertyField
              id="cdfSourceTempStorageUri"
              name="tempStorageUri"
              label="Temp Storage URI"
              tooltip="Temporary storage location for streaming large file binaries (> 200MB). Maps to Files.Read.withTempStorageURI(ValueProvider<String>)."
              value={tempStorageUri}
              invalid={Boolean(tempStorageUriError)}
              error={tempStorageUriError}
              onChange={handleChange}
              placeholder="gs://my-bucket/cdf-temp/"
            />

            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <input
                  id="cdfSourceForceTempStorage"
                  type="checkbox"
                  name="forceTempStorage"
                  checked={forceTempStorage}
                  onChange={handleChange}
                  className="rounded border-slate-700 accent-blue-500"
                />
                <label
                  htmlFor="cdfSourceForceTempStorage"
                  className="flex items-center text-xs text-slate-300 cursor-pointer"
                >
                  <span>Always download to temp storage</span>
                  <InfoTooltip text="Force all file binaries to stream through temp storage. Maps to Files.Read.enableForceTempStorage(true)." />
                </label>
              </div>
              {forceTempStorageError && (
                <span className="text-xs text-red-400" role="alert">
                  {forceTempStorageError}
                </span>
              )}
            </div>
          </>
        )}
      </div>

      {/* Request Parameters Group (Collapsible, default open) */}
      {showRequestParams && (
        <div className="border border-slate-700/50 rounded bg-slate-800/40 overflow-hidden">
          <button
            type="button"
            data-testid="cdf-source-group-request"
            aria-expanded={isRequestOpen}
            onClick={() => setIsRequestOpen(!isRequestOpen)}
            className="w-full flex items-center justify-between p-3 text-xs font-bold uppercase text-slate-400 hover:bg-slate-800/60 transition-colors cursor-pointer"
          >
            <span>Request Parameters</span>
            {isRequestOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>

          {isRequestOpen && (
            <div className="p-3 flex flex-col gap-3 border-t border-slate-700/50">
              {showTimeseriesPointsWarning && (
                <div
                  role="status"
                  data-testid="cdf-source-timeseries-points-warning"
                  className="p-2 rounded bg-amber-500/10 border border-amber-500/30 text-xs text-amber-400"
                >
                  Warning: Time series data points normally require item IDs (Item External IDs, Item Internal IDs, or Request JSON).
                </div>
              )}

              <PropertyField
                id="cdfSourceFilterParameters"
                name="filterParameters"
                label="Filter Parameters"
                type="textarea"
                rows={2}
                tooltip="Entries added under the request filter node (one key=value per line). Maps to RequestParameters.withFilterParameter(key, value)."
                value={filterParameters}
                invalid={Boolean(filterParamsError)}
                error={filterParamsError}
                onChange={handleChange}
                placeholder="type=maintenance"
              />

              <PropertyField
                id="cdfSourceMetadataFilterParameters"
                name="metadataFilterParameters"
                label="Metadata Filters"
                type="textarea"
                rows={2}
                tooltip="Entries added under filter.metadata (one key=value per line). Maps to RequestParameters.withFilterMetadataParameter(key, value)."
                value={metadataFilterParameters}
                invalid={Boolean(metadataFilterParamsError)}
                error={metadataFilterParamsError}
                onChange={handleChange}
                placeholder="site=oslo"
              />

              <PropertyField
                id="cdfSourceRootParameters"
                name="rootParameters"
                label="Root Parameters"
                type="textarea"
                rows={2}
                tooltip="Top-level request parameters such as limit, start, end, aggregates, granularity (one key=value per line). Maps to RequestParameters.withRootParameter(key, value)."
                value={rootParameters}
                invalid={Boolean(rootParamsError)}
                error={rootParamsError}
                onChange={handleChange}
                placeholder="start=1609459200000"
              />

              <PropertyField
                id="cdfSourceItemExternalIds"
                name="itemExternalIds"
                label="Item External IDs"
                type="textarea"
                rows={2}
                tooltip="Comma- or newline-separated item externalIds to request. Maps to RequestParameters.withItemExternalIds(String...)."
                value={itemExternalIds}
                onChange={handleChange}
                placeholder="ts_ext_1, ts_ext_2"
              />

              <PropertyField
                id="cdfSourceItemInternalIds"
                name="itemInternalIds"
                label="Item Internal IDs"
                type="textarea"
                rows={2}
                tooltip="Comma- or newline-separated numeric item IDs to request. Maps to RequestParameters.withItemInternalIds(long...)."
                value={itemInternalIds}
                invalid={Boolean(itemInternalIdsError)}
                error={itemInternalIdsError}
                onChange={handleChange}
                placeholder="12345, 67890"
              />

              <PropertyField
                id="cdfSourceRequestJson"
                name="requestJson"
                label="Request JSON (advanced)"
                type="textarea"
                rows={4}
                tooltip="Complete JSON request body; overwrites any other request parameters. Maps to RequestParameters.withRequestJson(String)."
                value={requestJson}
                invalid={Boolean(requestJsonError)}
                error={requestJsonError}
                onChange={handleChange}
                placeholder='{"filter": {"name": "pump"}}'
              />
            </div>
          )}
        </div>
      )}

      {/* Reader Config Group (Collapsible, default closed) */}
      <div className="border border-slate-700/50 rounded bg-slate-800/40 overflow-hidden">
        <button
          type="button"
          data-testid="cdf-source-group-reader"
          aria-expanded={isReaderConfigOpen}
          onClick={() => setIsReaderConfigOpen(!isReaderConfigOpen)}
          className="w-full flex items-center justify-between p-3 text-xs font-bold uppercase text-slate-400 hover:bg-slate-800/60 transition-colors cursor-pointer"
        >
          <span>Reader Config</span>
          {isReaderConfigOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>

        {isReaderConfigOpen && (
          <div className="p-3 flex flex-col gap-3 border-t border-slate-700/50">
            <PropertyField
              id="cdfSourceAppIdentifier"
              name="appIdentifier"
              label="App Identifier"
              tooltip="Application identifier encoded in API calls for tracing. Maps to ReaderConfig.withAppIdentifier(String)."
              value={appIdentifier}
              onChange={handleChange}
              placeholder="cognite-beam-sdk"
            />

            <PropertyField
              id="cdfSourceSessionIdentifier"
              name="sessionIdentifier"
              label="Session Identifier"
              tooltip="Session identifier encoded in API calls. Maps to ReaderConfig.withSessionIdentifier(String)."
              value={sessionIdentifier}
              onChange={handleChange}
              placeholder="cognite-beam-sdk"
            />

            <div className="flex items-center gap-2">
              <input
                id="cdfSourceEnableMetrics"
                type="checkbox"
                name="enableMetrics"
                checked={enableMetrics}
                onChange={handleChange}
                className="rounded border-slate-700 accent-blue-500"
              />
              <label
                htmlFor="cdfSourceEnableMetrics"
                className="flex items-center text-xs text-slate-300 cursor-pointer"
              >
                <span>Enable metrics</span>
                <InfoTooltip text="Report Cognite API latency and batch size metrics. Maps to ReaderConfig.enableMetrics(boolean)." />
              </label>
            </div>

            <PropertyField
              id="cdfSourceDeltaReadTable"
              name="deltaReadTable"
              label="Delta Read State Table"
              tooltip="Enables timestamp-based delta read using the specified CDF Raw table (<dbName.tableName>). Maps to ReaderConfig.enableDeltaRead(String)."
              value={deltaReadTable}
              invalid={Boolean(deltaReadTableError)}
              error={deltaReadTableError}
              onChange={handleChange}
              placeholder="dbName.tableName"
            />

            <PropertyField
              id="cdfSourceDeltaIdentifier"
              name="deltaIdentifier"
              label="Delta Identifier"
              tooltip="Unique identifier for this reader when multiple readers share a delta table. Maps to ReaderConfig.withDeltaIdentifier(String)."
              value={deltaIdentifier}
              invalid={Boolean(deltaIdentifierError)}
              error={deltaIdentifierError}
              onChange={handleChange}
              placeholder="delta-timestamp-identifier"
            />

            <PropertyField
              id="cdfSourceDeltaOffset"
              name="deltaOffset"
              label="Delta Offset"
              tooltip="Grace window subtracted from the last delta timestamp (ISO-8601 duration). Maps to ReaderConfig.withDeltaOffset(Duration)."
              value={deltaOffset}
              invalid={Boolean(deltaOffsetError)}
              error={deltaOffsetError}
              onChange={handleChange}
              placeholder="PT2H"
            />

            <div className="flex items-center gap-2">
              <input
                id="cdfSourceFullReadOverride"
                type="checkbox"
                name="fullReadOverride"
                checked={fullReadOverride}
                onChange={handleChange}
                className="rounded border-slate-700 accent-blue-500"
              />
              <label
                htmlFor="cdfSourceFullReadOverride"
                className="flex items-center text-xs text-slate-300 cursor-pointer"
              >
                <span>Full read override</span>
                <InfoTooltip text="Perform a full read even when delta read is enabled. Maps to ReaderConfig.withFullReadOverride(boolean)." />
              </label>
            </div>

            {selectedResource?.supportsStreaming && effectiveReadMode === 'items' && (
              <>
                <div className="flex items-center gap-2">
                  <input
                    id="cdfSourceWatchForNewItems"
                    type="checkbox"
                    name="watchForNewItems"
                    checked={watchForNewItems}
                    onChange={handleChange}
                    className="rounded border-slate-700 accent-blue-500"
                  />
                  <label
                    htmlFor="cdfSourceWatchForNewItems"
                    className="flex items-center text-xs text-slate-300 cursor-pointer"
                  >
                    <span>Streaming: watch for new items</span>
                    <InfoTooltip text="Poll CDF regularly for new or updated items in streaming mode. Maps to ReaderConfig.watchForNewItems()." />
                  </label>
                </div>

                {watchForNewItems && (
                  <>
                    <PropertyField
                      id="cdfSourcePollInterval"
                      name="pollInterval"
                      label="Poll Interval"
                      tooltip="Polling interval in streaming mode (ISO-8601 duration). Maps to ReaderConfig.withPollInterval(Duration)."
                      value={pollInterval}
                      invalid={Boolean(pollIntervalError)}
                      error={pollIntervalError}
                      onChange={handleChange}
                      placeholder="PT10S"
                    />

                    <PropertyField
                      id="cdfSourcePollOffset"
                      name="pollOffset"
                      label="Poll Offset"
                      tooltip="Eventual consistency grace window in streaming mode (ISO-8601 duration). Maps to ReaderConfig.withPollOffset(Duration)."
                      value={pollOffset}
                      invalid={Boolean(pollOffsetError)}
                      error={pollOffsetError}
                      onChange={handleChange}
                      placeholder="PT30S"
                    />
                  </>
                )}
              </>
            )}

            <PropertyField
              id="cdfSourceReadFirstNResults"
              name="readFirstNResults"
              label="Read First N Results"
              type="number"
              tooltip="Read only the first N results (<= 0 reads all). Maps to ReaderConfig.withReadFirstNResults(int)."
              value={readFirstNResults}
              invalid={Boolean(readFirstNResultsError)}
              error={readFirstNResultsError}
              onChange={handleChange}
              placeholder="-1"
            />
          </div>
        )}
      </div>

      {/* Hints Group (Collapsible, default closed) */}
      <div className="border border-slate-700/50 rounded bg-slate-800/40 overflow-hidden">
        <button
          type="button"
          data-testid="cdf-source-group-hints"
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
              id="cdfSourceReadShardsPerWorker"
              name="readShardsPerWorker"
              label="Read Shards per Worker"
              type="number"
              min={1}
              max={10}
              tooltip="Maximum parallel read shards per worker (1-10, default 4). Maps to Hints.withReadShardsPerWorker(int)."
              value={readShardsPerWorker}
              invalid={Boolean(readShardsPerWorkerError)}
              error={readShardsPerWorkerError}
              onChange={handleChange}
              placeholder="4"
            />

            <PropertyField
              id="cdfSourceMaxRetries"
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

            {resourceType === 'files' && (
              <PropertyField
                id="cdfSourceReadFileBinaryBatchSize"
                name="readFileBinaryBatchSize"
                label="File Binary Batch Size"
                type="number"
                min={1}
                max={10}
                tooltip="Maximum batch size when reading binary files (1-10, default 8). Maps to Hints.withReadFileBinaryBatchSize(int)."
                value={readFileBinaryBatchSize}
                invalid={Boolean(readFileBinaryBatchSizeError)}
                error={readFileBinaryBatchSizeError}
                onChange={handleChange}
                placeholder="8"
              />
            )}
          </div>
        )}
      </div>

      {/* Flexible Spacer */}
      <div className="flex-1 min-h-4" />

      {/* Code Generation Instructions */}
      <div className="flex flex-col gap-2 pt-2 border-t border-slate-700/60">
        <PropertyField
          id="cdfSourceSystemInstructions"
          name="system_instructions"
          label="Code Generation Instructions"
          type="textarea"
          rows={3}
          mono={false}
          value={systemInstructions}
          onChange={handleInstructionsChange}
          placeholder="Enter custom instructions for Cognite Data Fusion source code generation..."
        />
      </div>
    </div>
  );
};
