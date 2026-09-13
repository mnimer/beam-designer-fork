/**
 * App Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Main application component for the visual Apache Beam Pipeline Designer canvas and property inspector.
 * Decomposed (A6) into custom hooks for persistence (usePipelinePersistence), graph mutations
 * (usePipelineGraph), and extension host IPC (useVsCodeBridge).
 * 
 * Architectural Decisions:
 * - Uses React Flow for interactive drag-and-drop pipeline graph editing.
 * - Initial state for nodes and edges is empty array to prevent phantom pipeline flash when opening .beam files.
 * - Nodes are passed untouched to ReactFlow; node label edits are injected via stable LabelChangeContext.
 * - Autosave debounced at 2s with dirty-check byte comparison (P6).
 * - Adheres to 8pt grid system and modern React state/effects.
 */

import React, { useCallback, useState, useEffect, useRef, useMemo, useContext, createContext } from 'react';
import { LayoutTemplate, Map } from 'lucide-react';

import ReactFlow, {
  MiniMap,
  Controls,
  ControlButton,
  Background,
  ReactFlowProvider,
  useReactFlow,
} from 'reactflow';
import 'reactflow/dist/style.css';
import './App.css';
import { PipelineNode, type PipelineNodeProps } from './components/PipelineNode';
import { PropertyPane } from './components/PropertyPane';
import { NodesCard } from './components/NodesCard';
import { BottomPanel } from './components/BottomPanel/BottomPanel';
import { ThemeProvider } from './context/ThemeContext';

import { usePipelinePersistence } from './hooks/usePipelinePersistence';
import { usePipelineGraph, type PipelineNodeData } from './hooks/usePipelineGraph';
import { useVsCodeBridge, findMainPipelineFile, type PipelineConfig } from './hooks/useVsCodeBridge';

export { findMainPipelineFile };
export type { PipelineNodeData };

const vscode = (window as any).acquireVsCodeApi ? (window as any).acquireVsCodeApi() : null;
(window as any).vscode = vscode;

/**
 * React Context providing the stable onLabelChange callback to canvas nodes.
 */
export const LabelChangeContext = createContext<((id: string, newLabel: string) => void) | null>(null);

/**
 * CanvasPipelineNode
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Stable wrapper around PipelineNode that injects the memoized onLabelChange callback
 * from React context. This avoids constructing new node/data objects on every App render,
 * preserving React Flow referential memoization and preventing canvas drag jank.
 */
export const CanvasPipelineNode: React.FC<PipelineNodeProps> = React.memo((props) => {
  const onLabelChange = useContext(LabelChangeContext);
  const data = useMemo(() => {
    if (!onLabelChange) return props.data;
    return {
      ...props.data,
      onLabelChange,
    };
  }, [props.data, onLabelChange]);

  return <PipelineNode {...props} data={data} />;
});

const nodeTypes = {
  pipeline: CanvasPipelineNode,
};

