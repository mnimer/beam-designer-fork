/**
 * @fileoverview Runner settings dropdown component for selecting the pipeline runner.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

import React from 'react';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Props for the RunnerSettings component.
 */
export interface RunnerSettingsProps {
  /** Currently active runner identifier ('DirectRunner' | 'Dataflow' | 'Spark') */
  runner: string;
  /** State updater callback for modifying the parent job configuration */
  setJobConfig: (update: React.SetStateAction<any>) => void;
}

/**
 * Target runner environment selector dropdown.
 */
export const RunnerSettings: React.FC<RunnerSettingsProps> = ({
  runner,
  setJobConfig,
}) => {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
        Target Environment
      </label>
      <select 
        value={runner} 
        onChange={(e) => {
          const nextValue = e.target.value;
          setJobConfig((prev: any) => ({ ...prev, runner: nextValue }));
        }}
        className="bg-[#0d1017] text-white px-3 py-2 rounded-lg border border-slate-800 focus:outline-none focus:border-blue-500 text-xs shadow-inner transition cursor-pointer"
      >
        <option value="DirectRunner">DirectRunner</option>
        <option value="Dataflow">Dataflow</option>
        <option value="Spark">Serverless Spark</option>
      </select>
    </div>
  );
};
