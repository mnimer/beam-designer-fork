/**
 * DicomIOSourceProperties Component
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Renders the property configuration panel for Apache Beam Cloud Healthcare DicomIO Source nodes
 * (`org.apache.beam.sdk.io.gcp.healthcare.DicomIO.ReadStudyMetadata` in Java and
 * `apache_beam.io.gcp.healthcare.dicomio.DicomSearch` / `FormatToQido` in Python).
 *
 * Architectural Decisions:
 * - Supports both official Apache Beam DicomIO source modes:
 *   1. `readStudyMetadata`: Java `DicomIO.readStudyMetadata()` (or Python `FormatToQido() | DicomSearch()`)
 *      consuming DICOM web paths from a `PCollection<String>` or Pub/Sub notification subscription.
 *   2. `dicomSearch`: Python `DicomSearch(buffer_size=8, max_workers=5)` executing QIDO-RS queries
 *      at the `'studies'`, `'series'`, or `'instances'` level (`search_type`) with optional filter `params`
 *      (`StudyInstanceUID`, `PatientName`, `PatientID`, `AccessionNumber`, `ReferringPhysicianName`,
 *      `StudyDate`, `SeriesInstanceUID`, `Modality`, `SOPInstanceUID`).
 * - Integrates dynamic Cloud Healthcare dataset discovery via `useAssetLoader('healthcareDatasets')` and
 *   automatically parses `projects/{project_id}/locations/{region}/datasets/{dataset_id}` into
 *   `projectId`, `region`, and `datasetId`.
 * - Adheres to 8pt grid spacing, VS Code theme tokens (`--vscode-*`), and `system_instructions` override.
 */

import React from 'react';
import { RefreshCw } from 'lucide-react';
import { InfoTooltip } from '../../components/InfoTooltip';
import { PropertyField } from '../../components/common/PropertyField';
import { SystemInstructionsField } from '../../components/common/SystemInstructionsField';
import { useAssetLoader } from '../../hooks/useAssetLoader';

export type DicomReadMode = 'readStudyMetadata' | 'dicomSearch';
export type DicomSearchType = 'studies' | 'series' | 'instances';

/** Props for the {@link DicomIOSourceProperties} component. */
export interface DicomIOSourcePropertiesProps {
  node?: any;
  nodeId?: string;
  data?: Record<string, any>;
  onChange?: (properties: Record<string, any>) => void;
  onAddPubSubSource?: (targetNodeId: string) => void;
}

/**
 * Parses a Cloud Healthcare dataset resource path (`projects/{p}/locations/{l}/datasets/{d}`)
 * into `{ projectId, region, datasetId }` if matched.
 *
 * @param resourcePath Dataset resource name string.
 * @returns Parsed `{ projectId, region, datasetId }` or null.
 */
export function parseHealthcareDatasetPath(
  resourcePath: string
): { projectId: string; region: string; datasetId: string } | null {
  const match = resourcePath
    .trim()
    .match(/^projects\/([^/]+)\/locations\/([^/]+)\/datasets\/([^/]+)$/);
  if (!match) {
    return null;
  }
  return {
    projectId: match[1],
    region: match[2],
    datasetId: match[3]
  };
}

/**
 * Renders the DicomIO Source configuration form.
 *
 * @param props Component properties (`node`, `onChange`, `onAddPubSubSource`, or `data`).
 * @returns React element for configuring DicomIO source parameters.
 */
