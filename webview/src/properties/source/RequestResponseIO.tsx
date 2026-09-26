/**
 * RequestResponseIO (Web APIs) Source Properties Component
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Renders the property configuration panel for Apache Beam RequestResponseIO Source (Reader) nodes
 * (`org.apache.beam.io.requestresponse.RequestResponseIO` in Java and
 * `apache_beam.io.requestresponse.RequestResponseIO` in Python), which read from and enrich
 * streams via synchronous HTTP/RPC Web API calls (`Caller`).
 *
 * Architectural Decisions:
 * - Implements the documented `RequestResponseIO` parameters across both Java (`Caller`,
 *   `withTimeout`, `withoutRepeater`, `withCache`, `withCallShouldBackoff`) and Python
 *   (`Caller`, `timeout`, `ExponentialBackOffRepeater`/`NoOpsRepeater`, `DefaultThrottler`, `RedisCache`).
 * - Requires `endpointUrl` (Caller Web API URL) and highlights invalid state when empty.
 * - Uses `SecretManagerAuthFields` and `useAssetLoader('secrets')` bound to `secretName`
 *   so API tokens / Bearer keys are fetched from Google Cloud Secret Manager without storing plaintext credentials.
 * - Organizes Timeout/Repeater/Throttler (`timeout`, `enableRepeater`, `enableThrottler`, `overloadRatio`)
 *   and Redis Request-Response Cache (`enableCache`, `redisUri`, `cacheTtlSeconds`) into collapsible groups.
 */

import React from 'react';
import { InfoTooltip } from '../../components/InfoTooltip';
import { PropertyField } from '../../components/common/PropertyField';
import { SecretManagerAuthFields } from '../../components/common/SecretManagerAuthFields';
import type { SecretItem, AuthModeOption } from '../../components/common/SecretManagerAuthFields';
import { useAssetLoader } from '../../hooks/useAssetLoader';

export const WEB_API_AUTH_OPTIONS: AuthModeOption[] = [
  { value: 'secretManager', label: 'Google Cloud Secret Manager (Bearer / API Key)' },
  { value: 'none', label: 'No Authentication / Public Endpoint' },
];

export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;

export const CODER_OPTIONS = [
  { value: 'JsonUtf8Coder', label: 'JsonUtf8Coder (JSON Payload)' },
  { value: 'StringUtf8Coder', label: 'StringUtf8Coder (UTF-8 String)' },
  { value: 'RowCoder', label: 'RowCoder (Beam Schema Row)' },
  { value: 'SerializableCoder', label: 'SerializableCoder (Java POJO / Python Pickle)' },
];

export interface RequestResponseIOSourceNode {
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

export interface RequestResponseIOSourcePropertiesProps {
  node: RequestResponseIOSourceNode;
  onChange: (properties: any) => void;
}

/**
 * RequestResponseIOSourceProperties component rendering the configuration form for RequestResponseIO Web API reads.
 *
 * @param props Component properties containing the active node and onChange callback.
 * @returns React component.
 */
export const RequestResponseIOSourceProperties: React.FC<RequestResponseIOSourcePropertiesProps> = ({ node, onChange }) => {
  const properties = node.data.properties || {};

  // Request GCP Secret Manager secrets via shared useAssetLoader hook
  const { items: secrets } = useAssetLoader<SecretItem | string>('secrets');

  const endpointUrl = properties.endpointUrl || '';
  const httpMethod = properties.httpMethod || 'GET';
  const requestCoder = properties.requestCoder || 'StringUtf8Coder';
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

  // Validation: endpointUrl is required for Caller implementation
  const isEndpointInvalid = !endpointUrl.trim();

  // System instructions text with fallback
  const systemInstructions =
    node.data.system_instructions ??
    node.data.special_instructions ??
    properties.system_instructions ??
    properties.special_instructions ??
    '';

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

  /**
   * Handles code generation instructions textarea change.
   */
  const handleInstructionsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange({
      ...properties,
      system_instructions: e.target.value,
    });
  };

