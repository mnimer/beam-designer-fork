/**
 * @fileoverview Safe code viewer component rendering highlighted tokens as React elements.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

import React from 'react';
import type { CodeToken } from './syntaxTokenizer';

/**
 * Props for the CodeViewer component.
 */
export interface CodeViewerProps {
  /** Array of token objects containing text and optional CSS class names. */
  tokens: CodeToken[];
  /** Target output folder for path header display. */
  outputFolder?: string;
  /** Active file name being previewed. */
  activeFileName?: string;
}

/**
 * CodeViewer component that renders tokenized source code as React spans,
 * eliminating raw innerHTML injection and preventing XSS.
 *
 * @param props Component properties.
 * @returns React component.
 */
export const CodeViewer: React.FC<CodeViewerProps> = ({
  tokens,
  outputFolder = '',
  activeFileName = '',
}) => {
  const filePath = `./${outputFolder ? `${outputFolder}/` : ''}${activeFileName}`;

  return (
    <>
      {/* File Path & Preview Metadata Sub-header */}
      <div className="bg-[#1A1C26] px-4 py-1.5 border-b border-slate-800 flex justify-between items-center shrink-0">
        <span className="text-[11px] font-mono text-slate-400 truncate">
          {filePath}
        </span>
        <span className="text-[10px] font-bold tracking-wider text-slate-500 uppercase px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700">
          PREVIEW
        </span>
      </div>

      {/* Code Content Area */}
      <div className="flex-1 p-4 overflow-auto font-mono text-xs bg-[#1E202A]">
        <pre>
          <code>
            {tokens.length === 0 ? (
              'No code preview available.'
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
    </>
  );
};
