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
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { validateDiagramLanguageSupport } from './utils/nodeLanguageSupport';
import { NodesCard } from './components/NodesCard';
import { BottomPanel } from './components/BottomPanel/BottomPanel';
import {
  BottomPanelProvider,
  type BottomPanelContextValue,
} from './components/BottomPanel/BottomPanelContext';

import { usePipelinePersistence } from './hooks/usePipelinePersistence';
import { usePipelineGraph, type PipelineNodeData } from './hooks/usePipelineGraph';
import { useVsCodeBridge, findMainPipelineFile, PLACEHOLDER_PROJECT_ID, type PipelineConfig } from './hooks/useVsCodeBridge';
import { pipelineConfigReducer } from './state/pipelineConfigReducer';
import { useRuntimeVariables, DEFAULT_RUNTIME_VARIABLES } from './hooks/useRuntimeVariables';
import { usePipelineExecution } from './hooks/usePipelineExecution';
import { usePanelResize } from './hooks/usePanelResize';
import { useUndoRedoHistory, isEditableTarget } from './hooks/useUndoRedoHistory';
import { getVsCodeApi, postToHost } from './bridge/vscodeApi';

export { findMainPipelineFile };
export type { PipelineNodeData };

const vscode = getVsCodeApi() ?? null;

/**
 * React Context providing the stable onLabelChange callback to canvas nodes.
 */
export const LabelChangeContext = createContext<((id: string, newLabel: string) => void) | null>(null);

/**
 * CanvasPipelineNode
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

/**
 * State snapshot recorded for canvas undo/redo operations.
 */
interface PipelineSnapshot {
  nodes: any[];
  edges: any[];
  runtimeVariables: { key: string; value: string }[];
  jobConfig: any;
  pipelineConfig: PipelineConfig;
}

/**
 * Root designer workspace component hosting the React Flow canvas, node palette, property panel, and bottom panel.
 *
 * @returns The rendered Apache Beam pipeline designer application.
 */
