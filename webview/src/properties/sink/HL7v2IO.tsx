/**
 * HL7v2IOSinkProperties Component
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Renders the property configuration panel for Apache Beam Cloud Healthcare HL7v2IO Sink nodes
 * (`org.apache.beam.sdk.io.gcp.healthcare.HL7v2IO.Write`).
 *
 * Architectural Decisions:
 * - Strictly implements `HL7v2IO.ingestMessages(String hl7v2Store)` (`HL7v2IO.Write.WriteMethod.INGEST`).
 * - Explicitly excludes `BATCH_IMPORT` as a selectable write method because the official Apache Beam
 *   `HL7v2IO.Write.WriteMethod` Javadoc states verbatim:
 *   "Batch import write method. This is not yet supported by HL7v2IO."
 * - Integrates dynamic Cloud Healthcare dataset discovery via `useAssetLoader('healthcareDatasets')`.
 * - Adheres to 8pt grid spacing, VS Code theme variables (`--vscode-*`), and `system_instructions` override.
 */

import React from 'react';
import { RefreshCw } from 'lucide-react';
import { InfoTooltip } from '../../components/InfoTooltip';
import { PropertyField } from '../../components/common/PropertyField';
import { SystemInstructionsField } from '../../components/common/SystemInstructionsField';
import { useAssetLoader } from '../../hooks/useAssetLoader';

/**
 * Props for the HL7v2IOSinkProperties component.
 */
export interface HL7v2IOSinkPropertiesProps {
  node?: any;
  nodeId?: string;
  data?: Record<string, any>;
  onChange?: (properties: Record<string, any>) => void;
}

/**
 * Renders the HL7v2IO Sink configuration form.
 *
 * @param props Component properties (`node`, `onChange`, or `data`).
 * @returns React element for configuring HL7v2IO sink parameters.
 */
export const HL7v2IOSinkProperties: React.FC<HL7v2IOSinkPropertiesProps> = ({
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

  const healthcareDataset: string = properties.healthcareDataset || '';
  const hl7v2Store: string = properties.hl7v2Store || '';
  // Sole supported WriteMethod in Apache Beam HL7v2IO is INGEST (HL7v2IO.ingestMessages)
  const writeMethod = 'INGEST';
  const expansionService: string = properties.expansionService || '';

  const systemInstructions: string =
    rawData.system_instructions ??
    rawData.special_instructions ??
    properties.system_instructions ??
    properties.special_instructions ??
    '';

  const isStoreInvalid = !hl7v2Store.trim();

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
        writeMethod: 'INGEST',
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
      {/* Core HL7v2 Sink Configuration */}
      <details open className="group border border-[var(--vscode-panel-border,#334155)] rounded p-4">
        <summary className="cursor-pointer text-xs font-bold uppercase tracking-wider text-[var(--vscode-descriptionForeground,#94a3b8)] select-none mb-4">
          HL7v2 Store &amp; Ingest Configuration
        </summary>

        <div className="flex flex-col gap-4">
          {/* Write Method (INGEST only per Apache Beam HL7v2IO Javadoc) */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label
                htmlFor="hl7v2WriteMethod"
                className="text-xs font-semibold text-[var(--vscode-foreground,#cbd5e1)]"
              >
                Write Method (HL7v2IO.Write.WriteMethod)
              </label>
              <InfoTooltip text="Apache Beam HL7v2IO supports only INGEST (`HL7v2IO.ingestMessages(hl7v2Store)` via the HL7v2 REST API `messages.ingest`). Note: BATCH_IMPORT is explicitly marked as unsupported in the Apache Beam HL7v2IO Javadoc." />
            </div>
            <select
              id="hl7v2WriteMethod"
              name="writeMethod"
              value={writeMethod}
              onChange={handleFieldChange}
              className="w-full bg-[var(--vscode-input-background,#0f172a)] border border-[var(--vscode-input-border,#334155)] rounded px-2 py-2 text-xs font-mono text-[var(--vscode-input-foreground,#e2e8f0)]"
            >
              <option value="INGEST">INGEST — HL7v2IO.ingestMessages(hl7v2Store)</option>
            </select>
          </div>

          {/* Dynamic Healthcare Dataset Picker */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label
                htmlFor="hl7v2SinkHealthcareDataset"
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
              id="hl7v2SinkHealthcareDataset"
              name="healthcareDataset"
              type="text"
              list="hl7v2-sink-healthcare-datasets"
              value={healthcareDataset}
              onChange={handleFieldChange}
              placeholder="projects/my-project/locations/us-central1/datasets/my-dataset"
              className="w-full bg-[var(--vscode-input-background,#0f172a)] border border-[var(--vscode-input-border,#334155)] rounded px-2 py-2 text-xs font-mono text-[var(--vscode-input-foreground,#e2e8f0)]"
            />
            <datalist id="hl7v2-sink-healthcare-datasets">
              {healthcareDatasets.map((ds) => (
                <option key={ds} value={ds} />
              ))}
            </datalist>
            {datasetsError && (
              <span className="text-xs text-[var(--vscode-errorForeground,#f87171)]">{datasetsError}</span>
            )}
          </div>

          {/* Target HL7v2 Store */}
          <PropertyField
            id="hl7v2SinkStore"
            name="hl7v2Store"
            label="Target HL7v2 Store Resource Name"
            required="Target HL7v2 Store is required"
            invalid={isStoreInvalid}
            tooltip="Full Cloud Healthcare HL7v2 store resource identifier passed to `HL7v2IO.ingestMessages(hl7v2Store)` (`projects/{project}/locations/{location}/datasets/{dataset}/hl7V2Stores/{hl7v2Store}`)."
            value={hl7v2Store}
            onChange={handleFieldChange}
            placeholder="projects/my-project/locations/us-central1/datasets/my-dataset/hl7V2Stores/my-hl7v2-store"
            list="hl7v2-sink-store-suggestions"
            datalist={hl7v2StoreSuggestions}
          />
        </div>
      </details>

      {/* Cross-Language & Advanced Settings */}
      <details className="group border border-[var(--vscode-panel-border,#334155)] rounded p-4">
        <summary className="cursor-pointer text-xs font-bold uppercase tracking-wider text-[var(--vscode-descriptionForeground,#94a3b8)] select-none mb-4">
          Cross-Language &amp; Advanced Settings
        </summary>

        <div className="flex flex-col gap-4">
          <PropertyField
            id="hl7v2SinkExpansionService"
            name="expansionService"
            label="Java Expansion Service Endpoint (Optional)"
            tooltip="Host:port of the Apache Beam GCP Healthcare Java Expansion Service when invoking HL7v2IO.Write from a Python cross-language pipeline."
            value={expansionService}
            onChange={handleFieldChange}
            placeholder="localhost:8097"
          />
        </div>
      </details>

      {/* Code Generation Instructions */}
      <SystemInstructionsField
        id="hl7v2SinkSystemInstructions"
        value={systemInstructions}
        tooltip="Custom instructions for the LLM code generator (e.g., handling HL7v2IO.Write.Result.getFailedInsertsWithErr())."
        placeholder="e.g., Capture HL7v2IO.Write.Result.getFailedInsertsWithErr() and route failed HL7v2Message records to dead-letter logging..."
        onChange={(value) => emitChange({ system_instructions: value })}
      />
    </div>
  );
};

export const HL7v2IOProperties = HL7v2IOSinkProperties;
export default HL7v2IOSinkProperties;
