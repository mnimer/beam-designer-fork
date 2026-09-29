/**
 * TrepWsIO Sink Properties Component (IO72 — D2 WebSocket API Post Bridge)
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Renders the property configuration panel for Refinitiv / LSEG TREP WebSocket Sink nodes.
 * Upstream `TrepWsIO` (`com.refinitiv.beamio:trepws-io:1.2.0`) is a source-only library.
 * Following PROJECT.md Decision D2 and the IO22 SnsIO precedent, the Sink node generates a
 * Beam `DoFn` that contributes MarketPrice updates through the documented LSEG/Refinitiv
 * WebSocket API (`tr_json2` sub-protocol Login, off-stream or on-stream `Post` of `Update`
 * messages with `Ack`/`PostID`, and `Ping`/`Pong` keepalive).
 *
 * Architectural Decisions:
 * - RTO OAuth password-grant credential (`passwordSecret`) is selected exclusively via
 *   `SecretManagerSecretField` and resolved from GCP Secret Manager at runtime.
 * - Uses M0 safe property keys (`ertAuthEnabled`, `ertAuthPath`) so nothing is falsely redacted.
 * - Drops `includePostUserInfo` per MILESTONE_DECISIONS.md.
 */

import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { InfoTooltip } from '../../components/InfoTooltip';
import { PropertyField } from '../../components/common/PropertyField';
import { SecretManagerSecretField } from '../../components/common/SecretManagerSecretField';

export const TREP_SINK_DOCS_URL = 'https://github.com/Refinitiv/websocket-api';

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

export interface TrepWsIOSinkPropertiesProps {
  node: {
    data: {
      properties?: Record<string, unknown>;
      system_instructions?: string;
      special_instructions?: string;
    };
  };
  onChange: (properties: Record<string, unknown>) => void;
}

