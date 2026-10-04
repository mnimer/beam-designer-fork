/**
 * Neo4jIOSinkProperties Component
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Renders the property configuration panel for Apache Beam Neo4jIO Sink nodes
 * (org.apache.beam.sdk.io.neo4j.Neo4jIO.writeUnwind() in Java SDK / cross-language in Python).
 * Configures connection URL, database name, UNWIND map name binding, Cypher write statement,
 * batch size, Cypher logging, Secret Manager credentials, and advanced driver options.
 *
 * Architectural Decisions:
 * - Controlled inputs adhering to "props in, events up" unidirectional data flow.
 * - Connection URL validation: Verifies URL presence and flags format warning if scheme is not neo4j://, neo4j+s://, bolt://, or bolt+s://.
 * - Required unwindMapName and Cypher: Both are required for writeUnwind() batch operations.
 * - Dynamic discovery: Requests GCP Secret Manager secrets via 'getSecrets' IPC message to securely bind username and password.
 * - Unique datalist ID: Uses 'neo4j-sink-secret-options' to avoid datalist id collisions across panels.
 * - Collapsible Advanced Sink Settings: Organizes transaction retry time, connection pool size, and TLS encryption.
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
 * Props for the Neo4jIOSinkProperties component.
 */
export interface Neo4jIOSinkPropertiesProps {
  node: {
    data: {
      label?: string;
      beam_transform?: string;
      system_instructions?: string;
      special_instructions?: string;
      properties?: {
        url?: string;
        database?: string;
        unwindMapName?: string;
        cypher?: string;
        batchSize?: number | string;
        cypherLogging?: boolean;
        authMode?: 'none' | 'secret_manager';
        usernameSecret?: string;
        passwordSecret?: string;
        maxTransactionRetryTimeMs?: number | string;
        connectionPoolSize?: number | string;
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
 * Neo4jIOSinkProperties renders the configuration panel for Neo4jIO sink writes.
 *
 * @param props Component properties containing the active node and onChange callback
 */
export const Neo4jIOSinkProperties: React.FC<Neo4jIOSinkPropertiesProps> = ({ node, onChange }) => {
  const properties = node.data?.properties || {};

  // Form field state extracted from node properties
  const url = properties.url || '';
  const database = properties.database !== undefined ? properties.database : 'neo4j';
  const unwindMapName = properties.unwindMapName || '';
  const cypher = properties.cypher || '';
  const batchSize = properties.batchSize !== undefined && properties.batchSize !== null ? properties.batchSize : '';
  const cypherLogging = properties.cypherLogging ?? false;
  const authMode = properties.authMode || 'none';
  const usernameSecret = properties.usernameSecret || '';
  const passwordSecret = properties.passwordSecret || '';
  const maxTransactionRetryTimeMs = properties.maxTransactionRetryTimeMs !== undefined && properties.maxTransactionRetryTimeMs !== null ? properties.maxTransactionRetryTimeMs : '';
  const connectionPoolSize = properties.connectionPoolSize !== undefined && properties.connectionPoolSize !== null ? properties.connectionPoolSize : '';
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
  const isUnwindMapNameEmpty = !unwindMapName.trim();
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

  return (
    <div className="flex-1 flex flex-col gap-4 text-[var(--vscode-text-primary)] text-sm">
      {/* Connection & Database Card */}
      <div className="flex flex-col gap-3 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
        <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          <span>Neo4j Destination Connection</span>
          <InfoTooltip text="Connection URI and database target for Neo4jIO.DriverConfiguration." />
        </label>

        <PropertyField
          id="neo4jSinkUrl"
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
          id="neo4jSinkDatabase"
          name="database"
          label="Database Name"
          tooltip="Target Neo4j database name (e.g. 'neo4j' or 'system'). Defaults to 'neo4j'."
          value={database}
          onChange={handleChange}
          placeholder="neo4j"
          mono={true}
        />
      </div>

      {/* Unwind Write Parameters Card */}
      <div className="flex flex-col gap-3 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
        <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          <span>UNWIND Write Specification</span>
          <InfoTooltip text="Parameters configuring Neo4jIO.writeUnwind(), which collects incoming elements into batches and applies an UNWIND Cypher statement." />
        </label>

        <PropertyField
          id="neo4jSinkUnwindMapName"
          name="unwindMapName"
          label="Unwind Map Name"
          required="Unwind map name is required"
          tooltip="The parameter name representing the collection in the UNWIND clause (e.g. 'rows' for 'UNWIND $rows AS row') (withUnwindMapName). Required."
          value={unwindMapName}
          invalid={isUnwindMapNameEmpty}
          error={isUnwindMapNameEmpty ? 'Unwind map name is required' : null}
          placeholder="e.g. rows"
          onChange={handleChange}
          mono={true}
        />

        <PropertyField
          id="neo4jSinkCypher"
          name="cypher"
          label="Cypher Write Statement"
          required="Cypher write statement is required"
          tooltip="Cypher write statement utilizing the UNWIND clause to create or update nodes/relationships in batches (withCypher). Required."
          type="textarea"
          rows={3}
          value={cypher}
          invalid={isCypherEmpty}
          error={isCypherEmpty ? 'Cypher write statement is required' : null}
          placeholder="UNWIND $rows AS row MERGE (p:Person {id: row.id}) SET p.name = row.name"
          onChange={handleChange}
          mono={true}
        />

        <div className="grid grid-cols-2 gap-2">
          <PropertyField
            id="neo4jSinkBatchSize"
            name="batchSize"
            label="Batch Size"
            type="number"
            tooltip="Number of records to collect and execute in each UNWIND batch (withBatchSize). Defaults to connector default."
            value={batchSize}
            onChange={handleChange}
            placeholder="1000"
            mono={true}
          />
          <div className="flex flex-col justify-end pb-1">
            <div className="flex items-center gap-2 p-2 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
              <input
                id="neo4jSinkCypherLogging"
                type="checkbox"
                name="cypherLogging"
                checked={cypherLogging}
                onChange={handleChange}
                className="rounded border-[var(--vscode-border)] text-[var(--vscode-highlight)] accent-[var(--vscode-highlight)] focus:ring-0"
              />
              <label htmlFor="neo4jSinkCypherLogging" className="flex items-center gap-1.5 text-xs text-[var(--vscode-text-secondary)] cursor-pointer">
                <span>Cypher Logging</span>
                <InfoTooltip text="Enables logging of Cypher write queries and parameters during execution (withCypherLogging)." />
              </label>
            </div>
          </div>
        </div>
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
              id="neo4jSinkUsernameSecret"
              name="usernameSecret"
              label="Username Secret"
              tooltip="GCP Secret Manager secret containing the Neo4j username."
              value={usernameSecret}
              onChange={handleChange}
              list="neo4j-sink-secret-options"
              datalist={secrets.map((s) => ({ value: s.id || s.name, label: s.name || s.id }))}
              placeholder="e.g. neo4j-username"
              error={secretError}
              invalid={!!secretError}
              mono={true}
            />
            <PropertyField
              id="neo4jSinkPasswordSecret"
              name="passwordSecret"
              label="Password Secret"
              tooltip="GCP Secret Manager secret containing the Neo4j password."
              value={passwordSecret}
              onChange={handleChange}
              list="neo4j-sink-secret-options"
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

      {/* Collapsible Advanced Sink Settings */}
      <CollapsibleSection
        title="Advanced Sink Settings"
        isOpen={showAdvanced}
        onToggle={() => setShowAdvanced(!showAdvanced)}
      >
        <div className="grid grid-cols-2 gap-2">
          <PropertyField
            id="neo4jSinkMaxTransactionRetryTimeMs"
            name="maxTransactionRetryTimeMs"
            label="Max Retry Time (ms)"
            type="number"
            tooltip="Maximum transaction retry time in milliseconds for transient write failures."
            value={maxTransactionRetryTimeMs}
            onChange={handleChange}
            placeholder="30000"
            mono={true}
          />
          <PropertyField
            id="neo4jSinkConnectionPoolSize"
            name="connectionPoolSize"
            label="Connection Pool Size"
            type="number"
            tooltip="Maximum connection pool size for Neo4j driver (DriverConfiguration)."
            value={connectionPoolSize}
            onChange={handleChange}
            placeholder="50"
            mono={true}
          />
        </div>

        <div className="flex items-center gap-2 p-2 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
          <input
            id="neo4jSinkEncrypted"
            type="checkbox"
            name="encrypted"
            checked={encrypted}
            onChange={handleChange}
            className="rounded border-[var(--vscode-border)] text-[var(--vscode-highlight)] accent-[var(--vscode-highlight)] focus:ring-0"
          />
          <label htmlFor="neo4jSinkEncrypted" className="flex items-center gap-1.5 text-xs text-[var(--vscode-text-secondary)] cursor-pointer">
            <span>Enable TLS / Encryption</span>
            <InfoTooltip text="Enables TLS encryption for bolt connections in driver configuration." />
          </label>
        </div>
      </CollapsibleSection>

      {/* Code Generation Instructions */}
      <SystemInstructionsField
        id="neo4jSinkInstructions"
        value={systemInstructions}
        tooltip="Optional custom prompt instructions passed to the LLM code generator when synthesizing Neo4j writeUnwind pipeline transforms."
        placeholder="e.g. Write elements to Neo4j using writeUnwind with MERGE on Person nodes"
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
