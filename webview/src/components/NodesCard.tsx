import React from 'react';
import { SidebarItem } from './SidebarItem';

interface NodesCardProps {
  activeTab: string;
  setActiveTab: (tab: any) => void;
  nodesCount: number;
  hasPubSubSource: boolean;
  onDragStart: (event: React.DragEvent, nodeType: string, label: string, type: string, iconName: string, beamTransform?: string) => void;
}

export const NodesCard: React.FC<NodesCardProps> = ({
  activeTab,
  setActiveTab,
  nodesCount,
  onDragStart,
}) => {
  return (
    <div className="absolute top-4 left-4 z-10 w-80 bg-[#1A1D26]/90 backdrop-blur border border-slate-700/80 rounded-xl p-3 shadow-2xl flex flex-col gap-3 max-h-[calc(100vh-80px)] overflow-y-auto">
      {/* Tabs Header */}
      <div className="flex bg-[#0F111A] p-1 rounded-lg border border-slate-800">
        <button
          onClick={() => setActiveTab('SOURCES')}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${
            activeTab === 'SOURCES'
              ? 'bg-blue-600 text-white shadow'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          SOURCES
        </button>
        <button
          onClick={() => setActiveTab('STEPS')}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${
            activeTab === 'STEPS'
              ? 'bg-blue-600 text-white shadow'
              : 'text-slate-400 hover:text-slate-200'
          } ${nodesCount === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
          disabled={nodesCount === 0}
        >
          STEPS
        </button>
        <button
          onClick={() => setActiveTab('SINKS')}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${
            activeTab === 'SINKS'
              ? 'bg-blue-600 text-white shadow'
              : 'text-slate-400 hover:text-slate-200'
          } ${nodesCount === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
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
            {/* Database Sources Section */}
            <details className="bg-slate-700/50 rounded-md">
              <summary className="p-2 cursor-pointer text-[11px] font-semibold text-slate-300 uppercase tracking-wider">Database Sources</summary>
              <div className="grid grid-cols-3 gap-2 p-2">
                <SidebarItem label="BigQuery" type="SOURCE" iconName="Database" beamTransform="BigQueryIO" onDragStart={onDragStart} />
                <SidebarItem label="JdbcIO" type="SOURCE" iconName="Database" beamTransform="JdbcIO" onDragStart={onDragStart} />
              </div>
            </details>
            {/* File Sources Section */}
            <details className="bg-slate-700/50 rounded-md">
              <summary className="p-2 cursor-pointer text-[11px] font-semibold text-slate-300 uppercase tracking-wider">File Sources</summary>
              <div className="grid grid-cols-3 gap-2 p-2">
                <SidebarItem label="FileIO" type="SOURCE" iconName="Folder" beamTransform="FileIO" onDragStart={onDragStart} />
                <SidebarItem label="TextIO" type="SOURCE" iconName="FileText" beamTransform="TextIO" onDragStart={onDragStart} />
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
            {/* Streaming Sinks Section */}
            <details className="bg-slate-700/50 rounded-md">
              <summary className="p-2 cursor-pointer text-[11px] font-semibold text-slate-300 uppercase tracking-wider">Streaming Sinks</summary>
              <div className="grid grid-cols-3 gap-2 p-2">
                <SidebarItem label="PubSub" type="SINK" iconName="Radio" beamTransform="PubSubIO" onDragStart={onDragStart} />
              </div>
            </details>
            {/* Database Sinks Section */}
            <details className="bg-slate-700/50 rounded-md">
              <summary className="p-2 cursor-pointer text-[11px] font-semibold text-slate-300 uppercase tracking-wider">Database Sinks</summary>
              <div className="grid grid-cols-3 gap-2 p-2">
                <SidebarItem label="BigQuery" type="SINK" iconName="Database" beamTransform="BigQueryIO" onDragStart={onDragStart} />
                <SidebarItem label="JdbcIO" type="SINK" iconName="Database" beamTransform="JdbcIO" onDragStart={onDragStart} />
              </div>
            </details>
            {/* File Sinks Section */}
            <details className="bg-slate-700/50 rounded-md">
              <summary className="p-2 cursor-pointer text-[11px] font-semibold text-slate-300 uppercase tracking-wider">File Sinks</summary>
              <div className="grid grid-cols-3 gap-2 p-2">
                <SidebarItem label="FileIO" type="SINK" iconName="Folder" beamTransform="FileIO" onDragStart={onDragStart} />
                <SidebarItem label="TextIO" type="SINK" iconName="FileText" beamTransform="TextIO" onDragStart={onDragStart} />
              </div>
            </details>
          </div>
        )}
      </div>
    </div>
  );
};
