/**
 * TrepWsIO Source Properties Component (IO72)
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Renders the property configuration panel for Refinitiv / LSEG TREP WebSocket Source nodes
 * in Apache Beam Java pipelines (`com.refinitiv.beamio:trepws-io:1.2.0`, `TrepWsIO.read()`).
 *
 * Architectural Decisions:
 * - Exposes all documented `TrepWsIO.Read.with*` options and an interactive `InstrumentTuple`
 *   list editor (`service`, `rics`, `fields`).
 * - ERT/RTO password is selected exclusively via GCP Secret Manager (`SecretManagerSecretField`
 *   writing `passwordSecret`) and resolved at runtime.
 * - Uses M0 non-credential property key renames (`ertAuthEnabled`, `ertAuthStoreLocation`,
 *   `ertAuthPath`) so that `src/credentialRedaction.ts` classifies them as `'safe'`.
 * - Upstream bug safeguard: `TrepWsIO.Read.withAuthServer(String)` calls `setUsername(authServer)`
 *   upstream and overwrites the username. Therefore `authServer` is displayed read-only with its
 *   default value (`api.edp.thomsonreuters.com`) and is never persisted or emitted.
 */

import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { InfoTooltip } from '../../components/InfoTooltip';
import { PropertyField } from '../../components/common/PropertyField';
import { SecretManagerSecretField } from '../../components/common/SecretManagerSecretField';

export const TREP_SOURCE_DOCS_URL = 'https://github.com/Refinitiv/trep-websockets-beam-io';
export const DEFAULT_TREP_AUTH_SERVER = 'api.edp.thomsonreuters.com';

export interface InstrumentTupleItem {
  service: string;
  rics: string;
  fields: string;
}

function isPositiveInteger(val: string, min = 1): boolean {
  if (!/^\d+$/.test(val.trim())) {
    return false;
  }
  return Number(val.trim()) >= min;
}

function isValidPort(val: string): boolean {
  if (!/^\d+$/.test(val.trim())) {
    return false;
  }
  const n = Number(val.trim());
  return n >= 1 && n <= 65535;
}

interface VsCodeApi {
  postMessage: (message: Record<string, unknown>) => void;
}

export interface TrepWsIOSourcePropertiesProps {
  node: {
    data: {
      properties?: Record<string, unknown>;
      system_instructions?: string;
      special_instructions?: string;
    };
  };
  onChange: (properties: Record<string, unknown>) => void;
}

