/**
 * SolrIOSourceProperties Component
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Renders the property configuration panel for Apache Beam SolrIO Read Source nodes
 * (org.apache.beam.sdk.io.solr.SolrIO.read() in Java / cross-language expansion service in Python).
 * Configures SolrCloud ZooKeeper ensemble connection, target collection, search query string (withQuery),
 * batch retrieval size (withBatchSize), field list projection (withFields), filter queries (withFilters),
 * authentication (None vs Basic Auth via GCP Secret Manager), and network timeouts.
 *
 * Architectural Decisions:
 * - Real-time validation: Requires ZooKeeper Host and Collection name with instant validation cues and ARIA flags.
 * - SolrCloud ZK ensemble validation: Displays a helpful warning when an HTTP/HTTPS scheme is entered instead of a ZK host string.
 * - Connection configuration mapping: Models SolrIO.ConnectionConfiguration.create(zkHost).withBasicCredentials(...)
 *   passed to SolrIO.read().withConnectionConfiguration(...).
 * - Dynamic discovery: Requests GCP Secret Manager secrets via 'getSecrets' IPC message to populate
 *   the 'solr-source-secret-options' datalist for secure credential binding.
 * - Decomposed into local presentational sub-components adhering to "props in, events up" with semantic callbacks (onToggle).
 * - Preserves system_instructions / special_instructions for LLM code generation.
 * - Strictly follows the 8pt grid system and Tailwind CSS styling using VS Code theme tokens.
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

export type SolrAuthMode = 'none' | 'basic_secret_manager';

export interface SolrIOSourcePropertiesProps {
  node: {
    data: {
      label?: string;
      beam_transform?: string;
      system_instructions?: string;
      special_instructions?: string;
      properties?: {
        zkHost?: string;
        collection?: string;
        query?: string;
        batchSize?: number | string;
        fields?: string;
        filters?: string;
        authMode?: SolrAuthMode | string;
        usernameSecret?: string;
        passwordSecret?: string;
        connectTimeout?: number | string;
        socketTimeout?: number | string;
        system_instructions?: string;
        special_instructions?: string;
        [key: string]: any;
      };
    };
  };
  onChange: (properties: any) => void;
}

interface SourceTargetSectionProps {
  zkHost: string;
  collection: string;
  isZkHostEmpty: boolean;
  isCollectionEmpty: boolean;
  hasHttpWarning: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
}

/**
 * Presentational component for SolrCloud ZooKeeper host and target collection.
 */
const SourceTargetSection: React.FC<SourceTargetSectionProps> = ({
  zkHost,
  collection,
  isZkHostEmpty,
  isCollectionEmpty,
  hasHttpWarning,
  onChange,
}) => {
  return (
    <div className="flex flex-col gap-2 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
      <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
        <span>SolrCloud & Collection</span>
        <InfoTooltip text="Configures SolrCloud ZooKeeper ensemble connect string and target collection for SolrIO.read()." />
      </label>

      <PropertyField
        id="solr-source-zk-host"
        name="zkHost"
        label="ZooKeeper Host (SolrCloud)"
        tooltip="ZooKeeper ensemble connect string including chroot (e.g. zk1:2181,zk2:2181/solr). SolrIO connects via ZooKeeper, not an HTTP URL."
        value={zkHost}
        onChange={onChange}
        placeholder="zk1:2181,zk2:2181/solr"
        required="ZooKeeper Host is required"
        invalid={isZkHostEmpty}
        error={isZkHostEmpty ? 'ZooKeeper Host is required' : null}
        helperText={
          <span>
            Connects to SolrCloud via ZooKeeper ensemble string (e.g.{' '}
            <code className="text-slate-300 bg-slate-800/60 px-1 py-0.5 rounded">zk1:2181,zk2:2181/solr</code>).
          </span>
        }
      />
      {hasHttpWarning && (
        <span className="text-xs text-amber-400" role="alert">
          Warning: SolrIO connects via SolrCloud ZooKeeper ensemble string (e.g. &quot;zk1:2181,zk2:2181/solr&quot;), not an HTTP URL.
        </span>
      )}

      <PropertyField
        id="solr-source-collection"
        name="collection"
        label="Collection"
        tooltip="Solr collection name to read documents from (maps to SolrIO.read().from(collection))."
        value={collection}
        onChange={onChange}
        placeholder="e.g. products"
        required="Collection name is required"
        invalid={isCollectionEmpty}
        error={isCollectionEmpty ? 'Collection name is required' : null}
      />
    </div>
  );
};

interface SourceQuerySectionProps {
  query: string;
  batchSize: number | string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
}

