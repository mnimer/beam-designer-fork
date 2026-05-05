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
import { BeamGenerator } from './generator/beamGenerator';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Handle,
  Position,
  type Connection,
  type Edge,
  ReactFlowProvider,
  useReactFlow,
} from 'reactflow';
import 'reactflow/dist/style.css';
import './App.css';
import { Trash2 } from 'lucide-react';
import { PipelineNode } from './components/PipelineNode';
import { SidebarItem } from './components/SidebarItem';
import { PropertyPane } from './components/PropertyPane';
import { NodesCard } from './components/NodesCard';
import { BottomPanel } from './components/BottomPanel/BottomPanel';

const vscode = (window as any).acquireVsCodeApi ? (window as any).acquireVsCodeApi() : null;





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
    data: { label: 'Windowing', type: 'STEP', iconName: 'Clock' }
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
  const [activeTab, setActiveTab] = useState('SOURCES');
  const [bottomTab, setBottomTab] = useState('DEPLOYMENT');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
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
    maxInstances: 10
  });
  console.log('App rendering, isLoaded=', isLoaded, 'nodes=', nodes.length);
  const { project } = useReactFlow();

  const [history, setHistory] = useState<{ nodes: any[], edges: any[], runtimeVariables: {key: string, value: string}[], jobConfig: any }[]>([]);
  const [future, setFuture] = useState<{ nodes: any[], edges: any[], runtimeVariables: {key: string, value: string}[], jobConfig: any }[]>([]);

  const stateRef = useRef({ nodes, edges, runtimeVariables, jobConfig });
  useEffect(() => {
    stateRef.current = { nodes, edges, runtimeVariables, jobConfig };
  }, [nodes, edges, runtimeVariables, jobConfig]);

  const takeSnapshot = useCallback(() => {
    setHistory((prev) => [...prev, stateRef.current]);
    setFuture([]);
  }, []);

  const undo = useCallback(() => {
    if (history.length === 0) return;
    const previousState = history[history.length - 1];
    setFuture((prev) => [{ nodes, edges, runtimeVariables, jobConfig }, ...prev]);
    setNodes(previousState.nodes);
    setEdges(previousState.edges);
    setRuntimeVariables(previousState.runtimeVariables);
    setJobConfig(previousState.jobConfig);
    setHistory((prev) => prev.slice(0, -1));
  }, [history, nodes, edges, runtimeVariables, jobConfig, setNodes, setEdges]);

  const redo = useCallback(() => {
    if (future.length === 0) return;
    const nextState = future[0];
    setHistory((prev) => [...prev, { nodes, edges, runtimeVariables, jobConfig }]);
    setNodes(nextState.nodes);
    setEdges(nextState.edges);
    setRuntimeVariables(nextState.runtimeVariables);
    setJobConfig(nextState.jobConfig);
    setFuture((prev) => prev.slice(1));
  }, [future, nodes, edges, runtimeVariables, jobConfig, setNodes, setEdges]);

  useEffect(() => {
    if (!isLoaded) return;
    console.log('[@App.tsx] Save effect triggered');
    if (vscode) {
      const state = { nodes, edges, runtimeVariables, jobConfig };
      const yamlStr = YAML.stringify(state);
      console.log('[@App.tsx] YAML generated');
      
      const generator = new BeamGenerator();
      const pythonCode = generator.generate(yamlStr);
      console.log('[@App.tsx] Python code generated, length:', pythonCode.length);
      setGeneratedCode(pythonCode);
      
      vscode.postMessage({ command: 'savePipeline', data: yamlStr, pythonCode: pythonCode });
      console.log('[@App.tsx] Sent savePipeline message');
    }
  }, [nodes, edges, runtimeVariables, jobConfig, isLoaded]);

  useEffect(() => {
    if (vscode) {
      vscode.postMessage({ command: 'ready' });

      const handleMessage = (event: MessageEvent) => {
        const message = event.data;
        if (message.command === 'loadPipeline') {
          console.log('Received loadPipeline message:', message);
          console.log('Received loadPipeline message, data length:', message.data ? message.data.length : 0);
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
                  ? message.filename.replace('.pipeline', '').replace(/ /g, '_') 
                  : 'default_job';
                variables.unshift({ key: 'JOB_ID', value: defaultJobId });
              }
              setRuntimeVariables(variables);
              setJobConfig(data.jobConfig || { runner: 'DirectRunner', machineType: 'n1-standard-1', minInstances: 1, maxInstances: 10 });
            } catch (e) {
              console.error('Failed to parse YAML', e);
            }
          } else {
            console.log('No data received, setting empty pipeline');
            setNodes([]);
            setEdges([]);
            const defaultJobId = message.filename 
              ? message.filename.replace('.pipeline', '').replace(/ /g, '_') 
              : 'default_job';
            setRuntimeVariables([{ key: 'JOB_ID', value: defaultJobId }]);
            setJobConfig({ runner: 'DirectRunner', machineType: 'n1-standard-1', minInstances: 1, maxInstances: 10 });
          }
          setIsLoaded(true);
        } else if (message.command === 'updateSource') {
          setGeneratedCode(message.data);
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

        if (!isInputFocused && selectedNodeId) {
          takeSnapshot();
          setNodes((nds) => nds.filter((node) => node.id !== selectedNodeId));
          setEdges((eds) => eds.filter((edge) => edge.source !== selectedNodeId && edge.target !== selectedNodeId));
          setSelectedNodeId(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodeId, setNodes, setEdges, takeSnapshot, undo, redo]);

  const addVariable = () => {
    takeSnapshot();
    setRuntimeVariables([...runtimeVariables, { key: 'NEW_VAR', value: 'value' }]);
  };

  const updateVariable = (index: number, field: 'key' | 'value', value: string) => {
    takeSnapshot();
    setRuntimeVariables(
      runtimeVariables.map((v, i) => (i === index ? { ...v, [field]: value } : v))
    );
  };

  const isJobIdValid = (value: string) => {
    const regex = /^[a-z]([-a-z0-9]*[a-z0-9])?$/;
    return regex.test(value);
  };

  const deleteVariable = (index: number) => {
    takeSnapshot();
    setRuntimeVariables(runtimeVariables.filter((_, i) => i !== index));
  };

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
    },
    [setEdges, takeSnapshot]
  );

  const handleApplyProperties = useCallback((nodeId: string, properties: any) => {
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
  }, [setNodes]);

  const onDragStart = useCallback((event: React.DragEvent, nodeType: string, label: string, type: string, iconName: string) => {
    event.dataTransfer.setData('application/reactflow', JSON.stringify({ nodeType, label, type, iconName }));
    event.dataTransfer.effectAllowed = 'move';
  }, []);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
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

      if (data.type === 'STEP') {
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
    },
    [project, setNodes, setEdges, nodes]
  );

  return (
    <div className="flex h-screen w-screen text-slate-200 bg-[#0F111A]">
      {/* Main Content Area (Canvas + Bottom Panel) */}
      <div className="flex-1 flex flex-col">
        {/* Canvas */}
        <div className="flex-1 relative">
          {/* Floating Card on Left */}
          <NodesCard 
            activeTab={activeTab} 
            setActiveTab={setActiveTab} 
            nodesCount={nodes.length} 
            onDragStart={onDragStart} 
          />

          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            isValidConnection={isValidConnection}
            fitView
            onNodeClick={(_, node) => setSelectedNodeId(node.id)}
            onPaneClick={() => setSelectedNodeId(null)}
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

        {/* Bottom Panel */}
        <BottomPanel 
          bottomTab={bottomTab}
          setBottomTab={setBottomTab}
          jobConfig={jobConfig}
          setJobConfig={setJobConfig}
          runtimeVariables={runtimeVariables}
          addVariable={addVariable}
          updateVariable={updateVariable}
          deleteVariable={deleteVariable}
          isJobIdValid={isJobIdValid}
          generatedCode={generatedCode}
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
