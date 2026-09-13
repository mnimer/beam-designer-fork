import React from 'react';
import { Trash2, Play, Square, Sliders, Variable } from 'lucide-react';

/**
 * DeploymentTab Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Renders the content for the DEPLOYMENT tab in the bottom panel.
 * Configures the pipeline runner (DirectRunner, Dataflow, Spark), machine type, worker scaling,
 * VPC network/subnetwork, runtime variables, and execution controls (Run Now and Stop).
 * 
 * Architectural Decisions:
 * - Styled to match the modern dark theme and card structure of the Generate Code tab.
 * - Adheres strictly to the 8pt grid system and Tailwind CSS tokens (text-xs labels, bg-[#161922] cards, bg-[#0d1017] inputs).
 * - Execution controls feature a primary RUN NOW button and a 25% width STOP button to kill running processes (e.g. unbounded streaming pipelines).
 * - Removed SCHEDULE button from execution controls.
 */
interface DeploymentTabProps {
  jobConfig: {
    runner: string;
    machineType: string;
    minInstances: number;
    maxInstances: number;
    gcsStagingPath?: string;
    network?: string;
    subnetwork?: string;
  };
  setJobConfig: (config: any) => void;
  runtimeVariables: { key: string, value: string }[];
  addVariable: () => void;
  updateVariable: (index: number, field: 'key' | 'value', value: string) => void;
  deleteVariable: (index: number) => void;
  isJobIdValid: (value: string) => boolean;
  onRunNow: () => void;
  onStopPipeline?: () => void;
  subnetworks: {name: string, region: string, network: string, value: string}[];
  needsRebuild?: boolean;
}

