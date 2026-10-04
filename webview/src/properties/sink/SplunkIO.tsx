/**
 * SplunkIO Sink Properties Component
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Renders the property configuration panel for Apache Beam SplunkIO Sink (Writer) nodes
 * (`org.apache.beam.sdk.io.splunk.SplunkIO.write` / `SplunkIO.Write`), which write
 * `SplunkEvent` payloads to Splunk's HTTP Event Collector (HEC) endpoint.
 *
 * Architectural Decisions:
 * - Implements ONLY the Sink direction (`SINK:SplunkIO`), as official Apache Beam
 *   `SplunkIO` provides only an unbounded HEC writer (`SplunkIO.Write`) and no native Read transform.
 * - Requires HEC `url` (`withUrl`) and flags validation error / red border when empty.
 * - Uses `SecretManagerAuthFields` and `useAssetLoader('secrets')` bound to `tokenSecret`
 *   (`withToken`) so HEC authentication tokens are loaded from Google Cloud Secret Manager
 *   without persisting plaintext credentials in `.beam` pipeline files.
 * - Organizes `SplunkEvent.Builder` metadata (`index`, `source`, `sourceType`, `host`,
 *   `eventField`, `timeField`), Batching & Concurrency (`batchCount`, `parallelism`,
 *   `enableBatchLogs`, `enableGzipHttpCompression`), and TLS/SSL (`disableCertificateValidation`,
 *   `rootCaCertificatePath`) into collapsible parameter groups adhering to the 8pt grid system.
 */

import React from 'react';
import { InfoTooltip } from '../../components/InfoTooltip';
import { PropertyField } from '../../components/common/PropertyField';
import { SystemInstructionsField } from '../../components/common/SystemInstructionsField';
import { resolveSystemInstructions } from '../../utils/systemInstructions';
import { SecretManagerAuthFields } from '../../components/common/SecretManagerAuthFields';
import type { SecretItem, AuthModeOption } from '../../components/common/SecretManagerAuthFields';
import { useAssetLoader } from '../../hooks/useAssetLoader';

export const SPLUNK_AUTH_OPTIONS: AuthModeOption[] = [
  { value: 'secretManager', label: 'Google Cloud Secret Manager (HEC Token)' },
  { value: 'env', label: 'Environment Variable / PipelineOptions' },
];

/**
 * Node definition for SplunkIO sink configuration.
 */
export interface SplunkIOSinkNode {
  data: {
    label: string;
    beam_transform?: string;
    system_instructions?: string;
    special_instructions?: string;
    properties?: {
      url?: string;
      authMode?: 'secretManager' | 'env';
      tokenSecret?: string;
      batchCount?: number | string;
      parallelism?: number | string;
      disableCertificateValidation?: boolean;
      rootCaCertificatePath?: string;
      enableBatchLogs?: boolean;
      enableGzipHttpCompression?: boolean;
      index?: string;
      source?: string;
      sourceType?: string;
      host?: string;
      eventField?: string;
      timeField?: string;
      system_instructions?: string;
      special_instructions?: string;
      [key: string]: any;
    };
  };
}

/**
 * Props for the SplunkIOSinkProperties component.
 */
export interface SplunkIOSinkPropertiesProps {
  node: SplunkIOSinkNode;
  onChange: (properties: any) => void;
}

/**
 * SplunkIOSinkProperties component rendering the configuration form for SplunkIO HEC writes.
 *
 * @param props Component properties containing the active node and onChange callback.
 * @returns React component.
 */
