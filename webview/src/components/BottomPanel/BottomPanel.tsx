import React, { useMemo } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import { DeploymentTab } from './DeploymentTab';
import { SourceCodeTab } from './SourceCodeTab';

/**
 * BottomPanel Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Container component for the designer's bottom panel tabs (SOURCE CODE and DEPLOYMENT).
 * 
 * Architectural Decisions:
 * - Running Jobs was moved to the dedicated VS Code sidebar view.
 * - Provides an expand/collapse toggle icon on the far right of the tab bar (100% full height vs default height).
 * - Displays file count badge on the SOURCE CODE tab when generated files exist.
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
  isExpanded?: boolean;
  onToggleExpand?: () => void;
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
  isExpanded = false,
  onToggleExpand
}) => {
  // Filter only .java and .py source files for tab badge count (memoised to avoid re-filtering on every render)
  const sourceFiles = useMemo(
    () => (folderFiles || []).filter((f) => f.endsWith('.py') || f.endsWith('.java')),
    [folderFiles]
  );

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
            <span>SOURCE CODE</span>
            {sourceFiles.length > 0 && (
              <span className="px-1.5 py-0.5 bg-slate-800 text-slate-400 text-[10px] rounded border border-slate-700 font-mono">
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
            subnetworks={subnetworks}
            needsRebuild={pipelineConfig.needsRebuild}
          />
        )}

        {bottomTab === 'SOURCE_CODE' && (
          <SourceCodeTab 
            generatedCode={generatedCode}
            language={pipelineConfig.language}
            setLanguage={(lang) => setPipelineConfig((prev: any) => ({ ...prev, language: lang }))}
            outputFolder={pipelineConfig.outputFolder}
            setOutputFolder={(folder) => setPipelineConfig((prev: any) => ({ ...prev, outputFolder: folder }))}
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
