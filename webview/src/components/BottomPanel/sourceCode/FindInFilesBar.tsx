/**
 * @fileoverview Inline search bar for finding text within the active generated file preview.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

import React, { useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';

/**
 * Props for the FindInFilesBar component.
 */
export interface FindInFilesBarProps {
  /** Whether the find bar is currently visible. */
  readonly isOpen: boolean;
  /** Current search query string. */
  readonly query: string;
  /** Callback invoked when the search query changes. */
  readonly onQueryChange: (query: string) => void;
  /** Whether search matching is case-sensitive. */
  readonly caseSensitive: boolean;
  /** Callback to toggle case sensitivity. */
  readonly onToggleCaseSensitive: () => void;
  /** Total number of matches in the active file. */
  readonly matchCount: number;
  /** Callback to close the find bar. */
  readonly onClose: () => void;
}

/**
 * Renders a compact inline search bar for filtering and highlighting matches in the active file.
 */
export const FindInFilesBar: React.FC<FindInFilesBarProps> = ({
  isOpen,
  query,
  onQueryChange,
  caseSensitive,
  onToggleCaseSensitive,
  matchCount,
  onClose,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 20);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isOpen]);

  if (!isOpen) return null;

  const trimmedQuery = query.trim();

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div
      data-testid="find-in-files-bar"
      className="bg-[#161b22] border-b border-[#30363d] px-4 py-2 flex items-center gap-3 shrink-0"
    >
      <div className="relative flex items-center w-72 shrink-0">
        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Find in file (Ctrl+F)..."
          aria-label="Find in file"
          data-testid="find-in-files-input"
          className="w-full bg-[#0d1117] border border-[#30363d] focus:border-blue-500 rounded pl-8 pr-16 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none font-mono"
        />
        <div className="absolute right-1.5 flex items-center gap-1">
          {query && (
            <button
              type="button"
              onClick={() => onQueryChange('')}
              title="Clear search"
              aria-label="Clear search"
              className="p-0.5 text-slate-500 hover:text-slate-300 rounded cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          )}
          <button
            type="button"
            onClick={onToggleCaseSensitive}
            title="Match Case"
            aria-label="Match case"
            aria-pressed={caseSensitive}
            data-testid="find-case-sensitive-toggle"
            className={`px-1.5 py-0.5 text-[10px] font-mono font-bold rounded border transition cursor-pointer ${
              caseSensitive
                ? 'bg-blue-600/30 border-blue-500/60 text-blue-300'
                : 'bg-transparent border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            Aa
          </button>
        </div>
      </div>

      {trimmedQuery.length > 0 && (
        <span
          data-testid="find-match-count"
          className={`text-[11px] font-mono ${
            matchCount > 0 ? 'text-amber-300' : 'text-rose-400'
          }`}
        >
          {matchCount > 0
            ? `${matchCount} match${matchCount === 1 ? '' : 'es'}`
            : 'No matches'}
        </span>
      )}

      <div className="flex-1" />

      <button
        type="button"
        onClick={onClose}
        title="Close Find Bar (Esc)"
        aria-label="Close find bar"
        data-testid="find-in-files-close"
        className="p-1 text-slate-400 hover:text-white hover:bg-[#21262d] rounded transition shrink-0 cursor-pointer"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
