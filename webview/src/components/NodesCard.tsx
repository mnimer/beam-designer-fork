/**
 * NodesCard Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Renders the vertical node palette along the left edge of the diagram canvas and an attached
 * slide-out panel displaying available pipeline nodes categorized into SOURCES (Green), STEPS (Blue),
 * and SINKS (Red/Rose) with live search and group state persistence.
 * 
 * Architectural Decisions:
 * - Vertical menu strip on the left with vertical rotated text labels, category icons, and count badges.
 * - Color coding: Green for Sources, Blue for Steps, Red for Sinks.
 * - Dynamic list rendering with search input filtering across label, badge, description, and category.
 * - Direct add (+) and drag-and-drop support onto canvas.
 * - Persists accordion group open/closed states using VS Code webview state (vscode.getState/setState)
 *   with localStorage fallback so users' group preferences are preserved across file opens and sessions.
 * - Exclusive accordion behavior: When a category group is expanded, other groups in the same tab's panel
 *   automatically collapse to prevent the slide-out panel from overflowing vertically.
 * - Step and Sink menu items are disabled when nodesCount is 0 to enforce pipeline validity.
 * - Added MqttIO nodes to Streaming Sources and Streaming Sinks categories for IoT message broker streaming.
 * - Adheres strictly to the 8pt grid spacing system, VS Code semantic tokens, and Tailwind CSS styling.
 */
import React, { useState, useMemo } from 'react';
import { 
  Radio, 
  Workflow, 
  Share2, 
  BookOpen,
  FileCode2,
  X, 
  Search, 
  ChevronRight, 
  Info 
} from 'lucide-react';
import { SidebarItem } from './SidebarItem';

export type NodePaletteTab = 'SOURCES' | 'STEPS' | 'SINKS' | 'SAMPLES' | string;

/**
 * Interface representing a sample pipeline definition displayed in the Samples tab.
 */
export interface SamplePipeline {
  id: string;
  filename: string;
  title: string;
  description: string;
  category?: string;
  badge?: string;
  language?: string;
  runner?: string;
  content: string;
}

/**
 * Fallback sample pipeline definitions for standalone webview mode or offline rendering.
 */
export const DEFAULT_SAMPLES: SamplePipeline[] = [
  {
    id: 'generate-mock-data',
    filename: 'generate-mock-data.beam',
    title: 'Generate Mock Data',
    description: 'Pipeline flow: trigger ➔ generate mock data ➔ Log Message',
    category: 'Samples',
    badge: 'Java',
    language: 'Java',
    runner: 'Dataflow',
    content: ''
  }
];

const GROUPS_STORAGE_KEY = 'beam_node_groups_state';

/**
 * Default open state for all palette accordion groups.
 * To keep panels fitting comfortably on screen, only the first category group in each tab is open by default.
 */
export const defaultGroupOpenState: Record<string, boolean> = {
  sources_streaming_sources: true,
  sources_database_sources: false,
  sources_file_sources: false,
  sources_other_sources: false,
  steps_core_transforms: true,
  steps_message_parsers: false,
  steps_element_transforms: false,
  steps_aggregations: false,
  steps_windows: false,
  steps_other_transforms: false,
  sinks_streaming_sinks: true,
  sinks_database_sinks: false,
  sinks_file_sinks: false,
  sinks_logging_sinks: false,
  samples_sample_pipelines: true,
};

/**
 * Reads persisted group open/closed state from VS Code state (with localStorage fallback).
 */
export const getPersistedGroupState = (): Record<string, boolean> => {
  try {
    const vs = (window as any).vscode;
    if (vs?.getState) {
      const state = vs.getState();
      if (state && typeof state.nodePaletteGroups === 'object' && state.nodePaletteGroups !== null) {
        return { ...defaultGroupOpenState, ...state.nodePaletteGroups };
      }
    }
  } catch {
    // Ignore error
  }

  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(GROUPS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (typeof parsed === 'object' && parsed !== null) {
          return { ...defaultGroupOpenState, ...parsed };
        }
      }
    }
  } catch {
    // Ignore error
  }

  return defaultGroupOpenState;
};

