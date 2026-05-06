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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...properties, [e.target.name]: e.target.value });
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
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm" 
        />
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-xs font-bold uppercase text-slate-500">Table</label>
        <input 
          type="text" 
          name="table" 
          value={properties.table || ''} 
          onChange={handleChange} 
          placeholder="my-project:my_dataset.my_table" 
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm" 
        />
      </div>
    </div>
  );
};
