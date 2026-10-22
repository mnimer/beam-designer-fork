/**
 * @fileoverview Safe code viewer component rendering highlighted tokens as React elements.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

import React, { useMemo } from 'react';
import { getFileColorInfo, getFileDescription } from './fileTypeColors';
import type { CodeToken } from './syntaxTokenizer';

/**
 * Props for the CodeViewer component.
 */
export interface CodeViewerProps {
  /** Array of token objects containing text and optional CSS class names. */
  readonly tokens: CodeToken[];
  /** Target output folder for path header display. */
  readonly outputFolder?: string;
  /** Active file name being previewed. */
  readonly activeFileName?: string;
  /** Optional search query string to highlight matches in the code view. */
  readonly searchQuery?: string;
  /** Whether search query matching is case-sensitive. */
  readonly searchCaseSensitive?: boolean;
}

/**
 * Escapes special regular expression characters in a literal search query.
 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Renders tokenized source code as React spans with file type metadata and optional search highlighting.
 */
export const CodeViewer: React.FC<CodeViewerProps> = ({
  tokens,
  outputFolder = '',
  activeFileName = '',
  searchQuery = '',
  searchCaseSensitive = false,
}) => {
  const normalizedFolder = outputFolder.replace(/^\.\//, '').replace(/\/$/, '');
  const filePath = `./${normalizedFolder ? `${normalizedFolder}/` : ''}${activeFileName}`;
  const colorInfo = getFileColorInfo(activeFileName);
  const fileDescription = getFileDescription(activeFileName);
  const trimmedQuery = searchQuery.trim();

  const searchHighlightedNodes = useMemo((): React.ReactNode[] | null => {
    if (!trimmedQuery || tokens.length === 0) {
      return null;
    }
    const fullText = tokens.map((t) => t.text).join('');
    const flags = searchCaseSensitive ? 'g' : 'gi';
    const regex = new RegExp(`(${escapeRegExp(trimmedQuery)})`, flags);
    const parts = fullText.split(regex);
    return parts.map((part, idx) => {
      const isMatch = searchCaseSensitive
        ? part === trimmedQuery
        : part.toLowerCase() === trimmedQuery.toLowerCase();
      if (isMatch) {
        return (
          <mark
            key={idx}
            data-testid="search-match-highlight"
            className="bg-amber-500/40 text-amber-100 rounded px-0.5"
          >
            {part}
          </mark>
        );
      }
      return <React.Fragment key={idx}>{part}</React.Fragment>;
    });
  }, [tokens, trimmedQuery, searchCaseSensitive]);

  return (
    <div className="flex-1 flex flex-col bg-[#0d1117] overflow-hidden min-w-0 relative">
      {/* File Type Description & Path Sub-header */}
      <div className="bg-[#161b22]/60 px-4 py-1.5 border-b border-[#30363d] flex justify-between items-center text-[11px] text-slate-400 shrink-0 gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {colorInfo.badgeLabel && (
            <span
              data-testid="active-file-type-badge"
              className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider shrink-0 border ${colorInfo.badgeClass}`}
            >
              {colorInfo.badgeLabel}
            </span>
          )}
          <span className="truncate text-slate-400">{fileDescription}</span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-[10px] font-mono text-slate-500 truncate">
            {filePath}
          </span>
          <span className="text-[10px] font-mono font-bold tracking-widest text-slate-600 uppercase select-none">
            PREVIEW
          </span>
        </div>
      </div>

      {/* Code Content Area */}
      <div className="flex-1 p-4 overflow-auto font-mono text-xs leading-relaxed text-slate-300 bg-[#0d1117]">
        <pre>
          <code>
            {tokens.length === 0 ? (
              'No code preview available.'
            ) : searchHighlightedNodes ? (
              searchHighlightedNodes
            ) : (
              tokens.map((token, index) => (
                <span key={index} className={token.className}>
                  {token.text}
                </span>
              ))
            )}
          </code>
        </pre>
      </div>
    </div>
  );
};
