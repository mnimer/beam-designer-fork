import { useCallback, useState } from 'react';
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
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Search, Database, Cloud, HardDrive, Cable, Radio, Share2, Clock, Layers, BarChart, Box, FileCode } from 'lucide-react';

const PipelineNode = ({ data, selected }: { data: { label: string, type: string, icon: React.ReactNode }, selected?: boolean }) => {
  return (
    <div className={`bg-[#1E202A] border ${selected ? 'border-blue-500' : 'border-slate-700'} rounded-md shadow-xl p-3 flex items-center gap-3 min-w-[180px] text-left`}>
      <Handle type="target" position={Position.Left} className="w-2 h-2 bg-blue-500 border-none" />
      
      <div className="flex items-center gap-3 w-full">
        <div className="bg-slate-700/50 p-2 rounded">
          {data.icon}
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">{data.type}</span>
          <span className="text-sm font-medium text-slate-200">{data.label}</span>
        </div>
      </div>

      <Handle type="source" position={Position.Right} className="w-2 h-2 bg-blue-500 border-none" />
    </div>
  );
};

const nodeTypes = {
  pipeline: PipelineNode,
};

const renderPropertyForm = (node: any) => {
  if (!node) return null;

  const { label } = node.data;

  if (label.includes('PubSub')) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold uppercase text-slate-500">Topic</label>
          <input type="text" placeholder="projects/my-project/topics/my-topic" className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm" />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold uppercase text-slate-500">Subscription</label>
          <input type="text" placeholder="projects/my-project/subscriptions/my-sub" className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm" />
        </div>
      </div>
    );
  }

  if (label.includes('BigQuery')) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold uppercase text-slate-500">Table</label>
          <input type="text" placeholder="my-project:my_dataset.my_table" className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm" />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold uppercase text-slate-500">Create Disposition</label>
          <select className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm">
            <option>CREATE_IF_NEEDED</option>
            <option>CREATE_NEVER</option>
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold uppercase text-slate-500">Write Disposition</label>
          <select className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm">
            <option>WRITE_APPEND</option>
            <option>WRITE_TRUNCATE</option>
            <option>WRITE_EMPTY</option>
          </select>
        </div>
      </div>
    );
  }

  if (label.includes('Windowing')) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold uppercase text-slate-500">Window Type</label>
          <select className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm">
            <option>Fixed Window</option>
            <option>Sliding Window</option>
            <option>Session Window</option>
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold uppercase text-slate-500">Duration</label>
          <input type="text" defaultValue="60" className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm" />
        </div>
      </div>
    );
  }

  return <div className="text-sm text-slate-400">Generic properties for {label}</div>;
};

const initialNodes = [
  {
    id: '1',
    type: 'pipeline',
    position: { x: 100, y: 200 },
    data: { label: 'PubSub_In', type: 'SOURCE', icon: <Radio className="w-5 h-5 text-blue-400" /> }
  },
  {
    id: '2',
    type: 'pipeline',
    position: { x: 400, y: 200 },
    data: { label: 'Windowing', type: 'STEP', icon: <Clock className="w-5 h-5 text-orange-400" /> }
  },
  {
    id: '3',
    type: 'pipeline',
    position: { x: 700, y: 200 },
    data: { label: 'BigQuery_Out', type: 'SINK', icon: <Database className="w-5 h-5 text-green-400" /> }
  },
];

const initialEdges = [
  { id: 'e1-2', source: '1', target: '2' },
  { id: 'e2-3', source: '2', target: '3' },
];

