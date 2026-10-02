/** @fileoverview Collapsible accordion group component for a palette category.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */
import React from 'react';
import { ChevronRight } from 'lucide-react';
import { SidebarItem } from '../SidebarItem';
import type { NodeDefinition } from '../../catalog/nodes';

/**
 * Props for the NodeGroupAccordion component.
 */
export interface NodeGroupAccordionProps {
  /** Display name of the category (e.g. 'Streaming Sources'). */
  categoryName: string;
  /** List of node definitions belonging to this category. */
  items: NodeDefinition[];
  /** Controlled open state of this accordion group. */
  isOpen: boolean;
  /** HTML name attribute for grouping native <details> elements. */
  groupName?: string;
  /** Currently active tab ('SOURCES', 'STEPS', 'SINKS'), controls category dot color. */
  activeTab?: string | null;
  /** Callback invoked when the accordion open state is toggled by the user. */
  onToggle: (open: boolean) => void;
  /** Handler invoked when a node card drag starts. */
  onDragStart: (
    event: React.DragEvent,
    nodeType: string,
    label: string,
    type: string,
    iconName: string,
    beamTransform?: string
  ) => void;
  /** Optional handler invoked when the add (+) button on a node card is clicked. */
  onAddNode?: (
    label: string,
    type: string,
    iconName: string,
    beamTransform?: string
  ) => void;
}

/**
 * Renders a collapsible accordion group with a header containing a chevron, category color dot,
 * and a list of draggable node items.
 */
export const NodeGroupAccordion: React.FC<NodeGroupAccordionProps> = ({
  categoryName,
  items,
  isOpen,
  groupName,
  activeTab,
  onToggle,
  onDragStart,
  onAddNode,
}) => {
  return (
    <details
      name={groupName}
      open={isOpen}
      onToggle={(e) => onToggle((e.currentTarget as HTMLDetailsElement).open)}
      className="group bg-[var(--vscode-card-bg,#1e293b)] border border-[var(--vscode-border-light,#334155)] rounded-lg overflow-hidden transition-all"
    >
      {/* Sub-category Header with Chevron indicator */}
      <summary className="flex items-center justify-between px-2.5 py-1.5 bg-[var(--vscode-hover,rgba(255,255,255,0.03))] hover:opacity-90 cursor-pointer text-[11px] font-semibold text-[var(--vscode-text-primary,#ffffff)] uppercase tracking-wider select-none list-none group-open:border-b group-open:border-[var(--vscode-border-light,#334155)]">
        <span className="flex items-center gap-1.5">
          <ChevronRight className="w-3 h-3 text-[var(--vscode-text-muted,#94a3b8)] transition-transform duration-150 group-open:rotate-90 shrink-0" />
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              activeTab === 'SOURCES'
                ? 'bg-emerald-400'
                : activeTab === 'SINKS'
                ? 'bg-rose-400'
                : 'bg-blue-400'
            }`}
          />
          {categoryName}
        </span>
        <span className="text-[9px] font-normal lowercase tracking-normal text-[var(--vscode-text-muted,#64748b)]">
          drag to canvas
        </span>
      </summary>

      {/* Node Cards */}
      <div className="p-2 space-y-1.5">
        {items.map((item) => (
          <SidebarItem
            key={item.label}
            label={item.label}
            type={item.type}
            iconName={item.iconName}
            beamTransform={item.beamTransform}
            badge={item.badge}
            description={item.description}
            onDragStart={onDragStart}
            onAddNode={onAddNode}
          />
        ))}
      </div>
    </details>
  );
};
