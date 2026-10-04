/**
 * SpannerIOSinkProperties Component
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Renders the configuration panel for Apache Beam SpannerIO Sink nodes (SpannerIO.write()).
 * Configures writing Mutation objects to Cloud Spanner, mutation operation modes (insert,
 * update, insertOrUpdate, replace, delete), batch throughput controls, failure handling,
 * and client timeouts.
 *
 * Architectural Decisions:
 * - Enforces required Spanner Instance ID and Database ID with validation alerts and accessible ARIA attributes.
 * - Supports Mutation operation mode selection corresponding to the upstream Mutation builder step.
 * - Provides throughput controls: withBatchSizeBytes, withMaxNumMutations, withMaxNumRows, withGroupingFactor.
 * - Failure mode select (FAIL_FAST / REPORT_FAILURES) and High Priority RPC execution control.
 * - Dynamic discovery: fetches GCP Secret Manager secrets via 'getSecrets' IPC message for service account keys.
 * - Provides distinct datalist id 'spanner-sink-secret-options' avoiding collisions.
 * - Decomposed into local presentational sub-components (SpannerSinkThroughputCard, SpannerSinkAuthCard,
 *   SpannerSinkAdvancedCard) using onToggle callback for collapsible state.
 * - Preserves system_instructions / special_instructions in the bottom textarea for LLM code generation.
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

/**
 * Represents a GCP Secret Manager secret item.
 */
export interface SecretItem {
  id: string;
  name: string;
  fullName?: string;
}

export type SpannerMutationMode = 'insert' | 'update' | 'insertOrUpdate' | 'replace' | 'delete';
export type SpannerFailureMode = 'FAIL_FAST' | 'REPORT_FAILURES';

/**
 * Props for the SpannerIOSinkProperties component.
 */
export interface SpannerIOSinkPropertiesProps {
  node: {
    data: {
      label?: string;
      beam_transform?: string;
      system_instructions?: string;
      special_instructions?: string;
      properties?: {
        instanceId?: string;
        databaseId?: string;
        projectId?: string;
        mutationMode?: SpannerMutationMode;
        batchSizeBytes?: number | string;
        maxNumMutations?: number | string;
        maxNumRows?: number | string;
        groupingFactor?: number | string;
        failureMode?: SpannerFailureMode;
        highPriority?: boolean;
        authMode?: 'adc' | 'secret_manager';
        serviceAccountKeySecret?: string;
        host?: string;
        commitDeadlineSeconds?: number | string;
        maxCumulativeBackoffSeconds?: number | string;
        databaseRole?: string;
        system_instructions?: string;
        special_instructions?: string;
        [key: string]: any;
      };
    };
  };
  onChange: (properties: any) => void;
}

/**
 * Normalizes secret payloads received from the VS Code extension host.
 *
 * @param secrets Array of raw secret strings or objects
 * @returns Array of normalized SecretItem entries
 */

/**
 * Props for the SpannerSinkThroughputCard component.
 */
interface SpannerSinkThroughputCardProps {
  batchSizeBytes: number | string;
  maxNumMutations: number | string;
  maxNumRows: number | string;
  groupingFactor: number | string;
  failureMode: SpannerFailureMode;
  highPriority: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}

/**
 * Local presentational sub-component for Spanner Sink throughput and batching parameters.
 */
