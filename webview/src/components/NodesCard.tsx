/**
 * NodesCard Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Renders the vertical menu bar navigation and slide-out category panels hosting
 * available pipeline nodes (SOURCES, STEPS, SINKS) for the Apache Beam Designer.
 * 
 * Architectural Decisions:
 * - Converts the previous horizontal tabs into a vertical menu bar on the left edge.
 * - Each category tab features distinct color theming:
 *   - SOURCES: Green theme (#10b981)
 *   - STEPS: Blue theme (#3b82f6)
 *   - SINKS: Red theme (#ef4444)
 * - The active tab displays a themed border, icon, and text matching the reference UI.
 * - Clicking an active tab or the panel close button ('✕') collapses the panel.
 * - Clicking an inactive enabled tab opens the corresponding category panel.
 * - Includes a live search bar for quickly finding transforms inside the active panel.
 * - Uses the 8pt grid system for all layout dimensions, paddings, and margins.
 */

import React, { useState, useMemo } from 'react';
import {
  Radio,
  Workflow,
  Share2,
  X,
  Search,
  ChevronRight,
} from 'lucide-react';
import { SidebarItem } from './SidebarItem';
import { InfoTooltip } from './InfoTooltip';

export interface NodesCardProps {
  /** Currently active tab: SOURCES | STEPS | SINKS */
  activeTab: string;
  /** Callback to change active tab */
  setActiveTab: (tab: any) => void;
  /** Total number of nodes on canvas to govern step/sink enablement */
  nodesCount: number;
  /** Legacy flag for PubSub source detection */
  hasPubSubSource?: boolean;
  /** Drag start handler for node placement */
  onDragStart: (event: React.DragEvent, nodeType: string, label: string, type: string, iconName: string, beamTransform?: string) => void;
  /** Optional callback to add node directly to canvas on '+' click */
  onAddNode?: (label: string, type: string, iconName: string, beamTransform?: string) => void;
  /** Controlled open state for panel */
  isOpen?: boolean;
  /** Callback when panel open state changes */
  onToggleOpen?: (open: boolean) => void;
}

interface NodeDefinition {
  label: string;
  type: 'SOURCE' | 'STEP' | 'SINK';
  iconName: string;
  beamTransform: string;
  badge: string;
  description: string;
  category: string;
}

// Source node definitions
const SOURCE_NODES: NodeDefinition[] = [
  // Streaming Sources
  { label: 'Kafka', type: 'SOURCE', iconName: 'Cable', beamTransform: 'KafkaIO', badge: 'Streaming', description: 'Consume streaming records from Kafka topic', category: 'Streaming Sources' },
  { label: 'PubSub', type: 'SOURCE', iconName: 'Radio', beamTransform: 'PubSubIO', badge: 'Queue', description: 'Read streaming messages from Cloud Pub/Sub', category: 'Streaming Sources' },
  { label: 'Generate Sequence', type: 'SOURCE', iconName: 'ListOrdered', beamTransform: 'GenerateSequence', badge: 'Synthetic', description: 'Generate periodic integer sequence', category: 'Streaming Sources' },
  { label: 'Periodic Impulse', type: 'SOURCE', iconName: 'Zap', beamTransform: 'PeriodicImpulse', badge: 'Trigger', description: 'Emit elements periodically on interval', category: 'Streaming Sources' },
  // Database Sources
  { label: 'BigQuery', type: 'SOURCE', iconName: 'Database', beamTransform: 'BigQueryIO', badge: 'Analytics', description: 'Read records from BigQuery table or SQL query', category: 'Database Sources' },
  { label: 'JdbcIO', type: 'SOURCE', iconName: 'Database', beamTransform: 'JdbcIO', badge: 'SQL', description: 'Query relational database over JDBC', category: 'Database Sources' },
  // File Sources
  { label: 'FileIO', type: 'SOURCE', iconName: 'Folder', beamTransform: 'FileIO', badge: 'Files', description: 'Match and read file streams', category: 'File Sources' },
  { label: 'TextIO', type: 'SOURCE', iconName: 'FileText', beamTransform: 'TextIO', badge: 'Text', description: 'Read newline-delimited text records', category: 'File Sources' },
  // Other Sources
  { label: 'Create', type: 'SOURCE', iconName: 'Box', beamTransform: 'Create', badge: 'Memory', description: 'Create in-memory static PCollection', category: 'Other Sources' },
];

