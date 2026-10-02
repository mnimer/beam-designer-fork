/**
 * DatastoreIOSourceProperties Component
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Renders the property configuration panel for Apache Beam DatastoreIO.v1().read() source nodes.
 * Configures GCP Project ID, database ID, namespace, query mode (kind-based structured query vs literal GQL),
 * read parallelism splits, authentication (ADC vs Secret Manager), and advanced emulator/consistency settings.
 *
 * Architectural Decisions:
 * - Follows the "props in, events up" controlled input architecture with no local prop mirroring.
 * - Decomposed into local presentational sub-components (DatastoreSourceInstanceCard, DatastoreSourceQueryCard,
 *   DatastoreSourceAuthCard, DatastoreSourceAdvancedGroup) keeping each section focused and under ~350 lines.
 * - Dynamic query mode toggle between structured Kind read and Literal GQL query (withLiteralGqlQuery).
 * - Real-time validation for Project ID, Kind (in kind mode), and GQL Query (in gql mode) with accessible ARIA tags.
 * - Dynamic IPC integration: listens for 'secretsLoaded' responses and issues 'getSecrets' command to extension host.
 * - Secret normalization supporting both string paths and SecretItem objects with dedicated datalist 'datastore-source-secret-options'.
 * - Preserves system_instructions / special_instructions fallback chain for LLM code generation.
 * - Follows the 8pt grid system and Tailwind CSS styling with VS Code theme tokens.
 */

import React, { useState } from 'react';
import { CollapsibleSection } from '../../components/common/CollapsibleSection';
import { InfoTooltip } from '../../components/InfoTooltip';
import { PropertyField } from '../../components/common/PropertyField';
import { SystemInstructionsField } from '../../components/common/SystemInstructionsField';
import { resolveSystemInstructions } from '../../utils/systemInstructions';
import { useAssetLoader } from '../../hooks/useAssetLoader';
import { normalizeSecretItem } from '../../components/common/SecretManagerAuthFields';

/** Secret descriptor loaded from the secret manager for Datastore authentication. */
export interface SecretItem {
  id: string;
  name: string;
  fullName?: string;
}

export type DatastoreQueryMode = 'kind' | 'gql';
export type DatastoreReadConsistency = 'EVENTUAL' | 'STRONG';

/** Props for the {@link DatastoreIOSourceProperties} component. */
export interface DatastoreIOSourcePropertiesProps {
  node: {
    data: {
      label?: string;
      beam_transform?: string;
      system_instructions?: string;
      special_instructions?: string;
      properties?: {
        projectId?: string;
        databaseId?: string;
        namespace?: string;
        queryMode?: DatastoreQueryMode | string;
        kind?: string;
        filter?: string;
        gqlQuery?: string;
        numQuerySplits?: number | string;
        authMode?: 'adc' | 'secret_manager' | string;
        serviceAccountSecret?: string;
        localhost?: string;
        readConsistency?: DatastoreReadConsistency | string;
        entityParseFn?: string;
        system_instructions?: string;
        special_instructions?: string;
        [key: string]: any;
      };
    };
  };
  onChange: (properties: any) => void;
}

/** Props for the Datastore instance configuration subcard. */
interface InstanceCardProps {
  projectId: string;
  databaseId: string;
  namespace: string;
  isProjectIdEmpty: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}

/**
 * Presentational card for target Datastore Project, Database, and Namespace.
 */