export const SplunkIOSinkProperties: React.FC<SplunkIOSinkPropertiesProps> = ({ node, onChange }) => {
  const properties = node.data.properties || {};

  // Request GCP Secret Manager secrets dynamically via shared useAssetLoader hook
  const { items: secrets } = useAssetLoader<SecretItem | string>('secrets');

  const url = properties.url || '';
  const authMode = properties.authMode || 'secretManager';
  const tokenSecret = properties.tokenSecret || '';
  const batchCount = properties.batchCount ?? '';
  const parallelism = properties.parallelism ?? '';
  const disableCertificateValidation = Boolean(properties.disableCertificateValidation ?? false);
  const rootCaCertificatePath = properties.rootCaCertificatePath || '';
  const enableBatchLogs = Boolean(properties.enableBatchLogs ?? false);
  const enableGzipHttpCompression = properties.enableGzipHttpCompression !== undefined
    ? Boolean(properties.enableGzipHttpCompression)
    : true;

  // SplunkEvent.Builder metadata mapping fields
  const index = properties.index || '';
  const source = properties.source || '';
  const sourceType = properties.sourceType || '';
  const host = properties.host || '';
  const eventField = properties.eventField || '';
  const timeField = properties.timeField || '';

  // Validation: HEC url is required by SplunkIO.write(url, token)
  const isUrlInvalid = !url.trim();

  // System instructions text with fallback
  const systemInstructions = resolveSystemInstructions(node);

  /**
   * Handles standard text, number, and select input changes.
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
   * Handles boolean checkbox toggles for SplunkIO.Write flags.
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
      {/* Splunk HEC Endpoint URL */}
      <PropertyField
        id="splunkSinkUrl"
        name="url"
        label="Splunk HEC Endpoint URL"
        required="Splunk HEC URL is required"
        tooltip="Splunk HTTP Event Collector (HEC) endpoint URL configured via SplunkIO.Write.withUrl(String) (e.g. https://splunk-hec.example.com:8088)."
        value={url}
        invalid={isUrlInvalid}
        error={isUrlInvalid ? 'Splunk HEC Endpoint URL is required.' : null}
        onChange={handleChange}
        placeholder="https://splunk-hec.example.com:8088"
        helperText={
          <span>
            Maps to <code className="text-slate-300 bg-slate-800/60 px-1 py-0.5 rounded">SplunkIO.write(url, token)</code>
          </span>
        }
      />

      {/* HEC Token Authentication via Secret Manager */}
      <SecretManagerAuthFields
        idPrefix="splunkSink"
        datalistId="splunk-sink-secrets-list"
        authMode={authMode}
        secretName={tokenSecret}
        secretNameName="tokenSecret"
        secrets={secrets}
        serviceName="Splunk HEC"
        authOptions={SPLUNK_AUTH_OPTIONS}
        authModeTooltip="How the pipeline authenticates to Splunk HTTP Event Collector (withToken). Secret Manager avoids storing raw HEC tokens in .beam specs."
        secretNameTooltip="Secret Manager secret ID containing the Splunk HEC authentication token passed to SplunkIO.Write.withToken(ValueProvider<String>)."
        secretPlaceholder="e.g. splunk-hec-token"
        onChange={handleChange}
      />

      {/* Collapsible Group: SplunkEvent.Builder Metadata */}
      <details open className="rounded border border-slate-800 bg-slate-900/40 p-3">
        <summary className="cursor-pointer text-xs font-bold uppercase text-slate-400 flex items-center gap-2 select-none">
          <span>SplunkEvent Metadata (SplunkEvent.Builder)</span>
          <InfoTooltip text="Optional metadata fields populated when constructing SplunkEvent instances prior to SplunkIO.write()." />
        </summary>
        <div className="mt-4 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <PropertyField
              id="splunkSinkIndex"
              name="index"
              label="Index (withIndex)"
              tooltip="Target Splunk index for events via SplunkEvent.Builder.withIndex(String)."
              value={index}
              onChange={handleChange}
              placeholder="e.g. main"
            />
            <PropertyField
              id="splunkSinkSourceType"
              name="sourceType"
              label="Source Type (withSourceType)"
              tooltip="Splunk sourcetype metadata field via SplunkEvent.Builder.withSourceType(String)."
              value={sourceType}
              onChange={handleChange}
              placeholder="e.g. _json"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <PropertyField
              id="splunkSinkSource"
              name="source"
              label="Source (withSource)"
              tooltip="Splunk event source metadata via SplunkEvent.Builder.withSource(String)."
              value={source}
              onChange={handleChange}
              placeholder="e.g. beam-pipeline"
            />
            <PropertyField
              id="splunkSinkHost"
              name="host"
              label="Host (withHost)"
              tooltip="Host metadata attribute via SplunkEvent.Builder.withHost(String)."
              value={host}
              onChange={handleChange}
              placeholder="e.g. dataflow-worker"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <PropertyField
              id="splunkSinkEventField"
              name="eventField"
              label="Event Payload Field (withEvent)"
              tooltip="Input record field or payload mapping for SplunkEvent.Builder.withEvent(String) (required by SplunkEvent)."
              value={eventField}
              onChange={handleChange}
              placeholder="e.g. payload"
            />
            <PropertyField
              id="splunkSinkTimeField"
              name="timeField"
              label="Epoch Time Field (withTime)"
              tooltip="Optional epoch timestamp field (milliseconds/seconds) for SplunkEvent.Builder.withTime(Long)."
              value={timeField}
              onChange={handleChange}
              placeholder="e.g. timestamp"
            />
          </div>
        </div>
      </details>

      {/* Collapsible Group: Batching & HTTP Transport */}
      <details open className="rounded border border-slate-800 bg-slate-900/40 p-3">
        <summary className="cursor-pointer text-xs font-bold uppercase text-slate-400 flex items-center gap-2 select-none">
          <span>Batching, Parallelism &amp; Compression</span>
          <InfoTooltip text="Controls batch sizing, parallel HEC connections, GZIP payload compression, and batch logging on SplunkIO.Write." />
        </summary>
        <div className="mt-4 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <PropertyField
              id="splunkSinkBatchCount"
              name="batchCount"
              label="Batch Count (withBatchCount)"
              tooltip="Maximum number of SplunkEvent records batched into a single HTTP POST request via withBatchCount(Integer)."
              type="number"
              min="1"
              value={batchCount}
              onChange={handleChange}
              placeholder="e.g. 50"
            />
            <PropertyField
              id="splunkSinkParallelism"
              name="parallelism"
              label="Parallelism (withParallelism)"
              tooltip="Maximum number of parallel HTTP client threads/workers writing to Splunk HEC via withParallelism(Integer)."
              type="number"
              min="1"
              value={parallelism}
              onChange={handleChange}
              placeholder="e.g. 8"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="splunkSinkEnableGzip" className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                id="splunkSinkEnableGzip"
                type="checkbox"
                name="enableGzipHttpCompression"
                checked={enableGzipHttpCompression}
                onChange={handleCheckboxChange}
                className="accent-blue-500 rounded"
              />
              <span>Enable GZIP HTTP Compression (withEnableGzipHttpCompression)</span>
              <InfoTooltip text="Compresses batched HTTP payloads using GZIP before sending to Splunk HEC (default: true)." />
            </label>

            <label htmlFor="splunkSinkEnableBatchLogs" className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                id="splunkSinkEnableBatchLogs"
                type="checkbox"
                name="enableBatchLogs"
                checked={enableBatchLogs}
                onChange={handleCheckboxChange}
                className="accent-blue-500 rounded"
              />
              <span>Enable Batch Logs (withEnableBatchLogs)</span>
              <InfoTooltip text="Enables detailed worker logging for each HEC batch submission via withEnableBatchLogs(Boolean)." />
            </label>
          </div>
        </div>
      </details>

      {/* Collapsible Group: TLS / Certificate Validation */}
      <details className="rounded border border-slate-800 bg-slate-900/40 p-3">
        <summary className="cursor-pointer text-xs font-bold uppercase text-slate-400 flex items-center gap-2 select-none">
          <span>TLS / SSL Certificate Configuration</span>
          <InfoTooltip text="Configure custom Root CA certificates or disable SSL certificate validation for self-signed Splunk HEC endpoints." />
        </summary>
        <div className="mt-4 flex flex-col gap-4">
          <PropertyField
            id="splunkSinkRootCaPath"
            name="rootCaCertificatePath"
            label="Root CA Certificate Path (withRootCaCertificatePath)"
            tooltip="GCS or local file path to a custom Root CA certificate in PEM format via withRootCaCertificatePath(String)."
            value={rootCaCertificatePath}
            onChange={handleChange}
            placeholder="gs://my-bucket/certs/splunk-root-ca.pem"
          />

          <label htmlFor="splunkSinkDisableCertValidation" className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
            <input
              id="splunkSinkDisableCertValidation"
              type="checkbox"
              name="disableCertificateValidation"
              checked={disableCertificateValidation}
              onChange={handleCheckboxChange}
              className="accent-blue-500 rounded"
            />
            <span>Disable Certificate Validation (withDisableCertificateValidation)</span>
            <InfoTooltip text="Disables SSL certificate verification via withDisableCertificateValidation(Boolean). Use only for testing with self-signed HEC certificates." />
          </label>
        </div>
      </details>

      {/* Code Generation Instructions */}
      <SystemInstructionsField
        id="splunkSinkInstructions"
        value={systemInstructions}
        tooltip="Optional custom prompt instructions supplied to Gemini during pipeline code generation (e.g. handling PCollection<SplunkWriteError> dead-letter output)."
        placeholder="e.g. Convert JSON strings to SplunkEvent via SplunkEvent.newBuilder() and route SplunkWriteError dead-letter records..."
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

export const SplunkIOProperties = SplunkIOSinkProperties;
export default SplunkIOSinkProperties;
