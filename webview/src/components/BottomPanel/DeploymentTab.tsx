import React from 'react';
import { Trash2 } from 'lucide-react';

/**
 * DeploymentTab Component
 * 
 * This component renders the content for the DEPLOYMENT tab in the bottom panel.
 * It includes configuration for the runner, machine type, instances, and runtime variables.
 * 
 * Architectural Decisions:
 * - Split into columns for better layout.
 * - Uses a table for runtime variables.
 */
interface DeploymentTabProps {
  jobConfig: {
    runner: string;
    machineType: string;
    minInstances: number;
    maxInstances: number;
  };
  setJobConfig: (config: any) => void;
  runtimeVariables: { key: string, value: string }[];
  addVariable: () => void;
  updateVariable: (index: number, field: 'key' | 'value', value: string) => void;
  deleteVariable: (index: number) => void;
  isJobIdValid: (value: string) => boolean;
  onRunNow: () => void;
}

export const DeploymentTab: React.FC<DeploymentTabProps> = ({
  jobConfig,
  setJobConfig,
  runtimeVariables,
  addVariable,
  updateVariable,
  deleteVariable,
  isJobIdValid,
  onRunNow
}) => {
  return (
    <div className="flex gap-6 h-full">
      {/* Left Side: Form (2/3 width) */}
      <div className="w-2/3 flex gap-6">
        {/* Column 1 */}
        <div className="flex-1 flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold uppercase text-slate-500">Runner</label>
            <select 
              value={jobConfig.runner} 
              onChange={(e) => setJobConfig({...jobConfig, runner: e.target.value})}
              className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm"
            >
              <option>DirectRunner</option>
              <option>Dataflow</option>
              <option>Spark</option>
            </select>
          </div>
          <div className="flex flex-col gap-2 w-full items-center">
            <button 
              onClick={onRunNow}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-bold w-3/5"
            >
              RUN NOW
            </button>
            <button 
              className={`bg-slate-700 text-white px-4 py-2 rounded text-sm font-bold w-3/5 ${jobConfig.runner === 'DirectRunner' || jobConfig.runner === 'Spark' ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-600'}`}
              disabled={jobConfig.runner === 'DirectRunner' || jobConfig.runner === 'Spark'}
            >
              SCHEDULE
            </button>
          </div>
        </div>

        {/* Column 2 */}
        <div className="flex-1 flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold uppercase text-slate-500">Machine Type</label>
            <select 
              value={jobConfig.machineType} 
              onChange={(e) => setJobConfig({...jobConfig, machineType: e.target.value})}
              className={`bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm ${jobConfig.runner === 'DirectRunner' || jobConfig.runner === 'Spark' ? 'opacity-50 cursor-not-allowed' : ''}`}
              disabled={jobConfig.runner === 'DirectRunner' || jobConfig.runner === 'Spark'}
            >
              <option>n1-standard-1</option>
              <option>n1-standard-2</option>
              <option>n1-standard-4</option>
            </select>
          </div>
          <div className="flex gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold uppercase text-slate-500">Min</label>
              <input 
                type="number" 
                min={0} 
                max={999} 
                value={jobConfig.minInstances} 
                onChange={(e) => setJobConfig({...jobConfig, minInstances: parseInt(e.target.value, 10) || 0})}
                className={`bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm w-[100px] ${jobConfig.runner === 'DirectRunner' ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={jobConfig.runner === 'DirectRunner'}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold uppercase text-slate-500">Max</label>
              <input 
                type="number" 
                min={0} 
                max={999} 
                value={jobConfig.maxInstances} 
                onChange={(e) => setJobConfig({...jobConfig, maxInstances: parseInt(e.target.value, 10) || 0})}
                className={`bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm w-[100px] ${jobConfig.runner === 'DirectRunner' ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={jobConfig.runner === 'DirectRunner'}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Right Side: Runtime Variables (1/3 width) */}
      <div className="w-1/3 flex flex-col">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs font-bold uppercase text-slate-500">Runtime Variables</span>
          <button onClick={addVariable} className="text-blue-500 text-xs font-bold">+ Add</button>
        </div>
        <div className="bg-[#252836] rounded border border-slate-700 flex-1 overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-800 text-slate-400 text-xs uppercase">
              <tr>
                <th className="text-left p-2">Key</th>
                <th className="text-left p-2">Value</th>
                <th className="text-left p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {runtimeVariables.map((variable, index) => (
                <tr key={index} className="border-t border-slate-700">
                  <td className="p-2">
                    <input
                      type="text"
                      value={variable.key}
                      onChange={(e) => updateVariable(index, 'key', e.target.value)}
                      className="bg-transparent text-white w-full focus:outline-none"
                      disabled={variable.key === 'JOB_ID'}
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="text"
                      value={variable.value}
                      onChange={(e) => updateVariable(index, 'value', e.target.value)}
                      className={`bg-transparent w-full focus:outline-none ${variable.key === 'JOB_ID' && !isJobIdValid(variable.value) ? 'text-red-500' : 'text-white'}`}
                    />
                  </td>
                  <td className="p-2">
                    {variable.key !== 'JOB_ID' && (
                      <button onClick={() => deleteVariable(index)} className="text-red-500 hover:text-red-400">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