function App() {
  const { project, fitView } = useReactFlow();

  // Navigation and active tab state
  const [activeTab, setActiveTab] = useState<string | null>(() => {
    try {
      const vsState = (getVsCodeApi()?.getState?.() as any)?.activeNodePaletteTab;
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
      const vs = getVsCodeApi();
      if (vs?.setState) {
        const current = (vs.getState?.() as any) || {};
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
  const [jobConfig, setJobConfig] = useState<{
    runner: string;
    machineType?: string;
    minInstances?: number;
    maxInstances?: number;
    gcsStagingPath?: string;
    network?: string;
    subnetwork?: string;
    jobId?: string;
    region?: string;
    projectId?: string;
  }>({
    runner: 'DirectRunner',
    machineType: 'n1-standard-1',
    minInstances: 1,
    maxInstances: 10,
    gcsStagingPath: '',
    network: '',
    subnetwork: '',
    jobId: '',
    region: 'us-central1',
    projectId: ''
  });
  const [projectId, setProjectId] = useState(PLACEHOLDER_PROJECT_ID);
  const [filename, setFilename] = useState('default_job');
  const [pipelineConfig, setPipelineConfig] = useState<PipelineConfig>({
    language: 'Python',
    outputFolder: '',
    needsRebuild: false,
  });

  // Snapshot ref for useUndoRedoHistory (finding F10)
  const snapshotRef = useRef<PipelineSnapshot>({
    nodes: [],
    edges: [],
    runtimeVariables: DEFAULT_RUNTIME_VARIABLES.map((v) => ({ ...v })),
    jobConfig,
    pipelineConfig,
  });

  const restoreRef = useRef<(snapshot: PipelineSnapshot) => void>(() => {});

  const { takeSnapshot, undo, redo } = useUndoRedoHistory<PipelineSnapshot>({
    capture: useCallback(() => snapshotRef.current, []),
    restore: useCallback((snapshot: PipelineSnapshot) => {
      restoreRef.current(snapshot);
    }, []),
  });

  const {
    runtimeVariables,
    setRuntimeVariables,
    addVariable,
    updateVariable,
    deleteVariable,
  } = useRuntimeVariables({
    takeSnapshot,
    setPipelineConfig,
  });

  // Hook 1: Graph state and mutation helpers (A6)
  const {
    nodes,
    setNodes,
    edges,
    setEdges,
    displayNodes,
    displayEdges,
    dagValidation,
    selectedNodeId,
    setSelectedNodeId,
    selectedEdgeId,
    setSelectedEdgeId,
    hasPubSubSource,
    handleNodesChange,
    handleEdgesChange,
    isValidConnection,
    onConnect,
    handleApplyProperties,
    handleNodeLabelChange,
    handleAddKVMapper,
    handleAddPubSubSource,
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

  // Keep snapshotRef and restoreRef synchronised with latest graph and config state
  useEffect(() => {
    snapshotRef.current = { nodes, edges, runtimeVariables, jobConfig, pipelineConfig };
  }, [nodes, edges, runtimeVariables, jobConfig, pipelineConfig]);

  useEffect(() => {
    restoreRef.current = (snapshot: PipelineSnapshot) => {
      setNodes(snapshot.nodes);
      setEdges(snapshot.edges);
      setRuntimeVariables(snapshot.runtimeVariables);
      setJobConfig(snapshot.jobConfig);
      setPipelineConfig((prev) => pipelineConfigReducer(prev, { type: 'reset', config: snapshot.pipelineConfig }));
    };
  }, [setNodes, setEdges, setRuntimeVariables, setJobConfig, setPipelineConfig]);

  // Hook 2: VS Code IPC bridge and message handler (A6)
  const {
    isLoaded,
    loadRevision,
    samples,
    generatedCode,
    subnetworks,
    folderFiles,
    selectedFileName,
    selectedFileContent,
    isGenerating,
    tokenUsage,
    refreshFolderFiles,
    handleOpenSample,
    handlePickFolder,
    handleSelectFile,
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
  const { lastSavedYamlRef, serializePipeline } = usePipelinePersistence({
    nodes,
    edges,
    runtimeVariables,
    jobConfig,
    pipelineConfig,
    isLoaded,
    loadRevision,
    vscode,
    debounceMs: 2000,
  });

  console.log('App rendering, isLoaded=', isLoaded, 'nodes=', nodes.length);


  // Read files whenever bottom tab switches to SOURCE_CODE
  useEffect(() => {
    if (bottomTab === 'SOURCE_CODE' && isLoaded && !pipelineConfig.needsRebuild) {
      refreshFolderFiles();
    }
  }, [bottomTab, isLoaded, pipelineConfig.needsRebuild, refreshFolderFiles]);

  // Hook 4: Pipeline execution state, log streaming, and IPC handlers
  const {
    pipelineLogs,
    pipelineStatus,
    runnerCommand,
    handleRunNow,
    handleStopPipeline,
    handleClearLogs,
  } = usePipelineExecution({
    jobConfig,
    runtimeVariables,
    pipelineConfig,
    setJobConfig,
    projectId,
    vscode,
  });

  // Keyboard navigation and shortcuts (Undo, Redo, Delete)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target) || isEditableTarget(document.activeElement)) {
        return;
      }

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
        deleteSelected();
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
          setPipelineConfig((p) => pipelineConfigReducer(p, { type: 'markDirty' }));
        }
        return config;
      });
    },
    [takeSnapshot]
  );

  const isJobIdValid = (value: string) => {
    const regex = /^[a-z]([-a-z0-9]*[a-z0-9])?$/;
    return regex.test(value);
  };

  const handleOpenConsole = useCallback((url: string) => {
    const vs = getVsCodeApi();
    if (vs) {
      vs.postMessage({
        command: 'openExternal',
        url
      });
    } else {
      window.open(url, '_blank');
    }
  }, []);

  const handleStopGeneration = useCallback(() => {
    postToHost({
      command: 'stopCodeGeneration'
    });
  }, []);

  const languageValidation = useMemo(
    () => validateDiagramLanguageSupport(nodes, pipelineConfig.language || 'Python'),
    [nodes, pipelineConfig.language]
  );

  const isCodegenValid = dagValidation.isValid && languageValidation.isValid;
  const combinedValidationErrors = useMemo(
    () => Array.from(new Set([...dagValidation.errors, ...languageValidation.errors])),
    [dagValidation.errors, languageValidation.errors]
  );

  const handleRegenerate = useCallback(() => {
    if (!isCodegenValid) {
      console.warn('Blocked regenerateCode: validation failed', combinedValidationErrors);
      return;
    }
    lastSavedYamlRef.current = serializePipeline({
      nodes,
      edges,
      runtimeVariables,
      jobConfig,
      pipelineConfig,
    });
    ipcRegenerate({ nodes, edges, runtimeVariables, jobConfig });
  }, [ipcRegenerate, nodes, edges, runtimeVariables, jobConfig, pipelineConfig, isCodegenValid, combinedValidationErrors, lastSavedYamlRef, serializePipeline]);

  // Resize state for Bottom Panel
  const [isBottomPanelExpanded, setIsBottomPanelExpanded] = useState(false);
  const mainContentRef = useRef<HTMLDivElement>(null);

  const {
    size: bottomPanelHeight,
    startResize: handleMouseDown,
  } = usePanelResize({
    axis: 'y',
    initialSize: 320,
    cursor: 'row-resize',
    computeSize: (e, startSize) => {
      const container = mainContentRef.current;
      if (!container) return startSize;
      const containerRect = container.getBoundingClientRect();
      let newHeight = containerRect.bottom - e.clientY;

      const minHeight = 100;
      const maxHeight = containerRect.height - 150;
      if (newHeight < minHeight) newHeight = minHeight;
      if (newHeight > maxHeight) newHeight = maxHeight;

      return newHeight;
    },
  });

  // Property panel resizing state (default 320px = w-80, minimum 320px)
  // Note: Width is now persisted to localStorage on mouseup via onResizeEnd (previously every mousemove) — intentional.
  const {
    size: propertyPanelWidth,
    isResizing: isPropertyPanelResizing,
    startResize: handlePropertyPanelResizeStart,
  } = usePanelResize({
    axis: 'x',
    initialSize: () => {
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          const saved = Number(window.localStorage.getItem('beam_property_panel_width'));
          if (!isNaN(saved) && saved >= 320) {
            return saved;
          }
        } catch {
          // Ignore localStorage access restrictions in iframe
        }
      }
      return 320;
    },
    cursor: 'col-resize',
    computeSize: (e) => {
      const container = mainContentRef.current;
      const containerRect = container?.getBoundingClientRect();
      const rightEdge = (containerRect && containerRect.right > 0) ? containerRect.right : (window.innerWidth || 1024);
      let newWidth = rightEdge - e.clientX;

      const minWidth = 320;
      const containerWidth = (containerRect && containerRect.width > 0) ? containerRect.width : (window.innerWidth || 1024);
      const maxWidth = Math.max(minWidth, containerWidth - 150);

      if (newWidth < minWidth) newWidth = minWidth;
      if (newWidth > maxWidth) newWidth = maxWidth;

      return newWidth;
    },
    onResizeEnd: (size) => {
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          window.localStorage.setItem('beam_property_panel_width', String(size));
        } catch {
          // Ignore localStorage error
        }
      }
    },
  });

  /**
   * Closes any open property pane when the user interacts with any field or button in the bottom panel tabs.
   */
  const handleBottomPanelInteract = useCallback(() => {
    if (selectedNodeId) {
      setSelectedNodeId(null);
    }
    if (selectedEdgeId) {
      setSelectedEdgeId(null);
    }
  }, [selectedNodeId, selectedEdgeId, setSelectedNodeId, setSelectedEdgeId]);

  // Context value bundle for BottomPanel and its child tabs (Phase 5)
  const bottomPanelContextValue = useMemo<BottomPanelContextValue>(
    () => ({
      execution: {
        logs: pipelineLogs,
        status: pipelineStatus,
        runnerCommand,
        run: handleRunNow,
        stop: handleStopPipeline,
        clear: handleClearLogs,
        openConsole: handleOpenConsole,
      },
      jobConfig: {
        value: jobConfig,
        set: handleSetJobConfig,
        isJobIdValid,
        subnetworks,
        projectId,
      },
      runtimeVariables: {
        variables: runtimeVariables,
        addVariable,
        updateVariable,
        deleteVariable,
      },
      pipelineConfig: {
        config: pipelineConfig,
        setLanguage: (lang) =>
          setPipelineConfig((prev) =>
            pipelineConfigReducer(prev, { type: 'setLanguage', language: lang })
          ),
        setOutputFolder: (folder) =>
          setPipelineConfig((prev) =>
            pipelineConfigReducer(prev, { type: 'setOutputFolder', folder })
          ),
        setPipelineConfig,
      },
      codegen: {
        generatedCode,
        regenerate: handleRegenerate,
        stopGeneration: handleStopGeneration,
        isGenerating,
        files: folderFiles,
        selectedFile: selectedFileName,
        selectedFileContent,
        pickFolder: handlePickFolder,
        selectFile: handleSelectFile,
        isGraphValid: isCodegenValid,
        validationErrors: combinedValidationErrors,
        nodes,
        tokenUsage,
      },
    }),
    [
      pipelineLogs,
      pipelineStatus,
      runnerCommand,
      handleRunNow,
      handleStopPipeline,
      handleClearLogs,
      handleOpenConsole,
      jobConfig,
      handleSetJobConfig,
      subnetworks,
      projectId,
      runtimeVariables,
      addVariable,
      updateVariable,
      deleteVariable,
      pipelineConfig,
      setPipelineConfig,
      generatedCode,
      handleRegenerate,
      handleStopGeneration,
      isGenerating,
      folderFiles,
      selectedFileName,
      selectedFileContent,
      handlePickFolder,
      handleSelectFile,
      isCodegenValid,
      combinedValidationErrors,
      nodes,
      tokenUsage,
    ]
  );

  return (
    <div className="flex h-screen w-screen text-[var(--vscode-text-primary)] bg-[var(--vscode-canvas-bg)] overflow-hidden">
      {/* Main Content Area (Canvas + Bottom Panel) */}
      <div ref={mainContentRef} className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
        {/* Diagram Canvas Area */}
        <div className={`flex-1 relative min-h-0 overflow-hidden ${isBottomPanelExpanded ? 'hidden' : 'flex'}`}>
          {/* Canvas */}
          <div
            className="flex-1 relative h-full min-w-0"
            style={{
              marginRight: selectedNodeId ? `${propertyPanelWidth}px` : 0,
              transition: isPropertyPanelResizing ? 'none' : 'margin-right 150ms ease-out',
            }}
          >
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
                nodes={displayNodes}
                edges={displayEdges}
                onNodesChange={handleNodesChange}
                onEdgesChange={handleEdgesChange}
                onConnect={onConnect}
                nodeTypes={nodeTypes}
                isValidConnection={isValidConnection}
                connectionRadius={32}
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
        </div>

        {/* Resizable Divider */}
        {!isBottomPanelExpanded && (
          <div
            className="h-1 bg-[var(--vscode-border)] hover:bg-[var(--vscode-highlight)] cursor-row-resize transition-colors z-30 relative"
            onMouseDown={(e) => {
              handleMouseDown(e);
              handleBottomPanelInteract();
            }}
          />
        )}

        {/* Bottom Panel */}
        <BottomPanelProvider value={bottomPanelContextValue}>
          <BottomPanel
            bottomTab={bottomTab}
            setBottomTab={setBottomTab}
            height={bottomPanelHeight}
            isExpanded={isBottomPanelExpanded}
            onToggleExpand={() => setIsBottomPanelExpanded((prev) => !prev)}
            onInteract={handleBottomPanelInteract}
          />
        </BottomPanelProvider>

        {/* Property Pane taking full height of window, over tabs on bottom */}
        {selectedNodeId && displayNodes.find((n) => n.id === selectedNodeId) && (
          <div
            className="absolute right-0 top-0 bottom-0 z-40 shadow-2xl flex"
            style={{ width: `${propertyPanelWidth}px` }}
          >
            <ErrorBoundary fallbackTitle="Property Panel Error">
              <PropertyPane
                node={displayNodes.find((n) => n.id === selectedNodeId)!}
                onChange={(props) => handleApplyProperties(selectedNodeId, props)}
                onLabelChange={(newLabel) => handleNodeLabelChange(selectedNodeId, newLabel)}
                runtimeVariables={runtimeVariables}
                onAddKVMapper={handleAddKVMapper}
                onAddPubSubSource={handleAddPubSubSource}
                width={propertyPanelWidth}
                onResizeStart={handlePropertyPanelResizeStart}
                onClose={() => setSelectedNodeId(null)}
              />
            </ErrorBoundary>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Application root wrapped with the ReactFlowProvider context required for canvas coordinate projection.
 *
 * @returns The root application component enclosed in ReactFlowProvider.
 */
export default function AppWithProvider() {
  return (
    <ReactFlowProvider>
      <App />
    </ReactFlowProvider>
  );
}
