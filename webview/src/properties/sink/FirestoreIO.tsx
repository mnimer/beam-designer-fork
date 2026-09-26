/**
 * FirestoreIOSinkProperties Component
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Renders the property configuration panel for Apache Beam FirestoreIO.v1().write().batchWrite() sink nodes.
 * Configures GCP Project ID, database ID, target collection, write mutation operation (update, delete, transform),
 * document ID source field, merge field paths, batch write failure handling and dead-letter queue options,
 * authentication (ADC vs GCP Secret Manager), and collapsible Advanced Sink Settings (emulator host override
 * and RpcQosOptions tuning).
 *
 * Architectural Decisions:
 * - Controlled inputs architecture ("props in, events up") with no local prop mirroring.
 * - Decomposed into local presentational sub-components:
 *   - FirestoreSinkTargetCard: Project ID, Database ID, Target Collection.
 *   - FirestoreSinkOperationCard: Write operation (update, delete, transform), document ID field, merge fields.
 *   - FirestoreSinkBatchCard: Dead-letter queue toggle, batch size / worker hints, failure mode.
 *   - FirestoreSinkAuthCard: ADC vs GCP Secret Manager credentials with IPC datalist integration.
 *   - FirestoreSinkAdvancedGroup: Collapsible RPC QoS options and emulator override.
 * - Write operation mapping:
 *   - update: Mutates/merges documents. Note: Java pipeline expects PCollection<com.google.firestore.v1.Write>.
 *   - delete: Deletes specified documents via delete mutations.
 *   - transform: Server-side transform operations (e.g. server timestamp, array union, increment).
 * - Real-time validation for Project ID and Target Collection with accessible ARIA tags and red border alerts.
 * - Dynamic IPC integration: listens for 'secretsLoaded' responses and issues 'getSecrets' command to extension host.
 * - Datalist ID 'firestore-sink-secret-options' per connector/role scope isolation.
 * - Preserves system_instructions / special_instructions fallback chain for LLM code generation, emphasizing the
 *   PCollection<com.google.firestore.v1.Write> contract.
 * - Follows the 8pt grid system and Tailwind CSS styling with VS Code theme tokens.
 */

import React, { useState } from 'react';
import { InfoTooltip } from '../../components/InfoTooltip';
import { PropertyField } from '../../components/common/PropertyField';
import { useAssetLoader } from '../../hooks/useAssetLoader';
import { normalizeSecretItem } from '../../components/common/SecretManagerAuthFields';

export interface SecretItem {
  id: string;
  name: string;
  fullName?: string;
}

export type FirestoreWriteOperation = 'update' | 'delete' | 'transform';
export type FirestoreFailureMode = 'fail_pipeline' | 'dead_letter_queue';

export interface FirestoreIOSinkPropertiesProps {
  node: {
    data: {
      label?: string;
      beam_transform?: string;
      system_instructions?: string;
      special_instructions?: string;
      properties?: {
        projectId?: string;
        databaseId?: string;
        targetCollection?: string;
        operation?: FirestoreWriteOperation | string;
        documentIdField?: string;
        mergeFields?: string;
        // Batch write tuning
        withDeadLetterQueue?: boolean;
        batchSize?: number | string;
        hintMaxNumWorkers?: number | string;
        failureHandling?: FirestoreFailureMode | string;
        // Auth
        authMode?: 'adc' | 'secret_manager' | string;
        serviceAccountSecret?: string;
        // Advanced
        emulatorHost?: string;
        initialBackoffMs?: number | string;
        maxAttempts?: number | string;
        throttling?: boolean;
        system_instructions?: string;
        special_instructions?: string;
        [key: string]: any;
      };
    };
  };
  onChange: (properties: any) => void;
}

interface TargetCardProps {
  projectId: string;
  databaseId: string;
  targetCollection: string;
  isProjectIdEmpty: boolean;
  isTargetCollectionEmpty: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}

/**
 * Presentational card for target Firestore instance and collection.
 *
 * @param props TargetCardProps containing project, database, and target collection
 */
