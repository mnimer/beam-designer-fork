import React from 'react';

interface FixedWindowsNode {
  data: {
    properties?: {
      duration?: string;
    };
  };
}

/**
 * FixedWindows Properties Component
 * 
 * This component renders the property panel for a Fixed Windows node.
 * It allows users to configure the duration of the fixed window.
 */
interface FixedWindowsPropertiesProps {
  node: FixedWindowsNode;
  onChange: (properties: { duration?: string }) => void;
}

export const FixedWindowsProperties: React.FC<FixedWindowsPropertiesProps> = ({ node, onChange }) => {
  const properties = node.data.properties || {};

  // Handle input changes and propagate up
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...properties, [e.target.name]: e.target.value });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label className="text-xs font-bold uppercase text-slate-500">Duration (seconds)</label>
        <span className="text-[10px] text-slate-400">The size of the window in seconds.</span>
        <input 
          type="text" 
          name="duration" 
          value={properties.duration !== undefined ? properties.duration : '60'} 
          onChange={handleChange} 
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm" 
        />
      </div>
    </div>
  );
};