export const DeploymentTab: React.FC<DeploymentTabProps> = ({
  jobConfig,
  setJobConfig,
  runtimeVariables,
  addVariable,
  updateVariable,
  deleteVariable,
  isJobIdValid,
  onRunNow,
  onStopPipeline,
  subnetworks,
  needsRebuild = false
}) => {
  // Render deployment tab form controls and runtime variables table
  return (
    <div className="flex gap-4 h-full text-slate-300">
      {/* Left Side: Deployment Settings Card (2/3 width) */}
      <div className="w-2/3 flex flex-col bg-[#161922] rounded-xl border border-slate-700/80 overflow-hidden shadow-lg">
        {/* Panel Header */}
        <div className="border-b border-slate-700/80 bg-[#11141c] py-2.5 px-4 flex items-center">
          <div className="flex items-center gap-2">
            <Sliders className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span className="text-xs font-bold tracking-wider text-slate-200 uppercase">
              DEPLOYMENT SETTINGS
            </span>
          </div>
        </div>

        {/* Panel Content (2-Column Grid) */}
        <div className="flex-1 flex flex-col p-4 overflow-y-auto justify-between">
          <div className="grid grid-cols-2 gap-4">
            {/* Column 1 */}
            <div className="flex flex-col gap-4">
              {/* Runner Selector */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Runner
                </label>
                <select 
                  value={jobConfig.runner} 
                  onChange={(e) => setJobConfig({...jobConfig, runner: e.target.value})}
                  className="bg-[#0d1017] text-white px-3 py-2 rounded-lg border border-slate-800 focus:outline-none focus:border-blue-500 text-xs shadow-inner transition cursor-pointer"
                >
                  <option>DirectRunner</option>
                  <option>Dataflow</option>
                  <option value="Spark">Serverless Spark</option>
                </select>
              </div>

              {/* GCS Staging Path (Dataflow only) */}
              {jobConfig.runner === 'Dataflow' && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    GCS Staging Path
                  </label>
                  <input 
                    type="text" 
                    value={jobConfig.gcsStagingPath || ''} 
                    onChange={(e) => setJobConfig({...jobConfig, gcsStagingPath: e.target.value})}
                    placeholder="gs://<bucket>"
                    className="bg-[#0d1017] text-white px-3 py-2 rounded-lg border border-slate-800 focus:outline-none focus:border-blue-500 text-xs font-mono shadow-inner transition"
                  />
                </div>
              )}
            </div>

            {/* Column 2 */}
            <div className="flex flex-col gap-4">
              {/* Machine Type */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Machine Type
                </label>
                <select 
                  value={jobConfig.machineType} 
                  onChange={(e) => setJobConfig({...jobConfig, machineType: e.target.value})}
                  className={`bg-[#0d1017] text-white px-3 py-2 rounded-lg border border-slate-800 focus:outline-none focus:border-blue-500 text-xs shadow-inner transition cursor-pointer ${
                    jobConfig.runner === 'DirectRunner' || jobConfig.runner === 'Spark' ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                  disabled={jobConfig.runner === 'DirectRunner' || jobConfig.runner === 'Spark'}
                >
                  <option>n1-standard-1</option>
                  <option>n1-standard-2</option>
                  <option>n1-standard-4</option>
                </select>
              </div>

              {/* Min and Max Instances */}
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Min
                  </label>
                  <input 
                    type="number" 
                    min={0} 
                    max={999} 
                    value={jobConfig.minInstances} 
                    onChange={(e) => setJobConfig({...jobConfig, minInstances: parseInt(e.target.value, 10) || 0})}
                    className={`bg-[#0d1017] text-white px-3 py-2 rounded-lg border border-slate-800 focus:outline-none focus:border-blue-500 text-xs font-mono shadow-inner transition w-full ${
                      jobConfig.runner === 'DirectRunner' ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                    disabled={jobConfig.runner === 'DirectRunner'}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Max
                  </label>
                  <input 
                    type="number" 
                    min={0} 
                    max={999} 
                    value={jobConfig.maxInstances} 
                    onChange={(e) => setJobConfig({...jobConfig, maxInstances: parseInt(e.target.value, 10) || 0})}
                    className={`bg-[#0d1017] text-white px-3 py-2 rounded-lg border border-slate-800 focus:outline-none focus:border-blue-500 text-xs font-mono shadow-inner transition w-full ${
                      jobConfig.runner === 'DirectRunner' ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                    disabled={jobConfig.runner === 'DirectRunner'}
                  />
                </div>
              </div>

              {/* Subnetwork (Dataflow or Spark) */}
              {(jobConfig.runner === 'Dataflow' || jobConfig.runner === 'Spark') && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Subnetwork
                  </label>
                  <select 
                    value={jobConfig.subnetwork || ''} 
                    onChange={(e) => setJobConfig({...jobConfig, subnetwork: e.target.value})}
                    className="bg-[#0d1017] text-white px-3 py-2 rounded-lg border border-slate-800 focus:outline-none focus:border-blue-500 text-xs shadow-inner transition cursor-pointer"
                  >
                    <option value="">Select Subnetwork</option>
                    {subnetworks.map((sub, index) => (
                      <option key={index} value={sub.value}>{sub.name} ({sub.region})</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons: Run Now & Stop */}
          <div className="pt-3 border-t border-slate-800/80 flex gap-2.5 mt-4">
            <button 
              type="button"
              onClick={onRunNow}
              disabled={needsRebuild}
              className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-xs font-bold flex-1 cursor-pointer transition shadow-lg shadow-blue-950/40 active:scale-[0.98] ${
                needsRebuild 
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed shadow-none' 
                  : 'bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white'
              }`}
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>RUN NOW</span>
            </button>
            <button
              type="button"
              onClick={onStopPipeline}
              className="bg-[#881337] hover:bg-[#9f1239] active:bg-[#4c0519] text-rose-200 hover:text-white px-3 py-2.5 rounded-lg text-xs font-bold w-1/4 transition cursor-pointer flex items-center justify-center gap-1.5 border border-rose-700/60 shadow-lg shadow-rose-950/30 active:scale-[0.98]"
              title="Kill running pipeline process"
            >
              <Square className="w-3 h-3 fill-current" />
              <span>STOP</span>
            </button>
          </div>
        </div>
      </div>

      {/* Right Side: Runtime Variables Card (1/3 width) */}
      <div className="w-1/3 flex flex-col bg-[#161922] rounded-xl border border-slate-700/80 overflow-hidden shadow-lg">
        {/* Panel Header */}
        <div className="border-b border-slate-700/80 bg-[#11141c] py-2.5 px-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Variable className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
              RUNTIME VARIABLES
            </span>
          </div>
          <button 
            type="button"
            onClick={addVariable} 
            className="text-xs font-medium text-blue-400 hover:text-blue-300 cursor-pointer hover:underline transition"
          >
            + Add
          </button>
        </div>

        {/* Variables Table */}
        <div className="flex-1 overflow-auto bg-[#0d1017]/60">
          <table className="w-full text-xs">
            <thead className="bg-[#11141c]/80 text-slate-400 text-[11px] font-bold uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="text-left py-2 px-3">Key</th>
                <th className="text-left py-2 px-3">Value</th>
                <th className="text-center py-2 px-3 w-10">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {runtimeVariables.map((variable, index) => (
                <tr key={index} className="hover:bg-slate-800/30 transition">
                  <td className="p-2">
                    <input
                      type="text"
                      value={variable.key}
                      onChange={(e) => updateVariable(index, 'key', e.target.value)}
                      className="bg-[#0d1017] text-white px-2.5 py-1.5 rounded-lg border border-slate-800 focus:outline-none focus:border-blue-500 text-xs font-mono w-full disabled:opacity-50 transition shadow-inner"
                      disabled={variable.key === 'JOB_ID'}
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="text"
                      value={variable.value}
                      onChange={(e) => updateVariable(index, 'value', e.target.value)}
                      className={`bg-[#0d1017] px-2.5 py-1.5 rounded-lg border border-slate-800 focus:outline-none focus:border-blue-500 text-xs font-mono w-full transition shadow-inner ${
                        variable.key === 'JOB_ID' && !isJobIdValid(variable.value) ? 'text-red-400 border-red-800' : 'text-white'
                      }`}
                    />
                  </td>
                  <td className="p-2 text-center">
                    {variable.key !== 'JOB_ID' && (
                      <button 
                        type="button"
                        onClick={() => deleteVariable(index)} 
                        className="text-slate-500 hover:text-red-400 p-1 rounded transition cursor-pointer"
                        title="Delete variable"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
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