/**
 * Persists group open/closed state into VS Code state (with localStorage fallback).
 */
export const persistGroupState = (groups: Record<string, boolean>): void => {
  try {
    const vs = (window as any).vscode;
    if (vs?.setState) {
      const current = vs.getState?.() || {};
      vs.setState({
        ...current,
        nodePaletteGroups: groups
      });
    }
  } catch {
    // Ignore error
  }

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify(groups));
    }
  } catch {
    // Ignore error
  }
};

interface NodesCardProps {
  activeTab: string | null;
  setActiveTab: (tab: string | null) => void;
  nodesCount: number;
  hasPubSubSource?: boolean;
  onDragStart: (event: React.DragEvent, nodeType: string, label: string, type: string, iconName: string, beamTransform?: string) => void;
  onAddNode?: (label: string, type: string, iconName: string, beamTransform?: string) => void;
  /** Discovered sample pipelines from resources/samples */
  samples?: SamplePipeline[];
  /** Handler invoked when a sample pipeline card is clicked */
  onOpenSample?: (sample: SamplePipeline) => void;
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
  { label: 'Kafka', type: 'SOURCE', iconName: 'Cable', beamTransform: 'KafkaIO', badge: 'Streaming', description: 'Consume streaming records from Kafka topic', category: 'Streaming Sources' },
  { label: 'Kinesis', type: 'SOURCE', iconName: 'Cloud', beamTransform: 'KinesisIO', badge: 'Streaming', description: 'Consume streaming records from AWS Kinesis stream', category: 'Streaming Sources' },
  { label: 'PubSub', type: 'SOURCE', iconName: 'Radio', beamTransform: 'PubSubIO', badge: 'Queue', description: 'Read streaming messages from Cloud Pub/Sub', category: 'Streaming Sources' },
  { label: 'SQS', type: 'SOURCE', iconName: 'Cable', beamTransform: 'SqsIO', badge: 'Queue', description: 'Read streaming messages from Amazon SQS queue', category: 'Streaming Sources' },
  { label: 'MQTT', type: 'SOURCE', iconName: 'Radio', beamTransform: 'MqttIO', badge: 'IoT', description: 'Consume streaming messages from MQTT broker topic', category: 'Streaming Sources' },
  { label: 'Generate Sequence', type: 'SOURCE', iconName: 'ListOrdered', beamTransform: 'GenerateSequence', badge: 'Synthetic', description: 'Generate periodic integer sequence', category: 'Streaming Sources' },
  { label: 'Periodic Impulse', type: 'SOURCE', iconName: 'Zap', beamTransform: 'PeriodicImpulse', badge: 'Trigger', description: 'Emit elements periodically on interval', category: 'Streaming Sources' },
  { label: 'BigQuery', type: 'SOURCE', iconName: 'Database', beamTransform: 'BigQueryIO', badge: 'Analytics', description: 'Read records from BigQuery table or SQL query', category: 'Database Sources' },
  { label: 'JdbcIO', type: 'SOURCE', iconName: 'Database', beamTransform: 'JdbcIO', badge: 'SQL', description: 'Query relational database over JDBC', category: 'Database Sources' },
  { label: 'FileIO', type: 'SOURCE', iconName: 'Folder', beamTransform: 'FileIO', badge: 'Files', description: 'Match and read file streams', category: 'File Sources' },
  { label: 'ParquetIO', type: 'SOURCE', iconName: 'FileCode', beamTransform: 'ParquetIO', badge: 'Parquet', description: 'Read columnar Parquet records', category: 'File Sources' },
  { label: 'TextIO', type: 'SOURCE', iconName: 'FileText', beamTransform: 'TextIO', badge: 'Text', description: 'Read newline-delimited text records', category: 'File Sources' },
  { label: 'AvroIO', type: 'SOURCE', iconName: 'FileCode', beamTransform: 'AvroIO', badge: 'Avro', description: 'Read records from Avro files', category: 'File Sources' },
  { label: 'Create', type: 'SOURCE', iconName: 'Box', beamTransform: 'Create', badge: 'Memory', description: 'Create in-memory static PCollection', category: 'Other Sources' },
];

