import React from 'react';

interface SlidingWindowsNode {
  data: {
    properties?: {
      size?: string;
      period?: string;
    };
  };
}

/**
 * SlidingWindows Properties Component
 * 
 * This component renders the property panel for a Sliding Windows node.
 * It allows users to configure the window size and slide period.
 */
interface SlidingWindowsPropertiesProps {
  node: SlidingWindowsNode;
  onChange: (properties: { size?: string; period?: string }) => void;
}

export const SlidingWindowsProperties: React.FC<SlidingWindowsPropertiesProps> = ({ node, onChange }) => {
  const properties = node.data.properties || {};

  // Handle input changes and propagate up
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...properties, [e.target.name]: e.target.value });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label className="text-xs font-bold uppercase text-slate-500">Window Size (seconds)</label>
        <span className="text-[10px] text-slate-400">The length of each window.</span>
        <input 
          type="text" 
          name="size" 
          value={properties.size !== undefined ? properties.size : '60'} 
          onChange={handleChange} 
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm" 
        />
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-xs font-bold uppercase text-slate-500">Sliding Period (seconds)</label>
        <span className="text-[10px] text-slate-400">How often a new window is created.</span>
        <input 
          type="text" 
          name="period" 
          value={properties.period !== undefined ? properties.period : '30'} 
          onChange={handleChange} 
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm" 
        />
      </div>
    </div>
  );
};
