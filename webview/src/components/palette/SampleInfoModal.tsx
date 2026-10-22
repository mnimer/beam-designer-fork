/** @fileoverview SampleInfoModal Component
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Renders an accessible modal dialog displaying README-level architecture documentation,
 * pipeline topology flow, transform specifications, and runtime parameters for a Sample
 * Pipeline in the Palette Samples tab panel.
 */

/* eslint-disable react-refresh/only-export-components */
import React from 'react';
import { createPortal } from 'react-dom';
import { X, ExternalLink, Layers, BookOpen, Cpu, Code2 } from 'lucide-react';
import type { SamplePipeline } from '../../catalog/samples';
import { MarkdownViewer } from '../common/MarkdownViewer';

/**
 * Structured representation of parsed sample README content.
 */
export interface FormattedReadmeResult {
  /** Main H1 heading title. */
  title: string;
  /** Full normalized markdown content. */
  content: string;
  /** Extracted top-level overview section text. */
  overview: string;
  /** Remaining H2/H3 markdown sections. */
  sections: Array<{ heading?: string; body: string }>;
}

/**
 * Generates fallback README markdown for a sample pipeline when `readmeContent` is not explicitly provided.
 *
 * @param sample The sample pipeline metadata object
 * @returns Synthesized README markdown string
 */
export function buildFallbackSampleReadme(sample: SamplePipeline): string {
  const runner = sample.runner || 'DirectRunner';
  return [
    `# ${sample.title}`,
    '',
    '## Overview',
    sample.description || `Pre-configured Apache Beam sample pipeline (\`${sample.filename}\`).`,
    '',
    'This sample pipeline can be generated and executed in either **Python** or **Java** using the **Generate Code** tab.',
    '',
    '## Code Generation & Execution',
    `1. Click **New File** to save a copy of \`${sample.filename}\` in your workspace.`,
    '2. Open the **Generate Code** tab at the bottom, choose **Python** or **Java**, and click **Generate Code**.',
    `3. Run locally with DirectRunner or deploy to **${runner}**:`,
    '```bash',
    './run_directrunner.sh',
    '```',
  ].join('\n');
}

/**
 * Parses raw README markdown text (or fallback description) into structured sections
 * and extracts the top-level Overview for display at the top of the SampleInfoModal.
 *
 * @param readmeContent Raw markdown content from the sample's README documentation
 * @param fallbackDescription Short description fallback if README is missing or empty
 * @returns Structured title, full content string, top overview, and parsed markdown sections
 */
