/**
 * RequestResponseIO (Web APIs) Sink Properties Component
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Renders the property configuration panel for Apache Beam RequestResponseIO Sink (Writer) nodes
 * (`org.apache.beam.io.requestresponse.RequestResponseIO` in Java and
 * `apache_beam.io.requestresponse.RequestResponseIO` in Python), which write request payloads
 * to external HTTP/REST/RPC Web APIs via `Caller` with automatic retry backoff, adaptive
 * throttling, and optional Redis caching.
 *
 * Architectural Decisions:
 * - Defaults `httpMethod` to `'POST'` for Sink writes (while supporting `'PUT'`, `'PATCH'`, `'DELETE'`, `'GET'`).
 * - Requires `endpointUrl` (Caller Web API URL) and flags validation error when empty.
 * - Uses `SecretManagerAuthFields` and `useAssetLoader('secrets')` bound to `secretName`
 *   so API keys / Bearer tokens are resolved from Google Cloud Secret Manager during `SetupTeardown.setup()`.
 * - Exposes documented Java (`withTimeout`, `withoutRepeater`, `withCache`, `withCallShouldBackoff`)
 *   and Python (`timeout`, `ExponentialBackOffRepeater`/`NoOpsRepeater`, `DefaultThrottler`, `RedisCache`) options.
 */

import React from 'react';
import { InfoTooltip } from '../../components/InfoTooltip';
import { PropertyField } from '../../components/common/PropertyField';
import { SystemInstructionsField } from '../../components/common/SystemInstructionsField';
import { resolveSystemInstructions } from '../../utils/systemInstructions';
import { SecretManagerAuthFields } from '../../components/common/SecretManagerAuthFields';
import type { SecretItem, AuthModeOption } from '../../components/common/SecretManagerAuthFields';
import { useAssetLoader } from '../../hooks/useAssetLoader';

export const WEB_API_SINK_AUTH_OPTIONS: AuthModeOption[] = [
  { value: 'secretManager', label: 'Google Cloud Secret Manager (Bearer / API Key)' },
  { value: 'none', label: 'No Authentication / Internal Endpoint' },
];

export const SINK_HTTP_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE', 'GET'] as const;

export const SINK_CODER_OPTIONS = [
  { value: 'JsonUtf8Coder', label: 'JsonUtf8Coder (JSON Payload)' },
  { value: 'StringUtf8Coder', label: 'StringUtf8Coder (UTF-8 String)' },
  { value: 'RowCoder', label: 'RowCoder (Beam Schema Row)' },
  { value: 'SerializableCoder', label: 'SerializableCoder (Java POJO / Python Pickle)' },
];

/**
 * React Flow node shape for the RequestResponseIO sink panel, including its persisted configuration data.
 */
export interface RequestResponseIOSinkNode {
  data: {
    label: string;
    beam_transform?: string;
    system_instructions?: string;
    special_instructions?: string;
    properties?: {
      endpointUrl?: string;
      httpMethod?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
      requestCoder?: string;
      responseCoder?: string;
      authMode?: 'secretManager' | 'none';
      secretName?: string;
      authHeaderName?: string;
      timeout?: number | string;
      enableRepeater?: boolean;
      enableThrottler?: boolean;
      overloadRatio?: number | string;
      enableCache?: boolean;
      redisUri?: string;
      cacheTtlSeconds?: number | string;
      system_instructions?: string;
      special_instructions?: string;
      [key: string]: any;
    };
  };
}

/**
 * Props for the RequestResponseIOSinkProperties component.
 */
export interface RequestResponseIOSinkPropertiesProps {
  node: RequestResponseIOSinkNode;
  onChange: (properties: any) => void;
}

/**
 * RequestResponseIOSinkProperties component rendering the configuration form for RequestResponseIO Web API writes.
 *
 * @param props Component properties containing the active node and onChange callback.
 * @returns React component.
 */