const FirestoreSinkTargetCard: React.FC<TargetCardProps> = ({
  projectId,
  databaseId,
  targetCollection,
  isProjectIdEmpty,
  isTargetCollectionEmpty,
  onChange
}) => (
  <div className="flex flex-col gap-3 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
    <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
      <span>Target Firestore Destination</span>
      <InfoTooltip text="Configures the Google Cloud Project, Firestore database, and destination collection for batch writes." />
    </label>

    <PropertyField
      id="firestoreSinkProjectId"
      name="projectId"
      label="GCP Project ID"
      required="Project ID is required"
      tooltip="Google Cloud Platform Project ID hosting Cloud Firestore. Required."
      value={projectId}
      invalid={isProjectIdEmpty}
      error={isProjectIdEmpty ? 'Project ID is required' : null}
      placeholder="my-gcp-project"
      onChange={onChange}
      mono={true}
    />

    <div className="grid grid-cols-2 gap-2">
      <PropertyField
        id="firestoreSinkDatabaseId"
        name="databaseId"
        label="Database ID"
        tooltip="Firestore database ID. Defaults to (default) if unspecified."
        value={databaseId}
        onChange={onChange}
        placeholder="(default)"
        mono={true}
      />

      <PropertyField
        id="firestoreSinkTargetCollection"
        name="targetCollection"
        label="Target Collection"
        required="Target collection is required"
        tooltip="Destination Firestore collection name or path where documents will be written. Required."
        value={targetCollection}
        invalid={isTargetCollectionEmpty}
        error={isTargetCollectionEmpty ? 'Target collection is required' : null}
        placeholder="e.g. processed_events"
        onChange={onChange}
        mono={true}
      />
    </div>
  </div>
);

interface OperationCardProps {
  operation: FirestoreWriteOperation;
  documentIdField: string;
  mergeFields: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}

/**
 * Presentational card for write mutation operation and document fields.
 *
 * @param props OperationCardProps containing write operation and field mappings
 */
const FirestoreSinkOperationCard: React.FC<OperationCardProps> = ({
  operation,
  documentIdField,
  mergeFields,
  onChange
}) => (
  <div className="flex flex-col gap-3 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
    <div className="flex flex-col gap-1">
      <label htmlFor="firestoreSinkOperation" className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
        <span>Write Operation</span>
        <InfoTooltip text="Specifies mutation type: Update (set/merge), Delete, or Server Transform. Note: The Java sink consumes PCollection<com.google.firestore.v1.Write> built upstream." />
      </label>
      <select
        id="firestoreSinkOperation"
        name="operation"
        value={operation}
        onChange={onChange}
        className="bg-[var(--vscode-input-bg)] text-[var(--vscode-text-primary)] p-2 rounded border border-[var(--vscode-border)] text-xs focus:outline-none focus:border-[var(--vscode-highlight)]"
      >
        <option value="update">Update / Set / Merge (update)</option>
        <option value="delete">Delete (delete)</option>
        <option value="transform">Server Transform (transform)</option>
      </select>
    </div>

    <PropertyField
      id="firestoreSinkDocumentIdField"
      name="documentIdField"
      label="Document ID Source Field"
      tooltip="The field path in incoming elements containing the Firestore document ID (e.g. id, doc_id, or uuid)."
      value={documentIdField}
      onChange={onChange}
      placeholder="e.g. id or document_id"
      mono={true}
    />

    {operation === 'update' && (
      <PropertyField
        id="firestoreSinkMergeFields"
        name="mergeFields"
        label="Merge Fields List"
        tooltip="Optional comma-separated list of field paths to merge when updating existing documents (e.g. status, updated_at). Leave empty to overwrite the entire document."
        value={mergeFields}
        onChange={onChange}
        placeholder="e.g. status, updated_at"
        mono={true}
      />
    )}
  </div>
);

interface BatchCardProps {
  isDeadLetterEnabled: boolean;
  batchSize: number | string;
  hintMaxNumWorkers: number | string;
  failureHandling: FirestoreFailureMode;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}

/**
 * Presentational card for BatchWrite tuning and error handling.
 *
 * @param props BatchCardProps containing dead-letter queue and batch options
 */
