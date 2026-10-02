/** @fileoverview Vertical tab bar component for the pipeline palette.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */
import React from 'react';
import { Radio, Workflow, Share2, BookOpen } from 'lucide-react';

/**
 * Props for the PaletteTabBar component.
 */
export interface PaletteTabBarProps {
  /** Currently active tab ('SOURCES', 'STEPS', 'SINKS', 'SAMPLES', or null). */
  activeTab: string | null;
  /** Whether the slide-out category panel is currently open. */
  isPanelOpen: boolean;
  /** Total number of nodes in the diagram, used to disable STEPS and SINKS when 0. */
  nodesCount: number;
  /** Total count of source nodes to display in the badge. */
  sourcesCount: number;
  /** Total count of step transforms to display in the badge. */
  stepsCount: number;
  /** Total count of sink nodes to display in the badge. */
  sinksCount: number;
  /** Total count of available sample pipelines to display in the badge. */
  samplesCount: number;
  /** Callback fired when a tab button is clicked. */
  onTabClick: (tabKey: string, isDisabled: boolean) => void;
}

/**
 * Renders the vertical menu bar on the left edge of the diagram canvas with
 * vertical rotated text labels, category icons, and count badges for Sources,
 * Steps, Sinks, and Samples.
 */
export const PaletteTabBar: React.FC<PaletteTabBarProps> = ({
  activeTab,
  isPanelOpen,
  nodesCount,
  sourcesCount,
  stepsCount,
  sinksCount,
  samplesCount,
  onTabClick,
}) => {
  return (
    <div
      className={`w-12 max-h-full min-h-0 overflow-y-auto overflow-x-hidden bg-[var(--vscode-workbench-bg,#151722)]/95 backdrop-blur-md border border-[var(--vscode-border,#334155)] ${
        isPanelOpen ? 'rounded-l-xl rounded-r-none border-r-0' : 'rounded-xl'
      } p-1 flex flex-col gap-1.5 shadow-2xl z-20 shrink-0 pointer-events-auto`}
    >
      {/* Tab 1: SOURCES (Green Theme) */}
      <button
        type="button"
        onClick={() => onTabClick('SOURCES', false)}
        title="Sources"
        aria-label="Sources Tab"
        className={`w-full py-2.5 px-0.5 rounded-lg flex flex-col items-center justify-between min-h-[92px] transition-all relative group cursor-pointer ${
          activeTab === 'SOURCES' && isPanelOpen
            ? 'border border-emerald-500/90 text-emerald-400 bg-emerald-500/10 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
            : 'border border-transparent text-[var(--vscode-text-muted,#64748b)] hover:text-emerald-300 hover:bg-[var(--vscode-hover,rgba(255,255,255,0.05))]'
        }`}
      >
        <Radio className="w-3.5 h-3.5 mb-1.5 shrink-0" />
        <span className="text-[9px] font-bold tracking-[0.16em] uppercase [writing-mode:vertical-lr] rotate-180 my-1">
          SOURCES
        </span>
        <span
          className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center uppercase tracking-wider ${
            activeTab === 'SOURCES' && isPanelOpen
              ? 'bg-emerald-500/20 text-emerald-300'
              : 'bg-[var(--vscode-badge-bg,#1e293b)] text-[var(--vscode-text-muted,#94a3b8)] group-hover:text-emerald-300'
          }`}
        >
          {sourcesCount}
        </span>
      </button>

      {/* Tab 2: STEPS (Blue Theme) */}
      <button
        type="button"
        onClick={() => onTabClick('STEPS', nodesCount === 0)}
        disabled={nodesCount === 0}
        title={nodesCount === 0 ? 'Add a Source first' : 'Steps & Transforms'}
        aria-label="Steps Tab"
        className={`w-full py-2.5 px-0.5 rounded-lg flex flex-col items-center justify-between min-h-[92px] transition-all relative group ${
          nodesCount === 0
            ? 'border border-transparent text-[var(--vscode-text-muted,#64748b)] opacity-35 cursor-not-allowed'
            : activeTab === 'STEPS' && isPanelOpen
            ? 'border border-blue-500/90 text-blue-400 bg-blue-500/10 shadow-[0_0_10px_rgba(59,130,246,0.2)] cursor-pointer'
            : 'border border-transparent text-[var(--vscode-text-muted,#64748b)] hover:text-blue-300 hover:bg-[var(--vscode-hover,rgba(255,255,255,0.05))] cursor-pointer'
        }`}
      >
        <Workflow className="w-3.5 h-3.5 mb-1.5 shrink-0" />
        <span className="text-[9px] font-bold tracking-[0.16em] uppercase [writing-mode:vertical-lr] rotate-180 my-1">
          STEPS
        </span>
        <span
          className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center uppercase tracking-wider ${
            activeTab === 'STEPS' && isPanelOpen
              ? 'bg-blue-500/20 text-blue-300'
              : 'bg-[var(--vscode-badge-bg,#1e293b)] text-[var(--vscode-text-muted,#94a3b8)] group-hover:text-blue-300'
          }`}
        >
          {stepsCount}
        </span>
      </button>

      {/* Tab 3: SINKS (Red Theme) */}
      <button
        type="button"
        onClick={() => onTabClick('SINKS', nodesCount === 0)}
        disabled={nodesCount === 0}
        title={nodesCount === 0 ? 'Add a Source first' : 'Sinks'}
        aria-label="Sinks Tab"
        className={`w-full py-2.5 px-0.5 rounded-lg flex flex-col items-center justify-between min-h-[92px] transition-all relative group ${
          nodesCount === 0
            ? 'border border-transparent text-[var(--vscode-text-muted,#64748b)] opacity-35 cursor-not-allowed'
            : activeTab === 'SINKS' && isPanelOpen
            ? 'border border-rose-500/90 text-rose-400 bg-rose-500/10 shadow-[0_0_10px_rgba(244,63,94,0.2)] cursor-pointer'
            : 'border border-transparent text-[var(--vscode-text-muted,#64748b)] hover:text-rose-300 hover:bg-[var(--vscode-hover,rgba(255,255,255,0.05))] cursor-pointer'
        }`}
      >
        <Share2 className="w-3.5 h-3.5 mb-1.5 shrink-0" />
        <span className="text-[9px] font-bold tracking-[0.16em] uppercase [writing-mode:vertical-lr] rotate-180 my-1">
          SINKS
        </span>
        <span
          className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center uppercase tracking-wider ${
            activeTab === 'SINKS' && isPanelOpen
              ? 'bg-rose-500/20 text-rose-300'
              : 'bg-[var(--vscode-badge-bg,#1e293b)] text-[var(--vscode-text-muted,#94a3b8)] group-hover:text-rose-300'
          }`}
        >
          {sinksCount}
        </span>
      </button>

      {/* Tab 4: SAMPLES (Yellow / Amber Theme) */}
      <button
        type="button"
        onClick={() => onTabClick('SAMPLES', false)}
        title="Sample Pipelines"
        aria-label="Samples Tab"
        className={`w-full py-2.5 px-0.5 rounded-lg flex flex-col items-center justify-between min-h-[92px] transition-all relative group cursor-pointer ${
          activeTab === 'SAMPLES' && isPanelOpen
            ? 'border border-amber-500/90 text-amber-400 bg-amber-500/10 shadow-[0_0_10px_rgba(245,158,11,0.2)]'
            : 'border border-transparent text-[var(--vscode-text-muted,#64748b)] hover:text-amber-300 hover:bg-[var(--vscode-hover,rgba(255,255,255,0.05))]'
        }`}
      >
        <BookOpen className="w-3.5 h-3.5 mb-1.5 shrink-0" />
        <span className="text-[9px] font-bold tracking-[0.16em] uppercase [writing-mode:vertical-lr] rotate-180 my-1">
          SAMPLES
        </span>
        <span
          className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center uppercase tracking-wider ${
            activeTab === 'SAMPLES' && isPanelOpen
              ? 'bg-amber-500/20 text-amber-300'
              : 'bg-[var(--vscode-badge-bg,#1e293b)] text-[var(--vscode-text-muted,#94a3b8)] group-hover:text-amber-300'
          }`}
        >
          {samplesCount}
        </span>
      </button>
    </div>
  );
};
