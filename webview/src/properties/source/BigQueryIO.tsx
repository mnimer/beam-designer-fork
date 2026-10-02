/**
 * BigQuery Source Properties Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Renders the property configuration panel for BigQuery Source nodes in Apache Beam pipelines
 * (e.g. BigQueryIO.readTableRows() / BigQueryIO.read()).
 * 
 * Architectural Decisions:
 * - In Apache Beam, a BigQuery source requires EITHER a Table spec (.from(...)) OR an SQL Query (.fromQuery(...)).
 * - Flags validation error and applies red border highlighting when neither table nor query is specified.
 * - Integrates InfoTooltip components linking dataset, table, and query fields to Apache Beam documentation.
 * - Provides a flexible spacer and Code Generation Instructions textarea for custom LLM prompts.
 */

import React, { useRef } from 'react';
import { PropertyField } from '../../components/common/PropertyField';
import { SystemInstructionsField } from '../../components/common/SystemInstructionsField';
import { resolveSystemInstructions } from '../../utils/systemInstructions';
import { useAssetLoader } from '../../hooks/useAssetLoader';

/** Props for the {@link BigQuerySourceProperties} component. */
interface BigQuerySourcePropertiesProps {
  node: {
    data: {
      properties?: {
        dataset?: string;
        table?: string;
        query?: string;
        projectId?: string;
        system_instructions?: string;
        special_instructions?: string;
        [key: string]: any;
      };
      system_instructions?: string;
      special_instructions?: string;
    };
  };
  onChange: (properties: any) => void;
}

/**
 * BigQuerySourceProperties component.
 * Configures properties for Apache Beam BigQuery source nodes.
 */
export const BigQuerySourceProperties: React.FC<BigQuerySourcePropertiesProps> = ({ node, onChange }) => {
  const properties = node.data.properties || {};
  // Keep properties in a mutable ref updated on every render to avoid stale closure in the message listener
  const propertiesRef = useRef(properties);
  propertiesRef.current = properties;

  const { items: datasets, error: datasetError } = useAssetLoader<string>('datasets', {
    onLoaded: (_items, rawMessage) => {
      if (rawMessage?.projectId) {
        onChange({ ...propertiesRef.current, projectId: rawMessage.projectId });
      }
    }
  });

  const { items: tables, error: tableError } = useAssetLoader<string>('tables', {
    dataset: properties.dataset,
    enabled: Boolean(properties.dataset),
  });

  const table = properties.table || '';
  const query = properties.query || '';

  // Validation: In Beam BigQuery source, either table or query is required
  const isInvalid = !table.trim() && !query.trim();

  // System instructions text with fallback
  const systemInstructions = resolveSystemInstructions(node);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === 'dataset') {
      onChange({ ...properties, [name]: value, table: '' });
    } else {
      onChange({ ...properties, [name]: value });
    }
  };

  return (
    <div className="flex-1 flex flex-col gap-4">
      {/* Dataset Input */}
      <PropertyField
        id="bqSourceDataset"
        name="dataset"
        label="Dataset"
        tooltip="BigQuery dataset name containing the source table (e.g. my_dataset)."
        value={properties.dataset || ''}
        onChange={handleChange}
        placeholder="my_dataset"
        list="dataset-options"
        datalist={datasets}
        error={datasetError}
        mono={true}
      />

      {/* Table Input */}
      <PropertyField
        id="bqSourceTable"
        name="table"
        label="Table"
        required="Either Table or Query is required"
        tooltip="BigQuery table spec (e.g. my-project:my_dataset.my_table or my_table). Beam requires either a Table or a Query."
        value={table}
        invalid={isInvalid}
        onChange={handleChange}
        placeholder="my-project:my_dataset.my_table"
        list="table-options"
        datalist={tables}
        error={tableError}
        mono={true}
      />

      <div className="flex items-center gap-2">
        <div className="flex-1 border-t border-slate-700/60" />
        <span className="text-xs font-bold uppercase text-slate-500">OR</span>
        <div className="flex-1 border-t border-slate-700/60" />
      </div>

      {/* Query Input */}
      <PropertyField
        id="bqSourceQuery"
        name="query"
        label="SQL Query"
        type="textarea"
        required="Either Table or Query is required"
        tooltip="Standard SQL query string to execute against BigQuery (e.g. SELECT * FROM `my-project.my_dataset.my_table`). Beam requires either Table or Query."
        value={query}
        invalid={isInvalid}
        onChange={handleChange}
        placeholder="SELECT * FROM `my-project.my_dataset.my_table`"
        className="h-24 resize-none"
        mono={true}
      />

      {/* Validation Warning */}
      {isInvalid && (
        <div className="p-2.5 rounded bg-red-500/10 border border-red-500/30 text-xs text-red-400">
          Either a Table or an SQL Query is required for BigQuery source.
        </div>
      )}

      {/* Code Generation Instructions */}
      <SystemInstructionsField
        id="bqSourceSystemInstructions"
        value={systemInstructions}
        placeholder="Enter custom instructions for BigQuery source code generation..."
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
