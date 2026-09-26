/**
 * RabbitMqConnectionFields Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Shared connection and authentication configuration block for RabbitMQ source and sink transforms.
 * Captures broker host, port, virtual host, TLS encryption, and secure credentials via GCP Secret Manager
 * without storing plaintext passwords in pipeline definitions.
 * 
 * Architectural Decisions:
 * - Extracted from RabbitMqIOSourceProperties and RabbitMqIOSinkProperties to enforce DRY standards
 *   and keep property panel sizes well under the repository threshold.
 * - Pure presentational component ("props in, events up"): owns no form state and executes no
 *   window message listeners or vscode.postMessage calls directly.
 * - Connection URI security: RabbitMqIO embeds credentials in the connection URI (amqp://user:pass@host:5672/vhost).
 *   Separating host, port, vhost, username, and secretName ensures no plaintext password is ever persisted
 *   in the .beam pipeline specification. Runtime code constructs the URI dynamically from Secret Manager.
 * - Verbatim Tailwind styling and 8pt grid alignment ensures pixel-perfect UI consistency across source and sink.
 */

import React from 'react';
import { Server, Key, Lock, RefreshCw } from 'lucide-react';
import { InfoTooltip } from '../../InfoTooltip';
import { PropertyField } from '../PropertyField';

export interface SecretItem {
  name: string;
  fullName?: string;
  value: string;
  id?: string;
  [key: string]: any;
}

export interface ComputeInstanceItem {
  name: string;
  status: string;
  internalIp: string;
  externalIp: string;
  host?: string;
  region?: string;
}

export interface RabbitMqConnectionFieldsProps {
  /** Prefix for stable element IDs, e.g. 'rabbitmq-source' or 'rabbitmq-sink'. */
  idPrefix: string;
  /** RabbitMQ broker hostname or IP address. */
  host: string;
  /** AMQP/AMQPS port. */
  port: number | string;
  /** RabbitMQ virtual host (/vhost). */
  virtualHost: string;
  /** Whether TLS/SSL (amqps://) is enabled. */
  useTls: boolean;
  /** RabbitMQ username. */
  username: string;
  /** Selected or typed GCP Secret Manager secret name. */
  secretName: string;
  /** Discovered secrets list from GCP Secret Manager. */
  secrets?: SecretItem[];
  /** Discovered Compute Engine instances for broker VM suggestions. */
  instances?: ComputeInstanceItem[];
  /** Secret Manager loading or retrieval error message. */
  secretError?: string | null;
  /** Compute Engine instance retrieval error message. */
  instanceError?: string | null;
  /** Loading indicator flag for Secret Manager refresh. */
  isLoadingSecrets?: boolean;
  /** Refresh callback requesting Secret Manager reload from extension host. */
  onRefreshSecrets: () => void;
  /** Callback when user clicks a discovered VM IP suggestion pill. */
  onSelectInstanceIp: (ip: string) => void;
  /** Change event handler dispatched for input, select, and checkbox fields. */
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}

/**
 * Renders the RabbitMQ connection settings and credentials configuration block.
 * 
 * @param props Connection properties, discovered resources, and upward event callbacks.
 * @returns React functional component.
 */