const FirestoreSinkBatchCard: React.FC<BatchCardProps> = ({
  isDeadLetterEnabled,
  batchSize,
  hintMaxNumWorkers,
  failureHandling,
  onChange
}) => (
  <div className="flex flex-col gap-3 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
    <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
      <span>Batch Write Tuning &amp; Reliability</span>
      <InfoTooltip text="Configures batch size and error handling. Maps to FirestoreIO.v1().write().batchWrite()." />
    </label>

    <div className="grid grid-cols-2 gap-2">
      <PropertyField
        id="firestoreSinkBatchSize"
        name="batchSize"
        label="Batch Size"
        type="number"
        tooltip="Target number of mutations per BatchWrite request (up to 500 max per Firestore API limit)."
        value={batchSize}
        onChange={onChange}
        placeholder="50"
        mono={true}
      />

      <PropertyField
        id="firestoreSinkHintMaxNumWorkers"
        name="hintMaxNumWorkers"
        label="Hint Max Num Workers"
        type="number"
        tooltip="Worker parallelism hint used by Firestore QOS to optimize throughput and rate limiting."
        value={hintMaxNumWorkers}
        onChange={onChange}
        placeholder="e.g. 10"
        mono={true}
      />
    </div>

    <div className="flex flex-col gap-1">
      <label htmlFor="firestoreSinkFailureHandling" className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
        <span>Failure Handling Mode</span>
        <InfoTooltip text="Select how write failures are handled: Fail Pipeline immediately or route failed Write protos to Dead-Letter Queue." />
      </label>
      <select
        id="firestoreSinkFailureHandling"
        name="failureHandling"
        value={failureHandling}
        onChange={onChange}
        className="bg-[var(--vscode-input-bg)] text-[var(--vscode-text-primary)] p-2 rounded border border-[var(--vscode-border)] text-xs focus:outline-none focus:border-[var(--vscode-highlight)]"
      >
        <option value="fail_pipeline">Fail Pipeline (Throw FailedWritesException)</option>
        <option value="dead_letter_queue">Dead-Letter Queue (PCollection&lt;WriteFailure&gt;)</option>
      </select>
    </div>

    <div className="flex items-center gap-2 mt-1">
      <input
        id="firestoreSinkWithDeadLetterQueue"
        type="checkbox"
        name="withDeadLetterQueue"
        checked={isDeadLetterEnabled}
        onChange={onChange}
        className="rounded border-[var(--vscode-border)] text-[var(--vscode-highlight)] accent-[var(--vscode-highlight)] focus:ring-0"
      />
      <label htmlFor="firestoreSinkWithDeadLetterQueue" className="flex items-center gap-1.5 text-xs text-[var(--vscode-text-secondary)] cursor-pointer">
        <span>Enable Dead-Letter Queue</span>
        <InfoTooltip text="Calls .withDeadLetterQueue() on the batchWrite builder. Note: This changes the transform's output type to PCollection<FirestoreV1.WriteFailure> rather than terminating the pipeline on write failures." />
      </label>
    </div>
  </div>
);

interface AuthCardProps {
  authMode: string;
  serviceAccountSecret: string;
  secrets: SecretItem[];
  secretError: string | null;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}

/**
 * Presentational card for Firestore sink authentication credentials.
 *
 * @param props AuthCardProps containing auth mode and secret options
 */
