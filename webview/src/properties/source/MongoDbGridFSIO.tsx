/**
 * MongoDbGridFSIOSourceProperties Component
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Renders the property configuration panel for Apache Beam MongoDbGridFSIO Source nodes (MongoDbGridFSIO.read()).
 * Dedicated to large binary and file ingestion from MongoDB GridFS buckets, with configurable file filtering,
 * read skew tolerance, chunk stream parsing (withParser), coder configuration, and authentication.
 *
 * Architectural Decisions:
 * - Controlled input architecture with props in / events up pattern.
 * - Enforces required connection URI and database coordinates with real-time alerts and ARIA attributes.
 * - URI format validation displays warning helper text when URI does not start with "mongodb://" or "mongodb+srv://".
 * - Bucket name defaults to standard GridFS namespace "fs".
 * - File parsing: withParser and withCoder allow deserializing binary file streams into domain objects.
 * - Read skew tolerance (withSkew) guards against files written concurrently during the read window.
 * - Dynamic discovery: fetches GCP Secret Manager secrets via 'getSecrets' IPC message for secure credentials.
 * - Provides unique datalist id 'mongodbgridfs-source-secret-options' avoiding collisions.
 * - Decomposed into local presentational sub-components (MongoDbGridFSSourceAuthSection,
 *   MongoDbGridFSSourceAdvancedSection) with onToggle callback for collapsible state.
 * - Preserves system_instructions / special_instructions in the bottom textarea for LLM code generation.
 * - Follows the 8pt grid system and Tailwind CSS styling with VS Code theme tokens.
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

export interface MongoDbGridFSIOSourcePropertiesProps {
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
        filter?: string;
        skew?: number | string;
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

interface MongoDbGridFSSourceAuthSectionProps {
  authMode: 'uri_embedded' | 'secret_manager';
  usernameSecret: string;
  passwordSecret: string;
  secrets: SecretItem[];
  secretError: string | null;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}

/**
 * Local presentational sub-component for GridFS Source credentials.
 */
const MongoDbGridFSSourceAuthSection: React.FC<MongoDbGridFSSourceAuthSectionProps> = ({
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
        <InfoTooltip text="Choose how credentials are supplied to the MongoDB cluster. Using Secret Manager avoids committing credentials into pipeline code." />
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
            id="mongoGridFSSourceUsernameSecret"
            name="usernameSecret"
            label="Username Secret"
            value={usernameSecret}
            onChange={onChange}
            list="mongodbgridfs-source-secret-options"
            datalist={secrets.map((s) => ({ value: s.id || s.name, label: s.name || s.id }))}
            placeholder="e.g. mongodb-username"
            tooltip="GCP Secret Manager secret containing the MongoDB username."
            error={secretError}
            invalid={!!secretError}
            mono={true}
          />
          <PropertyField
            id="mongoGridFSSourcePasswordSecret"
            name="passwordSecret"
            label="Password Secret"
            value={passwordSecret}
            onChange={onChange}
            list="mongodbgridfs-source-secret-options"
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

interface MongoDbGridFSSourceAdvancedSectionProps {
  showAdvanced: boolean;
  onToggle: () => void;
  sslEnabled: boolean;
  sslInvalidHostNameAllowed: boolean;
  ignoreSSLCertificate: boolean;
  maxConnectionIdleTime: number | string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}

/**
 * Local presentational sub-component for GridFS Source SSL and connection pooling.
 */
const MongoDbGridFSSourceAdvancedSection: React.FC<MongoDbGridFSSourceAdvancedSectionProps> = ({
  showAdvanced,
  onToggle,
  sslEnabled,
  sslInvalidHostNameAllowed,
  ignoreSSLCertificate,
  maxConnectionIdleTime,
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
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-[var(--vscode-text-secondary)]">
              <input
                id="mongoGridFSSourceSslEnabled"
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
                id="mongoGridFSSourceSslInvalidHostNameAllowed"
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
                id="mongoGridFSSourceIgnoreSSLCertificate"
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
            id="mongoGridFSSourceMaxConnectionIdleTime"
            name="maxConnectionIdleTime"
            label="Max Connection Idle Time (ms)"
            type="number"
            value={maxConnectionIdleTime}
            onChange={onChange}
            placeholder="0 (Unlimited)"
            min={0}
            tooltip="Maximum idle time of a pooled connection in milliseconds before it is closed."
          />
        </div>
      )}
    </div>
  );
};