/**
 * Presentational component for Solr query string and batch pagination size.
 */
const SourceQuerySection: React.FC<SourceQuerySectionProps> = ({
  query,
  batchSize,
  onChange,
}) => {
  return (
    <div className="flex flex-col gap-2 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
      <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
        <span>Query & Pagination</span>
        <InfoTooltip text="Configures Solr query string (withQuery) and batch document retrieval size." />
      </label>

      <PropertyField
        id="solr-source-query"
        name="query"
        label="Query String"
        tooltip="Solr query string passed to SolrIO.Read.withQuery(). Defaults to *:*."
        value={query}
        onChange={onChange}
        placeholder="*:*"
      />

      <PropertyField
        id="solr-source-batch-size"
        name="batchSize"
        label="Batch Size"
        type="number"
        min={1}
        tooltip="Number of documents to retrieve per batch request (Solr cursor pagination hint)."
        value={batchSize}
        onChange={onChange}
        placeholder="1000"
      />
    </div>
  );
};

interface SourceAuthSectionProps {
  authMode: SolrAuthMode;
  usernameSecret: string;
  passwordSecret: string;
  secrets: SecretItem[];
  secretError: string | null;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}

/**
 * Presentational component for Authentication credentials.
 */
const SourceAuthSection: React.FC<SourceAuthSectionProps> = ({
  authMode,
  usernameSecret,
  passwordSecret,
  secrets,
  secretError,
  onChange,
}) => {
  return (
    <div className="flex flex-col gap-2 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
      <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
        <span>Authentication & Security</span>
        <InfoTooltip text="Configures SolrCloud authentication: None (anonymous) or Basic Authentication via GCP Secret Manager." />
      </label>

      <div className="flex flex-col gap-2">
        <label htmlFor="solr-source-auth-mode" className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          <span>Auth Mode</span>
          <InfoTooltip text="Select authentication method for SolrCloud cluster." />
        </label>
        <select
          id="solr-source-auth-mode"
          name="authMode"
          value={authMode}
          onChange={onChange}
          className="bg-[var(--vscode-input-bg)] text-[var(--vscode-text-primary)] p-2 rounded border border-[var(--vscode-border)] text-xs focus:outline-none focus:border-[var(--vscode-highlight)]"
        >
          <option value="none">None / Anonymous</option>
          <option value="basic_secret_manager">Basic Auth (Secret Manager)</option>
        </select>
      </div>

      {authMode === 'basic_secret_manager' && (
        <div className="grid grid-cols-2 gap-2">
          <PropertyField
            id="solr-source-username-secret"
            name="usernameSecret"
            label="Username Secret"
            tooltip="GCP Secret Manager secret ID containing the Solr username (maps to withBasicCredentials)."
            value={usernameSecret}
            onChange={onChange}
            placeholder="e.g. solr-username-secret"
            list="solr-source-secret-options"
            datalist={secrets.map((s) => ({ value: s.id || s.name, label: s.name || s.id }))}
          />
          <PropertyField
            id="solr-source-password-secret"
            name="passwordSecret"
            label="Password Secret"
            tooltip="GCP Secret Manager secret ID containing the Solr password (maps to withBasicCredentials)."
            value={passwordSecret}
            onChange={onChange}
            placeholder="e.g. solr-password-secret"
            list="solr-source-secret-options"
            datalist={secrets.map((s) => ({ value: s.id || s.name, label: s.name || s.id }))}
          />
        </div>
      )}

      {secretError && (
        <span className="text-xs text-red-400 mt-1" role="alert">
          {secretError}
        </span>
      )}
    </div>
  );
};

interface SourceAdvancedSectionProps {
  showAdvanced: boolean;
  onToggle: () => void;
  fields: string;
  filters: string;
  connectTimeout: number | string;
  socketTimeout: number | string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
}

/**
 * Presentational component for collapsible Advanced Source Settings.
 */
