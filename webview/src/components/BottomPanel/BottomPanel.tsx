/**
 * @fileoverview BottomPanel container component orchestrating bottom tabs (DEPLOYMENT and GENERATE CODE).
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Architectural Decisions:
 * - Decomposed via BottomPanelContext: consumes cohesive slices (execution, jobConfig,
 *   runtimeVariables, pipelineConfig, codegen) to eliminate prop drilling into child tabs.
 * - Backward compatibility: supports legacy props interface as a fallback for existing unit tests
 *   by automatically provisioning a fallback BottomPanelProvider when rendered outside one.
 * - Expand/collapse toggle on the far right (100% full height vs default height).
 * - Source file badge counter on Generate Code tab.
 * - Semantic VS Code theme tokens and 8pt grid system.
 */

import React, { useMemo } from 'react';
import { Maximize2, Minimize2, Code2 } from 'lucide-react';
import { DeploymentTab } from './DeploymentTab';
import { SourceCodeTab } from './SourceCodeTab';
import { filterSourceFiles } from '../../utils/fileFilters';
import { useBottomPanel } from './BottomPanelContext';

/**
 * Props for the {@link BottomPanel} component.
 */
export interface BottomPanelProps {
  bottomTab: string;
  setBottomTab: (tab: string) => void;
  height?: number;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  onInteract?: () => void;
}

/**
 * Bottom drawer panel rendering tabs for generated source code inspection and runner deployment controls.
 *
 * @param props Component properties controlling active tab, dimensions, expansion state, and interaction callbacks.
 * @returns The rendered bottom drawer container element.
 */
export const BottomPanel: React.FC<BottomPanelProps> = ({
  bottomTab,
  setBottomTab,
  height,
  isExpanded = false,
  onToggleExpand,
  onInteract,
}) => {
  const { codegen } = useBottomPanel();
  const sourceFiles = useMemo(
    () => filterSourceFiles(codegen.files ?? []),
    [codegen.files]
  );

  return (
    <div 
      className="bg-[var(--vscode-workbench-bg,#151722)] text-[var(--vscode-text-primary)] flex flex-col"
      style={isExpanded ? { height: '100%' } : height ? { height: `${height}px` } : { height: '30%' }}
      onClickCapture={onInteract}
      onFocusCapture={onInteract}
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
        {bottomTab === 'DEPLOYMENT' && <DeploymentTab />}
        {bottomTab === 'SOURCE_CODE' && <SourceCodeTab />}
      </div>
    </div>
  );
};
