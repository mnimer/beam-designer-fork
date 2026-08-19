import React from 'react';
import { DeploymentTab } from './DeploymentTab';
import { InstancesTab, type DataflowJob } from './InstancesTab';
import { SourceCodeTab } from './SourceCodeTab';

/**
 * BottomPanel Component
 * 
 * This component acts as a container for the bottom panel tabs.
 * It displays the tab headers and renders the content for the active tab.
 * 
 * Architectural Decisions:
 * - Container component for bottom tabs.
 * - Delegates content rendering to specific tab components.
 */
interface BottomPanelProps {
  bottomTab: string;
  setBottomTab: (tab: string) => void;
  jobConfig: any;
  setJobConfig: (config: any) => void;
  runtimeVariables: { key: string, value: string }[];
  addVariable: () => void;
  updateVariable: (index: number, field: 'key' | 'value', value: string) => void;
  deleteVariable: (index: number) => void;
  isJobIdValid: (value: string) => boolean;
  generatedCode: string;
  onRunNow: () => void;
  subnetworks: {name: string, region: string, network: string, value: string}[];
  pipelineConfig: { language: 'Python' | 'Java', outputFolder: string, needsRebuild: boolean };
  setPipelineConfig: (config: any) => void;
  onRegenerate: () => void;
  folderFiles: string[];
  selectedFileName: string | null;
  selectedFileContent: string | null;
  onPickFolder: () => void;
  onSelectFile: (fileName: string) => void;
  height?: number;
  isGenerating?: boolean;
  runningJobs?: DataflowJob[];
  isLoadingJobs?: boolean;
  jobsError?: string | null;
  onRefreshRunningJobs?: (region?: string) => void;
  onOpenJob?: (job: DataflowJob) => void;
  projectId?: string;
  dataflowRegion?: string;
  onRegionChange?: (region: string) => void;
}

export const BottomPanel: React.FC<BottomPanelProps> = ({
  bottomTab,
  setBottomTab,
  jobConfig,
  setJobConfig,
  runtimeVariables,
  addVariable,
  updateVariable,
  deleteVariable,
  isJobIdValid,
  generatedCode,
  onRunNow,
  subnetworks,
  pipelineConfig,
  setPipelineConfig,
  onRegenerate,
  folderFiles,
  selectedFileName,
  selectedFileContent,
  onPickFolder,
  onSelectFile,
  height,
  isGenerating,
  runningJobs,
  isLoadingJobs,
  jobsError,
  onRefreshRunningJobs,
  onOpenJob,
  projectId,
  dataflowRegion,
  onRegionChange
}) => {
  return (
    <div 
      className="bg-[#151722] flex flex-col"
      style={height ? { height: `${height}px` } : { height: '33.3333%' }}
    >
      {/* Tab Headers */}
      <div className="flex border-b border-slate-700 bg-[#1E202A] px-4">
        <button
          className={`py-2 px-4 text-xs font-semibold tracking-wider transition cursor-pointer ${bottomTab === 'SOURCE_CODE' ? 'text-white border-b-2 border-blue-500' : 'text-slate-500 hover:text-slate-300'}`}
          onClick={() => setBottomTab('SOURCE_CODE')}
        >
          SOURCE CODE
        </button>
        <button
          className={`py-2 px-4 text-xs font-semibold tracking-wider transition cursor-pointer ${bottomTab === 'DEPLOYMENT' ? 'text-white border-b-2 border-blue-500' : 'text-slate-500 hover:text-slate-300'}`}
          onClick={() => setBottomTab('DEPLOYMENT')}
        >
          DEPLOYMENT
        </button>
        <button
          className={`py-2 px-4 text-xs font-semibold tracking-wider transition cursor-pointer ${bottomTab === 'RUNNING_JOBS' ? 'text-white border-b-2 border-blue-500' : 'text-slate-500 hover:text-slate-300'}`}
          onClick={() => setBottomTab('RUNNING_JOBS')}
        >
          RUNNING JOBS
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto p-4">
        {bottomTab === 'DEPLOYMENT' && (
          <DeploymentTab 
            jobConfig={jobConfig}
            setJobConfig={setJobConfig}
            runtimeVariables={runtimeVariables}
            addVariable={addVariable}
            updateVariable={updateVariable}
            deleteVariable={deleteVariable}
            isJobIdValid={isJobIdValid}
            onRunNow={onRunNow}
            subnetworks={subnetworks}
            needsRebuild={pipelineConfig.needsRebuild}
          />
        )}

        {bottomTab === 'RUNNING_JOBS' && (
          <InstancesTab 
            jobs={runningJobs}
            isLoading={isLoadingJobs}
            error={jobsError}
            onRefresh={onRefreshRunningJobs}
            onOpenJob={onOpenJob}
            projectId={projectId}
            selectedRegion={dataflowRegion}
            onRegionChange={onRegionChange}
          />
        )}

        {bottomTab === 'SOURCE_CODE' && (
          <SourceCodeTab 
            generatedCode={generatedCode}
            language={pipelineConfig.language}
            setLanguage={(lang) => setPipelineConfig({ ...pipelineConfig, language: lang })}
            outputFolder={pipelineConfig.outputFolder}
            setOutputFolder={(folder) => setPipelineConfig({ ...pipelineConfig, outputFolder: folder })}
            onPickFolder={onPickFolder}
            onRegenerate={onRegenerate}
            needsRebuild={pipelineConfig.needsRebuild}
            files={folderFiles}
            selectedFile={selectedFileName}
            onSelectFile={onSelectFile}
            selectedFileContent={selectedFileContent}
            isGenerating={isGenerating}
          />
        )}
      </div>
    </div>
  );
};
