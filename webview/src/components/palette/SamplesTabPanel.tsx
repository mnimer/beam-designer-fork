/** @fileoverview Slide-out panel list of pre-configured sample pipelines.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */
import React, { useState } from 'react';
import { FileCode2, Info, ExternalLink } from 'lucide-react';
import type { SamplePipeline } from '../../catalog/samples';
import { SampleInfoModal } from './SampleInfoModal';

/**
 * Props for the SamplesTabPanel component.
 */
export interface SamplesTabPanelProps {
  /** The list of filtered and sorted sample pipelines to display. */
  samples: SamplePipeline[];
  /** Active search query string, displayed in the empty-state message. */
  searchQuery: string;
  /** Optional handler invoked when a sample pipeline's "New File" button is clicked. */
  onOpenSample?: (sample: SamplePipeline) => void;
}

/**
 * Renders the scrollable list of pre-configured sample pipeline cards within the slide-out panel,
 * with "Info" (README modal) and "New File" (Save dialog) action buttons on each card.
 */
export const SamplesTabPanel: React.FC<SamplesTabPanelProps> = ({
  samples,
  searchQuery,
  onOpenSample,
}) => {
  const [activeInfoSample, setActiveInfoSample] = useState<SamplePipeline | null>(null);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-2.5 space-y-2">
      {samples.length === 0 ? (
        <div className="text-center py-6 text-xs text-[var(--vscode-text-muted,#94a3b8)]">
          No sample pipelines matching &quot;{searchQuery}&quot;
        </div>
      ) : (
        <div className="space-y-2">
          {samples.map((sample) => {
            const sampleKey = sample.id || sample.filename;
            return (
              <div
                key={sampleKey}
                data-testid={`sample-card-${sampleKey}`}
                title={sample.title}
                className="group/item bg-[var(--vscode-card-bg,#1e293b)] hover:bg-[var(--vscode-hover,rgba(255,255,255,0.06))] border border-[var(--vscode-border-light,#334155)] hover:border-amber-500/70 rounded-lg p-2.5 transition-all flex flex-col gap-1.5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  {/* Left: Icon, Title, Filename, Description */}
                  <div className="flex items-start gap-2 min-w-0 flex-1">
                    <div className="p-1.5 bg-amber-500/10 text-amber-400 rounded-md shrink-0 mt-0.5 group-hover/item:bg-amber-500/20 group-hover/item:text-amber-300 transition-colors">
                      <FileCode2 className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-[var(--vscode-text-primary,#ffffff)] group-hover/item:text-amber-300 transition-colors truncate">
                        {sample.title}
                      </div>
                      <div className="text-[10px] text-[var(--vscode-text-muted,#94a3b8)] font-mono truncate">
                        {sample.filename}
                      </div>
                      {sample.description && (
                        <p className="text-[10px] leading-relaxed text-[var(--vscode-text-muted,#94a3b8)] mt-1 line-clamp-2">
                          {sample.description}
                        </p>
                      )}
                      {typeof sample.nodesCount === 'number' && sample.nodesCount > 0 && (
                        <div className="flex items-center gap-2 mt-1.5 text-[9px] text-[var(--vscode-text-muted,#64748b)] font-mono">
                          <span>{sample.nodesCount} nodes</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Stacked "Info" and "New File" Action Buttons */}
                  <div className="flex flex-col gap-1 shrink-0 mt-0.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveInfoSample(sample);
                      }}
                      title={`View "${sample.title}" description & README documentation`}
                      aria-label={`View ${sample.title} information`}
                      data-testid={`sample-info-btn-${sampleKey}`}
                      className="px-2 py-1 rounded bg-[#161b22] hover:bg-[#21262d] border border-amber-500/40 text-amber-300 hover:text-white transition-colors cursor-pointer text-[10px] font-medium flex items-center justify-center gap-1"
                    >
                      <Info className="w-3 h-3 shrink-0" />
                      <span>Info</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenSample?.(sample);
                      }}
                      title={`Save "${sample.title}" as a new .beam file and open in editor`}
                      aria-label={`Open ${sample.title} as new file`}
                      data-testid={`sample-new-file-btn-${sampleKey}`}
                      className="px-2 py-1 rounded bg-[#161b22] hover:bg-[#21262d] border border-amber-500/40 text-amber-300 hover:text-white transition-colors cursor-pointer text-[10px] font-medium flex items-center justify-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3 shrink-0" />
                      <span>New File</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Sample Information Modal Dialog */}
      <SampleInfoModal
        sample={activeInfoSample}
        onClose={() => setActiveInfoSample(null)}
        onOpenSample={onOpenSample}
      />
    </div>
  );
};