export const TrepWsIOSourceProperties: React.FC<TrepWsIOSourcePropertiesProps> = ({
  node,
  onChange,
}) => {
  const properties = node.data.properties || {};
  const [showAdvanced, setShowAdvanced] = useState(false);

  const hostname = String(properties.hostname ?? '');
  const port = String(properties.port ?? '');
  const username = String(properties.username ?? '');
  const ertAuthEnabled = Boolean(properties.ertAuthEnabled);
  const passwordSecret = String(properties.passwordSecret ?? '');
  const ertAuthStoreLocation = String(properties.ertAuthStoreLocation ?? '');
  const serviceDiscovery = Boolean(properties.serviceDiscovery);
  const region = String(properties.region ?? '');

  const rawTuples = Array.isArray(properties.instrumentTuples)
    ? (properties.instrumentTuples as InstrumentTupleItem[])
    : [];
  const tuples: InstrumentTupleItem[] =
    rawTuples.length > 0
      ? rawTuples.map((t) => ({
          service: String(t.service ?? ''),
          rics: String(t.rics ?? ''),
          fields: String(t.fields ?? ''),
        }))
      : [{ service: '', rics: '', fields: '' }];

  const cachedFields = String(properties.cachedFields ?? '');
  const maxMounts = String(properties.maxMounts ?? '');
  const position = String(properties.position ?? '');
  const appId = String(properties.appId ?? '');
  const timeout = String(properties.timeout ?? '');
  const maxNumRecords = String(properties.maxNumRecords ?? '');
  const authPort = String(properties.authPort ?? '');
  const ertAuthPath = String(properties.ertAuthPath ?? '');
  const discoveryPath = String(properties.discoveryPath ?? '');

  const systemInstructions = String(
    node.data.system_instructions ??
      node.data.special_instructions ??
      properties.system_instructions ??
      properties.special_instructions ??
      ''
  );

  // Validation
  const hostnameError =
    !serviceDiscovery && !hostname.trim()
      ? 'ADS hostname is required unless ERT service discovery is enabled'
      : null;
  const portError =
    port.trim().length > 0 && !isValidPort(port)
      ? 'Port must be an integer between 1 and 65535'
      : null;
  const usernameError = !username.trim() ? 'Username is required' : null;
  const passwordSecretError =
    ertAuthEnabled && !passwordSecret.trim()
      ? 'Password secret is required when ERT token authentication is enabled'
      : null;
  const storeLocationError =
    ertAuthEnabled && !ertAuthStoreLocation.trim()
      ? 'Token store location is required when ERT token authentication is enabled'
      : null;
  const storeLocationWarning =
    ertAuthEnabled &&
    ertAuthStoreLocation.trim().length > 0 &&
    !ertAuthStoreLocation.trim().startsWith('gs://')
      ? 'Token store is normally a gs:// location (e.g. the Dataflow temp location)'
      : null;

  const hasValidInstrument = tuples.some((t) => t.rics.trim().length > 0);
  const instrumentsError = !hasValidInstrument
    ? 'At least one instrument (RIC list) is required'
    : null;

  const maxMountsError =
    maxMounts.trim().length > 0 && !isPositiveInteger(maxMounts, 1)
      ? 'Max mounts must be an integer ≥ 1'
      : null;
  const appIdError =
    appId.trim().length > 0 && !/^\d+$/.test(appId.trim())
      ? 'Application ID must be numeric'
      : null;
  const timeoutError =
    timeout.trim().length > 0 && !isPositiveInteger(timeout, 60000)
      ? 'Timeout must be at least 60000 ms (larger than ping timer x2)'
      : null;
  const maxNumRecordsError =
    maxNumRecords.trim().length > 0 && !isPositiveInteger(maxNumRecords, 1)
      ? 'Max records must be a positive integer'
      : null;
  const authPortError =
    ertAuthEnabled && authPort.trim().length > 0 && !isValidPort(authPort)
      ? 'Auth port must be an integer between 1 and 65535'
      : null;
  const ertAuthPathError =
    ertAuthEnabled && ertAuthPath.trim().length > 0 && !ertAuthPath.trim().startsWith('/')
      ? 'Path must start with /'
      : null;
  const discoveryPathError =
    serviceDiscovery && discoveryPath.trim().length > 0 && !discoveryPath.trim().startsWith('/')
      ? 'Path must start with /'
      : null;

  const handleOpenDocs = () => {
    const vscode = (window as unknown as { vscode?: VsCodeApi }).vscode;
    if (vscode) {
      vscode.postMessage({ command: 'openExternal', url: TREP_SOURCE_DOCS_URL });
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    const val = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    onChange({
      ...properties,
      [name]: val,
    });
  };

  const handleTupleChange = (
    index: number,
    field: keyof InstrumentTupleItem,
    value: string
  ) => {
    const nextTuples = tuples.map((item, idx) =>
      idx === index ? { ...item, [field]: value } : item
    );
    onChange({
      ...properties,
      instrumentTuples: nextTuples,
    });
  };

  const handleAddTuple = () => {
    onChange({
      ...properties,
      instrumentTuples: [...tuples, { service: '', rics: '', fields: '' }],
    });
  };

  const handleRemoveTuple = (index: number) => {
    const nextTuples = tuples.filter((_, idx) => idx !== index);
    onChange({
      ...properties,
      instrumentTuples: nextTuples,
    });
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
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase text-slate-400">
          TrepWsIO Source
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
          id="trepSourceHostname"
          name="hostname"
          label="ADS Hostname"
          required={!serviceDiscovery ? 'ADS hostname is required' : false}
          tooltip="Hostname where the ADS (or ERT endpoint) WebSocket server is running. Maps to TrepWsIO.Read.withHostname(String)."
          value={hostname}
          invalid={Boolean(hostnameError)}
          error={hostnameError}
          onChange={handleChange}
          placeholder="websocket-ads.example.internal"
          mono={true}
        />

        <PropertyField
          id="trepSourcePort"
          name="port"
          label="WebSocket Port"
          type="number"
          min={1}
          max={65535}
          tooltip="ADS WebSocket port (default 15000). Maps to TrepWsIO.Read.withPort(int)."
          value={port}
          invalid={Boolean(portError)}
          error={portError}
          onChange={handleChange}
          placeholder="15000"
          mono={true}
        />

        <div className="flex items-center gap-2">
          <input
            id="trepSourceServiceDiscovery"
            type="checkbox"
            name="serviceDiscovery"
            checked={serviceDiscovery}
            onChange={handleChange}
            className="rounded border-slate-700 accent-blue-500"
          />
          <label
            htmlFor="trepSourceServiceDiscovery"
            className="flex items-center text-xs text-slate-300 cursor-pointer"
          >
            <span>Use ERT service discovery</span>
            <InfoTooltip text="Discover and connect to ERT services in the chosen region instead of a fixed hostname. Maps to TrepWsIO.Read.withServiceDiscovery(boolean)." />
          </label>
        </div>

        {serviceDiscovery && (
          <PropertyField
            id="trepSourceRegion"
            name="region"
            label="Discovery Region"
            tooltip="ERT discovery region, e.g. us or eu (default us). Maps to TrepWsIO.Read.withRegion(String)."
            value={region}
            onChange={handleChange}
            placeholder="eu"
            mono={true}
          />
        )}
      </div>

      {/* Authentication Group */}
      <div className="flex flex-col gap-3 p-3 bg-slate-800/40 rounded border border-slate-700/50">
        <span className="text-xs font-bold uppercase text-slate-400">
          Authentication (DACS / ERT)
        </span>

        <PropertyField
          id="trepSourceUsername"
          name="username"
          label="DACS / ERT Username"
          required="Username is required"
          tooltip="DACS user name (ADS) or ERT machine ID. Maps to TrepWsIO.Read.withUsername(String). Not a secret."
          value={username}
          invalid={Boolean(usernameError)}
          error={usernameError}
          onChange={handleChange}
          placeholder="GE-A-01103867-3-1234"
        />

        <div className="flex items-center gap-2">
          <input
            id="trepSourceErtAuthEnabled"
            type="checkbox"
            name="ertAuthEnabled"
            checked={ertAuthEnabled}
            onChange={handleChange}
            className="rounded border-slate-700 accent-blue-500"
          />
          <label
            htmlFor="trepSourceErtAuthEnabled"
            className="flex items-center text-xs text-slate-300 cursor-pointer"
          >
            <span>Use ERT token authentication</span>
            <InfoTooltip text="Enable when connecting to Elektron Real-Time (ERT / RTO). Requires a password secret and token store location. Maps to TrepWsIO.Read.withTokenAuth(boolean)." />
          </label>
        </div>

        {ertAuthEnabled && (
          <>
            <SecretManagerSecretField
              id="trepSourcePasswordSecret"
              name="passwordSecret"
              label="ERT Password Secret"
              required="Password secret is required when ERT token authentication is enabled"
              tooltip="Secret Manager secret holding the ERT password. Resolved at pipeline construction and passed to TrepWsIO.Read.withPassword(String)."
              value={passwordSecret}
              onChange={handleChange}
              error={passwordSecretError}
              invalid={Boolean(passwordSecretError)}
              placeholder="e.g. trep-ert-password"
            />

            <PropertyField
              id="trepSourceErtAuthStoreLocation"
              name="ertAuthStoreLocation"
              label="Token Store Location"
              required="Token store location is required when ERT token authentication is enabled"
              tooltip="Token store location used to support multiple ERT mounts. This can be the Dataflow temp location. Maps to TrepWsIO.Read.withTokenStore(String)."
              value={ertAuthStoreLocation}
              invalid={Boolean(storeLocationError)}
              error={storeLocationError}
              onChange={handleChange}
              placeholder="gs://my-bucket/trep-token-store"
              mono={true}
              helperText={
                storeLocationWarning ? (
                  <span className="text-amber-400" role="status">
                    {storeLocationWarning}
                  </span>
                ) : null
              }
            />

            <PropertyField
              id="trepSourceAuthServerReadOnly"
              label="Auth Server (Connector Default)"
              tooltip="Upstream TrepWsIO.withAuthServer() overwrites the username (bug), so the auth server cannot be changed; the connector default is always used."
              value={DEFAULT_TREP_AUTH_SERVER}
              readOnly={true}
              mono={true}
              helperText={
                <span className="text-amber-400">
                  Upstream TrepWsIO.withAuthServer() overwrites the username (bug), so the auth server cannot be changed; the connector default is always used.
                </span>
              }
            />
          </>
        )}
      </div>

      {/* Instruments Group */}
      <div className="flex flex-col gap-3 p-3 bg-slate-800/40 rounded border border-slate-700/50">
        <div className="flex items-center justify-between">
          <span className="flex items-center text-xs font-bold uppercase text-slate-400">
            <span>Instruments</span>
            <span className="text-red-400 ml-1 font-bold" title="At least one instrument is required">
              *
            </span>
            <InfoTooltip text="Each row defines an InstrumentTuple.of(service, rics, fields) passed to TrepWsIO.Read.withInstrumentTuples(List)." />
          </span>
          <button
            type="button"
            onClick={handleAddTuple}
            className="text-xs text-blue-400 hover:text-blue-300 hover:underline cursor-pointer"
          >
            + Add instrument
          </button>
        </div>

        {instrumentsError && (
          <span className="text-xs text-red-400" role="alert">
            {instrumentsError}
          </span>
        )}

        {tuples.map((tuple, idx) => {
          const rowMissingRics =
            (Boolean(tuple.service.trim()) || Boolean(tuple.fields.trim())) &&
            !tuple.rics.trim();
          return (
            <div
              key={idx}
              className="flex flex-col gap-2 p-2 rounded border border-slate-700/50 bg-[#1e202a]"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400">
                  Instrument #{idx + 1}
                </span>
                <button
                  type="button"
                  aria-label={`Remove instrument ${idx + 1}`}
                  disabled={tuples.length <= 1}
                  onClick={() => handleRemoveTuple(idx)}
                  className="text-xs text-red-400 hover:underline disabled:opacity-40 cursor-pointer"
                >
                  Remove
                </button>
              </div>

              <PropertyField
                id={`trepSourceTuple${idx}Service`}
                label="Service"
                tooltip="TREP service name (e.g. IDN_RDF, ELEKTRON_DD). Leave blank to use the default ADS service."
                value={tuple.service}
                onChange={(e) => handleTupleChange(idx, 'service', e.target.value)}
                placeholder="IDN_RDF (blank = default ADS service)"
                mono={true}
              />

              <PropertyField
                id={`trepSourceTuple${idx}Rics`}
                label="RICs"
                required="RIC list is required"
                tooltip="Comma-separated Reuters Instrument Codes (e.g. EUR=, JPY=)."
                value={tuple.rics}
                invalid={rowMissingRics}
                error={rowMissingRics ? 'RIC list is required for each instrument' : null}
                onChange={(e) => handleTupleChange(idx, 'rics', e.target.value)}
                placeholder="EUR=, JPY="
                mono={true}
              />

              <PropertyField
                id={`trepSourceTuple${idx}Fields`}
                label="Fields"
                tooltip="Comma-separated field names for View filtering (e.g. BID, ASK). Leave blank for all fields."
                value={tuple.fields}
                onChange={(e) => handleTupleChange(idx, 'fields', e.target.value)}
                placeholder="BID, ASK (blank = all fields)"
                mono={true}
              />
            </div>
          );
        })}
      </div>

      {/* Collapsible Advanced Settings */}
      <div className="border border-slate-700/50 rounded bg-slate-800/40 overflow-hidden">
        <button
          type="button"
          data-testid="trep-source-group-advanced"
          aria-expanded={showAdvanced}
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full flex items-center justify-between p-3 text-xs font-bold uppercase text-slate-400 hover:bg-slate-800/60 transition-colors cursor-pointer"
        >
          <span>Advanced Settings</span>
          {showAdvanced ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>

        {showAdvanced && (
          <div className="p-3 flex flex-col gap-3 border-t border-slate-700/50">
            <PropertyField
              id="trepSourceCachedFields"
              name="cachedFields"
              label="Cached Fields"
              tooltip="Comma-separated field names whose values are cached and returned in every update (e.g. PROD_PERM, CONTR_MNTH). Maps to TrepWsIO.Read.withCachedFields(Set)."
              value={cachedFields}
              onChange={handleChange}
              placeholder="PROD_PERM, CONTR_MNTH"
              mono={true}
            />

            <PropertyField
              id="trepSourceMaxMounts"
              name="maxMounts"
              label="Max ADS Mounts"
              type="number"
              min={1}
              tooltip="Maximum number of ADS mounts (default 1). Maps to TrepWsIO.Read.withMaxMounts(int)."
              value={maxMounts}
              invalid={Boolean(maxMountsError)}
              error={maxMountsError}
              onChange={handleChange}
              placeholder="1"
              mono={true}
            />

            <PropertyField
              id="trepSourcePosition"
              name="position"
              label="DACS Position"
              tooltip="DACS position; if unset the IP address of the local host is used. Maps to TrepWsIO.Read.withPosition(String)."
              value={position}
              onChange={handleChange}
              placeholder="local host IP"
              mono={true}
            />

            <PropertyField
              id="trepSourceAppId"
              name="appId"
              label="DACS Application ID"
              tooltip="DACS application ID (default 256). Maps to TrepWsIO.Read.withAppId(String)."
              value={appId}
              invalid={Boolean(appIdError)}
              error={appIdError}
              onChange={handleChange}
              placeholder="256"
              mono={true}
            />

            <PropertyField
              id="trepSourceTimeout"
              name="timeout"
              label="Session Idle Timeout (ms)"
              type="number"
              min={60000}
              tooltip="WebSocket MaxSessionIdleTimeout in milliseconds (must be >= 60000). Maps to TrepWsIO.Read.withTimeout(int)."
              value={timeout}
              invalid={Boolean(timeoutError)}
              error={timeoutError}
              onChange={handleChange}
              placeholder="60000"
              mono={true}
            />

            <PropertyField
              id="trepSourceMaxNumRecords"
              name="maxNumRecords"
              label="Max Records (bounded read)"
              type="number"
              min={1}
              tooltip="Stop after N records to run as a bounded source (blank = unbounded stream). Maps to TrepWsIO.Read.withMaxNumRecords(long)."
              value={maxNumRecords}
              invalid={Boolean(maxNumRecordsError)}
              error={maxNumRecordsError}
              onChange={handleChange}
              placeholder="Unbounded"
              mono={true}
            />

            {ertAuthEnabled && (
              <>
                <PropertyField
                  id="trepSourceAuthPort"
                  name="authPort"
                  label="Auth Server Port"
                  type="number"
                  min={1}
                  max={65535}
                  tooltip="ERT token auth server port (default 443). Maps to TrepWsIO.Read.withAuthPort(int)."
                  value={authPort}
                  invalid={Boolean(authPortError)}
                  error={authPortError}
                  onChange={handleChange}
                  placeholder="443"
                  mono={true}
                />

                <PropertyField
                  id="trepSourceErtAuthPath"
                  name="ertAuthPath"
                  label="Token Auth Path"
                  tooltip="ERT token authentication path override (default /auth/oauth2/beta1/token). Maps to TrepWsIO.Read.withTokenAuthPath(String)."
                  value={ertAuthPath}
                  invalid={Boolean(ertAuthPathError)}
                  error={ertAuthPathError}
                  onChange={handleChange}
                  placeholder="/auth/oauth2/beta1/token"
                  mono={true}
                />
              </>
            )}

            {serviceDiscovery && (
              <PropertyField
                id="trepSourceDiscoveryPath"
                name="discoveryPath"
                label="Discovery Path"
                tooltip="ERT service discovery path override (default /streaming/pricing/v1/). Maps to TrepWsIO.Read.withDiscoveryPath(String)."
                value={discoveryPath}
                invalid={Boolean(discoveryPathError)}
                error={discoveryPathError}
                onChange={handleChange}
                placeholder="/streaming/pricing/v1/"
                mono={true}
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
          id="trepSourceSystemInstructions"
          name="system_instructions"
          label="Code Generation Instructions"
          type="textarea"
          rows={3}
          mono={false}
          value={systemInstructions}
          onChange={handleInstructionsChange}
          placeholder="Enter custom instructions for TrepWsIO source code generation..."
        />
      </div>
    </div>
  );
};
