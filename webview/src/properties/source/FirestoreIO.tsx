/**
 * FirestoreIOSourceProperties Component
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Renders the property configuration panel for Apache Beam FirestoreIO.v1().read() source nodes.
 * Configures GCP Project ID, database ID, collection ID or collection group, read operation selection
 * (runQuery, partitionQuery, listDocuments, listCollectionIds, batchGetDocuments) with operation-specific inputs,
 * structured query builder options, authentication (ADC vs GCP Secret Manager), and collapsible Advanced
 * Source Settings (emulator host override and RpcQosOptions tuning).
 *
 * Architectural Decisions:
 * - Controlled inputs architecture ("props in, events up") with no local prop mirroring.
 * - Decomposed into local presentational sub-components keeping files modular and readable:
 *   - FirestoreSourceTargetCard: Project ID, Database ID, Collection ID/group toggle.
 *   - FirestoreSourceOperationCard: Operation selector with dynamic tooltips and operation-specific query fields.
 *   - FirestoreSourceAuthCard: ADC vs GCP Secret Manager credentials with IPC datalist integration.
 *   - FirestoreSourceAdvancedGroup: Collapsible RPC QoS options and emulator override.
 * - Dynamic read operation selector maps strictly to real Beam transforms:
 *   - runQuery: FirestoreIO.v1().read().runQuery()
 *   - partitionQuery: FirestoreIO.v1().read().partitionQuery()
 *   - listDocuments: FirestoreIO.v1().read().listDocuments()
 *   - listCollectionIds: FirestoreIO.v1().read().listCollectionIds()
 *   - batchGetDocuments: FirestoreIO.v1().read().batchGetDocuments()
 * - Real-time validation for Project ID and Collection ID with accessible ARIA tags and red border alerts.
 * - Dynamic IPC integration: listens for 'secretsLoaded' responses and issues 'getSecrets' command to extension host.
 * - Datalist ID 'firestore-source-secret-options' per connector/role scope isolation.
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

/** Secret descriptor loaded from the secret manager for Firestore authentication. */
export interface SecretItem {
  id: string;
  name: string;
  fullName?: string;
}

export type FirestoreReadOperation =
  | 'runQuery'
  | 'partitionQuery'
  | 'listDocuments'
  | 'listCollectionIds'
  | 'batchGetDocuments';

/** Props for the {@link FirestoreIOSourceProperties} component. */
export interface FirestoreIOSourcePropertiesProps {
  node: {
    data: {
      label?: string;
      beam_transform?: string;
      system_instructions?: string;
      special_instructions?: string;
      properties?: {
        projectId?: string;
        databaseId?: string;
        collectionId?: string;
        isCollectionGroup?: boolean;
        operation?: FirestoreReadOperation | string;
        // Structured query builder options (for runQuery and partitionQuery)
        fieldFilters?: string;
        orderByField?: string;
        orderByDirection?: 'ASCENDING' | 'DESCENDING' | string;
        limit?: number | string;
        // partitionQuery specific
        nameOnlyQuery?: boolean;
        partitionCount?: number | string;
        // listDocuments specific
        pageSize?: number | string;
        maskFields?: string;
        showMissing?: boolean;
        // listCollectionIds specific
        parentDocument?: string;
        // batchGetDocuments specific
        documentPaths?: string;
        // Auth
        authMode?: 'adc' | 'secret_manager' | string;
        serviceAccountSecret?: string;
        // Advanced
        emulatorHost?: string;
        hintMaxNumWorkers?: number | string;
        initialBackoffMs?: number | string;
        maxBackoffMs?: number | string;
        throttling?: boolean;
        system_instructions?: string;
        special_instructions?: string;
        [key: string]: any;
      };
    };
  };
  onChange: (properties: any) => void;
}

/** Props for the Firestore target project and database card. */
interface TargetCardProps {
  projectId: string;
  databaseId: string;
  collectionId: string;
  isCollectionGroup: boolean;
  isProjectIdEmpty: boolean;
  isCollectionIdEmpty: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}

/**
 * Presentational card for target Firestore database and collection.
 *
 * @param props TargetCardProps containing database identifiers and change callback
 */