  return (
    <div className="flex-1 flex flex-col gap-4">
      {/* Caller Web API Endpoint URL */}
      <PropertyField
        id="rrioSourceEndpointUrl"
        name="endpointUrl"
        label="Web API Endpoint URL (Caller)"
        required="Web API Endpoint URL is required"
        tooltip="Target HTTP/REST API URL invoked by the RequestResponseIO Caller implementation (e.g. https://api.example.com/v1/items)."
        value={endpointUrl}
        invalid={isEndpointInvalid}
        error={isEndpointInvalid ? 'Web API Endpoint URL is required.' : null}
        onChange={handleChange}
        placeholder="https://api.example.com/v1/items"
      />

      {/* HTTP Method & Coders */}
      <div className="grid grid-cols-3 gap-4">
        <div className="flex flex-col gap-2">
          <label htmlFor="rrioSourceHttpMethod" className="flex items-center text-xs font-bold uppercase text-slate-500">
            <span>HTTP Method</span>
            <InfoTooltip text="HTTP verb executed inside Caller.call(RequestT) when reading from the Web API." />
          </label>
          <select
            id="rrioSourceHttpMethod"
            name="httpMethod"
            value={httpMethod}
            onChange={handleChange}
            className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500 font-mono"
          >
            {HTTP_METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="rrioSourceRequestCoder" className="flex items-center text-xs font-bold uppercase text-slate-500">
            <span>Request Coder</span>
            <InfoTooltip text="Beam Coder<RequestT> for input request elements." />
          </label>
          <select
            id="rrioSourceRequestCoder"
            name="requestCoder"
            value={requestCoder}
            onChange={handleChange}
            className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
          >
            {CODER_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="rrioSourceResponseCoder" className="flex items-center text-xs font-bold uppercase text-slate-500">
            <span>Response Coder</span>
            <InfoTooltip text="Beam Coder<ResponseT> passed to RequestResponseIO.of(Caller, Coder<ResponseT>)." />
          </label>
          <select
            id="rrioSourceResponseCoder"
            name="responseCoder"
            value={responseCoder}
            onChange={handleChange}
            className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
          >
            {CODER_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Authentication via Secret Manager */}
      <SecretManagerAuthFields
        idPrefix="rrioSource"
        datalistId="rrio-source-secrets-list"
        authMode={authMode}
        secretName={secretName}
        secretNameName="secretName"
        secrets={secrets}
        serviceName="Web API"
        authOptions={WEB_API_AUTH_OPTIONS}
        authModeTooltip="How Caller.setup() authenticates HTTP requests. Secret Manager loads API tokens once during SetupTeardown.setup()."
        secretNameTooltip="Secret Manager secret ID containing the API token or Bearer credential."
        secretPlaceholder="e.g. webapi-bearer-token"
        onChange={handleChange}
      />

      {authMode === 'secretManager' && (
        <PropertyField
          id="rrioSourceAuthHeaderName"
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
          <InfoTooltip text="Configure per-call timeout (withTimeout / timeout), exponential backoff retries (withoutRepeater / ExponentialBackOffRepeater), and overload throttling (DefaultThrottler)." />
        </summary>
        <div className="mt-4 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <PropertyField
              id="rrioSourceTimeout"
              name="timeout"
              label="Call Timeout Seconds (withTimeout)"
              tooltip="Maximum duration in seconds before a Caller invocation times out with UserCodeTimeoutException (default: 30s)."
              type="number"
              min="1"
              value={timeout}
              onChange={handleChange}
              placeholder="30"
            />
            <PropertyField
              id="rrioSourceOverloadRatio"
              name="overloadRatio"
              label="Throttler Overload Ratio"
              tooltip="Target overload ratio for Python DefaultThrottler(overload_ratio=2.0) adaptive client-side rate limiting."
              type="number"
              step="0.1"
              min="1"
              value={overloadRatio}
              onChange={handleChange}
              placeholder="2.0"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="rrioSourceEnableRepeater" className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                id="rrioSourceEnableRepeater"
                type="checkbox"
                name="enableRepeater"
                checked={enableRepeater}
                onChange={handleCheckboxChange}
                className="accent-blue-500 rounded"
              />
              <span>Enable Exponential Backoff Repeater (uncheck for .withoutRepeater() / NoOpsRepeater)</span>
              <InfoTooltip text="Retries repeatable errors (UserCodeQuotaException, HTTP 429, UserCodeTimeoutException). When unchecked, emits .withoutRepeater() in Java or NoOpsRepeater() in Python." />
            </label>

            <label htmlFor="rrioSourceEnableThrottler" className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                id="rrioSourceEnableThrottler"
                type="checkbox"
                name="enableThrottler"
                checked={enableThrottler}
                onChange={handleCheckboxChange}
                className="accent-blue-500 rounded"
              />
              <span>Enable Adaptive Client-Side Throttler (withCallShouldBackoff / DefaultThrottler)</span>
              <InfoTooltip text="Prevents Web API overload by throttling requests when remote quota or rate-limit errors rise." />
            </label>
          </div>
        </div>
      </details>

      {/* Collapsible Group: Redis Request-Response Cache */}
      <details open={enableCache} className="rounded border border-slate-800 bg-slate-900/40 p-3">
        <summary className="cursor-pointer text-xs font-bold uppercase text-slate-400 flex items-center gap-2 select-none">
          <span>Redis Request-Response Cache (withCache / RedisCache)</span>
          <InfoTooltip text="Optional Redis cache storing request-response pairs via Cache.readUsingRedis / RedisCache(host, port, time_to_live)." />
        </summary>
        <div className="mt-4 flex flex-col gap-4">
          <label htmlFor="rrioSourceEnableCache" className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
            <input
              id="rrioSourceEnableCache"
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
                id="rrioSourceRedisUri"
                name="redisUri"
                label="Redis URI (redisUri)"
                tooltip="Redis connection URI passed to Cache.readUsingRedis / RedisCache (e.g. redis://localhost:6379)."
                value={redisUri}
                onChange={handleChange}
                placeholder="redis://localhost:6379"
              />
              <PropertyField
                id="rrioSourceCacheTtlSeconds"
                name="cacheTtlSeconds"
                label="Cache TTL Seconds (time_to_live)"
                tooltip="Time-to-live in seconds for cached API responses in Redis (default: 86400 = 24 hours)."
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

      {/* Spacer to push instructions to the bottom */}
      <div className="flex-1 min-h-[16px]" />

      {/* Code Generation Instructions */}
      <div className="flex flex-col gap-2 pt-2 border-t border-slate-800/80">
        <label htmlFor="rrioSourceInstructions" className="flex items-center text-xs font-bold uppercase text-slate-500">
          <span>Code Generation Instructions</span>
          <InfoTooltip text="Optional custom prompt instructions supplied to Gemini during pipeline code generation (e.g. routing Result.getResponses() and Result.getFailures() PCollection<ApiIOError>)." />
        </label>
        <textarea
          id="rrioSourceInstructions"
          rows={3}
          value={systemInstructions}
          onChange={handleInstructionsChange}
          placeholder="e.g. Implement Caller<String, String> with SetupTeardown and route Result.getFailures() to dead-letter log..."
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500 font-mono resize-y"
        />
      </div>
    </div>
  );
};

export const RequestResponseIOProperties = RequestResponseIOSourceProperties;
export default RequestResponseIOSourceProperties;
