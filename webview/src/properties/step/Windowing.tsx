import React from 'react';

interface WindowingNode {
  data: {
    properties?: {
      windowType?: 'Fixed Window' | 'Sliding Window' | 'User Window';
      fixedDuration?: string;
      fixedDurationUnit?: 'Seconds' | 'Minutes' | 'Hours';
      slidingDuration?: string;
      slidingDurationUnit?: 'Seconds' | 'Minutes' | 'Hours';
      slidingPeriod?: string;
      slidingPeriodUnit?: 'Seconds' | 'Minutes' | 'Hours';
      slidingOffset?: string;
      slidingOffsetUnit?: 'Seconds' | 'Minutes' | 'Hours';
      sessionGapDuration?: string;
      sessionGapDurationUnit?: 'Seconds' | 'Minutes' | 'Hours';
    };
  };
}

/**
 * Windowing Properties Component
 * 
 * This component renders the property panel for the unified Window step.
 * It allows users to choose between Fixed Window, Sliding Window, and User Window,
 * and configures details like Durations, Periods, Offsets, and Gap Durations with unit selectors.
 */
interface WindowingPropertiesProps {
  node: WindowingNode;
  onChange: (properties: any) => void;
}

export const WindowingProperties: React.FC<WindowingPropertiesProps> = ({ node, onChange }) => {
  const properties = node.data.properties || {};
  const windowType = properties.windowType || 'Fixed Window';

  // Handle input and select changes and propagate up
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    onChange({ ...properties, [e.target.name]: e.target.value });
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Window Type Select */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-bold uppercase text-slate-500">Window Type</label>
        <select 
          name="windowType" 
          value={windowType} 
          onChange={handleChange} 
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
        >
          <option value="Fixed Window">Fixed Window</option>
          <option value="Sliding Window">Sliding Window</option>
          <option value="User Window">User Window</option>
        </select>
      </div>

      {/* Fixed Window Form */}
      {windowType === 'Fixed Window' && (
        <div className="flex flex-col gap-4 border-t border-slate-700/50 pt-3">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold uppercase text-slate-500">Duration</label>
            <div className="flex gap-2">
              <input 
                type="number" 
                name="fixedDuration" 
                value={properties.fixedDuration !== undefined ? properties.fixedDuration : '60'} 
                onChange={handleChange} 
                placeholder="60"
                className="flex-1 bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
              />
              <select
                name="fixedDurationUnit"
                value={properties.fixedDurationUnit || 'Seconds'}
                onChange={handleChange}
                className="w-32 bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="Seconds">Seconds</option>
                <option value="Minutes">Minutes</option>
                <option value="Hours">Hours</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Sliding Window Form */}
      {windowType === 'Sliding Window' && (
        <div className="flex flex-col gap-4 border-t border-slate-700/50 pt-3">
          {/* Sliding Duration */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold uppercase text-slate-500">Duration</label>
            <div className="flex gap-2">
              <input 
                type="number" 
                name="slidingDuration" 
                value={properties.slidingDuration !== undefined ? properties.slidingDuration : '600'} 
                onChange={handleChange} 
                placeholder="600"
                className="flex-1 bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
              />
              <select
                name="slidingDurationUnit"
                value={properties.slidingDurationUnit || 'Seconds'}
                onChange={handleChange}
                className="w-32 bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="Seconds">Seconds</option>
                <option value="Minutes">Minutes</option>
                <option value="Hours">Hours</option>
              </select>
            </div>
          </div>

          {/* Sliding Period */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold uppercase text-slate-500">Period</label>
            <div className="flex gap-2">
              <input 
                type="number" 
                name="slidingPeriod" 
                value={properties.slidingPeriod !== undefined ? properties.slidingPeriod : '300'} 
                onChange={handleChange} 
                placeholder="300"
                className="flex-1 bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
              />
              <select
                name="slidingPeriodUnit"
                value={properties.slidingPeriodUnit || 'Seconds'}
                onChange={handleChange}
                className="w-32 bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="Seconds">Seconds</option>
                <option value="Minutes">Minutes</option>
                <option value="Hours">Hours</option>
              </select>
            </div>
          </div>

          {/* Sliding Offset */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold uppercase text-slate-500">Offset</label>
            <div className="flex gap-2">
              <input 
                type="number" 
                name="slidingOffset" 
                value={properties.slidingOffset !== undefined ? properties.slidingOffset : '60'} 
                onChange={handleChange} 
                placeholder="60"
                className="flex-1 bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
              />
              <select
                name="slidingOffsetUnit"
                value={properties.slidingOffsetUnit || 'Seconds'}
                onChange={handleChange}
                className="w-32 bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="Seconds">Seconds</option>
                <option value="Minutes">Minutes</option>
                <option value="Hours">Hours</option>
              </select>
            </div>
          </div>

          {/* Sliding Description */}
          <span className="text-xs text-slate-400 mt-1 leading-relaxed">
            Example of a 10-minute window that calculates statistics every 5 minutes. However, you want the windows to align perfectly with a 1-minute offset
          </span>
        </div>
      )}

      {/* User Window / Session Window Form */}
      {windowType === 'User Window' && (
        <div className="flex flex-col gap-4 border-t border-slate-700/50 pt-3">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold uppercase text-slate-500">Gap Duration</label>
            <div className="flex gap-2">
              <input 
                type="number" 
                name="sessionGapDuration" 
                value={properties.sessionGapDuration !== undefined ? properties.sessionGapDuration : '30'} 
                onChange={handleChange} 
                placeholder="30"
                className="flex-1 bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
              />
              <select
                name="sessionGapDurationUnit"
                value={properties.sessionGapDurationUnit || 'Minutes'}
                onChange={handleChange}
                className="w-32 bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="Seconds">Seconds</option>
                <option value="Minutes">Minutes</option>
                <option value="Hours">Hours</option>
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