const FirestoreSourceTargetCard: React.FC<TargetCardProps> = ({
  projectId,
  databaseId,
  collectionId,
  isCollectionGroup,
  isProjectIdEmpty,
  isCollectionIdEmpty,
  onChange
}) => (
  <div className="flex flex-col gap-3 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
    <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
      <span>Target Firestore Instance</span>
      <InfoTooltip text="Configures the Google Cloud Project, Firestore Database, and target collection or collection group." />
    </label>

    <PropertyField
      id="firestoreSourceProjectId"
      name="projectId"
      label="GCP Project ID"
      required="Project ID is required"
      tooltip="Google Cloud Platform Project ID hosting Firestore. Required."
      value={projectId}
      invalid={isProjectIdEmpty}
      error={isProjectIdEmpty ? 'Project ID is required' : null}
      placeholder="my-gcp-project"
      onChange={onChange}
      mono={true}
    />

    <div className="grid grid-cols-2 gap-2">
      <PropertyField
        id="firestoreSourceDatabaseId"
        name="databaseId"
        label="Database ID"
        tooltip="Firestore database ID. Defaults to (default) if unspecified."
        value={databaseId}
        onChange={onChange}
        placeholder="(default)"
        mono={true}
      />

      <PropertyField
        id="firestoreSourceCollectionId"
        name="collectionId"
        label="Collection ID"
        required="Collection ID is required"
        tooltip="Firestore collection ID or collection group ID. Required."
        value={collectionId}
        invalid={isCollectionIdEmpty}
        error={isCollectionIdEmpty ? 'Collection ID is required' : null}
        placeholder="e.g. users or orders"
        onChange={onChange}
        mono={true}
      />
    </div>

    <div className="flex items-center gap-2 mt-1">
      <input
        id="firestoreSourceIsCollectionGroup"
        type="checkbox"
        name="isCollectionGroup"
        checked={isCollectionGroup}
        onChange={onChange}
        className="rounded border-[var(--vscode-border)] text-[var(--vscode-highlight)] accent-[var(--vscode-highlight)] focus:ring-0"
      />
      <label htmlFor="firestoreSourceIsCollectionGroup" className="flex items-center gap-1.5 text-xs text-[var(--vscode-text-secondary)] cursor-pointer">
        <span>Collection Group Query (allDescendants)</span>
        <InfoTooltip text="When checked, queries all collections with this ID across the entire database hierarchy." />
      </label>
    </div>
  </div>
);

/** Props for the Firestore read operation configuration card. */
interface OperationCardProps {
  operation: FirestoreReadOperation;
  fieldFilters: string;
  orderByField: string;
  orderByDirection: string;
  limit: number | string;
  nameOnlyQuery: boolean;
  partitionCount: number | string;
  pageSize: number | string;
  maskFields: string;
  showMissing: boolean;
  parentDocument: string;
  documentPaths: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}

/**
 * Returns user-facing tooltip describing the specific Beam transform mapping.
 *
 * @param op The active FirestoreReadOperation
 * @returns Human-readable description with exact Java SDK transform call
 */
function getOperationTooltip(op: FirestoreReadOperation): string {
  switch (op) {
    case 'partitionQuery':
      return 'Maps to FirestoreIO.v1().read().partitionQuery(). Splits a query into parallel partitions using PartitionQueryRequest.';
    case 'listDocuments':
      return 'Maps to FirestoreIO.v1().read().listDocuments(). Lists Document protos directly under a collection path using ListDocumentsRequest.';
    case 'listCollectionIds':
      return 'Maps to FirestoreIO.v1().read().listCollectionIds(). Lists subcollection IDs under a parent document or database root using ListCollectionIdsRequest.';
    case 'batchGetDocuments':
      return 'Maps to FirestoreIO.v1().read().batchGetDocuments(). Retrieves a specific batch of documents by resource paths using BatchGetDocumentsRequest.';
    case 'runQuery':
    default:
      return 'Maps to FirestoreIO.v1().read().runQuery(). Executes a Firestore RunQueryRequest and outputs Document protos.';
  }
}

/**
 * Presentational card for Read Operation selection and operation-specific query parameters.
 *
 * @param props OperationCardProps containing operation and query fields
 */
