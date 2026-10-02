/**
 * FhirIOSinkProperties Component
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Renders the property configuration panel for Apache Beam Cloud Healthcare FhirIO Sink nodes
 * (`org.apache.beam.sdk.io.gcp.healthcare.FhirIO.Write`).
 *
 * Architectural Decisions:
 * - Implements the two official `FhirIO.Write.WriteMethod` modes documented in Apache Beam Java SDK:
 *   1. `EXECUTE_BUNDLE` (`FhirIO.Write.executeBundles(fhirStore)` / `new FhirIO.ExecuteBundles(fhirStore)`)
 *      for streaming or batch execution of FHIR R4 BATCH/TRANSACTION bundles.
 *   2. `IMPORT` (`FhirIO.Write.fhirStoresImport(fhirStore, gcsTempPath, gcsDeadLetterPath, contentStructure)`)
 *      for batch bulk import staging newline-delimited JSON to GCS.
 * - Conditionally renders `gcsTempPath`, `gcsDeadLetterPath`, and `contentStructure` (`BUNDLE`, `RESOURCE`,
 *   `CONTENT_STRUCTURE_UNSPECIFIED`) only when `writeMethod === 'IMPORT'`.
 * - Integrates dynamic Cloud Healthcare dataset discovery via `useAssetLoader('healthcareDatasets')`.
 * - Adheres to 8pt grid spacing, VS Code theme variables (`--vscode-*`), and `system_instructions` override.
 */

import React from 'react';
import { RefreshCw } from 'lucide-react';
import { InfoTooltip } from '../../components/InfoTooltip';
import { PropertyField } from '../../components/common/PropertyField';
import { SystemInstructionsField } from '../../components/common/SystemInstructionsField';
import { useAssetLoader } from '../../hooks/useAssetLoader';

export type FhirWriteMethod = 'EXECUTE_BUNDLE' | 'IMPORT';
export type FhirImportContentStructure = 'BUNDLE' | 'RESOURCE' | 'CONTENT_STRUCTURE_UNSPECIFIED';

/**
 * Props for the FhirIOSinkProperties component.
 */
export interface FhirIOSinkPropertiesProps {
  node?: any;
  nodeId?: string;
  data?: Record<string, any>;
  onChange?: (properties: Record<string, any>) => void;
}

/**
 * Renders the FhirIO Sink configuration form.
 *
 * @param props Component properties (`node`, `onChange`, or `data`).
 * @returns React element for configuring FhirIO sink parameters.
 */
