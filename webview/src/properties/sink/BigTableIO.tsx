/**
 * BigTableIOSinkProperties Component
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Renders the property configuration panel for Apache Beam BigTableIO Write Sink nodes
 * (org.apache.beam.sdk.io.gcp.bigtable.BigtableIO.write() in Java / WriteToBigTable in Python).
 *
 * Architectural Decisions:
 * // NOTE: The Beam Java SDK class is BigtableIO (lower-case 't') while the designer palette/registry identifier
 * // is BigTableIO (capital 'T'). This file and component exports use BigTableIO to match the designer registry keys,
 * // while system_instructions reference org.apache.beam.sdk.io.gcp.bigtable.BigtableIO.
 * // NOTE: BigtableIO.write() consumes PCollection<KV<ByteString, Iterable<Mutation>>>.
 * - Project ID, Instance ID, and Table ID are required with instant validation and aria-invalid flags.
 * - Configures Bigtable write flow control (withFlowControl) and batch/outstanding thresholds:
 *   withMaxBytesPerBatch, withMaxElementsPerBatch, withMaxOutstandingBytes, and withMaxOutstandingElements.
 * - Supports custom error handling / dead-letter routing (withErrorHandler) and submission validation bypass (withoutValidation).
 * - Authentication options: Application Default Credentials (ADC) or GCP Secret Manager service-account reference.
 *   Uses IPC 'getSecrets' to populate datalist with id 'bigtable-sink-secret-options'.
 * - Collapsible Advanced Sink Settings: Bigtable emulator host (withEmulator) and attempt/operation timeouts.
 * - Preserves system_instructions / special_instructions for LLM code generation.
 * - Follows the 8pt grid system (p-2, p-3, p-4, gap-2, gap-4) and Tailwind CSS styling.
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

export interface BigTableIOSinkPropertiesProps {
  node: {
    data: {
      label?: string;
      beam_transform?: string;
      system_instructions?: string;
      special_instructions?: string;
      properties?: {
        projectId?: string;
        instanceId?: string;
        tableId?: string;
        appProfileId?: string;
        flowControl?: boolean;
        maxBytesPerBatch?: number | string;
        maxElementsPerBatch?: number | string;
        maxOutstandingBytes?: number | string;
        maxOutstandingElements?: number | string;
        enableErrorHandler?: boolean;
        errorHandlerDeadLetter?: string;
        withoutValidation?: boolean;
        authMode?: 'adc' | 'secret_manager';
        serviceAccountSecret?: string;
        emulatorHost?: string;
        attemptTimeoutMs?: number | string;
        operationTimeoutMs?: number | string;
        system_instructions?: string;
        special_instructions?: string;
        [key: string]: any;
      };
    };
  };
  onChange: (properties: any) => void;
}

/**
 * BigTableIOSinkProperties renders the property configuration form for BigtableIO write operations.
 *
 * @param props Component properties containing the active node and onChange callback
 */
