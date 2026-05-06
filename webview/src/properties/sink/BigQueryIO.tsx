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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    onChange({ ...properties, [e.target.name]: e.target.value });
  };

  return (
    <div className="flex flex-col gap-4">
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
      <div className="flex flex-col gap-2">
        <label className="text-xs font-bold uppercase text-slate-500">Create Disposition</label>
        <select 
          name="createDisposition" 
          value={properties.createDisposition || 'CREATE_NEVER'} 
          onChange={handleChange} 
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm"
        >
          <option>CREATE_IF_NEEDED</option>
          <option>CREATE_NEVER</option>
        </select>
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-xs font-bold uppercase text-slate-500">Write Disposition</label>
        <select 
          name="writeDisposition" 
          value={properties.writeDisposition || 'WRITE_APPEND'} 
          onChange={handleChange} 
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm"
        >
          <option>WRITE_APPEND</option>
          <option>WRITE_TRUNCATE</option>
          <option>WRITE_EMPTY</option>
        </select>
      </div>
    </div>
  );
};
