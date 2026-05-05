import React from 'react';

/**
 * Windowing Properties Component
 * 
 * This component renders the property panel for a Windowing node.
 * It allows users to configure the window type and duration.
 * 
 * Architectural Decisions:
 * - Kept as a functional component.
 * - Uses select for window type and standard input for duration.
 */
interface WindowingPropertiesProps {
  node: any;
  onChange: (properties: any) => void;
}

export const WindowingProperties: React.FC<WindowingPropertiesProps> = ({ node, onChange }) => {
  const properties = node.data.properties || {};

  // Handle input and select changes and propagate up
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    // NOTE: We are creating a new properties object to avoid direct mutation
    onChange({ ...properties, [e.target.name]: e.target.value });
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Window Type Select */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-bold uppercase text-slate-500">Window Type</label>
        <select 
          name="windowType" 
          value={properties.windowType || 'Fixed Window'} 
          onChange={handleChange} 
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm"
        >
          <option>Fixed Window</option>
          <option>Sliding Window</option>
          <option>Session Window</option>
        </select>
      </div>
      {/* Duration Input */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-bold uppercase text-slate-500">Duration</label>
        <input 
          type="text" 
          name="duration" 
          value={properties.duration || '60'} 
          onChange={handleChange} 
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm" 
        />
      </div>
    </div>
  );
};
