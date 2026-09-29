/**
 * HL7v2IOSourceProperties Component
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Renders the property configuration panel for Apache Beam Cloud Healthcare HL7v2IO Source nodes
 * (`org.apache.beam.sdk.io.gcp.healthcare.HL7v2IO`).
 *
 * Architectural Decisions:
 * - Strictly implements the official Apache Beam Java `HL7v2IO` read transforms:
 *   - `read`: `HL7v2IO.read(hl7v2Store)` (bounded `ListHL7v2Messages` pagination)
 *   - `readWithFilter`: `HL7v2IO.readWithFilter(hl7v2Store, filter)`
 *   - `readAll`: `HL7v2IO.readAll(hl7v2Stores)`
 *   - `readAllWithFilter`: `HL7v2IO.readAllWithFilter(hl7v2Stores, filter)`
 *   - `getAll`: `HL7v2IO.getAll()` (`HL7v2IO.Read` fetching `HL7v2Message` payloads by message ID)
 *   - `readAllRequests`: `HL7v2IO.readAllRequests()` (`HL7v2IO.HL7v2Read` fetching via `HL7v2ReadParameter`)
 * - Conditionally exposes `filter` (for `readWithFilter` / `readAllWithFilter`), `initialSplitDuration`
 *   (for `ListHL7v2Messages` modes via `.withInitialSplitDuration(Duration)`), and `pubsubSubscription`
 *   (for streaming message ID ingestion into `getAll` / `readAllRequests`).
 * - Integrates dynamic Cloud Healthcare dataset discovery via `useAssetLoader('healthcareDatasets')`.
 * - Adheres to 8pt grid spacing, VS Code theme tokens (`--vscode-*`), and `system_instructions` override.
 */

import React from 'react';
import { RefreshCw } from 'lucide-react';
import { InfoTooltip } from '../../components/InfoTooltip';
import { PropertyField } from '../../components/common/PropertyField';
import { useAssetLoader } from '../../hooks/useAssetLoader';

export type HL7v2ReadMode =
  | 'read'
  | 'readWithFilter'
  | 'readAll'
  | 'readAllWithFilter'
  | 'getAll'
  | 'readAllRequests';

export interface HL7v2IOSourcePropertiesProps {
  node?: any;
  nodeId?: string;
  data?: Record<string, any>;
  onChange?: (properties: Record<string, any>) => void;
}

/**
 * Renders the HL7v2IO Source configuration form.
 *
 * @param props Component properties (`node`, `onChange`, or `data`).
 * @returns React element for configuring HL7v2IO source parameters.
 */