/**
 * MongoDbGridFSIOSourceProperties renders the configuration form for reading files from MongoDB GridFS.
 *
 * @param props Component properties containing the active node and onChange callback
 */
export const MongoDbGridFSIOSourceProperties: React.FC<MongoDbGridFSIOSourcePropertiesProps> = ({
  node,
  onChange
}) => {
  const properties = node.data.properties || {};

  // Form field state extracted from node properties
  const uri = properties.uri || '';
  const database = properties.database || '';
  const bucket = properties.bucket || 'fs';
  const filter = properties.filter || '';
  const skew = properties.skew ?? '';
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
      {/* MongoDB Connection URI */}
      <PropertyField
        id="mongoGridFSSourceUri"
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
          id="mongoGridFSSourceDatabase"
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
          id="mongoGridFSSourceBucket"
          name="bucket"
          label="GridFS Bucket Name"
          tooltip="GridFS bucket root namespace. Defaults to 'fs'. Maps to withBucket()."
          value={bucket}
          placeholder="fs"
          onChange={handleChange}
          mono={true}
        />
      </div>

      {/* File Selection Filter & Read Skew */}
      <div className="flex flex-col gap-3 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
        <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          <span>File Selection &amp; Skew Tolerance</span>
          <InfoTooltip text="Filter GridFS files to read and set timestamp skew tolerance for concurrent file writes." />
        </label>

        <PropertyField
          id="mongoGridFSSourceFilter"
          name="filter"
          label="File Filter"
          tooltip="Query filter for matching GridFS files (e.g. JSON query matching filename or metadata). Maps to withFilter()."
          value={filter}
          onChange={handleChange}
          placeholder='e.g. {"filename": {"$regex": "^reports_.*\\.pdf$"}}'
          mono={true}
        />

        <PropertyField
          id="mongoGridFSSourceSkew"
          name="skew"
          label="Read Skew Tolerance (ms)"
          type="number"
          tooltip="Read skew tolerance duration in milliseconds. Guards against reading files actively written during the read window. Maps to withSkew()."
          value={skew}
          onChange={handleChange}
          placeholder="e.g. 60000"
          min={0}
        />
      </div>

      {/* Authentication */}
      <MongoDbGridFSSourceAuthSection
        authMode={authMode}
        usernameSecret={usernameSecret}
        passwordSecret={passwordSecret}
        secrets={secrets}
        secretError={secretError}
        onChange={handleChange}
      />

      {/* Collapsible Advanced Source Settings */}
      <MongoDbGridFSSourceAdvancedSection
        showAdvanced={showAdvanced}
        onToggle={() => setShowAdvanced(!showAdvanced)}
        sslEnabled={sslEnabled}
        sslInvalidHostNameAllowed={sslInvalidHostNameAllowed}
        ignoreSSLCertificate={ignoreSSLCertificate}
        maxConnectionIdleTime={maxConnectionIdleTime}
        onChange={handleChange}
      />

      <div className="flex-1 min-h-[16px]" />

      {/* Code Generation Instructions */}
      <PropertyField
        id="mongoGridFSSourceSystemInstructions"
        name="system_instructions"
        label="Code Generation Instructions"
        type="textarea"
        rows={4}
        value={systemInstructions}
        onChange={handleInstructionsChange}
        placeholder="Custom prompt instructions for generating the Apache Beam MongoDbGridFSIO source step..."
        tooltip="Optional custom prompt instructions injected into LLM code generation for this transform."
      />
    </div>
  );
};