const FirestoreSinkAuthCard: React.FC<AuthCardProps> = ({
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
          id="firestoreSinkSecret"
          name="serviceAccountSecret"
          label="Service Account Key Secret"
          tooltip="Google Cloud Secret Manager secret containing the service account JSON credentials key."
          value={serviceAccountSecret}
          onChange={onChange}
          list="firestore-sink-secret-options"
          datalist={secrets.map((s) => ({ value: s.id || s.name, label: s.name || s.id }))}
          placeholder="e.g. firestore-sa-key"
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

interface AdvancedGroupProps {
  showAdvanced: boolean;
  emulatorHost: string;
  initialBackoffMs: number | string;
  maxAttempts: number | string;
  throttling: boolean;
  hintMaxNumWorkers: number | string;
  onToggle: () => void;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}

/**
 * Presentational collapsible group for advanced Firestore write settings and RPC QoS options.
 *
 * @param props AdvancedGroupProps containing QoS parameters and collapse toggle
 */
const FirestoreSinkAdvancedGroup: React.FC<AdvancedGroupProps> = ({
  showAdvanced,
  emulatorHost,
  initialBackoffMs,
  maxAttempts,
  throttling,
  hintMaxNumWorkers,
  onToggle,
  onChange
}) => (
  <div className="flex flex-col border border-[var(--vscode-border-light)] rounded-md overflow-hidden">
    <button
      type="button"
      onClick={onToggle}
      className="flex items-center justify-between p-2 bg-[var(--vscode-subcard-bg)] text-xs font-bold uppercase text-[var(--vscode-text-muted)] hover:text-[var(--vscode-text-primary)] transition-colors cursor-pointer"
    >
      <span>Advanced Sink Settings</span>
      <span>{showAdvanced ? '▲' : '▼'}</span>
    </button>

    {showAdvanced && (
      <div className="p-3 bg-[var(--vscode-workbench-bg)] flex flex-col gap-3 border-t border-[var(--vscode-border-light)]">
        <PropertyField
          id="firestoreSinkEmulatorHost"
          name="emulatorHost"
          label="Firestore Emulator Host Override"
          tooltip="Custom Firestore emulator address (e.g. localhost:8080 or FIRESTORE_EMULATOR_HOST). Configures FirestoreOptions.setEmulatorHost()."
          value={emulatorHost}
          onChange={onChange}
          placeholder="localhost:8080"
          mono={true}
        />

        <label className="text-xs font-bold uppercase text-[var(--vscode-text-muted)] mt-1">
          RPC Quality of Service (RpcQosOptions)
        </label>

        <PropertyField
          id="firestoreSinkAdvancedHintMaxNumWorkers"
          name="hintMaxNumWorkers"
          label="Hint Max Num Workers"
          type="number"
          tooltip="Maximum worker count hint for RPC QoS rate limiting."
          value={hintMaxNumWorkers}
          onChange={onChange}
          placeholder="e.g. 10"
          mono={true}
        />

        <div className="grid grid-cols-2 gap-2">
          <PropertyField
            id="firestoreSinkInitialBackoffMs"
            name="initialBackoffMs"
            label="Initial Backoff (ms)"
            type="number"
            tooltip="Initial backoff duration in milliseconds for retrying Firestore BatchWrite RPCs."
            value={initialBackoffMs}
            onChange={onChange}
            placeholder="5000"
            mono={true}
          />

          <PropertyField
            id="firestoreSinkMaxAttempts"
            name="maxAttempts"
            label="Max Attempts"
            type="number"
            tooltip="Maximum retry attempts before failing the batch write."
            value={maxAttempts}
            onChange={onChange}
            placeholder="5"
            mono={true}
          />
        </div>

        <div className="flex items-center gap-2 mt-1">
          <input
            id="firestoreSinkThrottling"
            type="checkbox"
            name="throttling"
            checked={throttling}
            onChange={onChange}
            className="rounded border-[var(--vscode-border)] text-[var(--vscode-highlight)] accent-[var(--vscode-highlight)] focus:ring-0"
          />
          <label htmlFor="firestoreSinkThrottling" className="flex items-center gap-1.5 text-xs text-[var(--vscode-text-secondary)] cursor-pointer">
            <span>Enable RPC Throttling</span>
            <InfoTooltip text="Automatically throttles outbound BatchWrite RPC requests to stay within Firestore limits." />
          </label>
        </div>
      </div>
    )}
  </div>
);

/**
 * FirestoreIOSinkProperties component rendering the property panel for Firestore batchWrite sink.
 *
 * @param props Component properties containing the active node and onChange callback
 */
export const FirestoreIOSinkProperties: React.FC<FirestoreIOSinkPropertiesProps> = ({
  node,
  onChange
}) => {
  const properties = node.data.properties || {};

  // Target Firestore settings
  const projectId = properties.projectId || '';
  const databaseId = properties.databaseId || '';
  const targetCollection = properties.targetCollection || '';

  // Write operation settings
  const operation = (properties.operation as FirestoreWriteOperation) || 'update';
  const documentIdField = properties.documentIdField || '';
  const mergeFields = properties.mergeFields || '';

  // Single source of truth for dead-letter failure handling
  const isDeadLetterEnabled =
    properties.withDeadLetterQueue ?? (properties.failureHandling === 'dead_letter_queue');
  const batchSize = properties.batchSize ?? '';
  const hintMaxNumWorkers = properties.hintMaxNumWorkers ?? '';
  const failureHandling: FirestoreFailureMode = isDeadLetterEnabled
    ? 'dead_letter_queue'
    : 'fail_pipeline';

  // Auth & advanced
  const authMode = properties.authMode || 'adc';
  const serviceAccountSecret = properties.serviceAccountSecret || '';
  const emulatorHost = properties.emulatorHost || '';
  const initialBackoffMs = properties.initialBackoffMs ?? '';
  const maxAttempts = properties.maxAttempts ?? '';
  const throttling = properties.throttling ?? true;

  // Local UI state
  const { items: rawSecrets, error: secretError } = useAssetLoader<SecretItem | string>('secrets');
  const secrets: SecretItem[] = (rawSecrets || []).map(normalizeSecretItem);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Field validation
  const isProjectIdEmpty = !projectId.trim();
  const isTargetCollectionEmpty = !targetCollection.trim();

  // Fallback chain for system instructions
  const systemInstructions =
    node.data.system_instructions ??
    node.data.special_instructions ??
    properties.system_instructions ??
    properties.special_instructions ??
    '';

  /**
   * Updates a generic property value and triggers onChange callback.
   *
   * @param name The property name key
   * @param value The updated property value
   */
  const updateProperty = (name: string, value: any) => {
    const updated = { ...properties, [name]: value };
    onChange(updated);
  };

  /**
   * Handles text, select, and checkbox input changes.
   *
   * @param e Standard React change event
   */
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      if (name === 'withDeadLetterQueue') {
        onChange({
          ...properties,
          withDeadLetterQueue: checked,
          failureHandling: checked ? 'dead_letter_queue' : 'fail_pipeline'
        });
        return;
      }
      updateProperty(name, checked);
    } else if (name === 'failureHandling') {
      const enabled = value === 'dead_letter_queue';
      onChange({
        ...properties,
        failureHandling: value,
        withDeadLetterQueue: enabled
      });
    } else {
      updateProperty(name, value);
    }
  };

  /**
   * Handles system instructions textarea modification.
   *
   * @param e React textarea change event
   */
  const handleInstructionsChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    // NOTE: Explicitly update system_instructions
    onChange({
      ...properties,
      system_instructions: e.target.value
    });
  };

  return (
    <div className="flex-1 flex flex-col gap-4 text-[var(--vscode-text-primary)] text-sm">
      {/* Target Firestore Destination */}
      <FirestoreSinkTargetCard
        projectId={projectId}
        databaseId={databaseId}
        targetCollection={targetCollection}
        isProjectIdEmpty={isProjectIdEmpty}
        isTargetCollectionEmpty={isTargetCollectionEmpty}
        onChange={handleChange}
      />

      {/* Write Operation and Field Settings */}
      <FirestoreSinkOperationCard
        operation={operation}
        documentIdField={documentIdField}
        mergeFields={mergeFields}
        onChange={handleChange}
      />

      {/* Batch Write Tuning & Error Handling */}
      <FirestoreSinkBatchCard
        isDeadLetterEnabled={isDeadLetterEnabled}
        batchSize={batchSize}
        hintMaxNumWorkers={hintMaxNumWorkers}
        failureHandling={failureHandling}
        onChange={handleChange}
      />

      {/* Authentication Block */}
      <FirestoreSinkAuthCard
        authMode={authMode}
        serviceAccountSecret={serviceAccountSecret}
        secrets={secrets}
        secretError={secretError}
        onChange={handleChange}
      />

      {/* Collapsible Advanced Settings */}
      <FirestoreSinkAdvancedGroup
        showAdvanced={showAdvanced}
        emulatorHost={emulatorHost}
        initialBackoffMs={initialBackoffMs}
        maxAttempts={maxAttempts}
        throttling={throttling}
        hintMaxNumWorkers={hintMaxNumWorkers}
        onToggle={() => setShowAdvanced(!showAdvanced)}
        onChange={handleChange}
      />

      {/* Flexible Spacer */}
      <div className="flex-1 min-h-[16px]" />

      {/* Code Generation Instructions */}
      <PropertyField
        id="firestoreSinkInstructions"
        name="system_instructions"
        label="Code Generation Instructions"
        tooltip="Optional instructions passed to LLM code generator. Note: Java FirestoreIO.v1().write().batchWrite() consumes PCollection<com.google.firestore.v1.Write> built upstream."
        type="textarea"
        rows={3}
        value={systemInstructions}
        onChange={handleInstructionsChange}
        placeholder="e.g. Map upstream elements to com.google.firestore.v1.Write protos before applying FirestoreIO.v1().write().batchWrite()"
        mono={true}
      />
    </div>
  );
};
