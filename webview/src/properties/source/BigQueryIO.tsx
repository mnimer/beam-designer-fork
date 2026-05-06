import React from 'react';

/**
 * BigQuery Source Properties Component
 * 
 * This component renders the property panel for a BigQuery source node.
 * It allows users to configure the dataset and table for BigQuery.
 */
interface BigQuerySourcePropertiesProps {
  node: any;
  onChange: (properties: any) => void;
}

export const BigQuerySourceProperties: React.FC<BigQuerySourcePropertiesProps> = ({ node, onChange }) => {
  const properties = node.data.properties || {};
  const [datasets, setDatasets] = React.useState<string[]>([]);
  const [tables, setTables] = React.useState<string[]>([]);

  React.useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.command === 'datasetsLoaded') {
        setDatasets(message.datasets);
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
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
      
      {/* Divider */}
      <div className="border-t border-slate-700"></div>
      
      <div className="flex flex-col gap-2">
        <label className="text-xs font-bold uppercase text-slate-500">Table</label>
        <input 
          type="text" 
          name="table" 
          value={properties.table || ''} 
          onChange={handleChange} 
          placeholder="my-project:my_dataset.my_table" 
          list="table-options"
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm" 
        />
        <datalist id="table-options">
          {tables.map(t => (
            <option key={t} value={t} />
          ))}
        </datalist>
      </div>
      
      <div className="text-xs font-bold uppercase text-slate-500">OR</div>
      
      <div className="flex flex-col gap-2">
        <label className="text-xs font-bold uppercase text-slate-500">Query</label>
        <textarea 
          name="query" 
          value={properties.query || ''} 
          onChange={handleChange} 
          placeholder="SELECT * FROM `my-project.my_dataset.my_table`" 
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm h-24 resize-none" 
        />
      </div>
    </div>
  );
};