function App() {
  const { project, fitView } = useReactFlow();

  // Navigation and active tab state
  const [activeTab, setActiveTab] = useState<string | null>(() => {
    try {
      const vsState = (window as any).vscode?.getState?.()?.activeNodePaletteTab;
      if (vsState !== undefined) {
        return vsState;
      }
      if (typeof localStorage !== 'undefined') {
        const local = localStorage.getItem('beam_node_palette_active_tab');
        if (local !== null) {
          return local === '__NULL__' ? null : local;
        }
      }
    } catch {
      // Ignore persistence read error
    }
    return 'SOURCES';
  });

  const handleSetActiveTab = (tab: string | null) => {
    setActiveTab(tab);
    try {
      const vs = (window as any).vscode;
      if (vs?.setState) {
        const current = vs.getState?.() || {};
        vs.setState({ ...current, activeNodePaletteTab: tab });
      }
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('beam_node_palette_active_tab', tab === null ? '__NULL__' : tab);
      }
    } catch {
      // Ignore persistence write error
    }
  };

  const [showMiniMap, setShowMiniMap] = useState(false);
  const [bottomTab, setBottomTab] = useState('SOURCE_CODE');

  // Job and pipeline configuration state
  const [runtimeVariables, setRuntimeVariables] = useState<{ key: string; value: string }[]>([
    { key: 'LOG_LEVEL', value: 'INFO' },
    { key: 'NUM_WORKERS', value: '2' },
  ]);
  const [jobConfig, setJobConfig] = useState({
    runner: 'DirectRunner',
    machineType: 'n1-standard-1',
    minInstances: 1,
    maxInstances: 10,
    gcsStagingPath: '',
    network: '',
    subnetwork: '',
  });
  const [projectId, setProjectId] = useState('YOUR_PROJECT_ID');
  const [filename, setFilename] = useState('default_job');
  const [pipelineConfig, setPipelineConfig] = useState<PipelineConfig>({
    language: 'Python',
    outputFolder: '',
    needsRebuild: false,
  });

  // Undo / Redo history state
  const [history, setHistory] = useState<{
    nodes: any[];
    edges: any[];
    runtimeVariables: { key: string; value: string }[];
    jobConfig: any;
    pipelineConfig: any;
  }[]>([]);
  const [future, setFuture] = useState<{
    nodes: any[];
    edges: any[];
    runtimeVariables: { key: string; value: string }[];
    jobConfig: any;
    pipelineConfig: any;
  }[]>([]);

  // Snapshot taking function for history
  const stateRef = useRef<{
    nodes: any[];
    edges: any[];
    runtimeVariables: { key: string; value: string }[];
    jobConfig: any;
    pipelineConfig: any;
  }>({ nodes: [], edges: [], runtimeVariables, jobConfig, pipelineConfig });

  const takeSnapshot = useCallback(() => {
    setHistory((prev) => [...prev, stateRef.current]);
    setFuture([]);
  }, []);

  // Hook 1: Graph state and mutation helpers (A6)
  const {
    nodes,
    setNodes,
    edges,
    setEdges,
    selectedNodeId,
    setSelectedNodeId,
    setSelectedEdgeId,
    hasPubSubSource,
    handleNodesChange,
    handleEdgesChange,
    isValidConnection,
    onConnect,
    handleApplyProperties,
    handleNodeLabelChange,
    handleAddKVMapper,
    onLayout,
    onDrop,
    handleAddNode,
    onDragStart,
    onDragOver,
    deleteSelected,
  } = usePipelineGraph({
    takeSnapshot,
    setPipelineConfig,
    project,
    fitView,
  });

  // Keep stateRef synchronised with latest graph and config state
  useEffect(() => {
    stateRef.current = { nodes, edges, runtimeVariables, jobConfig, pipelineConfig };
  }, [nodes, edges, runtimeVariables, jobConfig, pipelineConfig]);

  // Hook 2: VS Code IPC bridge and message handler (A6)
  const {
    isLoaded,
    samples,
    generatedCode,
    subnetworks,
    folderFiles,
    selectedFileName,
    selectedFileContent,
    isGenerating,
    refreshFolderFiles,
    handleOpenSample,
    handlePickFolder,
    handleSelectFile,
    handleRunNow: ipcRunNow,
    handleRegenerate: ipcRegenerate,
  } = useVsCodeBridge({
    setNodes,
    setEdges,
    setRuntimeVariables,
    setJobConfig,
    pipelineConfig,
    setPipelineConfig,
    filename,
    setFilename,
    projectId,
    setProjectId,
    fitView,
    vscode,
  });

  // Hook 3: Pipeline Persistence with 2-second debounce and dirty-check (P6, A6)
  usePipelinePersistence({
    nodes,
    edges,
    runtimeVariables,
    jobConfig,
    pipelineConfig,
    isLoaded,
    vscode,
    debounceMs: 2000,
  });

  console.log('App rendering, isLoaded=', isLoaded, 'nodes=', nodes.length);

  // Undo / Redo handlers
  const undo = useCallback(() => {
    if (history.length === 0) return;
    const previousState = history[history.length - 1];
    setFuture((prev) => [{ nodes, edges, runtimeVariables, jobConfig, pipelineConfig }, ...prev]);
    setNodes(previousState.nodes);
    setEdges(previousState.edges);
    setRuntimeVariables(previousState.runtimeVariables);
    setJobConfig(previousState.jobConfig);
    setPipelineConfig(previousState.pipelineConfig);
    setHistory((prev) => prev.slice(0, -1));
  }, [history, nodes, edges, runtimeVariables, jobConfig, pipelineConfig, setNodes, setEdges]);

  const redo = useCallback(() => {
    if (future.length === 0) return;
    const nextState = future[0];
    setHistory((prev) => [...prev, { nodes, edges, runtimeVariables, jobConfig, pipelineConfig }]);
    setNodes(nextState.nodes);
    setEdges(nextState.edges);
    setRuntimeVariables(nextState.runtimeVariables);
    setJobConfig(nextState.jobConfig);
    setPipelineConfig(nextState.pipelineConfig);
    setFuture((prev) => prev.slice(1));
  }, [future, nodes, edges, runtimeVariables, jobConfig, pipelineConfig, setNodes, setEdges]);

  // Read files whenever bottom tab switches to SOURCE_CODE
  useEffect(() => {
    if (bottomTab === 'SOURCE_CODE' && isLoaded && !pipelineConfig.needsRebuild) {
      refreshFolderFiles();
    }
  }, [bottomTab, isLoaded, pipelineConfig.needsRebuild, refreshFolderFiles]);

  // Keyboard navigation and shortcuts (Undo, Redo, Delete)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const modifier = event.ctrlKey || event.metaKey;

      if (modifier && event.key === 'z') {
        event.preventDefault();
        undo();
        return;
      }
      if (modifier && (event.key === 'y' || (event.shiftKey && event.key === 'Z'))) {
        event.preventDefault();
        redo();
        return;
      }

      if (event.key === 'Delete' || event.key === 'Backspace') {
        const activeElement = document.activeElement;
        const isInputFocused =
          activeElement &&
          (activeElement.tagName === 'INPUT' ||
            activeElement.tagName === 'TEXTAREA' ||
            (activeElement instanceof HTMLElement && activeElement.isContentEditable));

        if (!isInputFocused) {
          deleteSelected();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, deleteSelected]);

  /**
   * Job config update wrapper that records an undo snapshot and flags needsRebuild on a
   * meaningful change.
   *
   * Accepts either a complete config object or an updater function. Children MUST pass an
   * updater: building `{...jobConfig, field}` from a props snapshot and returning it
   * wholesale means any other field changed since that render is silently reverted, because
   * the object replaces state entirely rather than merging into `prev`. That is how
   * `runner` reverted from Dataflow to DirectRunner while the rest of the config survived.
   */
  const handleSetJobConfig = useCallback(
    (update: React.SetStateAction<any>) => {
      takeSnapshot();
      setJobConfig((prev: any) => {
        // Resolve the updater against the freshest state, so a stale snapshot captured in a
        // child's render cannot clobber sibling fields.
        const config = typeof update === 'function' ? (update as (p: any) => any)(prev) : update;
        const configChanged =
          prev.machineType !== config.machineType ||
          prev.minInstances !== config.minInstances ||
          prev.maxInstances !== config.maxInstances ||
          prev.gcsStagingPath !== config.gcsStagingPath ||
          prev.network !== config.network ||
          prev.subnetwork !== config.subnetwork;

        if (configChanged) {
          setPipelineConfig((p) => (p.needsRebuild ? p : { ...p, needsRebuild: true }));
        }
        return config;
      });
    },
    [takeSnapshot]
  );

  // Runtime variable mutation helpers
  const addVariable = () => {
    takeSnapshot();
    setRuntimeVariables([...runtimeVariables, { key: 'NEW_VAR', value: 'value' }]);
    setPipelineConfig((prev) => ({ ...prev, needsRebuild: true }));
  };

  const updateVariable = (index: number, field: 'key' | 'value', value: string) => {
    takeSnapshot();
    setRuntimeVariables(
      runtimeVariables.map((v, i) => (i === index ? { ...v, [field]: value } : v))
    );
    setPipelineConfig((prev) => ({ ...prev, needsRebuild: true }));
  };

  const isJobIdValid = (value: string) => {
    const regex = /^[a-z]([-a-z0-9]*[a-z0-9])?$/;
    return regex.test(value);
  };

  const deleteVariable = (index: number) => {
    takeSnapshot();
    setRuntimeVariables(runtimeVariables.filter((_, i) => i !== index));
    setPipelineConfig((prev) => ({ ...prev, needsRebuild: true }));
  };

  // Execution and generation action delegates
  const handleRunNow = useCallback(() => {
    ipcRunNow(jobConfig, runtimeVariables);
  }, [ipcRunNow, jobConfig, runtimeVariables]);

  const handleRegenerate = useCallback(() => {
    ipcRegenerate({ nodes, edges, runtimeVariables, jobConfig });
  }, [ipcRegenerate, nodes, edges, runtimeVariables, jobConfig]);

  // Resize state for Bottom Panel
  const [bottomPanelHeight, setBottomPanelHeight] = useState(320);
  const [isBottomPanelExpanded, setIsBottomPanelExpanded] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const mainContentRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const container = mainContentRef.current;
      if (!container) return;
      const containerRect = container.getBoundingClientRect();
      let newHeight = containerRect.bottom - e.clientY;

      const minHeight = 100;
      const maxHeight = containerRect.height - 150;
      if (newHeight < minHeight) newHeight = minHeight;
      if (newHeight > maxHeight) newHeight = maxHeight;

      setBottomPanelHeight(newHeight);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  return (
    <div className="flex h-screen w-screen text-[var(--vscode-text-primary)] bg-[var(--vscode-canvas-bg)] overflow-hidden">
      {/* Main Content Area (Canvas + Bottom Panel) */}
      <div ref={mainContentRef} className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Diagram Canvas & Property Pane Area */}
        <div className={`flex-1 relative min-h-0 overflow-hidden ${isBottomPanelExpanded ? 'hidden' : 'flex'}`}>
          {/* Canvas */}
          <div className="flex-1 relative h-full min-w-0">
            {/* Floating Card on Left */}
            <NodesCard
              activeTab={activeTab}
              setActiveTab={handleSetActiveTab}
              nodesCount={nodes.length}
              hasPubSubSource={hasPubSubSource}
              onDragStart={onDragStart}
              onAddNode={handleAddNode}
              samples={samples}
              onOpenSample={handleOpenSample}
            />

            <LabelChangeContext.Provider value={handleNodeLabelChange}>
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={handleNodesChange}
                onEdgesChange={handleEdgesChange}
                onConnect={onConnect}
                nodeTypes={nodeTypes}
                isValidConnection={isValidConnection}
                fitView
                onNodeClick={(_, node) => {
                  setSelectedNodeId(node.id);
                  setSelectedEdgeId(null);
                }}
                onEdgeClick={(_, edge) => {
                  setSelectedEdgeId(edge.id);
                  setSelectedNodeId(null);
                }}
                onPaneClick={() => {
                  setSelectedNodeId(null);
                  setSelectedEdgeId(null);
                }}
                onDrop={onDrop}
                onDragOver={onDragOver}
                onNodeDragStop={() => takeSnapshot()}
              >
                <Controls
                  position="top-right"
                  style={{
                    top: '12px',
                    right: '12px',
                    margin: 0,
                  }}
                >
                  <ControlButton onClick={onLayout} title="Auto Layout Diagram">
                    <LayoutTemplate className="w-3.5 h-3.5" />
                  </ControlButton>
                  <ControlButton
                    onClick={() => setShowMiniMap((prev) => !prev)}
                    title={showMiniMap ? 'Collapse Navigation Map' : 'Expand Navigation Map'}
                    aria-label={showMiniMap ? 'Collapse Navigation Map' : 'Expand Navigation Map'}
                  >
                    <Map style={{ width: '14px', height: '14px' }} />
                  </ControlButton>
                </Controls>
                {showMiniMap && (
                  <MiniMap
                    position="top-right"
                    style={{
                      top: '58px',
                      right: '12px',
                      margin: 0,
                    }}
                    nodeColor={(node: any) => {
                      if (node.data?.type === 'SOURCE') return '#10b981';
                      if (node.data?.type === 'SINK') return '#ef4444';
                      return '#3b82f6';
                    }}
                  />
                )}
                <Background gap={12} size={1} />
              </ReactFlow>
            </LabelChangeContext.Provider>
          </div>

          {/* Property Pane on Right of Diagram */}
          {selectedNodeId && nodes.find((n) => n.id === selectedNodeId) && (
            <PropertyPane
              node={nodes.find((n) => n.id === selectedNodeId)!}
              onChange={(props) => handleApplyProperties(selectedNodeId, props)}
              onLabelChange={(newLabel) => handleNodeLabelChange(selectedNodeId, newLabel)}
              runtimeVariables={runtimeVariables}
              onAddKVMapper={handleAddKVMapper}
            />
          )}
        </div>

        {/* Resizable Divider */}
        {!isBottomPanelExpanded && (
          <div
            className="h-1 bg-[var(--vscode-border)] hover:bg-[var(--vscode-highlight)] cursor-row-resize transition-colors z-50 relative"
            onMouseDown={handleMouseDown}
          />
        )}

        {/* Bottom Panel */}
        <BottomPanel
          bottomTab={bottomTab}
          setBottomTab={setBottomTab}
          jobConfig={jobConfig}
          setJobConfig={handleSetJobConfig}
          runtimeVariables={runtimeVariables}
          addVariable={addVariable}
          updateVariable={updateVariable}
          deleteVariable={deleteVariable}
          isJobIdValid={isJobIdValid}
          generatedCode={generatedCode}
          onRunNow={handleRunNow}
          subnetworks={subnetworks}
          pipelineConfig={pipelineConfig}
          setPipelineConfig={setPipelineConfig}
          onRegenerate={handleRegenerate}
          folderFiles={folderFiles}
          selectedFileName={selectedFileName}
          selectedFileContent={selectedFileContent}
          onPickFolder={handlePickFolder}
          onSelectFile={handleSelectFile}
          height={bottomPanelHeight}
          isGenerating={isGenerating}
          isExpanded={isBottomPanelExpanded}
          onToggleExpand={() => setIsBottomPanelExpanded((prev) => !prev)}
        />
      </div>
    </div>
  );
}

export default function AppWithProvider() {
  return (
    <ThemeProvider>
      <ReactFlowProvider>
        <App />
      </ReactFlowProvider>
    </ThemeProvider>
  );
}