// Step node definitions
const STEP_NODES: NodeDefinition[] = [
  { label: 'ParDo', type: 'STEP', iconName: 'Code', beamTransform: 'ParDo', badge: 'Core', description: 'Apply custom per-element DoFn transform', category: 'Core Transforms' },
  { label: 'Parse Message', type: 'STEP', iconName: 'FileCode', beamTransform: 'ParseMessage', badge: 'Parser', description: 'Parse structured JSON/Avro payload', category: 'Message Parsers' },
  { label: 'Add Timestamp', type: 'STEP', iconName: 'Calendar', beamTransform: 'WithTimestamps', badge: 'Timestamp', description: 'Assign event timestamps to elements', category: 'Element Transforms' },
  { label: 'Filter', type: 'STEP', iconName: 'Filter', beamTransform: 'Filter', badge: 'Condition', description: 'Filter elements matching boolean predicate', category: 'Element Transforms' },
  { label: 'FlatMap', type: 'STEP', iconName: 'GitMerge', beamTransform: 'FlatMap', badge: '1-to-N', description: 'Map one element to zero or more elements', category: 'Element Transforms' },
  { label: 'Keys', type: 'STEP', iconName: 'Key', beamTransform: 'Keys', badge: 'Key-Value', description: 'Extract key components from KV pairs', category: 'Element Transforms' },
  { label: 'KV Mapper', type: 'STEP', iconName: 'Hash', beamTransform: 'KVMapper', badge: 'Mapping', description: 'Map elements to key-value pairs', category: 'Element Transforms' },
  { label: 'KV Swap', type: 'STEP', iconName: 'Shuffle', beamTransform: 'KvSwap', badge: 'Swap', description: 'Swap keys and values in KV pairs', category: 'Element Transforms' },
  { label: 'Map', type: 'STEP', iconName: 'Activity', beamTransform: 'Map', badge: '1-to-1', description: 'Transform elements with 1-to-1 function', category: 'Element Transforms' },
  { label: 'To String', type: 'STEP', iconName: 'Type', beamTransform: 'ToString', badge: 'Format', description: 'Convert elements into string representations', category: 'Element Transforms' },
  { label: 'Values', type: 'STEP', iconName: 'Grid', beamTransform: 'Values', badge: 'Values', description: 'Extract value components from KV pairs', category: 'Element Transforms' },
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
  { label: 'Window', type: 'STEP', iconName: 'Clock', beamTransform: 'WindowInto', badge: 'Windowing', description: 'Assign elements into fixed/sliding windows', category: 'Windows' },
  { label: 'Flatten', type: 'STEP', iconName: 'Layers', beamTransform: 'Flatten', badge: 'Merge', description: 'Merge multiple PCollections into one', category: 'Other Transforms' },
  { label: 'ReShuffle', type: 'STEP', iconName: 'Shuffle', beamTransform: 'Reshuffle', badge: 'Partition', description: 'Redistribute elements evenly across workers', category: 'Other Transforms' },
];

