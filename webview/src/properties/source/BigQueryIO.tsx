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

import React, { useState, useEffect } from 'react';
import { InfoTooltip } from '../../components/InfoTooltip';

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

export const BigQuerySourceProperties: React.FC<BigQuerySourcePropertiesProps> = ({ node, onChange }) => {
  const properties = node.data.properties || {};
  const [datasets, setDatasets] = useState<string[]>([]);
  const [tables, setTables] = useState<string[]>([]);

  // NOTE: Listen for datasets and tables loaded messages from extension host
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.command === 'datasetsLoaded') {
        setDatasets(message.datasets || []);
        if (message.projectId) {
          onChange({ ...properties, projectId: message.projectId });
        }
      } else if (message.command === 'tablesLoaded') {
        setTables(message.tables || []);
      }
    };
    window.addEventListener('message', handleMessage);
    
    const vscode = (window as any).vscode;
    if (vscode) {
      vscode.postMessage({ command: 'getDatasets' });
    }

    return () => window.removeEventListener('message', handleMessage);
  }, []);

  useEffect(() => {
    const vscode = (window as any).vscode;
    if (vscode && properties.dataset) {
      vscode.postMessage({ command: 'getTables', dataset: properties.dataset });
    }
  }, [properties.dataset]);

  const table = properties.table || '';
  const query = properties.query || '';

  // Validation: In Beam BigQuery source, either table or query is required
  const isInvalid = !table.trim() && !query.trim();

  // System instructions text with fallback
  const systemInstructions =
    node.data.system_instructions ??
    node.data.special_instructions ??
    properties.system_instructions ??
    properties.special_instructions ??
    '';

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === 'dataset') {
      onChange({ ...properties, [name]: value, table: '' });
    } else {
      onChange({ ...properties, [name]: value });
    }
  };

  const handleInstructionsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange({
      ...properties,
      system_instructions: e.target.value
    });
  };

  return (
    <div className="flex-1 flex flex-col gap-4">
      {/* Dataset Input */}
      <div className="flex flex-col gap-2">
        <label htmlFor="bqSourceDataset" className="flex items-center text-xs font-bold uppercase text-slate-500">
          <span>Dataset</span>
          <InfoTooltip text="BigQuery dataset name containing the source table (e.g. my_dataset)." />
        </label>
        <input 
          id="bqSourceDataset"
          type="text" 
          name="dataset" 
          value={properties.dataset || ''} 
          onChange={handleChange} 
          placeholder="my_dataset" 
          list="dataset-options"
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500 font-mono" 
        />
        <datalist id="dataset-options">
          {datasets.map(ds => (
            <option key={ds} value={ds} />
          ))}
        </datalist>
      </div>
      
      {/* Table Input */}
      <div className="flex flex-col gap-2">
        <label htmlFor="bqSourceTable" className="flex items-center text-xs font-bold uppercase text-slate-500">
          <span>Table</span>
          <span className="text-red-400 ml-1 font-bold" title="Either Table or Query is required">*</span>
          <InfoTooltip text="BigQuery table spec (e.g. my-project:my_dataset.my_table or my_table). Beam requires either a Table or a Query." />
        </label>
        <input 
          id="bqSourceTable"
          type="text" 
          name="table" 
          aria-required="true"
          aria-invalid={isInvalid}
          value={table} 
          onChange={handleChange} 
          placeholder="my-project:my_dataset.my_table" 
          list="table-options"
          className={`bg-[#252836] text-white p-2 rounded border text-sm focus:outline-none font-mono ${
            isInvalid
              ? 'border-red-500/80 focus:border-red-500'
              : 'border-slate-700 focus:border-blue-500'
          }`}
        />
        <datalist id="table-options">
          {tables.map(t => (
            <option key={t} value={t} />
          ))}
        </datalist>
      </div>
      
      <div className="flex items-center gap-2">
        <div className="flex-1 border-t border-slate-700/60" />
        <span className="text-xs font-bold uppercase text-slate-500">OR</span>
        <div className="flex-1 border-t border-slate-700/60" />
      </div>
      
      {/* Query Input */}
      <div className="flex flex-col gap-2">
        <label htmlFor="bqSourceQuery" className="flex items-center text-xs font-bold uppercase text-slate-500">
          <span>SQL Query</span>
          <span className="text-red-400 ml-1 font-bold" title="Either Table or Query is required">*</span>
          <InfoTooltip text="Standard SQL query string to execute against BigQuery (e.g. SELECT * FROM `my-project.my_dataset.my_table`). Beam requires either Table or Query." />
        </label>
        <textarea 
          id="bqSourceQuery"
          name="query" 
          aria-required="true"
          aria-invalid={isInvalid}
          value={query} 
          onChange={handleChange} 
          placeholder="SELECT * FROM `my-project.my_dataset.my_table`" 
          className={`bg-[#252836] text-white p-2 rounded border text-sm focus:outline-none font-mono h-24 resize-none ${
            isInvalid
              ? 'border-red-500/80 focus:border-red-500'
              : 'border-slate-700 focus:border-blue-500'
          }`}
        />
      </div>

      {/* Validation Warning */}
      {isInvalid && (
        <div className="p-2.5 rounded bg-red-500/10 border border-red-500/30 text-xs text-red-400">
          Either a Table or an SQL Query is required for BigQuery source.
        </div>
      )}

      {/* Flexible Spacer */}
      <div className="flex-1 min-h-4" />

      {/* Code Generation Instructions */}
      <div className="flex flex-col gap-2 pt-2 border-t border-slate-700/60">
        <label htmlFor="bqSourceSystemInstructions" className="text-xs font-bold uppercase text-slate-500">
          Code Generation Instructions
        </label>
        <textarea
          id="bqSourceSystemInstructions"
          name="system_instructions"
          value={systemInstructions}
          onChange={handleInstructionsChange}
          placeholder="Enter custom instructions for BigQuery source code generation..."
          rows={3}
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500 resize-y"
        />
      </div>
    </div>
  );
};
