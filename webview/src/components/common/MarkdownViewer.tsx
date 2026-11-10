/** @fileoverview MarkdownViewer Component
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Renders GitHub Flavored Markdown text into structured, accessible, and theme-compliant React elements:
 * - Formatted Headings (H1 - H4) with subtle divider lines
 * - Tables with styled headers, alternating rows, and border dividers
 * - Ordered and unordered bullet lists with nested indentation
 * - Fenced code blocks with language badge and syntax styling
 * - Inline formatting (bold, italics, inline code tags, and links)
 * - Blockquotes and horizontal rules
 */

import React from 'react';

/**
 * Parses and renders inline markdown tokens: `code`, **bold**, *italics*, and [links](url).
 *
 * @param text Raw inline text containing markdown formatting
 * @returns React nodes with semantic formatting
 */
function renderInlineMarkdown(text: string): React.ReactNode {
  if (!text) return null;

  const regex = /(`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_|\[[^\]]+\]\([^)]+\))/g;
  const parts = text.split(regex);

  return parts.map((part, index) => {
    if (!part) return null;

    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      return (
        <code
          key={index}
          className="px-1.5 py-0.5 rounded bg-[#21262d] text-amber-300 font-mono text-[11px] border border-[#30363d]"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    if (
      (part.startsWith('**') && part.endsWith('**') && part.length >= 4) ||
      (part.startsWith('__') && part.endsWith('__') && part.length >= 4)
    ) {
      return (
        <strong key={index} className="font-semibold text-white">
          {renderInlineMarkdown(part.slice(2, -2))}
        </strong>
      );
    }

    if (
      (part.startsWith('*') && part.endsWith('*') && part.length >= 2) ||
      (part.startsWith('_') && part.endsWith('_') && part.length >= 2)
    ) {
      return (
        <em key={index} className="italic text-gray-300">
          {renderInlineMarkdown(part.slice(1, -1))}
        </em>
      );
    }

    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      return (
        <a
          key={index}
          href={linkMatch[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-amber-400 hover:text-amber-300 underline underline-offset-2 transition-colors cursor-pointer"
        >
          {linkMatch[1]}
        </a>
      );
    }

    return <span key={index}>{part}</span>;
  });
}

/**
 * Props for the MarkdownViewer component.
 */
export interface MarkdownViewerProps {
  /** Raw markdown text to parse and render. */
  content: string;
  /** Optional wrapper CSS class name. */
  className?: string;
}

/**
 * Component that parses a multi-line markdown string into rich JSX blocks.
 *
 * @param props Component props
 * @returns Rendered markdown JSX tree
 */
export const MarkdownViewer: React.FC<MarkdownViewerProps> = ({ content, className = '' }) => {
  if (!content || !content.trim()) return null;

  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const elements: React.ReactNode[] = [];

  let inCodeBlock = false;
  let codeBuffer: string[] = [];
  let codeLang = '';
  let tableBuffer: string[] = [];

  const flushTable = (keyPrefix: string) => {
    if (tableBuffer.length === 0) return;

    const rawRows = tableBuffer.map((line) => {
      const cells = line.split('|');
      if (cells.length > 0 && cells[0].trim() === '') cells.shift();
      if (cells.length > 0 && cells[cells.length - 1].trim() === '') cells.pop();
      return cells;
    });

    if (rawRows.length >= 2) {
      const headerCells = rawRows[0];
      const isDelimiter = rawRows[1].every((cell) => /^\s*:?-+:?\s*$/.test(cell));
      const bodyRows = isDelimiter ? rawRows.slice(2) : rawRows.slice(1);

      elements.push(
        <div
          key={`${keyPrefix}-table`}
          className="overflow-x-auto my-3 rounded-lg border border-[#30363d]"
        >
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#21262d] border-b border-[#30363d]">
                {headerCells.map((h, i) => (
                  <th
                    key={i}
                    className="px-3 py-2 text-gray-200 font-semibold font-mono text-[11px]"
                  >
                    {renderInlineMarkdown(h.trim())}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#30363d]/60 bg-[#0d1117]/60">
              {bodyRows.map((row, ri) => (
                <tr key={ri} className="hover:bg-[#161b22]/80 transition-colors">
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-3 py-2 text-gray-300">
                      {renderInlineMarkdown(cell.trim())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    tableBuffer = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith('```')) {
      flushTable(`line-${i}`);
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeLang = trimmed.slice(3).trim();
        codeBuffer = [];
      } else {
        inCodeBlock = false;
        elements.push(
          <div
            key={`code-${i}`}
            className="my-3 rounded-lg bg-[#0d1117] border border-[#30363d] overflow-hidden"
          >
            {codeLang && (
              <div className="px-3 py-1 bg-[#161b22] border-b border-[#30363d] text-[10px] font-mono text-amber-300">
                {codeLang}
              </div>
            )}
            <pre className="p-3 overflow-x-auto font-mono text-xs text-gray-300 leading-relaxed">
              <code>{codeBuffer.join('\n')}</code>
            </pre>
          </div>
        );
        codeBuffer = [];
      }
      continue;
    }

    if (inCodeBlock) {
      codeBuffer.push(line);
      continue;
    }

    if (trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.length > 2) {
      tableBuffer.push(trimmed);
      continue;
    } else if (tableBuffer.length > 0) {
      flushTable(`line-${i}`);
    }

    if (/^(\s*[-*_]\s*){3,}$/.test(trimmed)) {
      elements.push(
        <hr key={`hr-${i}`} className="my-3 border-t border-[#30363d]" />
      );
      continue;
    }

    if (trimmed.startsWith('#### ')) {
      elements.push(
        <h4 key={`h4-${i}`} className="text-xs font-semibold text-amber-200 mt-2.5 mb-1">
          {renderInlineMarkdown(trimmed.slice(5))}
        </h4>
      );
      continue;
    }
    if (trimmed.startsWith('### ')) {
      elements.push(
        <h3 key={`h3-${i}`} className="text-xs font-bold text-amber-300 mt-3 mb-1">
          {renderInlineMarkdown(trimmed.slice(4))}
        </h3>
      );
      continue;
    }
    if (trimmed.startsWith('## ')) {
      elements.push(
        <h2 key={`h2-${i}`} className="text-sm font-bold text-white mt-4 mb-1.5 border-b border-[#30363d]/60 pb-1">
          {renderInlineMarkdown(trimmed.slice(3))}
        </h2>
      );
      continue;
    }
    if (trimmed.startsWith('# ')) {
      elements.push(
        <h1 key={`h1-${i}`} className="text-base font-bold text-white mt-4 mb-2 border-b border-[#30363d] pb-1">
          {renderInlineMarkdown(trimmed.slice(2))}
        </h1>
      );
      continue;
    }

    if (trimmed.startsWith('> ') || trimmed === '>') {
      elements.push(
        <blockquote
          key={`quote-${i}`}
          className="border-l-2 border-amber-500/60 pl-3 my-2 text-gray-400 italic text-xs"
        >
          {renderInlineMarkdown(trimmed.replace(/^>\s?/, ''))}
        </blockquote>
      );
      continue;
    }

    const unorderedMatch = line.match(/^(\s*)[-*]\s+(.+)$/);
    if (unorderedMatch) {
      const indentSpaces = unorderedMatch[1].length;
      const paddingLeft = indentSpaces > 0 ? `${Math.min(indentSpaces, 8) * 8 + 8}px` : '8px';
      elements.push(
        <div
          key={`ul-${i}`}
          className="flex items-start gap-2 my-1"
          style={{ paddingLeft }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
          <span className="text-xs text-gray-200 leading-relaxed">
            {renderInlineMarkdown(unorderedMatch[2])}
          </span>
        </div>
      );
      continue;
    }

    const orderedMatch = line.match(/^(\s*)(\d+)\.\s+(.+)$/);
    if (orderedMatch) {
      const indentSpaces = orderedMatch[1].length;
      const paddingLeft = indentSpaces > 0 ? `${Math.min(indentSpaces, 8) * 8 + 8}px` : '8px';
      elements.push(
        <div
          key={`ol-${i}`}
          className="flex items-start gap-2 my-1"
          style={{ paddingLeft }}
        >
          <span className="font-semibold text-amber-400 font-mono text-[11px] mt-0.5 shrink-0">
            {orderedMatch[2]}.
          </span>
          <span className="text-xs text-gray-200 leading-relaxed">
            {renderInlineMarkdown(orderedMatch[3])}
          </span>
        </div>
      );
      continue;
    }

    if (!trimmed) {
      elements.push(<div key={`blank-${i}`} className="h-2" />);
      continue;
    }

    elements.push(
      <p key={`p-${i}`} className="text-xs text-gray-200 leading-relaxed my-1 break-words">
        {renderInlineMarkdown(line)}
      </p>
    );
  }

  if (tableBuffer.length > 0) {
    flushTable('end');
  }

  return <div className={`space-y-1 ${className}`}>{elements}</div>;
};
