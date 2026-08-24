/**
 * PropertyPane Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Renders the right sidebar containing properties for the currently selected node.
 * It displays the node's transform icon, node type badge, editable node label/name input,
 * node ID, transform-specific property form, and runtime variables list.
 * 
 * Architectural Decisions:
 * - Allows direct editing of the node name/label at the top of the sidebar.
 * - Displays node type (SOURCE, STEP, SINK) clearly above the label input.
 * - Dedicated scrollable area for transform configuration forms.
 * - Bottom section displays expandable/copyable runtime variables.
 * - Adheres to the 8pt grid system for spacing.
 */

import React from 'react';
import { Box, Copy } from 'lucide-react';
import { PropertyForm } from './PropertyForm';
import { Database, Cloud, HardDrive, Cable, Radio, Share2, Clock, Layers, BarChart, FileCode, Code, FileText, Folder } from 'lucide-react';

const iconComponentMap: Record<string, any> = {
  Radio, Database, Cable, Share2, HardDrive, Cloud, Clock, Layers, BarChart, Box, FileCode, Code, FileText, Folder
};

export interface PropertyPaneProps {
  node: any;
  onChange: (properties: any) => void;
  onLabelChange?: (label: string) => void;
  runtimeVariables: { key: string; value: string }[];
  onAddKVMapper?: (windowNodeId: string) => void;
}

/**
 * PropertyPane functional component rendering the node properties sidebar.
 */
export const PropertyPane: React.FC<PropertyPaneProps> = ({ node, onChange, onLabelChange, runtimeVariables, onAddKVMapper }) => {
  const IconComponent = iconComponentMap[node.data.iconName];

  return (
    <div className="w-80 h-full shrink-0 bg-[#1A1D26] p-4 border-l border-slate-700 flex flex-col gap-4 overflow-y-auto z-20">
      {/* Top Header */}
      <div className="flex justify-between items-center shrink-0">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">Properties</h2>
        <Box className="w-4 h-4 text-slate-400" />
      </div>
      
      {/* Node Info Header with Editable Name */}
      <div className="flex items-center gap-3 bg-[#252836] p-3 rounded-lg shrink-0">
        <div className="bg-slate-700/50 p-2 rounded shrink-0">
          {IconComponent && <IconComponent className={`w-5 h-5 ${node.data.type === 'SOURCE' ? 'text-blue-400' : node.data.type === 'SINK' ? 'text-green-400' : 'text-orange-400'}`} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-bold tracking-wider text-slate-400 uppercase mb-1">
            {node.data.type || 'STEP'}
          </div>
          <input
            type="text"
            value={node.data.label || ''}
            onChange={(e) => onLabelChange && onLabelChange(e.target.value)}
            className="w-full bg-[#1A1D26] border border-slate-600 focus:border-blue-500 rounded px-2 py-1 text-sm font-bold text-white outline-none transition-colors"
            placeholder="Node Name"
            aria-label="Node Name"
            title="Edit node name"
          />
          <div className="text-[11px] text-slate-500 mt-1">NODE ID: {node.id}</div>
        </div>
      </div>

      {/* Scrollable Form Area */}
      <div className="flex-1 flex flex-col min-h-0 overflow-y-auto pr-1">
        <PropertyForm node={node} onChange={onChange} onAddKVMapper={onAddKVMapper} />
      </div>

      {/* Runtime Variables at the bottom */}
      <div className="border-t border-slate-700 pt-4 shrink-0">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs font-bold uppercase text-slate-500">Runtime Variables</span>
        </div>
        <div className="flex flex-col gap-2 max-h-36 overflow-y-auto pr-1">
          {runtimeVariables.map((variable, index) => (
            <div key={index} className="flex justify-between items-center text-sm text-slate-300 bg-[#252836] p-2 rounded">
              <span>${variable.key}</span>
              <button 
                onClick={() => navigator.clipboard.writeText(`$${variable.key}`)}
                className="text-slate-500 hover:text-slate-300"
                title="Copy to clipboard"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
