/**
 * CassandraIOSinkProperties Component
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Renders the property configuration panel for Apache Beam CassandraIO.write() and delete() sink nodes.
 * Configures cluster connection parameters (hosts/contact points, port, local datacenter),
 * destination keyspace and table, mutation mode (write vs delete), entity/mapper class,
 * consistency level, Google Cloud Secret Manager credentials, and advanced performance options
 * (max batch size, concurrent async queries, timeouts, SSL).
 *
 * Architectural Decisions:
 * - Follows the "props in, events up" controlled input architecture with no local prop mirroring.
 * - Supports Mutation Mode switching between insert/upsert ('write') and deletion ('delete').
 * - Dynamically loads GCP Secret Manager secrets via 'getSecrets' IPC message to populate datalist.
 * - Secret normalization supports both raw resource strings and SecretItem objects with short ID extraction.
 * - Real-time validation for required contact points, keyspace, and table fields with accessible ARIA tags.
 * - Collapsible Advanced Sink Settings group for write tuning (withMaxBatchSize, withConcurrentAsyncQueries, timeouts, SSL).
 * - Preserves system_instructions / special_instructions fallback chain for LLM code generation.
 * - Uses Tailwind CSS and 8pt grid spacing with VS Code theme tokens.
 */

import React, { useState } from 'react';
import { InfoTooltip } from '../../components/InfoTooltip';
import { PropertyField } from '../../components/common/PropertyField';
import { SystemInstructionsField } from '../../components/common/SystemInstructionsField';
import { resolveSystemInstructions } from '../../utils/systemInstructions';
import { MappingStrategyField, type MappingStrategy } from '../../components/common/MappingStrategyField';
import { resolveSchemaFields, type SchemaField } from '../../components/common/SchemaEditor';
import { useAssetLoader } from '../../hooks/useAssetLoader';
import { normalizeSecretItem } from '../../components/common/SecretManagerAuthFields';
import { CollapsibleSection } from '../../components/common/CollapsibleSection';

/**
 * Secret item loaded from Secret Manager for Cassandra authentication.
 */
export interface SecretItem {
  id: string;
  name: string;
  fullName?: string;
}

export type CassandraMutationMode = 'write' | 'delete';
export type CassandraConsistencyLevel = 'ONE' | 'QUORUM' | 'LOCAL_QUORUM' | 'ALL' | 'LOCAL_ONE';

/**
 * Props for the CassandraIOSinkProperties component.
 */
export interface CassandraIOSinkPropertiesProps {
  node: {
    data: {
      label?: string;
      beam_transform?: string;
      system_instructions?: string;
      special_instructions?: string;
      properties?: {
        hosts?: string;
        contactPoints?: string;
        port?: number | string;
        keyspace?: string;
        table?: string;
        localDc?: string;
        mutationType?: CassandraMutationMode | string;
        mutationMode?: CassandraMutationMode | string;
        entityStrategy?: MappingStrategy | string;
        entity?: string;
        schemaString?: string;
        schema?: string;
        schemaFields?: SchemaField[];
        consistencyLevel?: CassandraConsistencyLevel | string;
        authMode?: 'default' | 'secret_manager' | string;
        usernameSecret?: string;
        passwordSecret?: string;
        maxBatchSize?: number | string;
        concurrentAsyncQueries?: number | string;
        connectTimeout?: number | string;
        readTimeout?: number | string;
        ssl?: boolean;
        system_instructions?: string;
        special_instructions?: string;
        [key: string]: any;
      };
    };
  };
  onChange: (properties: any) => void;
}

/**
 * CassandraIOSinkProperties renders the configuration form for CassandraIO.write() transforms.
 *
 * @param props Component properties containing the active node and onChange callback
 */