// Sink node definitions
const SINK_NODES: NodeDefinition[] = [
  { label: 'Kafka', type: 'SINK', iconName: 'Cable', beamTransform: 'KafkaIO', badge: 'Streaming', description: 'Publish records to Apache Kafka topic', category: 'Streaming Sinks' },
  { label: 'Kinesis', type: 'SINK', iconName: 'Cloud', beamTransform: 'KinesisIO', badge: 'Streaming', description: 'Publish records to AWS Kinesis stream', category: 'Streaming Sinks' },
  { label: 'PubSub', type: 'SINK', iconName: 'Radio', beamTransform: 'PubSubIO', badge: 'Queue', description: 'Publish messages to Cloud Pub/Sub topic', category: 'Streaming Sinks' },
  { label: 'SQS', type: 'SINK', iconName: 'Cable', beamTransform: 'SqsIO', badge: 'Queue', description: 'Publish messages to Amazon SQS queue', category: 'Streaming Sinks' },
  { label: 'MQTT', type: 'SINK', iconName: 'Radio', beamTransform: 'MqttIO', badge: 'IoT', description: 'Publish streaming messages to MQTT broker topic', category: 'Streaming Sinks' },
  { label: 'BigQuery', type: 'SINK', iconName: 'Database', beamTransform: 'BigQueryIO', badge: 'Analytics', description: 'Write or stream rows into BigQuery table', category: 'Database Sinks' },
  { label: 'JdbcIO', type: 'SINK', iconName: 'Database', beamTransform: 'JdbcIO', badge: 'SQL', description: 'Write rows to SQL database via JDBC', category: 'Database Sinks' },
  { label: 'FileIO', type: 'SINK', iconName: 'Folder', beamTransform: 'FileIO', badge: 'Files', description: 'Write dynamic files to Cloud Storage/Disk', category: 'File Sinks' },
  { label: 'ParquetIO', type: 'SINK', iconName: 'FileCode', beamTransform: 'ParquetIO', badge: 'Parquet', description: 'Write columnar Parquet files', category: 'File Sinks' },
  { label: 'TextIO', type: 'SINK', iconName: 'FileText', beamTransform: 'TextIO', badge: 'Text', description: 'Write newline-delimited text records', category: 'File Sinks' },
  { label: 'AvroIO', type: 'SINK', iconName: 'FileCode', beamTransform: 'AvroIO', badge: 'Avro', description: 'Write records to Avro files', category: 'File Sinks' },
  { label: 'Log Message', type: 'SINK', iconName: 'Terminal', beamTransform: 'LogMessage', badge: 'Debug', description: 'Emit structured logs for elements', category: 'Logging Sinks' },
];

/**
 * Custom lightweight Info Tooltip component
 */
const InfoTooltip: React.FC<{ text: string; position?: 'top' | 'bottom' | 'right' }> = ({
  text,
  position = 'top'
}) => {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
        aria-label="Information tooltip"
        className="text-[var(--vscode-text-muted)] hover:text-[var(--vscode-text-primary)] transition-colors p-0.5 rounded cursor-pointer"
      >
        <Info className="w-3.5 h-3.5" />
      </button>
      {visible && (
        <div 
          role="tooltip"
          className={`absolute z-50 w-48 p-2 text-[10px] leading-tight text-white bg-slate-900/95 border border-slate-700 rounded-md shadow-xl pointer-events-none backdrop-blur-sm ${
            position === 'top' ? 'bottom-full left-1/2 -translate-x-1/2 mb-1.5' :
            position === 'bottom' ? 'top-full left-1/2 -translate-x-1/2 mt-1.5' :
            'left-full top-1/2 -translate-y-1/2 ml-1.5'
          }`}
        >
          {text}
        </div>
      )}
    </div>
  );
};

