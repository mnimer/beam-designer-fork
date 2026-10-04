/**
 * DicomIOSinkProperties Component
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Renders the property configuration panel for Apache Beam Cloud Healthcare DicomIO Sink nodes
 * (`apache_beam.io.gcp.healthcare.dicomio.UploadToDicomStore`).
 *
 * Architectural Decisions:
 * - Maps directly to the official Apache Beam Python `UploadToDicomStore(destination_dict, input_type, buffer_size=8, max_workers=5)`
 *   transform (and DICOMweb STOW-RS `dicomweb_store_instance` in Java).
 * - Exposes the exact required `destination_dict` keys (`project_id`, `region`, `dataset_id`, `dicom_store_id`),
 *   `input_type` (`'bytes'` | `'fileio'`), `buffer_size` (default `8`), and `max_workers` (default `5`).
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
import { parseHealthcareDatasetPath } from '../source/DicomIO';

export type DicomUploadInputType = 'bytes' | 'fileio';

/**
 * Props for the DicomIOSinkProperties component.
 */
export interface DicomIOSinkPropertiesProps {
  node?: any;
  nodeId?: string;
  data?: Record<string, any>;
  onChange?: (properties: Record<string, any>) => void;
}

/**
 * Renders the DicomIO Sink configuration form.
 *
 * @param props Component properties (`node`, `onChange`, or `data`).
 * @returns React element for configuring DicomIO sink parameters.
 */
