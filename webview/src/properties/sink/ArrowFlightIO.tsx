/**
 * ArrowFlightIOSinkProperties Component
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Renders the property configuration panel for Apache Arrow Flight sink nodes (ArrowFlightIO.write()).
 * Buffers incoming PCollection<Row> records into Arrow record batches and writes them to an Arrow Flight
 * server using FlightClient.startPut(FlightDescriptor.path(descriptor)).
 *
 * Architectural Decisions:
 * - Direct mapping to org.apache.beam.sdk.io.arrowflight.ArrowFlightIO.write().
 * - Real builder methods: withHost(String), withPort(int), withUseTls(boolean), withDescriptor(String),
 *   withBatchSize(int), withToken(byte[]).
 * - Controlled inputs with "props in, events up" dispatch pattern.
 * - Dynamic IPC integration: listens for 'secretsLoaded' responses and issues 'getSecrets' command to extension host.
 * - Secret normalization with dedicated datalist 'arrowflight-sink-secret-options'.
 * - Preserves system_instructions / special_instructions fallback chain for LLM code generation.
 * - Uses standardized PropertyField components conforming to 8pt grid and theme styling.
 */

import React from 'react';
import { InfoTooltip } from '../../components/InfoTooltip';
import { PropertyField } from '../../components/common/PropertyField';
import { normalizeSecretItem } from '../../components/common/SecretManagerAuthFields';
import type { SecretItem } from '../../components/common/SecretManagerAuthFields';
import { useAssetLoader } from '../../hooks/useAssetLoader';

export type ArrowFlightAuthMode = 'none' | 'secret_manager';

export interface ArrowFlightIOSinkPropertiesProps {
  node: {
    data: {
      label?: string;
      beam_transform?: string;
      system_instructions?: string;
      special_instructions?: string;
      properties?: {
        host?: string;
        port?: number | string;
        useTls?: boolean;
        descriptor?: string;
        batchSize?: number | string;
        authMode?: ArrowFlightAuthMode | string;
        tokenSecret?: string;
        system_instructions?: string;
        special_instructions?: string;
        [key: string]: any;
      };
    };
  };
  onChange: (properties: any) => void;
}

