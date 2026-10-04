/** @fileoverview Slide-out panel list of pre-configured sample pipelines.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */
import React from 'react';
import { FileCode2 } from 'lucide-react';
import type { SamplePipeline } from '../../catalog/samples';

/**
 * Props for the SamplesTabPanel component.
 */
export interface SamplesTabPanelProps {
  /** The list of filtered and sorted sample pipelines to display. */
  samples: SamplePipeline[];
  /** Active search query string, displayed in the empty-state message. */
  searchQuery: string;
  /** Optional handler invoked when a sample pipeline card is clicked. */
  onOpenSample?: (sample: SamplePipeline) => void;
}

/**
 * Renders the scrollable list of pre-configured sample pipeline cards within the slide-out panel,
 * or an empty-state message when search matches no samples.
 */
export const SamplesTabPanel: React.FC<SamplesTabPanelProps> = ({
  samples,
  searchQuery,
  onOpenSample,
}) => {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-2.5 space-y-2">
      {samples.length === 0 ? (
        <div className="text-center py-6 text-xs text-[var(--vscode-text-muted,#94a3b8)]">
          No sample pipelines matching &quot;{searchQuery}&quot;
        </div>
      ) : (
        <div className="space-y-2">
          {samples.map((sample) => (
            <div
              key={sample.id || sample.filename}
              role="button"
              tabIndex={0}
              onClick={() => {
                if (onOpenSample) {
                  onOpenSample(sample);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  if (onOpenSample) {
                    onOpenSample(sample);
                  }
                }
              }}
              title={`Click to open ${sample.title} (${sample.filename}) as a new file tab`}
              className="group/item bg-[var(--vscode-card-bg,#1e293b)] hover:bg-[var(--vscode-hover,rgba(255,255,255,0.06))] border border-[var(--vscode-border-light,#334155)] hover:border-amber-500/70 rounded-lg p-2.5 cursor-pointer transition-all flex flex-col gap-1.5 shadow-sm focus:outline-none focus:ring-1 focus:ring-amber-400"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="p-1.5 bg-amber-500/10 text-amber-400 rounded-md shrink-0 group-hover/item:bg-amber-500/20 group-hover/item:text-amber-300 transition-colors">
                    <FileCode2 className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-[var(--vscode-text-primary,#ffffff)] group-hover/item:text-amber-300 transition-colors truncate">
                      {sample.title}
                    </div>
                    <div className="text-[10px] text-[var(--vscode-text-muted,#94a3b8)] font-mono truncate">
                      {sample.filename}
                    </div>
                  </div>
                </div>
                {sample.badge && (
                  <span className="bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0">
                    {sample.badge}
                  </span>
                )}
              </div>

              {sample.description && (
                <p className="text-[11px] leading-snug text-[var(--vscode-text-muted,#94a3b8)]">
                  {sample.description}
                </p>
              )}

              <div className="flex items-center justify-between pt-1 border-t border-[var(--vscode-border-light,#334155)]/50 text-[10px] text-[var(--vscode-text-muted,#64748b)] group-hover/item:text-amber-400 transition-colors">
                <span>Open sample</span>
                <span className="font-semibold text-amber-400 group-hover/item:translate-x-0.5 transition-transform">➔</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