const DatastoreSourceInstanceCard: React.FC<InstanceCardProps> = ({
  projectId,
  databaseId,
  namespace,
  isProjectIdEmpty,
  onChange
}) => (
  <div className="flex flex-col gap-3 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
    <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
      <span>Target Datastore Instance</span>
      <InfoTooltip text="Configures the Google Cloud Project, Datastore database, and partition namespace. Maps to DatastoreIO.v1().read().withProjectId()." />
    </label>

    <PropertyField
      id="datastoreSourceProjectId"
      name="projectId"
      label="GCP Project ID"
      required="Project ID is required"
      tooltip="Google Cloud Platform Project ID hosting Cloud Datastore. Maps to withProjectId(). Required."
      value={projectId}
      invalid={isProjectIdEmpty}
      error={isProjectIdEmpty ? 'Project ID is required' : null}
      placeholder="my-gcp-project"
      onChange={onChange}
      mono={true}
    />

    <div className="grid grid-cols-2 gap-2">
      <PropertyField
        id="datastoreSourceDatabaseId"
        name="databaseId"
        label="Database ID"
        tooltip="Datastore database ID. Defaults to (default) if unspecified. Maps to withDatabaseId()."
        value={databaseId}
        onChange={onChange}
        placeholder="(default)"
        mono={true}
      />

      <PropertyField
        id="datastoreSourceNamespace"
        name="namespace"
        label="Namespace"
        tooltip="Optional namespace partition string for multi-tenant Datastore separation. Maps to withNamespace()."
        value={namespace}
        onChange={onChange}
        placeholder="e.g. production"
        mono={true}
      />
    </div>
  </div>
);

/** Props for the Datastore query configuration subcard. */
interface QueryCardProps {
  queryMode: string;
  kind: string;
  filter: string;
  gqlQuery: string;
  numQuerySplits: number | string;
  isKindEmpty: boolean;
  isGqlQueryEmpty: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}

/**
 * Presentational card for Kind query and literal GQL query configurations.
 */
const DatastoreSourceQueryCard: React.FC<QueryCardProps> = ({
  queryMode,
  kind,
  filter,
  gqlQuery,
  numQuerySplits,
  isKindEmpty,
  isGqlQueryEmpty,
  onChange
}) => (
  <div className="flex flex-col gap-3 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
    <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
      <span>Query Configuration</span>
      <InfoTooltip text="Select between structured Kind query and literal GQL query string." />
    </label>

    <div className="flex gap-4">
      <label className="flex items-center gap-1.5 cursor-pointer text-xs text-[var(--vscode-text-secondary)]">
        <input
          type="radio"
          name="queryMode"
          value="kind"
          checked={queryMode === 'kind'}
          onChange={onChange}
          className="accent-[var(--vscode-highlight)]"
        />
        <span>Kind & Filter</span>
      </label>
      <label className="flex items-center gap-1.5 cursor-pointer text-xs text-[var(--vscode-text-secondary)]">
        <input
          type="radio"
          name="queryMode"
          value="gql"
          checked={queryMode === 'gql'}
          onChange={onChange}
          className="accent-[var(--vscode-highlight)]"
        />
        <span>Literal GQL Query</span>
      </label>
    </div>

    {queryMode === 'kind' && (
      <div className="flex flex-col gap-3 mt-1 pl-2 border-l-2 border-[var(--vscode-highlight)]/50">
        <PropertyField
          id="datastoreSourceKind"
          name="kind"
          label="Kind"
          required="Kind is required for kind-based read"
          tooltip="Datastore entity kind name to query (e.g. Task, User). Required in Kind mode."
          value={kind}
          invalid={isKindEmpty}
          error={isKindEmpty ? 'Kind is required for kind-based read' : null}
          placeholder="e.g. Task"
          onChange={onChange}
          mono={true}
        />

        <PropertyField
          id="datastoreSourceFilter"
          name="filter"
          label="Query Filter"
          tooltip="Optional property filter condition applied to the query (e.g. done = false)."
          value={filter}
          onChange={onChange}
          placeholder="e.g. status = 'ACTIVE'"
          mono={true}
        />
      </div>
    )}

    {queryMode === 'gql' && (
      <div className="flex flex-col gap-3 mt-1 pl-2 border-l-2 border-[var(--vscode-highlight)]/50">
        <PropertyField
          id="datastoreSourceGqlQuery"
          name="gqlQuery"
          label="Literal GQL Query"
          required="GQL query is required in GQL mode"
          tooltip="GQL query string to execute. Maps to withLiteralGqlQuery(). Required in GQL mode."
          type="textarea"
          rows={3}
          value={gqlQuery}
          invalid={isGqlQueryEmpty}
          error={isGqlQueryEmpty ? 'GQL query is required in GQL mode' : null}
          placeholder="SELECT * FROM Task WHERE done = FALSE"
          onChange={onChange}
          mono={true}
        />
      </div>
    )}

    <PropertyField
      id="datastoreSourceNumQuerySplits"
      name="numQuerySplits"
      label="Query Splits"
      type="number"
      tooltip="Suggested number of parallel query splits for large datasets. Set to 0 to dynamically choose splits at runtime. Maps to withNumQuerySplits()."
      value={numQuerySplits}
      onChange={onChange}
      placeholder="0 (auto-detect)"
      mono={true}
    />
  </div>
);

