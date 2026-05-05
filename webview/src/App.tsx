import { useCallback, useState, useEffect, useRef } from 'react';
import YAML from 'yaml';
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
import { Search, Database, Cloud, HardDrive, Cable, Radio, Share2, Clock, Layers, BarChart, Box, FileCode } from 'lucide-react';
const vscode = (window as any).acquireVsCodeApi ? (window as any).acquireVsCodeApi() : null;

const iconComponentMap: Record<string, any> = {
  Radio, Database, Cable, Share2, HardDrive, Cloud, Clock, Layers, BarChart, Box, FileCode
};

const PipelineNode = ({ data, selected }: { data: { label: string, type: string, iconName: string }, selected?: boolean }) => {
  const isSource = data.type === 'SOURCE';
  const isSink = data.type === 'SINK';

  const IconComponent = iconComponentMap[data.iconName];

  return (
    <div className={`bg-[#1E202A] border ${selected ? 'border-blue-500' : 'border-slate-700'} rounded-md shadow-xl p-3 flex items-center gap-3 min-w-[180px] text-left`}>
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

      {!isSink && (
        <Handle type="source" position={Position.Right} className="w-2 h-2 bg-blue-500 border-none" />
      )}
    </div>
  );
};

const nodeTypes = {
  pipeline: PipelineNode,
};

const PropertyForm = ({ node, onChange }: { node: any, onChange: (properties: any) => void }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    onChange({ ...(node.data.properties || {}), [e.target.name]: e.target.value });
  };

  const { label } = node.data;
  const properties = node.data.properties || {};

  let formContent = null;

  if (label.includes('PubSub')) {
    formContent = (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold uppercase text-slate-500">Topic</label>
          <input type="text" name="topic" value={properties.topic || ''} onChange={handleChange} placeholder="projects/my-project/topics/my-topic" className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm" />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold uppercase text-slate-500">Subscription</label>
          <input type="text" name="subscription" value={properties.subscription || ''} onChange={handleChange} placeholder="projects/my-project/subscriptions/my-sub" className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm" />
        </div>
      </div>
    );
  } else if (label.includes('BigQuery')) {
    formContent = (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold uppercase text-slate-500">Table</label>
          <input type="text" name="table" value={properties.table || ''} onChange={handleChange} placeholder="my-project:my_dataset.my_table" className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm" />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold uppercase text-slate-500">Create Disposition</label>
          <select name="createDisposition" value={properties.createDisposition || 'CREATE_IF_NEEDED'} onChange={handleChange} className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm">
            <option>CREATE_IF_NEEDED</option>
            <option>CREATE_NEVER</option>
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold uppercase text-slate-500">Write Disposition</label>
          <select name="writeDisposition" value={properties.writeDisposition || 'WRITE_APPEND'} onChange={handleChange} className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm">
            <option>WRITE_APPEND</option>
            <option>WRITE_TRUNCATE</option>
            <option>WRITE_EMPTY</option>
          </select>
        </div>
      </div>
    );
  } else if (label.includes('Windowing')) {
    formContent = (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold uppercase text-slate-500">Window Type</label>
          <select name="windowType" value={properties.windowType || 'Fixed Window'} onChange={handleChange} className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm">
            <option>Fixed Window</option>
            <option>Sliding Window</option>
            <option>Session Window</option>
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold uppercase text-slate-500">Duration</label>
          <input type="text" name="duration" value={properties.duration || '60'} onChange={handleChange} className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm" />
        </div>
      </div>
    );
  } else {
    formContent = <div className="text-sm text-slate-400">Generic properties for {label}</div>;
  }

  return (
    <>
      {formContent}
    </>
  );
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