// Step node definitions
const STEP_NODES: NodeDefinition[] = [
  // Core / Message Parsers
  { label: 'ParDo', type: 'STEP', iconName: 'Code', beamTransform: 'ParDo', badge: 'Core', description: 'Apply custom per-element DoFn transform', category: 'Core Transforms' },
  { label: 'Parse Message', type: 'STEP', iconName: 'FileCode', beamTransform: 'ParseMessage', badge: 'Parser', description: 'Parse structured JSON/Avro payload', category: 'Message Parsers' },
  // Element Transforms
  { label: 'Add Timestamp', type: 'STEP', iconName: 'Calendar', beamTransform: 'WithTimestamps', badge: 'Timestamp', description: 'Assign event timestamps to elements', category: 'Element Transforms' },
  { label: 'Filter', type: 'STEP', iconName: 'Filter', beamTransform: 'Filter', badge: 'Condition', description: 'Filter elements matching boolean predicate', category: 'Element Transforms' },
  { label: 'FlatMap', type: 'STEP', iconName: 'GitMerge', beamTransform: 'FlatMap', badge: '1-to-N', description: 'Map one element to zero or more elements', category: 'Element Transforms' },
  { label: 'Keys', type: 'STEP', iconName: 'Key', beamTransform: 'Keys', badge: 'Key-Value', description: 'Extract key components from KV pairs', category: 'Element Transforms' },
  { label: 'KV Mapper', type: 'STEP', iconName: 'Hash', beamTransform: 'KVMapper', badge: 'Mapping', description: 'Map elements to key-value pairs', category: 'Element Transforms' },
  { label: 'KV Swap', type: 'STEP', iconName: 'Shuffle', beamTransform: 'KvSwap', badge: 'Swap', description: 'Swap keys and values in KV pairs', category: 'Element Transforms' },
  { label: 'Map', type: 'STEP', iconName: 'Activity', beamTransform: 'Map', badge: '1-to-1', description: 'Transform elements with 1-to-1 function', category: 'Element Transforms' },
  { label: 'To String', type: 'STEP', iconName: 'Type', beamTransform: 'ToString', badge: 'Format', description: 'Convert elements into string representations', category: 'Element Transforms' },
  { label: 'Values', type: 'STEP', iconName: 'Grid', beamTransform: 'Values', badge: 'Values', description: 'Extract value components from KV pairs', category: 'Element Transforms' },
  // Aggregations
  { label: 'Approximate Quantiles', type: 'STEP', iconName: 'BarChart', beamTransform: 'ApproximateQuantiles', badge: 'Quantile', description: 'Compute approximate distribution quantiles', category: 'Aggregations' },
  { label: 'Approximate Unique', type: 'STEP', iconName: 'BarChart', beamTransform: 'ApproximateUnique', badge: 'Distinct', description: 'Estimate count of distinct elements', category: 'Aggregations' },
  { label: 'Batch Elements', type: 'STEP', iconName: 'BarChart', beamTransform: 'BatchElements', badge: 'Batch', description: 'Group elements into batches', category: 'Aggregations' },
  { label: 'Co Group By Key', type: 'STEP', iconName: 'BarChart', beamTransform: 'CoGroupByKey', badge: 'Co-Group', description: 'Group multiple PCollections by common key', category: 'Aggregations' },
  { label: 'Combine', type: 'STEP', iconName: 'BarChart', beamTransform: 'Combine', badge: 'Combine', description: 'Combine elements with associative function', category: 'Aggregations' },
  { label: 'Combine With Context', type: 'STEP', iconName: 'BarChart', beamTransform: 'CombineWithContext', badge: 'Context', description: 'Combine elements with pipeline side inputs', category: 'Aggregations' },
  { label: 'Count', type: 'STEP', iconName: 'BarChart', beamTransform: 'Count', badge: 'Counter', description: 'Count total occurrences of elements', category: 'Aggregations' },
  { label: 'Distinct', type: 'STEP', iconName: 'BarChart', beamTransform: 'Distinct', badge: 'Unique', description: 'Deduplicate elements in collection', category: 'Aggregations' },
  { label: 'Group By Key', type: 'STEP', iconName: 'BarChart', beamTransform: 'GroupByKey', badge: 'Group', description: 'Group PCollection of KV pairs by key', category: 'Aggregations' },
  { label: 'Group Into Batches', type: 'STEP', iconName: 'BarChart', beamTransform: 'GroupIntoBatches', badge: 'Bundle', description: 'Group elements into batched bundles', category: 'Aggregations' },
  { label: 'Latest', type: 'STEP', iconName: 'BarChart', beamTransform: 'Latest', badge: 'Latest', description: 'Select element with latest timestamp', category: 'Aggregations' },
  { label: 'Max', type: 'STEP', iconName: 'BarChart', beamTransform: 'Max', badge: 'Max', description: 'Calculate maximum value in collection', category: 'Aggregations' },
  { label: 'Mean', type: 'STEP', iconName: 'BarChart', beamTransform: 'Mean', badge: 'Average', description: 'Calculate arithmetic mean across values', category: 'Aggregations' },
  { label: 'Min', type: 'STEP', iconName: 'BarChart', beamTransform: 'Min', badge: 'Min', description: 'Calculate minimum value in collection', category: 'Aggregations' },
  { label: 'Sample', type: 'STEP', iconName: 'BarChart', beamTransform: 'Sample', badge: 'Sample', description: 'Extract random sample of elements', category: 'Aggregations' },
  { label: 'Sum', type: 'STEP', iconName: 'BarChart', beamTransform: 'Sum', badge: 'Sum', description: 'Calculate sum across numeric elements', category: 'Aggregations' },
  { label: 'Top', type: 'STEP', iconName: 'BarChart', beamTransform: 'Top', badge: 'Top-N', description: 'Extract top N elements', category: 'Aggregations' },
  // Windows
  { label: 'Window', type: 'STEP', iconName: 'Clock', beamTransform: 'WindowInto', badge: 'Windowing', description: 'Assign elements into fixed/sliding windows', category: 'Windows' },
  // Other
  { label: 'Flatten', type: 'STEP', iconName: 'Layers', beamTransform: 'Flatten', badge: 'Merge', description: 'Merge multiple PCollections into one', category: 'Other Transforms' },
  { label: 'ReShuffle', type: 'STEP', iconName: 'Shuffle', beamTransform: 'Reshuffle', badge: 'Partition', description: 'Redistribute elements evenly across workers', category: 'Other Transforms' },
];