export const BigTableIOSinkProperties: React.FC<BigTableIOSinkPropertiesProps> = ({ node, onChange }) => {
  const properties = node?.data?.properties || {};

  // Form field state extracted from node properties
  const projectId = properties.projectId || '';
  const instanceId = properties.instanceId || '';
  const tableId = properties.tableId || '';
  const appProfileId = properties.appProfileId || '';
  const flowControl = properties.flowControl ?? false;
  const maxBytesPerBatch = properties.maxBytesPerBatch ?? '';
  const maxElementsPerBatch = properties.maxElementsPerBatch ?? '';
  const maxOutstandingBytes = properties.maxOutstandingBytes ?? '';
  const maxOutstandingElements = properties.maxOutstandingElements ?? '';
  const enableErrorHandler = properties.enableErrorHandler ?? false;
  const errorHandlerDeadLetter = properties.errorHandlerDeadLetter || '';
  const withoutValidation = properties.withoutValidation ?? false;
  const authMode = properties.authMode || 'adc';
  const serviceAccountSecret = properties.serviceAccountSecret || '';
  const emulatorHost = properties.emulatorHost || '';
  const attemptTimeoutMs = properties.attemptTimeoutMs ?? '';
  const operationTimeoutMs = properties.operationTimeoutMs ?? '';

  // Local state for dynamically loaded GCP Secret Manager secrets
  const { items: rawSecrets, error: secretError } = useAssetLoader<SecretItem | string>('secrets');
  const secrets: SecretItem[] = (rawSecrets || []).map(normalizeSecretItem);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Field validation
  const isProjectEmpty = !projectId.trim();
  const isInstanceEmpty = !instanceId.trim();
  const isTableEmpty = !tableId.trim();

  // Verbatim system instruction fallback chain
  const systemInstructions =
    node?.data?.system_instructions ??
    node?.data?.special_instructions ??
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
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
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
  const handleInstructionsChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    onChange({
      ...properties,
      system_instructions: e.target.value
    });
  };

  return (
    <div className="flex-1 flex flex-col gap-4 text-[var(--vscode-text-primary)] text-sm">
      {/* Target Bigtable Instance & Table Identification */}
      <div className="flex flex-col gap-3">
        <PropertyField
          id="bigtableSinkProjectId"
          name="projectId"
          label="Project ID"
          required="Project ID is required"
          tooltip="Google Cloud Project ID hosting the target Cloud Bigtable instance (withProjectId). Required."
          value={projectId}
          invalid={isProjectEmpty}
          error={isProjectEmpty ? 'Project ID is required' : null}
          placeholder="e.g. my-gcp-project"
          onChange={handleChange}
          mono={true}
        />

        <div className="grid grid-cols-2 gap-2">
          <PropertyField
            id="bigtableSinkInstanceId"
            name="instanceId"
            label="Instance ID"
            required="Instance ID is required"
            tooltip="Cloud Bigtable Instance ID (withInstanceId). Required."
            value={instanceId}
            invalid={isInstanceEmpty}
            error={isInstanceEmpty ? 'Instance ID is required' : null}
            placeholder="e.g. prod-bigtable-instance"
            onChange={handleChange}
            mono={true}
          />
          <PropertyField
            id="bigtableSinkTableId"
            name="tableId"
            label="Table ID"
            required="Table ID is required"
            tooltip="Cloud Bigtable Table ID to write mutations to (withTableId). Required."
            value={tableId}
            invalid={isTableEmpty}
            error={isTableEmpty ? 'Table ID is required' : null}
            placeholder="e.g. user_sessions"
            onChange={handleChange}
            mono={true}
          />
        </div>

        <PropertyField
          id="bigtableSinkAppProfileId"
          name="appProfileId"
          label="App Profile ID"
          tooltip="Optional Bigtable App Profile ID for routing mutations (withAppProfileId)."
          value={appProfileId}
          onChange={handleChange}
          placeholder="e.g. default-app-profile"
          mono={true}
        />
      </div>

      {/* Flow Control & Batch Tuning */}
      <div className="flex flex-col gap-2 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
        <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          <span>Flow Control &amp; Batching</span>
          <InfoTooltip text="Configures Bigtable client flow control rate-limiting and mutation batch sizes to protect Bigtable cluster capacity." />
        </label>

        <div className="flex items-center gap-2 mt-1">
          <input
            id="bigtableSinkFlowControl"
            type="checkbox"
            name="flowControl"
            checked={flowControl}
            onChange={handleChange}
            className="rounded border-[var(--vscode-border)] text-[var(--vscode-highlight)] accent-[var(--vscode-highlight)] focus:ring-0 cursor-pointer"
          />
          <label htmlFor="bigtableSinkFlowControl" className="flex items-center gap-1.5 text-xs text-[var(--vscode-text-secondary)] cursor-pointer">
            <span>Enable Adaptive Flow Control</span>
            <InfoTooltip text="Automatically rate-limits writes to prevent cluster overload while triggering Bigtable Autoscaling when needed (withFlowControl)." />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-1">
          <PropertyField
            id="bigtableSinkMaxBytesPerBatch"
            name="maxBytesPerBatch"
            label="Max Bytes Per Batch"
            type="number"
            min={1}
            value={maxBytesPerBatch}
            onChange={handleChange}
            placeholder="e.g. 5242880 (5MB)"
            tooltip="Maximum payload byte size accumulated before flushing a mutation batch (withMaxBytesPerBatch)."
            mono={true}
          />
          <PropertyField
            id="bigtableSinkMaxElementsPerBatch"
            name="maxElementsPerBatch"
            label="Max Elements Per Batch"
            type="number"
            min={1}
            value={maxElementsPerBatch}
            onChange={handleChange}
            placeholder="e.g. 1000"
            tooltip="Maximum number of mutations bundled into a single batch request (withMaxElementsPerBatch)."
            mono={true}
          />
        </div>

        <div className="grid grid-cols-2 gap-2 mt-1">
          <PropertyField
            id="bigtableSinkMaxOutstandingBytes"
            name="maxOutstandingBytes"
            label="Max Outstanding Bytes"
            type="number"
            min={1}
            value={maxOutstandingBytes}
            onChange={handleChange}
            placeholder="e.g. 104857600 (100MB)"
            tooltip="Upper bound on total in-flight bytes across concurrent write requests before applying backpressure (withMaxOutstandingBytes)."
            mono={true}
          />
          <PropertyField
            id="bigtableSinkMaxOutstandingElements"
            name="maxOutstandingElements"
            label="Max Outstanding Elements"
            type="number"
            min={1}
            value={maxOutstandingElements}
            onChange={handleChange}
            placeholder="e.g. 10000"
            tooltip="Upper bound on total in-flight mutation count before applying backpressure (withMaxOutstandingElements)."
            mono={true}
          />
        </div>
      </div>

      {/* Error Handling & Validation */}
      <div className="flex flex-col gap-2 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
        <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          <span>Error Handling &amp; Validation</span>
          <InfoTooltip text="Route bad mutations to a dead-letter destination and control graph validation." />
        </label>

        <div className="flex items-center gap-2 mt-1">
          <input
            id="bigtableSinkEnableErrorHandler"
            type="checkbox"
            name="enableErrorHandler"
            checked={enableErrorHandler}
            onChange={handleChange}
            className="rounded border-[var(--vscode-border)] text-[var(--vscode-highlight)] accent-[var(--vscode-highlight)] focus:ring-0 cursor-pointer"
          />
          <label htmlFor="bigtableSinkEnableErrorHandler" className="flex items-center gap-1.5 text-xs text-[var(--vscode-text-secondary)] cursor-pointer">
            <span>Enable Bad Record Error Handler</span>
            <InfoTooltip text="Routes failed mutations to a dead-letter destination instead of aborting the pipeline (withErrorHandler)." />
          </label>
        </div>

        {enableErrorHandler && (
          <PropertyField
            id="bigtableSinkErrorHandlerDeadLetter"
            name="errorHandlerDeadLetter"
            label="Dead-Letter Sink / Topic"
            value={errorHandlerDeadLetter}
            onChange={handleChange}
            placeholder="projects/my-p/topics/bigtable-write-dlq"
            tooltip="Target destination or Pub/Sub topic for bad records routed by withErrorHandler."
            mono={true}
          />
        )}

        <div className="flex items-center gap-2 mt-1">
          <input
            id="bigtableSinkWithoutValidation"
            type="checkbox"
            name="withoutValidation"
            checked={withoutValidation}
            onChange={handleChange}
            className="rounded border-[var(--vscode-border)] text-[var(--vscode-highlight)] accent-[var(--vscode-highlight)] focus:ring-0 cursor-pointer"
          />
          <label htmlFor="bigtableSinkWithoutValidation" className="flex items-center gap-1.5 text-xs text-[var(--vscode-text-secondary)] cursor-pointer">
            <span>Disable Pipeline Graph Validation</span>
            <InfoTooltip text="Bypasses table existence and permission checks during graph submission (withoutValidation)." />
          </label>
        </div>
      </div>

      {/* Authentication */}
      <div className="flex flex-col gap-2 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
        <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          <span>Authentication</span>
          <InfoTooltip text="Choose authentication strategy: Google Application Default Credentials (ADC) or GCP Secret Manager service-account reference." />
        </label>
        <div className="flex gap-4">
          <label className="flex items-center gap-1.5 cursor-pointer text-xs text-[var(--vscode-text-secondary)]">
            <input
              type="radio"
              name="authMode"
              value="adc"
              checked={authMode === 'adc'}
              onChange={handleChange}
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
              onChange={handleChange}
              className="accent-[var(--vscode-highlight)]"
            />
            <span>Secret Manager</span>
          </label>
        </div>

        {authMode === 'secret_manager' && (
          <div className="flex flex-col gap-2 mt-1">
            <PropertyField
              id="bigtableSinkServiceAccountSecret"
              name="serviceAccountSecret"
              label="Service Account Key Secret"
              value={serviceAccountSecret}
              onChange={handleChange}
              list="bigtable-sink-secret-options"
              datalist={secrets.map((s) => ({ value: s.id || s.name, label: s.name || s.id }))}
              placeholder="e.g. gcp-bigtable-sa-key"
              error={secretError}
              invalid={!!secretError}
              mono={true}
            />
          </div>
        )}
      </div>

      {/* Collapsible Advanced Sink Settings */}
      <div className="flex flex-col border border-[var(--vscode-border-light)] rounded-md overflow-hidden">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center justify-between p-2 bg-[var(--vscode-subcard-bg)] text-xs font-bold uppercase text-[var(--vscode-text-muted)] hover:text-[var(--vscode-text-primary)] transition-colors cursor-pointer"
        >
          <span>Advanced Sink Settings</span>
          <span>{showAdvanced ? '▲' : '▼'}</span>
        </button>

        {showAdvanced && (
          <div className="p-3 bg-[var(--vscode-workbench-bg)] flex flex-col gap-3 border-t border-[var(--vscode-border-light)]">
            {/* Emulator Host Override */}
            <PropertyField
              id="bigtableSinkEmulatorHost"
              name="emulatorHost"
              label="Emulator Host"
              tooltip="Bigtable emulator host (e.g. localhost:8086) for local integration testing (withEmulator)."
              value={emulatorHost}
              onChange={handleChange}
              placeholder="localhost:8086"
              mono={true}
            />

            {/* Attempt and Operation Timeouts */}
            <div className="grid grid-cols-2 gap-2">
              <PropertyField
                id="bigtableSinkAttemptTimeoutMs"
                name="attemptTimeoutMs"
                label="Attempt Timeout (ms)"
                type="number"
                min={1}
                value={attemptTimeoutMs}
                onChange={handleChange}
                placeholder="e.g. 20000"
                tooltip="Timeout in milliseconds for each individual RPC mutation attempt (withAttemptTimeout)."
                mono={true}
              />
              <PropertyField
                id="bigtableSinkOperationTimeoutMs"
                name="operationTimeoutMs"
                label="Operation Timeout (ms)"
                type="number"
                min={1}
                value={operationTimeoutMs}
                onChange={handleChange}
                placeholder="e.g. 60000"
                tooltip="Total timeout in milliseconds for the overall Bigtable mutation operation including retries (withOperationTimeout)."
                mono={true}
              />
            </div>
          </div>
        )}
      </div>

      {/* Flexible Spacer */}
      <div className="flex-1 min-h-[16px]" />

      {/* Code Generation Instructions */}
      <PropertyField
        id="bigtableSinkInstructions"
        name="system_instructions"
        label="Code Generation Instructions"
        tooltip="Optional instructions passed to LLM code generator when synthesizing BigtableIO write pipelines (consumes PCollection<KV<ByteString, Iterable<Mutation>>>)."
        type="textarea"
        rows={3}
        value={systemInstructions}
        onChange={handleInstructionsChange}
        placeholder="e.g. Apply BigtableIO.write().withProjectId(...).withInstanceId(...).withTableId(...) consuming KV<ByteString, Iterable<Mutation>>"
        mono={true}
      />
    </div>
  );
};