export function formatReadmeForModal(
  readmeContent?: string,
  fallbackDescription: string = 'No description available.'
): FormattedReadmeResult {
  if (!readmeContent || readmeContent.trim().length === 0) {
    return {
      title: 'Overview',
      content: fallbackDescription,
      overview: fallbackDescription,
      sections: [{ heading: 'Overview', body: fallbackDescription }],
    };
  }

  const normalized = readmeContent.replace(/\r\n/g, '\n').trim();
  const lines = normalized.split('\n');
  let mainTitle = 'Pipeline Documentation';
  let bodyStartIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith('# ')) {
      mainTitle = trimmed.replace(/^#\s+/, '').trim();
      bodyStartIndex = i + 1;
      break;
    }
  }

  const remainingText = lines.slice(bodyStartIndex).join('\n').trim();
  const rawSections = remainingText.split(/(?=\n##\s+|\n###\s+)/g);
  const sections: Array<{ heading?: string; body: string }> = [];

  let introText = '';
  let explicitOverviewBody = '';

  for (const chunk of rawSections) {
    const trimmedChunk = chunk.trim();
    if (!trimmedChunk) continue;

    const firstLineEnd = trimmedChunk.indexOf('\n');
    if (trimmedChunk.startsWith('## ') || trimmedChunk.startsWith('### ')) {
      const heading = (firstLineEnd !== -1
        ? trimmedChunk.slice(0, firstLineEnd)
        : trimmedChunk
      ).replace(/^#{2,3}\s+/, '').trim();

      const body = firstLineEnd !== -1 ? trimmedChunk.slice(firstLineEnd + 1).trim() : '';

      const lowerHeading = heading.toLowerCase();
      if (lowerHeading === 'overview') {
        explicitOverviewBody = body;
      } else if (lowerHeading !== 'pipeline nodes & transforms') {
        sections.push({ heading, body });
      }
    } else {
      introText = trimmedChunk;
    }
  }

  let overview: string;
  if (introText && explicitOverviewBody) {
    overview = `${introText}\n\n${explicitOverviewBody}`;
  } else if (introText) {
    overview = introText;
  } else if (explicitOverviewBody) {
    overview = explicitOverviewBody;
  } else {
    overview = fallbackDescription;
  }

  if (sections.length === 0) {
    sections.push({ heading: 'Overview', body: overview });
  }

  return {
    title: mainTitle,
    content: normalized,
    overview,
    sections,
  };
}

/**
 * Props for the SampleInfoModal component.
 */
export interface SampleInfoModalProps {
  /** Active sample pipeline to display, or null when closed. */
  sample: SamplePipeline | null;
  /** Handler invoked to close the modal. */
  onClose: () => void;
  /** Optional handler invoked when the user clicks "New File" inside the modal. */
  onOpenSample?: (sample: SamplePipeline) => void;
}

/**
 * Modal dialog displaying a sample pipeline's README documentation and metadata.
 *
 * @param props Component props
 * @returns Portal modal element or null
 */
export const SampleInfoModal: React.FC<SampleInfoModalProps> = ({
  sample,
  onClose,
  onOpenSample,
}) => {
  if (!sample) return null;

  const effectiveReadme = sample.readmeContent?.trim()
    ? sample.readmeContent
    : buildFallbackSampleReadme(sample);
  const formatted = formatReadmeForModal(effectiveReadme, sample.description);

  const modalContent = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-xs p-4"
      onClick={onClose}
      data-testid="sample-info-modal-backdrop"
    >
      <div
        className="relative w-full max-w-3xl max-h-[85vh] flex flex-col bg-[#161b22] border border-amber-500/40 rounded-lg shadow-2xl overflow-hidden text-gray-200"
        onClick={(e) => e.stopPropagation()}
        data-testid="sample-info-modal"
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between p-4 bg-[#0d1117] border-b border-[#30363d]">
          <div className="flex items-center gap-2 min-w-0">
            <BookOpen className="w-5 h-5 text-amber-400 shrink-0" />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-white truncate">{sample.title}</h2>
              </div>
              <p className="text-xs text-amber-300/90 font-mono mt-0.5">{sample.filename}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close sample information dialog"
            data-testid="sample-info-modal-close"
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-[#21262d] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Metadata Summary Banner */}
        <div className="flex items-center gap-4 px-4 py-2 bg-[#21262d]/70 border-b border-[#30363d] text-xs font-mono text-gray-300 flex-wrap">
          {typeof sample.nodesCount === 'number' && sample.nodesCount > 0 && (
            <>
              <div className="flex items-center gap-2">
                <Layers className="w-3.5 h-3.5 text-amber-400" />
                <span>{sample.nodesCount} Nodes</span>
              </div>
              <span>•</span>
            </>
          )}
          <div className="flex items-center gap-2">
            <Code2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Python &amp; Java</span>
          </div>
          {sample.runner && (
            <>
              <span>•</span>
              <div className="flex items-center gap-2">
                <Cpu className="w-3.5 h-3.5 text-sky-400" />
                <span>Runner: {sample.runner}</span>
              </div>
            </>
          )}
        </div>

        {/* Scrollable README Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1 text-xs leading-relaxed">
          {/* 1. Overview Section */}
          {formatted.overview && (
            <div className="p-4 bg-[#0d1117] border border-amber-500/30 rounded-lg space-y-2">
              <div className="text-xs font-semibold text-amber-300 flex items-center gap-2">
                <BookOpen className="w-3.5 h-3.5 text-amber-400" />
                <span>Overview</span>
              </div>
              <div className="text-gray-300 text-xs leading-relaxed">
                <MarkdownViewer content={formatted.overview} />
              </div>
            </div>
          )}

          {/* 2. Detailed README Sections */}
          {formatted.sections.map((sec, index) => {
            if (sec.heading?.toLowerCase() === 'overview' && formatted.overview) {
              return null;
            }
            return (
              <div key={index} className="space-y-2">
                {sec.heading && (
                  <h3 className="text-sm font-bold text-white border-b border-[#30363d] pb-1">
                    {sec.heading}
                  </h3>
                )}
                <div className="p-4 rounded-lg bg-[#0d1117]/50 border border-[#30363d]/60 text-xs text-gray-300 leading-relaxed">
                  <MarkdownViewer content={sec.body} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2 p-4 bg-[#0d1117] border-t border-[#30363d]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-[#21262d] hover:bg-[#30363d] text-gray-300 hover:text-white text-xs font-medium transition-colors cursor-pointer"
          >
            Close
          </button>
          {onOpenSample && (
            <button
              type="button"
              onClick={() => {
                onOpenSample(sample);
                onClose();
              }}
              data-testid="sample-info-modal-new-file"
              className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium flex items-center gap-2 transition-colors cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>New File</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );

  if (typeof document !== 'undefined' && document.body) {
    return createPortal(modalContent, document.body);
  }

  return modalContent;
};