export const HL7v2IOSourceProperties: React.FC<HL7v2IOSourcePropertiesProps> = ({
  node,
  data,
  onChange
}) => {
  const rawData = node?.data || data || {};
  const properties: Record<string, any> = rawData.properties || rawData || {};

  const {
    items: healthcareDatasets,
    loading: loadingDatasets,
    error: datasetsError,
    refresh: refreshDatasets
  } = useAssetLoader<string>('healthcareDatasets');
  const { items: subscriptions } = useAssetLoader<string>('subscriptions');

  const readMode: HL7v2ReadMode = (properties.readMode as HL7v2ReadMode) || 'read';
  const healthcareDataset: string = properties.healthcareDataset || '';
  const hl7v2Store: string = properties.hl7v2Store || '';
  const filter: string = properties.filter || '';
  const initialSplitDuration: string = properties.initialSplitDuration || '';
  const pubsubSubscription: string = properties.pubsubSubscription || '';
  const expansionService: string = properties.expansionService || '';

  const systemInstructions: string =
    rawData.system_instructions ??
    rawData.special_instructions ??
    properties.system_instructions ??
    properties.special_instructions ??
    '';

  const isListMessagesMode =
    readMode === 'read' ||
    readMode === 'readWithFilter' ||
    readMode === 'readAll' ||
    readMode === 'readAllWithFilter';
  const isFilterMode = readMode === 'readWithFilter' || readMode === 'readAllWithFilter';
  const isFetchByIdMode = readMode === 'getAll' || readMode === 'readAllRequests';

  const isStoreInvalid = isListMessagesMode && !hl7v2Store.trim();
  const isFilterInvalid = isFilterMode && !filter.trim();

  const hl7v2StoreSuggestions = healthcareDatasets.map(
    (ds) => `${ds.replace(/\/$/, '')}/hl7V2Stores/my-hl7v2-store`
  );

  /**
   * Emits updated properties upward to the parent form container.
   *
   * @param updates Partial property updates.
   */
  const emitChange = (updates: Record<string, any>) => {
    if (onChange) {
      onChange({
        ...properties,
        ...updates
      });
    }
  };

  /**
   * Handles form element changes.
   *
   * @param e Change event.
   */
  const handleFieldChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    if (name === 'healthcareDataset') {
      const nextUpdates: Record<string, any> = { healthcareDataset: value };
      if (value && !hl7v2Store.trim()) {
        nextUpdates.hl7v2Store = `${value.replace(/\/$/, '')}/hl7V2Stores/`;
      }
      emitChange(nextUpdates);
      return;
    }
    emitChange({ [name]: value });
  };

  return (
    <div className="flex-1 flex flex-col gap-4 text-[var(--vscode-foreground,#e2e8f0)]">
      {/* Core HL7v2 Store & Read Mode */}
      <details open className="group border border-[var(--vscode-panel-border,#334155)] rounded p-4">
        <summary className="cursor-pointer text-xs font-bold uppercase tracking-wider text-[var(--vscode-descriptionForeground,#94a3b8)] select-none mb-4">
          HL7v2 Store &amp; Read Operation
        </summary>

        <div className="flex flex-col gap-4">
          {/* Read Mode Selector */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label
                htmlFor="hl7v2ReadMode"
                className="text-xs font-semibold text-[var(--vscode-foreground,#cbd5e1)]"
              >
                Read Operation (HL7v2IO)
              </label>
              <InfoTooltip text="Selects the Apache Beam HL7v2IO read method: bounded ListHL7v2Messages (`HL7v2IO.read`, `HL7v2IO.readWithFilter`, `HL7v2IO.readAll`, `HL7v2IO.readAllWithFilter`) or streaming/ID-based message fetching (`HL7v2IO.getAll()`, `HL7v2IO.readAllRequests()`)." />
            </div>
            <select
              id="hl7v2ReadMode"
              name="readMode"
              value={readMode}
              onChange={handleFieldChange}
              className="w-full bg-[var(--vscode-input-background,#0f172a)] border border-[var(--vscode-input-border,#334155)] rounded px-2 py-2 text-xs font-mono text-[var(--vscode-input-foreground,#e2e8f0)]"
            >
              <option value="read">HL7v2IO.read(hl7v2Store) — Bounded List</option>
              <option value="readWithFilter">HL7v2IO.readWithFilter(hl7v2Store, filter) — Filtered List</option>
              <option value="readAll">HL7v2IO.readAll(hl7v2Stores) — Multi-Store List</option>
              <option value="readAllWithFilter">
                HL7v2IO.readAllWithFilter(hl7v2Stores, filter) — Filtered Multi-Store List
              </option>
              <option value="getAll">HL7v2IO.getAll() — Fetch Messages by ID (Pub/Sub / PCollection)</option>
              <option value="readAllRequests">
                HL7v2IO.readAllRequests() — Fetch via HL7v2ReadParameter
              </option>
            </select>
          </div>

          {/* Dynamic Healthcare Dataset Picker */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label
                htmlFor="hl7v2HealthcareDataset"
                className="text-xs font-semibold text-[var(--vscode-foreground,#cbd5e1)]"
              >
                Cloud Healthcare Dataset (Discovery)
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={refreshDatasets}
                  title="Refresh Cloud Healthcare Datasets"
                  aria-label="Refresh Cloud Healthcare Datasets"
                  className="p-1 rounded hover:bg-[var(--vscode-toolbar-hoverBackground,#1e293b)] text-[var(--vscode-descriptionForeground,#94a3b8)]"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingDatasets ? 'animate-spin' : ''}`} />
                </button>
                <InfoTooltip text="Discovers Cloud Healthcare datasets via `gcloud healthcare datasets list --format=json` (`getHealthcareDatasets`)." />
              </div>
            </div>
            <input
              id="hl7v2HealthcareDataset"
              name="healthcareDataset"
              type="text"
              list="hl7v2-source-healthcare-datasets"
              value={healthcareDataset}
              onChange={handleFieldChange}
              placeholder="projects/my-project/locations/us-central1/datasets/my-dataset"
              className="w-full bg-[var(--vscode-input-background,#0f172a)] border border-[var(--vscode-input-border,#334155)] rounded px-2 py-2 text-xs font-mono text-[var(--vscode-input-foreground,#e2e8f0)]"
            />
            <datalist id="hl7v2-source-healthcare-datasets">
              {healthcareDatasets.map((ds) => (
                <option key={ds} value={ds} />
              ))}
            </datalist>
            {datasetsError && (
              <span className="text-xs text-[var(--vscode-errorForeground,#f87171)]">{datasetsError}</span>
            )}
          </div>

          {/* HL7v2 Store Resource Name */}
          <PropertyField
            id="hl7v2SourceStore"
            name="hl7v2Store"
            label={
              readMode === 'readAll' || readMode === 'readAllWithFilter'
                ? 'HL7v2 Store Resource Names (Comma-Separated)'
                : 'HL7v2 Store Resource Name'
            }
            required={isListMessagesMode ? 'Required for HL7v2IO.ListHL7v2Messages' : false}
            invalid={isStoreInvalid}
            tooltip="Full Cloud Healthcare HL7v2 store resource path: projects/{project_id}/locations/{location_id}/datasets/{dataset_id}/hl7V2Stores/{hl7_v2_store_id} (comma-separated for readAll/readAllWithFilter)."
            value={hl7v2Store}
            onChange={handleFieldChange}
            placeholder="projects/my-project/locations/us-central1/datasets/my-dataset/hl7V2Stores/my-hl7v2-store"
            list="hl7v2-source-store-suggestions"
            datalist={hl7v2StoreSuggestions}
          />
        </div>
      </details>

      {/* Query / Filter / Notification Settings */}
      <details open className="group border border-[var(--vscode-panel-border,#334155)] rounded p-4">
        <summary className="cursor-pointer text-xs font-bold uppercase tracking-wider text-[var(--vscode-descriptionForeground,#94a3b8)] select-none mb-4">
          Query, Split &amp; Notification Parameters
        </summary>

        <div className="flex flex-col gap-4">
          {isFilterMode && (
            <PropertyField
              id="hl7v2Filter"
              name="filter"
              label="Message Filter Expression (filter)"
              required="Filter expression is required for readWithFilter and readAllWithFilter"
              invalid={isFilterInvalid}
              tooltip="Cloud Healthcare HL7v2 message filter passed to `HL7v2IO.readWithFilter(hl7v2Store, filter)` (e.g., `messageType = &quot;ADT&quot; AND sendTime >= &quot;2025-01-01T00:00:00Z&quot;`)."
              value={filter}
              onChange={handleFieldChange}
              placeholder='messageType = "ADT" AND sendTime >= "2025-01-01T00:00:00Z"'
            />
          )}

          {isListMessagesMode && (
            <PropertyField
              id="hl7v2InitialSplitDuration"
              name="initialSplitDuration"
              label="Initial Split Duration (Optional)"
              tooltip="Optional ISO-8601 duration passed to `HL7v2IO.ListHL7v2Messages.withInitialSplitDuration(Duration)` to partition sendTime query ranges in parallel (defaults to daily P1D / PT24H)."
              value={initialSplitDuration}
              onChange={handleFieldChange}
              placeholder="PT24H"
            />
          )}

          {isFetchByIdMode && (
            <PropertyField
              id="hl7v2PubsubSubscription"
              name="pubsubSubscription"
              label="Notification Pub/Sub Subscription (Optional)"
              tooltip="Optional Cloud Pub/Sub subscription delivering HL7v2 store notification message IDs into `PubsubIO.readStrings().fromSubscription(...)` prior to `HL7v2IO.getAll()`."
              value={pubsubSubscription}
              onChange={handleFieldChange}
              placeholder="projects/my-project/subscriptions/hl7v2-notifications-sub"
              list="hl7v2-source-subscriptions"
              datalist={subscriptions}
            />
          )}
        </div>
      </details>

      {/* Cross-Language & Advanced Settings */}
      <details className="group border border-[var(--vscode-panel-border,#334155)] rounded p-4">
        <summary className="cursor-pointer text-xs font-bold uppercase tracking-wider text-[var(--vscode-descriptionForeground,#94a3b8)] select-none mb-4">
          Cross-Language &amp; Advanced Settings
        </summary>

        <div className="flex flex-col gap-4">
          <PropertyField
            id="hl7v2SourceExpansionService"
            name="expansionService"
            label="Java Expansion Service Endpoint (Optional)"
            tooltip="Host:port of the Apache Beam GCP Healthcare Java Expansion Service when invoking HL7v2IO from a Python cross-language pipeline."
            value={expansionService}
            onChange={handleFieldChange}
            placeholder="localhost:8097"
          />
        </div>
      </details>

      {/* Code Generation Instructions */}
      <div className="flex-1 min-h-[16px]" />
      <PropertyField
        id="hl7v2SourceSystemInstructions"
        name="system_instructions"
        label="Code Generation Instructions"
        type="textarea"
        rows={3}
        mono={false}
        tooltip="Custom instructions for the LLM code generator (e.g., extracting schematizedData or routing HL7v2IO.Read.Result.getFailedReads())."
        value={systemInstructions}
        onChange={handleFieldChange}
        placeholder="e.g., Extract HL7v2Message.getSchematizedData() and route HL7v2IO.Read.Result.getFailedReads() to dead-letter storage..."
      />
    </div>
  );
};

export const HL7v2IOProperties = HL7v2IOSourceProperties;
export default HL7v2IOSourceProperties;