const SidebarItem = ({ label, type, iconName, onDragStart }: { label: string, type: string, iconName: string, onDragStart: any }) => {
  const IconComponent = iconComponentMap[iconName];
  return (
    <div
      className="flex flex-col items-center justify-center p-2 bg-slate-700/50 rounded-lg cursor-pointer hover:bg-slate-600/50 transition-colors"
      draggable
      onDragStart={(e) => onDragStart(e, 'pipeline', label, type, iconName)}
    >
      {IconComponent && <IconComponent className="w-6 h-6 text-slate-300 mb-1" />}
      <span className="text-xs text-slate-300 mt-1">{label}</span>
    </div>
  );
};

function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [activeTab, setActiveTab] = useState('SOURCES');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  console.log('App rendering, isLoaded=', isLoaded, 'nodes=', nodes.length);
  const { project } = useReactFlow();

  const [history, setHistory] = useState<{ nodes: any[], edges: any[] }[]>([]);
  const [future, setFuture] = useState<{ nodes: any[], edges: any[] }[]>([]);

  const stateRef = useRef({ nodes, edges });
  useEffect(() => {
    stateRef.current = { nodes, edges };
  }, [nodes, edges]);

  const takeSnapshot = useCallback(() => {
    setHistory((prev) => [...prev, stateRef.current]);
    setFuture([]);
  }, []);

  const undo = useCallback(() => {
    if (history.length === 0) return;
    const previousState = history[history.length - 1];
    setFuture((prev) => [{ nodes, edges }, ...prev]);
    setNodes(previousState.nodes);
    setEdges(previousState.edges);
    setHistory((prev) => prev.slice(0, -1));
  }, [history, nodes, edges, setNodes, setEdges]);

  const redo = useCallback(() => {
    if (future.length === 0) return;
    const nextState = future[0];
    setHistory((prev) => [...prev, { nodes, edges }]);
    setNodes(nextState.nodes);
    setEdges(nextState.edges);
    setFuture((prev) => prev.slice(1));
  }, [future, nodes, edges, setNodes, setEdges]);

  useEffect(() => {
    if (!isLoaded) return;
    if (vscode) {
      const state = { nodes, edges };
      const yamlStr = YAML.stringify(state);
      vscode.postMessage({ command: 'savePipeline', data: yamlStr });
    }
  }, [nodes, edges, isLoaded]);

  useEffect(() => {
    if (vscode) {
      vscode.postMessage({ command: 'ready' });

      const handleMessage = (event: MessageEvent) => {
        const message = event.data;
        if (message.command === 'loadPipeline') {
          console.log('Received loadPipeline message, data length:', message.data ? message.data.length : 0);
          if (message.data) {
            try {
              const data = YAML.parse(message.data);
              console.log('Parsed YAML data:', data);
              setNodes(data.nodes || []);
              setEdges(data.edges || []);
            } catch (e) {
              console.error('Failed to parse YAML', e);
            }
          } else {
            console.log('No data received, setting empty pipeline');
            setNodes([]);
            setEdges([]);
          }
          setIsLoaded(true);
        }
      };
      window.addEventListener('message', handleMessage);
      return () => window.removeEventListener('message', handleMessage);
    }
  }, [setNodes, setEdges]);

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
      {/* Canvas */}
      <div className="flex-1 relative">
        {/* Floating Card on Left */}
        <div className="absolute top-4 left-4 z-10 w-64 bg-slate-800/90 p-4 flex flex-col gap-4 rounded-lg border border-slate-700 shadow-lg backdrop-blur-sm max-h-[calc(100%-2rem)] overflow-y-auto">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">Nodes</h2>
            <Search className="w-4 h-4 text-slate-400 cursor-pointer" />
          </div>
          
          {/* Tabs */}
          <div className="flex border-b border-slate-700">
            <button
              className={`flex-1 pb-2 text-xs font-semibold tracking-wider ${activeTab === 'SOURCES' ? 'text-white border-b-2 border-white' : 'text-slate-500'}`}
              onClick={() => setActiveTab('SOURCES')}
            >
              SOURCES
            </button>
            <button
              className={`flex-1 pb-2 text-xs font-semibold tracking-wider ${nodes.length === 0 ? 'text-slate-600 cursor-not-allowed' : activeTab === 'STEPS' ? 'text-white border-b-2 border-white' : 'text-slate-500'}`}
              onClick={() => nodes.length > 0 && setActiveTab('STEPS')}
              disabled={nodes.length === 0}
            >
              STEPS
            </button>
            <button
              className={`flex-1 pb-2 text-xs font-semibold tracking-wider ${nodes.length === 0 ? 'text-slate-600 cursor-not-allowed' : activeTab === 'SINKS' ? 'text-white border-b-2 border-white' : 'text-slate-500'}`}
              onClick={() => nodes.length > 0 && setActiveTab('SINKS')}
              disabled={nodes.length === 0}
            >
              SINKS
            </button>
          </div>

          {/* Tab Content */}
          <div className="grid grid-cols-3 gap-4 mt-2">
            {activeTab === 'SOURCES' && (
              <>
                <SidebarItem label="PubSub" type="SOURCE" iconName="Radio" onDragStart={onDragStart} />
                <SidebarItem label="BigQuery" type="SOURCE" iconName="Database" onDragStart={onDragStart} />
                <SidebarItem label="JDBC" type="SOURCE" iconName="Cable" onDragStart={onDragStart} />
                <SidebarItem label="Kafka" type="SOURCE" iconName="Share2" onDragStart={onDragStart} />
                <SidebarItem label="S3" type="SOURCE" iconName="HardDrive" onDragStart={onDragStart} />
                <SidebarItem label="GCS" type="SOURCE" iconName="Cloud" onDragStart={onDragStart} />
              </>
            )}
            {activeTab === 'STEPS' && (
              <>
                <SidebarItem label="Windows" type="STEP" iconName="Clock" onDragStart={onDragStart} />
                <SidebarItem label="Groups" type="STEP" iconName="Layers" onDragStart={onDragStart} />
                <SidebarItem label="Counts" type="STEP" iconName="BarChart" onDragStart={onDragStart} />
                <SidebarItem label="Batch" type="STEP" iconName="Box" onDragStart={onDragStart} />
                <SidebarItem label="Scripts" type="STEP" iconName="FileCode" onDragStart={onDragStart} />
              </>
            )}
            {activeTab === 'SINKS' && (
              <>
                <SidebarItem label="PubSub" type="SINK" iconName="Radio" onDragStart={onDragStart} />
                <SidebarItem label="BigQuery" type="SINK" iconName="Database" onDragStart={onDragStart} />
                <SidebarItem label="Kafka" type="SINK" iconName="Share2" onDragStart={onDragStart} />
                <SidebarItem label="JDBC" type="SINK" iconName="Cable" onDragStart={onDragStart} />
              </>
            )}
          </div>
        </div>

        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
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

      {/* Property Pane on Right */}
      {selectedNodeId && (
        <div className="w-80 bg-[#1A1D26] p-4 border-l border-slate-700 flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">Properties</h2>
            <Box className="w-4 h-4 text-slate-400" />
          </div>
          
          {(() => {
            const node = nodes.find(n => n.id === selectedNodeId);
            if (!node) return null;
            const IconComponent = iconComponentMap[node.data.iconName];
            return (
              <>
                <div className="flex items-center gap-3 bg-[#252836] p-3 rounded-lg">
                  <div className="bg-slate-700/50 p-2 rounded">
                    {IconComponent && <IconComponent className={`w-5 h-5 ${node.data.type === 'SOURCE' ? 'text-blue-400' : node.data.type === 'SINK' ? 'text-green-400' : 'text-orange-400'}`} />}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white">{node.data.label}</div>
                    <div className="text-xs text-slate-500">NODE ID: {node.id}</div>
                  </div>
                </div>
                <PropertyForm node={node} onChange={(props) => handleApplyProperties(node.id, props)} />
              </>
            );
          })()}
        </div>
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
