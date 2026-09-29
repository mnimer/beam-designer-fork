/**
 * CosmosIOSourceProperties Component
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Renders the property configuration panel for Azure Cosmos DB Source nodes (CosmosIO.read(Class<T>)).
 *
 * Ground Truth Reference:
 * org.apache.beam.sdk.io.azure.cosmos.CosmosIO
 * - .read(Class<T> classType)
 * - .withDatabase(String database)
 * - .withContainer(String container)
 * - .withQuery(String query)
 * - .withCoder(Coder<T> coder)
 *
 * NOTE: Account endpoint and authentication keys are passed at runtime via PipelineOptions
 * (CosmosOptions: --serviceEndpoint and --key), not through transform builder methods.
 */

import React from 'react';
import { InfoTooltip } from '../../components/InfoTooltip';
import { PropertyField } from '../../components/common/PropertyField';

export interface CosmosIOSourcePropertiesProps {
  node: {
    data: {
      label?: string;
      beam_transform?: string;
      system_instructions?: string;
      special_instructions?: string;
      properties?: {
        database?: string;
        container?: string;
        query?: string;
        documentClass?: string;
        system_instructions?: string;
        special_instructions?: string;
        [key: string]: any;
      };
    };
  };
  onChange: (properties: any) => void;
}

export const CosmosIOSourceProperties: React.FC<CosmosIOSourcePropertiesProps> = ({ node, onChange }) => {
  const properties = node?.data?.properties || {};

  const database = properties.database || '';
  const container = properties.container || '';
  const query = properties.query || 'SELECT * FROM root';
  const documentClass = properties.documentClass || 'com.fasterxml.jackson.databind.node.ObjectNode';

  const instructions =
    properties.system_instructions ??
    properties.special_instructions ??
    node?.data?.system_instructions ??
    node?.data?.special_instructions ??
    '';

  const isDatabaseEmpty = !database.trim();
  const isContainerEmpty = !container.trim();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    onChange({
      ...properties,
      [name]: value
    });
  };

  return (
    <div className="flex-1 flex flex-col gap-4 text-[var(--vscode-text-primary)] text-sm">
      {/* Informational Callout */}
      <div className="p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)] flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--vscode-editorInfo-foreground)]">
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>CosmosIO.read()</span>
        </div>
        <p className="text-[11px] text-[var(--vscode-text-muted)] leading-relaxed">
          Reads documents from Azure Cosmos DB using native <code className="text-[10px] bg-[var(--vscode-badge-background)] px-1 rounded">CosmosIO.read(Class&lt;T&gt;)</code>.
          Endpoint URI and account authentication keys are supplied via <code className="text-[10px] bg-[var(--vscode-badge-background)] px-1 rounded">CosmosOptions</code> (<code className="text-[10px]">--serviceEndpoint</code> and <code className="text-[10px]">--key</code>) at pipeline execution time.
        </p>
      </div>

      {/* Target Container Section */}
      <div className="flex flex-col gap-3 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
        <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          <span>Target Cosmos Database & Container</span>
          <InfoTooltip text="Specify the Cosmos database and container to read from (.withDatabase(String), .withContainer(String))." />
        </label>

        <PropertyField
          id="cosmosSourceDatabase"
          name="database"
          label="Database"
          required="Database is required"
          tooltip="Cosmos DB database ID (.withDatabase(String)). Required."
          value={database}
          invalid={isDatabaseEmpty}
          error={isDatabaseEmpty ? 'Database is required' : null}
          placeholder="my-cosmos-database"
          onChange={handleInputChange}
          mono={true}
        />

        <PropertyField
          id="cosmosSourceContainer"
          name="container"
          label="Container / Collection"
          required="Container is required"
          tooltip="Cosmos DB container (collection) ID (.withContainer(String)). Required."
          value={container}
          invalid={isContainerEmpty}
          error={isContainerEmpty ? 'Container is required' : null}
          placeholder="my-container"
          onChange={handleInputChange}
          mono={true}
        />
      </div>

      {/* Query & Data Mapping Section */}
      <div className="flex flex-col gap-3 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
        <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          <span>Query & Serialization</span>
          <InfoTooltip text="Configures the SQL query filter and Java document serialization class." />
        </label>

        <PropertyField
          id="cosmosSourceQuery"
          name="query"
          label="SQL Query"
          type="textarea"
          rows={3}
          tooltip="Cosmos SQL query expression (.withQuery(String)). Defaults to 'SELECT * FROM root'."
          value={query}
          placeholder="SELECT * FROM root"
          onChange={handleInputChange}
          mono={true}
        />

        <PropertyField
          id="cosmosSourceDocClass"
          name="documentClass"
          label="Document Class"
          tooltip="POJO or Jackson ObjectNode class type passed to CosmosIO.read(Class<T>)."
          value={documentClass}
          placeholder="com.fasterxml.jackson.databind.node.ObjectNode"
          onChange={handleInputChange}
          mono={true}
        />
      </div>

      {/* System Instructions Section */}
      <div className="flex flex-col gap-3 p-3 bg-[var(--vscode-subcard-bg)] rounded-md border border-[var(--vscode-border-light)]">
        <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
          <span>Code Generation Instructions</span>
          <InfoTooltip text="System instructions passed to the Beam code generator." />
        </label>
        <PropertyField
          id="cosmosSourceInstructions"
          name="system_instructions"
          label="System Instructions"
          type="textarea"
          rows={3}
          tooltip="Prompt instructions specifying how CosmosIO.read(...) and CosmosOptions are synthesized."
          value={instructions}
          placeholder="e.g., Read from Azure Cosmos DB using CosmosIO.read(ObjectNode.class).withDatabase(...).withContainer(...)"
          onChange={handleInputChange}
          mono={true}
        />
      </div>
    </div>
  );
};
