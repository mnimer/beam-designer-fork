/**
 * @fileoverview Floating top-right React Flow canvas toolbar with Undo/Redo, Auto Layout, Zoom controls, and MiniMap.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

import React from 'react';
import { MiniMap, useReactFlow, type Node } from 'reactflow';
import {
  LayoutGrid,
  Maximize2,
  Redo2,
  Undo2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type { PipelineNodeData } from '../hooks/usePipelineGraph';

/**
 * Props for the CanvasToolbar component.
 */
export interface CanvasToolbarProps {
  /** Whether an undo snapshot is available. */
  readonly canUndo: boolean;
  /** Whether a redo snapshot is available. */
  readonly canRedo: boolean;
  /** Callback invoked to undo the last diagram mutation. */
  readonly onUndo: () => void;
  /** Callback invoked to redo the last undone diagram mutation. */
  readonly onRedo: () => void;
  /** Callback invoked to auto-layout the diagram nodes. */
  readonly onAutoLayout: () => void;
  /** Whether to display the MiniMap directly below the toolbar. */
  readonly showMiniMap?: boolean;
}

/**
 * Renders the top-right floating canvas control bar and MiniMap inside the React Flow canvas.
 */
export const CanvasToolbar: React.FC<CanvasToolbarProps> = ({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onAutoLayout,
  showMiniMap = true,
}) => {
  const { zoomIn, zoomOut, fitView } = useReactFlow();

  return (
    <div
      data-testid="canvas-toolbar"
      className="absolute top-3 right-3 z-20 flex flex-col items-end gap-2.5 pointer-events-auto select-none"
    >
      {/* Control Button Toolbar Strip */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#161b22]/95 backdrop-blur-md border border-[#30363d] rounded-xl shadow-xl text-xs text-[#c9d1d9]">
        {/* Undo Action */}
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo (Cmd+Z / Ctrl+Z)"
          data-testid="canvas-undo-button"
          className="p-1.5 rounded-lg hover:bg-[#21262d] disabled:opacity-30 disabled:cursor-not-allowed text-gray-200 hover:text-white transition-colors cursor-pointer"
        >
          <Undo2 className="w-4 h-4" />
        </button>

        {/* Redo Action */}
        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (Cmd+Shift+Z / Ctrl+Y)"
          data-testid="canvas-redo-button"
          className="p-1.5 rounded-lg hover:bg-[#21262d] disabled:opacity-30 disabled:cursor-not-allowed text-gray-200 hover:text-white transition-colors cursor-pointer"
        >
          <Redo2 className="w-4 h-4" />
        </button>

        <div className="w-px h-5 bg-[#30363d] mx-1" />

        {/* Auto Layout Action */}
        <button
          type="button"
          onClick={onAutoLayout}
          title="Auto Layout Diagram"
          data-testid="canvas-autolayout-button"
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-[#21262d] text-gray-100 hover:text-white font-semibold text-xs transition-colors cursor-pointer"
        >
          <LayoutGrid className="w-4 h-4 text-[#38bdf8]" />
          <span>Auto Layout</span>
        </button>

        <div className="w-px h-5 bg-[#30363d] mx-1" />

        {/* Zoom In Action */}
        <button
          type="button"
          onClick={() => zoomIn?.()}
          title="Zoom In"
          data-testid="canvas-zoomin-button"
          className="p-1.5 rounded-lg hover:bg-[#21262d] text-gray-300 hover:text-white transition-colors cursor-pointer"
        >
          <ZoomIn className="w-4 h-4" />
        </button>

        {/* Zoom Out Action */}
        <button
          type="button"
          onClick={() => zoomOut?.()}
          title="Zoom Out"
          data-testid="canvas-zoomout-button"
          className="p-1.5 rounded-lg hover:bg-[#21262d] text-gray-300 hover:text-white transition-colors cursor-pointer"
        >
          <ZoomOut className="w-4 h-4" />
        </button>

        {/* Zoom to Fit Action */}
        <button
          type="button"
          onClick={() => fitView?.({ padding: 0.2 })}
          title="Zoom to Fit"
          data-testid="canvas-fitview-button"
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-[#21262d] text-gray-100 hover:text-white font-semibold text-xs transition-colors cursor-pointer"
        >
          <Maximize2 className="w-4 h-4 text-[#10b981]" />
          <span>Zoom to Fit</span>
        </button>
      </div>

      {/* MiniMap Positioned Directly Under Controls */}
      {showMiniMap && (
        <MiniMap
          nodeColor={(node: Node<PipelineNodeData>) => {
            if (node.data?.type === 'SOURCE') return '#f59e0b';
            if (node.data?.type === 'SINK') return '#10b981';
            return '#3b82f6';
          }}
          nodeStrokeWidth={2}
          className="!static !m-0 !h-[120px] !w-[180px] border border-[#30363d] rounded-xl shadow-xl overflow-hidden !bg-[#161b22]"
          maskColor="rgba(13, 17, 23, 0.75)"
        />
      )}
    </div>
  );
};
