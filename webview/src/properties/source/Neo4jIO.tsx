/**
 * Neo4jIOSourceProperties Component
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Renders the property configuration panel for Apache Beam Neo4jIO Source nodes
 * (org.apache.beam.sdk.io.neo4j.Neo4jIO.readAll() in Java SDK / cross-language in Python).
 * Configures connection URL, database name, Cypher query, row mapper, parameters function,
 * Secret Manager credentials, and advanced session / driver connection pool options.
 *
 * Architectural Decisions:
 * - Controlled inputs adhering to "props in, events up" unidirectional data flow.
 * - Connection URL validation: Verifies URL presence and flags format warning if scheme is not neo4j://, neo4j+s://, bolt://, or bolt+s://.
 * - Required Cypher query: Cypher query is required for readAll() execution.
 * - Dynamic discovery: Requests GCP Secret Manager secrets via 'getSecrets' IPC message to securely bind username and password.
 * - Unique datalist ID: Uses 'neo4j-source-secret-options' to avoid cross-panel datalist pollution.
 * - Collapsible Advanced Source Settings: Organizes session config, connection pool size, max transaction retry time, and TLS encryption.
 * - Preserves system_instructions / special_instructions fallback chain for LLM pipeline code generation.
 * - Strictly follows the 8pt grid system and VS Code theme tokens with Tailwind CSS styling.
 */

import React, { useState } from 'react';
import { InfoTooltip } from '../../components/InfoTooltip';
import { PropertyField } from '../../components/common/PropertyField';
import { SystemInstructionsField } from '../../components/common/SystemInstructionsField';
import { CollapsibleSection } from '../../components/common/CollapsibleSection';
import { resolveSystemInstructions } from '../../utils/systemInstructions';
import { MappingStrategyField, type MappingStrategy } from '../../components/common/MappingStrategyField';
import { resolveSchemaFields, type SchemaField } from '../../components/common/SchemaEditor';
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
 * Props for the Neo4jIOSourceProperties component.
 */
export interface Neo4jIOSourcePropertiesProps {
  node: {
    data: {
      label?: string;
      beam_transform?: string;
      system_instructions?: string;
      special_instructions?: string;
      properties?: {
        url?: string;
        database?: string;
        cypher?: string;
        mapperStrategy?: MappingStrategy | string;
        rowMapper?: string;
        schemaString?: string;
        schema?: string;
        schemaFields?: SchemaField[];
        parametersFunction?: string;
        authMode?: 'none' | 'secret_manager';
        usernameSecret?: string;
        passwordSecret?: string;
        sessionConfig?: string;
        connectionPoolSize?: number | string;
        maxTransactionRetryTimeMs?: number | string;
        encrypted?: boolean;
        system_instructions?: string;
        special_instructions?: string;
        [key: string]: any;
      };
    };
  };
  onChange: (properties: any) => void;
}

/**
 * Neo4jIOSourceProperties renders the configuration panel for Neo4jIO source reads.
 *
 * @param props Component properties containing the active node and onChange callback
 */