export const DicomIOSinkProperties: React.FC<DicomIOSinkPropertiesProps> = ({
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
  const projectId: string = properties.projectId || '';
  const region: string = properties.region || 'us-central1';
  const datasetId: string = properties.datasetId || '';
  const dicomStoreId: string = properties.dicomStoreId || '';
  const inputType: DicomUploadInputType = (properties.inputType as DicomUploadInputType) || 'bytes';
  const bufferSize: number | string = properties.bufferSize ?? 8;
  const maxWorkers: number | string = properties.maxWorkers ?? 5;

  const systemInstructions: string =
    rawData.system_instructions ??
    rawData.special_instructions ??
    properties.system_instructions ??
    properties.special_instructions ??
    '';

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
      {/* Destination DICOM Store (`destination_dict` in UploadToDicomStore) */}
      <details open className="group border border-[var(--vscode-panel-border,#334155)] rounded p-4">
        <summary className="cursor-pointer text-xs font-bold uppercase tracking-wider text-[var(--vscode-descriptionForeground,#94a3b8)] select-none mb-4">
          Destination DICOM Store (UploadToDicomStore)
        </summary>

        <div className="flex flex-col gap-4">
          {/* Dynamic Healthcare Dataset Picker */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label
                htmlFor="dicomSinkHealthcareDataset"
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
                <InfoTooltip text="Discovers Cloud Healthcare datasets via `gcloud healthcare datasets list --format=json` (`getHealthcareDatasets`) and auto-fills `project_id`, `region`, and `dataset_id` in `destination_dict`." />
              </div>
            </div>
            <input
              id="dicomSinkHealthcareDataset"
              name="healthcareDataset"
              type="text"
              list="dicom-sink-healthcare-datasets"
              value={healthcareDataset}
              onChange={handleFieldChange}
              placeholder="projects/my-project/locations/us-central1/datasets/my-dataset"
              className="w-full bg-[var(--vscode-input-background,#0f172a)] border border-[var(--vscode-input-border,#334155)] rounded px-2 py-2 text-xs font-mono text-[var(--vscode-input-foreground,#e2e8f0)]"
            />
            <datalist id="dicom-sink-healthcare-datasets">
              {healthcareDatasets.map((ds) => (
                <option key={ds} value={ds} />
              ))}
            </datalist>
            {datasetsError && (
              <span className="text-xs text-[var(--vscode-errorForeground,#f87171)]">{datasetsError}</span>
            )}
          </div>

          <PropertyField
            id="dicomSinkProjectId"
            name="projectId"
            label="GCP Project ID (project_id)"
            required="project_id is required in destination_dict"
            invalid={!projectId.trim()}
            tooltip="Required `project_id` key in `destination_dict` for `UploadToDicomStore(destination_dict, input_type)`."
            value={projectId}
            onChange={handleFieldChange}
            placeholder="my-gcp-project"
          />

          <PropertyField
            id="dicomSinkRegion"
            name="region"
            label="Cloud Healthcare Region (region)"
            required="region is required in destination_dict"
            invalid={!region.trim()}
            tooltip="Required `region` key in `destination_dict` for `UploadToDicomStore(destination_dict, input_type)` (e.g. us-central1)."
            value={region}
            onChange={handleFieldChange}
            placeholder="us-central1"
          />

          <PropertyField
            id="dicomSinkDatasetId"
            name="datasetId"
            label="Healthcare Dataset ID (dataset_id)"
            required="dataset_id is required in destination_dict"
            invalid={!datasetId.trim()}
            tooltip="Required `dataset_id` key in `destination_dict` for `UploadToDicomStore(destination_dict, input_type)`."
            value={datasetId}
            onChange={handleFieldChange}
            placeholder="clinical-imaging-dataset"
          />

          <PropertyField
            id="dicomSinkStoreId"
            name="dicomStoreId"
            label="DICOM Store ID (dicom_store_id)"
            required="dicom_store_id is required in destination_dict"
            invalid={!dicomStoreId.trim()}
            tooltip="Required `dicom_store_id` key in `destination_dict` for `UploadToDicomStore(destination_dict, input_type)`."
            value={dicomStoreId}
            onChange={handleFieldChange}
            placeholder="radiology-dicom-store"
          />

          {/* Input Type (`bytes` | `fileio`) */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label
                htmlFor="dicomInputType"
                className="text-xs font-semibold text-[var(--vscode-foreground,#cbd5e1)]"
              >
                Input Payload Type (input_type)
              </label>
              <InfoTooltip text="Required `input_type` parameter on `UploadToDicomStore(destination_dict, input_type)`: `'bytes'` (PCollection of raw DICOM byte arrays) or `'fileio'` (PCollection of `apache_beam.io.fileio.ReadableFile` objects)." />
            </div>
            <select
              id="dicomInputType"
              name="inputType"
              value={inputType}
              onChange={handleFieldChange}
              className="w-full bg-[var(--vscode-input-background,#0f172a)] border border-[var(--vscode-input-border,#334155)] rounded px-2 py-2 text-xs font-mono text-[var(--vscode-input-foreground,#e2e8f0)]"
            >
              <option value="bytes">bytes — PCollection[bytes] (Raw DICOM Byte Payload)</option>
              <option value="fileio">fileio — PCollection[ReadableFile] (FileIO Match/ReadMatches)</option>
            </select>
          </div>
        </div>
      </details>

      {/* Client Buffering & Concurrency */}
      <details className="group border border-[var(--vscode-panel-border,#334155)] rounded p-4">
        <summary className="cursor-pointer text-xs font-bold uppercase tracking-wider text-[var(--vscode-descriptionForeground,#94a3b8)] select-none mb-4">
          Client Buffering &amp; Concurrency
        </summary>

        <div className="flex flex-col gap-4">
          <PropertyField
            id="dicomSinkBufferSize"
            name="bufferSize"
            label="Request Buffer Size (buffer_size)"
            type="number"
            min={1}
            tooltip="Buffer size parameter (`buffer_size`, default 8) passed to `UploadToDicomStore(..., buffer_size=8, max_workers=5)`."
            value={bufferSize}
            onChange={handleFieldChange}
          />
          <PropertyField
            id="dicomSinkMaxWorkers"
            name="maxWorkers"
            label="Max Concurrent Workers (max_workers)"
            type="number"
            min={1}
            tooltip="Maximum thread pool workers (`max_workers`, default 5) passed to `UploadToDicomStore(..., buffer_size=8, max_workers=5)`."
            value={maxWorkers}
            onChange={handleFieldChange}
          />
        </div>
      </details>

      {/* Code Generation Instructions */}
      <SystemInstructionsField
        id="dicomSinkSystemInstructions"
        value={systemInstructions}
        tooltip="Custom instructions for the LLM code generator (e.g., inspecting result['success'] and result['status'] from UploadToDicomStore, or using DICOMweb STOW-RS in Java)."
        placeholder="e.g., Check UploadToDicomStore output dict {'success': bool, 'status': int} and route failed uploads to dead-letter storage..."
        onChange={(value) => emitChange({ system_instructions: value })}
      />
    </div>
  );
};

export const DicomIOProperties = DicomIOSinkProperties;
export default DicomIOSinkProperties;