export const RequestResponseIOSinkProperties: React.FC<RequestResponseIOSinkPropertiesProps> = ({ node, onChange }) => {
  const properties = node.data.properties || {};

  // Request GCP Secret Manager secrets via shared useAssetLoader hook
  const { items: secrets } = useAssetLoader<SecretItem | string>('secrets');

  const endpointUrl = properties.endpointUrl || '';
  const httpMethod = properties.httpMethod || 'POST';
  const requestCoder = properties.requestCoder || 'JsonUtf8Coder';
  const responseCoder = properties.responseCoder || 'JsonUtf8Coder';
  const authMode = properties.authMode || 'secretManager';
  const secretName = properties.secretName || '';
  const authHeaderName = properties.authHeaderName || 'Authorization';
  const timeout = properties.timeout !== undefined ? properties.timeout : 30;
  const enableRepeater = properties.enableRepeater !== undefined ? Boolean(properties.enableRepeater) : true;
  const enableThrottler = properties.enableThrottler !== undefined ? Boolean(properties.enableThrottler) : true;
  const overloadRatio = properties.overloadRatio !== undefined ? properties.overloadRatio : 2.0;
  const enableCache = Boolean(properties.enableCache ?? false);
  const redisUri = properties.redisUri || '';
  const cacheTtlSeconds = properties.cacheTtlSeconds !== undefined ? properties.cacheTtlSeconds : 86400;

  // Validation: endpointUrl is required
  const isEndpointInvalid = !endpointUrl.trim();

  // System instructions text with fallback
  const systemInstructions = resolveSystemInstructions(node);

  /**
   * Handles text, number, and select input changes.
   */
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    let finalValue: any = value;
    if (type === 'number') {
      finalValue = value === '' ? '' : Number(value);
    }
    onChange({
      ...properties,
      [name]: finalValue,
    });
  };

  /**
   * Handles boolean checkbox toggles for repeater, throttler, and cache.
   */
  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    onChange({
      ...properties,
      [name]: checked,
    });
  };

  return (
    <div className="flex-1 flex flex-col gap-4">
      {/* Caller Web API Endpoint URL */}
      <PropertyField
        id="rrioSinkEndpointUrl"
        name="endpointUrl"
        label="Destination Web API URL (Caller)"
        required="Destination Web API URL is required"
        tooltip="Target HTTP/REST API URL to which RequestResponseIO Caller dispatches write payloads (e.g. https://api.example.com/v1/webhooks)."
        value={endpointUrl}
        invalid={isEndpointInvalid}
        error={isEndpointInvalid ? 'Destination Web API URL is required.' : null}
        onChange={handleChange}
        placeholder="https://api.example.com/v1/webhooks"
      />

      {/* HTTP Method & Coders */}
      <div className="grid grid-cols-3 items-end gap-4">
        <div className="flex flex-col gap-2">
          <label htmlFor="rrioSinkHttpMethod" className="flex items-center text-xs font-bold uppercase text-slate-500">
            <span>HTTP Method</span>
            <InfoTooltip text="HTTP verb executed inside Caller.call(RequestT) when writing payloads to the Web API (default: POST)." />
          </label>
          <select
            id="rrioSinkHttpMethod"
            name="httpMethod"
            value={httpMethod}
            onChange={handleChange}
            className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500 font-mono"
          >
            {SINK_HTTP_METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="rrioSinkRequestCoder" className="flex items-center text-xs font-bold uppercase text-slate-500">
            <span>Request Coder</span>
            <InfoTooltip text="Beam Coder<RequestT> for outbound request elements." />
          </label>
          <select
            id="rrioSinkRequestCoder"
            name="requestCoder"
            value={requestCoder}
            onChange={handleChange}
            className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
          >
            {SINK_CODER_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="rrioSinkResponseCoder" className="flex items-center text-xs font-bold uppercase text-slate-500">
            <span>Response Coder</span>
            <InfoTooltip text="Beam Coder<ResponseT> passed to RequestResponseIO.of(Caller, Coder<ResponseT>)." />
          </label>
          <select
            id="rrioSinkResponseCoder"
            name="responseCoder"
            value={responseCoder}
            onChange={handleChange}
            className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
          >
            {SINK_CODER_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Authentication via Secret Manager */}
      <SecretManagerAuthFields
        idPrefix="rrioSink"
        datalistId="rrio-sink-secrets-list"
        authMode={authMode}
        secretName={secretName}
        secretNameName="secretName"
        secrets={secrets}
        serviceName="Web API Sink"
        authOptions={WEB_API_SINK_AUTH_OPTIONS}
        authModeTooltip="How Caller.setup() authenticates HTTP write requests. Secret Manager resolves API keys once during SetupTeardown.setup()."
        secretNameTooltip="Secret Manager secret ID containing the API key or Bearer token."
        secretPlaceholder="e.g. webapi-write-token"
        onChange={handleChange}
      />

      {authMode === 'secretManager' && (
        <PropertyField
          id="rrioSinkAuthHeaderName"
          name="authHeaderName"
          label="Auth Header Name"
          tooltip="HTTP request header populated with the resolved secret credential (e.g. Authorization or X-API-Key)."
          value={authHeaderName}
          onChange={handleChange}
          placeholder="Authorization"
        />
      )}

      {/* Collapsible Group: Timeout, Repeater & Adaptive Throttler */}
      <details open className="rounded border border-slate-800 bg-slate-900/40 p-3">
        <summary className="cursor-pointer text-xs font-bold uppercase text-slate-400 flex items-center gap-2 select-none">
          <span>Timeout, Repeater (Retry Backoff) &amp; Adaptive Throttler</span>
          <InfoTooltip text="Configure per-call timeout (withTimeout / timeout), exponential backoff retries (withoutRepeater / ExponentialBackOffRepeater), and overload protection (DefaultThrottler)." />
        </summary>
        <div className="mt-4 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <PropertyField
              id="rrioSinkTimeout"
              name="timeout"
              label="Call Timeout Seconds (withTimeout)"
              tooltip="Maximum duration in seconds before a Caller write invocation times out with UserCodeTimeoutException (default: 30s)."
              type="number"
              min="1"
              value={timeout}
              onChange={handleChange}
              placeholder="30"
            />
            <PropertyField
              id="rrioSinkOverloadRatio"
              name="overloadRatio"
              label="Throttler Overload Ratio"
              tooltip="Target overload ratio for Python DefaultThrottler(overload_ratio=2.0) adaptive rate limiting."
              type="number"
              step="0.1"
              min="1"
              value={overloadRatio}
              onChange={handleChange}
              placeholder="2.0"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="rrioSinkEnableRepeater" className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                id="rrioSinkEnableRepeater"
                type="checkbox"
                name="enableRepeater"
                checked={enableRepeater}
                onChange={handleCheckboxChange}
                className="accent-blue-500 rounded"
              />
              <span>Enable Exponential Backoff Repeater (uncheck for .withoutRepeater() / NoOpsRepeater)</span>
              <InfoTooltip text="Retries transient HTTP 429 / 5xx and timeout errors using exponential backoff." />
            </label>

            <label htmlFor="rrioSinkEnableThrottler" className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                id="rrioSinkEnableThrottler"
                type="checkbox"
                name="enableThrottler"
                checked={enableThrottler}
                onChange={handleCheckboxChange}
                className="accent-blue-500 rounded"
              />
              <span>Enable Adaptive Client-Side Throttler (withCallShouldBackoff / DefaultThrottler)</span>
              <InfoTooltip text="Adaptively backs off outbound HTTP requests when downstream API quota errors occur." />
            </label>
          </div>
        </div>
      </details>

      {/* Collapsible Group: Redis Request-Response Cache */}
      <details open={enableCache} className="rounded border border-slate-800 bg-slate-900/40 p-3">
        <summary className="cursor-pointer text-xs font-bold uppercase text-slate-400 flex items-center gap-2 select-none">
          <span>Redis Request-Response Cache (withCache / RedisCache)</span>
          <InfoTooltip text="Optional Redis cache for deduplicating idempotent request-response writes." />
        </summary>
        <div className="mt-4 flex flex-col gap-4">
          <label htmlFor="rrioSinkEnableCache" className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
            <input
              id="rrioSinkEnableCache"
              type="checkbox"
              name="enableCache"
              checked={enableCache}
              onChange={handleCheckboxChange}
              className="accent-blue-500 rounded"
            />
            <span>Enable Redis Response Caching (withCache / RedisCache)</span>
          </label>

          {enableCache && (
            <div className="grid grid-cols-2 gap-4">
              <PropertyField
                id="rrioSinkRedisUri"
                name="redisUri"
                label="Redis URI (redisUri)"
                tooltip="Redis connection URI passed to Cache.writeUsingRedis / RedisCache (e.g. redis://localhost:6379)."
                value={redisUri}
                onChange={handleChange}
                placeholder="redis://localhost:6379"
              />
              <PropertyField
                id="rrioSinkCacheTtlSeconds"
                name="cacheTtlSeconds"
                label="Cache TTL Seconds (time_to_live)"
                tooltip="Time-to-live in seconds for cached API responses in Redis (default: 86400)."
                type="number"
                min="1"
                value={cacheTtlSeconds}
                onChange={handleChange}
                placeholder="86400"
              />
            </div>
          )}
        </div>
      </details>

      {/* Code Generation Instructions */}
      <SystemInstructionsField
        id="rrioSinkInstructions"
        value={systemInstructions}
        tooltip="Optional custom prompt instructions supplied to Gemini during pipeline code generation (e.g. handling Result.getFailures() dead-letter output)."
        placeholder="e.g. POST JSON payloads via Caller<String, String> and log ApiIOError failures from Result.getFailures()..."
        wrapperClassName="flex flex-col gap-2 pt-2 border-t border-slate-800/80"
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

export const RequestResponseIOProperties = RequestResponseIOSinkProperties;
export default RequestResponseIOSinkProperties;
