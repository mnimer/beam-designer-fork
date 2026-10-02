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
import {
  Box,
  Copy,
  X
} from 'lucide-react';
import { PropertyForm } from './PropertyForm';
import { ErrorBoundary } from './common/ErrorBoundary';
import { getNodeIcon } from './common/nodeIcons';

/**
 * Props for the {@link PropertyPane} component.
 */
export interface PropertyPaneProps {
  node: any;
  onChange: (properties: any) => void;
  onLabelChange?: (label: string) => void;
  runtimeVariables: { key: string; value: string }[];
  onAddKVMapper?: (windowNodeId: string) => void;
  onAddPubSubSource?: (targetNodeId: string) => void;
  width?: number;
  onResizeStart?: (e: React.MouseEvent) => void;
  onClose?: () => void;
}

/**
 * PropertyPane functional component rendering the node properties sidebar.
 */
export const PropertyPane: React.FC<PropertyPaneProps> = ({
  node,
  onChange,
  onLabelChange,
  runtimeVariables,
  onAddKVMapper,
  onAddPubSubSource,
  width,
  onResizeStart,
  onClose
}) => {
  const IconComponent = getNodeIcon(node.data.iconName, Box);
  const [labelValue, setLabelValue] = React.useState(node.data.label || '');

  React.useEffect(() => {
    setLabelValue(node.data.label || '');
  }, [node.data.label, node.id]);

  const handleLabelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLabelValue(val);
    if (onLabelChange) {
      onLabelChange(val);
    }
  };

  return (
    <div
      style={width ? { width: `${width}px` } : undefined}
      className={`${width ? '' : 'w-80'} h-full shrink-0 bg-[var(--vscode-workbench-bg)] p-4 border-l border-[var(--vscode-border)] flex flex-col gap-4 overflow-y-auto relative shadow-2xl z-40`}
    >
      {/* Resizable handle along the left edge */}
      <div
        data-testid="property-pane-resize-handle"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize property panel"
        title="Drag to resize property panel"
        onMouseDown={onResizeStart}
        className="absolute left-0 top-0 bottom-0 w-2.5 -ml-1 cursor-col-resize hover:bg-[var(--vscode-highlight,#3b82f6)]/40 transition-colors z-50 group flex items-center justify-center select-none"
      >
        <div className="w-1 h-8 rounded bg-slate-600/80 group-hover:bg-blue-400 group-hover:h-12 transition-all" />
      </div>

      {/* Top Header */}
      <div className="flex justify-between items-center shrink-0">
        <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--vscode-text-muted)]">Properties</h2>
        <div className="flex items-center gap-1">
          <Box className="w-4 h-4 text-[var(--vscode-text-muted)]" />
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-white hover:bg-slate-700/60 rounded transition cursor-pointer ml-1"
              title="Close properties"
              aria-label="Close properties"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      
      {/* Node Info Header with Editable Name */}
      <div className="flex items-center gap-3 bg-[var(--vscode-card-bg)] border border-[var(--vscode-border-light)] p-3 rounded-lg shrink-0">
        <div className="bg-[var(--vscode-subcard-bg)] border border-[var(--vscode-border-light)] p-2 rounded shrink-0">
          {/* eslint-disable-next-line react-hooks/static-components */}
          {IconComponent && <IconComponent className={`w-5 h-5 ${node.data.type === 'SOURCE' ? 'text-emerald-400' : node.data.type === 'SINK' ? 'text-rose-400' : 'text-blue-400'}`} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-bold tracking-wider text-[var(--vscode-text-muted)] uppercase mb-1">
            {node.data.type || 'STEP'}
          </div>
          <input
            type="text"
            value={labelValue}
            onChange={handleLabelChange}
            className="w-full bg-[var(--vscode-input-bg)] border border-[var(--vscode-border)] focus:border-[var(--vscode-highlight)] rounded px-2 py-1 text-sm font-bold text-[var(--vscode-text-primary)] outline-none transition-colors"
            placeholder="Node Name"
            aria-label="Node Name"
            title="Edit node name"
          />
          <div className="text-[11px] text-[var(--vscode-text-muted)] mt-1">NODE ID: {node.id}</div>
        </div>
      </div>

      {/* Scrollable Form Area */}
      <div className="flex-1 flex flex-col min-h-0 overflow-y-auto pr-1">
        <ErrorBoundary fallbackTitle="Error loading node properties">
          <PropertyForm node={node} onChange={onChange} onAddKVMapper={onAddKVMapper} onAddPubSubSource={onAddPubSubSource} />
        </ErrorBoundary>
      </div>

      {/* Runtime Variables at the bottom */}
      <div className="border-t border-[var(--vscode-border-light)] pt-4 shrink-0">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs font-bold uppercase text-[var(--vscode-text-muted)]">Runtime Variables</span>
        </div>
        <div className="flex flex-col gap-2 max-h-36 overflow-y-auto pr-1">
          {(runtimeVariables || []).map((variable, index) => (
            <div key={index} className="flex justify-between items-center text-sm text-[var(--vscode-text-secondary)] bg-[var(--vscode-subcard-bg)] border border-[var(--vscode-border-light)] p-2 rounded">
              <span>${variable.key}</span>
              <button 
                onClick={() => navigator.clipboard.writeText(`$${variable.key}`)}
                className="text-[var(--vscode-text-muted)] hover:text-[var(--vscode-text-primary)]"
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