const SpannerSinkThroughputCard: React.FC<SpannerSinkThroughputCardProps> = ({
  batchSizeBytes,
  maxNumMutations,
  maxNumRows,
  groupingFactor,
  failureMode,
  highPriority,
  onChange
}) => {
  return (
    <div className="flex flex-col gap-3 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
      <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
        <span>Throughput &amp; Batching</span>
        <InfoTooltip text="Configure mutation batching limits, grouping factor, and write failure modes." />
      </label>

      <div className="grid grid-cols-2 gap-2 mt-1">
        <PropertyField
          id="spannerSinkBatchSizeBytes"
          name="batchSizeBytes"
          label="Batch Size (Bytes)"
          type="number"
          value={batchSizeBytes}
          onChange={onChange}
          placeholder="e.g. 1048576 (1MB)"
          tooltip="Maximum batch size in bytes. Maps to withBatchSizeBytes(). Default: 1MB."
          min={0}
        />
        <PropertyField
          id="spannerSinkMaxNumMutations"
          name="maxNumMutations"
          label="Max Num Mutations"
          type="number"
          value={maxNumMutations}
          onChange={onChange}
          placeholder="e.g. 5000"
          tooltip="Maximum number of mutated cells per batch. Maps to withMaxNumMutations(). Default: 5000."
          min={0}
        />
      </div>

      <div className="grid grid-cols-2 gap-2 mt-1">
        <PropertyField
          id="spannerSinkMaxNumRows"
          name="maxNumRows"
          label="Max Num Rows"
          type="number"
          value={maxNumRows}
          onChange={onChange}
          placeholder="e.g. 500"
          tooltip="Maximum number of rows per batch. Maps to withMaxNumRows(). Default: 500."
          min={0}
        />
        <PropertyField
          id="spannerSinkGroupingFactor"
          name="groupingFactor"
          label="Grouping Factor"
          type="number"
          value={groupingFactor}
          onChange={onChange}
          placeholder="e.g. 1000"
          tooltip="Sorts and groups mutations by key across batches to optimize throughput. Maps to withGroupingFactor(). Default: 1000."
          min={0}
        />
      </div>

      <div className="flex flex-col gap-1.5 mt-1">
        <label
          htmlFor="spannerSinkFailureMode"
          className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]"
        >
          <span>Failure Mode</span>
          <InfoTooltip text="FAIL_FAST halts pipeline execution upon write failure; REPORT_FAILURES routes mutation errors to a failure PCollection without aborting." />
        </label>
        <select
          id="spannerSinkFailureMode"
          name="failureMode"
          value={failureMode}
          onChange={onChange}
          className="bg-[var(--vscode-input-bg)] text-[var(--vscode-text-primary)] p-2 rounded border border-[var(--vscode-border)] text-xs focus:outline-none focus:border-[var(--vscode-highlight)]"
        >
          <option value="FAIL_FAST">FAIL_FAST (Halt Pipeline on Error)</option>
          <option value="REPORT_FAILURES">REPORT_FAILURES (Dead-Letter Tagged Output)</option>
        </select>
      </div>

      <div className="flex items-center gap-2 mt-1">
        <input
          id="spannerSinkHighPriority"
          type="checkbox"
          name="highPriority"
          checked={highPriority}
          onChange={onChange}
          className="rounded border-[var(--vscode-border)] text-[var(--vscode-highlight)] accent-[var(--vscode-highlight)]"
        />
        <label
          htmlFor="spannerSinkHighPriority"
          className="flex items-center gap-1.5 text-xs text-[var(--vscode-text-secondary)] cursor-pointer"
        >
          <span>High Priority RPC</span>
          <InfoTooltip text="Execute Spanner write RPCs with HIGH priority in Cloud Spanner resource scheduling. Maps to withHighPriority()." />
        </label>
      </div>
    </div>
  );
};

/**
 * Props for the SpannerSinkAuthCard component.
 */
interface SpannerSinkAuthCardProps {
  authMode: 'adc' | 'secret_manager';
  serviceAccountKeySecret: string;
  secrets: SecretItem[];
  secretError: string | null;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}

/**
 * Local presentational sub-component for Spanner Sink credentials and authentication.
 */
const SpannerSinkAuthCard: React.FC<SpannerSinkAuthCardProps> = ({
  authMode,
  serviceAccountKeySecret,
  secrets,
  secretError,
  onChange
}) => {
  return (
    <div className="flex flex-col gap-2 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
      <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
        <span>Authentication</span>
        <InfoTooltip text="Choose whether to authenticate using Application Default Credentials (ADC) or a Service Account Key stored in GCP Secret Manager." />
      </label>
      <div className="flex flex-col gap-2 mt-1">
        <label className="flex items-center gap-2 cursor-pointer text-xs text-[var(--vscode-text-secondary)]">
          <input
            type="radio"
            name="authMode"
            value="adc"
            checked={authMode === 'adc'}
            onChange={onChange}
            className="accent-[var(--vscode-highlight)] text-[var(--vscode-highlight)]"
          />
          <span>Application Default Credentials (ADC / Compute Engine SA)</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer text-xs text-[var(--vscode-text-secondary)]">
          <input
            type="radio"
            name="authMode"
            value="secret_manager"
            checked={authMode === 'secret_manager'}
            onChange={onChange}
            className="accent-[var(--vscode-highlight)] text-[var(--vscode-highlight)]"
          />
          <span>GCP Secret Manager (Service Account Key)</span>
        </label>
      </div>

      {authMode === 'secret_manager' && (
        <div className="flex flex-col gap-3 mt-2 pl-2 border-l-2 border-[var(--vscode-highlight)]/50">
          <PropertyField
            id="spannerSinkServiceAccountKeySecret"
            name="serviceAccountKeySecret"
            label="Service Account Key Secret"
            value={serviceAccountKeySecret}
            onChange={onChange}
            list="spanner-sink-secret-options"
            datalist={secrets.map((s) => ({ value: s.id || s.name, label: s.name || s.id }))}
            placeholder="e.g. spanner-sa-key"
            tooltip="GCP Secret Manager secret containing the JSON service account key."
            error={secretError}
            invalid={!!secretError}
            mono={true}
          />
        </div>
      )}
    </div>
  );
};

