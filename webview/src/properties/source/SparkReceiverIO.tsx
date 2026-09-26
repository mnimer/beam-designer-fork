/**
 * SparkReceiverIOSourceProperties Component
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Renders the property configuration panel for Apache Beam SparkReceiverIO Source nodes (SparkReceiverIO.read()).
 * Enables reading streaming data from Apache Spark Streaming custom receivers into Apache Beam pipelines.
 * Configures the ReceiverBuilder, offset and timestamp extraction functions, constructor parameters,
 * coder configuration, replayability semantics, and connection credentials.
 *
 * Architectural Decisions:
 * - Controlled input architecture with props in / events up pattern.
 * - Enforces required Spark Receiver class name with real-time alerts and ARIA invalid attributes.
 * - Replayability banner callout: Spark receivers must be offset-based and replayable to achieve
 *   exactly-once processing semantics; non-replayable receivers degrade to at-most-once processing.
 * - Receiver constructor arguments configured via multi-line textarea mapping to ReceiverBuilder.withConstructorArgs(...).
 * - Offset function (withGetOffsetFn) and timestamp function (withTimestampFn) configure checkpointing and event-time watermarking.
 * - Dynamic discovery: Requests GCP Secret Manager secrets from the extension host via 'getSecrets' IPC message.
 * - Provides unique datalist id 'sparkreceiver-source-secret-options' avoiding collisions.
 * - Decomposed into local presentational sub-components (SparkReceiverSourceAuthSection,
 *   SparkReceiverSourceAdvancedSection) with onToggle callback for collapsible state.
 * - Preserves system_instructions / special_instructions in the bottom textarea for LLM code generation.
 * - Follows the 8pt grid system and Tailwind CSS styling with VS Code theme tokens.
 */

import React, { useState } from 'react';
import { InfoTooltip } from '../../components/InfoTooltip';
import { PropertyField } from '../../components/common/PropertyField';
import { useAssetLoader } from '../../hooks/useAssetLoader';
import { normalizeSecretItem } from '../../components/common/SecretManagerAuthFields';

/**
 * Secret item interface for normalized Secret Manager secrets.
 */
export interface SecretItem {
  id: string;
  name: string;
  fullName?: string;
}

