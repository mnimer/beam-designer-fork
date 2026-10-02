/**
 * BigTableIOSourceProperties Component
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Renders the property configuration panel for Apache Beam BigTableIO Read Source nodes
 * (org.apache.beam.sdk.io.gcp.bigtable.BigtableIO.read() in Java / ReadFromBigtable in Python).
 *
 * Architectural Decisions:
 * // NOTE: The Beam Java SDK class is BigtableIO (lower-case 't') while the designer palette/registry identifier
 * // is BigTableIO (capital 'T'). This file and component exports use BigTableIO to match the designer registry keys,
 * // while system_instructions reference org.apache.beam.sdk.io.gcp.bigtable.BigtableIO.
 * // NOTE: BigtableIO.read() emits PCollection<com.google.bigtable.v2.Row> rather than Beam Row.
 * // NOTE: Bigtable metrics surface through Google Cloud Monitoring (bigtable.googleapis.com/client/)
 * // rather than custom builder methods on BigtableIO.read().
 * - Requires Project ID, Instance ID, and Table ID with immediate validation and aria-invalid flags.
 * - Supports row filtering expressions (withRowFilter), start/end key ranges (withKeyRanges),
 *   and buffer element limits (withMaxBufferElementCount).
 * - Authentication options: Application Default Credentials (ADC) or GCP Secret Manager service-account reference.
 *   Uses IPC 'getSecrets' to populate datalist with id 'bigtable-source-secret-options'.
 * - Collapsible Advanced Source Settings: Bigtable emulator host (withEmulator), withoutValidation toggle,
 *   and attempt/operation timeouts in milliseconds.
 * - Preserves system_instructions / special_instructions for LLM code generation.
 * - Follows the 8pt grid system (p-2, p-3, p-4, gap-2, gap-4) and Tailwind CSS styling.
 */

import React, { useState } from 'react';
import { CollapsibleSection } from '../../components/common/CollapsibleSection';
import { InfoTooltip } from '../../components/InfoTooltip';
import { PropertyField } from '../../components/common/PropertyField';
import { SystemInstructionsField } from '../../components/common/SystemInstructionsField';
import { resolveSystemInstructions } from '../../utils/systemInstructions';
import { useAssetLoader } from '../../hooks/useAssetLoader';
import { normalizeSecretItem } from '../../components/common/SecretManagerAuthFields';

/** Secret descriptor loaded from the secret manager for BigTable authentication. */
export interface SecretItem {
  id: string;
  name: string;
  fullName?: string;
}

/** Props for the {@link BigTableIOSourceProperties} component. */
export interface BigTableIOSourcePropertiesProps {
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
        rowFilter?: string;
        keyRangeStart?: string;
        keyRangeEnd?: string;
        maxBufferElementCount?: number | string;
        authMode?: 'adc' | 'secret_manager';
        serviceAccountSecret?: string;
        emulatorHost?: string;
        withoutValidation?: boolean;
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
 * BigTableIOSourceProperties renders the property configuration form for BigtableIO read operations.
 *
 * @param props Component properties containing the active node and onChange callback
 */
export const BigTableIOSourceProperties: React.FC<BigTableIOSourcePropertiesProps> = ({ node, onChange }) => {
  const properties = node?.data?.properties || {};

  // Form field state extracted from node properties
  const projectId = properties.projectId || '';
  const instanceId = properties.instanceId || '';
  const tableId = properties.tableId || '';
  const appProfileId = properties.appProfileId || '';
  const rowFilter = properties.rowFilter || '';
  const keyRangeStart = properties.keyRangeStart || '';
  const keyRangeEnd = properties.keyRangeEnd || '';
  const maxBufferElementCount = properties.maxBufferElementCount ?? '';
  const authMode = properties.authMode || 'adc';
  const serviceAccountSecret = properties.serviceAccountSecret || '';
  const emulatorHost = properties.emulatorHost || '';
  const withoutValidation = properties.withoutValidation ?? false;
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

  return (
    <div className="flex-1 flex flex-col gap-4 text-[var(--vscode-text-primary)] text-sm">
      {/* Target Bigtable Instance & Table Identification */}
      <div className="flex flex-col gap-3">
        <PropertyField
          id="bigtableSourceProjectId"
          name="projectId"
          label="Project ID"
          required="Project ID is required"
          tooltip="Google Cloud Project ID hosting the Cloud Bigtable instance (withProjectId). Required."
          value={projectId}
          invalid={isProjectEmpty}
          error={isProjectEmpty ? 'Project ID is required' : null}
          placeholder="e.g. my-gcp-project"
          onChange={handleChange}
          mono={true}
        />

        <div className="grid grid-cols-2 gap-2">
          <PropertyField
            id="bigtableSourceInstanceId"
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
            id="bigtableSourceTableId"
            name="tableId"
            label="Table ID"
            required="Table ID is required"
            tooltip="Cloud Bigtable Table ID to read from (withTableId). Required."
            value={tableId}
            invalid={isTableEmpty}
            error={isTableEmpty ? 'Table ID is required' : null}
            placeholder="e.g. user_sessions"
            onChange={handleChange}
            mono={true}
          />
        </div>

        <PropertyField
          id="bigtableSourceAppProfileId"
          name="appProfileId"
          label="App Profile ID"
          tooltip="Optional Bigtable App Profile ID to route requests or select single/multi-cluster routing (withAppProfileId)."
          value={appProfileId}
          onChange={handleChange}
          placeholder="e.g. analytics-app-profile"
          mono={true}
        />
      </div>

      {/* Row Filtering & Scan Range Configuration */}
      <div className="flex flex-col gap-2 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
        <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          <span>Row Filtering &amp; Key Ranges</span>
          <InfoTooltip text="Restrict rows returned by BigtableIO.read() via regex/cell filters (withRowFilter) or row key boundary ranges (withKeyRange/withKeyRanges)." />
        </label>

        <PropertyField
          id="bigtableSourceRowFilter"
          name="rowFilter"
          label="Row Filter Expression"
          value={rowFilter}
          onChange={handleChange}
          placeholder="e.g. RowFilter.newBuilder().setRowKeyRegexFilter(...).build()"
          tooltip="Server-side RowFilter specification to select or prune columns and cells (withRowFilter)."
          mono={true}
        />

        <div className="grid grid-cols-2 gap-2 mt-1">
          <PropertyField
            id="bigtableSourceKeyRangeStart"
            name="keyRangeStart"
            label="Start Row Key"
            value={keyRangeStart}
            onChange={handleChange}
            placeholder="e.g. user#0000"
            tooltip="Inclusive start row key for scanning key range segments."
            mono={true}
          />
          <PropertyField
            id="bigtableSourceKeyRangeEnd"
            name="keyRangeEnd"
            label="End Row Key"
            value={keyRangeEnd}
            onChange={handleChange}
            placeholder="e.g. user#9999"
            tooltip="Exclusive end row key for scanning key range segments."
            mono={true}
          />
        </div>

        <PropertyField
          id="bigtableSourceMaxBufferElementCount"
          name="maxBufferElementCount"
          label="Max Buffer Element Count"
          type="number"
          min={1}
          value={maxBufferElementCount}
          onChange={handleChange}
          placeholder="e.g. 1000"
          tooltip="Limits the number of in-memory buffered rows per reader split (withMaxBufferElementCount)."
          mono={true}
        />
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
              id="bigtableSourceServiceAccountSecret"
              name="serviceAccountSecret"
              label="Service Account Key Secret"
              value={serviceAccountSecret}
              onChange={handleChange}
              list="bigtable-source-secret-options"
              datalist={secrets.map((s) => ({ value: s.id || s.name, label: s.name || s.id }))}
              placeholder="e.g. gcp-bigtable-sa-key"
              error={secretError}
              invalid={!!secretError}
              mono={true}
            />
          </div>
        )}
      </div>