export const Neo4jIOSourceProperties: React.FC<Neo4jIOSourcePropertiesProps> = ({ node, onChange }) => {
  const properties = node.data?.properties || {};

  // Form field state extracted from node properties
  const url = properties.url || '';
  const database = properties.database !== undefined ? properties.database : 'neo4j';
  const cypher = properties.cypher || '';
  const rowMapper = properties.rowMapper || '';
  const mapperStrategy = properties.mapperStrategy || (properties.rowMapper ? 'customClass' : 'infer');
  const schemaFields = React.useMemo(
    () => resolveSchemaFields(properties),
    [properties.schemaFields, properties.schema, properties.schemaString]
  );
  const parametersFunction = properties.parametersFunction || '';
  const authMode = properties.authMode || 'none';
  const usernameSecret = properties.usernameSecret || '';
  const passwordSecret = properties.passwordSecret || '';
  const sessionConfig = properties.sessionConfig || '';
  const connectionPoolSize = properties.connectionPoolSize !== undefined && properties.connectionPoolSize !== null ? properties.connectionPoolSize : '';
  const maxTransactionRetryTimeMs = properties.maxTransactionRetryTimeMs !== undefined && properties.maxTransactionRetryTimeMs !== null ? properties.maxTransactionRetryTimeMs : '';
  const encrypted = properties.encrypted ?? false;

  // Local state for dynamically loaded secrets and UI toggles
  const { items: rawSecrets, error: secretError } = useAssetLoader<SecretItem | string>('secrets');
  const secrets: SecretItem[] = (rawSecrets || []).map(normalizeSecretItem);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Field validation
  const isUrlEmpty = !url.trim();
  const trimmedUrl = url.trim().toLowerCase();
  const isSchemeValid =
    !isUrlEmpty &&
    (trimmedUrl.startsWith('neo4j://') ||
      trimmedUrl.startsWith('neo4j+s://') ||
      trimmedUrl.startsWith('bolt://') ||
      trimmedUrl.startsWith('bolt+s://'));
  const isCypherEmpty = !cypher.trim();

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
      {/* Connection & Database Card */}
      <div className="flex flex-col gap-3 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
        <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          <span>Neo4j Connection</span>
          <InfoTooltip text="Connection URI and database target for Neo4jIO.DriverConfiguration." />
        </label>

        <PropertyField
          id="neo4jSourceUrl"
          name="url"
          label="Connection URL"
          required="Connection URL is required"
          tooltip="Neo4j connection URI (e.g. neo4j://localhost:7687, neo4j+s://aura.databases.neo4j.io, or bolt://localhost:7687). Required."
          value={url}
          invalid={isUrlEmpty}
          error={isUrlEmpty ? 'Connection URL is required' : null}
          helperText={
            !isUrlEmpty && !isSchemeValid ? (
              <span className="text-amber-400" role="alert">
                Warning: Neo4j connection URLs typically start with neo4j://, neo4j+s://, bolt://, or bolt+s://
              </span>
            ) : null
          }
          placeholder="neo4j://localhost:7687"
          onChange={handleChange}
          mono={true}
        />

        <PropertyField
          id="neo4jSourceDatabase"
          name="database"
          label="Database Name"
          tooltip="Target Neo4j database name (e.g. 'neo4j' or 'system'). Defaults to 'neo4j'."
          value={database}
          onChange={handleChange}
          placeholder="neo4j"
          mono={true}
        />
      </div>

      {/* Query & Row Mapper Section */}
      <div className="flex flex-col gap-3 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
        <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          <span>Cypher Query &amp; Mapping</span>
          <InfoTooltip text="Cypher query executed by Neo4jIO.readAll() and functions mapping database records into PCollection elements." />
        </label>

        <PropertyField
          id="neo4jSourceCypher"
          name="cypher"
          label="Cypher Read Query"
          required="Cypher query is required"
          tooltip="Cypher query to execute for each input element in readAll() (withCypher). Parameters can be referenced with $param syntax. Required."
          type="textarea"
          rows={3}
          value={cypher}
          invalid={isCypherEmpty}
          error={isCypherEmpty ? 'Cypher query is required' : null}
          placeholder="MATCH (n:Person) WHERE n.city = $city RETURN n.id AS id, n.name AS name"
          onChange={handleChange}
          mono={true}
        />

        <MappingStrategyField
          id="neo4jSourceMapperStrategy"
          strategyName="mapperStrategy"
          strategy={mapperStrategy}
          label="Row Mapping Strategy"
          tooltip="Select how Neo4j Record results are mapped to PCollection elements. 'Auto-Infer' lets Gemini synthesize an inline Neo4jIO.RowMapper<Row> from your Cypher RETURN aliases. 'Define Schema' specifies exact typed fields. 'Custom Class' references a compiled RowMapper class."
          optionLabels={{
            customClass: 'Custom RowMapper Class Name (Optional)'
          }}
          inferDescription={
            <>
              Gemini will automatically synthesize an inline{' '}
              <code className="text-slate-200 bg-slate-800/80 px-1 py-0.5 rounded">Neo4jIO.RowMapper&lt;Row&gt;</code>{' '}
              matching the RETURN aliases in your Cypher query.
            </>
          }
          schemaFields={schemaFields}
          schemaStringPlaceholder="id:STRING:REQUIRED, name:STRING, city:STRING"
          onSchemaChange={handleSchemaChange}
          customClassId="neo4jSourceRowMapper"
          customClassName="rowMapper"
          customClassLabel="Row Mapper Class"
          customClassTooltip="Fully qualified class name or reference implementing Neo4jIO.RowMapper<T> to convert Neo4j Record to PCollection elements (withRowMapper)."
          customClassPlaceholder="com.example.PersonRowMapper"
          customClassValue={rowMapper}
          onChange={handleChange}
        />

        <PropertyField
          id="neo4jSourceParametersFunction"
          name="parametersFunction"
          label="Parameters Function Class"
          tooltip="Fully qualified class name implementing SerializableFunction<T, Map<String, Object>> extracting query parameters from input elements (withParametersFunction)."
          value={parametersFunction}
          onChange={handleChange}
          placeholder="com.example.PersonParamsFn"
          mono={true}
        />
      </div>

      {/* Authentication Section */}
      <div className="flex flex-col gap-2 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
        <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          <span>Authentication</span>
          <InfoTooltip text="Configure authentication credentials for Neo4j server. Choose None for unauthenticated instances or Google Cloud Secret Manager to reference stored username and password securely." />
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
              id="neo4jSourceUsernameSecret"
              name="usernameSecret"
              label="Username Secret"
              tooltip="GCP Secret Manager secret containing the Neo4j username."
              value={usernameSecret}
              onChange={handleChange}
              list="neo4j-source-secret-options"
              datalist={secrets.map((s) => ({ value: s.id || s.name, label: s.name || s.id }))}
              placeholder="e.g. neo4j-username"
              error={secretError}
              invalid={!!secretError}
              mono={true}
            />
            <PropertyField
              id="neo4jSourcePasswordSecret"
              name="passwordSecret"
              label="Password Secret"
              tooltip="GCP Secret Manager secret containing the Neo4j password."
              value={passwordSecret}
              onChange={handleChange}
              list="neo4j-source-secret-options"
              datalist={secrets.map((s) => ({ value: s.id || s.name, label: s.name || s.id }))}
              placeholder="e.g. neo4j-password"
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
      <CollapsibleSection
        title="Advanced Source Settings"
        isOpen={showAdvanced}
        onToggle={() => setShowAdvanced(!showAdvanced)}
      >
        <PropertyField
          id="neo4jSourceSessionConfig"
          name="sessionConfig"
          label="Session Configuration"
          tooltip="Advanced session configuration such as custom bookmarks or fetch size passed to withSessionConfig()."
          value={sessionConfig}
          onChange={handleChange}
          placeholder="e.g. defaultAccessMode=READ,fetchSize=1000"
          mono={true}
        />

        <div className="grid grid-cols-2 gap-2">
          <PropertyField
            id="neo4jSourceConnectionPoolSize"
            name="connectionPoolSize"
            label="Connection Pool Size"
            type="number"
            tooltip="Maximum connection pool size for Neo4j driver (DriverConfiguration)."
            value={connectionPoolSize}
            onChange={handleChange}
            placeholder="50"
            mono={true}
          />
          <PropertyField
            id="neo4jSourceMaxTransactionRetryTimeMs"
            name="maxTransactionRetryTimeMs"
            label="Max Retry Time (ms)"
            type="number"
            tooltip="Maximum transaction retry time in milliseconds for transient failures."
            value={maxTransactionRetryTimeMs}
            onChange={handleChange}
            placeholder="30000"
            mono={true}
          />
        </div>

        <div className="flex items-center gap-2 p-2 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
          <input
            id="neo4jSourceEncrypted"
            type="checkbox"
            name="encrypted"
            checked={encrypted}
            onChange={handleChange}
            className="rounded border-[var(--vscode-border)] text-[var(--vscode-highlight)] accent-[var(--vscode-highlight)] focus:ring-0"
          />
          <label htmlFor="neo4jSourceEncrypted" className="flex items-center gap-1.5 text-xs text-[var(--vscode-text-secondary)] cursor-pointer">
            <span>Enable TLS / Encryption</span>
            <InfoTooltip text="Enables TLS encryption for bolt connections in driver configuration." />
          </label>
        </div>
      </CollapsibleSection>

      {/* Code Generation Instructions */}
      <SystemInstructionsField
        id="neo4jSourceInstructions"
        value={systemInstructions}
        tooltip="Optional custom prompt instructions passed to the LLM code generator when synthesizing Neo4j readAll pipeline transforms."
        placeholder="e.g. Read graph nodes matching Person and map Record fields to custom POJO"
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
