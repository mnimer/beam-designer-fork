import React from 'react';
import { Maximize2, Minimize2, Code2 } from 'lucide-react';
import { DeploymentTab, type LogEntry } from './DeploymentTab';
import { SourceCodeTab } from './SourceCodeTab';
import { filterSourceFiles } from '../../utils/fileFilters';

/**
 * BottomPanel Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Container component for the designer's bottom panel tabs (GENERATE CODE and DEPLOYMENT).
 * 
 * Architectural Decisions:
 * - Running Jobs was moved to the dedicated VS Code sidebar view.
 * - Provides an expand/collapse toggle icon on the far right of the tab bar (100% full height vs default height).
 * - Displays file count badge on the GENERATE CODE tab when generated files exist.
 * - Relays execution logs, pipeline status, and GCP deep linking to DeploymentTab.
 * - Uses semantic VS Code theme tokens with 8pt grid spacing system and tailwindcss styling.
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
  onStopPipeline?: () => void;
  subnetworks: {name: string, region: string, network: string, value: string}[];
  pipelineConfig: { language: 'Python' | 'Java', outputFolder: string, needsRebuild: boolean };
  setPipelineConfig: (config: any) => void;
  onRegenerate: () => void;
  onStopGeneration?: () => void;
  folderFiles: string[];
  selectedFileName: string | null;
  selectedFileContent: string | null;
  onPickFolder: () => void;
  onSelectFile: (fileName: string) => void;
  height?: number;
  isGenerating?: boolean;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  pipelineLogs?: LogEntry[];
  pipelineStatus?: 'idle' | 'running' | 'completed' | 'failed' | 'stopped';
  runnerCommand?: string;
  onClearLogs?: () => void;
  onOpenConsole?: (url: string) => void;
  projectId?: string;
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
  onStopPipeline,
  subnetworks,
  pipelineConfig,
  setPipelineConfig,
  onRegenerate,
  onStopGeneration,
  folderFiles,
  selectedFileName,
  selectedFileContent,
  onPickFolder,
  onSelectFile,
  height,
  isGenerating,
  isExpanded = false,
  onToggleExpand,
  pipelineLogs = [],
  pipelineStatus = 'idle',
  runnerCommand = '',
  onClearLogs,
  onOpenConsole,
  projectId = 'YOUR_PROJECT_ID'
}) => {
  // Filter only .java and .py source files (excluding venv, caches, dependencies) for tab badge count
  const sourceFiles = filterSourceFiles(folderFiles);

  return (
    <div 
      className="bg-[var(--vscode-workbench-bg,#151722)] text-[var(--vscode-text-primary)] flex flex-col"
      style={isExpanded ? { height: '100%' } : height ? { height: `${height}px` } : { height: '30%' }}
    >
      {/* Tab Headers */}
      <div className="flex items-center justify-between border-b border-[var(--vscode-border,#334155)] bg-[var(--vscode-subcard-bg,#1E202A)] px-4">
        <div className="flex items-center">
          <button
            className={`py-2 px-4 text-xs font-semibold tracking-wider transition cursor-pointer flex items-center gap-2 ${bottomTab === 'SOURCE_CODE' ? 'text-[var(--vscode-text-primary,#ffffff)] border-b-2 border-[var(--vscode-highlight,#3b82f6)]' : 'text-[var(--vscode-text-muted,#64748b)] hover:text-[var(--vscode-text-primary,#cbd5e1)]'}`}
            onClick={() => setBottomTab('SOURCE_CODE')}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Generate Code</span>
            {sourceFiles.length > 0 && (
              <span className="px-2 py-0.5 bg-slate-800 text-slate-300 text-[10px] rounded-full border border-slate-700 font-mono">
                {sourceFiles.length} {sourceFiles.length === 1 ? 'file' : 'files'}
              </span>
            )}
          </button>
          <button
            className={`py-2 px-4 text-xs font-semibold tracking-wider transition cursor-pointer ${bottomTab === 'DEPLOYMENT' ? 'text-[var(--vscode-text-primary,#ffffff)] border-b-2 border-[var(--vscode-highlight,#3b82f6)]' : 'text-[var(--vscode-text-muted,#64748b)] hover:text-[var(--vscode-text-primary,#cbd5e1)]'}`}
            onClick={() => setBottomTab('DEPLOYMENT')}
          >
            DEPLOYMENT
          </button>
        </div>

        {/* Expand / Collapse Icon Button on Far Right */}
        {onToggleExpand && (
          <button
            onClick={onToggleExpand}
            className="p-1.5 my-1 text-slate-400 hover:text-white hover:bg-slate-700/60 rounded transition cursor-pointer"
            title={isExpanded ? 'Collapse Panel (30%)' : 'Expand Panel (100%)'}
            aria-label={isExpanded ? 'Collapse Panel' : 'Expand Panel'}
          >
            {isExpanded ? (
              <Minimize2 className="w-4 h-4 text-blue-400 hover:text-blue-300" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </button>
        )}
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
            onStopPipeline={onStopPipeline}
            subnetworks={subnetworks}
            needsRebuild={pipelineConfig.needsRebuild}
            pipelineLogs={pipelineLogs}
            pipelineStatus={pipelineStatus}
            runnerCommand={runnerCommand}
            onClearLogs={onClearLogs}
            onOpenConsole={onOpenConsole}
            projectId={projectId}
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
            onStopGeneration={onStopGeneration}
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
