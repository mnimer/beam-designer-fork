/**
 * RedisIOSinkProperties Component
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Renders the property configuration panel for Apache Beam RedisIO Sink nodes
 * (org.apache.beam.sdk.io.redis.RedisIO.write() in Java SDK / cross-language in Python).
 * Supports configuring Redis write methods (APPEND, SET, LPUSH, RPUSH, SADD, PFADD, INCRBY, DECRBY, HLL),
 * key expiration TTL, key namespace prefixes, Secret Manager authentication, and advanced cluster settings.
 *
 * Architectural Decisions:
 * - Controlled inputs adhering to "props in, events up" unidirectional data flow.
 * - Dynamic discovery: Requests GCP Secret Manager secrets via 'getSecrets' IPC message to securely bind AUTH passwords.
 * - Real-time validation: Requires Redis host with validation feedback and accessible error states.
 * - Write method selector: Maps directly to RedisIO.Write.Method enum values.
 * - Collapsible Advanced Sink Settings: Organizes timeouts, cluster mode, and batch/pipeline size cleanly.
 * - Preserves system_instructions / special_instructions fallback chain for LLM pipeline code generation.
 * - Strictly follows the 8pt grid system and VS Code theme tokens with Tailwind CSS styling.
 */

import React, { useState } from 'react';
import { InfoTooltip } from '../../components/InfoTooltip';
import { PropertyField } from '../../components/common/PropertyField';
import { SystemInstructionsField } from '../../components/common/SystemInstructionsField';
import { resolveSystemInstructions } from '../../utils/systemInstructions';
import { useAssetLoader } from '../../hooks/useAssetLoader';
import { normalizeSecretItem } from '../../components/common/SecretManagerAuthFields';
import { CollapsibleSection } from '../../components/common/CollapsibleSection';

/**
 * Secret item descriptor returned from extension host discovery.
 */
export interface SecretItem {
  id: string;
  name: string;
  fullName?: string;
}

/**
 * Supported Redis write methods corresponding to RedisIO.Write.Method enum.
 */
export const REDIS_WRITE_METHODS = [
  { value: 'SET', label: 'SET — Set string value of a key' },
  { value: 'APPEND', label: 'APPEND — Append value to existing string' },
  { value: 'LPUSH', label: 'LPUSH — Prepend value to a list' },
  { value: 'RPUSH', label: 'RPUSH — Append value to a list' },
  { value: 'SADD', label: 'SADD — Add member to a set' },
  { value: 'PFADD', label: 'PFADD — Add elements to HyperLogLog' },
  { value: 'INCRBY', label: 'INCRBY — Increment integer value of key' },
  { value: 'DECRBY', label: 'DECRBY — Decrement integer value of key' },
  { value: 'HLL', label: 'HLL — Merge HyperLogLog structures' }
] as const;

/**
 * Props for the RedisIOSinkProperties component.
 */
export interface RedisIOSinkPropertiesProps {
  node: {
    data: {
      label?: string;
      beam_transform?: string;
      system_instructions?: string;
      special_instructions?: string;
      properties?: {
        host?: string;
        port?: number | string;
        database?: number | string;
        ssl?: boolean;
        writeMethod?: 'APPEND' | 'SET' | 'LPUSH' | 'RPUSH' | 'SADD' | 'PFADD' | 'INCRBY' | 'DECRBY' | 'HLL' | string;
        expireTime?: number | string;
        keyPrefix?: string;
        authMode?: 'none' | 'secret_manager';
        authPasswordSecret?: string;
        connectionTimeout?: number | string;
        socketTimeout?: number | string;
        clusterMode?: boolean;
        batchSize?: number | string;
        system_instructions?: string;
        special_instructions?: string;
        [key: string]: any;
      };
    };
  };
  onChange: (properties: any) => void;
}

/**
 * RedisIOSinkProperties renders the configuration panel for RedisIO sink writes.
 *
 * @param props Component properties containing the active node and onChange callback
 */
