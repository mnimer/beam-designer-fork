/**
 * App Component
 * 
 * This is the main application component for the Apache Beam Designer.
 * It renders the canvas, sidebar, and property pane.
 * 
 * Architectural Decisions:
 * - Refactored to use separate components for nodes, property forms, and property pane to improve maintainability.
 * - Uses React Flow for the canvas.
 */

import { useCallback, useState, useEffect, useRef } from 'react';
import YAML from 'yaml';

import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  type Edge,
  ReactFlowProvider,
  useReactFlow,
} from 'reactflow';
import 'reactflow/dist/style.css';
import './App.css';
import { PipelineNode } from './components/PipelineNode';
import { PropertyPane } from './components/PropertyPane';
import { NodesCard } from './components/NodesCard';
import { BottomPanel } from './components/BottomPanel/BottomPanel';

const vscode = (window as any).acquireVsCodeApi ? (window as any).acquireVsCodeApi() : null;
(window as any).vscode = vscode;





const nodeTypes = {
  pipeline: PipelineNode,
};



const initialNodes = [
  {
    id: '1',
    type: 'pipeline',
    position: { x: 100, y: 200 },
    data: { label: 'PubSub_In', type: 'SOURCE', iconName: 'Radio' }
  },
  {
    id: '2',
    type: 'pipeline',
    position: { x: 400, y: 200 },
    data: { label: 'Window', type: 'STEP', iconName: 'Clock' }
  },
  {
    id: '3',
    type: 'pipeline',
    position: { x: 700, y: 200 },
    data: { label: 'BigQuery_Out', type: 'SINK', iconName: 'Database' }
  },
];

const initialEdges = [
  { id: 'e1-2', source: '1', target: '2' },
  { id: 'e2-3', source: '2', target: '3' },
];



