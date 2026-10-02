/**
 * FhirIOSourceProperties Component
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Renders the property configuration panel for Apache Beam Cloud Healthcare FhirIO Source nodes
 * (`org.apache.beam.sdk.io.gcp.healthcare.FhirIO`).
 *
 * Architectural Decisions:
 * - Strictly implements only authentic Apache Beam `FhirIO` read/query transforms documented in the
 *   official Java SDK (`FhirIO.readResources()`, `FhirIO.searchResources(fhirStore)`,
 *   `FhirIO.exportResources(fhirStore, exportUri)`, `FhirIO.deidentify(sourceFhirStore, destinationFhirStore, deidConfig)`,
 *   and `FhirIO.getPatientEverything()`).
 * - Integrates dynamic Cloud Healthcare dataset discovery via `useAssetLoader('healthcareDatasets')`
 *   (`getHealthcareDatasets` -> `gcloud healthcare datasets list --format=json`) to assist FHIR store path entry.
 * - Conditionally renders transform-specific parameters (`resourceType`/`searchKey`/`searchQueries`,
 *   `exportUri`, `destinationFhirStore`) and a 1-click "Add PubSubIO Source" action when `readMode === 'readResources'`.
 * - Adheres to the 8pt grid spacing system, VS Code CSS custom properties (`--vscode-*`), and provides
 *   collapsible configuration sections plus the standard `system_instructions` override textarea.
 */

import React from 'react';
import { RefreshCw } from 'lucide-react';
import { InfoTooltip } from '../../components/InfoTooltip';
import { PropertyField } from '../../components/common/PropertyField';
import { SystemInstructionsField } from '../../components/common/SystemInstructionsField';
import { useAssetLoader } from '../../hooks/useAssetLoader';

export type FhirReadMode =
  | 'readResources'
  | 'searchResources'
  | 'exportResources'
  | 'deidentify'
  | 'getPatientEverything';

/** Props for the {@link FhirIOSourceProperties} component. */
export interface FhirIOSourcePropertiesProps {
  node?: any;
  nodeId?: string;
  data?: Record<string, any>;
  onChange?: (properties: Record<string, any>) => void;
  onAddPubSubSource?: (targetNodeId: string) => void;
}

/**
 * Renders the FhirIO Source configuration form.
 *
 * @param props Component properties (`node`, `onChange`, `onAddPubSubSource`, or `data`).
 * @returns React element for configuring FhirIO source parameters.
 */
