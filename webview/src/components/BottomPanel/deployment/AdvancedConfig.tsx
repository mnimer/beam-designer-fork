/**
 * @fileoverview Advanced job configuration options for Dataflow and Spark runners.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

import React from 'react';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Option descriptor for GCP subnetwork selections.
 */
export interface SubnetworkOption {
  name: string;
  region: string;
  network: string;
  value: string;
}

/**
 * Structure of job configuration fields used in advanced settings.
 */
export interface AdvancedJobConfig {
  runner: string;
  machineType?: string;
  minInstances?: number;
  maxInstances?: number;
  gcsStagingPath?: string;
  network?: string;
  subnetwork?: string;
  jobId?: string;
  region?: string;
  projectId?: string;
  [key: string]: any;
}

/**
 * Props for the AdvancedConfig component.
 */
export interface AdvancedConfigProps {
  /** Current job configuration state */
  jobConfig: AdvancedJobConfig;
  /** State updater callback for modifying the parent job configuration */
  setJobConfig: (update: React.SetStateAction<any>) => void;
  /** List of selectable VPC subnetworks */
  subnetworks: SubnetworkOption[];
}

/**
 * Renders contextual runner options for Google Cloud Dataflow and Serverless Spark.
 */
export const AdvancedConfig: React.FC<AdvancedConfigProps> = ({
  jobConfig,
  setJobConfig,
  subnetworks,
}) => {
  return (
    <>
      {/* Contextual Options: Google Cloud Dataflow */}
      {jobConfig.runner === 'Dataflow' && (
        <div className="flex flex-col gap-3 p-3 bg-[#0d1017]/80 rounded-lg border border-slate-800">
          <div className="text-[11px] font-bold uppercase tracking-wider text-blue-400">
            Dataflow Options
          </div>

          {/* Machine Type */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Machine Type
            </label>
            <select 
              value={jobConfig.machineType || 'n1-standard-1'} 
              onChange={(e) => {
                const nextValue = e.target.value;
                setJobConfig((prev: any) => ({ ...prev, machineType: nextValue }));
              }}
              className="bg-[#161922] text-white px-2.5 py-1.5 rounded border border-slate-700 text-xs focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="n1-standard-1">n1-standard-1 (1 vCPU, 3.75 GB)</option>
              <option value="n1-standard-2">n1-standard-2 (2 vCPU, 7.5 GB)</option>
              <option value="n1-standard-4">n1-standard-4 (4 vCPU, 15 GB)</option>
              <option value="n2-standard-2">n2-standard-2 (2 vCPU, 8 GB)</option>
              <option value="n2-standard-4">n2-standard-4 (4 vCPU, 16 GB)</option>
            </select>
          </div>

          {/* Min and Max Workers */}
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Min Workers
              </label>
              <input 
                type="number" 
                min={1} 
                max={999} 
                value={jobConfig.minInstances ?? 1} 
                onChange={(e) => {
                  const nextValue = parseInt(e.target.value, 10) || 1;
                  setJobConfig((prev: any) => ({ ...prev, minInstances: nextValue }));
                }}
                className="bg-[#161922] text-white px-2.5 py-1.5 rounded border border-slate-700 text-xs font-mono focus:outline-none focus:border-blue-500 w-full"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Max Workers
              </label>
              <input 
                type="number" 
                min={1} 
                max={999} 
                value={jobConfig.maxInstances ?? 10} 
                onChange={(e) => {
                  const nextValue = parseInt(e.target.value, 10) || 1;
                  setJobConfig((prev: any) => ({ ...prev, maxInstances: nextValue }));
                }}
                className="bg-[#161922] text-white px-2.5 py-1.5 rounded border border-slate-700 text-xs font-mono focus:outline-none focus:border-blue-500 w-full"
              />
            </div>
          </div>

          {/* GCS Staging Path */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              GCS Staging Path
            </label>
            <input 
              type="text" 
              value={jobConfig.gcsStagingPath || ''} 
              onChange={(e) => {
                const nextValue = e.target.value;
                setJobConfig((prev: any) => ({ ...prev, gcsStagingPath: nextValue }));
              }}
              placeholder="gs://<bucket>/staging"
              className="bg-[#161922] text-white px-2.5 py-1.5 rounded border border-slate-700 text-xs font-mono focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Subnetwork */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Subnetwork
            </label>
            <select 
              value={jobConfig.subnetwork || ''} 
              onChange={(e) => {
                const nextValue = e.target.value;
                setJobConfig((prev: any) => ({ ...prev, subnetwork: nextValue }));
              }}
              className="bg-[#161922] text-white px-2.5 py-1.5 rounded border border-slate-700 text-xs focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="">Default Subnetwork</option>
              {subnetworks.map((sub, index) => (
                <option key={index} value={sub.value}>{sub.name} ({sub.region})</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Contextual Options: Serverless Spark */}
      {jobConfig.runner === 'Spark' && (
        <div className="flex flex-col gap-3 p-3 bg-[#0d1017]/80 rounded-lg border border-slate-800">
          <div className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
            Spark Options
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Subnetwork
            </label>
            <select 
              value={jobConfig.subnetwork || ''} 
              onChange={(e) => {
                const nextValue = e.target.value;
                setJobConfig((prev: any) => ({ ...prev, subnetwork: nextValue }));
              }}
              className="bg-[#161922] text-white px-2.5 py-1.5 rounded border border-slate-700 text-xs focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="">Default Subnetwork</option>
              {subnetworks.map((sub, index) => (
                <option key={index} value={sub.value}>{sub.name} ({sub.region})</option>
              ))}
            </select>
          </div>
        </div>
      )}
    </>
  );
};