export const TrepWsIOSinkProperties: React.FC<TrepWsIOSinkPropertiesProps> = ({
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
  const clientId = String(properties.clientId ?? '');
  const serviceDiscovery = Boolean(properties.serviceDiscovery);
  const region = String(properties.region ?? '');

  const serviceName = String(properties.serviceName ?? '');
  const postMode = String(properties.postMode ?? 'offStream');
  const ricMode = String(properties.ricMode ?? 'fromElement');
  const ricField = String(properties.ricField ?? '');
  const ricName = String(properties.ricName ?? '');
  const fieldNames = String(properties.fieldNames ?? '');
  const ackRequired = properties.ackRequired !== false;
  const nakHandling = String(properties.nakHandling ?? 'log');

  const position = String(properties.position ?? '');
  const appId = String(properties.appId ?? '');
  const authServer = String(properties.authServer ?? '');
  const authPort = String(properties.authPort ?? '');
  const ertAuthPath = String(properties.ertAuthPath ?? '');
  const takeExclusiveSignOnControl = properties.takeExclusiveSignOnControl !== false;
  const discoveryPath = String(properties.discoveryPath ?? '');

  const systemInstructions = String(
    node.data.system_instructions ??
      node.data.special_instructions ??
      properties.system_instructions ??
      properties.special_instructions ??
      ''
  );

  const discoveryActive = ertAuthEnabled && serviceDiscovery;

  // Validation
  const hostnameError =
    !discoveryActive && !hostname.trim()
      ? 'ADS hostname is required unless ERT service discovery is enabled'
      : null;
  const portError =
    port.trim().length > 0 && !isValidPort(port)
      ? 'Port must be an integer between 1 and 65535'
      : null;
  const usernameError = !username.trim() ? 'Username is required' : null;
  const passwordSecretError =
    ertAuthEnabled && !passwordSecret.trim()
      ? 'Password secret is required when token authentication is enabled'
      : null;
  const serviceNameError = !serviceName.trim() ? 'Service name is required' : null;
  const ricNameError =
    ricMode === 'fixed' && !ricName.trim()
      ? 'RIC is required when RIC source is Fixed'
      : null;
  const appIdError =
    appId.trim().length > 0 && !/^\d+$/.test(appId.trim())
      ? 'Application ID must be numeric'
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
    discoveryActive && discoveryPath.trim().length > 0 && !discoveryPath.trim().startsWith('/')
      ? 'Path must start with /'
      : null;

  const handleOpenDocs = () => {
    const vscode = (window as unknown as { vscode?: VsCodeApi }).vscode;
    if (vscode) {
      vscode.postMessage({ command: 'openExternal', url: TREP_SINK_DOCS_URL });
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
            TrepWsIO Sink (WebSocket API Post Bridge)
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
          Contributes market data updates to LSEG / Refinitiv TREP or RTO via the WebSocket API Post protocol (tr_json2).
        </p>
      </div>

      {/* Bridge Information Note */}
      <div className="p-2 rounded bg-blue-500/10 border border-blue-500/30 text-xs text-slate-300">
        Upstream <code>TrepWsIO</code> is read-only. This sink generates a Beam <code>DoFn</code> that contributes updates via the documented LSEG/Refinitiv WebSocket API Post protocol (<code>tr_json2</code>).
      </div>

      {/* Connection Group */}
      <div className="flex flex-col gap-3 p-3 bg-slate-800/40 rounded border border-slate-700/50">
        <span className="text-xs font-bold uppercase text-slate-400">
          Connection
        </span>

        <PropertyField
          id="trepSinkHostname"
          name="hostname"
          label="ADS Hostname"
          required={!discoveryActive ? 'ADS hostname is required' : false}
          tooltip="ADS / ADH WebSocket server receiving the posts. Required unless RTO service discovery is enabled."
          value={hostname}
          invalid={Boolean(hostnameError)}
          error={hostnameError}
          onChange={handleChange}
          placeholder="ads-contrib.example.internal"
          mono={true}
        />

        <PropertyField
          id="trepSinkPort"
          name="port"
          label="WebSocket Port"
          type="number"
          min={1}
          max={65535}
          tooltip="ADS WebSocket port (default 15000)."
          value={port}
          invalid={Boolean(portError)}
          error={portError}
          onChange={handleChange}
          placeholder="15000"
          mono={true}
        />
      </div>

      {/* Authentication Group */}
      <div className="flex flex-col gap-3 p-3 bg-slate-800/40 rounded border border-slate-700/50">
        <span className="text-xs font-bold uppercase text-slate-400">
          Authentication (DACS / RTO)
        </span>

        <PropertyField
          id="trepSinkUsername"
          name="username"
          label="DACS / RTO Username"
          required="Username is required"
          tooltip="DACS user name (ADS login Key.Name) or RTO machine ID. Not a secret."
          value={username}
          invalid={Boolean(usernameError)}
          error={usernameError}
          onChange={handleChange}
          placeholder="beam-poster"
        />

        <div className="flex items-center gap-2">
          <input
            id="trepSinkErtAuthEnabled"
            type="checkbox"
            name="ertAuthEnabled"
            checked={ertAuthEnabled}
            onChange={handleChange}
            className="rounded border-slate-700 accent-blue-500"
          />
          <label
            htmlFor="trepSinkErtAuthEnabled"
            className="flex items-center text-xs text-slate-300 cursor-pointer"
          >
            <span>Use ERT / RTO token authentication</span>
            <InfoTooltip text="Obtain an OAuth access token from LSEG Delivery Platform and log in with AuthnToken instead of a DACS user name." />
          </label>
        </div>

        {ertAuthEnabled && (
          <>
            <SecretManagerSecretField
              id="trepSinkPasswordSecret"
              name="passwordSecret"
              label="RTO Password Secret"
              required="Password secret is required when token authentication is enabled"
              tooltip="Secret Manager secret holding the RTO / ERT machine account password; resolved at runtime."
              value={passwordSecret}
              onChange={handleChange}
              error={passwordSecretError}
              invalid={Boolean(passwordSecretError)}
              placeholder="e.g. trep-rto-password"
            />

            <PropertyField
              id="trepSinkClientId"
              name="clientId"
              label="App Key (client_id)"
              tooltip="LSEG Delivery Platform App Key sent as client_id in the password-grant token request."
              value={clientId}
              onChange={handleChange}
              placeholder="app-key-client-id"
              mono={true}
            />

            <div className="flex items-center gap-2">
              <input
                id="trepSinkServiceDiscovery"
                type="checkbox"
                name="serviceDiscovery"
                checked={serviceDiscovery}
                onChange={handleChange}
                className="rounded border-slate-700 accent-blue-500"
              />
              <label
                htmlFor="trepSinkServiceDiscovery"
                className="flex items-center text-xs text-slate-300 cursor-pointer"
              >
                <span>Use RTO service discovery</span>
                <InfoTooltip text="Discover the WebSocket endpoint for the region via the streaming pricing discovery API." />
              </label>
            </div>

            {serviceDiscovery && (
              <PropertyField
                id="trepSinkRegion"
                name="region"
                label="Discovery Region"
                tooltip="Discovery region filter (e.g. us-east-1, us, eu)."
                value={region}
                onChange={handleChange}
                placeholder="us"
                mono={true}
              />
            )}
          </>
        )}
      </div>

      {/* Contribution / Post Group */}
      <div className="flex flex-col gap-3 p-3 bg-slate-800/40 rounded border border-slate-700/50">
        <span className="text-xs font-bold uppercase text-slate-400">
          Contribution / Post Settings
        </span>

        <PropertyField
          id="trepSinkServiceName"
          name="serviceName"
          label="Contribution Service"
          required="Service name is required"
          tooltip="Name of the TREP / RCC contribution service to post to (e.g. DDS_TRCE, TRCC)."
          value={serviceName}
          invalid={Boolean(serviceNameError)}
          error={serviceNameError}
          onChange={handleChange}
          placeholder="DDS_TRCE"
          mono={true}
        />

        {/* Post Type Radio */}
        <div className="flex flex-col gap-2">
          <label className="flex items-center text-xs font-bold uppercase text-slate-500">
            <span>Post Type</span>
            <InfoTooltip text="Off-stream posts on the Login stream (ID 1) without opening an item stream; On-stream opens an item stream for each RIC first." />
          </label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="radio"
                name="postMode"
                value="offStream"
                checked={postMode === 'offStream'}
                onChange={handleChange}
                className="accent-blue-500"
              />
              <span>Off-Stream (Login stream)</span>
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="radio"
                name="postMode"
                value="onStream"
                checked={postMode === 'onStream'}
                onChange={handleChange}
                className="accent-blue-500"
              />
              <span>On-Stream (Item stream)</span>
            </label>
          </div>
        </div>

        {/* RIC Source Radio */}
        <div className="flex flex-col gap-2">
          <label className="flex items-center text-xs font-bold uppercase text-slate-500">
            <span>RIC Source</span>
            <InfoTooltip text="Take the target RIC (Key.Name) dynamically from each incoming element, or post all elements to a single fixed RIC." />
          </label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="radio"
                name="ricMode"
                value="fromElement"
                checked={ricMode === 'fromElement'}
                onChange={handleChange}
                className="accent-blue-500"
              />
              <span>From Element</span>
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="radio"
                name="ricMode"
                value="fixed"
                checked={ricMode === 'fixed'}
                onChange={handleChange}
                className="accent-blue-500"
              />
              <span>Fixed RIC</span>
            </label>
          </div>
        </div>

        {ricMode === 'fromElement' ? (
          <PropertyField
            id="trepSinkRicField"
            name="ricField"
            label="RIC Attribute"
            tooltip="Element attribute or getter holding the RIC. 'name' matches MarketPriceMessage.getName() from the TrepWsIO source."
            value={ricField}
            onChange={handleChange}
            placeholder="name"
            mono={true}
          />
        ) : (
          <PropertyField
            id="trepSinkRicName"
            name="ricName"
            label="Fixed RIC"
            required="RIC is required when RIC source is Fixed"
            tooltip="Fixed RIC to contribute updates to (e.g. EURMID=)."
            value={ricName}
            invalid={Boolean(ricNameError)}
            error={ricNameError}
            onChange={handleChange}
            placeholder="EURMID="
            mono={true}
          />
        )}

        <PropertyField
          id="trepSinkFieldNames"
          name="fieldNames"
          label="Fields to Post"
          tooltip="Comma-separated subset of field names to include in Message.Fields (e.g. BID, ASK, MID). Leave blank to post all fields."
          value={fieldNames}
          onChange={handleChange}
          placeholder="BID, ASK (blank = all fields)"
          mono={true}
        />

        <div className="flex items-center gap-2">
          <input
            id="trepSinkAckRequired"
            type="checkbox"
            name="ackRequired"
            checked={ackRequired}
            onChange={handleChange}
            className="rounded border-slate-700 accent-blue-500"
          />
          <label
            htmlFor="trepSinkAckRequired"
            className="flex items-center text-xs text-slate-300 cursor-pointer"
          >
            <span>Request Ack</span>
            <InfoTooltip text='Sets "Ack": true with an incrementing PostID so the server returns an Ack/Nak message for each post.' />
          </label>
        </div>

        <div className="flex flex-col gap-2">
          <label
            htmlFor="trepSinkNakHandling"
            className="flex items-center text-xs font-bold uppercase text-slate-500"
          >
            <span>On Nak</span>
            <InfoTooltip text="Action when an Ack response carries a NakCode: log a warning and continue, or throw an exception to fail the bundle." />
          </label>
          <select
            id="trepSinkNakHandling"
            name="nakHandling"
            value={nakHandling}
            disabled={!ackRequired}
            onChange={handleChange}
            className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500 disabled:opacity-50"
          >
            <option value="log">Log warning and continue</option>
            <option value="fail">Fail bundle (throw exception)</option>
          </select>
        </div>
      </div>

      {/* Collapsible Advanced Settings */}
      <div className="border border-slate-700/50 rounded bg-slate-800/40 overflow-hidden">
        <button
          type="button"
          data-testid="trep-sink-group-advanced"
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
              id="trepSinkPosition"
              name="position"
              label="DACS Position"
              tooltip="Login Key.Elements.Position (default is the worker IP address)."
              value={position}
              onChange={handleChange}
              placeholder="local host IP"
              mono={true}
            />

            <PropertyField
              id="trepSinkAppId"
              name="appId"
              label="Application ID"
              tooltip="Login Key.Elements.ApplicationId (default 256)."
              value={appId}
              invalid={Boolean(appIdError)}
              error={appIdError}
              onChange={handleChange}
              placeholder="256"
              mono={true}
            />

            {ertAuthEnabled && (
              <>
                <PropertyField
                  id="trepSinkAuthServer"
                  name="authServer"
                  label="Auth Server"
                  tooltip="LSEG Delivery Platform authentication host (default api.refinitiv.com)."
                  value={authServer}
                  onChange={handleChange}
                  placeholder="api.refinitiv.com"
                  mono={true}
                />

                <PropertyField
                  id="trepSinkAuthPort"
                  name="authPort"
                  label="Auth Port"
                  type="number"
                  min={1}
                  max={65535}
                  tooltip="LSEG Delivery Platform authentication port (default 443)."
                  value={authPort}
                  invalid={Boolean(authPortError)}
                  error={authPortError}
                  onChange={handleChange}
                  placeholder="443"
                  mono={true}
                />

                <PropertyField
                  id="trepSinkErtAuthPath"
                  name="ertAuthPath"
                  label="Token Auth Path"
                  tooltip="OAuth token endpoint path (default /auth/oauth2/v1/token)."
                  value={ertAuthPath}
                  invalid={Boolean(ertAuthPathError)}
                  error={ertAuthPathError}
                  onChange={handleChange}
                  placeholder="/auth/oauth2/v1/token"
                  mono={true}
                />

                <div className="flex items-center gap-2">
                  <input
                    id="trepSinkTakeExclusiveSignOnControl"
                    type="checkbox"
                    name="takeExclusiveSignOnControl"
                    checked={takeExclusiveSignOnControl}
                    onChange={handleChange}
                    className="rounded border-slate-700 accent-blue-500"
                  />
                  <label
                    htmlFor="trepSinkTakeExclusiveSignOnControl"
                    className="flex items-center text-xs text-slate-300 cursor-pointer"
                  >
                    <span>Take exclusive sign-on control</span>
                    <InfoTooltip text="Force sign-out of other sessions for this machine ID in the OAuth password-grant request." />
                  </label>
                </div>
              </>
            )}

            {discoveryActive && (
              <PropertyField
                id="trepSinkDiscoveryPath"
                name="discoveryPath"
                label="Discovery Path"
                tooltip="Service discovery endpoint path (default /streaming/pricing/v1/)."
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
          id="trepSinkSystemInstructions"
          name="system_instructions"
          label="Code Generation Instructions"
          type="textarea"
          rows={3}
          mono={false}
          value={systemInstructions}
          onChange={handleInstructionsChange}
          placeholder="Enter custom instructions for TrepWsIO sink code generation..."
        />
      </div>
    </div>
  );
};
