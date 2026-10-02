/**
 * DatastoreIOSinkProperties Component
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Renders the property configuration panel for Apache Beam DatastoreIO sink nodes supporting
 * DatastoreIO.v1().write(), DatastoreIO.v1().deleteEntity(), and DatastoreIO.v1().deleteKey().
 * Configures GCP Project ID, database ID, namespace, mutation mode, entity key schema,
 * throughput worker hints, ramp-up throttling, authentication, and localhost emulator override.
 *
 * Architectural Decisions:
 * - Follows the "props in, events up" controlled input architecture with no local prop mirroring.
 * - Decomposed into local presentational sub-components (DatastoreSinkInstanceCard,
 *   DatastoreSinkMutationModeCard, DatastoreSinkKeyCard, DatastoreSinkThroughputCard,
 *   DatastoreSinkAuthCard, DatastoreSinkAdvancedGroup) keeping each section focused and under ~350 lines.
 * - Mutation mode selector cleanly maps to distinct Beam SDK transforms (write, deleteEntity, deleteKey).
 * - Real-time validation for required Project ID and accessible ARIA attributes.
 * - Dynamic IPC integration: listens for 'secretsLoaded' responses and issues 'getSecrets' command to extension host.
 * - Secret normalization supporting both string paths and SecretItem objects with dedicated datalist 'datastore-sink-secret-options'.
 * - Preserves system_instructions / special_instructions fallback chain for LLM code generation.
 * - Follows the 8pt grid system and Tailwind CSS styling with VS Code theme tokens.
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
 * Secret item loaded from Secret Manager for Datastore authentication.
 */
export interface SecretItem {
  id: string;
  name: string;
  fullName?: string;
}

export type DatastoreMutationMode = 'upsert' | 'deleteEntity' | 'deleteKey';

/**
 * Props for the DatastoreIOSinkProperties component.
 */