export const CassandraIOSinkProperties: React.FC<CassandraIOSinkPropertiesProps> = ({ node, onChange }) => {
  const properties = node.data.properties || {};

  // Form field state extracted from node properties
  const hosts = properties.hosts ?? properties.contactPoints ?? '';
  const port = properties.port !== undefined && properties.port !== '' ? properties.port : 9042;
  const keyspace = properties.keyspace ?? '';
  const table = properties.table ?? '';
  const localDc = properties.localDc ?? '';
  const mutationType = properties.mutationType ?? properties.mutationMode ?? 'write';
  const entity = properties.entity ?? '';
  const entityStrategy = properties.entityStrategy || (properties.entity ? 'customClass' : 'infer');
  const schemaFields = React.useMemo(
    () => resolveSchemaFields(properties),
    [properties.schemaFields, properties.schema, properties.schemaString]
  );
  const consistencyLevel = properties.consistencyLevel ?? '';
  const authMode = properties.authMode ?? 'default';
  const usernameSecret = properties.usernameSecret ?? '';
  const passwordSecret = properties.passwordSecret ?? '';
  const maxBatchSize = properties.maxBatchSize ?? '';
  const concurrentAsyncQueries = properties.concurrentAsyncQueries ?? '';
  const connectTimeout = properties.connectTimeout ?? '';
  const readTimeout = properties.readTimeout ?? '';
  const ssl = properties.ssl ?? false;

  // Local state for dynamically loaded Secret Manager resources and UI state
  const { items: rawSecrets, error: secretError } = useAssetLoader<SecretItem | string>('secrets');
  const secrets: SecretItem[] = (rawSecrets || []).map(normalizeSecretItem);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Field validation
  const isHostsEmpty = !String(hosts).trim();
  const isKeyspaceEmpty = !String(keyspace).trim();
  const isTableEmpty = !String(table).trim();

  // NOTE: Fallback chain for system instructions
  const systemInstructions = resolveSystemInstructions(node);

  /**
   * Updates a generic property value and triggers onChange callback.
   *
   * @param name The property name key
   * @param value The updated property value
   */
  const updateProperty = (name: string, value: any) => {
    // NOTE: Merge updated property and dispatch to parent component
    const updated = { ...properties, [name]: value };
    onChange(updated);
  };

  /**
   * Handles text, number, select, and checkbox input changes.
   *
   * @param e Standard React change event
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

  const handleSchemaChange = (data: { schemaFields: SchemaField[]; schema: string; schemaString: string }) => {
    onChange({
      ...properties,
      schemaFields: data.schemaFields,
      schema: data.schema,
      schemaString: data.schemaString
    });
  };


  return (
    <div className="flex-1 flex flex-col gap-4 text-[var(--vscode-text-primary)] text-sm">
      {/* Cassandra Cluster Connection Settings */}
      <div className="flex flex-col gap-3 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
        <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          <span>Cluster Connection</span>
          <InfoTooltip text="Configures connection to Cassandra nodes. Maps to CassandraIO.write().withHosts() and withPort()." />
        </label>

        <PropertyField
          id="cassandraSinkHosts"
          name="hosts"
          label="Contact Points / Hosts"
          required="Contact points / hosts are required"
          tooltip="Comma-separated list of Cassandra cluster hostnames or IP addresses (e.g. 127.0.0.1, 10.0.0.1). Maps to withHosts(). Required."
          value={hosts}
          invalid={isHostsEmpty}
          error={isHostsEmpty ? 'Contact points / hosts are required' : null}
          placeholder="127.0.0.1, 10.0.0.1"
          onChange={handleChange}
          mono={true}
        />

        <div className="grid grid-cols-2 gap-2">
          <PropertyField
            id="cassandraSinkPort"
            name="port"
            label="Native Port"
            type="number"
            tooltip="Native CQL transport port for the Cassandra nodes (default 9042). Maps to withPort()."
            value={port}
            onChange={handleChange}
            placeholder="9042"
            mono={true}
          />

          <PropertyField
            id="cassandraSinkLocalDc"
            name="localDc"
            label="Local Datacenter"
            tooltip="Specifies the local Data Center (DC) name used by the load balancing policy (e.g. datacenter1). Maps to withLocalDc()."
            value={localDc}
            onChange={handleChange}
            placeholder="datacenter1"
            mono={true}
          />
        </div>
      </div>

      {/* Target Destination Settings */}
      <div className="flex flex-col gap-3 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
        <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          <span>Write Destination</span>
          <InfoTooltip text="Specify the target Cassandra keyspace and table to write records." />
        </label>

        <div className="grid grid-cols-2 gap-2">
          <PropertyField
            id="cassandraSinkKeyspace"
            name="keyspace"
            label="Keyspace"
            required="Keyspace is required"
            tooltip="Target Cassandra keyspace name. Maps to withKeyspace(). Required."
            value={keyspace}
            invalid={isKeyspaceEmpty}
            error={isKeyspaceEmpty ? 'Keyspace is required' : null}
            placeholder="e.g. telemetry"
            onChange={handleChange}
            mono={true}
          />

          <PropertyField
            id="cassandraSinkTable"
            name="table"
            label="Table"
            required="Table is required"
            tooltip="Target Cassandra table name. When using Auto-Infer or Define Schema, Gemini generates the @Table(keyspace = ..., name = ...) annotation on the entity POJO from this value. Required."
            value={table}
            invalid={isTableEmpty}
            error={isTableEmpty ? 'Table is required' : null}
            placeholder="e.g. device_rollups"
            onChange={handleChange}
            mono={true}
          />
        </div>
      </div>

      {/* Mutation Mode & Entity Settings */}
      <div className="flex flex-col gap-3 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
        <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          <span>Mutation &amp; Entity Mapping</span>
          <InfoTooltip text="Configures mutation mode (write vs delete), entity mapping strategy, and write consistency." />
        </label>

        <div className="flex flex-col gap-1">
          <span className="text-xs font-bold uppercase text-[var(--vscode-text-muted)]">Mutation Mode</span>
          <div className="flex gap-4">
            <label className="flex items-center gap-1.5 cursor-pointer text-xs text-[var(--vscode-text-secondary)]">
              <input
                type="radio"
                name="mutationType"
                value="write"
                checked={mutationType === 'write'}
                onChange={handleChange}
                className="accent-[var(--vscode-highlight)]"
              />
              <span>Write / Upsert (CassandraIO.write())</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer text-xs text-[var(--vscode-text-secondary)]">
              <input
                type="radio"
                name="mutationType"
                value="delete"
                checked={mutationType === 'delete'}
                onChange={handleChange}
                className="accent-[var(--vscode-highlight)]"
              />
              <span>Delete (CassandraIO.delete())</span>
            </label>
          </div>
        </div>

        <MappingStrategyField
          id="cassandraSinkEntityStrategy"
          strategyName="entityStrategy"
          strategy={entityStrategy}
          label="Entity Mapping Strategy"
          tooltip="Select how Beam elements map to Cassandra entity mutations. 'Auto-Infer' lets Gemini generate the @Table POJO matching your keyspace and table automatically. 'Define Schema' lets you specify exact fields & types. 'Custom Class' references a pre-compiled entity class."
          optionLabels={{
            customClass: 'Custom Entity Class Name (Optional)'
          }}
          inferDescription={
            <>
              Gemini will automatically synthesize a DataStax{' '}
              <code className="text-slate-200 bg-slate-800/80 px-1 py-0.5 rounded">@Table</code>-annotated POJO matching your target keyspace and table.
            </>
          }
          schemaFields={schemaFields}
          schemaStringPlaceholder="device_id:STRING:REQUIRED, window_start:TIMESTAMP, avg_val:DOUBLE"
          onSchemaChange={handleSchemaChange}
          customClassId="cassandraSinkEntity"
          customClassName="entity"
          customClassLabel="Entity / Mapper Class"
          customClassTooltip="Fully qualified class name of the POJO/entity annotated with DataStax driver annotations. Maps to withEntity()."
          customClassPlaceholder="com.example.CassandraRowEntity"
          customClassValue={entity}
          onChange={handleChange}
        />

        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <label
              htmlFor="cassandraSinkConsistencyLevel"
              className="text-xs font-bold uppercase text-[var(--vscode-text-muted)]"
            >
              Consistency Level
            </label>
            <InfoTooltip text="Write consistency level for Cassandra coordinator updates. Maps to withConsistencyLevel()." />
          </div>
          <select
            id="cassandraSinkConsistencyLevel"
            name="consistencyLevel"
            value={consistencyLevel}
            onChange={handleChange}
            className="bg-[var(--vscode-input-bg)] text-[var(--vscode-text-primary)] p-2 rounded border border-[var(--vscode-border)] text-xs focus:outline-none focus:border-[var(--vscode-highlight)]"
          >
            <option value="">Default (Cluster configured)</option>
            <option value="LOCAL_QUORUM">LOCAL_QUORUM</option>
            <option value="QUORUM">QUORUM</option>
            <option value="ONE">ONE</option>
            <option value="LOCAL_ONE">LOCAL_ONE</option>
            <option value="ALL">ALL</option>
          </select>
        </div>
      </div>

      {/* Authentication Block */}
      <div className="flex flex-col gap-3 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
        <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          <span>Authentication</span>
          <InfoTooltip text="Choose authentication strategy: default (no authentication / cluster security disabled) or credentials securely referenced from GCP Secret Manager." />
        </label>
        <div className="flex gap-4">
          <label className="flex items-center gap-1.5 cursor-pointer text-xs text-[var(--vscode-text-secondary)]">
            <input
              type="radio"
              name="authMode"
              value="default"
              checked={authMode === 'default'}
              onChange={handleChange}
              className="accent-[var(--vscode-highlight)]"
            />
            <span>Default (No Auth)</span>
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
          <div className="flex flex-col gap-3 mt-1">
            <PropertyField
              id="cassandraSinkUsernameSecret"
              name="usernameSecret"
              label="Username Secret"
              tooltip="Google Cloud Secret Manager secret containing the Cassandra username."
              value={usernameSecret}
              onChange={handleChange}
              list="cassandra-sink-secret-options"
              datalist={secrets.map((s) => ({ value: s.id || s.name, label: s.name || s.id }))}
              placeholder="e.g. cassandra-username"
              mono={true}
            />
            <PropertyField
              id="cassandraSinkPasswordSecret"
              name="passwordSecret"
              label="Password Secret"
              tooltip="Google Cloud Secret Manager secret containing the Cassandra password."
              value={passwordSecret}
              onChange={handleChange}
              list="cassandra-sink-secret-options"
              datalist={secrets.map((s) => ({ value: s.id || s.name, label: s.name || s.id }))}
              placeholder="e.g. cassandra-password"
              mono={true}
            />
            {secretError && (
              <span className="text-xs text-red-400" role="alert">
                {secretError}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Collapsible Advanced Sink Settings */}
      <CollapsibleSection
        title="Advanced Sink Settings"
        isOpen={showAdvanced}
        onToggle={() => setShowAdvanced(!showAdvanced)}
      >
        <div className="grid grid-cols-2 gap-2">
          <PropertyField
            id="cassandraSinkMaxBatchSize"
            name="maxBatchSize"
            label="Max Batch Size"
            type="number"
            tooltip="Controls the maximum number of statements grouped into a single batch before sending to Cassandra."
            value={maxBatchSize}
            onChange={handleChange}
            placeholder="100"
            mono={true}
          />

          <PropertyField
            id="cassandraSinkConcurrentAsyncQueries"
            name="concurrentAsyncQueries"
            label="Concurrent Async Queries"
            type="number"
            tooltip="Maximum number of in-flight asynchronous queries allowed per worker."
            value={concurrentAsyncQueries}
            onChange={handleChange}
            placeholder="50"
            mono={true}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <PropertyField
            id="cassandraSinkConnectTimeout"
            name="connectTimeout"
            label="Connect Timeout (ms)"
            type="number"
            tooltip="Socket connection timeout in milliseconds. Maps to withConnectTimeout()."
            value={connectTimeout}
            onChange={handleChange}
            placeholder="5000"
            mono={true}
          />

          <PropertyField
            id="cassandraSinkReadTimeout"
            name="readTimeout"
            label="Read Timeout (ms)"
            type="number"
            tooltip="Socket read timeout in milliseconds. Maps to withReadTimeout()."
            value={readTimeout}
            onChange={handleChange}
            placeholder="12000"
            mono={true}
          />
        </div>

        <div className="flex items-center gap-2 p-2 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
          <input
            id="cassandraSinkSsl"
            type="checkbox"
            name="ssl"
            checked={ssl}
            onChange={handleChange}
            className="rounded border-[var(--vscode-border)] text-[var(--vscode-highlight)] accent-[var(--vscode-highlight)] focus:ring-0"
          />
          <label htmlFor="cassandraSinkSsl" className="flex items-center gap-1.5 text-xs text-[var(--vscode-text-secondary)] cursor-pointer">
            <span>Enable SSL / TLS</span>
            <InfoTooltip text="Enables SSL/TLS encrypted communication with the Cassandra cluster. Maps to withSsl()." />
          </label>
        </div>
      </CollapsibleSection>

      <SystemInstructionsField
        id="cassandraSinkInstructions"
        value={systemInstructions}
        tooltip="Optional instructions passed to LLM code generator when synthesizing CassandraIO pipelines."
        placeholder="e.g. Write mutated Cassandra entities using CassandraIO.write()"
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
