/**
 * RedisIOSourceProperties Component
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Renders the property configuration panel for Apache Beam RedisIO Source nodes.
 * Supports both static key pattern matching via RedisIO.read().withKeyPattern() and
 * PCollection-driven dynamic key pattern reading via RedisIO.readKeyPatterns().
 *
 * Architectural Decisions:
 * - Controlled inputs following the "props in, events up" unidirectional data flow.
 * - Dynamic discovery: Requests GCP Secret Manager secrets via 'getSecrets' IPC message to securely bind AUTH passwords.
 * - Real-time validation: Requires Redis endpoint host, and requires key pattern when in 'keyPattern' read mode.
 * - Read mode switching: Dynamically toggles between static pattern input and PCollection stream description.
 * - Collapsible Advanced Source Settings: Encapsulates connection timeout, socket timeout, max attempts, and cluster mode.
 * - Preserves system_instructions / special_instructions fallback chain for LLM pipeline code generation.
 * - Follows the 8pt grid system and VS Code theme tokens with Tailwind CSS styling.
 */

import React, { useState } from 'react';
import { InfoTooltip } from '../../components/InfoTooltip';
import { PropertyField } from '../../components/common/PropertyField';
import { useAssetLoader } from '../../hooks/useAssetLoader';
import { normalizeSecretItem } from '../../components/common/SecretManagerAuthFields';

/**
 * Secret item descriptor returned from extension host discovery.
 */
export interface SecretItem {
  id: string;
  name: string;
  fullName?: string;
}

/**
 * Props for the RedisIOSourceProperties component.
 */
export interface RedisIOSourcePropertiesProps {
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
        readMode?: 'keyPattern' | 'readKeyPatterns';
        keyPattern?: string;
        batchSize?: number | string;
        outputParallelization?: boolean;
        authMode?: 'none' | 'secret_manager';
        authPasswordSecret?: string;
        connectionTimeout?: number | string;
        socketTimeout?: number | string;
        maxAttempts?: number | string;
        clusterMode?: boolean;
        system_instructions?: string;
        special_instructions?: string;
        [key: string]: any;
      };
    };
  };
  onChange: (properties: any) => void;
}

/**
 * RedisIOSourceProperties renders the configuration panel for RedisIO source reads.
 *
 * @param props Component properties containing the active node and onChange callback
 */