/**
 * Props for the SpannerSinkAdvancedCard component.
 */
interface SpannerSinkAdvancedCardProps {
  showAdvanced: boolean;
  onToggle: () => void;
  host: string;
  commitDeadlineSeconds: number | string;
  maxCumulativeBackoffSeconds: number | string;
  databaseRole: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}

/**
 * Local presentational sub-component for Spanner Sink advanced endpoint and retry deadlines.
 */
const SpannerSinkAdvancedCard: React.FC<SpannerSinkAdvancedCardProps> = ({
  showAdvanced,
  onToggle,
  host,
  commitDeadlineSeconds,
  maxCumulativeBackoffSeconds,
  databaseRole,
  onChange
}) => {
  return (
    <CollapsibleSection
      title="Advanced Sink Settings"
      isOpen={showAdvanced}
      onToggle={onToggle}
    >
      <PropertyField
        id="spannerSinkHost"
        name="host"
        label="Spanner Host / Emulator Endpoint"
        value={host}
        onChange={onChange}
        placeholder="e.g. localhost:9010"
        tooltip="Custom Cloud Spanner endpoint override or local emulator host. Maps to withHost()."
        mono={true}
      />

      <PropertyField
        id="spannerSinkCommitDeadlineSeconds"
        name="commitDeadlineSeconds"
        label="Commit Deadline (Seconds)"
        type="number"
        value={commitDeadlineSeconds}
        onChange={onChange}
        placeholder="e.g. 60"
        tooltip="Deadline duration for Spanner commit API calls before retrying. Maps to withCommitDeadline()."
        min={0}
      />

      <PropertyField
        id="spannerSinkMaxCumulativeBackoffSeconds"
        name="maxCumulativeBackoffSeconds"
        label="Max Cumulative Backoff (Seconds)"
        type="number"
        value={maxCumulativeBackoffSeconds}
        onChange={onChange}
        placeholder="e.g. 900"
        tooltip="Maximum total time allowed for retries following deadline exceeded errors. Maps to withMaxCumulativeBackoff()."
        min={0}
      />

      <PropertyField
        id="spannerSinkDatabaseRole"
        name="databaseRole"
        label="Database Role"
        value={databaseRole}
        onChange={onChange}
        placeholder="e.g. analytics_writer"
        tooltip="Fine-grained access control (FGAC) database role passed to SpannerConfig.withDatabaseRole()."
        mono={true}
      />
    </CollapsibleSection>
  );
};

/**
 * SpannerIOSinkProperties renders the configuration form for writing mutations to Google Cloud Spanner.
 *
 * @param props Component properties containing the active node and onChange callback
 */
