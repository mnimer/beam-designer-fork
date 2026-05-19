import React from 'react';

interface UserWindowsNode {
  data: {
    properties?: {
      windowFn?: string;
    };
  };
}

/**
 * UserWindows Properties Component
 * 
 * This component renders the property panel for a User Windows node.
 * It allows users to configure a custom window function.
 */
interface UserWindowsPropertiesProps {
  node: UserWindowsNode;
  onChange: (properties: { windowFn?: string }) => void;
}

export const UserWindowsProperties: React.FC<UserWindowsPropertiesProps> = ({ node, onChange }) => {
  const properties = node.data.properties || {};

  // Handle input changes and propagate up
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...properties, [e.target.name]: e.target.value });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label className="text-xs font-bold uppercase text-slate-500">Window Function</label>
        <span className="text-[10px] text-slate-400">Any valid Apache Beam WindowFn expression (e.g., beam.window.GlobalWindows()).</span>
        <input 
          type="text" 
          name="windowFn" 
          value={properties.windowFn !== undefined ? properties.windowFn : 'beam.window.GlobalWindows()'} 
          onChange={handleChange} 
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm" 
        />
      </div>
    </div>
  );
};