/** Props for the Datastore authentication subcard. */
interface AuthCardProps {
  authMode: string;
  serviceAccountSecret: string;
  secrets: SecretItem[];
  secretError: string | null;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}

/**
 * Presentational card for Datastore authentication credentials.
 */
const DatastoreSourceAuthCard: React.FC<AuthCardProps> = ({
  authMode,
  serviceAccountSecret,
  secrets,
  secretError,
  onChange
}) => (
  <div className="flex flex-col gap-3 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
    <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
      <span>Authentication</span>
      <InfoTooltip text="Choose authentication strategy: Application Default Credentials (ADC) or GCP Secret Manager service account key." />
    </label>
    <div className="flex gap-4">
      <label className="flex items-center gap-1.5 cursor-pointer text-xs text-[var(--vscode-text-secondary)]">
        <input
          type="radio"
          name="authMode"
          value="adc"
          checked={authMode === 'adc'}
          onChange={onChange}
          className="accent-[var(--vscode-highlight)]"
        />
        <span>Application Default Credentials (ADC)</span>
      </label>
      <label className="flex items-center gap-1.5 cursor-pointer text-xs text-[var(--vscode-text-secondary)]">
        <input
          type="radio"
          name="authMode"
          value="secret_manager"
          checked={authMode === 'secret_manager'}
          onChange={onChange}
          className="accent-[var(--vscode-highlight)]"
        />
        <span>Secret Manager</span>
      </label>
    </div>

    {authMode === 'secret_manager' && (
      <div className="flex flex-col gap-3 mt-1">
        <PropertyField
          id="datastoreSourceSecret"
          name="serviceAccountSecret"
          label="Service Account Key Secret"
          tooltip="Google Cloud Secret Manager secret containing the service account JSON credentials key."
          value={serviceAccountSecret}
          onChange={onChange}
          list="datastore-source-secret-options"
          datalist={secrets.map((s) => ({ value: s.id || s.name, label: s.name || s.id }))}
          placeholder="e.g. datastore-sa-key"
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
);

/** Props for the Datastore advanced settings collapsible group. */
interface AdvancedGroupProps {
  showAdvanced: boolean;
  localhost: string;
  readConsistency: string;
  entityParseFn: string;
  onToggle: () => void;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}

/**
 * Presentational collapsible group for advanced Datastore read tuning parameters.
 */
const DatastoreSourceAdvancedGroup: React.FC<AdvancedGroupProps> = ({
  showAdvanced,
  localhost,
  readConsistency,
  entityParseFn,
  onToggle,
  onChange
}) => (
  <CollapsibleSection
    title="Advanced Source Settings"
    isOpen={showAdvanced}
    onToggle={onToggle}
  >
    <PropertyField
      id="datastoreSourceLocalhost"
      name="localhost"
      label="Localhost Emulator Endpoint"
      tooltip="Directs API requests to a local Cloud Datastore emulator host:port (e.g. localhost:8081). Maps to withLocalhost()."
      value={localhost}
      onChange={onChange}
      placeholder="localhost:8081"
      mono={true}
    />

    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <label
          htmlFor="datastoreSourceReadConsistency"
          className="text-xs font-bold uppercase text-[var(--vscode-text-muted)]"
        >
          Read Consistency
        </label>
        <InfoTooltip text="DatastoreIO.v1().read() has no read-consistency builder because parallel split queries in Datastore are inherently eventually consistent. STRONG consistency is only applicable to ancestor or single-key lookups executed via client calls inside a DoFn." />
      </div>
      <select
        id="datastoreSourceReadConsistency"
        name="readConsistency"
        value={readConsistency}
        onChange={onChange}
        className="bg-[var(--vscode-input-bg)] text-[var(--vscode-text-primary)] p-2 rounded border border-[var(--vscode-border)] text-xs focus:outline-none focus:border-[var(--vscode-highlight)]"
      >
        <option value="EVENTUAL">EVENTUAL</option>
        <option value="STRONG">STRONG</option>
      </select>
    </div>

    <PropertyField
      id="datastoreSourceEntityParseFn"
      name="entityParseFn"
      label="Entity Parse Function"
      tooltip="Optional DoFn or parse function name converting Entity protocol buffer objects into Beam Rows or POJOs."
      value={entityParseFn}
      onChange={onChange}
      placeholder="com.example.EntityToRowFn"
      mono={true}
    />
  </CollapsibleSection>
);

/**
 * DatastoreIOSourceProperties renders the configuration form for DatastoreIO.v1().read() transforms.
 *
 * @param props Component properties containing the active node and onChange callback
 */
export const DatastoreIOSourceProperties: React.FC<DatastoreIOSourcePropertiesProps> = ({ node, onChange }) => {
  const properties = node.data.properties || {};

  // Form field state extracted from node properties
  const projectId = properties.projectId ?? '';
  const databaseId = properties.databaseId ?? '';
  const namespace = properties.namespace ?? '';
  const queryMode = properties.queryMode ?? 'kind';
  const kind = properties.kind ?? '';
  const filter = properties.filter ?? '';
  const gqlQuery = properties.gqlQuery ?? '';
  const numQuerySplits = properties.numQuerySplits ?? '';
  const authMode = properties.authMode ?? 'adc';
  const serviceAccountSecret = properties.serviceAccountSecret ?? '';
  const localhost = properties.localhost ?? '';
  const readConsistency = properties.readConsistency ?? 'EVENTUAL';
  const entityParseFn = properties.entityParseFn ?? '';

  // Local state for dynamically loaded Secret Manager resources and UI state
  const { items: rawSecrets, error: secretError } = useAssetLoader<SecretItem | string>('secrets');
  const secrets: SecretItem[] = (rawSecrets || []).map(normalizeSecretItem);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Field validation
  const isProjectIdEmpty = !String(projectId).trim();
  const isKindEmpty = queryMode === 'kind' && !String(kind).trim();
  const isGqlQueryEmpty = queryMode === 'gql' && !String(gqlQuery).trim();

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

  /**
   * Handles system instructions textarea modification.
   *
   * @param e React textarea change event
   */
  return (
    <div className="flex-1 flex flex-col gap-4 text-[var(--vscode-text-primary)] text-sm">
      <DatastoreSourceInstanceCard
        projectId={projectId}
        databaseId={databaseId}
        namespace={namespace}
        isProjectIdEmpty={isProjectIdEmpty}
        onChange={handleChange}
      />

      <DatastoreSourceQueryCard
        queryMode={queryMode}
        kind={kind}
        filter={filter}
        gqlQuery={gqlQuery}
        numQuerySplits={numQuerySplits}
        isKindEmpty={isKindEmpty}
        isGqlQueryEmpty={isGqlQueryEmpty}
        onChange={handleChange}
      />

      <DatastoreSourceAuthCard
        authMode={authMode}
        serviceAccountSecret={serviceAccountSecret}
        secrets={secrets}
        secretError={secretError}
        onChange={handleChange}
      />

      <DatastoreSourceAdvancedGroup
        showAdvanced={showAdvanced}
        localhost={localhost}
        readConsistency={readConsistency}
        entityParseFn={entityParseFn}
        onToggle={() => setShowAdvanced(!showAdvanced)}
        onChange={handleChange}
      />

      {/* Code Generation Instructions */}
      <SystemInstructionsField
        id="datastoreSourceInstructions"
        value={systemInstructions}
        tooltip="Optional instructions passed to LLM code generator when synthesizing DatastoreIO pipelines."
        placeholder="e.g. Read Task entities from Datastore and map properties to Schema Row PCollection"
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
