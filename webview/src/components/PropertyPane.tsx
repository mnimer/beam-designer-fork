import React from 'react';
import { Box, Copy } from 'lucide-react';
import { PropertyForm } from './PropertyForm';
import { Database, Cloud, HardDrive, Cable, Radio, Share2, Clock, Layers, BarChart, FileCode, Code, FileText, Folder } from 'lucide-react';

const iconComponentMap: Record<string, any> = {
  Radio, Database, Cable, Share2, HardDrive, Cloud, Clock, Layers, BarChart, Box, FileCode, Code, FileText, Folder
};

/**
 * PropertyPane Component
 * 
 * This component renders the right sidebar containing properties for the selected node.
 * It displays the node's icon, label, ID, specific properties form (in a dedicated scrollable area),
 * and a list of runtime variables.
 */
interface PropertyPaneProps {
  node: any;
  onChange: (properties: any) => void;
  runtimeVariables: { key: string, value: string }[];
  onAddKVMapper?: (windowNodeId: string) => void;
}

export const PropertyPane: React.FC<PropertyPaneProps> = ({ node, onChange, runtimeVariables, onAddKVMapper }) => {
  const IconComponent = iconComponentMap[node.data.iconName];

  return (
    <div className="w-80 h-full shrink-0 bg-[#1A1D26] p-4 border-l border-slate-700 flex flex-col gap-4 overflow-y-auto z-20">
      {/* Top Header */}
      <div className="flex justify-between items-center shrink-0">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">Properties</h2>
        <Box className="w-4 h-4 text-slate-400" />
      </div>
      
      {/* Node Info Header */}
      <div className="flex items-center gap-3 bg-[#252836] p-3 rounded-lg shrink-0">
        <div className="bg-slate-700/50 p-2 rounded">
          {IconComponent && <IconComponent className={`w-5 h-5 ${node.data.type === 'SOURCE' ? 'text-blue-400' : node.data.type === 'SINK' ? 'text-green-400' : 'text-orange-400'}`} />}
        </div>
        <div>
          <div className="text-sm font-bold text-white">{node.data.label}</div>
          <div className="text-xs text-slate-500">NODE ID: {node.id}</div>
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