export interface SparkReceiverIOSourcePropertiesProps {
  node: {
    data: {
      label?: string;
      beam_transform?: string;
      system_instructions?: string;
      special_instructions?: string;
      properties?: {
        receiverClass?: string;
        constructorArgs?: string;
        authMode?: 'none' | 'secret_manager' | string;
        authSecret?: string;
        usernameSecret?: string;
        passwordSecret?: string;
        pullFrequencyMs?: number | string;
        startOffset?: number | string;
        maxRecordsPerBundle?: number | string;
        restartOnFailure?: boolean;
        storageLevel?: 'MEMORY_ONLY' | 'MEMORY_AND_DISK' | 'MEMORY_AND_DISK_SER' | string;
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

interface SparkReceiverSourceAuthSectionProps {
  authMode: 'none' | 'secret_manager';
  authSecret: string;
  usernameSecret: string;
  passwordSecret: string;
  secrets: SecretItem[];
  secretError: string | null;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}

/**
 * Local presentational sub-component for Spark Receiver credentials.
 */
const SparkReceiverSourceAuthSection: React.FC<SparkReceiverSourceAuthSectionProps> = ({
  authMode,
  authSecret,
  usernameSecret,
  passwordSecret,
  secrets,
  secretError,
  onChange
}) => {
  return (
    <div className="flex flex-col gap-2 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
      <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
        <span>Backend Authentication</span>
        <InfoTooltip text="Credentials for backend services consumed by the Spark Receiver (e.g. API tokens, client secrets). Using Secret Manager avoids hardcoding secrets into pipeline definitions." />
      </label>
      <div className="flex flex-col gap-2 mt-1">
        <label className="flex items-center gap-2 cursor-pointer text-xs text-[var(--vscode-text-secondary)]">
          <input
            type="radio"
            name="authMode"
            value="none"
            checked={authMode === 'none'}
            onChange={onChange}
            className="accent-[var(--vscode-highlight)] text-[var(--vscode-highlight)]"
          />
          <span>No Authentication / Custom Args</span>
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
          <span>GCP Secret Manager</span>
        </label>
      </div>

      {authMode === 'secret_manager' && (
        <div className="flex flex-col gap-3 mt-2 pl-2 border-l-2 border-[var(--vscode-highlight)]/50">
          <PropertyField
            id="sparkReceiverSourceAuthSecret"
            name="authSecret"
            label="API Key / Token Secret"
            value={authSecret}
            onChange={onChange}
            list="sparkreceiver-source-secret-options"
            datalist={secrets.map((s) => ({ value: s.id || s.name, label: s.name || s.id }))}
            placeholder="e.g. spark-receiver-api-key"
            tooltip="GCP Secret Manager secret containing the receiver API key or token."
            error={secretError}
            invalid={!!secretError}
            mono={true}
          />
          <PropertyField
            id="sparkReceiverSourceUsernameSecret"
            name="usernameSecret"
            label="Username Secret"
            value={usernameSecret}
            onChange={onChange}
            list="sparkreceiver-source-secret-options"
            datalist={secrets.map((s) => ({ value: s.id || s.name, label: s.name || s.id }))}
            placeholder="e.g. spark-receiver-username"
            tooltip="Optional GCP Secret Manager secret containing the username."
            error={secretError}
            invalid={!!secretError}
            mono={true}
          />
          <PropertyField
            id="sparkReceiverSourcePasswordSecret"
            name="passwordSecret"
            label="Password Secret"
            value={passwordSecret}
            onChange={onChange}
            list="sparkreceiver-source-secret-options"
            datalist={secrets.map((s) => ({ value: s.id || s.name, label: s.name || s.id }))}
            placeholder="e.g. spark-receiver-password"
            tooltip="Optional GCP Secret Manager secret containing the password."
            error={secretError}
            invalid={!!secretError}
            mono={true}
          />
        </div>
      )}
    </div>
  );
};

interface SparkReceiverSourceAdvancedSectionProps {
  showAdvanced: boolean;
  onToggle: () => void;
  pullFrequencyMs: number | string;
  startOffset: number | string;
  maxRecordsPerBundle: number | string;
  restartOnFailure: boolean;
  storageLevel: 'MEMORY_ONLY' | 'MEMORY_AND_DISK' | 'MEMORY_AND_DISK_SER';
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}

/**
 * Local presentational sub-component for advanced Spark Receiver runtime options.
 */
const SparkReceiverSourceAdvancedSection: React.FC<SparkReceiverSourceAdvancedSectionProps> = ({
  showAdvanced,
  onToggle,
  pullFrequencyMs,
  startOffset,
  maxRecordsPerBundle,
  restartOnFailure,
  storageLevel,
  onChange
}) => {
  return (
    <div className="flex flex-col border border-[var(--vscode-border-light)] rounded-md overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center justify-between p-2 bg-[var(--vscode-subcard-bg)] text-xs font-bold uppercase text-[var(--vscode-text-muted)] hover:text-[var(--vscode-text-primary)] transition-colors cursor-pointer"
      >
        <span>Advanced Source Settings</span>
        <span>{showAdvanced ? '▲' : '▼'}</span>
      </button>

      {showAdvanced && (
        <div className="p-3 bg-[var(--vscode-workbench-bg)] flex flex-col gap-3 border-t border-[var(--vscode-border-light)]">
          <div className="grid grid-cols-2 gap-2">
            <PropertyField
              id="sparkReceiverSourcePullFrequencyMs"
              name="pullFrequencyMs"
              label="Pull Frequency (ms)"
              type="number"
              value={pullFrequencyMs}
              onChange={onChange}
              placeholder="e.g. 200"
              min={10}
              tooltip="Polling / pull interval in milliseconds for draining records from the Spark Receiver buffer."
            />
            <PropertyField
              id="sparkReceiverSourceStartOffset"
              name="startOffset"
              label="Start Offset"
              type="number"
              value={startOffset}
              onChange={onChange}
              placeholder="e.g. 0"
              tooltip="Initial starting offset for offset-based receivers."
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <PropertyField
              id="sparkReceiverSourceMaxRecordsPerBundle"
              name="maxRecordsPerBundle"
              label="Max Records Per Bundle"
              type="number"
              value={maxRecordsPerBundle}
              onChange={onChange}
              placeholder="e.g. 1000"
              min={1}
              tooltip="Maximum number of records to process in a single streaming bundle."
            />
            <div className="flex flex-col gap-1">
              <label
                htmlFor="sparkReceiverSourceStorageLevel"
                className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]"
              >
                <span>Receiver Storage Level</span>
                <InfoTooltip text="Spark Receiver persistence storage level passed to the Spark Streaming receiver supervisor." />
              </label>
              <select
                id="sparkReceiverSourceStorageLevel"
                name="storageLevel"
                value={storageLevel}
                onChange={onChange}
                className="bg-[var(--vscode-input-bg)] text-[var(--vscode-text-primary)] p-2 rounded border border-[var(--vscode-border)] text-xs focus:outline-none focus:border-[var(--vscode-highlight)]"
              >
                <option value="MEMORY_AND_DISK_SER">MEMORY_AND_DISK_SER (Default)</option>
                <option value="MEMORY_AND_DISK">MEMORY_AND_DISK</option>
                <option value="MEMORY_ONLY">MEMORY_ONLY</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-[var(--vscode-text-secondary)]">
              <input
                id="sparkReceiverSourceRestartOnFailure"
                type="checkbox"
                name="restartOnFailure"
                checked={restartOnFailure}
                onChange={onChange}
                className="rounded border-[var(--vscode-border)] text-[var(--vscode-highlight)] accent-[var(--vscode-highlight)]"
              />
              <span>Restart Receiver on Failure</span>
              <InfoTooltip text="Automatically restarts the Spark Receiver if an unhandled internal receiver exception occurs." />
            </label>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * SparkReceiverIOSourceProperties renders the configuration panel for reading streams via SparkReceiverIO.
 *
 * @param props Component properties containing the active node and onChange callback
 */
export const SparkReceiverIOSourceProperties: React.FC<SparkReceiverIOSourcePropertiesProps> = ({
  node,
  onChange
}) => {
  const properties = node.data.properties || {};

  // Form field state extracted from node properties
  const receiverClass = properties.receiverClass || '';
  const constructorArgs = properties.constructorArgs || '';
  const authMode: 'none' | 'secret_manager' =
    (properties.authMode as 'none' | 'secret_manager') || 'none';
  const authSecret = properties.authSecret || '';
  const usernameSecret = properties.usernameSecret || '';
  const passwordSecret = properties.passwordSecret || '';
  const pullFrequencyMs = properties.pullFrequencyMs ?? '';
  const startOffset = properties.startOffset ?? '';
  const maxRecordsPerBundle = properties.maxRecordsPerBundle ?? '';
  const restartOnFailure = properties.restartOnFailure ?? true;
  const storageLevel: 'MEMORY_ONLY' | 'MEMORY_AND_DISK' | 'MEMORY_AND_DISK_SER' =
    (properties.storageLevel as 'MEMORY_ONLY' | 'MEMORY_AND_DISK' | 'MEMORY_AND_DISK_SER') || 'MEMORY_AND_DISK_SER';

  // Local state for dynamically loaded secrets and accordion toggle
  const { items: rawSecrets, error: secretError } = useAssetLoader<SecretItem | string>('secrets');
  const secrets: SecretItem[] = (rawSecrets || []).map(normalizeSecretItem);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Field validation
  const isReceiverClassEmpty = !receiverClass.trim();

  // Fallback chain for system instructions
  const systemInstructions =
    node.data.system_instructions ??
    node.data.special_instructions ??
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

  /**
   * Handles system instructions textarea modification.
   *
   * @param e React textarea change event
   */
  const handleInstructionsChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    onChange({
      ...properties,
      system_instructions: e.target.value
    });
  };

  return (
    <div className="flex-1 flex flex-col gap-4 text-[var(--vscode-text-primary)] text-sm">
      {/* Replayability & Semantics Callout Banner */}
      <div className="p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-amber-500/40 flex items-start gap-2">
        <span className="text-amber-400 font-bold text-base leading-none">⚠</span>
        <div className="flex flex-col gap-1 text-xs text-[var(--vscode-text-secondary)]">
          <div className="flex items-center gap-1.5 font-bold text-amber-300">
            <span>Replayability &amp; Exactly-Once Semantics</span>
            <InfoTooltip text="SparkReceiverIO achieves exactly-once guarantees only with offset-based, replayable Spark Receivers implementing getOffsetFn. Non-replayable receivers degrade to at-most-once processing." />
          </div>
          <span>
            The configured Spark Receiver must be offset-based and replayable for Apache Beam exactly-once delivery guarantees. Non-replayable receivers degrade to at-most-once processing.
          </span>
        </div>
      </div>

      {/* Receiver Class */}
      <PropertyField
        id="sparkReceiverSourceClass"
        name="receiverClass"
        label="Receiver Class Name"
        required="Spark Receiver class name is required"
        tooltip="Fully-qualified class name of the Spark Streaming Receiver subclass (e.g. org.apache.spark.streaming.receiver.Receiver). Configured via ReceiverBuilder.of(receiverClass).withConstructorArgs(...)."
        value={receiverClass}
        invalid={isReceiverClassEmpty}
        error={isReceiverClassEmpty ? 'Spark Receiver class name is required' : null}
        placeholder="e.g. io.cdap.plugin.salesforce.SalesforceStreamingReceiver"
        onChange={handleChange}
        mono={true}
      />

      {/* Receiver Constructor Arguments */}
      <PropertyField
        id="sparkReceiverSourceConstructorArgs"
        name="constructorArgs"
        label="Receiver Constructor Arguments"
        type="textarea"
        rows={3}
        tooltip="Constructor arguments passed to the Spark Receiver class, entered one per line or as key=value pairs. ReceiverBuilder takes the receiver class and its constructor arguments to instantiate the receiver."
        value={constructorArgs}
        onChange={handleChange}
        placeholder={'arg0=client_id\narg1=https://login.salesforce.com\narg2=secret_token'}
        mono={true}
      />

      {/* Backend Authentication */}
      <SparkReceiverSourceAuthSection
        authMode={authMode}
        authSecret={authSecret}
        usernameSecret={usernameSecret}
        passwordSecret={passwordSecret}
        secrets={secrets}
        secretError={secretError}
        onChange={handleChange}
      />

      {/* Collapsible Advanced Source Settings */}
      <SparkReceiverSourceAdvancedSection
        showAdvanced={showAdvanced}
        onToggle={() => setShowAdvanced(!showAdvanced)}
        pullFrequencyMs={pullFrequencyMs}
        startOffset={startOffset}
        maxRecordsPerBundle={maxRecordsPerBundle}
        restartOnFailure={restartOnFailure}
        storageLevel={storageLevel}
        onChange={handleChange}
      />

      <div className="flex-1 min-h-[16px]" />

      {/* Code Generation Instructions */}
      <PropertyField
        id="sparkReceiverSourceSystemInstructions"
        name="system_instructions"
        label="Code Generation Instructions"
        type="textarea"
        rows={4}
        value={systemInstructions}
        onChange={handleInstructionsChange}
        placeholder="Custom prompt instructions for generating the Apache Beam SparkReceiverIO source step..."
        tooltip="Optional custom prompt instructions injected into LLM code generation for this transform."
      />
    </div>
  );
};
