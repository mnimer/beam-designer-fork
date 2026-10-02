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
import { PropertyField } from '../../components/common/PropertyField';
import { SystemInstructionsField } from '../../components/common/SystemInstructionsField';
import { resolveSystemInstructions } from '../../utils/systemInstructions';
import { BigQuerySchemaEditor, type BigQueryField, jsonToFields, stringToFields } from './BigQuerySchemaEditor';
import { useAssetLoader } from '../../hooks/useAssetLoader';

/**
 * Props for the BigQuery sink property panel component.
 */
interface BigQuerySinkPropertiesProps {
  node: any;
  onChange: (properties: any) => void;
}

/**
 * BigQuerySinkProperties component.
 * Configures properties for Apache Beam BigQuery write sink nodes.
 */
export const BigQuerySinkProperties: React.FC<BigQuerySinkPropertiesProps> = ({ node, onChange }) => {
  const properties = node.data.properties || {};
  // Keep properties in a mutable ref updated on every render to avoid stale closure in the message listener
  const propertiesRef = React.useRef(properties);
  propertiesRef.current = properties;

  const dataset = properties.dataset || '';
  const table = properties.table || '';
  const createDisposition = properties.createDisposition || 'beam.io.BigQueryDisposition.CREATE_NEVER';
  const isCreateIfNeeded = createDisposition === 'beam.io.BigQueryDisposition.CREATE_IF_NEEDED';

  // Resolve schema fields from properties (support schemaFields array, schema JSON string, or schemaString)
  const schemaFields: BigQueryField[] = React.useMemo(() => {
    if (Array.isArray(properties.schemaFields)) {
      return properties.schemaFields;
    }
    if (typeof properties.schema === 'string' && properties.schema.trim()) {
      const parsed = jsonToFields(properties.schema);
      if (parsed) return parsed;
    }
    if (typeof properties.schemaString === 'string' && properties.schemaString.trim()) {
      return stringToFields(properties.schemaString);
    }
    return [];
  }, [properties.schemaFields, properties.schema, properties.schemaString]);

  const handleSchemaEditorChange = (data: {
    schemaFields: BigQueryField[];
    schema: string;
    schemaString: string;
  }) => {
    onChange({
      ...properties,
      schemaFields: data.schemaFields,
      schema: data.schema,
      schemaString: data.schemaString
    });
  };

  const { items: datasets, error: datasetError } = useAssetLoader<string>('datasets', {
    onLoaded: (_items, message) => {
      if (message?.projectId) {
        onChange({ ...propertiesRef.current, projectId: message.projectId });
      }
    }
  });
  const { items: tables, error: tableError } = useAssetLoader<string>('tables', {
    params: { dataset: properties.dataset }
  });

  const isTableInvalid = !table.trim();

  // System instructions text with fallback
  const systemInstructions = resolveSystemInstructions(node);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
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
        id="bigQuerySinkDataset"
        name="dataset"
        label="Dataset"
        tooltip="BigQuery dataset containing or targeted to contain the table."
        value={dataset}
        onChange={handleChange}
        placeholder="my_dataset"
        list="dataset-options"
        datalist={datasets}
        error={datasetError}
        mono={false}
      />

      {/* Table Input */}
      <PropertyField
        id="bigQuerySinkTable"
        name="table"
        label="Table"
        required={true}
        tooltip="Destination BigQuery table name or full spec (project:dataset.table). Required."
        value={table}
        invalid={isTableInvalid}
        error={tableError || (isTableInvalid ? 'Table is required.' : null)}
        onChange={handleChange}
        placeholder="my_table"
        list="table-options"
        datalist={tables}
        mono={false}
      />

      {/* Create Disposition */}
      <div className="flex flex-col gap-2">
        <label htmlFor="bigQuerySinkCreateDisposition" className="flex items-center text-xs font-bold uppercase text-slate-500">
          <span>Create Disposition</span>
          <InfoTooltip text="Specifies whether BigQuery should create the table if it does not exist (CREATE_IF_NEEDED) or fail if it does not exist (CREATE_NEVER)." />
        </label>
        <select 
          id="bigQuerySinkCreateDisposition"
          name="createDisposition" 
          value={createDisposition} 
          onChange={handleChange} 
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
        >
          <option value="beam.io.BigQueryDisposition.CREATE_NEVER">Create Never</option>
          <option value="beam.io.BigQueryDisposition.CREATE_IF_NEEDED">Create If Needed</option>
        </select>
      </div>

      {/* Schema Editor (shown only when CREATE_IF_NEEDED is selected) */}
      {isCreateIfNeeded && (
        <div className="p-3 bg-slate-800/40 rounded border border-purple-500/30 flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold uppercase text-slate-300">Table Schema</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-mono font-semibold">
                {schemaFields.length} {schemaFields.length === 1 ? 'FIELD' : 'FIELDS'}
              </span>
            </div>
            <InfoTooltip text="Define table schema columns and types required by Apache Beam when CREATE_IF_NEEDED creates a new table." />
          </div>
          <BigQuerySchemaEditor
            fields={schemaFields}
            onChange={handleSchemaEditorChange}
          />
        </div>
      )}

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
          <PropertyField
            id="bigQuerySinkTempLocation"
            name="custom_gcs_temp_location"
            label="Custom GCS Temp Location"
            tooltip="GCS bucket directory path used for staging temporary load files before importing into BigQuery."
            value={properties.custom_gcs_temp_location || ''}
            onChange={handleChange}
            placeholder="gs://my-bucket/bq-temp"
          />
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

      {/* Code Generation Instructions */}
      <SystemInstructionsField
        id="bigQuerySinkSystemInstructions"
        value={systemInstructions}
        placeholder="Enter custom instructions for BigQuery sink code generation..."
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
