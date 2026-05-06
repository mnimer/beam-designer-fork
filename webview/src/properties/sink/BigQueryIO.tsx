import React from 'react';

/**
 * BigQuery Sink Properties Component
 * 
 * This component renders the property panel for a BigQuery sink node.
 * It allows users to configure the table, create disposition, and write disposition for BigQuery.
 */
interface BigQuerySinkPropertiesProps {
  node: any;
  onChange: (properties: any) => void;
}

export const BigQuerySinkProperties: React.FC<BigQuerySinkPropertiesProps> = ({ node, onChange }) => {
  const properties = node.data.properties || {};

  const [datasets, setDatasets] = React.useState<string[]>([]);
  const [tables, setTables] = React.useState<string[]>([]);

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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label className="text-xs font-bold uppercase text-slate-500">Dataset</label>
        <input
          type="text"
          name="dataset"
          value={properties.dataset || ''}
          onChange={handleChange}
          placeholder="my_dataset"
          list="dataset-options"
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm"
        />
        <datalist id="dataset-options">
          {datasets.map(ds => (
            <option key={ds} value={ds} />
          ))}
        </datalist>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-xs font-bold uppercase text-slate-500">Table</label>
        <input 
          type="text" 
          name="table" 
          value={properties.table || ''} 
          onChange={handleChange} 
          placeholder="my_table"
          list="table-options"
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm" 
        />
        <datalist id="table-options">
          {tables.map(t => (
            <option key={t} value={t} />
          ))}
        </datalist>
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-xs font-bold uppercase text-slate-500">Create Disposition</label>
        <select 
          name="createDisposition" 
          value={properties.createDisposition || 'beam.io.BigQueryDisposition.CREATE_NEVER'} 
          onChange={handleChange} 
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm"
        >
          <option value="beam.io.BigQueryDisposition.CREATE_NEVER">Create Never</option>
          <option value="beam.io.BigQueryDisposition.CREATE_IF_NEEDED">Create If Needed</option>
        </select>
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-xs font-bold uppercase text-slate-500">Write Disposition</label>
        <select 
          name="writeDisposition" 
          value={properties.writeDisposition || 'beam.io.BigQueryDisposition.WRITE_APPEND'}
          onChange={handleChange}
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm"
        >
          <option value="beam.io.BigQueryDisposition.WRITE_APPEND">Write Append</option>
          <option value="beam.io.BigQueryDisposition.WRITE_TRUNCATE">Write Truncate</option>
          <option value="beam.io.BigQueryDisposition.WRITE_EMPTY">Write Empty</option>
        </select>
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-xs font-bold uppercase text-slate-500">Write Method</label>
        <select
          name="method"
          value={properties.method || 'FILE_LOADS'}
          onChange={handleChange}
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm"
        >
          <option value="FILE_LOADS">File Loads</option>
          <option value="STORAGE_WRITE_API">Storage Write API</option>
          <option value="STREAMING_INSERTS">Streaming Api</option>
        </select>
      </div>

      {(properties.method === 'FILE_LOADS' || !properties.method) && (
        <>
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold uppercase text-slate-500">Triggering Frequency</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                name="triggering_frequency"
                value={properties.triggering_frequency || '5'}
                onChange={handleChange}
                maxLength={3}
                className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm w-[50px]"
              />
              <span className="text-sm text-slate-400">minutes</span>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold uppercase text-slate-500">Custom GCS Temp Location</label>
            <input type="text" name="custom_gcs_temp_location" value={properties.custom_gcs_temp_location || ''} onChange={handleChange} className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm" />
          </div>
        </>
      )}

      {properties.method === 'STORAGE_WRITE_API' && (
        <>
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold uppercase text-slate-500">Triggering Frequency</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                name="triggering_frequency"
                value={properties.triggering_frequency || ''}
                onChange={handleChange}
                maxLength={3}
                className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm w-[50px]"
              />
              <span className="text-sm text-slate-400">minutes</span>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold uppercase text-slate-500">Num Storage API Streams</label>
            <input type="text" name="num_storage_api_streams" value={properties.num_storage_api_streams || '0'} onChange={handleChange} maxLength={3} className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm w-[50px]" />
            <span className="text-xs text-slate-600">When '0' Beam will manage automatically</span>
          </div>
        </>
      )}

      {properties.method === 'STREAMING_INSERTS' && (
        <>
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold uppercase text-slate-500">Insert Retry Strategy</label>
            <select
              name="insert_retry_strategy"
              value={properties.insert_retry_strategy || 'beam.io.WriteToBigQuery.RetryStrategy.RETRY_ON_TRANSIENT_ERROR'}
              onChange={handleChange}
              className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm"
            >
              <option value="beam.io.WriteToBigQuery.RetryStrategy.RETRY_ON_TRANSIENT_ERROR">Retry On Transient Error</option>
              <option value="beam.io.WriteToBigQuery.RetryStrategy.RETRY_NEVER">Retry Never</option>
              <option value="beam.io.WriteToBigQuery.RetryStrategy.RETRY_ALWAYS">Retry Always</option>
            </select>
          </div>
        </>
      )}
    </div>
  );
};
