/**
 * SidebarItem Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * This component represents a draggable and clickable card item in the sidebar panels.
 * It displays an icon, node label, category badge, transform description, and an add button
 * to place nodes onto the React Flow canvas.
 * 
 * Architectural Decisions:
 * - Uses HTML5 drag and drop dataTransfer to transmit nodeType, label, type, iconName, and beamTransform.
 * - Supports instant canvas placement via an interactive '+' button.
 * - Adheres strictly to the 8pt grid system for spacing and sizing.
 * - Dynamically adapts styling based on category type (Green for SOURCES, Blue for STEPS, Red for SINKS).
 */

import React from 'react';
import {
  GripVertical,
  Plus,
  Radio,
  Database,
  Cable,
  Share2,
  HardDrive,
  Cloud,
  Clock,
  Layers,
  BarChart,
  Box,
  FileCode,
  Terminal,
  Calendar,
  Filter,
  GitMerge,
  Key,
  Hash,
  Shuffle,
  Activity,
  Type,
  Grid,
  Code,
  FileText,
  Folder,
  ListOrdered,
  Zap,
  Workflow,
  Cpu,
  ArrowDownToLine,
  ArrowUpFromLine,
  Wrench
} from 'lucide-react';

const iconComponentMap: Record<string, any> = {
  Radio, Database, Cable, Share2, HardDrive, Cloud, Clock, Layers, BarChart, Box, FileCode, Terminal,
  Calendar, Filter, GitMerge, Key, Hash, Shuffle, Activity, Type, Grid, Code, FileText, Folder, ListOrdered, Zap,
  Workflow, Cpu, ArrowDownToLine, ArrowUpFromLine, Wrench
};

export interface SidebarItemProps {
  /** Display label for the node */
  label: string;
  /** Node category type: SOURCE, STEP, or SINK */
  type: 'SOURCE' | 'STEP' | 'SINK' | string;
  /** Name of the Lucide icon */
  iconName: string;
  /** Optional Apache Beam transform identifier */
  beamTransform?: string;
  /** Optional badge text indicating subtype or feature (e.g., Streaming, Database) */
  badge?: string;
  /** Short summary or description of the node function */
  description?: string;
  /** Drag start handler */
  onDragStart: (event: React.DragEvent, nodeType: string, label: string, type: string, iconName: string, beamTransform?: string) => void;
  /** Optional click handler to add node directly to canvas */
  onAddNode?: (label: string, type: string, iconName: string, beamTransform?: string) => void;
}

/**
 * Returns color classes tailored to the node category type.
 * Sources: Green theme (#10b981)
 * Steps: Blue theme (#3b82f6)
 * Sinks: Red theme (#ef4444)
 */
const getThemeClasses = (type: string) => {
  switch (type) {
    case 'SOURCE':
      return {
        cardBorder: 'border-emerald-500/30 hover:border-emerald-500/70',
        iconBox: 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10',
        icon: 'text-emerald-400',
        badge: 'bg-emerald-950/60 text-emerald-300 border-emerald-500/30',
      };
    case 'SINK':
      return {
        cardBorder: 'border-rose-500/30 hover:border-rose-500/70',
        iconBox: 'border-rose-500/40 text-rose-400 bg-rose-500/10',
        icon: 'text-rose-400',
        badge: 'bg-rose-950/60 text-rose-300 border-rose-500/30',
      };
    case 'STEP':
    default:
      return {
        cardBorder: 'border-blue-500/30 hover:border-blue-500/70',
        iconBox: 'border-blue-500/40 text-blue-400 bg-blue-500/10',
        icon: 'text-blue-400',
        badge: 'bg-blue-950/60 text-blue-300 border-blue-500/30',
      };
  }
};

/**
 * SidebarItem component rendering a node palette card.
 */
export const SidebarItem: React.FC<SidebarItemProps> = ({
  label,
  type,
  iconName,
  beamTransform,
  badge,
  description,
  onDragStart,
  onAddNode
}) => {
  // Retrieve the matching Lucide icon component
  const IconComponent = iconComponentMap[iconName] || Box;
  const theme = getThemeClasses(type);

  /**
   * Handle drag start event by forwarding node payload to parent handler.
   */
  const handleDragStart = (e: React.DragEvent) => {
    onDragStart(e, 'pipeline', label, type, iconName, beamTransform);
  };

  /**
   * Handle add button click event.
   */
  const handleAddClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onAddNode) {
      onAddNode(label, type, iconName, beamTransform);
    }
  };

  return (
    <div
      className={`group relative flex items-center justify-between p-2 rounded-lg bg-[var(--vscode-card-bg)] hover:bg-[var(--vscode-hover)] border ${theme.cardBorder} transition-all cursor-grab active:cursor-grabbing shadow-sm select-none`}
      draggable
      onDragStart={handleDragStart}
      data-testid={`sidebar-item-${label.replace(/\s+/g, '-').toLowerCase()}`}
    >
      {/* Left Item Details */}
      <div className="flex items-center gap-2 min-w-0 flex-1 mr-1">
        {/* 6-dot Drag Handle */}
        <GripVertical
          className="w-3.5 h-3.5 text-[var(--vscode-text-muted)] group-hover:text-[var(--vscode-text-secondary)] shrink-0"
          aria-hidden="true"
        />

        {/* Themed Icon Box */}
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center border shrink-0 transition-colors ${theme.iconBox}`}
        >
          <IconComponent className={`w-4 h-4 ${theme.icon}`} />
        </div>

        {/* Text Details */}
        <div className="flex flex-col min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-semibold text-[var(--vscode-text-primary)] truncate">{label}</span>
            {badge && (
              <span
                className={`text-[9px] font-semibold px-1.5 py-0.2 rounded border uppercase tracking-wider ${theme.badge}`}
              >
                {badge}
              </span>
            )}
          </div>
          {description && (
            <span className="text-[10px] text-[var(--vscode-text-muted)] truncate max-w-[200px]" title={description}>
              {description}
            </span>
          )}
        </div>
      </div>

      {/* Add Button */}
      {onAddNode && (
        <button
          type="button"
          onClick={handleAddClick}
          title={`Add ${label} to canvas`}
          aria-label={`Add ${label}`}
          className="w-6 h-6 rounded flex items-center justify-center bg-[var(--vscode-button-secondary)] hover:bg-[var(--vscode-hover)] text-[var(--vscode-text-secondary)] hover:text-[var(--vscode-text-primary)] border border-[var(--vscode-border-light)] transition-colors shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};