export const ArrowFlightIOSinkProperties: React.FC<ArrowFlightIOSinkPropertiesProps> = ({
  node,
  onChange
}) => {
  // NOTE: Request Secret Manager secrets via useAssetLoader hook
  const { items: rawSecrets, error: secretError, loading: secretsLoading } = useAssetLoader<SecretItem | string>('secrets');
  const normalizedSecrets = (rawSecrets || []).map(normalizeSecretItem);
  const secretOptions = normalizedSecrets.map((s) => ({ value: s.id, label: s.name }));

  const props = node.data?.properties || {};

  const host = props.host ?? '';
  const port = props.port ?? 47470;
  const useTls = props.useTls === true;
  const descriptor = props.descriptor ?? '';
  const batchSize = props.batchSize ?? 1024;
  const authMode = (props.authMode as ArrowFlightAuthMode) ?? 'none';
  const tokenSecret = props.tokenSecret ?? '';
  const instructions = props.system_instructions ?? props.special_instructions ?? node.data?.system_instructions ?? node.data?.special_instructions ?? '';

  const isHostEmpty = !host || host.trim() === '';
  const isDescriptorEmpty = !descriptor || descriptor.trim() === '';

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    let nextValue: any = value;

    if (type === 'checkbox') {
      nextValue = (e.target as HTMLInputElement).checked;
    } else if (name === 'port' || name === 'batchSize') {
      nextValue = value === '' ? '' : Number(value);
    }

    onChange({
      ...props,
      [name]: nextValue
    });
  };

  return (
    <div className="flex flex-col gap-4 text-xs text-[var(--vscode-foreground)] p-1">
      {/* Target Server Card */}
      <div className="flex flex-col gap-3 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
        <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          <span>Flight Server Connection</span>
          <InfoTooltip text="Configures connection to the Apache Arrow Flight RPC server (.withHost, .withPort, .withUseTls)." />
        </label>

        <PropertyField
          id="flightSinkHost"
          name="host"
          label="Server Host"
          tooltip="Hostname or IP address of the target Apache Arrow Flight server (.withHost(String))."
          required="Server host is required"
          value={host}
          invalid={isHostEmpty}
          error={isHostEmpty ? 'Server host is required' : null}
          placeholder="flight.example.com"
          onChange={handleInputChange}
          mono={true}
        />

        <div className="grid grid-cols-2 gap-3">
          <PropertyField
            id="flightSinkPort"
            name="port"
            label="Port"
            type="number"
            tooltip="Port number of the Apache Arrow Flight service (.withPort(int), default 47470)."
            value={port}
            placeholder="47470"
            onChange={handleInputChange}
            mono={true}
          />

          <div className="flex flex-col justify-end pb-1.5">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                id="flightSinkUseTls"
                type="checkbox"
                name="useTls"
                checked={useTls}
                onChange={handleInputChange}
                aria-label="Enable TLS"
                className="rounded bg-[var(--vscode-input-background)] border-[var(--vscode-input-border)]"
              />
              <span className="text-xs">Enable TLS</span>
              <InfoTooltip text="Enables TLS encryption for the gRPC connection (.withUseTls(boolean))." />
            </label>
          </div>
        </div>
      </div>

      {/* Target Descriptor Card */}
      <div className="flex flex-col gap-3 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
        <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          <span>Target Dataset Descriptor</span>
          <InfoTooltip text="The dataset descriptor / table name where rows are written (.withDescriptor(String))." />
        </label>

        <PropertyField
          id="flightSinkDescriptor"
          name="descriptor"
          label="Descriptor / Table Name"
          tooltip="Destination dataset path or descriptor string passed to .withDescriptor(String)."
          required="Flight descriptor is required"
          value={descriptor}
          invalid={isDescriptorEmpty}
          error={isDescriptorEmpty ? 'Flight descriptor is required' : null}
          placeholder="telemetry_output_dataset"
          onChange={handleInputChange}
          mono={true}
        />

        <PropertyField
          id="flightSinkBatchSize"
          name="batchSize"
          label="Batch Size (Rows)"
          type="number"
          tooltip="Number of rows buffered before flushing an Arrow record batch (.withBatchSize(int), default 1024)."
          value={batchSize}
          placeholder="1024"
          onChange={handleInputChange}
          mono={true}
        />
      </div>

      {/* Authentication Card */}
      <div className="flex flex-col gap-3 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
        <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          <span>Authentication</span>
          <InfoTooltip text="Configures bearer token authentication (.withToken(byte[]))." />
        </label>

        <div className="flex flex-col gap-1">
          <label htmlFor="flightSinkAuthMode" className="flex items-center text-xs font-bold uppercase text-slate-500">
            <span>Authentication Mode</span>
            <InfoTooltip text="Select whether to connect unauthenticated or supply a bearer token from Secret Manager." />
          </label>
          <select
            id="flightSinkAuthMode"
            name="authMode"
            value={authMode}
            onChange={handleInputChange}
            aria-label="Authentication Mode"
            className="w-full px-2 py-1.5 rounded bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)] focus:outline-none focus:border-[var(--vscode-focusBorder)] text-xs"
          >
            <option value="none">None (Plain / Anonymous)</option>
            <option value="secret_manager">Secret Manager (Bearer Token)</option>
          </select>
        </div>

        {authMode === 'secret_manager' && (
          <PropertyField
            id="flightSinkTokenSecret"
            name="tokenSecret"
            label="Bearer Token Secret"
            tooltip="Secret Manager reference containing the Arrow Flight bearer auth token (.withToken(byte[]))."
            value={tokenSecret}
            list="arrowflight-sink-secret-options"
            datalist={secretOptions}
            error={secretError}
            loading={secretsLoading}
            placeholder="arrow-flight-token"
            onChange={handleInputChange}
            mono={true}
            helperText={
              <span>
                Values auto-populated from{' '}
                <code className="text-slate-300 bg-slate-800/60 px-1 py-0.5 rounded">
                  gcloud secrets list
                </code>
              </span>
            }
          />
        )}
      </div>

      {/* System Instructions Card */}
      <div className="flex flex-col gap-3 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
        <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          <span>Code Generation Instructions</span>
          <InfoTooltip text="Instructions passed to the code generator for constructing the ArrowFlightIO.write() transform." />
        </label>
        <PropertyField
          id="flightSinkInstructions"
          name="system_instructions"
          label="System Instructions"
          type="textarea"
          rows={3}
          tooltip="Custom prompt instructions passed to the LLM when synthesizing the Beam pipeline."
          value={instructions}
          placeholder="e.g., Write to Arrow Flight server using ArrowFlightIO.write().withHost(...).withDescriptor(...) consuming PCollection<Row>"
          onChange={handleInputChange}
          mono={true}
        />
      </div>
    </div>
  );
};
