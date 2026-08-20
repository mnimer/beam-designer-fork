/**
 * BigQuery Sink Properties Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Renders the property panel for Apache Beam BigQueryIO Write Sink nodes (BigQueryIO.write() / WriteToBigQuery).
 * 
 * Architectural Decisions:
 * - In Apache Beam, BigQuery write requires a destination table specification (table / dataset.table).
 * - Enforces required validation, visual error feedback, and aria attributes on table.
 * - Integrates InfoTooltip components explaining dispositions, write methods (Storage Write API vs File Loads vs Streaming), and retry strategies.
 * - Provides Code Generation Instructions textarea for custom LLM prompts.
 */

import React from 'react';
import { InfoTooltip } from '../../components/InfoTooltip';

interface BigQuerySinkPropertiesProps {
  node: any;
  onChange: (properties: any) => void;
}

export const BigQuerySinkProperties: React.FC<BigQuerySinkPropertiesProps> = ({ node, onChange }) => {
  const properties = node.data.properties || {};
  const dataset = properties.dataset || '';
  const table = properties.table || '';

  const [datasets, setDatasets] = React.useState<string[]>([]);
  const [tables, setTables] = React.useState<string[]>([]);

  const isTableInvalid = !table.trim();

  // System instructions text with fallback
  const systemInstructions =
    node.data.system_instructions ??
    node.data.special_instructions ??
    properties.system_instructions ??
    properties.special_instructions ??
    '';

  React.useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.command === 'datasetsLoaded') {
        setDatasets(message.datasets);
        if (message.projectId) {
          onChange({ ...properties, projectId: message.projectId });
        }
      } else if (message.command === 'tablesLoaded') {
        setTables(message.tables);
      }
    };
    window.addEventListener('message', handleMessage);

    const vscode = (window as any).vscode;
    if (vscode) {
      vscode.postMessage({ command: 'getDatasets' });
    }

    return () => window.removeEventListener('message', handleMessage);
  }, []);

  React.useEffect(() => {
    const vscode = (window as any).vscode;
    if (vscode && properties.dataset) {
      vscode.postMessage({ command: 'getTables', dataset: properties.dataset });
    }
  }, [properties.dataset]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
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
        <label htmlFor="bigQuerySinkDataset" className="flex items-center text-xs font-bold uppercase text-slate-500">
          <span>Dataset</span>
          <InfoTooltip text="BigQuery dataset containing or targeted to contain the table." />
        </label>
        <input
          id="bigQuerySinkDataset"
          type="text"
          name="dataset"
          value={dataset}
          onChange={handleChange}
          placeholder="my_dataset"
          list="dataset-options"
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
        />
        <datalist id="dataset-options">
          {datasets.map(ds => (
            <option key={ds} value={ds} />
          ))}
        </datalist>
      </div>

      {/* Table Input */}
      <div className="flex flex-col gap-2">
        <label htmlFor="bigQuerySinkTable" className="flex items-center text-xs font-bold uppercase text-slate-500">
          <span>Table</span>
          <span className="text-red-400 ml-1 font-bold" title="Required">*</span>
          <InfoTooltip text="Destination BigQuery table name or full spec (project:dataset.table). Required." />
        </label>
        <input 
          id="bigQuerySinkTable"
          type="text" 
          name="table" 
          aria-required="true"
          aria-invalid={isTableInvalid}
          value={table} 
          onChange={handleChange} 
          placeholder="my_table"
          list="table-options"
          className={`bg-[#252836] text-white p-2 rounded border text-sm focus:outline-none ${
            isTableInvalid
              ? 'border-red-500/80 focus:border-red-500'
              : 'border-slate-700 focus:border-blue-500'
          }`} 
        />
        <datalist id="table-options">
          {tables.map(t => (
            <option key={t} value={t} />
          ))}
        </datalist>
        {isTableInvalid && (
          <span className="text-xs text-red-400">Table is required.</span>
        )}
      </div>

      {/* Create Disposition */}
      <div className="flex flex-col gap-2">
        <label htmlFor="bigQuerySinkCreateDisposition" className="flex items-center text-xs font-bold uppercase text-slate-500">
          <span>Create Disposition</span>
          <InfoTooltip text="Specifies whether BigQuery should create the table if it does not exist (CREATE_IF_NEEDED) or fail if it does not exist (CREATE_NEVER)." />
        </label>
        <select 
          id="bigQuerySinkCreateDisposition"
          name="createDisposition" 
          value={properties.createDisposition || 'beam.io.BigQueryDisposition.CREATE_NEVER'} 
          onChange={handleChange} 
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
        >
          <option value="beam.io.BigQueryDisposition.CREATE_NEVER">Create Never</option>
          <option value="beam.io.BigQueryDisposition.CREATE_IF_NEEDED">Create If Needed</option>
        </select>
      </div>

      {/* Write Disposition */}
      <div className="flex flex-col gap-2">
        <label htmlFor="bigQuerySinkWriteDisposition" className="flex items-center text-xs font-bold uppercase text-slate-500">
          <span>Write Disposition</span>
          <InfoTooltip text="Controls write semantics: WRITE_APPEND (append rows), WRITE_TRUNCATE (overwrite table), or WRITE_EMPTY (fail if table contains data)." />
        </label>
        <select 
          id="bigQuerySinkWriteDisposition"
          name="writeDisposition" 
          value={properties.writeDisposition || 'beam.io.BigQueryDisposition.WRITE_APPEND'}
          onChange={handleChange} 
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
        >
          <option value="beam.io.BigQueryDisposition.WRITE_APPEND">Write Append</option>
          <option value="beam.io.BigQueryDisposition.WRITE_TRUNCATE">Write Truncate</option>
          <option value="beam.io.BigQueryDisposition.WRITE_EMPTY">Write Empty</option>
        </select>
      </div>

      {/* Write Method */}
      <div className="flex flex-col gap-2">
        <label htmlFor="bigQuerySinkMethod" className="flex items-center text-xs font-bold uppercase text-slate-500">
          <span>Write Method</span>
          <InfoTooltip text="Method for writing data to BigQuery: STORAGE_WRITE_API (recommended high-throughput), FILE_LOADS (batch GCS import), or STREAMING_INSERTS (legacy streaming)." />
        </label>
        <select
          id="bigQuerySinkMethod"
          name="method"
          value={properties.method || 'FILE_LOADS'}
          onChange={handleChange}
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
        >
          <option value="FILE_LOADS">File Loads</option>
          <option value="STORAGE_WRITE_API">Storage Write API</option>
          <option value="STREAMING_INSERTS">Streaming Api</option>
        </select>
      </div>

      {(properties.method === 'FILE_LOADS' || !properties.method) && (
        <>
          <div className="flex flex-col gap-2">
            <label htmlFor="bigQuerySinkTriggeringFreq" className="flex items-center text-xs font-bold uppercase text-slate-500">
              <span>Triggering Frequency</span>
              <InfoTooltip text="Determines how often load jobs are triggered in streaming pipelines (in minutes)." />
            </label>
            <div className="flex items-center gap-2">
              <input
                id="bigQuerySinkTriggeringFreq"
                type="text"
                name="triggering_frequency"
                value={properties.triggering_frequency || '5'}
                onChange={handleChange}
                maxLength={3}
                className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm w-[50px] focus:outline-none focus:border-blue-500"
              />
              <span className="text-sm text-slate-400">minutes</span>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="bigQuerySinkTempLocation" className="flex items-center text-xs font-bold uppercase text-slate-500">
              <span>Custom GCS Temp Location</span>
              <InfoTooltip text="GCS bucket directory path used for staging temporary load files before importing into BigQuery." />
            </label>
            <input
              id="bigQuerySinkTempLocation"
              type="text"
              name="custom_gcs_temp_location"
              value={properties.custom_gcs_temp_location || ''}
              onChange={handleChange}
              placeholder="gs://my-bucket/bq-temp"
              className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>
        </>
      )}

      {properties.method === 'STORAGE_WRITE_API' && (
        <>
          <div className="flex flex-col gap-2">
            <label htmlFor="bigQuerySinkStorageTriggeringFreq" className="flex items-center text-xs font-bold uppercase text-slate-500">
              <span>Triggering Frequency</span>
              <InfoTooltip text="Flush frequency for committing streams via BigQuery Storage Write API (in minutes)." />
            </label>
            <div className="flex items-center gap-2">
              <input
                id="bigQuerySinkStorageTriggeringFreq"
                type="text"
                name="triggering_frequency"
                value={properties.triggering_frequency || ''}
                onChange={handleChange}
                maxLength={3}
                className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm w-[50px] focus:outline-none focus:border-blue-500"
              />
              <span className="text-sm text-slate-400">minutes</span>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="bigQuerySinkStorageStreams" className="flex items-center text-xs font-bold uppercase text-slate-500">
              <span>Num Storage API Streams</span>
              <InfoTooltip text="Number of parallel write streams to allocate. Set to 0 to let Beam automatically scale stream count." />
            </label>
            <input
              id="bigQuerySinkStorageStreams"
              type="text"
              name="num_storage_api_streams"
              value={properties.num_storage_api_streams || '0'}
              onChange={handleChange}
              maxLength={3}
              className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm w-[50px] focus:outline-none focus:border-blue-500"
            />
            <span className="text-xs text-slate-400">When '0' Beam will manage automatically</span>
          </div>
        </>
      )}

      {properties.method === 'STREAMING_INSERTS' && (
        <>
          <div className="flex flex-col gap-2">
            <label htmlFor="bigQuerySinkRetryStrategy" className="flex items-center text-xs font-bold uppercase text-slate-500">
              <span>Insert Retry Strategy</span>
              <InfoTooltip text="Retry strategy on insert errors: RETRY_ON_TRANSIENT_ERROR (retry transient network/quota errors), RETRY_NEVER (route to dead-letter immediately), RETRY_ALWAYS (retry indefinitely)." />
            </label>
            <select
              id="bigQuerySinkRetryStrategy"
              name="insert_retry_strategy"
              value={properties.insert_retry_strategy || 'beam.io.WriteToBigQuery.RetryStrategy.RETRY_ON_TRANSIENT_ERROR'}
              onChange={handleChange}
              className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
            >
              <option value="beam.io.WriteToBigQuery.RetryStrategy.RETRY_ON_TRANSIENT_ERROR">Retry On Transient Error</option>
              <option value="beam.io.WriteToBigQuery.RetryStrategy.RETRY_NEVER">Retry Never</option>
              <option value="beam.io.WriteToBigQuery.RetryStrategy.RETRY_ALWAYS">Retry Always</option>
            </select>
          </div>
        </>
      )}

      {/* Flexible Spacer */}
      <div className="flex-1 min-h-4" />

      {/* Code Generation Instructions */}
      <div className="flex flex-col gap-2 pt-2 border-t border-slate-700/60">
        <label htmlFor="bigQuerySinkSystemInstructions" className="text-xs font-bold uppercase text-slate-500">
          Code Generation Instructions
        </label>
        <textarea
          id="bigQuerySinkSystemInstructions"
          name="system_instructions"
          value={systemInstructions}
          onChange={handleInstructionsChange}
          placeholder="Enter custom instructions for BigQuery sink code generation..."
          rows={3}
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500 resize-y"
        />
      </div>
    </div>
  );
};