const FirestoreSourceOperationCard: React.FC<OperationCardProps> = ({
  operation,
  fieldFilters,
  orderByField,
  orderByDirection,
  limit,
  nameOnlyQuery,
  partitionCount,
  pageSize,
  maskFields,
  showMissing,
  parentDocument,
  documentPaths,
  onChange
}) => (
  <div className="flex flex-col gap-3 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
    <div className="flex flex-col gap-1">
      <label htmlFor="firestoreSourceOperation" className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
        <span>Read Operation</span>
        <InfoTooltip text={getOperationTooltip(operation)} />
      </label>
      <select
        id="firestoreSourceOperation"
        name="operation"
        value={operation}
        onChange={onChange}
        className="bg-[var(--vscode-input-bg)] text-[var(--vscode-text-primary)] p-2 rounded border border-[var(--vscode-border)] text-xs focus:outline-none focus:border-[var(--vscode-highlight)]"
      >
        <option value="runQuery">Run Query (runQuery)</option>
        <option value="partitionQuery">Partition Query (partitionQuery)</option>
        <option value="listDocuments">List Documents (listDocuments)</option>
        <option value="listCollectionIds">List Collection IDs (listCollectionIds)</option>
        <option value="batchGetDocuments">Batch Get Documents (batchGetDocuments)</option>
      </select>
    </div>

    {/* Structured Query Fields for runQuery and partitionQuery */}
    {(operation === 'runQuery' || operation === 'partitionQuery') && (
      <div className="flex flex-col gap-3 mt-1 pl-2 border-l-2 border-[var(--vscode-highlight)]/50">
        <label className="text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          Structured Query Options
        </label>

        <PropertyField
          id="firestoreSourceFieldFilters"
          name="fieldFilters"
          label="Field Filters (JSON)"
          tooltip='Optional JSON array of field filters, e.g. [{"field": "status", "op": "EQUAL", "value": "active"}].'
          type="textarea"
          rows={3}
          value={fieldFilters}
          onChange={onChange}
          placeholder='[{"field": "status", "op": "EQUAL", "value": "active"}]'
          mono={true}
        />

        <div className="grid grid-cols-2 gap-2">
          <PropertyField
            id="firestoreSourceOrderByField"
            name="orderByField"
            label="Order By Field"
            tooltip="Document field to order query results by (e.g. created_at)."
            value={orderByField}
            onChange={onChange}
            placeholder="e.g. created_at"
            mono={true}
          />

          <div className="flex flex-col gap-1">
            <label htmlFor="firestoreSourceOrderByDirection" className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
              <span>Order Direction</span>
              <InfoTooltip text="Sort order direction for the order-by field." />
            </label>
            <select
              id="firestoreSourceOrderByDirection"
              name="orderByDirection"
              value={orderByDirection}
              onChange={onChange}
              className="bg-[var(--vscode-input-bg)] text-[var(--vscode-text-primary)] p-2 rounded border border-[var(--vscode-border)] text-xs focus:outline-none focus:border-[var(--vscode-highlight)]"
            >
              <option value="ASCENDING">Ascending (ASC)</option>
              <option value="DESCENDING">Descending (DESC)</option>
            </select>
          </div>
        </div>

        <PropertyField
          id="firestoreSourceLimit"
          name="limit"
          label="Limit"
          type="number"
          tooltip="Maximum number of documents to return. Leave empty for unlimited."
          value={limit}
          onChange={onChange}
          placeholder="Unlimited"
          mono={true}
        />

        {/* Partition Query specific options */}
        {operation === 'partitionQuery' && (
          <div className="flex flex-col gap-3 mt-1 pt-2 border-t border-[var(--vscode-border-light)]">
            <PropertyField
              id="firestoreSourcePartitionCount"
              name="partitionCount"
              label="Desired Partition Count"
              type="number"
              tooltip="Target number of parallel partitions to split the query into. Maps to partitionCount in PartitionQueryRequest."
              value={partitionCount}
              onChange={onChange}
              placeholder="e.g. 50"
              mono={true}
            />

            <div className="flex items-center gap-2">
              <input
                id="firestoreSourceNameOnlyQuery"
                type="checkbox"
                name="nameOnlyQuery"
                checked={nameOnlyQuery}
                onChange={onChange}
                className="rounded border-[var(--vscode-border)] text-[var(--vscode-highlight)] accent-[var(--vscode-highlight)] focus:ring-0"
              />
              <label htmlFor="firestoreSourceNameOnlyQuery" className="flex items-center gap-1.5 text-xs text-[var(--vscode-text-secondary)] cursor-pointer">
                <span>Name Only Query</span>
                <InfoTooltip text="When enabled, uses withNameOnlyQuery() to only retrieve document resource names, reducing bandwidth and worker memory." />
              </label>
            </div>
          </div>
        )}
      </div>
    )}

    {/* listDocuments specific fields */}
    {operation === 'listDocuments' && (
      <div className="flex flex-col gap-3 mt-1 pl-2 border-l-2 border-[var(--vscode-highlight)]/50">
        <label className="text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          List Documents Options
        </label>
        <PropertyField
          id="firestoreSourcePageSize"
          name="pageSize"
          label="Page Size"
          type="number"
          tooltip="Maximum number of documents to return per page (RunQuery/ListDocuments page size hint)."
          value={pageSize}
          onChange={onChange}
          placeholder="100"
          mono={true}
        />
        <PropertyField
          id="firestoreSourceMaskFields"
          name="maskFields"
          label="Field Mask Projection"
          tooltip="Comma-separated field paths to return (e.g. name, email, status). Leave empty to return all fields."
          value={maskFields}
          onChange={onChange}
          placeholder="e.g. name, email, status"
          mono={true}
        />
        <div className="flex items-center gap-2">
          <input
            id="firestoreSourceShowMissing"
            type="checkbox"
            name="showMissing"
            checked={showMissing}
            onChange={onChange}
            className="rounded border-[var(--vscode-border)] text-[var(--vscode-highlight)] accent-[var(--vscode-highlight)] focus:ring-0"
          />
          <label htmlFor="firestoreSourceShowMissing" className="flex items-center gap-1.5 text-xs text-[var(--vscode-text-secondary)] cursor-pointer">
            <span>Show Missing Documents</span>
            <InfoTooltip text="When enabled, returns missing documents between parent and child collections." />
          </label>
        </div>
      </div>
    )}

    {/* listCollectionIds specific fields */}
    {operation === 'listCollectionIds' && (
      <div className="flex flex-col gap-3 mt-1 pl-2 border-l-2 border-[var(--vscode-highlight)]/50">
        <label className="text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          List Collection IDs Options
        </label>
        <PropertyField
          id="firestoreSourceParentDocument"
          name="parentDocument"
          label="Parent Document Path"
          tooltip="Parent document resource path (e.g. users/user-123). Leave empty to list root collections."
          value={parentDocument}
          onChange={onChange}
          placeholder="e.g. users/user-123 (or empty for root)"
          mono={true}
        />
        <PropertyField
          id="firestoreSourcePageSize"
          name="pageSize"
          label="Page Size"
          type="number"
          tooltip="Maximum number of collection IDs to return per page."
          value={pageSize}
          onChange={onChange}
          placeholder="100"
          mono={true}
        />
      </div>
    )}

    {/* batchGetDocuments specific fields */}
    {operation === 'batchGetDocuments' && (
      <div className="flex flex-col gap-3 mt-1 pl-2 border-l-2 border-[var(--vscode-highlight)]/50">
        <label className="text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          Batch Get Documents Options
        </label>
        <PropertyField
          id="firestoreSourceDocumentPaths"
          name="documentPaths"
          label="Document Paths"
          tooltip="Comma-separated or newline-delimited document resource paths to retrieve (e.g. users/alice, users/bob)."
          type="textarea"
          rows={3}
          value={documentPaths}
          onChange={onChange}
          placeholder="projects/my-project/databases/(default)/documents/users/user-1"
          mono={true}
        />
        <PropertyField
          id="firestoreSourceMaskFields"
          name="maskFields"
          label="Field Mask Projection"
          tooltip="Comma-separated field paths to retrieve. Leave empty to return all fields."
          value={maskFields}
          onChange={onChange}
          placeholder="e.g. name, email"
          mono={true}
        />
      </div>
    )}
  </div>
);

