/**
 * MongoDbGridFSIOSinkProperties Component
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Renders the property configuration panel for Apache Beam MongoDbGridFSIO Write Sink nodes (MongoDbGridFSIO.write()).
 * Configures writing binary files and large streams to MongoDB GridFS buckets, with configurable chunk sizes,
 * destination filenames, custom element-to-stream write functions (withWriteFn), and authentication.
 *
 * Architectural Decisions:
 * - Controlled input architecture with props in / events up pattern.
 * - Real-time validation for required connection URI and database fields.
 * - URI format validation providing a warning helper text when not starting with "mongodb://" or "mongodb+srv://".
 * - Bucket name defaults to standard GridFS namespace "fs".
 * - Chunk size configuration (withChunkSize) controls the chunking granularity in the chunks collection (default 255 KB).
 * - Destination filename (withFilename) and custom write function (withWriteFn) configure file metadata and stream serialization.
 * - Dynamic discovery: Requests GCP Secret Manager secrets from the extension host via 'getSecrets' IPC.
 * - Unique datalist id 'mongodbgridfs-sink-secret-options' to prevent collision across panels.
 * - Collapsible Advanced Sink Settings decomposed into local presentational sub-component with semantic onToggle callback.
 * - Preserves system_instructions / special_instructions for LLM code generation.
 * - Strictly adheres to 8pt grid system (p-2, p-3, gap-2, gap-3, gap-4) and Tailwind CSS with VS Code tokens.
 */

import React, { useState } from 'react';
import { InfoTooltip } from '../../components/InfoTooltip';
import { PropertyField } from '../../components/common/PropertyField';
import { SystemInstructionsField } from '../../components/common/SystemInstructionsField';
import { resolveSystemInstructions } from '../../utils/systemInstructions';
import { useAssetLoader } from '../../hooks/useAssetLoader';
import { normalizeSecretItem } from '../../components/common/SecretManagerAuthFields';
import { CollapsibleSection } from '../../components/common/CollapsibleSection';

/**
 * Secret item interface for normalized Secret Manager secrets.
 */
export interface SecretItem {
  id: string;
  name: string;
  fullName?: string;
}

/**
 * Props for the MongoDbGridFSIOSinkProperties component.
 */