function App() {
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [activeTab, setActiveTab] = useState('SOURCES');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const onConnect = useCallback(
    (params: Connection | Edge) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
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
              className={`flex-1 pb-2 text-xs font-semibold tracking-wider ${activeTab === 'STEPS' ? 'text-white border-b-2 border-white' : 'text-slate-500'}`}
              onClick={() => setActiveTab('STEPS')}
            >
              STEPS
            </button>
            <button
              className={`flex-1 pb-2 text-xs font-semibold tracking-wider ${activeTab === 'SINKS' ? 'text-white border-b-2 border-white' : 'text-slate-500'}`}
              onClick={() => setActiveTab('SINKS')}
            >
              SINKS
            </button>
          </div>

          {/* Tab Content */}
          <div className="grid grid-cols-3 gap-4 mt-2">
            {activeTab === 'SOURCES' && (
              <>
                <div className="flex flex-col items-center justify-center p-2 bg-slate-700/50 rounded-lg cursor-pointer hover:bg-slate-600/50 transition-colors">
                  <Radio className="w-6 h-6 text-slate-300 mb-1" />
                  <span className="text-xs text-slate-300 mt-1">PubSub</span>
                </div>
                <div className="flex flex-col items-center justify-center p-2 bg-slate-700/50 rounded-lg cursor-pointer hover:bg-slate-600/50 transition-colors">
                  <Database className="w-6 h-6 text-slate-300 mb-1" />
                  <span className="text-xs text-slate-300 mt-1">BigQuery</span>
                </div>
                <div className="flex flex-col items-center justify-center p-2 bg-slate-700/50 rounded-lg cursor-pointer hover:bg-slate-600/50 transition-colors">
                  <Cable className="w-6 h-6 text-slate-300 mb-1" />
                  <span className="text-xs text-slate-300 mt-1">JDBC</span>
                </div>
                <div className="flex flex-col items-center justify-center p-2 bg-slate-700/50 rounded-lg cursor-pointer hover:bg-slate-600/50 transition-colors">
                  <Share2 className="w-6 h-6 text-slate-300 mb-1" />
                  <span className="text-xs text-slate-300 mt-1">Kafka</span>
                </div>
                <div className="flex flex-col items-center justify-center p-2 bg-slate-700/50 rounded-lg cursor-pointer hover:bg-slate-600/50 transition-colors">
                  <HardDrive className="w-6 h-6 text-slate-300 mb-1" />
                  <span className="text-xs text-slate-300 mt-1">S3</span>
                </div>
                <div className="flex flex-col items-center justify-center p-2 bg-slate-700/50 rounded-lg cursor-pointer hover:bg-slate-600/50 transition-colors">
                  <Cloud className="w-6 h-6 text-slate-300 mb-1" />
                  <span className="text-xs text-slate-300 mt-1">GCS</span>
                </div>
              </>
            )}
            {activeTab === 'STEPS' && (
              <>
                <div className="flex flex-col items-center justify-center p-2 bg-slate-700/50 rounded-lg cursor-pointer hover:bg-slate-600/50 transition-colors">
                  <Clock className="w-6 h-6 text-slate-300 mb-1" />
                  <span className="text-xs text-slate-300 mt-1">Windows</span>
                </div>
                <div className="flex flex-col items-center justify-center p-2 bg-slate-700/50 rounded-lg cursor-pointer hover:bg-slate-600/50 transition-colors">
                  <Layers className="w-6 h-6 text-slate-300 mb-1" />
                  <span className="text-xs text-slate-300 mt-1">Groups</span>
                </div>
                <div className="flex flex-col items-center justify-center p-2 bg-slate-700/50 rounded-lg cursor-pointer hover:bg-slate-600/50 transition-colors">
                  <BarChart className="w-6 h-6 text-slate-300 mb-1" />
                  <span className="text-xs text-slate-300 mt-1">Counts</span>
                </div>
                <div className="flex flex-col items-center justify-center p-2 bg-slate-700/50 rounded-lg cursor-pointer hover:bg-slate-600/50 transition-colors">
                  <Box className="w-6 h-6 text-slate-300 mb-1" />
                  <span className="text-xs text-slate-300 mt-1">Batch</span>
                </div>
                <div className="flex flex-col items-center justify-center p-2 bg-slate-700/50 rounded-lg cursor-pointer hover:bg-slate-600/50 transition-colors">
                  <FileCode className="w-6 h-6 text-slate-300 mb-1" />
                  <span className="text-xs text-slate-300 mt-1">Scripts</span>
                </div>
              </>
            )}
            {activeTab === 'SINKS' && (
              <>
                <div className="flex flex-col items-center justify-center p-2 bg-slate-700/50 rounded-lg cursor-pointer hover:bg-slate-600/50 transition-colors">
                  <Radio className="w-6 h-6 text-slate-300 mb-1" />
                  <span className="text-xs text-slate-300 mt-1">PubSub</span>
                </div>
                <div className="flex flex-col items-center justify-center p-2 bg-slate-700/50 rounded-lg cursor-pointer hover:bg-slate-600/50 transition-colors">
                  <Database className="w-6 h-6 text-slate-300 mb-1" />
                  <span className="text-xs text-slate-300 mt-1">BigQuery</span>
                </div>
                <div className="flex flex-col items-center justify-center p-2 bg-slate-700/50 rounded-lg cursor-pointer hover:bg-slate-600/50 transition-colors">
                  <Share2 className="w-6 h-6 text-slate-300 mb-1" />
                  <span className="text-xs text-slate-300 mt-1">Kafka</span>
                </div>
                <div className="flex flex-col items-center justify-center p-2 bg-slate-700/50 rounded-lg cursor-pointer hover:bg-slate-600/50 transition-colors">
                  <Cable className="w-6 h-6 text-slate-300 mb-1" />
                  <span className="text-xs text-slate-300 mt-1">JDBC</span>
                </div>
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
        >
          <Controls />
          <MiniMap />
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
            return (
              <>
                <div className="flex items-center gap-3 bg-[#252836] p-3 rounded-lg">
                  <div className="bg-slate-700/50 p-2 rounded">
                    {node.data.icon}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white">{node.data.label}</div>
                    <div className="text-xs text-slate-500">NODE ID: {node.id}</div>
                  </div>
                </div>
                {renderPropertyForm(node)}
              </>
            );
          })()}

          <button className="mt-auto bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded text-sm transition-colors">
            Apply Changes
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