export const SpannerIOSinkProperties: React.FC<SpannerIOSinkPropertiesProps> = ({ node, onChange }) => {
  const properties = node.data.properties || {};

  // Form field state extracted from node properties
  const instanceId = properties.instanceId || '';
  const databaseId = properties.databaseId || '';
  const projectId = properties.projectId || '';
  const mutationMode: SpannerMutationMode = properties.mutationMode || 'insertOrUpdate';
  const batchSizeBytes = properties.batchSizeBytes ?? '';
  const maxNumMutations = properties.maxNumMutations ?? '';
  const maxNumRows = properties.maxNumRows ?? '';
  const groupingFactor = properties.groupingFactor ?? '';
  const failureMode: SpannerFailureMode = properties.failureMode || 'FAIL_FAST';
  const highPriority = properties.highPriority ?? false;
  const authMode = properties.authMode || 'adc';
  const serviceAccountKeySecret = properties.serviceAccountKeySecret || '';
  const host = properties.host || '';
  const commitDeadlineSeconds = properties.commitDeadlineSeconds ?? '';
  const maxCumulativeBackoffSeconds = properties.maxCumulativeBackoffSeconds ?? '';
  const databaseRole = properties.databaseRole || '';

  // Local state for dynamically loaded secrets and accordion toggle
  const { items: rawSecrets, error: secretError } = useAssetLoader<SecretItem | string>('secrets');
  const secrets: SecretItem[] = (rawSecrets || []).map(normalizeSecretItem);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Field validation
  const isInstanceEmpty = !instanceId.trim();
  const isDatabaseEmpty = !databaseId.trim();

  // Fallback chain for system instructions
  const systemInstructions = resolveSystemInstructions(node);

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
   * Handles text, number, select, and checkbox input changes.
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

  return (
    <div className="flex-1 flex flex-col gap-4 text-[var(--vscode-text-primary)] text-sm">
      {/* Instance & Database Identifiers */}
      <div className="flex flex-col gap-3 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
        <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          <span>Spanner Destination</span>
          <InfoTooltip text="Cloud Spanner target instance and database destination coordinates. Required." />
        </label>

        <PropertyField
          id="spannerSinkInstanceId"
          name="instanceId"
          label="Instance ID"
          required="Spanner instance ID is required"
          tooltip="Cloud Spanner destination instance identifier. Maps to withInstanceId()."
          value={instanceId}
          invalid={isInstanceEmpty}
          error={isInstanceEmpty ? 'Spanner instance ID is required' : null}
          placeholder="e.g. production-spanner-instance"
          onChange={handleChange}
          mono={true}
        />

        <PropertyField
          id="spannerSinkDatabaseId"
          name="databaseId"
          label="Database ID"
          required="Spanner database ID is required"
          tooltip="Cloud Spanner destination database identifier. Maps to withDatabaseId()."
          value={databaseId}
          invalid={isDatabaseEmpty}
          error={isDatabaseEmpty ? 'Spanner database ID is required' : null}
          placeholder="e.g. customer_records"
          onChange={handleChange}
          mono={true}
        />

        <PropertyField
          id="spannerSinkProjectId"
          name="projectId"
          label="Project ID (Optional)"
          tooltip="GCP Project ID hosting the target Spanner instance. Defaults to the pipeline runner project if omitted. Maps to withProjectId()."
          value={projectId}
          placeholder="e.g. my-gcp-project"
          onChange={handleChange}
          mono={true}
        />
      </div>

      {/* Mutation Mode */}
      <div className="flex flex-col gap-3 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
        <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          <span>Mutation Operation</span>
          <InfoTooltip text="Configures the primary Mutation type that the upstream transform step should construct for Spanner writes." />
        </label>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="spannerSinkMutationMode"
            className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]"
          >
            <span>Mutation Mode</span>
            <InfoTooltip text="Operation applied to records: insertOrUpdate (UPSERT), insert (New rows), update (Existing rows), replace (Full row overwrite), or delete (Row removal)." />
          </label>
          <select
            id="spannerSinkMutationMode"
            name="mutationMode"
            value={mutationMode}
            onChange={handleChange}
            className="bg-[var(--vscode-input-bg)] text-[var(--vscode-text-primary)] p-2 rounded border border-[var(--vscode-border)] text-xs focus:outline-none focus:border-[var(--vscode-highlight)]"
          >
            <option value="insertOrUpdate">insertOrUpdate (UPSERT — Insert or Update Existing)</option>
            <option value="insert">insert (INSERT — Insert New Rows Only)</option>
            <option value="update">update (UPDATE — Update Existing Rows Only)</option>
            <option value="replace">replace (REPLACE — Overwrite Existing Rows)</option>
            <option value="delete">delete (DELETE — Remove Matching Key Rows)</option>
          </select>
        </div>
      </div>

      {/* Throughput & Batching */}
      <SpannerSinkThroughputCard
        batchSizeBytes={batchSizeBytes}
        maxNumMutations={maxNumMutations}
        maxNumRows={maxNumRows}
        groupingFactor={groupingFactor}
        failureMode={failureMode}
        highPriority={highPriority}
        onChange={handleChange}
      />

      {/* Authentication */}
      <SpannerSinkAuthCard
        authMode={authMode}
        serviceAccountKeySecret={serviceAccountKeySecret}
        secrets={secrets}
        secretError={secretError}
        onChange={handleChange}
      />

      {/* Collapsible Advanced Sink Settings */}
      <SpannerSinkAdvancedCard
        showAdvanced={showAdvanced}
        onToggle={() => setShowAdvanced(!showAdvanced)}
        host={host}
        commitDeadlineSeconds={commitDeadlineSeconds}
        maxCumulativeBackoffSeconds={maxCumulativeBackoffSeconds}
        databaseRole={databaseRole}
        onChange={handleChange}
      />

      {/* Code Generation Instructions */}
      <SystemInstructionsField
        id="spannerSinkSystemInstructions"
        value={systemInstructions}
        rows={4}
        tooltip="Optional custom prompt instructions injected into LLM code generation for this transform."
        placeholder="Custom prompt instructions for generating the Apache Beam SpannerIO sink step..."
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