export const NodesCard: React.FC<NodesCardProps> = ({
  activeTab,
  setActiveTab,
  nodesCount,
  onDragStart,
  onAddNode,
  samples,
  onOpenSample,
  isOpen: controlledIsOpen,
  onToggleOpen,
}) => {
  const [internalIsOpen, setInternalIsOpen] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [groupOpenState, setGroupOpenState] = useState<Record<string, boolean>>(getPersistedGroupState);

  const availableSamples = useMemo(() => {
    return samples && samples.length > 0 ? samples : DEFAULT_SAMPLES;
  }, [samples]);

  const isPanelOpen = controlledIsOpen !== undefined ? (controlledIsOpen && activeTab !== null) : (internalIsOpen && activeTab !== null);

  const setPanelOpen = (open: boolean) => {
    if (onToggleOpen) {
      onToggleOpen(open);
    } else {
      setInternalIsOpen(open);
    }
  };

  /**
   * Toggles the open/closed state of an accordion group in the slide-out panel.
   * When a group is opened/expanded, all other groups in the active tab's panel are
   * automatically collapsed to prevent vertical overflow and keep the panel on screen.
   * 
   * @param groupKey - Unique group identifier (e.g. 'sources_streaming_sources')
   * @param isOpen - The new open state of the group
   */
  const handleToggleGroup = (groupKey: string, isOpen: boolean) => {
    setGroupOpenState((prev) => {
      let updated: Record<string, boolean>;
      if (isOpen) {
        // NOTE: Exclusive accordion behavior - collapse all other groups in the active tab
        const currentTabPrefix = `${(activeTab || 'sources').toLowerCase()}_`;
        updated = { ...prev };

        // Collapse all groups matching current tab prefix
        Object.keys(updated).forEach((key) => {
          if (key.startsWith(currentTabPrefix)) {
            updated[key] = false;
          }
        });

        // Expand only the targeted group
        updated[groupKey] = true;
      } else {
        // When closing the group, record it as closed
        updated = { ...prev, [groupKey]: false };
      }
      persistGroupState(updated);
      return updated;
    });
  };

  const handleTabClick = (tabKey: string, isDisabled: boolean) => {
    if (isDisabled) return;
    if (activeTab === tabKey && isPanelOpen) {
      // Clicking active tab closes the slide-out panel
      setPanelOpen(false);
      setActiveTab(null);
    } else {
      setActiveTab(tabKey);
      setPanelOpen(true);
    }
  };

  const handleClosePanel = () => {
    setPanelOpen(false);
    setActiveTab(null);
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
          headerColor: 'text-emerald-400',
          icon: Radio,
        };
      case 'STEPS':
        return {
          title: 'Steps & Transforms',
          count: STEP_NODES.length,
          tooltip: 'Processing transforms: filter, map, aggregate, or window data in flight.',
          headerColor: 'text-blue-400',
          icon: Workflow,
        };
      case 'SINKS':
        return {
          title: 'Sinks',
          count: SINK_NODES.length,
          tooltip: 'Destination sinks: write output records to BigQuery, PubSub, Kafka, or Files.',
          headerColor: 'text-rose-400',
          icon: Share2,
        };
      case 'SAMPLES':
        return {
          title: 'Samples',
          count: availableSamples.length,
          tooltip: 'Pre-configured sample pipelines: click to open as a new unsaved editor tab.',
          headerColor: 'text-amber-400',
          icon: BookOpen,
        };
      default:
        return {
          title: 'Sources',
          count: SOURCE_NODES.length,
          tooltip: 'Pipeline sources',
          headerColor: 'text-emerald-400',
          icon: Radio,
        };
    }
  }, [activeTab, availableSamples.length]);

  const filteredItems = useMemo(() => {
    if (activeTab === 'SAMPLES') return [];
    if (!searchQuery.trim()) return currentItems;
    const q = searchQuery.toLowerCase();
    return currentItems.filter(
      item =>
        item.label.toLowerCase().includes(q) ||
        item.badge.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
    );
  }, [activeTab, currentItems, searchQuery]);

  const filteredSamples = useMemo(() => {
    if (activeTab !== 'SAMPLES') return [];
    if (!searchQuery.trim()) return availableSamples;
    const q = searchQuery.toLowerCase();
    return availableSamples.filter(
      sample =>
        sample.title.toLowerCase().includes(q) ||
        sample.filename.toLowerCase().includes(q) ||
        sample.description.toLowerCase().includes(q) ||
        (sample.badge && sample.badge.toLowerCase().includes(q)) ||
        (sample.category && sample.category.toLowerCase().includes(q))
    );
  }, [activeTab, availableSamples, searchQuery]);

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
      <div className={`w-12 bg-[var(--vscode-workbench-bg,#151722)]/95 backdrop-blur-md border border-[var(--vscode-border,#334155)] ${isPanelOpen ? 'rounded-l-xl rounded-r-none border-r-0' : 'rounded-xl'} p-1 flex flex-col gap-1.5 shadow-2xl z-20 shrink-0`}>
        {/* Tab 1: SOURCES (Green Theme) */}
        <button
          type="button"
          onClick={() => handleTabClick('SOURCES', false)}
          title="Sources"
          aria-label="Sources Tab"
          className={`w-full py-2.5 px-0.5 rounded-lg flex flex-col items-center justify-between min-h-[92px] transition-all relative group cursor-pointer ${
            activeTab === 'SOURCES' && isPanelOpen
              ? 'border border-emerald-500/90 text-emerald-400 bg-emerald-500/10 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
              : 'border border-transparent text-[var(--vscode-text-muted,#64748b)] hover:text-emerald-300 hover:bg-[var(--vscode-hover,rgba(255,255,255,0.05))]'
          }`}
        >
          <Radio className="w-3.5 h-3.5 mb-1.5 shrink-0" />
          <span className="text-[9px] font-bold tracking-[0.16em] uppercase [writing-mode:vertical-lr] rotate-180 my-1">
            SOURCES
          </span>
          <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center uppercase tracking-wider ${
            activeTab === 'SOURCES' && isPanelOpen
              ? 'bg-emerald-500/20 text-emerald-300'
              : 'bg-[var(--vscode-badge-bg,#1e293b)] text-[var(--vscode-text-muted,#94a3b8)] group-hover:text-emerald-300'
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
              ? 'border border-transparent text-[var(--vscode-text-muted,#64748b)] opacity-35 cursor-not-allowed'
              : activeTab === 'STEPS' && isPanelOpen
              ? 'border border-blue-500/90 text-blue-400 bg-blue-500/10 shadow-[0_0_10px_rgba(59,130,246,0.2)] cursor-pointer'
              : 'border border-transparent text-[var(--vscode-text-muted,#64748b)] hover:text-blue-300 hover:bg-[var(--vscode-hover,rgba(255,255,255,0.05))] cursor-pointer'
          }`}
        >
          <Workflow className="w-3.5 h-3.5 mb-1.5 shrink-0" />
          <span className="text-[9px] font-bold tracking-[0.16em] uppercase [writing-mode:vertical-lr] rotate-180 my-1">
            STEPS
          </span>
          <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center uppercase tracking-wider ${
            activeTab === 'STEPS' && isPanelOpen
              ? 'bg-blue-500/20 text-blue-300'
              : 'bg-[var(--vscode-badge-bg,#1e293b)] text-[var(--vscode-text-muted,#94a3b8)] group-hover:text-blue-300'
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
              ? 'border border-transparent text-[var(--vscode-text-muted,#64748b)] opacity-35 cursor-not-allowed'
              : activeTab === 'SINKS' && isPanelOpen
              ? 'border border-rose-500/90 text-rose-400 bg-rose-500/10 shadow-[0_0_10px_rgba(244,63,94,0.2)] cursor-pointer'
              : 'border border-transparent text-[var(--vscode-text-muted,#64748b)] hover:text-rose-300 hover:bg-[var(--vscode-hover,rgba(255,255,255,0.05))] cursor-pointer'
          }`}
        >
          <Share2 className="w-3.5 h-3.5 mb-1.5 shrink-0" />
          <span className="text-[9px] font-bold tracking-[0.16em] uppercase [writing-mode:vertical-lr] rotate-180 my-1">
            SINKS
          </span>
          <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center uppercase tracking-wider ${
            activeTab === 'SINKS' && isPanelOpen
              ? 'bg-rose-500/20 text-rose-300'
              : 'bg-[var(--vscode-badge-bg,#1e293b)] text-[var(--vscode-text-muted,#94a3b8)] group-hover:text-rose-300'
          }`}>
            {SINK_NODES.length}
          </span>
        </button>

        {/* Tab 4: SAMPLES (Yellow / Amber Theme) */}
        <button
          type="button"
          onClick={() => handleTabClick('SAMPLES', false)}
          title="Sample Pipelines"
          aria-label="Samples Tab"
          className={`w-full py-2.5 px-0.5 rounded-lg flex flex-col items-center justify-between min-h-[92px] transition-all relative group cursor-pointer ${
            activeTab === 'SAMPLES' && isPanelOpen
              ? 'border border-amber-500/90 text-amber-400 bg-amber-500/10 shadow-[0_0_10px_rgba(245,158,11,0.2)]'
              : 'border border-transparent text-[var(--vscode-text-muted,#64748b)] hover:text-amber-300 hover:bg-[var(--vscode-hover,rgba(255,255,255,0.05))]'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5 mb-1.5 shrink-0" />
          <span className="text-[9px] font-bold tracking-[0.16em] uppercase [writing-mode:vertical-lr] rotate-180 my-1">
            SAMPLES
          </span>
          <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center uppercase tracking-wider ${
            activeTab === 'SAMPLES' && isPanelOpen
              ? 'bg-amber-500/20 text-amber-300'
              : 'bg-[var(--vscode-badge-bg,#1e293b)] text-[var(--vscode-text-muted,#94a3b8)] group-hover:text-amber-300'
          }`}>
            {availableSamples.length}
          </span>
        </button>
      </div>

      {/* 2. Slide-out Category Panel */}
      {isPanelOpen && (
        <div className="w-88 bg-[var(--vscode-workbench-bg,#151722)]/95 backdrop-blur-md border border-[var(--vscode-border,#334155)] rounded-r-xl rounded-l-none shadow-2xl flex flex-col max-h-[calc(100vh-80px)] ml-0 overflow-hidden z-10 animate-in fade-in slide-in-from-left-2 duration-150">
          {/* Panel Header */}
          <div className="flex items-center justify-between px-3.5 py-3 border-b border-[var(--vscode-border,#334155)] bg-[var(--vscode-subcard-bg,#1E202A)]">
            <div className="flex items-center gap-2">
              <HeaderIcon className={`w-4 h-4 ${categoryConfig.headerColor}`} />
              <h2 className="text-xs font-bold text-[var(--vscode-text-primary,#ffffff)] uppercase tracking-wider">
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
                className="p-1 text-[var(--vscode-text-muted,#94a3b8)] hover:text-[var(--vscode-text-primary,#ffffff)] rounded-md hover:bg-[var(--vscode-hover,rgba(255,255,255,0.05))] transition-colors ml-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="p-2.5 border-b border-[var(--vscode-border-light,#334155)]">
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 absolute left-2.5 text-[var(--vscode-text-muted,#94a3b8)] pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={`Search ${(activeTab || 'sources').toLowerCase()}...`}
                className="w-full bg-[var(--vscode-input-bg,#0f172a)] border border-[var(--vscode-border,#334155)] rounded-md pl-8 pr-7 py-1.5 text-xs text-[var(--vscode-text-primary,#ffffff)] placeholder-[var(--vscode-text-muted,#64748b)] focus:outline-none focus:border-[var(--vscode-highlight,#3b82f6)] focus:ring-1 focus:ring-[var(--vscode-highlight,#3b82f6)] transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  title="Clear search"
                  className="absolute right-2 text-[var(--vscode-text-muted,#94a3b8)] hover:text-[var(--vscode-text-primary,#ffffff)] p-0.5 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* List of Items: Distinct layout for SAMPLES vs Node palette */}
          {activeTab === 'SAMPLES' ? (
            <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
              {filteredSamples.length === 0 ? (
                <div className="text-center py-6 text-xs text-[var(--vscode-text-muted,#94a3b8)]">
                  No sample pipelines matching "{searchQuery}"
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredSamples.map((sample) => (
                    <div
                      key={sample.id || sample.filename}
                      role="button"
                      tabIndex={0}
                      onClick={() => onOpenSample && onOpenSample(sample)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onOpenSample && onOpenSample(sample);
                        }
                      }}
                      title={`Click to open ${sample.title} (${sample.filename}) as a new file tab`}
                      className="group/item bg-[var(--vscode-card-bg,#1e293b)] hover:bg-[var(--vscode-hover,rgba(255,255,255,0.06))] border border-[var(--vscode-border-light,#334155)] hover:border-amber-500/70 rounded-lg p-2.5 cursor-pointer transition-all flex flex-col gap-1.5 shadow-sm focus:outline-none focus:ring-1 focus:ring-amber-400"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="p-1.5 bg-amber-500/10 text-amber-400 rounded-md shrink-0 group-hover/item:bg-amber-500/20 group-hover/item:text-amber-300 transition-colors">
                            <FileCode2 className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-[var(--vscode-text-primary,#ffffff)] group-hover/item:text-amber-300 transition-colors truncate">
                              {sample.title}
                            </div>
                            <div className="text-[10px] text-[var(--vscode-text-muted,#94a3b8)] font-mono truncate">
                              {sample.filename}
                            </div>
                          </div>
                        </div>
                        {sample.badge && (
                          <span className="bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0">
                            {sample.badge}
                          </span>
                        )}
                      </div>

                      {sample.description && (
                        <p className="text-[11px] leading-snug text-[var(--vscode-text-muted,#94a3b8)]">
                          {sample.description}
                        </p>
                      )}

                      <div className="flex items-center justify-between pt-1 border-t border-[var(--vscode-border-light,#334155)]/50 text-[10px] text-[var(--vscode-text-muted,#64748b)] group-hover/item:text-amber-400 transition-colors">
                        <span>Open sample</span>
                        <span className="font-semibold text-amber-400 group-hover/item:translate-x-0.5 transition-transform">➔</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
              {groupedCategories.size === 0 ? (
                <div className="text-center py-6 text-xs text-[var(--vscode-text-muted,#94a3b8)]">
                  No components matching "{searchQuery}"
                </div>
              ) : (
                Array.from(groupedCategories.entries()).map(([categoryName, items]) => {
                  const groupKey = `${(activeTab || 'sources').toLowerCase()}_${categoryName.toLowerCase().replace(/\s+/g, '_')}`;
                  return (
                    <details
                      key={`${categoryName}-${searchQuery ? 'search' : 'default'}`}
                      name={`palette-${(activeTab || 'sources').toLowerCase()}`}
                      open={searchQuery.trim().length > 0 ? true : (groupOpenState[groupKey] ?? false)}
                      onToggle={(e) => handleToggleGroup(groupKey, (e.currentTarget as HTMLDetailsElement).open)}
                      className="group bg-[var(--vscode-card-bg,#1e293b)] border border-[var(--vscode-border-light,#334155)] rounded-lg overflow-hidden transition-all"
                    >
                      {/* Sub-category Header with Chevron indicator */}
                      <summary className="flex items-center justify-between px-2.5 py-1.5 bg-[var(--vscode-hover,rgba(255,255,255,0.03))] hover:opacity-90 cursor-pointer text-[11px] font-semibold text-[var(--vscode-text-primary,#ffffff)] uppercase tracking-wider select-none list-none group-open:border-b group-open:border-[var(--vscode-border-light,#334155)]">
                        <span className="flex items-center gap-1.5">
                          <ChevronRight className="w-3 h-3 text-[var(--vscode-text-muted,#94a3b8)] transition-transform duration-150 group-open:rotate-90 shrink-0" />
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            activeTab === 'SOURCES' ? 'bg-emerald-400' : activeTab === 'SINKS' ? 'bg-rose-400' : 'bg-blue-400'
                          }`} />
                          {categoryName}
                        </span>
                        <span className="text-[9px] font-normal lowercase tracking-normal text-[var(--vscode-text-muted,#64748b)]">
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
                  );
                })
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