const SourceAdvancedSection: React.FC<SourceAdvancedSectionProps> = ({
  showAdvanced,
  onToggle,
  fields,
  filters,
  connectTimeout,
  socketTimeout,
  onChange,
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
          <PropertyField
            id="solr-source-fields"
            name="fields"
            label="Field List Projection (fl)"
            tooltip="Comma-separated list of document fields to return (fl query parameter)."
            value={fields}
            onChange={onChange}
            placeholder="e.g. id,name,category,price"
          />

          <PropertyField
            id="solr-source-filters"
            name="filters"
            label="Filter Queries (fq)"
            tooltip="Comma-separated filter query strings (fq query parameter)."
            value={filters}
            onChange={onChange}
            placeholder="e.g. inStock:true,price:[10 TO 100]"
          />

          <div className="grid grid-cols-2 gap-2">
            <PropertyField
              id="solr-source-connect-timeout"
              name="connectTimeout"
              label="Connect Timeout (ms)"
              type="number"
              min={0}
              tooltip="Solr client connection timeout in milliseconds."
              value={connectTimeout}
              onChange={onChange}
              placeholder="15000"
            />
            <PropertyField
              id="solr-source-socket-timeout"
              name="socketTimeout"
              label="Socket Timeout (ms)"
              type="number"
              min={0}
              tooltip="Solr client socket timeout in milliseconds."
              value={socketTimeout}
              onChange={onChange}
              placeholder="30000"
            />
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * SolrIOSourceProperties renders the configuration form for SolrIO.read().
 *
 * @param props Component properties containing the active node and onChange callback
 */
export const SolrIOSourceProperties: React.FC<SolrIOSourcePropertiesProps> = ({ node, onChange }) => {
  const properties = node?.data?.properties || {};

  // Form field state extracted from node properties
  const zkHost = properties.zkHost || '';
  const collection = properties.collection || '';
  const query = properties.query || '';
  const batchSize = properties.batchSize ?? '';

  const fields = properties.fields || '';
  const filters = properties.filters || '';

  const authMode: SolrAuthMode = (properties.authMode as SolrAuthMode) || 'none';
  const usernameSecret = properties.usernameSecret || '';
  const passwordSecret = properties.passwordSecret || '';

  const connectTimeout = properties.connectTimeout ?? '';
  const socketTimeout = properties.socketTimeout ?? '';

  // Local UI state
  const { items: rawSecrets, error: secretError } = useAssetLoader<SecretItem | string>('secrets');
  const secrets: SecretItem[] = (rawSecrets || []).map(normalizeSecretItem);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Field validation: ZooKeeper Host and Collection are required
  const isZkHostEmpty = !zkHost.trim();
  const isCollectionEmpty = !collection.trim();

  // SolrCloud ZooKeeper format warning: warn if HTTP/HTTPS URL scheme was entered
  const hasHttpWarning =
    zkHost.trim().length > 0 &&
    (zkHost.trim().toLowerCase().startsWith('http://') || zkHost.trim().toLowerCase().startsWith('https://'));

  // Fallback chain for system instructions
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
   * Handles text, select, and textarea input changes.
   *
   * @param e Standard React change event
   */
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type: elemType } = e.target;
    if (elemType === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      updateProperty(name, checked);
    } else {
      updateProperty(name, value);
    }
  };

  /**
   * Handles system instructions textarea modifications.
   *
   * @param e React textarea change event
   */
  const handleInstructionsChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    onChange({
      ...properties,
      system_instructions: e.target.value,
    });
  };

  return (
    <div className="flex-1 flex flex-col gap-4 text-[var(--vscode-text-primary)] text-sm">
      {/* SolrCloud ZK Host & Target Collection */}
      <SourceTargetSection
        zkHost={zkHost}
        collection={collection}
        isZkHostEmpty={isZkHostEmpty}
        isCollectionEmpty={isCollectionEmpty}
        hasHttpWarning={hasHttpWarning}
        onChange={handleChange}
      />

      {/* Query & Pagination */}
      <SourceQuerySection
        query={query}
        batchSize={batchSize}
        onChange={handleChange}
      />

      {/* Authentication & Security */}
      <SourceAuthSection
        authMode={authMode}
        usernameSecret={usernameSecret}
        passwordSecret={passwordSecret}
        secrets={secrets}
        secretError={secretError}
        onChange={handleChange}
      />

      {/* Collapsible Advanced Source Settings */}
      <SourceAdvancedSection
        showAdvanced={showAdvanced}
        onToggle={() => setShowAdvanced(!showAdvanced)}
        fields={fields}
        filters={filters}
        connectTimeout={connectTimeout}
        socketTimeout={socketTimeout}
        onChange={handleChange}
      />

      {/* Spacer before Instructions textarea */}
      <div className="flex-1 min-h-[16px]" />

      {/* Code Generation Instructions Textarea */}
      <PropertyField
        id="solr-source-instructions"
        name="system_instructions"
        label="Code Generation Instructions"
        tooltip="Custom system instructions passed to the LLM when generating code for this Solr source transform."
        type="textarea"
        rows={4}
        mono={false}
        value={systemInstructions}
        onChange={handleInstructionsChange}
        placeholder="e.g. SolrIO.read().withConnectionConfiguration(SolrIO.ConnectionConfiguration.create('zk1:2181,zk2:2181/solr')).from('products').withQuery('*:*')"
      />
    </div>
  );
};