// Sink node definitions
const SINK_NODES: NodeDefinition[] = [
  // Streaming Sinks
  { label: 'Kafka', type: 'SINK', iconName: 'Cable', beamTransform: 'KafkaIO', badge: 'Streaming', description: 'Publish records to Apache Kafka topic', category: 'Streaming Sinks' },
  { label: 'PubSub', type: 'SINK', iconName: 'Radio', beamTransform: 'PubSubIO', badge: 'Queue', description: 'Publish messages to Cloud Pub/Sub topic', category: 'Streaming Sinks' },
  // Database Sinks
  { label: 'BigQuery', type: 'SINK', iconName: 'Database', beamTransform: 'BigQueryIO', badge: 'Analytics', description: 'Write or stream rows into BigQuery table', category: 'Database Sinks' },
  { label: 'JdbcIO', type: 'SINK', iconName: 'Database', beamTransform: 'JdbcIO', badge: 'SQL', description: 'Write rows to SQL database via JDBC', category: 'Database Sinks' },
  // File Sinks
  { label: 'FileIO', type: 'SINK', iconName: 'Folder', beamTransform: 'FileIO', badge: 'Files', description: 'Write dynamic files to Cloud Storage/Disk', category: 'File Sinks' },
  { label: 'TextIO', type: 'SINK', iconName: 'FileText', beamTransform: 'TextIO', badge: 'Text', description: 'Write newline-delimited text records', category: 'File Sinks' },
  // Logging Sinks
  { label: 'Log Message', type: 'SINK', iconName: 'Terminal', beamTransform: 'LogMessage', badge: 'Debug', description: 'Emit structured logs for elements', category: 'Logging Sinks' },
];