export const FhirIOSourceProperties: React.FC<FhirIOSourcePropertiesProps> = ({
  node,
  nodeId,
  data,
  onChange,
  onAddPubSubSource
}) => {
  const rawData = node?.data || data || {};
  const properties: Record<string, any> = rawData.properties || rawData || {};
  const targetId = node?.id || nodeId;

  // Dynamic asset discovery from Extension Host
  const {
    items: healthcareDatasets,
    loading: loadingDatasets,
    error: datasetsError,
    refresh: refreshDatasets
  } = useAssetLoader<string>('healthcareDatasets');
  const { items: storageBuckets } = useAssetLoader<string>('storageBuckets');

  const readMode: FhirReadMode = (properties.readMode as FhirReadMode) || 'readResources';
  const healthcareDataset: string = properties.healthcareDataset || '';
  const fhirStore: string = properties.fhirStore || '';
  const resourceType: string = properties.resourceType || '';
  const searchKey: string = properties.searchKey || '';
  const searchQueries: string = properties.searchQueries || '';
  const exportUri: string = properties.exportUri || '';
  const destinationFhirStore: string = properties.destinationFhirStore || '';
  const expansionService: string = properties.expansionService || '';

  const systemInstructions: string =
    rawData.system_instructions ??
    rawData.special_instructions ??
    properties.system_instructions ??
    properties.special_instructions ??
    '';

  const requiresFhirStore =
    readMode === 'searchResources' || readMode === 'exportResources' || readMode === 'deidentify';
  const isFhirStoreInvalid = requiresFhirStore && !fhirStore.trim();
  const isExportUriInvalid = readMode === 'exportResources' && !exportUri.trim();
  const isDestStoreInvalid = readMode === 'deidentify' && !destinationFhirStore.trim();

  // Derive FHIR store prefix suggestions from discovered Cloud Healthcare datasets
  const fhirStoreSuggestions = healthcareDatasets.map(
    (ds) => `${ds.replace(/\/$/, '')}/fhirStores/my-fhir-store`
  );
  const exportUriSuggestions = storageBuckets.map((b) => `gs://${b}/fhir-export/`);

  /**
   * Emits updated node properties upward via onChange callback.
   *
   * @param updates Partial property updates to merge.
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
   * Handles standard input, select, and textarea changes.
   *
   * @param e React change event.
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
      {/* Core FHIR Read Mode & Store Configuration */}
      <details open className="group border border-[var(--vscode-panel-border,#334155)] rounded p-4">
        <summary className="cursor-pointer text-xs font-bold uppercase tracking-wider text-[var(--vscode-descriptionForeground,#94a3b8)] select-none mb-4">
          FHIR Store &amp; Read Operation
        </summary>

        <div className="flex flex-col gap-4">
          {/* Read Mode Selector */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label
                htmlFor="fhirReadMode"
                className="text-xs font-semibold text-[var(--vscode-foreground,#cbd5e1)] flex items-center gap-2"
              >
                Read Operation (FhirIO)
              </label>
              <InfoTooltip text="Selects the native Apache Beam FhirIO transform: FhirIO.readResources() (fetch by resource name), FhirIO.searchResources(fhirStore) (paginated FHIR search), FhirIO.exportResources(fhirStore, exportUri) (batch GCS/BigQuery export), FhirIO.deidentify(...) (batch de-identification), or FhirIO.getPatientEverything() ($everything compartment query)." />
            </div>
            <select
              id="fhirReadMode"
              name="readMode"
              value={readMode}
              onChange={handleFieldChange}
              className="w-full bg-[var(--vscode-input-background,#0f172a)] border border-[var(--vscode-input-border,#334155)] rounded px-2 py-2 text-xs font-mono text-[var(--vscode-input-foreground,#e2e8f0)] focus:outline-none focus:border-[var(--vscode-focusBorder,#3b82f6)]"
            >
              <option value="readResources">FhirIO.readResources() — Fetch by Resource Name</option>
              <option value="searchResources">FhirIO.searchResources(fhirStore) — Paginated Search</option>
              <option value="exportResources">FhirIO.exportResources(fhirStore, exportUri) — Batch Export</option>
              <option value="deidentify">FhirIO.deidentify(...) — Store De-identification</option>
              <option value="getPatientEverything">FhirIO.getPatientEverything() — Patient $everything</option>
            </select>
          </div>

          {/* Dynamic Healthcare Dataset Picker */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label
                htmlFor="fhirHealthcareDataset"
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
                <InfoTooltip text="Discovers Cloud Healthcare datasets via `gcloud healthcare datasets list --format=json` (`getHealthcareDatasets`). Selecting a dataset pre-populates the FHIR store resource path prefix." />
              </div>
            </div>
            <input
              id="fhirHealthcareDataset"
              name="healthcareDataset"
              type="text"
              list="fhir-source-healthcare-datasets"
              value={healthcareDataset}
              onChange={handleFieldChange}
              placeholder="projects/my-project/locations/us-central1/datasets/my-dataset"
              className="w-full bg-[var(--vscode-input-background,#0f172a)] border border-[var(--vscode-input-border,#334155)] rounded px-2 py-2 text-xs font-mono text-[var(--vscode-input-foreground,#e2e8f0)]"
            />
            <datalist id="fhir-source-healthcare-datasets">
              {healthcareDatasets.map((ds) => (
                <option key={ds} value={ds} />
              ))}
            </datalist>
            {datasetsError && (
              <span className="text-xs text-[var(--vscode-errorForeground,#f87171)]">{datasetsError}</span>
            )}
          </div>

          {/* FHIR Store Resource Name */}
          <PropertyField
            id="fhirSourceStore"
            name="fhirStore"
            label="FHIR Store Resource Name"
            required={requiresFhirStore ? 'Required for searchResources, exportResources, and deidentify' : false}
            invalid={isFhirStoreInvalid}
            tooltip="Full Cloud Healthcare FHIR store resource identifier: projects/{project_id}/locations/{location_id}/datasets/{dataset_id}/fhirStores/{fhir_store_id}."
            value={fhirStore}
            onChange={handleFieldChange}
            placeholder="projects/my-project/locations/us-central1/datasets/my-dataset/fhirStores/my-fhir-store"
            list="fhir-source-store-suggestions"
            datalist={fhirStoreSuggestions}
          />
        </div>
      </details>

      {/* Operation-Specific Parameters */}
      {(readMode !== 'getPatientEverything' || Boolean(rawData.hasValidationError)) && (
        <details open className="group border border-[var(--vscode-panel-border,#334155)] rounded p-4">
          <summary className="cursor-pointer text-xs font-bold uppercase tracking-wider text-[var(--vscode-descriptionForeground,#94a3b8)] select-none mb-4">
            Operation Parameters ({readMode})
          </summary>

          <div className="flex flex-col gap-4">
            {readMode === 'readResources' && (
              <div className="flex flex-col gap-2 p-3 rounded bg-amber-500/10 border border-amber-500/30">
                <span className="text-xs text-amber-400 font-medium">
                  <code>FhirIO.readResources()</code> requires an upstream <code>PubSubIO</code> node to supply FHIR resource names. Configure the subscription in the <code>PubSubIO</code> property panel after adding it.
                </span>
                <button
                  type="button"
                  onClick={() => onAddPubSubSource && targetId && onAddPubSubSource(targetId)}
                  className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs py-1.5 px-3 rounded transition-colors cursor-pointer"
                >
                  Add PubSubIO Source
                </button>
              </div>
            )}

            {readMode !== 'readResources' && rawData.hasValidationError && (
              <div className="flex flex-col gap-2 p-3 rounded bg-red-500/10 border border-red-500 border-dashed">
                <span className="text-xs text-red-400 font-medium">
                  <code>FhirIO.{readMode}()</code> does not accept an upstream connection. Remove the connected upstream <code>PubSubIO</code> node or switch back to <code>FhirIO.readResources()</code>.
                </span>
              </div>
            )}

            {readMode === 'searchResources' && (
              <>
                <PropertyField
                  id="fhirResourceType"
                  name="resourceType"
                  label="FHIR Resource Type"
                  tooltip="FHIR resource type passed to `FhirSearchParameter.of(resourceType, key, queries)` (e.g., Patient, Observation, Encounter, DiagnosticReport)."
                  value={resourceType}
                  onChange={handleFieldChange}
                  placeholder="Patient"
                  list="fhir-resource-type-options"
                  datalist={['Patient', 'Observation', 'Encounter', 'Condition', 'DiagnosticReport', 'MedicationRequest']}
                />
                <PropertyField
                  id="fhirSearchKey"
                  name="searchKey"
                  label="Search Key Identifier (Optional)"
                  tooltip="Optional correlation key passed to `FhirSearchParameter.of(resourceType, key, queries)` to emit `KV<String, JsonArray>` via `getKeyedResources()`."
                  value={searchKey}
                  onChange={handleFieldChange}
                  placeholder="patient-cohort-key"
                />
                <PropertyField
                  id="fhirSearchQueries"
                  name="searchQueries"
                  label="Search Query Parameters (JSON Map)"
                  type="textarea"
                  rows={2}
                  tooltip="Key-value search query filters passed to `FhirSearchParameter.of(resourceType, key, queries)` (e.g. {&quot;gender&quot;: &quot;female&quot;, &quot;birthdate&quot;: &quot;gt1990-01-01&quot;})."
                  value={searchQueries}
                  onChange={handleFieldChange}
                  placeholder='{"gender": "female", "_count": "100"}'
                />
              </>
            )}

            {readMode === 'exportResources' && (
              <PropertyField
                id="fhirExportUri"
                name="exportUri"
                label="Export Destination URI (GCS or BigQuery)"
                required="Export destination URI is required for FhirIO.exportResources"
                invalid={isExportUriInvalid}
                tooltip="Destination URI for `FhirIO.exportResources(fhirStore, exportUri)`. Must begin with `gs://` (Cloud Storage prefix for ndjson files) or `bq://PROJECT_ID.DATASET_ID` (BigQuery dataset)."
                value={exportUri}
                onChange={handleFieldChange}
                placeholder="gs://my-bucket/fhir-export/ or bq://my-project.fhir_dataset"
                list="fhir-export-uri-suggestions"
                datalist={exportUriSuggestions}
              />
            )}

            {readMode === 'deidentify' && (
              <PropertyField
                id="fhirDestinationStore"
                name="destinationFhirStore"
                label="Destination FHIR Store"
                required="Destination FHIR Store is required for FhirIO.deidentify"
                invalid={isDestStoreInvalid}
                tooltip="Existing destination FHIR store resource name for `FhirIO.deidentify(sourceFhirStore, destinationFhirStore, deidConfig)`."
                value={destinationFhirStore}
                onChange={handleFieldChange}
                placeholder="projects/my-project/locations/us-central1/datasets/my-dataset/fhirStores/deid-fhir-store"
                list="fhir-dest-store-suggestions"
                datalist={fhirStoreSuggestions}
              />
            )}
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
            id="fhirSourceExpansionService"
            name="expansionService"
            label="Java Expansion Service Endpoint (Optional)"
            tooltip="Host:port of the Apache Beam GCP Healthcare Java Expansion Service when invoking FhirIO from a Python cross-language pipeline."
            value={expansionService}
            onChange={handleFieldChange}
            placeholder="localhost:8097"
          />
        </div>
      </details>

      {/* Code Generation Instructions */}
      <SystemInstructionsField
        id="fhirSourceSystemInstructions"
        value={systemInstructions}
        tooltip="Custom instructions for the LLM code generator (e.g., dead-letter handling via getFailedReads() / HealthcareIOErrorToTableRow)."
        placeholder="e.g., Route FhirIO.Read.Result.getFailedReads() to a BigQuery dead-letter table using HealthcareIOErrorToTableRow..."
        onChange={(value) => emitChange({ system_instructions: value })}
      />
    </div>
  );
};

export const FhirIOProperties = FhirIOSourceProperties;
export default FhirIOSourceProperties;