export const RedisIOSinkProperties: React.FC<RedisIOSinkPropertiesProps> = ({ node, onChange }) => {
  const properties = node.data?.properties || {};

  // Form field state extracted from node properties
  const host = properties.host || '';
  const port = properties.port !== undefined && properties.port !== null ? properties.port : '';
  const database = properties.database !== undefined && properties.database !== null ? properties.database : '';
  const ssl = properties.ssl ?? false;
  const writeMethod = properties.writeMethod || 'SET';
  const expireTime = properties.expireTime !== undefined && properties.expireTime !== null ? properties.expireTime : '';
  const keyPrefix = properties.keyPrefix || '';
  const authMode = properties.authMode || 'none';
  const authPasswordSecret = properties.authPasswordSecret || '';
  const connectionTimeout = properties.connectionTimeout !== undefined && properties.connectionTimeout !== null ? properties.connectionTimeout : '';
  const socketTimeout = properties.socketTimeout !== undefined && properties.socketTimeout !== null ? properties.socketTimeout : '';
  const clusterMode = properties.clusterMode ?? false;
  const batchSize = properties.batchSize !== undefined && properties.batchSize !== null ? properties.batchSize : '';

  // Local state for dynamically loaded secrets and UI toggles
  const { items: rawSecrets, error: secretError } = useAssetLoader<SecretItem | string>('secrets');
  const secrets: SecretItem[] = (rawSecrets || []).map(normalizeSecretItem);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Field validation
  const isHostEmpty = !host.trim();

  // Fallback chain for system instructions
  const systemInstructions = resolveSystemInstructions(node);

  /**
   * Updates a generic property value and triggers the onChange callback.
   *
   * @param name The property name key
   * @param value The updated property value
   */
  const updateProperty = (name: string, value: any) => {
    // NOTE: Merges updated key/value into current properties and dispatches to parent
    const updated = { ...properties, [name]: value };
    onChange(updated);
  };

  /**
   * Handles text, select, and checkbox input changes.
   *
   * @param e Standard React change event from input, select, or textarea
   */
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      updateProperty(name, checked);
    } else {
      updateProperty(name, value);
    }
  };

  return (
    <div className="flex-1 flex flex-col gap-4 text-[var(--vscode-text-primary)] text-sm">
      {/* Endpoint Configuration Section */}
      <div className="flex flex-col gap-3 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
        <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          <span>Redis Destination Endpoint</span>
          <InfoTooltip text="Configure the target Redis server endpoint hostname, port, database index, and TLS encryption." />
        </label>

        <PropertyField
          id="redisSinkHost"
          name="host"
          label="Host"
          required="Host is required"
          tooltip="Hostname or IP address of the destination Redis server (e.g. 127.0.0.1 or redis.example.com). Required."
          value={host}
          invalid={isHostEmpty}
          error={isHostEmpty ? 'Host is required' : null}
          placeholder="127.0.0.1"
          onChange={handleChange}
          mono={true}
        />

        <div className="grid grid-cols-2 gap-2">
          <PropertyField
            id="redisSinkPort"
            name="port"
            label="Port"
            type="number"
            tooltip="Port number of the Redis server. Defaults to 6379."
            value={port}
            onChange={handleChange}
            placeholder="6379"
            mono={true}
          />
          <PropertyField
            id="redisSinkDatabase"
            name="database"
            label="Database Index"
            type="number"
            tooltip="Logical database index to connect to (e.g. 0). In Redis, databases are identified by integer index."
            value={database}
            onChange={handleChange}
            placeholder="0"
            mono={true}
          />
        </div>

        <div className="flex items-center gap-2 mt-1">
          <input
            id="redisSinkSsl"
            type="checkbox"
            name="ssl"
            checked={ssl}
            onChange={handleChange}
            className="rounded border-[var(--vscode-border)] text-[var(--vscode-highlight)] accent-[var(--vscode-highlight)] focus:ring-0"
          />
          <label htmlFor="redisSinkSsl" className="flex items-center gap-1.5 text-xs text-[var(--vscode-text-secondary)] cursor-pointer">
            <span>Enable SSL / TLS</span>
            <InfoTooltip text="Enables SSL/TLS encrypted connection to the Redis server (enableSSL())." />
          </label>
        </div>
      </div>

      {/* Write Method Section */}
      <div className="flex flex-col gap-1">
        <label htmlFor="redisSinkWriteMethod" className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          <span>Write Method</span>
          <InfoTooltip text="The Redis operation used to write KV entries into the Redis database (maps to RedisIO.Write.Method)." />
        </label>
        <select
          id="redisSinkWriteMethod"
          name="writeMethod"
          value={writeMethod}
          onChange={handleChange}
          className="bg-[var(--vscode-input-bg)] text-[var(--vscode-text-primary)] p-2 rounded border border-[var(--vscode-border)] text-xs focus:outline-none focus:border-[var(--vscode-highlight)]"
        >
          {REDIS_WRITE_METHODS.map(m => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      {/* Key Expiry & Namespace Section */}
      <div className="grid grid-cols-2 gap-2">
        <PropertyField
          id="redisSinkExpireTime"
          name="expireTime"
          label="Expiry TTL (ms)"
          type="number"
          tooltip="Key expiration Time-To-Live in milliseconds passed to withExpireTime(Long expireTimeMillis). For example, 86400000 = 24 hours."
          value={expireTime}
          onChange={handleChange}
          placeholder="e.g. 86400000"
          mono={true}
        />
        <PropertyField
          id="redisSinkKeyPrefix"
          name="keyPrefix"
          label="Key Prefix / Namespace"
          tooltip="Key prefix prepended to all written keys for namespace partitioning. Note: RedisIO.write() does not have a withKeyPrefix builder method; this prefix is applied by upstream KV formatting transforms before writing to Redis."
          value={keyPrefix}
          onChange={handleChange}
          placeholder="e.g. app:session:"
          mono={true}
        />
      </div>

      {/* Authentication Section */}
      <div className="flex flex-col gap-2 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
        <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          <span>Authentication</span>
          <InfoTooltip text="Configure authentication credentials for Redis server. Choose None for unauthenticated instances or Google Cloud Secret Manager to reference stored auth tokens securely." />
        </label>
        <div className="flex gap-4 mt-1">
          <label className="flex items-center gap-1.5 cursor-pointer text-xs text-[var(--vscode-text-secondary)]">
            <input
              type="radio"
              name="authMode"
              value="none"
              checked={authMode === 'none'}
              onChange={handleChange}
              className="accent-[var(--vscode-highlight)]"
            />
            <span>None</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer text-xs text-[var(--vscode-text-secondary)]">
            <input
              type="radio"
              name="authMode"
              value="secret_manager"
              checked={authMode === 'secret_manager'}
              onChange={handleChange}
              className="accent-[var(--vscode-highlight)]"
            />
            <span>Secret Manager</span>
          </label>
        </div>

        {authMode === 'secret_manager' && (
          <div className="flex flex-col gap-2 mt-2 pl-2 border-l-2 border-[var(--vscode-highlight)]/50">
            <PropertyField
              id="redisSinkAuthPasswordSecret"
              name="authPasswordSecret"
              label="Auth Password Secret"
              tooltip="GCP Secret Manager secret containing the Redis AUTH password token."
              value={authPasswordSecret}
              onChange={handleChange}
              list="redis-sink-secret-options"
              datalist={secrets.map((s) => ({ value: s.id || s.name, label: s.name || s.id }))}
              placeholder="e.g. redis-auth-password"
              error={secretError}
              invalid={!!secretError}
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
          </div>
        )}
      </div>

      {/* Collapsible Advanced Sink Settings */}
      <CollapsibleSection
        title="Advanced Sink Settings"
        isOpen={showAdvanced}
        onToggle={() => setShowAdvanced(!showAdvanced)}
      >
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2">
            <PropertyField
              id="redisSinkConnectionTimeout"
              name="connectionTimeout"
              label="Connection Timeout (ms)"
              type="number"
              tooltip="Connection timeout in milliseconds. Defaults to driver default."
              value={connectionTimeout}
              onChange={handleChange}
              placeholder="2000"
              mono={true}
            />
            <PropertyField
              id="redisSinkSocketTimeout"
              name="socketTimeout"
              label="Socket Timeout (ms)"
              type="number"
              tooltip="Socket timeout in milliseconds for socket operations."
              value={socketTimeout}
              onChange={handleChange}
              placeholder="2000"
              mono={true}
            />
          </div>

          <PropertyField
            id="redisSinkBatchSize"
            name="batchSize"
            label="Batch / Pipeline Size"
            type="number"
            tooltip="Number of Redis write commands to buffer and execute via Redis pipelining in a single request."
            value={batchSize}
            onChange={handleChange}
            placeholder="1000"
            mono={true}
          />

          <div className="flex items-center gap-2 p-2 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
            <input
              id="redisSinkClusterMode"
              type="checkbox"
              name="clusterMode"
              checked={clusterMode}
              onChange={handleChange}
              className="rounded border-[var(--vscode-border)] text-[var(--vscode-highlight)] accent-[var(--vscode-highlight)] focus:ring-0"
            />
            <label htmlFor="redisSinkClusterMode" className="flex items-center gap-1.5 text-xs text-[var(--vscode-text-secondary)] cursor-pointer">
              <span>Redis Cluster Mode</span>
              <InfoTooltip text="Enables cluster topology routing when writing to a multi-node Redis cluster. Switches the underlying client to JedisCluster. Note that logical database index is ignored in cluster mode." />
            </label>
          </div>
        </div>
      </CollapsibleSection>

      {/* Code Generation Instructions */}
      <SystemInstructionsField
        id="redisSinkInstructions"
        value={systemInstructions}
        tooltip="Optional custom prompt instructions passed to the LLM code generator when synthesizing Redis pipeline writer transforms."
        placeholder="e.g. Write elements to Redis using SET with a TTL of 3600 seconds"
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
