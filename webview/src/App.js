"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = require("react");
const reactflow_1 = require("reactflow");
require("reactflow/dist/style.css");
const lucide_react_1 = require("lucide-react");
const initialNodes = [
    { id: '1', position: { x: 250, y: 5 }, data: { label: 'Source: PubSub' } },
    { id: '2', position: { x: 250, y: 100 }, data: { label: 'Step: Windowing' } },
    { id: '3', position: { x: 250, y: 200 }, data: { label: 'Sink: BigQuery' } },
];
const initialEdges = [
    { id: 'e1-2', source: '1', target: '2' },
    { id: 'e2-3', source: '2', target: '3' },
];
function App() {
    const [nodes, , onNodesChange] = (0, reactflow_1.useNodesState)(initialNodes);
    const [edges, setEdges, onEdgesChange] = (0, reactflow_1.useEdgesState)(initialEdges);
    const [activeTab, setActiveTab] = (0, react_1.useState)('SOURCES');
    const onConnect = (0, react_1.useCallback)((params) => setEdges((eds) => (0, reactflow_1.addEdge)(params, eds)), [setEdges]);
    return (<div className="flex h-screen w-screen text-slate-200 bg-slate-900">
      {/* Sidebar / Floating Card on Left */}
      <div className="w-64 bg-slate-800 p-4 flex flex-col gap-4 border-r border-slate-700 overflow-y-auto">
        <div className="flex justify-between items-center">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">Nodes</h2>
          <lucide_react_1.Search className="w-4 h-4 text-slate-400 cursor-pointer"/>
        </div>
        
        {/* Tabs */}
        <div className="flex border-b border-slate-700">
          <button className={`flex-1 pb-2 text-xs font-semibold tracking-wider ${activeTab === 'SOURCES' ? 'text-white border-b-2 border-white' : 'text-slate-500'}`} onClick={() => setActiveTab('SOURCES')}>
            SOURCES
          </button>
          <button className={`flex-1 pb-2 text-xs font-semibold tracking-wider ${activeTab === 'STEPS' ? 'text-white border-b-2 border-white' : 'text-slate-500'}`} onClick={() => setActiveTab('STEPS')}>
            STEPS
          </button>
          <button className={`flex-1 pb-2 text-xs font-semibold tracking-wider ${activeTab === 'SINKS' ? 'text-white border-b-2 border-white' : 'text-slate-500'}`} onClick={() => setActiveTab('SINKS')}>
            SINKS
          </button>
        </div>

        {/* Tab Content */}
        <div className="grid grid-cols-3 gap-4 mt-2">
          {activeTab === 'SOURCES' && (<>
              <div className="flex flex-col items-center justify-center p-2 bg-slate-700/50 rounded-lg cursor-pointer hover:bg-slate-600/50 transition-colors">
                <lucide_react_1.Radio className="w-6 h-6 text-slate-300 mb-1"/>
                <span className="text-xs text-slate-300 mt-1">PubSub</span>
              </div>
              <div className="flex flex-col items-center justify-center p-2 bg-slate-700/50 rounded-lg cursor-pointer hover:bg-slate-600/50 transition-colors">
                <lucide_react_1.Database className="w-6 h-6 text-slate-300 mb-1"/>
                <span className="text-xs text-slate-300 mt-1">BigQuery</span>
              </div>
              <div className="flex flex-col items-center justify-center p-2 bg-slate-700/50 rounded-lg cursor-pointer hover:bg-slate-600/50 transition-colors">
                <lucide_react_1.Cable className="w-6 h-6 text-slate-300 mb-1"/>
                <span className="text-xs text-slate-300 mt-1">JDBC</span>
              </div>
              <div className="flex flex-col items-center justify-center p-2 bg-slate-700/50 rounded-lg cursor-pointer hover:bg-slate-600/50 transition-colors">
                <lucide_react_1.Share2 className="w-6 h-6 text-slate-300 mb-1"/>
                <span className="text-xs text-slate-300 mt-1">Kafka</span>
              </div>
              <div className="flex flex-col items-center justify-center p-2 bg-slate-700/50 rounded-lg cursor-pointer hover:bg-slate-600/50 transition-colors">
                <lucide_react_1.HardDrive className="w-6 h-6 text-slate-300 mb-1"/>
                <span className="text-xs text-slate-300 mt-1">S3</span>
              </div>
              <div className="flex flex-col items-center justify-center p-2 bg-slate-700/50 rounded-lg cursor-pointer hover:bg-slate-600/50 transition-colors">
                <lucide_react_1.Cloud className="w-6 h-6 text-slate-300 mb-1"/>
                <span className="text-xs text-slate-300 mt-1">GCS</span>
              </div>
            </>)}
          {activeTab === 'STEPS' && (<>
              <div className="flex flex-col items-center justify-center p-2 bg-slate-700/50 rounded-lg cursor-pointer hover:bg-slate-600/50 transition-colors">
                <lucide_react_1.Clock className="w-6 h-6 text-slate-300 mb-1"/>
                <span className="text-xs text-slate-300 mt-1">Windows</span>
              </div>
              <div className="flex flex-col items-center justify-center p-2 bg-slate-700/50 rounded-lg cursor-pointer hover:bg-slate-600/50 transition-colors">
                <lucide_react_1.Layers className="w-6 h-6 text-slate-300 mb-1"/>
                <span className="text-xs text-slate-300 mt-1">Groups</span>
              </div>
              <div className="flex flex-col items-center justify-center p-2 bg-slate-700/50 rounded-lg cursor-pointer hover:bg-slate-600/50 transition-colors">
                <lucide_react_1.BarChart className="w-6 h-6 text-slate-300 mb-1"/>
                <span className="text-xs text-slate-300 mt-1">Counts</span>
              </div>
              <div className="flex flex-col items-center justify-center p-2 bg-slate-700/50 rounded-lg cursor-pointer hover:bg-slate-600/50 transition-colors">
                <lucide_react_1.Box className="w-6 h-6 text-slate-300 mb-1"/>
                <span className="text-xs text-slate-300 mt-1">Batch</span>
              </div>
              <div className="flex flex-col items-center justify-center p-2 bg-slate-700/50 rounded-lg cursor-pointer hover:bg-slate-600/50 transition-colors">
                <lucide_react_1.FileCode className="w-6 h-6 text-slate-300 mb-1"/>
                <span className="text-xs text-slate-300 mt-1">Scripts</span>
              </div>
            </>)}
          {activeTab === 'SINKS' && (<>
              <div className="flex flex-col items-center justify-center p-2 bg-slate-700/50 rounded-lg cursor-pointer hover:bg-slate-600/50 transition-colors">
                <lucide_react_1.Radio className="w-6 h-6 text-slate-300 mb-1"/>
                <span className="text-xs text-slate-300 mt-1">PubSub</span>
              </div>
              <div className="flex flex-col items-center justify-center p-2 bg-slate-700/50 rounded-lg cursor-pointer hover:bg-slate-600/50 transition-colors">
                <lucide_react_1.Database className="w-6 h-6 text-slate-300 mb-1"/>
                <span className="text-xs text-slate-300 mt-1">BigQuery</span>
              </div>
              <div className="flex flex-col items-center justify-center p-2 bg-slate-700/50 rounded-lg cursor-pointer hover:bg-slate-600/50 transition-colors">
                <lucide_react_1.Share2 className="w-6 h-6 text-slate-300 mb-1"/>
                <span className="text-xs text-slate-300 mt-1">Kafka</span>
              </div>
              <div className="flex flex-col items-center justify-center p-2 bg-slate-700/50 rounded-lg cursor-pointer hover:bg-slate-600/50 transition-colors">
                <lucide_react_1.Cable className="w-6 h-6 text-slate-300 mb-1"/>
                <span className="text-xs text-slate-300 mt-1">JDBC</span>
              </div>
            </>)}
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative">
        <reactflow_1.default nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect}>
          <reactflow_1.Controls />
          <reactflow_1.MiniMap />
          <reactflow_1.Background gap={12} size={1}/>
        </reactflow_1.default>
      </div>

      {/* Property Pane on Right */}
      <div className="w-64 bg-slate-800 p-4 border-l border-slate-700">
        <h2 className="text-lg font-bold">Properties</h2>
        <div className="text-sm text-slate-400 mt-2">Select a node to see properties.</div>
      </div>
    </div>);
}
exports.default = App;
//# sourceMappingURL=App.js.map