      {/* Client-Side Metrics Information Card */}
      <div className="flex flex-col gap-1 p-2 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)] text-xs text-[var(--vscode-text-secondary)]">
        <span className="font-bold text-[var(--vscode-text-muted)] uppercase">Client-Side Metrics</span>
        <p>
          Bigtable client-side metrics (latency, error rates, client-side throttling) publish automatically
          to Cloud Monitoring under <span className="font-mono text-[var(--vscode-text-primary)]">bigtable.googleapis.com/client/*</span>.
        </p>
      </div>

      {/* Collapsible Advanced Source Settings */}
      <CollapsibleSection
        title="Advanced Source Settings"
        isOpen={showAdvanced}
        onToggle={() => setShowAdvanced(!showAdvanced)}
      >
        {/* Emulator Host Override */}
        <PropertyField
          id="bigtableSourceEmulatorHost"
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
            id="bigtableSourceAttemptTimeoutMs"
            name="attemptTimeoutMs"
            label="Attempt Timeout (ms)"
            type="number"
            min={1}
            value={attemptTimeoutMs}
            onChange={handleChange}
            placeholder="e.g. 20000"
            tooltip="Timeout in milliseconds for each individual RPC call attempt to Bigtable (withAttemptTimeout)."
            mono={true}
          />
          <PropertyField
            id="bigtableSourceOperationTimeoutMs"
            name="operationTimeoutMs"
            label="Operation Timeout (ms)"
            type="number"
            min={1}
            value={operationTimeoutMs}
            onChange={handleChange}
            placeholder="e.g. 60000"
            tooltip="Total timeout in milliseconds for the overall Bigtable operation including retries (withOperationTimeout)."
            mono={true}
          />
        </div>

        {/* Validation Toggle */}
        <div className="flex items-center gap-2 mt-1">
          <input
            id="bigtableSourceWithoutValidation"
            type="checkbox"
            name="withoutValidation"
            checked={withoutValidation}
            onChange={handleChange}
            className="rounded border-[var(--vscode-border)] text-[var(--vscode-highlight)] accent-[var(--vscode-highlight)] focus:ring-0 cursor-pointer"
          />
          <label htmlFor="bigtableSourceWithoutValidation" className="flex items-center gap-1.5 text-xs text-[var(--vscode-text-secondary)] cursor-pointer">
            <span>Disable Pipeline Graph Validation</span>
            <InfoTooltip text="Bypasses table existence and permission checks during graph submission (withoutValidation)." />
          </label>
        </div>
      </CollapsibleSection>

      {/* Code Generation Instructions */}
      <SystemInstructionsField
        id="bigtableSourceInstructions"
        value={systemInstructions}
        tooltip="Optional instructions passed to LLM code generator when synthesizing BigtableIO read pipelines (emits PCollection<com.google.bigtable.v2.Row>)."
        placeholder="e.g. Apply BigtableIO.read().withProjectId(...).withInstanceId(...).withTableId(...) emitting com.google.bigtable.v2.Row"
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