export interface MongoDbGridFSIOSinkPropertiesProps {
  node: {
    data: {
      label?: string;
      beam_transform?: string;
      system_instructions?: string;
      special_instructions?: string;
      properties?: {
        uri?: string;
        database?: string;
        bucket?: string;
        filename?: string;
        chunkSize?: number | string;
        writeFn?: string;
        authMode?: 'uri_embedded' | 'secret_manager' | string;
        usernameSecret?: string;
        passwordSecret?: string;
        sslEnabled?: boolean;
        sslInvalidHostNameAllowed?: boolean;
        ignoreSSLCertificate?: boolean;
        maxConnectionIdleTime?: number | string;
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
 * Props for the MongoDbGridFSSinkAuthSection sub-component.
 */
interface MongoDbGridFSSinkAuthSectionProps {
  authMode: 'uri_embedded' | 'secret_manager';
  usernameSecret: string;
  passwordSecret: string;
  secrets: SecretItem[];
  secretError: string | null;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}

/**
 * Presentational component for GridFS Sink authentication configuration.
 *
 * @param props Sub-component properties
 */
const MongoDbGridFSSinkAuthSection: React.FC<MongoDbGridFSSinkAuthSectionProps> = ({
  authMode,
  usernameSecret,
  passwordSecret,
  secrets,
  secretError,
  onChange
}) => {
  return (
    <div className="flex flex-col gap-2 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
      <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
        <span>Authentication</span>
        <InfoTooltip text="Choose how credentials are provided to the MongoDB cluster. Using Secret Manager avoids committing credentials into pipeline code." />
      </label>
      <div className="flex flex-col gap-2 mt-1">
        <label className="flex items-center gap-2 cursor-pointer text-xs text-[var(--vscode-text-secondary)]">
          <input
            type="radio"
            name="authMode"
            value="uri_embedded"
            checked={authMode === 'uri_embedded'}
            onChange={onChange}
            className="accent-[var(--vscode-highlight)] text-[var(--vscode-highlight)]"
          />
          <span>None (Unauthenticated)</span>
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
            id="mongoGridFSSinkUsernameSecret"
            name="usernameSecret"
            label="Username Secret"
            value={usernameSecret}
            onChange={onChange}
            list="mongodbgridfs-sink-secret-options"
            datalist={secrets.map((s) => ({ value: s.id || s.name, label: s.name || s.id }))}
            placeholder="e.g. mongodb-username"
            tooltip="GCP Secret Manager secret containing the MongoDB username."
            error={secretError}
            invalid={!!secretError}
            mono={true}
          />
          <PropertyField
            id="mongoGridFSSinkPasswordSecret"
            name="passwordSecret"
            label="Password Secret"
            value={passwordSecret}
            onChange={onChange}
            list="mongodbgridfs-sink-secret-options"
            datalist={secrets.map((s) => ({ value: s.id || s.name, label: s.name || s.id }))}
            placeholder="e.g. mongodb-password"
            tooltip="GCP Secret Manager secret containing the MongoDB password."
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
 * Props for the MongoDbGridFSSinkAdvancedSection sub-component.
 */
interface MongoDbGridFSSinkAdvancedSectionProps {
  showAdvanced: boolean;
  onToggle: () => void;
  sslEnabled: boolean;
  sslInvalidHostNameAllowed: boolean;
  ignoreSSLCertificate: boolean;
  maxConnectionIdleTime: number | string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}

/**
 * Presentational component for GridFS Sink SSL and connection pooling.
 *
 * @param props Sub-component properties
 */
const MongoDbGridFSSinkAdvancedSection: React.FC<MongoDbGridFSSinkAdvancedSectionProps> = ({
  showAdvanced,
  onToggle,
  sslEnabled,
  sslInvalidHostNameAllowed,
  ignoreSSLCertificate,
  maxConnectionIdleTime,
  onChange
}) => {
  return (
    <CollapsibleSection
      title="Advanced Sink Settings"
      isOpen={showAdvanced}
      onToggle={onToggle}
    >
      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-2 cursor-pointer text-xs text-[var(--vscode-text-secondary)]">
          <input
            id="mongoGridFSSinkSslEnabled"
            type="checkbox"
            name="sslEnabled"
            checked={sslEnabled}
            onChange={onChange}
            className="rounded border-[var(--vscode-border)] text-[var(--vscode-highlight)] accent-[var(--vscode-highlight)]"
          />
          <span>SSL / TLS Enabled</span>
          <InfoTooltip text="Enables SSL/TLS encrypted transport layer security." />
        </label>

        <label className="flex items-center gap-2 cursor-pointer text-xs text-[var(--vscode-text-secondary)]">
          <input
            id="mongoGridFSSinkSslInvalidHostNameAllowed"
            type="checkbox"
            name="sslInvalidHostNameAllowed"
            checked={sslInvalidHostNameAllowed}
            onChange={onChange}
            className="rounded border-[var(--vscode-border)] text-[var(--vscode-highlight)] accent-[var(--vscode-highlight)]"
          />
          <span>Allow Invalid Hostname</span>
          <InfoTooltip text="Allows SSL connections when hostname does not match the certificate." />
        </label>

        <label className="flex items-center gap-2 cursor-pointer text-xs text-[var(--vscode-text-secondary)]">
          <input
            id="mongoGridFSSinkIgnoreSSLCertificate"
            type="checkbox"
            name="ignoreSSLCertificate"
            checked={ignoreSSLCertificate}
            onChange={onChange}
            className="rounded border-[var(--vscode-border)] text-[var(--vscode-highlight)] accent-[var(--vscode-highlight)]"
          />
          <span>Ignore SSL Certificate</span>
          <InfoTooltip text="Configures whether to trust invalid or self-signed SSL certificates." />
        </label>
      </div>

      <PropertyField
        id="mongoGridFSSinkMaxConnectionIdleTime"
        name="maxConnectionIdleTime"
        label="Max Connection Idle Time (ms)"
        type="number"
        value={maxConnectionIdleTime}
        onChange={onChange}
        placeholder="0 (Unlimited)"
        min={0}
        tooltip="Maximum idle time of a pooled connection in milliseconds before it is closed."
      />
    </CollapsibleSection>
  );
};

/**
 * MongoDbGridFSIOSinkProperties renders the configuration form for writing files to MongoDB GridFS.
 *
 * @param props Component properties containing the active node and onChange callback
 */
export const MongoDbGridFSIOSinkProperties: React.FC<MongoDbGridFSIOSinkPropertiesProps> = ({
  node,
  onChange
}) => {
  const properties = node.data.properties || {};

  // Form field state extracted from node properties
  const uri = properties.uri || '';
  const database = properties.database || '';
  const bucket = properties.bucket || 'fs';
  const filename = properties.filename || '';
  const chunkSize = properties.chunkSize ?? '';
  const writeFn = properties.writeFn || '';
  const authMode: 'uri_embedded' | 'secret_manager' =
    (properties.authMode as 'uri_embedded' | 'secret_manager') || 'uri_embedded';
  const usernameSecret = properties.usernameSecret || '';
  const passwordSecret = properties.passwordSecret || '';
  const sslEnabled = properties.sslEnabled ?? false;
  const sslInvalidHostNameAllowed = properties.sslInvalidHostNameAllowed ?? false;
  const ignoreSSLCertificate = properties.ignoreSSLCertificate ?? false;
  const maxConnectionIdleTime = properties.maxConnectionIdleTime ?? '';

  // Local state for dynamically loaded secrets and accordion toggle
  const { items: rawSecrets, error: secretError } = useAssetLoader<SecretItem | string>('secrets');
  const secrets: SecretItem[] = (rawSecrets || []).map(normalizeSecretItem);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Field validation
  const isUriEmpty = !uri.trim();
  const isUriInvalid = uri.trim().length > 0 && !uri.trim().startsWith('mongodb');
  const isDatabaseEmpty = !database.trim();

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
      {/* MongoDB Connection URI */}
      <PropertyField
        id="mongoGridFSSinkUri"
        name="uri"
        label="Connection URI"
        required="Connection URI is required"
        tooltip="MongoDB connection URI (e.g. mongodb://localhost:27017 or mongodb+srv://cluster.example.com). Maps to withUri()."
        value={uri}
        invalid={isUriEmpty}
        error={isUriEmpty ? 'Connection URI is required' : null}
        helperText={
          !isUriEmpty && isUriInvalid ? (
            <span className="text-amber-400" role="alert">
              Warning: MongoDB connection URI should start with &quot;mongodb://&quot; or &quot;mongodb+srv://&quot;
            </span>
          ) : null
        }
        placeholder="mongodb://localhost:27017 or mongodb+srv://cluster.example.com"
        onChange={handleChange}
        mono={true}
      />

      {/* Database & GridFS Bucket */}
      <div className="grid grid-cols-2 gap-2">
        <PropertyField
          id="mongoGridFSSinkDatabase"
          name="database"
          label="Database Name"
          required="Database name is required"
          tooltip="Target MongoDB database name containing the GridFS bucket. Maps to withDatabase()."
          value={database}
          invalid={isDatabaseEmpty}
          error={isDatabaseEmpty ? 'Database name is required' : null}
          placeholder="e.g. analytics"
          onChange={handleChange}
          mono={true}
        />
        <PropertyField
          id="mongoGridFSSinkBucket"
          name="bucket"
          label="GridFS Bucket Name"
          tooltip="GridFS bucket root namespace. Defaults to 'fs'. Maps to withBucket()."
          value={bucket}
          placeholder="fs"
          onChange={handleChange}
          mono={true}
        />
      </div>

      {/* File Destination & Chunk Configuration */}
      <div className="flex flex-col gap-3 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
        <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          <span>File Destination &amp; Chunking</span>
          <InfoTooltip text="Specify the destination file name and the binary chunk size in bytes for the GridFS chunks collection." />
        </label>

        <PropertyField
          id="mongoGridFSSinkFilename"
          name="filename"
          label="Destination Filename"
          tooltip="Destination filename or naming pattern in the GridFS bucket. Maps to withFilename()."
          value={filename}
          onChange={handleChange}
          placeholder="e.g. output_%d.bin or payload.dat"
          mono={true}
        />

        <PropertyField
          id="mongoGridFSSinkChunkSize"
          name="chunkSize"
          label="Chunk Size (bytes)"
          type="number"
          tooltip="GridFS chunk size in bytes (default 261,120 / 255 KB). Maps to withChunkSize()."
          value={chunkSize}
          onChange={handleChange}
          placeholder="e.g. 261120"
          min={1024}
        />
      </div>

      {/* Custom Write Function */}
      <div className="flex flex-col gap-3 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
        <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          <span>File Write Function</span>
          <InfoTooltip text="Configures custom WriteFn implementing MongoDbGridFSIO.WriteFn<T> defining how elements are written to GridFS output streams." />
        </label>

        <PropertyField
          id="mongoGridFSSinkWriteFn"
          name="writeFn"
          label="Write Function"
          tooltip="Class or lambda implementing MongoDbGridFSIO.WriteFn<T> that writes element data into the GridFS OutputStream. Maps to withWriteFn()."
          value={writeFn}
          onChange={handleChange}
          placeholder="e.g. com.example.DocumentGridFSWriteFn"
          mono={true}
        />
      </div>

      {/* Authentication */}
      <MongoDbGridFSSinkAuthSection
        authMode={authMode}
        usernameSecret={usernameSecret}
        passwordSecret={passwordSecret}
        secrets={secrets}
        secretError={secretError}
        onChange={handleChange}
      />

      {/* Collapsible Advanced Sink Settings */}
      <MongoDbGridFSSinkAdvancedSection
        showAdvanced={showAdvanced}
        onToggle={() => setShowAdvanced(!showAdvanced)}
        sslEnabled={sslEnabled}
        sslInvalidHostNameAllowed={sslInvalidHostNameAllowed}
        ignoreSSLCertificate={ignoreSSLCertificate}
        maxConnectionIdleTime={maxConnectionIdleTime}
        onChange={handleChange}
      />

      {/* Code Generation Instructions */}
      <SystemInstructionsField
        id="mongoGridFSSinkSystemInstructions"
        value={systemInstructions}
        rows={4}
        tooltip="Optional custom prompt instructions injected into LLM code generation for this transform."
        placeholder="Custom prompt instructions for generating the Apache Beam MongoDbGridFSIO sink step..."
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