/**
 * NodesCard Component
 * 
 * Displays the primary vertical navigation bar for adding Sources, Steps & Transforms, and Sinks.
 * Clicking any vertical tab opens a connected slide-out drawer panel with search and accordion groups.
 */
export const NodesCard: React.FC<NodesCardProps> = ({
  activeTab,
  setActiveTab,
  nodesCount,
  onDragStart,
  onAddNode,
  isOpen: controlledIsOpen,
  onToggleOpen,
}) => {
  const [internalIsOpen, setInternalIsOpen] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const isPanelOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;

  const setPanelOpen = (open: boolean) => {
    if (onToggleOpen) {
      onToggleOpen(open);
    } else {
      setInternalIsOpen(open);
    }
  };

  const handleTabClick = (tabKey: string, isDisabled: boolean) => {
    if (isDisabled) return;
    if (activeTab === tabKey && isPanelOpen) {
      // Clicking active tab closes the slide-out panel
      setPanelOpen(false);
    } else {
      setActiveTab(tabKey);
      setPanelOpen(true);
    }
  };

  const handleClosePanel = () => {
    setPanelOpen(false);
  };

  const currentItems = useMemo(() => {
    switch (activeTab) {
      case 'SOURCES':
        return SOURCE_NODES;
      case 'STEPS':
        return STEP_NODES;
      case 'SINKS':
        return SINK_NODES;
      default:
        return SOURCE_NODES;
    }
  }, [activeTab]);

  const categoryConfig = useMemo(() => {
    switch (activeTab) {
      case 'SOURCES':
        return {
          title: 'Sources',
          count: SOURCE_NODES.length,
          tooltip: 'Ingestion sources: drag or click + to add the initial pipeline step.',
          accentColor: 'emerald',
          borderColor: 'border-emerald-500/90',
          textColor: 'text-emerald-400',
          bgColor: 'bg-emerald-950/30',
          headerColor: 'text-emerald-400',
          icon: Radio,
        };
      case 'STEPS':
        return {
          title: 'Steps & Transforms',
          count: STEP_NODES.length,
          tooltip: 'Processing transforms: filter, map, aggregate, or window data in flight.',
          accentColor: 'blue',
          borderColor: 'border-blue-500/90',
          textColor: 'text-blue-400',
          bgColor: 'bg-blue-950/30',
          headerColor: 'text-blue-400',
          icon: Workflow,
        };
      case 'SINKS':
        return {
          title: 'Sinks',
          count: SINK_NODES.length,
          tooltip: 'Destination sinks: write output records to BigQuery, PubSub, Kafka, or Files.',
          accentColor: 'rose',
          borderColor: 'border-rose-500/90',
          textColor: 'text-rose-400',
          bgColor: 'bg-rose-950/30',
          headerColor: 'text-rose-400',
          icon: Share2,
        };
      default:
        return {
          title: 'Sources',
          count: SOURCE_NODES.length,
          tooltip: 'Pipeline sources',
          accentColor: 'emerald',
          borderColor: 'border-emerald-500/90',
          textColor: 'text-emerald-400',
          bgColor: 'bg-emerald-950/30',
          headerColor: 'text-emerald-400',
          icon: Radio,
        };
    }
  }, [activeTab]);

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return currentItems;
    const q = searchQuery.toLowerCase();
    return currentItems.filter(
      item =>
        item.label.toLowerCase().includes(q) ||
        item.badge.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
    );
  }, [currentItems, searchQuery]);

  // Group items by category
  const groupedCategories = useMemo(() => {
    const map = new Map<string, NodeDefinition[]>();
    filteredItems.forEach(item => {
      const list = map.get(item.category) || [];
      list.push(item);
      map.set(item.category, list);
    });
    return map;
  }, [filteredItems]);

  const HeaderIcon = categoryConfig.icon;

  return (
    <div className="absolute top-3 left-3 z-20 flex items-start select-none font-sans">
      {/* 1. Vertical Menu Bar (Left strip) */}
      <div className={`w-12 bg-[var(--vscode-workbench-bg)]/95 backdrop-blur-md border border-[var(--vscode-border)] ${isPanelOpen ? 'rounded-l-xl rounded-r-none border-r-0' : 'rounded-xl'} p-1 flex flex-col gap-1.5 shadow-2xl z-20 shrink-0`}>
        {/* Tab 1: SOURCES (Green Theme) */}
        <button
          type="button"
          onClick={() => handleTabClick('SOURCES', false)}
          title="Sources"
          aria-label="Sources Tab"
          className={`w-full py-2.5 px-0.5 rounded-lg flex flex-col items-center justify-between min-h-[92px] transition-all relative group cursor-pointer ${
            activeTab === 'SOURCES' && isPanelOpen
              ? 'border border-emerald-500/90 text-emerald-400 bg-emerald-500/10 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
              : 'border border-transparent text-[var(--vscode-text-muted)] hover:text-emerald-300 hover:bg-[var(--vscode-hover)]'
          }`}
        >
          <Radio className="w-3.5 h-3.5 mb-1.5 shrink-0" />
          <span className="text-[9px] font-bold tracking-[0.16em] uppercase [writing-mode:vertical-lr] rotate-180 my-1">
            SOURCES
          </span>
          <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center uppercase tracking-wider ${
            activeTab === 'SOURCES' && isPanelOpen
              ? 'bg-emerald-500/20 text-emerald-300'
              : 'bg-[var(--vscode-badge-bg)] text-[var(--vscode-text-muted)] group-hover:text-emerald-300'
          }`}>
            {SOURCE_NODES.length}
          </span>
        </button>

        {/* Tab 2: STEPS (Blue Theme) */}
        <button
          type="button"
          onClick={() => handleTabClick('STEPS', nodesCount === 0)}
          disabled={nodesCount === 0}
          title={nodesCount === 0 ? 'Add a Source first' : 'Steps & Transforms'}
          aria-label="Steps Tab"
          className={`w-full py-2.5 px-0.5 rounded-lg flex flex-col items-center justify-between min-h-[92px] transition-all relative group ${
            nodesCount === 0
              ? 'border border-transparent text-[var(--vscode-text-muted)] opacity-35 cursor-not-allowed'
              : activeTab === 'STEPS' && isPanelOpen
              ? 'border border-blue-500/90 text-blue-400 bg-blue-500/10 shadow-[0_0_10px_rgba(59,130,246,0.2)] cursor-pointer'
              : 'border border-transparent text-[var(--vscode-text-muted)] hover:text-blue-300 hover:bg-[var(--vscode-hover)] cursor-pointer'
          }`}
        >
          <Workflow className="w-3.5 h-3.5 mb-1.5 shrink-0" />
          <span className="text-[9px] font-bold tracking-[0.16em] uppercase [writing-mode:vertical-lr] rotate-180 my-1">
            STEPS
          </span>
          <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center uppercase tracking-wider ${
            activeTab === 'STEPS' && isPanelOpen
              ? 'bg-blue-500/20 text-blue-300'
              : 'bg-[var(--vscode-badge-bg)] text-[var(--vscode-text-muted)] group-hover:text-blue-300'
          }`}>
            {STEP_NODES.length}
          </span>
        </button>

        {/* Tab 3: SINKS (Red Theme) */}
        <button
          type="button"
          onClick={() => handleTabClick('SINKS', nodesCount === 0)}
          disabled={nodesCount === 0}
          title={nodesCount === 0 ? 'Add a Source first' : 'Sinks'}
          aria-label="Sinks Tab"
          className={`w-full py-2.5 px-0.5 rounded-lg flex flex-col items-center justify-between min-h-[92px] transition-all relative group ${
            nodesCount === 0
              ? 'border border-transparent text-[var(--vscode-text-muted)] opacity-35 cursor-not-allowed'
              : activeTab === 'SINKS' && isPanelOpen
              ? 'border border-rose-500/90 text-rose-400 bg-rose-500/10 shadow-[0_0_10px_rgba(244,63,94,0.2)] cursor-pointer'
              : 'border border-transparent text-[var(--vscode-text-muted)] hover:text-rose-300 hover:bg-[var(--vscode-hover)] cursor-pointer'
          }`}
        >
          <Share2 className="w-3.5 h-3.5 mb-1.5 shrink-0" />
          <span className="text-[9px] font-bold tracking-[0.16em] uppercase [writing-mode:vertical-lr] rotate-180 my-1">
            SINKS
          </span>
          <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center uppercase tracking-wider ${
            activeTab === 'SINKS' && isPanelOpen
              ? 'bg-rose-500/20 text-rose-300'
              : 'bg-[var(--vscode-badge-bg)] text-[var(--vscode-text-muted)] group-hover:text-rose-300'
          }`}>
            {SINK_NODES.length}
          </span>
        </button>
      </div>

      {/* 2. Slide-out Category Panel (Attached flush with 0px margin to the Right of Menu Bar) */}
      {isPanelOpen && (
        <div className="w-88 bg-[var(--vscode-workbench-bg)]/95 backdrop-blur-md border border-[var(--vscode-border)] rounded-r-xl rounded-l-none shadow-2xl flex flex-col max-h-[calc(100vh-80px)] ml-0 overflow-hidden z-10 animate-in fade-in slide-in-from-left-2 duration-150">
          {/* Panel Header */}
          <div className="flex items-center justify-between px-3.5 py-3 border-b border-[var(--vscode-border)] bg-[var(--vscode-subcard-bg)]">
            <div className="flex items-center gap-2">
              <HeaderIcon className={`w-4 h-4 ${categoryConfig.headerColor}`} />
              <h2 className="text-xs font-bold text-[var(--vscode-text-primary)] uppercase tracking-wider">
                {categoryConfig.title} ({categoryConfig.count})
              </h2>
            </div>
            <div className="flex items-center gap-1">
              <InfoTooltip text={categoryConfig.tooltip} position="bottom" />
              <button
                type="button"
                onClick={handleClosePanel}
                title="Close panel"
                aria-label="Close panel"
                className="p-1 text-[var(--vscode-text-muted)] hover:text-[var(--vscode-text-primary)] rounded-md hover:bg-[var(--vscode-hover)] transition-colors ml-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="p-2.5 border-b border-[var(--vscode-border-light)]">
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 absolute left-2.5 text-[var(--vscode-text-muted)] pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={`Search ${activeTab.toLowerCase()}...`}
                className="w-full bg-[var(--vscode-input-bg)] border border-[var(--vscode-border)] rounded-md pl-8 pr-7 py-1.5 text-xs text-[var(--vscode-text-primary)] placeholder-[var(--vscode-text-muted)] focus:outline-none focus:border-[var(--vscode-highlight)] focus:ring-1 focus:ring-[var(--vscode-highlight)] transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  title="Clear search"
                  className="absolute right-2 text-[var(--vscode-text-muted)] hover:text-[var(--vscode-text-primary)] p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Categorized List of Items */}
          <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
            {groupedCategories.size === 0 ? (
              <div className="text-center py-6 text-xs text-[var(--vscode-text-muted)]">
                No components matching "{searchQuery}"
              </div>
            ) : (
              Array.from(groupedCategories.entries()).map(([categoryName, items]) => (
                <details
                  key={`${categoryName}-${searchQuery ? 'search' : 'default'}`}
                  open={searchQuery.trim().length > 0 ? true : undefined}
                  className="group bg-[var(--vscode-card-bg)] border border-[var(--vscode-border-light)] rounded-lg overflow-hidden transition-all"
                >
                  {/* Sub-category Header with Chevron indicator */}
                  <summary className="flex items-center justify-between px-2.5 py-1.5 bg-[var(--vscode-hover)] hover:opacity-90 cursor-pointer text-[11px] font-semibold text-[var(--vscode-text-primary)] uppercase tracking-wider select-none list-none group-open:border-b group-open:border-[var(--vscode-border-light)]">
                    <span className="flex items-center gap-1.5">
                      <ChevronRight className="w-3 h-3 text-[var(--vscode-text-muted)] transition-transform duration-150 group-open:rotate-90 shrink-0" />
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        activeTab === 'SOURCES' ? 'bg-emerald-400' : activeTab === 'SINKS' ? 'bg-rose-400' : 'bg-blue-400'
                      }`} />
                      {categoryName}
                    </span>
                    <span className="text-[9px] font-normal lowercase tracking-normal text-[var(--vscode-text-muted)]">
                      drag to canvas
                    </span>
                  </summary>

                  {/* Node Cards */}
                  <div className="p-2 space-y-1.5">
                    {items.map(item => (
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
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