export const FhirIOSinkProperties: React.FC<FhirIOSinkPropertiesProps> = ({
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
  const { items: storageBuckets } = useAssetLoader<string>('storageBuckets');

  const writeMethod: FhirWriteMethod = (properties.writeMethod as FhirWriteMethod) || 'EXECUTE_BUNDLE';
  const healthcareDataset: string = properties.healthcareDataset || '';
  const fhirStore: string = properties.fhirStore || '';
  const gcsTempPath: string = properties.gcsTempPath || '';
  const gcsDeadLetterPath: string = properties.gcsDeadLetterPath || '';
  const contentStructure: FhirImportContentStructure =
    (properties.contentStructure as FhirImportContentStructure) || 'BUNDLE';
  const expansionService: string = properties.expansionService || '';

  const systemInstructions: string =
    rawData.system_instructions ??
    rawData.special_instructions ??
    properties.system_instructions ??
    properties.special_instructions ??
    '';

  const isFhirStoreInvalid = !fhirStore.trim();
  const isDeadLetterPathInvalid = writeMethod === 'IMPORT' && !gcsDeadLetterPath.trim();

  const fhirStoreSuggestions = healthcareDatasets.map(
    (ds) => `${ds.replace(/\/$/, '')}/fhirStores/my-fhir-store`
  );
  const gcsTempSuggestions = storageBuckets.map((b) => `gs://${b}/fhir-import-temp/`);
  const gcsDlqSuggestions = storageBuckets.map((b) => `gs://${b}/fhir-import-dlq/`);

  /**
   * Emits updated properties to parent form container.
   *
   * @param updates Partial property changes to merge.
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
   * Handles input/select/textarea value updates.
   *
   * @param e Change event.
   */
  const handleFieldChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    if (name === 'healthcareDataset') {
      const nextUpdates: Record<string, any> = { healthcareDataset: value };
      if (value && !fhirStore.trim()) {
        nextUpdates.fhirStore = `${value.replace(/\/$/, '')}/fhirStores/`;
      }
      emitChange(nextUpdates);
      return;
    }
    emitChange({ [name]: value });
  };

  return (
    <div className="flex-1 flex flex-col gap-4 text-[var(--vscode-foreground,#e2e8f0)]">
      {/* Core Write Method & Target FHIR Store */}
      <details open className="group border border-[var(--vscode-panel-border,#334155)] rounded p-4">
        <summary className="cursor-pointer text-xs font-bold uppercase tracking-wider text-[var(--vscode-descriptionForeground,#94a3b8)] select-none mb-4">
          FHIR Store &amp; Write Method
        </summary>

        <div className="flex flex-col gap-4">
          {/* Write Method */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label
                htmlFor="fhirWriteMethod"
                className="text-xs font-semibold text-[var(--vscode-foreground,#cbd5e1)]"
              >
                Write Method (FhirIO.Write.WriteMethod)
              </label>
              <InfoTooltip text="Selects the Apache Beam FhirIO.Write method: EXECUTE_BUNDLE (`FhirIO.Write.executeBundles(fhirStore)`, supports both streaming and batch PCollections) or IMPORT (`FhirIO.Write.fhirStoresImport(fhirStore, gcsTempPath, gcsDeadLetterPath, contentStructure)`, batch-only bulk import via GCS)." />
            </div>
            <select
              id="fhirWriteMethod"
              name="writeMethod"
              value={writeMethod}
              onChange={handleFieldChange}
              className="w-full bg-[var(--vscode-input-background,#0f172a)] border border-[var(--vscode-input-border,#334155)] rounded px-2 py-2 text-xs font-mono text-[var(--vscode-input-foreground,#e2e8f0)] focus:outline-none focus:border-[var(--vscode-focusBorder,#3b82f6)]"
            >
              <option value="EXECUTE_BUNDLE">EXECUTE_BUNDLE — FhirIO.Write.executeBundles(fhirStore)</option>
              <option value="IMPORT">IMPORT — FhirIO.Write.fhirStoresImport(...) [Batch Only]</option>
            </select>
          </div>

          {/* Dynamic Healthcare Dataset Selector */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label
                htmlFor="fhirSinkHealthcareDataset"
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
              id="fhirSinkHealthcareDataset"
              name="healthcareDataset"
              type="text"
              list="fhir-sink-healthcare-datasets"
              value={healthcareDataset}
              onChange={handleFieldChange}
              placeholder="projects/my-project/locations/us-central1/datasets/my-dataset"
              className="w-full bg-[var(--vscode-input-background,#0f172a)] border border-[var(--vscode-input-border,#334155)] rounded px-2 py-2 text-xs font-mono text-[var(--vscode-input-foreground,#e2e8f0)]"
            />
            <datalist id="fhir-sink-healthcare-datasets">
              {healthcareDatasets.map((ds) => (
                <option key={ds} value={ds} />
              ))}
            </datalist>
            {datasetsError && (
              <span className="text-xs text-[var(--vscode-errorForeground,#f87171)]">{datasetsError}</span>
            )}
          </div>

          {/* Target FHIR Store */}
          <PropertyField
            id="fhirSinkStore"
            name="fhirStore"
            label="Target FHIR Store Resource Name"
            required="Target FHIR Store is required"
            invalid={isFhirStoreInvalid}
            tooltip="Full Cloud Healthcare FHIR store resource path (`projects/{project}/locations/{location}/datasets/{dataset}/fhirStores/{fhirStore}`)."
            value={fhirStore}
            onChange={handleFieldChange}
            placeholder="projects/my-project/locations/us-central1/datasets/my-dataset/fhirStores/my-fhir-store"
            list="fhir-sink-store-suggestions"
            datalist={fhirStoreSuggestions}
          />
        </div>
      </details>

      {/* Bulk Import (FhirIO.Import) Parameters */}
      {writeMethod === 'IMPORT' && (
        <details open className="group border border-[var(--vscode-panel-border,#334155)] rounded p-4">
          <summary className="cursor-pointer text-xs font-bold uppercase tracking-wider text-[var(--vscode-descriptionForeground,#94a3b8)] select-none mb-4">
            Bulk Import Configuration (FhirIO.Import)
          </summary>

          <div className="flex flex-col gap-4">
            <PropertyField
              id="fhirGcsTempPath"
              name="gcsTempPath"
              label="GCS Temporary Staging Path (gcsTempPath)"
              tooltip="Temporary Cloud Storage URI (`gs://...`) used by `FhirIO.Write.fhirStoresImport` to stage newline-delimited JSON files prior to invoking `fhirStores.import`."
              value={gcsTempPath}
              onChange={handleFieldChange}
              placeholder="gs://my-bucket/fhir-import/temp/"
              list="fhir-import-temp-suggestions"
              datalist={gcsTempSuggestions}
            />

            <PropertyField
              id="fhirGcsDeadLetterPath"
              name="gcsDeadLetterPath"
              label="GCS Dead-Letter Path (gcsDeadLetterPath)"
              required="gcsDeadLetterPath is required when writeMethod is IMPORT"
              invalid={isDeadLetterPathInvalid}
              tooltip="Required Cloud Storage URI (`gs://...`) where `FhirIO.Import` stores failed NDJSON files and dead-letter records."
              value={gcsDeadLetterPath}
              onChange={handleFieldChange}
              placeholder="gs://my-bucket/fhir-import/deadletter/"
              list="fhir-import-dlq-suggestions"
              datalist={gcsDlqSuggestions}
            />

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="fhirContentStructure"
                  className="text-xs font-semibold text-[var(--vscode-foreground,#cbd5e1)]"
                >
                  Content Structure (FhirIO.Import.ContentStructure)
                </label>
                <InfoTooltip text="Maps to `FhirIO.Import.ContentStructure` enum (`BUNDLE`, `RESOURCE`, or `CONTENT_STRUCTURE_UNSPECIFIED`)." />
              </div>
              <select
                id="fhirContentStructure"
                name="contentStructure"
                value={contentStructure}
                onChange={handleFieldChange}
                className="w-full bg-[var(--vscode-input-background,#0f172a)] border border-[var(--vscode-input-border,#334155)] rounded px-2 py-2 text-xs font-mono text-[var(--vscode-input-foreground,#e2e8f0)]"
              >
                <option value="BUNDLE">BUNDLE — Each line is a FHIR Bundle JSON</option>
                <option value="RESOURCE">RESOURCE — Each line is a standalone FHIR Resource JSON</option>
                <option value="CONTENT_STRUCTURE_UNSPECIFIED">CONTENT_STRUCTURE_UNSPECIFIED — Default (BUNDLE)</option>
              </select>
            </div>
          </div>
        </details>
      )}

      {/* Cross-Language & Advanced Settings */}
      <details className="group border border-[var(--vscode-panel-border,#334155)] rounded p-4">
        <summary className="cursor-pointer text-xs font-bold uppercase tracking-wider text-[var(--vscode-descriptionForeground,#94a3b8)] select-none mb-4">
          Cross-Language &amp; Advanced Settings
        </summary>

        <div className="flex flex-col gap-4">
          <PropertyField
            id="fhirSinkExpansionService"
            name="expansionService"
            label="Java Expansion Service Endpoint (Optional)"
            tooltip="Host:port of the Apache Beam GCP Healthcare Java Expansion Service when invoking FhirIO.Write from a Python cross-language pipeline."
            value={expansionService}
            onChange={handleFieldChange}
            placeholder="localhost:8097"
          />
        </div>
      </details>

      <SystemInstructionsField
        id="fhirSinkSystemInstructions"
        value={systemInstructions}
        tooltip="Custom instructions for the LLM code generator (e.g., handling FhirIO.Write.AbstractResult.getFailedBodies())."
        placeholder="e.g., Capture FhirIO.Write.Result.getFailedBodies() and log or route failed bundles to dead-letter storage..."
        onChange={(value) => emitChange({ system_instructions: value })}
      />
    </div>
  );
};

export const FhirIOProperties = FhirIOSinkProperties;
export default FhirIOSinkProperties;