export interface DatastoreIOSinkPropertiesProps {
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
        mutationMode?: DatastoreMutationMode | string;
        kind?: string;
        keyNameOrIdField?: string;
        ancestorPath?: string;
        hintNumWorkers?: number | string;
        rampupThrottlingDisabled?: boolean;
        authMode?: 'adc' | 'secret_manager' | string;
        serviceAccountSecret?: string;
        localhost?: string;
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
 * Props for the DatastoreSinkInstanceCard component.
 */
interface SinkInstanceCardProps {
  projectId: string;
  databaseId: string;
  namespace: string;
  isProjectIdEmpty: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}

/**
 * Presentational card for target Datastore Project, Database, and Namespace.
 */
const DatastoreSinkInstanceCard: React.FC<SinkInstanceCardProps> = ({
  projectId,
  databaseId,
  namespace,
  isProjectIdEmpty,
  onChange
}) => (
  <div className="flex flex-col gap-3 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
    <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
      <span>Target Datastore Instance</span>
      <InfoTooltip text="Configures the Google Cloud Project, Datastore database, and partition namespace. Maps to DatastoreIO.v1().write().withProjectId()." />
    </label>

    <PropertyField
      id="datastoreSinkProjectId"
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
        id="datastoreSinkDatabaseId"
        name="databaseId"
        label="Database ID"
        tooltip="Datastore database ID. Defaults to (default) if unspecified. Maps to withDatabaseId()."
        value={databaseId}
        onChange={onChange}
        placeholder="(default)"
        mono={true}
      />

      <PropertyField
        id="datastoreSinkNamespace"
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

/**
 * Props for the DatastoreSinkMutationModeCard component.
 */
interface SinkMutationModeCardProps {
  mutationMode: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}

/**
 * Presentational card for mutation mode selection (write vs deleteEntity vs deleteKey).
 */
const DatastoreSinkMutationModeCard: React.FC<SinkMutationModeCardProps> = ({
  mutationMode,
  onChange
}) => (
  <div className="flex flex-col gap-3 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
    <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
      <span>Mutation Mode</span>
      <InfoTooltip text="Selects which Beam transform to apply: DatastoreIO.v1().write() for upserts, DatastoreIO.v1().deleteEntity() to delete by Entity, or DatastoreIO.v1().deleteKey() to delete by Key." />
    </label>

    <div className="flex flex-col gap-2">
      <label className="flex items-center gap-1.5 cursor-pointer text-xs text-[var(--vscode-text-secondary)]">
        <input
          type="radio"
          name="mutationMode"
          value="upsert"
          checked={mutationMode === 'upsert'}
          onChange={onChange}
          className="accent-[var(--vscode-highlight)]"
        />
        <span>Upsert Entity</span>
      </label>
      <label className="flex items-center gap-1.5 cursor-pointer text-xs text-[var(--vscode-text-secondary)]">
        <input
          type="radio"
          name="mutationMode"
          value="deleteEntity"
          checked={mutationMode === 'deleteEntity'}
          onChange={onChange}
          className="accent-[var(--vscode-highlight)]"
        />
        <span>Delete Entity</span>
      </label>
      <label className="flex items-center gap-1.5 cursor-pointer text-xs text-[var(--vscode-text-secondary)]">
        <input
          type="radio"
          name="mutationMode"
          value="deleteKey"
          checked={mutationMode === 'deleteKey'}
          onChange={onChange}
          className="accent-[var(--vscode-highlight)]"
        />
        <span>Delete Key</span>
      </label>
    </div>
  </div>
);

/**
 * Props for the DatastoreSinkKeyCard component.
 */
interface SinkKeyCardProps {
  kind: string;
  keyNameOrIdField: string;
  ancestorPath: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}

/**
 * Presentational card for Kind and key property configuration.
 */
const DatastoreSinkKeyCard: React.FC<SinkKeyCardProps> = ({
  kind,
  keyNameOrIdField,
  ancestorPath,
  onChange
}) => (
  <div className="flex flex-col gap-3 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
    <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
      <span>Entity Key Configuration</span>
      <InfoTooltip text="Specifies kind, key identifier field, and ancestor path used when building or deleting Datastore entity keys." />
    </label>

    <PropertyField
      id="datastoreSinkKind"
      name="kind"
      label="Kind"
      tooltip="Datastore entity kind name for mutation records (e.g. Task, SensorRollup)."
      value={kind}
      onChange={onChange}
      placeholder="e.g. SensorRollup"
      mono={true}
    />

    <div className="grid grid-cols-2 gap-2">
      <PropertyField
        id="datastoreSinkKeyNameOrIdField"
        name="keyNameOrIdField"
        label="Key Name / ID Field"
        tooltip="Name of the record property providing the primary key identifier (string name or numeric ID)."
        value={keyNameOrIdField}
        onChange={onChange}
        placeholder="e.g. rollupId"
        mono={true}
      />

      <PropertyField
        id="datastoreSinkAncestorPath"
        name="ancestorPath"
        label="Ancestor Path"
        tooltip="Optional ancestor key hierarchy path (e.g. Workspace/123/Project/456)."
        value={ancestorPath}
        onChange={onChange}
        placeholder="e.g. ParentKind/parent-id"
        mono={true}
      />
    </div>
  </div>
);

/**
 * Props for the DatastoreSinkThroughputCard component.
 */
interface SinkThroughputCardProps {
  hintNumWorkers: number | string;
  rampupThrottlingDisabled: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}

/**
 * Presentational card for worker hints and rate limiting ramp-up controls.
 */
const DatastoreSinkThroughputCard: React.FC<SinkThroughputCardProps> = ({
  hintNumWorkers,
  rampupThrottlingDisabled,
  onChange
}) => (
  <div className="flex flex-col gap-3 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
    <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
      <span>Throughput & Throttling</span>
      <InfoTooltip text="Configures worker hints and ramp-up rate limiting to prevent overloading Cloud Datastore instances." />
    </label>

    <PropertyField
      id="datastoreSinkHintNumWorkers"
      name="hintNumWorkers"
      label="Worker Count Hint"
      type="number"
      tooltip="Provides a hint about the expected worker count to calibrate rate-limiting ramp-up. Maps to withHintNumWorkers()."
      value={hintNumWorkers}
      onChange={onChange}
      placeholder="e.g. 5"
      mono={true}
    />

    <div className="flex items-center gap-2 p-2 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
      <input
        id="datastoreSinkRampupThrottlingDisabled"
        type="checkbox"
        name="rampupThrottlingDisabled"
        checked={rampupThrottlingDisabled}
        onChange={onChange}
        className="rounded border-[var(--vscode-border)] text-[var(--vscode-highlight)] accent-[var(--vscode-highlight)] focus:ring-0"
      />
      <label htmlFor="datastoreSinkRampupThrottlingDisabled" className="flex items-center gap-1.5 text-xs text-[var(--vscode-text-secondary)] cursor-pointer">
        <span>Disable Ramp-up Throttling</span>
        <InfoTooltip text="Disables the gradual ramp-up rate limiter. Maps to withRampupThrottlingDisabled(). Caution: increases risk of overloading Datastore." />
      </label>
    </div>
  </div>
);

/**
 * Props for the DatastoreSinkAuthCard component.
 */
interface SinkAuthCardProps {
  authMode: string;
  serviceAccountSecret: string;
  secrets: SecretItem[];
  secretError: string | null;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}

/**
 * Presentational card for Datastore authentication credentials in sink.
 */
const DatastoreSinkAuthCard: React.FC<SinkAuthCardProps> = ({
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
          id="datastoreSinkSecret"
          name="serviceAccountSecret"
          label="Service Account Key Secret"
          tooltip="Google Cloud Secret Manager secret containing the service account JSON credentials key."
          value={serviceAccountSecret}
          onChange={onChange}
          list="datastore-sink-secret-options"
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

/**
 * Props for the DatastoreSinkAdvancedGroup component.
 */
interface SinkAdvancedGroupProps {
  showAdvanced: boolean;
  localhost: string;
  batchSize: number | string;
  onToggle: () => void;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}

/**
 * Presentational collapsible group for advanced Datastore write tuning parameters.
 */
const DatastoreSinkAdvancedGroup: React.FC<SinkAdvancedGroupProps> = ({
  showAdvanced,
  localhost,
  batchSize,
  onToggle,
  onChange
}) => (
  <CollapsibleSection
    title="Advanced Sink Settings"
    isOpen={showAdvanced}
    onToggle={onToggle}
  >
    <PropertyField
      id="datastoreSinkLocalhost"
      name="localhost"
      label="Localhost Emulator Endpoint"
      tooltip="Directs API requests to a local Cloud Datastore emulator host:port (e.g. localhost:8081). Maps to withLocalhost()."
      value={localhost}
      onChange={onChange}
      placeholder="localhost:8081"
      mono={true}
    />

    <PropertyField
      id="datastoreSinkBatchSize"
      name="batchSize"
      label="Batch Size"
      type="number"
      tooltip="Note: DatastoreV1 write transforms do not have a withBatchSize() builder; the SDK automatically batches entities dynamically up to Cloud Datastore's 500-mutation RPC limit. This property serves as a pipeline configuration hint for client-side batching."
      value={batchSize}
      onChange={onChange}
      placeholder="500"
      mono={true}
    />

    <div className="p-2 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)] text-xs text-[var(--vscode-text-secondary)]">
      <span>Datastore write operations automatically perform exponential backoff retries and gradual ramp-up rate throttling to prevent transaction contention.</span>
    </div>
  </CollapsibleSection>
);

/**
 * DatastoreIOSinkProperties renders the configuration form for Datastore write and delete transforms.
 *
 * @param props Component properties containing the active node and onChange callback
 */
export const DatastoreIOSinkProperties: React.FC<DatastoreIOSinkPropertiesProps> = ({ node, onChange }) => {
  const properties = node.data.properties || {};

  // Form field state extracted from node properties
  const projectId = properties.projectId ?? '';
  const databaseId = properties.databaseId ?? '';
  const namespace = properties.namespace ?? '';
  const mutationMode = properties.mutationMode ?? 'upsert';
  const kind = properties.kind ?? '';
  const keyNameOrIdField = properties.keyNameOrIdField ?? '';
  const ancestorPath = properties.ancestorPath ?? '';
  const hintNumWorkers = properties.hintNumWorkers ?? '';
  const rampupThrottlingDisabled = properties.rampupThrottlingDisabled ?? false;
  const authMode = properties.authMode ?? 'adc';
  const serviceAccountSecret = properties.serviceAccountSecret ?? '';
  const localhost = properties.localhost ?? '';
  const batchSize = properties.batchSize ?? '';

  // Local state for dynamically loaded Secret Manager resources and UI state
  const { items: rawSecrets, error: secretError } = useAssetLoader<SecretItem | string>('secrets');
  const secrets: SecretItem[] = (rawSecrets || []).map(normalizeSecretItem);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Field validation
  const isProjectIdEmpty = !String(projectId).trim();

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


  return (
    <div className="flex-1 flex flex-col gap-4 text-[var(--vscode-text-primary)] text-sm">
      <DatastoreSinkInstanceCard
        projectId={projectId}
        databaseId={databaseId}
        namespace={namespace}
        isProjectIdEmpty={isProjectIdEmpty}
        onChange={handleChange}
      />

      <DatastoreSinkMutationModeCard
        mutationMode={mutationMode}
        onChange={handleChange}
      />

      <DatastoreSinkKeyCard
        kind={kind}
        keyNameOrIdField={keyNameOrIdField}
        ancestorPath={ancestorPath}
        onChange={handleChange}
      />

      <DatastoreSinkThroughputCard
        hintNumWorkers={hintNumWorkers}
        rampupThrottlingDisabled={rampupThrottlingDisabled}
        onChange={handleChange}
      />

      <DatastoreSinkAuthCard
        authMode={authMode}
        serviceAccountSecret={serviceAccountSecret}
        secrets={secrets}
        secretError={secretError}
        onChange={handleChange}
      />

      <DatastoreSinkAdvancedGroup
        showAdvanced={showAdvanced}
        localhost={localhost}
        batchSize={batchSize}
        onToggle={() => setShowAdvanced(!showAdvanced)}
        onChange={handleChange}
      />

      <SystemInstructionsField
        id="datastoreSinkInstructions"
        value={systemInstructions}
        tooltip="Optional instructions passed to LLM code generator when synthesizing DatastoreIO pipelines."
        placeholder="e.g. Write SensorRollup entities to Datastore using DatastoreIO.v1().write()"
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