export const DicomIOSourceProperties: React.FC<DicomIOSourcePropertiesProps> = ({
  node,
  nodeId,
  data,
  onChange,
  onAddPubSubSource
}) => {
  const rawData = node?.data || data || {};
  const properties: Record<string, any> = rawData.properties || rawData || {};
  const targetId = node?.id || nodeId;

  const {
    items: healthcareDatasets,
    loading: loadingDatasets,
    error: datasetsError,
    refresh: refreshDatasets
  } = useAssetLoader<string>('healthcareDatasets');

  const readMode: DicomReadMode = (properties.readMode as DicomReadMode) || 'readStudyMetadata';
  const healthcareDataset: string = properties.healthcareDataset || '';
  const projectId: string = properties.projectId || '';
  const region: string = properties.region || 'us-central1';
  const datasetId: string = properties.datasetId || '';
  const dicomStoreId: string = properties.dicomStoreId || '';
  const webPath: string = properties.webPath || '';
  const searchType: DicomSearchType = (properties.searchType as DicomSearchType) || 'studies';
  const params: string = properties.params || '';
  const bufferSize: number | string = properties.bufferSize ?? 8;
  const maxWorkers: number | string = properties.maxWorkers ?? 5;

  const systemInstructions: string =
    rawData.system_instructions ??
    rawData.special_instructions ??
    properties.system_instructions ??
    properties.special_instructions ??
    '';

  const isStoreMissing = !dicomStoreId.trim();

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
   * Handles form element changes and auto-populates `projectId`, `region`, and `datasetId`
   * when a full Cloud Healthcare dataset resource name is selected.
   *
   * @param e Change event.
   */
  const handleFieldChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    if (name === 'healthcareDataset') {
      const parsed = parseHealthcareDatasetPath(value);
      if (parsed) {
        emitChange({
          healthcareDataset: value,
          projectId: parsed.projectId,
          region: parsed.region,
          datasetId: parsed.datasetId
        });
        return;
      }
    }
    emitChange({ [name]: value });
  };

  return (
    <div className="flex-1 flex flex-col gap-4 text-[var(--vscode-foreground,#e2e8f0)]">
      {/* Core DICOM Store & Read Mode */}
      <details open className="group border border-[var(--vscode-panel-border,#334155)] rounded p-4">
        <summary className="cursor-pointer text-xs font-bold uppercase tracking-wider text-[var(--vscode-descriptionForeground,#94a3b8)] select-none mb-4">
          DICOM Store &amp; Read Mode
        </summary>

        <div className="flex flex-col gap-4">
          {/* Read Mode Selector */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label
                htmlFor="dicomReadMode"
                className="text-xs font-semibold text-[var(--vscode-foreground,#cbd5e1)]"
              >
                Read Operation (DicomIO)
              </label>
              <InfoTooltip text="Selects `readStudyMetadata` (Java `DicomIO.readStudyMetadata()` / Python `FormatToQido() | DicomSearch()`) or `dicomSearch` (Python `DicomSearch()` QIDO-RS search across studies, series, or instances)." />
            </div>
            <select
              id="dicomReadMode"
              name="readMode"
              value={readMode}
              onChange={handleFieldChange}
              className="w-full bg-[var(--vscode-input-background,#0f172a)] border border-[var(--vscode-input-border,#334155)] rounded px-2 py-2 text-xs font-mono text-[var(--vscode-input-foreground,#e2e8f0)]"
            >
              <option value="readStudyMetadata">
                DicomIO.readStudyMetadata() / FormatToQido — Study Metadata Read
              </option>
              <option value="dicomSearch">
                DicomSearch(buffer_size, max_workers) — QIDO-RS Metadata Search
              </option>
            </select>
          </div>

          {/* Dynamic Healthcare Dataset Picker */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label
                htmlFor="dicomSourceHealthcareDataset"
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
                <InfoTooltip text="Discovers Cloud Healthcare datasets via `gcloud healthcare datasets list --format=json` (`getHealthcareDatasets`) and auto-fills project_id, region, and dataset_id." />
              </div>
            </div>
            <input
              id="dicomSourceHealthcareDataset"
              name="healthcareDataset"
              type="text"
              list="dicom-source-healthcare-datasets"
              value={healthcareDataset}
              onChange={handleFieldChange}
              placeholder="projects/my-project/locations/us-central1/datasets/my-dataset"
              className="w-full bg-[var(--vscode-input-background,#0f172a)] border border-[var(--vscode-input-border,#334155)] rounded px-2 py-2 text-xs font-mono text-[var(--vscode-input-foreground,#e2e8f0)]"
            />
            <datalist id="dicom-source-healthcare-datasets">
              {healthcareDatasets.map((ds) => (
                <option key={ds} value={ds} />
              ))}
            </datalist>
            {datasetsError && (
              <span className="text-xs text-[var(--vscode-errorForeground,#f87171)]">{datasetsError}</span>
            )}
          </div>

          <PropertyField
            id="dicomSourceProjectId"
            name="projectId"
            label="GCP Project ID (project_id)"
            required="project_id is required for Cloud Healthcare DICOM store access"
            invalid={!projectId.trim()}
            tooltip="GCP Project ID (`project_id` key in `DicomSearch` input dict)."
            value={projectId}
            onChange={handleFieldChange}
            placeholder="my-gcp-project"
          />

          <PropertyField
            id="dicomSourceRegion"
            name="region"
            label="Cloud Healthcare Region (region)"
            required="region is required"
            invalid={!region.trim()}
            tooltip="Cloud Healthcare location/region (`region` key in `DicomSearch` input dict, e.g. us-central1)."
            value={region}
            onChange={handleFieldChange}
            placeholder="us-central1"
          />

          <PropertyField
            id="dicomSourceDatasetId"
            name="datasetId"
            label="Healthcare Dataset ID (dataset_id)"
            required="dataset_id is required"
            invalid={!datasetId.trim()}
            tooltip="Cloud Healthcare dataset ID (`dataset_id` key in `DicomSearch` input dict)."
            value={datasetId}
            onChange={handleFieldChange}
            placeholder="clinical-imaging-dataset"
          />

          <PropertyField
            id="dicomSourceStoreId"
            name="dicomStoreId"
            label="DICOM Store ID (dicom_store_id)"
            required="dicom_store_id is required"
            invalid={isStoreMissing}
            tooltip="Cloud Healthcare DICOM store ID (`dicom_store_id` key in `DicomSearch` input dict)."
            value={dicomStoreId}
            onChange={handleFieldChange}
            placeholder="radiology-dicom-store"
          />
        </div>
      </details>

      {/* Mode-Specific Parameters */}
      <details open className="group border border-[var(--vscode-panel-border,#334155)] rounded p-4">
        <summary className="cursor-pointer text-xs font-bold uppercase tracking-wider text-[var(--vscode-descriptionForeground,#94a3b8)] select-none mb-4">
          {readMode === 'dicomSearch' ? 'QIDO-RS Search Parameters (DicomSearch)' : 'DICOM WebPath & Notification Source'}
        </summary>

        <div className="flex flex-col gap-4">
          {readMode === 'readStudyMetadata' ? (
            <>
              <div className="flex flex-col gap-2 p-3 rounded bg-amber-500/10 border border-amber-500/30">
                <span className="text-xs text-amber-400 font-medium">
                  <code>DicomIO.readStudyMetadata()</code> requires an upstream <code>PubSubIO</code> node to supply DICOM study web paths. Configure the subscription in the <code>PubSubIO</code> property panel after adding it.
                </span>
                <button
                  type="button"
                  onClick={() => onAddPubSubSource && targetId && onAddPubSubSource(targetId)}
                  className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs py-1.5 px-3 rounded transition-colors cursor-pointer"
                >
                  Add PubSubIO Source
                </button>
              </div>
              <PropertyField
                id="dicomWebPath"
                name="webPath"
                label="DICOM Web Path (Optional Default Input)"
                tooltip="Full DICOM web path consumed by `DicomIO.readStudyMetadata()`: `projects/{p}/locations/{l}/datasets/{d}/dicomStores/{s}/dicomWeb/studies/{study}/series/{series}/instances/{instance}`."
                value={webPath}
                onChange={handleFieldChange}
                placeholder="projects/my-project/locations/us-central1/datasets/my-ds/dicomStores/my-store/dicomWeb/studies/1.2.840/series/1.2.840.1/instances/1.2.840.2"
              />
            </>
          ) : (
            <>
              {rawData.hasValidationError && (
                <div className="flex flex-col gap-2 p-3 rounded bg-red-500/10 border border-red-500 border-dashed">
                  <span className="text-xs text-red-400 font-medium">
                    <code>DicomIO.{readMode}()</code> does not accept an upstream connection. Remove the connected upstream <code>PubSubIO</code> node or switch back to <code>DicomIO.readStudyMetadata()</code>.
                  </span>
                </div>
              )}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="dicomSearchType"
                    className="text-xs font-semibold text-[var(--vscode-foreground,#cbd5e1)]"
                  >
                    QIDO Search Level (search_type)
                  </label>
                  <InfoTooltip text="Required `search_type` key in `DicomSearch` input dict: `'studies'`, `'series'`, or `'instances'`." />
                </div>
                <select
                  id="dicomSearchType"
                  name="searchType"
                  value={searchType}
                  onChange={handleFieldChange}
                  className="w-full bg-[var(--vscode-input-background,#0f172a)] border border-[var(--vscode-input-border,#334155)] rounded px-2 py-2 text-xs font-mono text-[var(--vscode-input-foreground,#e2e8f0)]"
                >
                  <option value="studies">studies — Study-level QIDO-RS query</option>
                  <option value="series">series — Series-level QIDO-RS query</option>
                  <option value="instances">instances — Instance-level QIDO-RS query</option>
                </select>
              </div>

              <PropertyField
                id="dicomSearchParams"
                name="params"
                label="QIDO Filter Parameters (params JSON)"
                type="textarea"
                rows={2}
                tooltip="Optional QIDO filter dictionary (`params` key in `DicomSearch` input dict). Supported DICOM tags: StudyInstanceUID, PatientName, PatientID, AccessionNumber, ReferringPhysicianName, StudyDate, SeriesInstanceUID, Modality, SOPInstanceUID."
                value={params}
                onChange={handleFieldChange}
                placeholder='{"Modality": "CT", "StudyDate": "20250101-20251231"}'
              />
            </>
          )}
        </div>
      </details>

      {/* Client Buffering & Concurrency (DicomSearch) */}
      <details className="group border border-[var(--vscode-panel-border,#334155)] rounded p-4">
        <summary className="cursor-pointer text-xs font-bold uppercase tracking-wider text-[var(--vscode-descriptionForeground,#94a3b8)] select-none mb-4">
          Client Buffering &amp; Concurrency
        </summary>

        <div className="flex flex-col gap-4">
          <PropertyField
            id="dicomSourceBufferSize"
            name="bufferSize"
            label="Request Buffer Size (buffer_size)"
            type="number"
            min={1}
            tooltip="Buffer size parameter (`buffer_size`, default 8) passed to `DicomSearch(buffer_size=8, max_workers=5)`."
            value={bufferSize}
            onChange={handleFieldChange}
          />
          <PropertyField
            id="dicomSourceMaxWorkers"
            name="maxWorkers"
            label="Max Concurrent Workers (max_workers)"
            type="number"
            min={1}
            tooltip="Maximum thread pool workers (`max_workers`, default 5) passed to `DicomSearch(buffer_size=8, max_workers=5)`."
            value={maxWorkers}
            onChange={handleFieldChange}
          />
        </div>
      </details>

      {/* Code Generation Instructions */}
      <SystemInstructionsField
        id="dicomSourceSystemInstructions"
        value={systemInstructions}
        tooltip="Custom instructions for the LLM code generator (e.g., routing DicomIO.ReadStudyMetadata.Result.getFailedReads())."
        placeholder="e.g., Parse DICOM study metadata JSON and route failed reads from getFailedReads() to dead-letter logging..."
        onChange={(value) => emitChange({ system_instructions: value })}
      />
    </div>
  );
};

export const DicomIOProperties = DicomIOSourceProperties;
export default DicomIOSourceProperties;
