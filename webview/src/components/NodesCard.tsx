/** @fileoverview NodesCard Component
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Renders the vertical node palette along the left edge of the diagram canvas and an attached
 * slide-out panel displaying available pipeline nodes categorized into SOURCES (Green), STEPS (Blue),
 * and SINKS (Red/Rose) with live search and group state persistence.
 *
 * Architectural Decisions:
 * - Composes focused palette sub-components: PaletteTabBar, NodeGroupAccordion, and SamplesTabPanel.
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
 * - Added the Databases/NoSQL connector family to Database Sources and Database Sinks: CassandraIO, HBaseIO,
 *   KuduIO, MongoDbIO, and RedisIO. NOTE: categories are grouped dynamically from NodeDefinition.category,
 *   so introducing a new category name here is sufficient to render it — but any new category also needs a
 *   matching `${tab}_${category}` key in defaultGroupOpenState to control its default accordion state.
 * - Added AmqpIO, RabbitMqIO, PulsarIO, and SolaceIO nodes to Streaming Sources and Streaming Sinks
 *   (IO15, IO20, IO62, IO63). All four are Java-native connectors reached from Python via a cross-language
 *   expansion service, which the property panels configure.
 * - Added FlinkStreamingImpulseSource (IO49) under the new Data Services Sources / Data Services Sinks groups
 *   rather than Streaming, because it is Python-only and executes exclusively on the Flink runner.
 * - Adheres strictly to the 8pt grid spacing system, VS Code semantic tokens, and Tailwind CSS styling.
 */
import React, { useState, useMemo } from 'react';
import {
  Radio,
  Workflow,
  Share2,
  BookOpen,
  X,
  Search
} from 'lucide-react';
import { InfoTooltip } from './InfoTooltip';
import { PaletteTabBar } from './palette/PaletteTabBar';
import { NodeGroupAccordion } from './palette/NodeGroupAccordion';
import { SamplesTabPanel } from './palette/SamplesTabPanel';
import {
  SOURCE_NODES,
  STEP_NODES,
  SINK_NODES,
  type NodeDefinition,
} from '../catalog/nodes';
import {
  DEFAULT_SAMPLES,
  type SamplePipeline,
} from '../catalog/samples';
import {
  getPersistedGroupState,
  persistGroupState,
} from '../catalog/paletteGroupState';

export type NodePaletteTab = 'SOURCES' | 'STEPS' | 'SINKS' | 'SAMPLES' | string;

export { SOURCE_NODES, STEP_NODES, SINK_NODES } from '../catalog/nodes';
export type { NodeDefinition } from '../catalog/nodes';
export { DEFAULT_SAMPLES } from '../catalog/samples';
export type { SamplePipeline } from '../catalog/samples';
export {
  GROUPS_STORAGE_KEY,
  defaultGroupOpenState,
  getPersistedGroupState,
  persistGroupState,
} from '../catalog/paletteGroupState';

/**
 * Props for the NodesCard component.
 */
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

/**
 * Main palette component rendering the left tab bar and slide-out node/sample drawer.
 */
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
    const q = searchQuery.trim().toLowerCase();
    const list = !q
      ? availableSamples
      : availableSamples.filter(
          sample =>
            sample.title.toLowerCase().includes(q) ||
            sample.filename.toLowerCase().includes(q) ||
            sample.description.toLowerCase().includes(q) ||
            (sample.badge && sample.badge.toLowerCase().includes(q)) ||
            (sample.category && sample.category.toLowerCase().includes(q))
        );
    return [...list].sort((a, b) =>
      a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })
    );
  }, [activeTab, availableSamples, searchQuery]);

  // Group items by category and sort items in each category alphabetically
  const groupedCategories = useMemo(() => {
    const map = new Map<string, NodeDefinition[]>();
    filteredItems.forEach(item => {
      const list = map.get(item.category) || [];
      list.push(item);
      map.set(item.category, list);
    });
    map.forEach((list, category) => {
      list.sort((a, b) =>
        a.label.localeCompare(b.label, undefined, { sensitivity: 'base' })
      );
      map.set(category, list);
    });
    return map;
  }, [filteredItems]);

  const HeaderIcon = categoryConfig.icon;

  return (
    <div className="absolute top-3 bottom-3 left-3 h-[calc(100%-1.5rem)] max-h-[calc(100%-1.5rem)] z-20 flex items-start select-none font-sans pointer-events-none">
      {/* 1. Vertical Menu Bar (Left strip) */}
      <PaletteTabBar
        activeTab={activeTab}
        isPanelOpen={isPanelOpen}
        nodesCount={nodesCount}
        sourcesCount={SOURCE_NODES.length}
        stepsCount={STEP_NODES.length}
        sinksCount={SINK_NODES.length}
        samplesCount={availableSamples.length}
        onTabClick={handleTabClick}
      />

      {/* 2. Slide-out Category Panel */}
      {isPanelOpen && (
        <div className="w-88 h-full max-h-full min-h-0 bg-[var(--vscode-workbench-bg,#151722)]/95 backdrop-blur-md border border-[var(--vscode-border,#334155)] rounded-r-xl rounded-l-none shadow-2xl flex flex-col ml-0 overflow-hidden z-10 animate-in fade-in slide-in-from-left-2 duration-150 pointer-events-auto">
          {/* Panel Header */}
          <div className="shrink-0 flex items-center justify-between px-3.5 py-3 border-b border-[var(--vscode-border,#334155)] bg-[var(--vscode-subcard-bg,#1E202A)]">
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
          <div className="shrink-0 p-2.5 border-b border-[var(--vscode-border-light,#334155)]">
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
            <SamplesTabPanel
              samples={filteredSamples}
              searchQuery={searchQuery}
              onOpenSample={onOpenSample}
            />
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto p-2.5 space-y-2">
              {groupedCategories.size === 0 ? (
                <div className="text-center py-6 text-xs text-[var(--vscode-text-muted,#94a3b8)]">
                  No components matching &quot;{searchQuery}&quot;
                </div>
              ) : (
                Array.from(groupedCategories.entries()).map(([categoryName, items]) => {
                  const groupKey = `${(activeTab || 'sources').toLowerCase()}_${categoryName.toLowerCase().replace(/\s+/g, '_')}`;
                  return (
                    <NodeGroupAccordion
                      key={`${categoryName}-${searchQuery ? 'search' : 'default'}`}
                      categoryName={categoryName}
                      items={items}
                      isOpen={searchQuery.trim().length > 0 ? true : (groupOpenState[groupKey] ?? false)}
                      groupName={`palette-${(activeTab || 'sources').toLowerCase()}`}
                      activeTab={activeTab}
                      onToggle={(open) => handleToggleGroup(groupKey, open)}
                      onDragStart={onDragStart}
                      onAddNode={onAddNode}
                    />
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
