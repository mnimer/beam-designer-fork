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
  hasPubSubSource: boolean;
  onDragStart: (event: React.DragEvent, nodeType: string, label: string, type: string, iconName: string) => void;
}

export const NodesCard: React.FC<NodesCardProps> = ({ activeTab, setActiveTab, nodesCount, hasPubSubSource, onDragStart }) => {
  return (
    <div className="absolute top-4 left-4 z-10 w-64 bg-slate-800/90 p-4 flex flex-col gap-4 rounded-lg border border-slate-700 shadow-lg backdrop-blur-sm max-h-[calc(100%-2rem)] overflow-y-auto">
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
      <div className="grid grid-cols-3 gap-4 mt-2">
        {activeTab === 'SOURCES' && (
          <div className="col-span-3 flex flex-col gap-2">
            {/* Streaming Sources Section */}
            <details className="bg-slate-700/50 rounded-md" open>
              <summary className="p-2 cursor-pointer text-xs font-semibold text-slate-300 uppercase tracking-wider">Streaming Sources</summary>
              <div className="grid grid-cols-3 gap-4 p-2">
                <SidebarItem label="PubSub" type="SOURCE" iconName="Radio" onDragStart={onDragStart} />
              </div>
            </details>
            {/* Batch Sources Section */}
            <details className="bg-slate-700/50 rounded-md" open>
              <summary className="p-2 cursor-pointer text-xs font-semibold text-slate-300 uppercase tracking-wider">Batch Sources</summary>
              <div className="grid grid-cols-3 gap-4 p-2">
                <SidebarItem label="BigQuery" type="SOURCE" iconName="Database" onDragStart={onDragStart} />
              </div>
            </details>
          </div>
        )}
        {activeTab === 'STEPS' && (
          <div className="col-span-3 flex flex-col gap-2">
            {hasPubSubSource && (
              <details className="bg-slate-700/50 rounded-md" open>
                <summary className="p-2 cursor-pointer text-xs font-semibold text-slate-300 uppercase tracking-wider">PubSub Messages</summary>
                <div className="grid grid-cols-3 gap-4 p-2">
                  <SidebarItem label="Parse JSON" type="STEP" iconName="FileCode" onDragStart={onDragStart} />
                  <SidebarItem label="Parse Base64" type="STEP" iconName="FileCode" onDragStart={onDragStart} />
                </div>
              </details>
            )}
            <details className="bg-slate-700/50 rounded-md" open>
              <summary className="p-2 cursor-pointer text-xs font-semibold text-slate-300 uppercase tracking-wider">Transformers</summary>
              <div className="grid grid-cols-3 gap-4 p-2">
                {/* Empty for now */}
              </div>
            </details>
            <details className="bg-slate-700/50 rounded-md" open>
              <summary className="p-2 cursor-pointer text-xs font-semibold text-slate-300 uppercase tracking-wider">Windows</summary>
              <div className="grid grid-cols-3 gap-4 p-2">
                <SidebarItem label="Window" type="STEP" iconName="Clock" onDragStart={onDragStart} />
              </div>
            </details>
          </div>
        )}
        {activeTab === 'SINKS' && (
          <SidebarItem label="BigQuery" type="SINK" iconName="Database" onDragStart={onDragStart} />
        )}
      </div>
    </div>
  );
};