function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const hasPubSubSource = nodes.some(n => n.data.type === 'SOURCE' && n.data.label.includes('PubSub'));
  const [activeTab, setActiveTab] = useState('SOURCES');
  const [bottomTab, setBottomTab] = useState('SOURCE_CODE');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [generatedCode, setGeneratedCode] = useState('');
  const [runtimeVariables, setRuntimeVariables] = useState<{key: string, value: string}[]>([
    { key: 'LOG_LEVEL', value: 'INFO' },
    { key: 'NUM_WORKERS', value: '2' }
  ]);
  const [jobConfig, setJobConfig] = useState({
    runner: 'DirectRunner',
    machineType: 'n1-standard-1',
    minInstances: 1,
    maxInstances: 10,
    gcsStagingPath: '',
    subnetwork: ''
  });
  const [projectId, setProjectId] = useState('YOUR_PROJECT_ID');
  const [subnetworks, setSubnetworks] = useState<{name: string, region: string, value: string}[]>([]);
  const [filename, setFilename] = useState('default_job');
  
  // Custom pipeline config state
  const [pipelineConfig, setPipelineConfig] = useState<{ language: 'Python' | 'Java', outputFolder: string, needsRebuild: boolean }>({
    language: 'Python',
    outputFolder: '',
    needsRebuild: false
  });
  const [folderFiles, setFolderFiles] = useState<string[]>([]);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [selectedFileContent, setSelectedFileContent] = useState<string | null>(null);

  // Resize state for Bottom Panel
  const [bottomPanelHeight, setBottomPanelHeight] = useState(320);
  const [isResizing, setIsResizing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
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

  console.log('App rendering, isLoaded=', isLoaded, 'nodes=', nodes.length);
  const { project, fitView } = useReactFlow();

  const [history, setHistory] = useState<{ 
    nodes: any[], 
    edges: any[], 
    runtimeVariables: {key: string, value: string}[], 
    jobConfig: any,
    pipelineConfig: any
  }[]>([]);
  const [future, setFuture] = useState<{ 
    nodes: any[], 
    edges: any[], 
    runtimeVariables: {key: string, value: string}[], 
    jobConfig: any,
    pipelineConfig: any
  }[]>([]);

  const stateRef = useRef({ nodes, edges, runtimeVariables, jobConfig, pipelineConfig });
  useEffect(() => {
    stateRef.current = { nodes, edges, runtimeVariables, jobConfig, pipelineConfig };
  }, [nodes, edges, runtimeVariables, jobConfig, pipelineConfig]);

  const takeSnapshot = useCallback(() => {
    setHistory((prev) => [...prev, stateRef.current]);
    setFuture([]);
  }, []);

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

  // Refresh files in the selected output folder
  const refreshFolderFiles = useCallback((folderPath: string = pipelineConfig.outputFolder) => {
    if (vscode) {
      vscode.postMessage({ command: 'readFolderFiles', folderPath });
    }
  }, [pipelineConfig.outputFolder]);

  useEffect(() => {
    console.log('[@App.tsx] Save effect checked, isLoaded=', isLoaded);
    if (!isLoaded) return;
    console.log('[@App.tsx] Save effect triggered');
    if (vscode && pipelineConfig.needsRebuild) {
      const state = { 
        nodes, 
        edges, 
        runtimeVariables, 
        jobConfig,
        pipelineConfig
      };
      const yamlStr = YAML.stringify(state);
      console.log('[@App.tsx] YAML generated');
      
      // Only save YAML configuration
      vscode.postMessage({ 
        command: 'savePipeline', 
        data: yamlStr
      });
      console.log('[@App.tsx] Sent savePipeline message (YAML config only)');
    }
  }, [nodes, edges, runtimeVariables, jobConfig, pipelineConfig, isLoaded, filename, projectId]);

  // Read files whenever bottom tab switches to SOURCE_CODE
  useEffect(() => {
    if (bottomTab === 'SOURCE_CODE' && isLoaded && !pipelineConfig.needsRebuild) {
      refreshFolderFiles();
    }
  }, [bottomTab, isLoaded, pipelineConfig.needsRebuild, refreshFolderFiles]);

  useEffect(() => {
    if (vscode) {
      vscode.postMessage({ command: 'ready' });
      vscode.postMessage({ command: 'getSubnetworks' });

      const handleMessage = (event: MessageEvent) => {
        const message = event.data;
        if (message.command === 'loadPipeline') {
          console.log('Received loadPipeline message:', message);
          setFilename(message.filename || 'default_job');
          if (message.projectId) {
            setProjectId(message.projectId);
          }
          if (message.data) {
            try {
              const data = YAML.parse(message.data);
              console.log('Parsed YAML data:', data);
              setNodes(data.nodes || []);
              setEdges(data.edges || []);
              const variables = data.runtimeVariables || [];
              const hasJobId = variables.some((v: any) => v.key === 'JOB_ID');
              if (!hasJobId) {
                const defaultJobId = message.filename 
                  ? message.filename.replace('.beam', '').replace(/ /g, '_') 
                  : 'default_job';
                variables.unshift({ key: 'JOB_ID', value: defaultJobId });
              }
              setRuntimeVariables(variables);
              setJobConfig(data.jobConfig || { runner: 'DirectRunner', machineType: 'n1-standard-1', minInstances: 1, maxInstances: 10, gcsStagingPath: '', subnetwork: '' });
              
              const config = data.pipelineConfig || { language: 'Python', outputFolder: '', needsRebuild: false };
              if (config.needsRebuild === undefined) {
                config.needsRebuild = false;
              }
              setPipelineConfig(config);
            } catch (e) {
              console.error('Failed to parse YAML', e);
            }
          } else {
            console.log('No data received, setting empty pipeline');
            setNodes([]);
            setEdges([]);
            const defaultJobId = message.filename 
              ? message.filename.replace('.beam', '').replace(/ /g, '_') 
              : 'default_job';
            setRuntimeVariables([{ key: 'JOB_ID', value: defaultJobId }]);
            setJobConfig({ runner: 'DirectRunner', machineType: 'n1-standard-1', minInstances: 1, maxInstances: 10, gcsStagingPath: '', subnetwork: '' });
            setPipelineConfig({ language: 'Python', outputFolder: '', needsRebuild: false });
          }
          setIsLoaded(true);
          
          setTimeout(() => {
            fitView({ duration: 0, padding: 1 });
          }, 100);
        } else if (message.command === 'updateSource') {
          setGeneratedCode(message.data);
        } else if (message.command === 'codeRegenerated') {
          setIsGenerating(false);
          if (message.success) {
            setPipelineConfig(prev => ({ ...prev, needsRebuild: false }));
            setGeneratedCode(message.code || '');
            refreshFolderFiles();
          }
        } else if (message.command === 'subnetworksLoaded') {
          setSubnetworks(message.subnetworks);
        } else if (message.command === 'folderFilesLoaded') {
          setFolderFiles(message.files || []);
        } else if (message.command === 'fileContentLoaded') {
          setSelectedFileContent(message.content);
        } else if (message.command === 'folderSelected') {
          setPipelineConfig(prev => ({
            ...prev,
            outputFolder: message.path,
            needsRebuild: true
          }));
        }
      };
      window.addEventListener('message', handleMessage);
      return () => window.removeEventListener('message', handleMessage);
    }
  }, [setNodes, setEdges, setRuntimeVariables]);

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
        const isInputFocused = activeElement && (
          activeElement.tagName === 'INPUT' ||
          activeElement.tagName === 'TEXTAREA' ||
          (activeElement instanceof HTMLElement && activeElement.isContentEditable)
        );

        if (!isInputFocused) {
          if (selectedNodeId) {
            takeSnapshot();
            setNodes((nds) => nds.filter((node) => node.id !== selectedNodeId));
            setEdges((eds) => eds.filter((edge) => edge.source !== selectedNodeId && edge.target !== selectedNodeId));
            setSelectedNodeId(null);
            setPipelineConfig(prev => ({ ...prev, needsRebuild: true }));
          } else if (selectedEdgeId) {
            takeSnapshot();
            setEdges((eds) => eds.filter((edge) => edge.id !== selectedEdgeId));
            setSelectedEdgeId(null);
            setPipelineConfig(prev => ({ ...prev, needsRebuild: true }));
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodeId, selectedEdgeId, setNodes, setEdges, takeSnapshot, undo, redo]);

  // Wrap state changes to set needsRebuild: true
  const handleNodesChange = useCallback((changes: any) => {
    onNodesChange(changes);
    const requiresRebuild = changes.some((c: any) => c.type === 'add' || c.type === 'remove');
    if (requiresRebuild) {
      setPipelineConfig(prev => prev.needsRebuild ? prev : { ...prev, needsRebuild: true });
    }
  }, [onNodesChange]);

  const handleEdgesChange = useCallback((changes: any) => {
    onEdgesChange(changes);
    const requiresRebuild = changes.some((c: any) => c.type === 'remove');
    if (requiresRebuild) {
      setPipelineConfig(prev => prev.needsRebuild ? prev : { ...prev, needsRebuild: true });
    }
  }, [onEdgesChange]);

  const handleSetJobConfig = useCallback((config: any) => {
    takeSnapshot();
    setJobConfig(config);
    setPipelineConfig(prev => ({ ...prev, needsRebuild: true }));
  }, [takeSnapshot]);

  const addVariable = () => {
    takeSnapshot();
    setRuntimeVariables([...runtimeVariables, { key: 'NEW_VAR', value: 'value' }]);
    setPipelineConfig(prev => ({ ...prev, needsRebuild: true }));
  };

  const updateVariable = (index: number, field: 'key' | 'value', value: string) => {
    takeSnapshot();
    setRuntimeVariables(
      runtimeVariables.map((v, i) => (i === index ? { ...v, [field]: value } : v))
    );
    setPipelineConfig(prev => ({ ...prev, needsRebuild: true }));
  };

  const isJobIdValid = (value: string) => {
    const regex = /^[a-z]([-a-z0-9]*[a-z0-9])?$/;
    return regex.test(value);
  };

  const deleteVariable = (index: number) => {
    takeSnapshot();
    setRuntimeVariables(runtimeVariables.filter((_, i) => i !== index));
    setPipelineConfig(prev => ({ ...prev, needsRebuild: true }));
  };

  const handleRunNow = useCallback(() => {
    console.log('[@App.tsx] handleRunNow called');
    if (vscode) {
      vscode.postMessage({ 
        command: 'runPipeline',
        jobConfig,
        runtimeVariables,
        pipelineConfig
      });
    } else {
      alert('VS Code API is not available. This feature only works when running inside the VS Code extension.');
    }
  }, [jobConfig, runtimeVariables, pipelineConfig]);

  const isValidConnection = useCallback(
    (connection: Connection) => {
      const sourceNode = nodes.find((n) => n.id === connection.source);
      const targetNode = nodes.find((n) => n.id === connection.target);

      if (sourceNode?.data.type === 'SOURCE' && targetNode?.data.type === 'SINK') {
        return false;
      }

      return true;
    },
    [nodes]
  );

  const onConnect = useCallback(
    (params: Connection | Edge) => {
      takeSnapshot();
      setEdges((eds) => addEdge(params, eds));
      setPipelineConfig(prev => ({ ...prev, needsRebuild: true }));
    },
    [setEdges, takeSnapshot]
  );

  const handleApplyProperties = useCallback((nodeId: string, properties: any) => {
    console.log('[@App.tsx] handleApplyProperties called', nodeId, properties);
    takeSnapshot();
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === nodeId) {
          return {
            ...node,
            data: {
              ...node.data,
              properties,
            },
          };
        }
        return node;
      })
    );
    setPipelineConfig(prev => ({ ...prev, needsRebuild: true }));
  }, [setNodes]);

  const handleRegenerate = useCallback(() => {
    if (vscode) {
      setIsGenerating(true);
      const state = { 
        nodes, 
        edges, 
        runtimeVariables, 
        jobConfig,
        pipelineConfig: { ...pipelineConfig, needsRebuild: false }
      };
      const yamlStr = YAML.stringify(state);
      vscode.postMessage({
        command: 'regenerateCode',
        data: yamlStr,
        filename: filename,
        language: pipelineConfig.language,
        outputFolder: pipelineConfig.outputFolder
      });
    }
  }, [nodes, edges, runtimeVariables, jobConfig, pipelineConfig, filename]);

  const handlePickFolder = useCallback(() => {
    if (vscode) {
      vscode.postMessage({ command: 'pickFolder' });
    }
  }, []);

  const handleSelectFile = useCallback((fileName: string) => {
    setSelectedFileName(fileName);
    if (vscode) {
      vscode.postMessage({ 
        command: 'readFileContent', 
        filePath: fileName,
        folderPath: pipelineConfig.outputFolder
      });
    }
  }, [pipelineConfig.outputFolder]);

  const onDragStart = useCallback((event: React.DragEvent, nodeType: string, label: string, type: string, iconName: string) => {
    event.dataTransfer.setData('application/reactflow', JSON.stringify({ nodeType, label, type, iconName }));
    event.dataTransfer.effectAllowed = 'move';
  }, []);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  /**
   * Handles the drop event when a node is dragged from the sidebar onto the canvas.
   * It creates a new node at the drop position and automatically connects it to a source
   * if it's the first step or if it's a PubSub specific step.
   */  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const reactFlowBounds = document.querySelector('.react-flow')?.getBoundingClientRect();
      const dataStr = event.dataTransfer.getData('application/reactflow');

      if (!dataStr || !reactFlowBounds) {
        return;
      }

      const data = JSON.parse(dataStr);

      const position = project({
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      });

      const newNode = {
        id: `${Date.now()}`,
        type: data.nodeType,
        position,
        data: {
          label: data.label,
          type: data.type,
          iconName: data.iconName
        },
      };

      takeSnapshot();
      setNodes((nds) => nds.concat(newNode));
      setPipelineConfig(prev => ({ ...prev, needsRebuild: true }));

      if (data.type === 'STEP') {
        if (data.label === 'Parse JSON' || data.label === 'Parse Base64') {
          const pubSubSource = nodes.find(n => n.data.type === 'SOURCE' && n.data.label.includes('PubSub'));
          if (pubSubSource) {
            const newEdge = {
              id: `e-${pubSubSource.id}-${newNode.id}`,
              source: pubSubSource.id,
              target: newNode.id,
            };
            setEdges((eds) => eds.concat(newEdge));
          }
        } else {
          const hasStep = nodes.some(n => n.data.type === 'STEP');
          if (!hasStep) {
            const sourceNode = nodes.find(n => n.data.type === 'SOURCE');
            if (sourceNode) {
              const newEdge = {
                id: `e-${sourceNode.id}-${newNode.id}`,
                source: sourceNode.id,
                target: newNode.id,
              };
              setEdges((eds) => eds.concat(newEdge));
            }
          }
        }
      }
    },
    [project, setNodes, setEdges, nodes, takeSnapshot]
  );

  return (
    <div className="flex h-screen w-screen text-slate-200 bg-[#0F111A]">
      {/* Main Content Area (Canvas + Bottom Panel) */}
      <div ref={mainContentRef} className="flex-1 flex flex-col min-h-0">
        {/* Canvas */}
        <div className="flex-1 relative">
          {/* Floating Card on Left */}
          <NodesCard 
            activeTab={activeTab} 
            setActiveTab={setActiveTab} 
            nodesCount={nodes.length} 
            hasPubSubSource={hasPubSubSource}
            onDragStart={onDragStart} 
          />

          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={handleNodesChange}
            onEdgesChange={handleEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            isValidConnection={isValidConnection}
            fitView
            onNodeClick={(_, node) => { setSelectedNodeId(node.id); setSelectedEdgeId(null); }}
            onEdgeClick={(_, edge) => { setSelectedEdgeId(edge.id); setSelectedNodeId(null); }}
            onPaneClick={() => { setSelectedNodeId(null); setSelectedEdgeId(null); }}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onNodeDragStop={() => takeSnapshot()}
          >
            <Controls />
            <MiniMap
              nodeColor={(node: any) => {
                if (node.data?.type === 'SOURCE') return '#3b82f6';
                if (node.data?.type === 'SINK') return '#10b981';
                return '#f97316';
              }}
            />
            <Background gap={12} size={1} />
          </ReactFlow>
        </div>

        {/* Resizable Divider */}
        <div 
          className="h-1 bg-slate-700 hover:bg-blue-500 cursor-row-resize transition-colors z-50 relative"
          onMouseDown={handleMouseDown}
        />

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
        />
      </div>

      {/* Property Pane on Right */}
      {selectedNodeId && nodes.find(n => n.id === selectedNodeId) && (
        <PropertyPane 
          node={nodes.find(n => n.id === selectedNodeId)!} 
          onChange={(props) => handleApplyProperties(selectedNodeId, props)} 
          runtimeVariables={runtimeVariables} 
        />
      )}
    </div>
  );
}

export default function AppWithProvider() {
  return (
    <ReactFlowProvider>
      <App />
    </ReactFlowProvider>
  );
}