export const RedisIOSourceProperties: React.FC<RedisIOSourcePropertiesProps> = ({ node, onChange }) => {
  const properties = node.data?.properties || {};

  // Form field state extracted from node properties
  const host = properties.host || '';
  const port = properties.port !== undefined && properties.port !== null ? properties.port : '';
  const database = properties.database !== undefined && properties.database !== null ? properties.database : '';
  const ssl = properties.ssl ?? false;
  const readMode = properties.readMode || 'keyPattern';
  const keyPattern = properties.keyPattern || '';
  const batchSize = properties.batchSize !== undefined && properties.batchSize !== null ? properties.batchSize : '';
  const outputParallelization = properties.outputParallelization ?? false;
  const authMode = properties.authMode || 'none';
  const authPasswordSecret = properties.authPasswordSecret || '';
  const connectionTimeout = properties.connectionTimeout !== undefined && properties.connectionTimeout !== null ? properties.connectionTimeout : '';
  const socketTimeout = properties.socketTimeout !== undefined && properties.socketTimeout !== null ? properties.socketTimeout : '';
  const maxAttempts = properties.maxAttempts !== undefined && properties.maxAttempts !== null ? properties.maxAttempts : '';
  const clusterMode = properties.clusterMode ?? false;

  // Local state for dynamically loaded secrets and UI toggles
  const { items: rawSecrets, error: secretError } = useAssetLoader<SecretItem | string>('secrets');
  const secrets: SecretItem[] = (rawSecrets || []).map(normalizeSecretItem);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Field validation
  const isHostEmpty = !host.trim();
  const isKeyPatternEmpty = readMode === 'keyPattern' && !keyPattern.trim();

  // Fallback chain for system instructions
  const systemInstructions =
    node.data?.system_instructions ??
    node.data?.special_instructions ??
    properties.system_instructions ??
    properties.special_instructions ??
    '';

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

  /**
   * Handles system instructions textarea modifications.
   *
   * @param e React textarea change event
   */
  const handleInstructionsChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    // NOTE: LLM generation prompt is stored in system_instructions property
    onChange({
      ...properties,
      system_instructions: e.target.value
    });
  };

  return (
    <div className="flex-1 flex flex-col gap-4 text-[var(--vscode-text-primary)] text-sm">
      {/* Endpoint Configuration Section */}
      <div className="flex flex-col gap-3 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
        <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          <span>Redis Endpoint</span>
          <InfoTooltip text="Configure the target Redis server endpoint hostname, port, database index, and TLS encryption." />
        </label>

        <PropertyField
          id="redisSourceHost"
          name="host"
          label="Host"
          required="Host is required"
          tooltip="Hostname or IP address of the Redis server (e.g. 127.0.0.1 or redis.example.com). Required."
          value={host}
          invalid={isHostEmpty}
          error={isHostEmpty ? 'Host is required' : null}
          placeholder="127.0.0.1"
          onChange={handleChange}
          mono={true}
        />

        <div className="grid grid-cols-2 gap-2">
          <PropertyField
            id="redisSourcePort"
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
            id="redisSourceDatabase"
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
            id="redisSourceSsl"
            type="checkbox"
            name="ssl"
            checked={ssl}
            onChange={handleChange}
            className="rounded border-[var(--vscode-border)] text-[var(--vscode-highlight)] accent-[var(--vscode-highlight)] focus:ring-0"
          />
          <label htmlFor="redisSourceSsl" className="flex items-center gap-1.5 text-xs text-[var(--vscode-text-secondary)] cursor-pointer">
            <span>Enable SSL / TLS</span>
            <InfoTooltip text="Enables SSL/TLS encrypted connection to the Redis server (enableSSL())." />
          </label>
        </div>
      </div>

      {/* Read Mode Configuration Section */}
      <div className="flex flex-col gap-2 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
        <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          <span>Read Mode</span>
          <InfoTooltip text="Choose whether to read keys using a static key pattern filter via RedisIO.read().withKeyPattern() or dynamically from an upstream PCollection of key patterns via RedisIO.readKeyPatterns()." />
        </label>
        <div className="flex flex-col gap-2 mt-1">
          <label className="flex items-center gap-2 cursor-pointer text-xs text-[var(--vscode-text-secondary)]">
            <input
              type="radio"
              name="readMode"
              value="keyPattern"
              checked={readMode === 'keyPattern'}
              onChange={handleChange}
              className="accent-[var(--vscode-highlight)] text-[var(--vscode-highlight)]"
            />
            <span>Key Pattern (RedisIO.read() with static pattern)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-xs text-[var(--vscode-text-secondary)]">
            <input
              type="radio"
              name="readMode"
              value="readKeyPatterns"
              checked={readMode === 'readKeyPatterns'}
              onChange={handleChange}
              className="accent-[var(--vscode-highlight)] text-[var(--vscode-highlight)]"
            />
            <span>Dynamic Key Patterns (RedisIO.readKeyPatterns() PCollection-driven)</span>
          </label>
        </div>

        {readMode === 'keyPattern' && (
          <div className="flex flex-col gap-2 mt-2 pl-2 border-l-2 border-[var(--vscode-highlight)]/50">
            <PropertyField
              id="redisSourceKeyPattern"
              name="keyPattern"
              label="Key Pattern"
              required="Key pattern is required in Key Pattern mode"
              tooltip="Glob-style pattern to match Redis keys (e.g. '*' or 'user:*'). Required when using static keyPattern mode."
              value={keyPattern}
              invalid={isKeyPatternEmpty}
              error={isKeyPatternEmpty ? 'Key pattern is required in Key Pattern mode' : null}
              placeholder="e.g. user:*"
              onChange={handleChange}
              mono={true}
            />
          </div>
        )}

        {readMode === 'readKeyPatterns' && (
          <div className="mt-2 pl-2 border-l-2 border-[var(--vscode-highlight)]/50 text-xs text-[var(--vscode-text-secondary)]">
            <span>Keys will be read dynamically from pattern strings in the incoming upstream PCollection.</span>
          </div>
        )}
      </div>

      {/* Batching & Parallelization Section */}
      <div className="grid grid-cols-2 gap-2">
        <PropertyField
          id="redisSourceBatchSize"
          name="batchSize"
          label="Batch Size"
          type="number"
          tooltip="Number of keys to fetch from Redis in each batch request (withBatchSize). Default is driver-dependent."
          value={batchSize}
          onChange={handleChange}
          placeholder="1000"
          mono={true}
        />
        <div className="flex flex-col justify-end pb-1">
          <div className="flex items-center gap-2 p-2 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
            <input
              id="redisSourceOutputParallelization"
              type="checkbox"
              name="outputParallelization"
              checked={outputParallelization}
              onChange={handleChange}
              className="rounded border-[var(--vscode-border)] text-[var(--vscode-highlight)] accent-[var(--vscode-highlight)] focus:ring-0"
            />
            <label htmlFor="redisSourceOutputParallelization" className="flex items-center gap-1.5 text-xs text-[var(--vscode-text-secondary)] cursor-pointer">
              <span>Parallelize Output</span>
              <InfoTooltip text="Enables output reshuffling to parallelize downstream pipeline processing (withOutputParallelization)." />
            </label>
          </div>
        </div>
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
              id="redisSourceAuthPasswordSecret"
              name="authPasswordSecret"
              label="Auth Password Secret"
              tooltip="GCP Secret Manager secret containing the Redis AUTH password token."
              value={authPasswordSecret}
              onChange={handleChange}
              list="redis-source-secret-options"
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

      {/* Collapsible Advanced Source Settings */}
      <div className="flex flex-col border border-[var(--vscode-border-light)] rounded-md overflow-hidden">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center justify-between p-2 bg-[var(--vscode-subcard-bg)] text-xs font-bold uppercase text-[var(--vscode-text-muted)] hover:text-[var(--vscode-text-primary)] transition-colors cursor-pointer"
        >
          <span>Advanced Source Settings</span>
          <span>{showAdvanced ? '▲' : '▼'}</span>
        </button>

        {showAdvanced && (
          <div className="p-3 bg-[var(--vscode-workbench-bg)] flex flex-col gap-3 border-t border-[var(--vscode-border-light)]">
            <div className="grid grid-cols-2 gap-2">
              <PropertyField
                id="redisSourceConnectionTimeout"
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
                id="redisSourceSocketTimeout"
                name="socketTimeout"
                label="Socket Timeout (ms)"
                type="number"
                tooltip="Socket timeout in milliseconds for reading data from Redis."
                value={socketTimeout}
                onChange={handleChange}
                placeholder="2000"
                mono={true}
              />
            </div>

            <PropertyField
              id="redisSourceMaxAttempts"
              name="maxAttempts"
              label="Max Attempts"
              type="number"
              tooltip="Maximum number of connection/read attempts before failing."
              value={maxAttempts}
              onChange={handleChange}
              placeholder="5"
              mono={true}
            />

            <div className="flex items-center gap-2 p-2 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
              <input
                id="redisSourceClusterMode"
                type="checkbox"
                name="clusterMode"
                checked={clusterMode}
                onChange={handleChange}
                className="rounded border-[var(--vscode-border)] text-[var(--vscode-highlight)] accent-[var(--vscode-highlight)] focus:ring-0"
              />
              <label htmlFor="redisSourceClusterMode" className="flex items-center gap-1.5 text-xs text-[var(--vscode-text-secondary)] cursor-pointer">
                <span>Redis Cluster Mode</span>
                <InfoTooltip text="Enables cluster topology awareness when connecting to a multi-node Redis cluster. Switches the underlying client to JedisCluster. Note that logical database index is ignored in cluster mode." />
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Flexible Spacer */}
      <div className="flex-1 min-h-[16px]" />

      {/* Code Generation Instructions */}
      <PropertyField
        id="redisSourceInstructions"
        name="system_instructions"
        label="Code Generation Instructions"
        tooltip="Optional custom prompt instructions passed to the LLM code generator when synthesizing Redis pipeline reader transforms."
        type="textarea"
        rows={3}
        value={systemInstructions}
        onChange={handleInstructionsChange}
        placeholder="e.g. Ingest cache keys matching user:* and convert KV pairs into UserSession records"
        mono={true}
      />
    </div>
  );
};