/** Props for the Firestore authentication subcard. */
interface AuthCardProps {
  authMode: string;
  serviceAccountSecret: string;
  secrets: SecretItem[];
  secretError: string | null;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}

/**
 * Presentational card for Firestore authentication credentials.
 *
 * @param props AuthCardProps containing auth mode and secret options
 */
const FirestoreSourceAuthCard: React.FC<AuthCardProps> = ({
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
          id="firestoreSourceSecret"
          name="serviceAccountSecret"
          label="Service Account Key Secret"
          tooltip="Google Cloud Secret Manager secret containing the service account JSON credentials key."
          value={serviceAccountSecret}
          onChange={onChange}
          list="firestore-source-secret-options"
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

/** Props for the Firestore advanced QoS and worker settings group. */
interface AdvancedGroupProps {
  showAdvanced: boolean;
  emulatorHost: string;
  hintMaxNumWorkers: number | string;
  initialBackoffMs: number | string;
  maxBackoffMs: number | string;
  throttling: boolean;
  onToggle: () => void;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}

/**
 * Presentational collapsible group for advanced Firestore read settings and RPC QoS options.
 *
 * @param props AdvancedGroupProps containing QoS parameters and collapse toggle
 */
const FirestoreSourceAdvancedGroup: React.FC<AdvancedGroupProps> = ({
  showAdvanced,
  emulatorHost,
  hintMaxNumWorkers,
  initialBackoffMs,
  maxBackoffMs,
  throttling,
  onToggle,
  onChange
}) => (
  <CollapsibleSection
    title="Advanced Source Settings"
    isOpen={showAdvanced}
    onToggle={onToggle}
  >
    <PropertyField
      id="firestoreSourceEmulatorHost"
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
      id="firestoreSourceHintMaxNumWorkers"
      name="hintMaxNumWorkers"
      label="Hint Max Num Workers"
      type="number"
      tooltip="Hint for maximum number of workers to optimize RPC rate limiting. Maps to RpcQosOptions.newBuilder().withHintMaxNumWorkers()."
      value={hintMaxNumWorkers}
      onChange={onChange}
      placeholder="e.g. 10"
      mono={true}
    />

    <div className="grid grid-cols-2 gap-2">
      <PropertyField
        id="firestoreSourceInitialBackoffMs"
        name="initialBackoffMs"
        label="Initial Backoff (ms)"
        type="number"
        tooltip="Initial backoff duration in milliseconds for retrying Firestore RPCs. Maps to RpcQosOptions.newBuilder().withInitialBackoff()."
        value={initialBackoffMs}
        onChange={onChange}
        placeholder="5000"
        mono={true}
      />

      <PropertyField
        id="firestoreSourceMaxBackoffMs"
        name="maxBackoffMs"
        label="Max Backoff (ms)"
        type="number"
        tooltip="Maximum backoff duration in milliseconds for retrying Firestore RPCs. Maps to RpcQosOptions.newBuilder().withMaxBackoff()."
        value={maxBackoffMs}
        onChange={onChange}
        placeholder="60000"
        mono={true}
      />
    </div>

    <div className="flex items-center gap-2 mt-1">
      <input
        id="firestoreSourceThrottling"
        type="checkbox"
        name="throttling"
        checked={throttling}
        onChange={onChange}
        className="rounded border-[var(--vscode-border)] text-[var(--vscode-highlight)] accent-[var(--vscode-highlight)] focus:ring-0"
      />
      <label htmlFor="firestoreSourceThrottling" className="flex items-center gap-1.5 text-xs text-[var(--vscode-text-secondary)] cursor-pointer">
        <span>Enable RPC Throttling</span>
        <InfoTooltip text="Automatically throttles outbound RPC requests to stay within Firestore database throughput limits." />
      </label>
    </div>
  </CollapsibleSection>
);

/**
 * FirestoreIOSourceProperties component rendering the property panel for Firestore read source.
 *
 * @param props Component properties containing the active node and onChange callback
 */
export const FirestoreIOSourceProperties: React.FC<FirestoreIOSourcePropertiesProps> = ({
  node,
  onChange
}) => {
  const properties = node.data.properties || {};

  // Form field state extracted directly from node properties
  const projectId = properties.projectId || '';
  const databaseId = properties.databaseId || '';
  const collectionId = properties.collectionId || '';
  const isCollectionGroup = properties.isCollectionGroup ?? false;
  const operation = (properties.operation as FirestoreReadOperation) || 'runQuery';

  // Query options
  const fieldFilters = properties.fieldFilters || '';
  const orderByField = properties.orderByField || '';
  const orderByDirection = properties.orderByDirection || 'ASCENDING';
  const limit = properties.limit ?? '';
  const nameOnlyQuery = properties.nameOnlyQuery ?? false;
  const partitionCount = properties.partitionCount ?? '';
  const pageSize = properties.pageSize ?? '';
  const maskFields = properties.maskFields || '';
  const showMissing = properties.showMissing ?? false;
  const parentDocument = properties.parentDocument || '';
  const documentPaths = properties.documentPaths || '';

  // Auth and advanced settings
  const authMode = properties.authMode || 'adc';
  const serviceAccountSecret = properties.serviceAccountSecret || '';
  const emulatorHost = properties.emulatorHost || '';
  const hintMaxNumWorkers = properties.hintMaxNumWorkers ?? '';
  const initialBackoffMs = properties.initialBackoffMs ?? '';
  const maxBackoffMs = properties.maxBackoffMs ?? '';
  const throttling = properties.throttling ?? true;

  // Local UI state
  const { items: rawSecrets, error: secretError } = useAssetLoader<SecretItem | string>('secrets');
  const secrets: SecretItem[] = (rawSecrets || []).map(normalizeSecretItem);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Field validation
  const isProjectIdEmpty = !projectId.trim();
  const isCollectionIdEmpty = !collectionId.trim();

  // Fallback chain for system instructions
  const systemInstructions = resolveSystemInstructions(node);

  /**
   * Updates a generic property value and triggers onChange callback.
   *
   * @param name The property name key
   * @param value The updated property value
   */
  const updateProperty = (name: string, value: any) => {
    // NOTE: Merge updated property into parent container
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
      {/* Target Firestore Instance & Collection */}
      <FirestoreSourceTargetCard
        projectId={projectId}
        databaseId={databaseId}
        collectionId={collectionId}
        isCollectionGroup={isCollectionGroup}
        isProjectIdEmpty={isProjectIdEmpty}
        isCollectionIdEmpty={isCollectionIdEmpty}
        onChange={handleChange}
      />

      {/* Read Operation and Query Settings */}
      <FirestoreSourceOperationCard
        operation={operation}
        fieldFilters={fieldFilters}
        orderByField={orderByField}
        orderByDirection={orderByDirection}
        limit={limit}
        nameOnlyQuery={nameOnlyQuery}
        partitionCount={partitionCount}
        pageSize={pageSize}
        maskFields={maskFields}
        showMissing={showMissing}
        parentDocument={parentDocument}
        documentPaths={documentPaths}
        onChange={handleChange}
      />

      {/* Authentication Settings */}
      <FirestoreSourceAuthCard
        authMode={authMode}
        serviceAccountSecret={serviceAccountSecret}
        secrets={secrets}
        secretError={secretError}
        onChange={handleChange}
      />

      {/* Collapsible Advanced Settings */}
      <FirestoreSourceAdvancedGroup
        showAdvanced={showAdvanced}
        emulatorHost={emulatorHost}
        hintMaxNumWorkers={hintMaxNumWorkers}
        initialBackoffMs={initialBackoffMs}
        maxBackoffMs={maxBackoffMs}
        throttling={throttling}
        onToggle={() => setShowAdvanced(!showAdvanced)}
        onChange={handleChange}
      />

      {/* Code Generation Instructions */}
      <SystemInstructionsField
        id="firestoreSourceInstructions"
        value={systemInstructions}
        tooltip="Optional custom prompt instructions passed to the LLM code generator when synthesizing Firestore read transforms."
        placeholder="e.g. Read Document protos from Firestore collection and extract fields into custom Beam Row schema"
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