export const RabbitMqConnectionFields: React.FC<RabbitMqConnectionFieldsProps> = ({
  idPrefix,
  host,
  port,
  virtualHost,
  useTls,
  username,
  secretName,
  secrets = [],
  instances = [],
  secretError = null,
  instanceError = null,
  isLoadingSecrets = false,
  onRefreshSecrets,
  onSelectInstanceIp,
  onChange
}) => {
  const hostId = `${idPrefix}-host`;
  const instancesListId = `${idPrefix}-instances-list`;
  const portId = `${idPrefix}-port`;
  const vhostId = `${idPrefix}-vhost`;
  const tlsId = `${idPrefix}-tls`;
  const usernameId = `${idPrefix}-username`;
  const secretNameId = `${idPrefix}-secret-name`;
  const secretsListId = `${idPrefix}-secrets-list`;

  const isHostMissing = !host.trim();
  const secretOptions = secrets.map((s) => ({ value: s.name, label: s.name }));

  return (
    <>
      {/* 1. Broker Connection & Network */}
      <div className="flex flex-col gap-2">
        <PropertyField
          id={hostId}
          name="host"
          label="Broker Host"
          required="Broker host is required."
          tooltip="Hostname or IP address for the RabbitMQ cluster (e.g. localhost, rabbitmq.internal). Used to construct the AMQP connection URI for RabbitMqIO."
          aria-required="true"
          aria-invalid={isHostMissing || !!instanceError}
          value={host}
          onChange={onChange}
          placeholder="localhost"
          error={isHostMissing ? 'Broker host is required.' : instanceError}
          invalid={isHostMissing || !!instanceError}
          mono={true}
          list={instancesListId}
          datalist={instances.map((inst) => ({
            value: inst.host || inst.internalIp || inst.externalIp || inst.name,
            label: inst.region ? `${inst.name} (${inst.region})` : inst.status ? `${inst.name} (${inst.status})` : inst.name
          }))}
        />

        {/* Compute Engine Instance Suggestions */}
        {instances.length > 0 && (
          <div className="p-2 bg-[#252836]/60 rounded border border-slate-700/80 space-y-1">
            <div className="flex items-center gap-1 text-xs text-slate-400">
              <Server size={12} />
              <span>Discovered GCP Compute VMs:</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {instances.map((inst) => {
                const targetIp = inst.internalIp || inst.externalIp;
                if (!targetIp) return null;
                return (
                  <button
                    key={inst.name}
                    type="button"
                    onClick={() => onSelectInstanceIp(targetIp)}
                    className="px-1.5 py-0.5 rounded text-[10px] bg-slate-700 text-slate-200 hover:bg-slate-600 transition-colors"
                    title={`Use IP ${targetIp} for VM ${inst.name} (${inst.status})`}
                  >
                    {inst.name} ({targetIp})
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <PropertyField
            id={portId}
            name="port"
            type="number"
            min="1"
            max="65535"
            label="Port"
            tooltip="RabbitMQ AMQP broker port. Standard unencrypted AMQP port is 5672; TLS-encrypted AMQPS port is 5671."
            value={port}
            onChange={onChange}
            placeholder={useTls ? '5671' : '5672'}
            mono={true}
          />
          <PropertyField
            id={vhostId}
            name="virtualHost"
            label="Virtual Host"
            tooltip="RabbitMQ virtual host (/vhost) providing logical multi-tenant isolation. Default is '/'."
            value={virtualHost}
            onChange={onChange}
            placeholder="/"
            mono={true}
          />
        </div>

        <div className="p-2.5 rounded bg-[#252836]/40 border border-slate-700/60">
          <label htmlFor={tlsId} className="flex items-start gap-2.5 cursor-pointer">
            <input
              id={tlsId}
              type="checkbox"
              name="useTls"
              checked={useTls}
              onChange={onChange}
              className="mt-0.5 accent-blue-500 rounded"
            />
            <div className="flex flex-col gap-0.5">
              <span className="flex items-center text-xs font-bold text-white gap-1">
                <span>Use TLS / SSL (amqps://)</span>
                <InfoTooltip
                  text="Connect to RabbitMQ using secure AMQPS protocol (default port 5671). When enabled, changes URI scheme to amqps://."
                  position="auto"
                />
              </span>
              <p className="text-xs text-slate-400">
                Encrypts broker communication with TLS. Switches default port to 5671.
              </p>
            </div>
          </label>
        </div>
      </div>

      {/* 2. Authentication & Credentials */}
      <div className="p-3 bg-[#252836]/60 rounded border border-slate-700 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="flex items-center text-xs font-bold uppercase text-slate-400 gap-1.5">
            <Lock size={12} className="text-blue-400" />
            <span>Authentication & Credentials</span>
          </span>
        </div>

        <p className="text-xs text-slate-400">
          RabbitMQ broker credentials are authenticated via Google Cloud Secret Manager. Generated pipeline code resolves the username and secret to construct connection URIs without storing passwords in the pipeline definition.
        </p>

        {/* Username via Secret Manager */}
        <PropertyField
          id={usernameId}
          name="username"
          label="Username (Secret Manager)"
          tooltip="Select a secret from Google Cloud Secret Manager containing the RabbitMQ user account for authentication."
          value={username}
          onChange={onChange}
          placeholder="e.g. rabbitmq-broker-username"
          datalist={secretOptions}
          loading={isLoadingSecrets}
          mono={true}
        />

        {/* Secret Manager Secret */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor={secretNameId} className="flex items-center text-xs font-bold uppercase text-slate-500 gap-1">
              <Key size={12} />
              <span>GCP Secret Manager Secret</span>
              <InfoTooltip
                text="Select a secret from Google Cloud Secret Manager to provide RabbitMQ credentials securely without hardcoding plaintext passwords."
                position="auto"
              />
            </label>
            <button
              type="button"
              onClick={onRefreshSecrets}
              disabled={isLoadingSecrets}
              className="text-xs text-blue-400 hover:underline flex items-center gap-1"
              title="Refresh secrets from Secret Manager"
            >
              <RefreshCw size={11} className={isLoadingSecrets ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
          </div>

          <PropertyField
            id={secretNameId}
            name="secretName"
            value={secretName}
            onChange={onChange}
            placeholder="e.g. rabbitmq-broker-password"
            list={secretsListId}
            datalist={secretOptions}
            loading={isLoadingSecrets}
            error={secretError}
            invalid={!!secretError}
            helperText={
              secrets.length > 0
                ? 'Select from discovered secrets or type a custom secret ID.'
                : 'No secrets automatically loaded. Enter secret resource name directly.'
            }
            mono={true}
          />
        </div>
      </div>
    </>
  );
};
