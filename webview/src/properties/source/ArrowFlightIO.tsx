/**
 * ArrowFlightIOSourceProperties Component
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Renders the property configuration panel for Apache Arrow Flight source nodes (ArrowFlightIO.read()).
 * Connects to an Arrow Flight server, submits a command/query, and produces a PCollection<Row> with
 * an automatically inferred Beam Schema from the Flight stream descriptor.
 *
 * Architectural Decisions:
 * - Direct mapping to org.apache.beam.sdk.io.arrowflight.ArrowFlightIO.read().
 * - Real builder methods: withHost(String), withPort(int), withUseTls(boolean), withCommand(String), withToken(byte[]).
 * - Controlled inputs with "props in, events up" dispatch pattern.
 * - Dynamic IPC integration: listens for 'secretsLoaded' responses and issues 'getSecrets' command to extension host.
 * - Secret normalization supporting both string paths and SecretItem objects with dedicated datalist 'arrowflight-source-secret-options'.
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

export interface ArrowFlightIOSourcePropertiesProps {
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
        command?: string;
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

export const ArrowFlightIOSourceProperties: React.FC<ArrowFlightIOSourcePropertiesProps> = ({
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
  const command = props.command ?? '';
  const authMode = (props.authMode as ArrowFlightAuthMode) ?? 'none';
  const tokenSecret = props.tokenSecret ?? '';
  const instructions = props.system_instructions ?? props.special_instructions ?? node.data?.system_instructions ?? node.data?.special_instructions ?? '';

  const isHostEmpty = !host || host.trim() === '';
  const isCommandEmpty = !command || command.trim() === '';

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    let nextValue: any = value;

    if (type === 'checkbox') {
      nextValue = (e.target as HTMLInputElement).checked;
    } else if (name === 'port') {
      nextValue = value === '' ? '' : Number(value);
    }

    onChange({
      ...props,
      [name]: nextValue
    });
  };

  return (
    <div className="flex flex-col gap-4 text-xs text-[var(--vscode-foreground)] p-1">
      {/* Connection Card */}
      <div className="flex flex-col gap-3 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
        <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          <span>Flight Server Connection</span>
          <InfoTooltip text="Configures connection to the Apache Arrow Flight RPC server (.withHost, .withPort, .withUseTls)." />
        </label>

        <PropertyField
          id="flightSourceHost"
          name="host"
          label="Server Host"
          tooltip="Hostname or IP address of the Apache Arrow Flight server (.withHost(String))."
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
            id="flightSourcePort"
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
                id="flightSourceUseTls"
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

      {/* Command Card */}
      <div className="flex flex-col gap-3 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
        <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          <span>Flight Command / Query</span>
          <InfoTooltip text="The command or SQL query string requested from the Flight server (.withCommand(String))." />
        </label>

        <PropertyField
          id="flightSourceCommand"
          name="command"
          label="Command / Query"
          type="textarea"
          rows={3}
          tooltip="SQL query, table name, or serialized Flight command string passed to .withCommand(String)."
          required="Flight command is required"
          value={command}
          invalid={isCommandEmpty}
          error={isCommandEmpty ? 'Flight command is required' : null}
          placeholder="SELECT * FROM telemetry_stream"
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
          <label htmlFor="flightSourceAuthMode" className="flex items-center text-xs font-bold uppercase text-slate-500">
            <span>Authentication Mode</span>
            <InfoTooltip text="Select whether to connect unauthenticated or supply a bearer token from Secret Manager." />
          </label>
          <select
            id="flightSourceAuthMode"
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
            id="flightSourceTokenSecret"
            name="tokenSecret"
            label="Bearer Token Secret"
            tooltip="Secret Manager reference containing the Arrow Flight bearer auth token (.withToken(byte[]))."
            value={tokenSecret}
            list="arrowflight-source-secret-options"
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

      {/* System / Special Instructions Card */}
      <div className="flex flex-col gap-3 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
        <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          <span>Code Generation Instructions</span>
          <InfoTooltip text="Instructions passed to the code generator for constructing the ArrowFlightIO.read() transform." />
        </label>
        <PropertyField
          id="flightSourceInstructions"
          name="system_instructions"
          label="System Instructions"
          type="textarea"
          rows={3}
          tooltip="Custom prompt instructions passed to the LLM when synthesizing the Beam pipeline."
          value={instructions}
          placeholder="e.g., Read from Arrow Flight server using ArrowFlightIO.read().withHost(...).withCommand(...) producing PCollection<Row>"
          onChange={handleInputChange}
          mono={true}
        />
      </div>
    </div>
  );
};
