/**
 * CollapsibleSection Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Shared accordion primitive used by connector property panels to group advanced or
 * secondary configuration behind a single disclosure control. Extracted verbatim from the
 * duplicated `CollapsibleSection` declarations that were copy-pasted into the file
 * connector panels (TFRecordIO, XmlIO, CsvIO, JsonIO, ContextualTextIO, ThriftIO), so that
 * new connectors compose this component instead of re-deriving the markup.
 * 
 * Architectural Decisions:
 * - Tailwind class strings are copied byte-for-byte from the existing duplicated
 *   implementation (webview/src/properties/source/ThriftIO.tsx) to guarantee zero visual drift
 *   when panels migrate onto this primitive.
 * - Open/closed state is owned by the caller (props in, events up); this component is fully
 *   controlled and never holds internal state, so panels can persist or coordinate section state.
 * - `aria-expanded` is published on the toggle button. This is the single intentional
 *   deviation from the copied markup: the duplicated copies exposed no disclosure state to
 *   assistive technology, so screen readers could not tell whether the section was open.
 * - Children are only mounted while open, matching the original behaviour: collapsed sections
 *   must not run effects or dispatch IPC from their inputs.
 * - Spacing stays on the 8pt grid (p-3 / gap-3 / mt-2) and uses only existing VS Code theme
 *   tokens; no inline styles and no new colors are introduced.
 */

import React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

export interface CollapsibleSectionProps {
  /**
   * Section heading rendered inside the toggle button.
   *
   * Typed as ReactNode rather than string because several connector panels render inline
   * markup in the heading (e.g. `Beam Schema / Column Types (<code>CsvIO.parseRows(schema)</code>)`).
   * Narrowing this to string would force those panels to drop formatting they already ship.
   */
  title: React.ReactNode;
  /** Optional leading icon element rendered before the title. */
  icon?: React.ReactNode;
  /** Whether the section body is currently expanded. Controlled by the caller. */
  isOpen: boolean;
  /** Invoked when the user activates the toggle button. */
  onToggle: () => void;
  /** Section body content, mounted only while expanded. */
  children: React.ReactNode;
  /** Optional DOM id applied to the section wrapper for targeted queries and tests. */
  id?: string;
}

/**
 * Renders a titled, controlled disclosure section with the standard connector panel styling.
 *
 * @param props Controlled disclosure configuration.
 * @returns The accordion wrapper, toggle button, and (when open) the section body.
 */
export const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  icon,
  isOpen,
  onToggle,
  children,
  id
}) => {
  return (
    <div
      id={id}
      className="border border-[var(--vscode-border)] rounded-md bg-[var(--vscode-subcard-bg)] overflow-hidden"
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="w-full flex items-center justify-between p-3 text-xs font-bold uppercase text-[var(--vscode-text-primary)] hover:bg-[var(--vscode-hover)] transition-colors"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span>{title}</span>
        </div>
        {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>

      {isOpen && (
        <div className="p-3 pt-0 flex flex-col gap-3 border-t border-[var(--vscode-border-light)] mt-2">
          {children}
        </div>
      )}
    </div>
  );
};
