/**
 * PipelineNode Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Custom React Flow node representing a source, step, or sink in the Apache Beam DAG.
 * It renders the transform icon, uppercase type badge, and node label, with support for
 * inline label editing on double-click.
 * 
 * Architectural Decisions:
 * - React Flow custom node with dynamic handles based on node type.
 * - Double-clicking the label toggles an inline input field with 'nodrag' class to prevent canvas drag interference.
 * - Commits label changes via data.onLabelChange callback or fallback to useReactFlow setNodes.
 * - Pressing Enter or clicking outside (onBlur) commits the new name; pressing Escape cancels.
 * - Steps have dual output handles (Valid in green, Error in red) except Log Message which has one valid output.
 * - Includes Lucide icons for all sources, steps, sinks including ListOrdered and Zap.
 * - Adheres strictly to the 8pt grid system.
 */

import React, { useState, useEffect, useRef } from 'react';
import { Handle, Position, useReactFlow } from 'reactflow';
import { Database, Cloud, HardDrive, Cable, Radio, Share2, Clock, Layers, BarChart, Box, FileCode, Terminal, Calendar, Filter, GitMerge, Key, Hash, Shuffle, Activity, Type, Grid, Code, FileText, Folder, ListOrdered, Zap, Pencil } from 'lucide-react';

const iconComponentMap: Record<string, any> = {
  Radio, Database, Cable, Share2, HardDrive, Cloud, Clock, Layers, BarChart, Box, FileCode, Terminal,
  Calendar, Filter, GitMerge, Key, Hash, Shuffle, Activity, Type, Grid, Code, FileText, Folder, ListOrdered, Zap
};

export interface PipelineNodeProps {
  id?: string;
  data: {
    label: string;
    type: string;
    iconName: string;
    beam_transform?: string;
    system_instructions?: string;
    properties?: Record<string, any>;
    onLabelChange?: (id: string, newLabel: string) => void;
  };
  selected?: boolean;
}

/**
 * PipelineNode functional component rendering the node in the diagram canvas.
 */
export const PipelineNode: React.FC<PipelineNodeProps> = ({ id, data, selected }) => {
  const isSource = data.type === 'SOURCE';
  const isSink = data.type === 'SINK';

  const IconComponent = iconComponentMap[data.iconName];

  // Inline editing state
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(data.label);
  const inputRef = useRef<HTMLInputElement>(null);

  let reactFlow: any = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    reactFlow = useReactFlow();
  } catch {
    // Graceful fallback when rendered outside ReactFlowProvider (e.g., in unit tests)
    reactFlow = null;
  }

  // Focus and select text when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Keep local edit state in sync with external data.label updates when not actively editing
  useEffect(() => {
    if (!isEditing) {
      setEditValue(data.label);
    }
  }, [data.label, isEditing]);

  /**
   * Commits the edited label to the node state
   */
  const handleCommit = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== data.label) {
      if (data.onLabelChange && id) {
        data.onLabelChange(id, trimmed);
      } else if (reactFlow?.setNodes && id) {
        reactFlow.setNodes((nds: any[]) =>
          nds.map((n) =>
            n.id === id
              ? { ...n, data: { ...n.data, label: trimmed } }
              : n
          )
        );
      }
    } else {
      setEditValue(data.label);
    }
    setIsEditing(false);
  };

  /**
   * Cancels editing and reverts to original label
   */
  const handleCancel = () => {
    setEditValue(data.label);
    setIsEditing(false);
  };

  /**
   * Key down event handler for inline edit input
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.stopPropagation();
      handleCommit();
    } else if (e.key === 'Escape') {
      e.stopPropagation();
      handleCancel();
    }
  };

  return (
    <div 
      className={`bg-[#1E202A] border ${selected ? 'border-blue-500' : 'border-slate-700'} rounded-md shadow-xl p-3 flex items-center gap-3 min-w-[180px] text-left group/node`}
      onDoubleClick={(e) => {
        if (!isEditing) {
          e.stopPropagation();
          setIsEditing(true);
        }
      }}
    >
      {/* Target handle for incoming connections (not for sources) */}
      {!isSource && (
        <Handle type="target" position={Position.Left} className="w-2 h-2 bg-blue-500 border-none" />
      )}
      
      <div className="flex items-center gap-3 w-full">
        <div className="bg-slate-700/50 p-2 rounded shrink-0">
          {IconComponent && <IconComponent className={`w-5 h-5 ${data.type === 'SOURCE' ? 'text-blue-400' : data.type === 'SINK' ? 'text-green-400' : 'text-orange-400'}`} />}
        </div>
        <div className="flex flex-col flex-1 min-w-0">
          <span className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">{data.type}</span>
          {isEditing ? (
            <input
              ref={inputRef}
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleCommit}
              onKeyDown={handleKeyDown}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              className="nodrag bg-[#0F111A] text-sm font-medium text-slate-100 border border-blue-500 rounded px-1.5 py-0.5 outline-none w-full max-w-[140px]"
              aria-label="Edit node label"
            />
          ) : (
            <div 
              className="nodrag flex items-center gap-1 cursor-pointer min-w-0"
              onDoubleClick={(e) => {
                e.stopPropagation();
                setIsEditing(true);
              }}
              title="Double-click to rename"
            >
              <span 
                className="text-sm font-medium text-slate-200 hover:text-blue-300 transition-colors truncate select-none"
              >
                {data.label}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditing(true);
                }}
                className="opacity-0 group-hover/node:opacity-100 text-slate-400 hover:text-blue-400 p-0.5 transition-opacity shrink-0"
                title="Rename node"
                aria-label="Rename node"
              >
                <Pencil className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Source handle for outgoing connections (not for sinks) */}
      {!isSink && data.type !== 'STEP' && (
        <Handle type="source" position={Position.Right} className="w-2 h-2 bg-blue-500 border-none" />
      )}

      {/* For steps, add 2 output handles: Valid (Green) and Error (Red) (Log Message only has Valid) */}
      {data.type === 'STEP' && (
        data.label === 'Log Message' || data.beam_transform === 'LogMessage' ? (
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
