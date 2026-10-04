/**
 * DatadogIO Sink Properties Component
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Renders the property configuration panel for Apache Beam DatadogIO Sink (Writer) nodes
 * (`org.apache.beam.sdk.io.datadog.DatadogIO.writeBuilder()` / `DatadogIO.Write` in Java and
 * `apache_beam.transforms.xlang.io.DatadogWrite` in Python), which write `DatadogEvent` records
 * to a Datadog HTTP Logs Intake API endpoint.
 *
 * Architectural Decisions:
 * - Implements ONLY the Sink direction (`SINK:DatadogIO`), as official Apache Beam
 *   `DatadogIO` and Python `DatadogWrite` provide only a Logs API writer and no native Read transform.
 * - Requires Datadog intake `url` (`withUrl` / `url`), providing a datalist of official regional
 *   Datadog HTTP intake endpoints (US1, US3, US5, EU1, AP1, US1-FED).
 * - Uses `SecretManagerAuthFields` and `useAssetLoader('secrets')` bound to `apiKeySecret`
 *   (`withApiKey` / `api_key`) so Datadog API keys are referenced from Google Cloud Secret Manager
 *   without persisting plaintext keys in `.beam` pipeline specs.
 * - Organizes `DatadogEvent.Builder` metadata (`ddsource`, `ddtags`, `hostname`, `service`, `messageField`)
 *   and Batching & Buffer Tuning (`batchCount`, `minBatchCount`, `maxBufferSize`, `parallelism`)
 *   into collapsible parameter groups adhering to the 8pt grid system.
 */

import React from 'react';
import { InfoTooltip } from '../../components/InfoTooltip';
import { PropertyField } from '../../components/common/PropertyField';
import { SystemInstructionsField } from '../../components/common/SystemInstructionsField';
import { resolveSystemInstructions } from '../../utils/systemInstructions';
import { SecretManagerAuthFields } from '../../components/common/SecretManagerAuthFields';
import type { SecretItem, AuthModeOption } from '../../components/common/SecretManagerAuthFields';
import { useAssetLoader } from '../../hooks/useAssetLoader';

export const DATADOG_AUTH_OPTIONS: AuthModeOption[] = [
  { value: 'secretManager', label: 'Google Cloud Secret Manager (Datadog API Key)' },
  { value: 'env', label: 'Environment Variable / PipelineOptions' },
];

export const DATADOG_INTAKE_PRESETS = [
  { value: 'https://http-intake.logs.datadoghq.com', label: 'US1 (https://http-intake.logs.datadoghq.com)' },
  { value: 'https://http-intake.logs.us3.datadoghq.com', label: 'US3 (https://http-intake.logs.us3.datadoghq.com)' },
  { value: 'https://http-intake.logs.us5.datadoghq.com', label: 'US5 (https://http-intake.logs.us5.datadoghq.com)' },
  { value: 'https://http-intake.logs.datadoghq.eu', label: 'EU1 (https://http-intake.logs.datadoghq.eu)' },
  { value: 'https://http-intake.logs.ap1.datadoghq.com', label: 'AP1 (https://http-intake.logs.ap1.datadoghq.com)' },
  { value: 'https://http-intake.logs.ddog-gov.com', label: 'US1-FED (https://http-intake.logs.ddog-gov.com)' },
];

/**
 * React Flow node shape for the Datadog sink panel, including its persisted configuration data.
 */
export interface DatadogIOSinkNode {
  data: {
    label: string;
    beam_transform?: string;
    system_instructions?: string;
    special_instructions?: string;
    properties?: {
      url?: string;
      authMode?: 'secretManager' | 'env';
      apiKeySecret?: string;
      batchCount?: number | string;
      minBatchCount?: number | string;
      maxBufferSize?: number | string;
      parallelism?: number | string;
      ddsource?: string;
      ddtags?: string;
      hostname?: string;
      service?: string;
      messageField?: string;
      system_instructions?: string;
      special_instructions?: string;
      [key: string]: any;
    };
  };
}

/**
 * Props for the DatadogIOSinkProperties component.
 */
