/**
 * PipelineNode Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Custom React Flow node representing a source, step, or sink in the Apache Beam DAG.
 * It renders the transform icon, uppercase type badge, and node label, with support for
 * inline label editing on double-click or rename button click.
 * 
 * Architectural Decisions:
 * - React Flow custom node with dynamic handles based on node type.
 * - Double-clicking the label or clicking the pencil button toggles an inline input field with 'nodrag' class.
 * - Commits label changes via data.onLabelChange callback or fallback to useReactFlow setNodes.
 * - Steps have dual output handles (Valid in green, Error in red).
 * - Sinks have a single target input handle and no output handles (terminal destination).
 * - Includes Lucide icons for all sources, steps, sinks including ListOrdered and Zap.
 * - Adheres strictly to the 8pt grid system.
 */

import React, { useState, useEffect, useRef } from 'react';
import { Handle, Position, useReactFlow } from 'reactflow';
import { Box, Pencil, AlertCircle, AlertTriangle } from 'lucide-react';
import { getNodeIcon } from './common/nodeIcons';
import { isFhirIoNode, isDicomIoNode } from '../graph/nodeKinds';

/**
 * React Flow custom node properties representing an Apache Beam pipeline transform.
 */
export interface PipelineNodeProps {
  id?: string;
  data: {
    label: string;
    type: string;
    iconName: string;
    beam_transform?: string;
    system_instructions?: string;
    properties?: Record<string, any>;
    hasCycle?: boolean;
    hasValidationError?: boolean;
    isOrphan?: boolean;
    validationError?: string;
    validationWarning?: string;
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
  const isFhirSource = isSource && isFhirIoNode(data);
  const isDicomSource = isSource && isDicomIoNode(data);
  const isFhirReadResources =
    isFhirSource && (data.properties?.readMode || 'readResources') === 'readResources';
  const isDicomReadMetadata =
    isDicomSource && (data.properties?.readMode || 'readStudyMetadata') === 'readStudyMetadata';
  const showTargetHandle =
    !isSource ||
    isFhirReadResources ||
    isDicomReadMetadata ||
    ((isFhirSource || isDicomSource) && Boolean(data.hasValidationError));

  const IconComponent = getNodeIcon(data.iconName, Box);

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

  // Determine dynamic node border and glow styles based on category: Green (Sources), Blue (Steps), Red (Sinks)
  // With high-priority crimson pulsing for cyclic dependencies, red dashed outline for validation errors, and dashed amber for orphan steps
  const getNodeBorderClasses = () => {
    if (data.hasCycle) {
      return 'border-rose-500 ring-2 ring-rose-500/70 shadow-lg shadow-rose-500/25 animate-pulse';
    }
    if (data.hasValidationError) {
      return selected
        ? 'border-red-500 ring-2 ring-red-500/50 shadow-lg shadow-red-500/20 border-dashed'
        : 'border-red-500 border-dashed hover:border-red-400';
    }
    if (data.isOrphan) {
      return selected
        ? 'border-amber-400 ring-2 ring-amber-500/50 shadow-lg shadow-amber-500/10 border-dashed'
        : 'border-amber-500 border-dashed hover:border-amber-400';
    }
    if (data.type === 'SOURCE') {
      return selected 
        ? 'border-emerald-400 ring-2 ring-emerald-500/50 shadow-lg shadow-emerald-500/10' 
        : 'border-emerald-500 hover:border-emerald-400';
    }
    if (data.type === 'SINK') {
      return selected 
        ? 'border-red-400 ring-2 ring-red-500/50 shadow-lg shadow-red-500/10' 
        : 'border-red-500 hover:border-red-400';
    }
    // STEP
    return selected 
      ? 'border-blue-400 ring-2 ring-blue-500/50 shadow-lg shadow-blue-500/10' 
      : 'border-blue-500 hover:border-blue-400';
  };

  const getIconContainerClasses = () => {
    if (data.type === 'SOURCE') {
      return 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400';
    }
    if (data.type === 'SINK') {
      return 'bg-red-500/10 border-red-500/40 text-red-400';
    }
    return 'bg-blue-500/10 border-blue-500/40 text-blue-400';
  };

  return (
    <div 
      className={`bg-[var(--vscode-node-bg,#1E202A)] border ${getNodeBorderClasses()} rounded-md shadow-xl p-3 flex items-center gap-3 min-w-[180px] text-left group/node transition-colors`}
      onDoubleClick={(e) => {
        if (!isEditing) {
          e.stopPropagation();
          setIsEditing(true);
        }
      }}
      data-testid={`pipeline-node-${id || 'node'}`}
    >
      {/* Target handle for incoming connections (not for sources, except FhirIO.readResources or when an invalid upstream edge is connected) */}
      {showTargetHandle && (
        <Handle 
          type="target" 
          position={Position.Left} 
          className={`w-2 h-2 border-none ${isSink || data.hasValidationError ? 'bg-red-500' : isSource ? 'bg-emerald-500' : 'bg-blue-500'}`} 
        />
      )}
      
      <div className="flex items-center gap-3 w-full">
        <div className={`p-2 rounded shrink-0 border ${getIconContainerClasses()}`}>
          {IconComponent && (
            /* eslint-disable-next-line react-hooks/static-components */
            <IconComponent 
              className={`w-5 h-5 ${data.type === 'SOURCE' ? 'text-emerald-400' : data.type === 'SINK' ? 'text-red-400' : 'text-blue-400'}`} 
            />
          )}
        </div>
        <div className="flex flex-col flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className={`text-[10px] font-bold tracking-wider uppercase ${data.type === 'SOURCE' ? 'text-emerald-400' : data.type === 'SINK' ? 'text-red-400' : 'text-blue-400'}`}>
              {data.type}
            </span>
            {(data.hasCycle || data.hasValidationError) && (
              <span
                className="flex items-center text-rose-400 cursor-help"
                title={data.validationError || 'Cycle detected: this node participates in a cyclic dependency loop'}
                data-testid="cycle-error-badge"
              >
                <AlertCircle className="w-3.5 h-3.5 text-rose-400 fill-rose-500/20" />
              </span>
            )}
            {data.isOrphan && !data.hasCycle && !data.hasValidationError && (
              <span
                className="flex items-center text-amber-400 cursor-help"
                title={data.validationWarning || 'Orphan step: node is not connected to the pipeline'}
                data-testid="orphan-warning-badge"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 fill-amber-500/20" />
              </span>
            )}
          </div>
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
              className="nodrag bg-[var(--vscode-input-bg)] text-sm font-medium text-[var(--vscode-text-primary)] border border-[var(--vscode-highlight)] rounded px-1.5 py-0.5 outline-none w-full max-w-[140px]"
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
                className="text-sm font-medium text-[var(--vscode-text-primary)] hover:text-[var(--vscode-highlight)] transition-colors truncate select-none"
              >
                {data.label}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditing(true);
                }}
                className="opacity-0 group-hover/node:opacity-100 text-[var(--vscode-text-muted)] hover:text-[var(--vscode-highlight)] p-0.5 transition-opacity shrink-0"
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
        <Handle 
          type="source" 
          position={Position.Right} 
          className="w-2 h-2 bg-emerald-500 border-none" 
        />
      )}

      {/* For steps, add 2 output handles: Valid (Green) and Error (Red) */}
      {data.type === 'STEP' && (
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
      )}
    </div>
  );
};
