import React from 'react';

/**
 * BigQuery Properties Component
 * 
 * This component renders the property panel for a BigQuery node.
 * It allows users to configure the table, create disposition, and write disposition for BigQuery.
 * 
 * Architectural Decisions:
 * - Kept as a functional component.
 * - Uses standard input for table and selects for dispositions.
 */
interface BigQueryPropertiesProps {
  node: any;
  onChange: (properties: any) => void;
}

export const BigQueryProperties: React.FC<BigQueryPropertiesProps> = ({ node, onChange }) => {
  const properties = node.data.properties || {};

  // Handle input and select changes and propagate up
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    // NOTE: We are creating a new properties object to avoid direct mutation
    onChange({ ...properties, [e.target.name]: e.target.value });
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Table Input */}
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
      {/* Create Disposition Select */}
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
      {/* Write Disposition Select */}
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
