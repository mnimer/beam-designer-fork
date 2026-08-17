import React from 'react';
import { Search } from 'lucide-react';
import { SidebarItem } from './SidebarItem';

/**
 * NodesCard Component
 * 
 * This component renders the floating card containing the list of available nodes
 * that can be dragged onto the canvas. It includes tabs to filter by type (Sources, Steps, Sinks).
 * 
 * Architectural Decisions:
 * - Floating card positioned on the left side of the canvas.
 * - Uses SidebarItem for individual node items.
 * - Disables Steps and Sinks tabs if no nodes are present (as per original logic).
 */
interface NodesCardProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  nodesCount: number;
  hasPubSubSource?: boolean;
  onDragStart: (event: React.DragEvent, nodeType: string, label: string, type: string, iconName: string, beamTransform?: string) => void;
}

export const NodesCard: React.FC<NodesCardProps> = ({ activeTab, setActiveTab, nodesCount, onDragStart }) => {
  return (
    <div className="absolute top-4 left-4 z-10 w-72 bg-slate-800/90 p-4 flex flex-col gap-4 rounded-lg border border-slate-700 shadow-lg backdrop-blur-sm max-h-[calc(100%-2rem)] overflow-y-auto">
      <div className="flex justify-between items-center">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">Nodes</h2>
        <Search className="w-4 h-4 text-slate-400 cursor-pointer" />
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-700">
        <button
          className={`flex-1 pb-2 text-xs font-semibold tracking-wider ${activeTab === 'SOURCES' ? 'text-white border-b-2 border-white' : 'text-slate-500'}`}
          onClick={() => setActiveTab('SOURCES')}
        >
          SOURCES
        </button>
        <button
          className={`flex-1 pb-2 text-xs font-semibold tracking-wider ${nodesCount === 0 ? 'text-slate-600 cursor-not-allowed' : activeTab === 'STEPS' ? 'text-white border-b-2 border-white' : 'text-slate-500'}`}
          onClick={() => nodesCount > 0 && setActiveTab('STEPS')}
          disabled={nodesCount === 0}
        >
          STEPS
        </button>
        <button
          className={`flex-1 pb-2 text-xs font-semibold tracking-wider ${nodesCount === 0 ? 'text-slate-600 cursor-not-allowed' : activeTab === 'SINKS' ? 'text-white border-b-2 border-white' : 'text-slate-500'}`}
          onClick={() => nodesCount > 0 && setActiveTab('SINKS')}
          disabled={nodesCount === 0}
        >
          SINKS
        </button>
      </div>

      {/* Tab Content */}
      <div className="grid grid-cols-3 gap-2.5 mt-2">
        {activeTab === 'SOURCES' && (
          <div className="col-span-3 flex flex-col gap-2">
            {/* Streaming Sources Section */}
            <details className="bg-slate-700/50 rounded-md">
              <summary className="p-2 cursor-pointer text-[11px] font-semibold text-slate-300 uppercase tracking-wider">Streaming Sources</summary>
              <div className="grid grid-cols-3 gap-2 p-2">
                <SidebarItem label="PubSub" type="SOURCE" iconName="Radio" beamTransform="PubSubIO" onDragStart={onDragStart} />
              </div>
            </details>
            {/* Batch Sources Section */}
            <details className="bg-slate-700/50 rounded-md">
              <summary className="p-2 cursor-pointer text-[11px] font-semibold text-slate-300 uppercase tracking-wider">Batch Sources</summary>
              <div className="grid grid-cols-3 gap-2 p-2">
                <SidebarItem label="BigQuery" type="SOURCE" iconName="Database" beamTransform="BigQueryIO" onDragStart={onDragStart} />
              </div>
            </details>
            {/* Other Sources Section */}
            <details className="bg-slate-700/50 rounded-md">
              <summary className="p-2 cursor-pointer text-[11px] font-semibold text-slate-300 uppercase tracking-wider">Other</summary>
              <div className="grid grid-cols-3 gap-2 p-2">
                <SidebarItem label="Create" type="SOURCE" iconName="Box" beamTransform="Create" onDragStart={onDragStart} />
              </div>
            </details>
          </div>
        )}
        {activeTab === 'STEPS' && (
          <div className="col-span-3 flex flex-col gap-2">
            <div className="grid grid-cols-3 gap-2">
              <SidebarItem label="ParDo" type="STEP" iconName="Code" beamTransform="ParDo" onDragStart={onDragStart} />
            </div>
            <details className="bg-slate-700/50 rounded-md">
              <summary className="p-2 cursor-pointer text-[11px] font-semibold text-slate-300 uppercase tracking-wider">Message Parsers</summary>
              <div className="grid grid-cols-3 gap-2 p-2">
                <SidebarItem label="Parse Message" type="STEP" iconName="FileCode" beamTransform="ParseMessage" onDragStart={onDragStart} />
              </div>
            </details>
            <details className="bg-slate-700/50 rounded-md">
              <summary className="p-2 cursor-pointer text-[11px] font-semibold text-slate-300 uppercase tracking-wider">Element Transforms</summary>
              <div className="grid grid-cols-3 gap-2 p-2">
                <SidebarItem label="Add Timestamp" type="STEP" iconName="Calendar" beamTransform="WithTimestamps" onDragStart={onDragStart} />
                <SidebarItem label="Filter" type="STEP" iconName="Filter" beamTransform="Filter" onDragStart={onDragStart} />
                <SidebarItem label="FlatMap" type="STEP" iconName="GitMerge" beamTransform="FlatMap" onDragStart={onDragStart} />
                <SidebarItem label="Keys" type="STEP" iconName="Key" beamTransform="Keys" onDragStart={onDragStart} />
                <SidebarItem label="KV Mapper" type="STEP" iconName="Hash" beamTransform="KVMapper" onDragStart={onDragStart} />
                <SidebarItem label="KV Swap" type="STEP" iconName="Shuffle" beamTransform="KvSwap" onDragStart={onDragStart} />
                <SidebarItem label="Map" type="STEP" iconName="Activity" beamTransform="Map" onDragStart={onDragStart} />
                <SidebarItem label="To String" type="STEP" iconName="Type" beamTransform="ToString" onDragStart={onDragStart} />
                <SidebarItem label="Values" type="STEP" iconName="Grid" beamTransform="Values" onDragStart={onDragStart} />
              </div>
            </details>
            <details className="bg-slate-700/50 rounded-md">
              <summary className="p-2 cursor-pointer text-[11px] font-semibold text-slate-300 uppercase tracking-wider">Aggregations</summary>
              <div className="grid grid-cols-3 gap-2 p-2">
                <SidebarItem label="Approximate Quantiles" type="STEP" iconName="BarChart" beamTransform="ApproximateQuantiles" onDragStart={onDragStart} />
                <SidebarItem label="Approximate Unique" type="STEP" iconName="BarChart" beamTransform="ApproximateUnique" onDragStart={onDragStart} />
                <SidebarItem label="Batch Elements" type="STEP" iconName="BarChart" beamTransform="BatchElements" onDragStart={onDragStart} />
                <SidebarItem label="Co Group By Key" type="STEP" iconName="BarChart" beamTransform="CoGroupByKey" onDragStart={onDragStart} />
                <SidebarItem label="Combine" type="STEP" iconName="BarChart" beamTransform="Combine" onDragStart={onDragStart} />
                <SidebarItem label="Combine With Context" type="STEP" iconName="BarChart" beamTransform="CombineWithContext" onDragStart={onDragStart} />
                <SidebarItem label="Count" type="STEP" iconName="BarChart" beamTransform="Count" onDragStart={onDragStart} />
                <SidebarItem label="Distinct" type="STEP" iconName="BarChart" beamTransform="Distinct" onDragStart={onDragStart} />
                <SidebarItem label="Group By Key" type="STEP" iconName="BarChart" beamTransform="GroupByKey" onDragStart={onDragStart} />
                <SidebarItem label="Group Into Batches" type="STEP" iconName="BarChart" beamTransform="GroupIntoBatches" onDragStart={onDragStart} />
                <SidebarItem label="Latest" type="STEP" iconName="BarChart" beamTransform="Latest" onDragStart={onDragStart} />
                <SidebarItem label="Max" type="STEP" iconName="BarChart" beamTransform="Max" onDragStart={onDragStart} />
                <SidebarItem label="Mean" type="STEP" iconName="BarChart" beamTransform="Mean" onDragStart={onDragStart} />
                <SidebarItem label="Min" type="STEP" iconName="BarChart" beamTransform="Min" onDragStart={onDragStart} />
                <SidebarItem label="Sample" type="STEP" iconName="BarChart" beamTransform="Sample" onDragStart={onDragStart} />
                <SidebarItem label="Sum" type="STEP" iconName="BarChart" beamTransform="Sum" onDragStart={onDragStart} />
                <SidebarItem label="Top" type="STEP" iconName="BarChart" beamTransform="Top" onDragStart={onDragStart} />
              </div>
            </details>
            <details className="bg-slate-700/50 rounded-md">
              <summary className="p-2 cursor-pointer text-[11px] font-semibold text-slate-300 uppercase tracking-wider">Windows</summary>
              <div className="grid grid-cols-3 gap-2 p-2">
                <SidebarItem label="Window" type="STEP" iconName="Clock" beamTransform="WindowInto" onDragStart={onDragStart} />
              </div>
            </details>
            <details className="bg-slate-700/50 rounded-md">
              <summary className="p-2 cursor-pointer text-[11px] font-semibold text-slate-300 uppercase tracking-wider">Logging</summary>
              <div className="grid grid-cols-3 gap-2 p-2">
                <SidebarItem label="Log Message" type="STEP" iconName="Terminal" beamTransform="LogMessage" onDragStart={onDragStart} />
              </div>
            </details>
            <details className="bg-slate-700/50 rounded-md">
              <summary className="p-2 cursor-pointer text-[11px] font-semibold text-slate-300 uppercase tracking-wider">Other</summary>
              <div className="grid grid-cols-3 gap-2 p-2">
                <SidebarItem label="Flatten" type="STEP" iconName="Layers" beamTransform="Flatten" onDragStart={onDragStart} />
                <SidebarItem label="ReShuffle" type="STEP" iconName="Shuffle" beamTransform="Reshuffle" onDragStart={onDragStart} />
              </div>
            </details>
          </div>
        )}
        {activeTab === 'SINKS' && (
          <div className="col-span-3 flex flex-col gap-2">
            <SidebarItem label="BigQuery" type="SINK" iconName="Database" beamTransform="BigQueryIO" onDragStart={onDragStart} />
            <SidebarItem label="PubSub" type="SINK" iconName="Radio" beamTransform="PubSubIO" onDragStart={onDragStart} />
          </div>
        )}
      </div>
    </div>
  );
};