export interface DatadogIOSinkPropertiesProps {
  node: DatadogIOSinkNode;
  onChange: (properties: any) => void;
}

/**
 * DatadogIOSinkProperties component rendering the configuration form for DatadogIO Logs API writes.
 *
 * @param props Component properties containing the active node and onChange callback.
 * @returns React component.
 */
export const DatadogIOSinkProperties: React.FC<DatadogIOSinkPropertiesProps> = ({ node, onChange }) => {
  const properties = node.data.properties || {};

  // Request GCP Secret Manager secrets via shared useAssetLoader hook
  const { items: secrets } = useAssetLoader<SecretItem | string>('secrets');

  const url = properties.url || '';
  const authMode = properties.authMode || 'secretManager';
  const apiKeySecret = properties.apiKeySecret || '';
  const batchCount = properties.batchCount !== undefined ? properties.batchCount : 100;
  const minBatchCount = properties.minBatchCount ?? '';
  const maxBufferSize = properties.maxBufferSize ?? '';
  const parallelism = properties.parallelism ?? '';

  // DatadogEvent.Builder metadata mapping fields
  const ddsource = properties.ddsource || '';
  const ddtags = properties.ddtags || '';
  const hostname = properties.hostname || '';
  const service = properties.service || '';
  const messageField = properties.messageField || '';

  // Validation: Datadog intake url is required
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


  return (
    <div className="flex-1 flex flex-col gap-4">
      {/* Datadog Logs Intake URL */}
      <PropertyField
        id="datadogSinkUrl"
        name="url"
        label="Datadog Logs Intake URL (withUrl / url)"
        required="Datadog Logs Intake URL is required"
        tooltip="Datadog HTTP Logs Intake endpoint URL configured via DatadogIO.Write.withUrl(String) or Python DatadogWrite(url=...). Select a regional preset (US1, US3, US5, EU1, AP1, US1-FED) or enter a custom URL."
        value={url}
        invalid={isUrlInvalid}
        error={isUrlInvalid ? 'Datadog Logs Intake URL is required.' : null}
        onChange={handleChange}
        placeholder="https://http-intake.logs.datadoghq.com"
        list="datadog-intake-url-presets"
        datalist={DATADOG_INTAKE_PRESETS}
        helperText="Regional presets available: US1, US3, US5, EU1, AP1, US1-FED"
      />

      {/* Datadog API Key Authentication via Secret Manager */}
      <SecretManagerAuthFields
        idPrefix="datadogSink"
        datalistId="datadog-sink-secrets-list"
        authMode={authMode}
        secretName={apiKeySecret}
        secretNameName="apiKeySecret"
        secrets={secrets}
        serviceName="Datadog Logs API"
        authOptions={DATADOG_AUTH_OPTIONS}
        authModeTooltip="How the pipeline resolves the Datadog API Key (withApiKey / api_key). Secret Manager avoids storing raw keys in .beam specs."
        secretNameTooltip="Secret Manager secret ID containing the Datadog API Key passed to DatadogIO.Write.withApiKey(String)."
        secretPlaceholder="e.g. datadog-api-key"
        onChange={handleChange}
      />

      {/* Collapsible Group: DatadogEvent.Builder Metadata */}
      <details open className="rounded border border-slate-800 bg-slate-900/40 p-3">
        <summary className="cursor-pointer text-xs font-bold uppercase text-slate-400 flex items-center gap-2 select-none">
          <span>DatadogEvent Metadata (DatadogEvent.Builder)</span>
          <InfoTooltip text="Metadata attributes populated when building DatadogEvent instances prior to DatadogIO.writeBuilder()." />
        </summary>
        <div className="mt-4 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <PropertyField
              id="datadogSinkService"
              name="service"
              label="Service (withService)"
              tooltip="Application or service name attached to logs via DatadogEvent.Builder.withService(String)."
              value={service}
              onChange={handleChange}
              placeholder="e.g. payment-processor"
            />
            <PropertyField
              id="datadogSinkDdsource"
              name="ddsource"
              label="Source (withSource / ddsource)"
              tooltip="Integration or log source name via DatadogEvent.Builder.withSource(String)."
              value={ddsource}
              onChange={handleChange}
              placeholder="e.g. apache-beam"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <PropertyField
              id="datadogSinkHostname"
              name="hostname"
              label="Hostname (withHostname)"
              tooltip="Originating host name attribute via DatadogEvent.Builder.withHostname(String)."
              value={hostname}
              onChange={handleChange}
              placeholder="e.g. beam-worker-01"
            />
            <PropertyField
              id="datadogSinkDdtags"
              name="ddtags"
              label="Tags (withTags / ddtags)"
              tooltip="Comma-separated key:value tags attached via DatadogEvent.Builder.withTags(String) (e.g. env:prod,team:data)."
              value={ddtags}
              onChange={handleChange}
              placeholder="env:prod,service:beam"
            />
          </div>
          <PropertyField
            id="datadogSinkMessageField"
            name="messageField"
            label="Message Field Mapping (withMessage)"
            tooltip="Input record field or payload expression mapped to DatadogEvent.Builder.withMessage(String) (required by DatadogEvent)."
            value={messageField}
            onChange={handleChange}
            placeholder="e.g. message"
          />
        </div>
      </details>

      {/* Collapsible Group: Batching, Buffer Size & Parallelism */}
      <details open className="rounded border border-slate-800 bg-slate-900/40 p-3">
        <summary className="cursor-pointer text-xs font-bold uppercase text-slate-400 flex items-center gap-2 select-none">
          <span>Batching, Buffer Size &amp; Concurrency</span>
          <InfoTooltip text="Configure batchCount (withBatchCount), minBatchCount (writeBuilder(minBatchCount)), maxBufferSize (withMaxBufferSize), and parallelism (withParallelism)." />
        </summary>
        <div className="mt-4 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <PropertyField
              id="datadogSinkBatchCount"
              name="batchCount"
              label="Batch Count (withBatchCount)"
              tooltip="Maximum number of DatadogEvent logs batched per HTTP request via withBatchCount(Integer) / batch_count (default: 100, max: 1000)."
              type="number"
              min="1"
              max="1000"
              value={batchCount}
              onChange={handleChange}
              placeholder="100"
            />
            <PropertyField
              id="datadogSinkMinBatchCount"
              name="minBatchCount"
              label="Min Batch Count (minBatchCount)"
              tooltip="Minimum number of events buffered before flushing a batch via DatadogIO.writeBuilder(minBatchCount) / min_batch_count."
              type="number"
              min="1"
              max="1000"
              value={minBatchCount}
              onChange={handleChange}
              placeholder="e.g. 10"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <PropertyField
              id="datadogSinkMaxBufferSize"
              name="maxBufferSize"
              label="Max Buffer Size Bytes (withMaxBufferSize)"
              tooltip="Maximum payload buffer size in bytes per HTTP batch via withMaxBufferSize(Long) / max_buffer_size (up to 5242880 = 5 MB)."
              type="number"
              min="1"
              max="5242880"
              value={maxBufferSize}
              onChange={handleChange}
              placeholder="e.g. 5242880"
            />
            <PropertyField
              id="datadogSinkParallelism"
              name="parallelism"
              label="Parallelism (withParallelism)"
              tooltip="Maximum number of parallel HTTP writers via withParallelism(Integer) / parallelism."
              type="number"
              min="1"
              value={parallelism}
              onChange={handleChange}
              placeholder="e.g. 4"
            />
          </div>
        </div>
      </details>

      <SystemInstructionsField
        id="datadogSinkInstructions"
        value={systemInstructions}
        tooltip="Optional custom prompt instructions supplied to Gemini during pipeline code generation (e.g. handling PCollection<DatadogWriteError> or Python DatadogWrite xlang expansion)."
        placeholder="e.g. Format records into DatadogEvent via DatadogEvent.newBuilder() and route DatadogWriteError dead-letter records..."
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

export const DatadogIOProperties = DatadogIOSinkProperties;
export default DatadogIOSinkProperties;
