import React from 'react';
import { Handle, Position } from 'reactflow';
import { Database, Cloud, HardDrive, Cable, Radio, Share2, Clock, Layers, BarChart, Box, FileCode, Terminal, Calendar, Filter, GitMerge, Key, Hash, Shuffle, Activity, Type, Grid } from 'lucide-react';

const iconComponentMap: Record<string, any> = {
  Radio, Database, Cable, Share2, HardDrive, Cloud, Clock, Layers, BarChart, Box, FileCode, Terminal,
  Calendar, Filter, GitMerge, Key, Hash, Shuffle, Activity, Type, Grid
};

/**
 * PipelineNode Component
 * 
 * This is a custom React Flow node that represents a step, source, or sink in the pipeline.
 * It displays an icon, type label, and name.
 * 
 * Architectural Decisions:
 * - Custom node implementation for React Flow.
 * - Uses Lucide icons based on data.iconName.
 * - Steps have two output handles: green for valid path, red for error path.
 */
interface PipelineNodeProps {
  data: {
    label: string;
    type: string;
    iconName: string;
  };
  selected?: boolean;
}

export const PipelineNode: React.FC<PipelineNodeProps> = ({ data, selected }) => {
  const isSource = data.type === 'SOURCE';
  const isSink = data.type === 'SINK';

  const IconComponent = iconComponentMap[data.iconName];

  return (
    <div className={`bg-[#1E202A] border ${selected ? 'border-blue-500' : 'border-slate-700'} rounded-md shadow-xl p-3 flex items-center gap-3 min-w-[180px] text-left`}>
      {/* Target handle for incoming connections (not for sources) */}
      {!isSource && (
        <Handle type="target" position={Position.Left} className="w-2 h-2 bg-blue-500 border-none" />
      )}
      
      <div className="flex items-center gap-3 w-full">
        <div className="bg-slate-700/50 p-2 rounded">
          {IconComponent && <IconComponent className={`w-5 h-5 ${data.type === 'SOURCE' ? 'text-blue-400' : data.type === 'SINK' ? 'text-green-400' : 'text-orange-400'}`} />}
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">{data.type}</span>
          <span className="text-sm font-medium text-slate-200">{data.label}</span>
        </div>
      </div>

      {/* Source handle for outgoing connections (not for sinks) */}
      {!isSink && data.type !== 'STEP' && (
        <Handle type="source" position={Position.Right} className="w-2 h-2 bg-blue-500 border-none" />
      )}

      {/* For steps, add 2 output handles: Valid (Green) and Error (Red) (Log Message only has Valid) */}
      {data.type === 'STEP' && (
        data.label === 'Log Message' ? (
          <Handle 
            type="source" 
            position={Position.Right} 
            id="valid" 
            style={{ top: '50%', backgroundColor: '#10b981' }} 
            className="w-2 h-2 border-none" 
            title="Valid Path"
          />
        ) : (
          <>
            <Handle 
              type="source" 
              position={Position.Right} 
              id="valid" 
              style={{ top: '30%', backgroundColor: '#10b981' }} 
              className="w-2 h-2 border-none" 
              title="Valid Path"
            />
            <Handle 
              type="source" 
              position={Position.Right} 
              id="error" 
              style={{ top: '70%', backgroundColor: '#ef4444' }} 
              className="w-2 h-2 border-none" 
              title="Error Path"
            />
          </>
        )
      )}
    </div>
  );
};
