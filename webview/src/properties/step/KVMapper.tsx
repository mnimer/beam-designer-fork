import React from 'react';

interface KVMapperNode {
  data: {
    properties?: {
      keyPropertyName?: string;
    };
  };
}

interface KVMapperPropertiesProps {
  node: KVMapperNode;
  onChange: (properties: any) => void;
}

export const KVMapperProperties: React.FC<KVMapperPropertiesProps> = ({ node, onChange }) => {
  const properties = node.data.properties || {};
  const keyPropertyName = properties.keyPropertyName || '';

  // Handle input change and propagate up
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...properties, [e.target.name]: e.target.value });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label className="text-xs font-bold uppercase text-slate-500">Key Property Name</label>
        <input 
          type="text" 
          name="keyPropertyName" 
          value={keyPropertyName} 
          onChange={handleChange} 
          placeholder="e.g. id"
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
        />
      </div>

      <div className="text-xs text-slate-400 mt-1 leading-relaxed bg-slate-800/40 p-2.5 rounded border border-slate-700/50">
        Extract a property from the element to act as the key, creating a key-value pair (KV element).
      </div>
    </div>
  );
};
