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
import { LayoutTemplate } from 'lucide-react';

import ReactFlow, {
  MiniMap,
  Controls,
  ControlButton,
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





export const findMainPipelineFile = (files: string[], language: 'Python' | 'Java', filename?: string): string | null => {
  if (!files || files.length === 0) return null;

  const baseName = filename ? filename.replace(/\.beam$/, '').toLowerCase() : '';
  const pascalBaseName = baseName ? baseName.charAt(0).toUpperCase() + baseName.slice(1) : '';

  // Filter code files by language preference, but fall back to the other language if preferred language has no files
  let codeFiles = files.filter(f => {
    const lower = f.toLowerCase();
    if (language === 'Java') {
      return lower.endsWith('.java') && !lower.includes('test');
    } else {
      return lower.endsWith('.py') && !lower.includes('test') && !lower.endsWith('__init__.py');
    }
  });

  // If preferred language returned no code files, check if the other language has code files in the directory
  if (codeFiles.length === 0) {
    codeFiles = files.filter(f => {
      const lower = f.toLowerCase();
      return (lower.endsWith('.java') || lower.endsWith('.py')) && !lower.includes('test') && !lower.endsWith('__init__.py');
    });
  }

  if (codeFiles.length === 0) {
    // If still no code files found, try any .java or .py file
    codeFiles = files.filter(f => f.endsWith('.java') || f.endsWith('.py'));
  }

  if (codeFiles.length === 0) {
    // No code files exist in folder at all
    return files[0];
  }

  // Find best match among codeFiles matching baseName or pascalBaseName or pipeline
  const match = codeFiles.find(f => {
    const lower = f.toLowerCase();
    return (baseName && lower.includes(baseName)) || 
           (pascalBaseName && lower.includes(pascalBaseName.toLowerCase())) ||
           lower.includes('pipeline.java') ||
           lower.includes('pipeline.py');
  });

  return match || codeFiles[0];
};

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
    network: '',
    subnetwork: ''
  });
  const [projectId, setProjectId] = useState('YOUR_PROJECT_ID');
  const [subnetworks, setSubnetworks] = useState<{name: string, region: string, network: string, value: string}[]>([]);
  const [filename, setFilename] = useState('default_job');

  // Running Jobs state
  const [runningJobs, setRunningJobs] = useState<any[]>([]);
  const [isLoadingJobs, setIsLoadingJobs] = useState<boolean>(false);
  const [jobsError, setJobsError] = useState<string | null>(null);
  const [dataflowRegion, setDataflowRegion] = useState<string>('us-central1');
  
  // Custom pipeline config state
  const [pipelineConfig, setPipelineConfig] = useState<{ language: 'Python' | 'Java', outputFolder: string, needsRebuild: boolean }>({
    language: 'Python',
    outputFolder: '',
    needsRebuild: false
  });
  const [folderFiles, setFolderFiles] = useState<string[]>([]);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [selectedFileContent, setSelectedFileContent] = useState<string | null>(null);

  const pipelineConfigRef = useRef(pipelineConfig);
  const filenameRef = useRef(filename);
  const projectIdRef = useRef(projectId);
  useEffect(() => {
    projectIdRef.current = projectId;
  }, [projectId]);
  useEffect(() => {
    pipelineConfigRef.current = pipelineConfig;
  }, [pipelineConfig]);
  useEffect(() => {
    filenameRef.current = filename;
  }, [filename]);

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
    console.log('[@App.tsx] Save effect scheduled');
    const timer = setTimeout(() => {
      if (vscode) {
        const state = { 
          nodes, 
          edges, 
          runtimeVariables, 
          jobConfig,
          pipelineConfig
        };
        const yamlStr = YAML.stringify(state);
        console.log('[@App.tsx] YAML generated & saved');
        
        // Only save YAML configuration
        vscode.postMessage({ 
          command: 'savePipeline', 
          data: yamlStr
        });
        console.log('[@App.tsx] Sent savePipeline message (YAML config only)');
      }
    }, 1000); // 1-second debounce

    return () => clearTimeout(timer);
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
              setJobConfig(data.jobConfig || { runner: 'DirectRunner', machineType: 'n1-standard-1', minInstances: 1, maxInstances: 10, gcsStagingPath: '', network: '', subnetwork: '' });
              
              const config = data.pipelineConfig || { language: 'Python', outputFolder: '', needsRebuild: false };
              const nameWithoutExt = message.filename 
                ? message.filename.replace('.beam', '') 
                : '';
              if (nameWithoutExt) {
                let folder = config.outputFolder ? config.outputFolder.trim() : '';
                if (!folder && message.defaultOutputFolder) {
                  folder = message.defaultOutputFolder;
                }
                const normFolder = folder.replace(/\/$/, '');
                if (!normFolder.endsWith(nameWithoutExt)) {
                  config.outputFolder = normFolder ? `${normFolder}/${nameWithoutExt}` : nameWithoutExt;
                  config.needsRebuild = true;
                } else {
                  config.outputFolder = folder;
                }
              }
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
            setJobConfig({ runner: 'DirectRunner', machineType: 'n1-standard-1', minInstances: 1, maxInstances: 10, gcsStagingPath: '', network: '', subnetwork: '' });
            setPipelineConfig({ language: 'Python', outputFolder: message.defaultOutputFolder || '', needsRebuild: false });
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
            setSelectedFileName(null);
            setSelectedFileContent(null);
            refreshFolderFiles();
          }
        } else if (message.command === 'runningJobsLoaded') {
          if (jobsTimeoutRef.current) {
            clearTimeout(jobsTimeoutRef.current);
            jobsTimeoutRef.current = null;
          }
          setIsLoadingJobs(false);
          setRunningJobs(message.jobs || []);
          setJobsError(message.error || null);
        } else if (message.command === 'subnetworksLoaded') {
          setSubnetworks(message.subnetworks);
        } else if (message.command === 'folderFilesRead' || message.command === 'folderFilesLoaded') {
          const loadedFiles: string[] = message.files || [];
          setFolderFiles(loadedFiles);
          if (loadedFiles.length > 0) {
            const currentLang = pipelineConfigRef.current.language;
            const currentName = filenameRef.current;
            const currentFolder = pipelineConfigRef.current.outputFolder;
            const mainFile = findMainPipelineFile(loadedFiles, currentLang, currentName);
            if (mainFile) {
              setSelectedFileName(mainFile);
              if (vscode) {
                vscode.postMessage({ 
                  command: 'readFileContent', 
                  filePath: mainFile,
                  folderPath: currentFolder
                });
              }
            }
          }
        } else if (message.command === 'fileContentLoaded') {
          setSelectedFileContent(message.content);
        } else if (message.command === 'folderSelected') {
          setPipelineConfig(prev => ({
            ...prev,
            outputFolder: message.path,
            needsRebuild: true
          }));
        } else if (message.command === 'updateOutputFolder') {
          setPipelineConfig(prev => {
            const prevFolder = prev.outputFolder;
            const newFolder = message.outputFolder;
            if (prevFolder !== newFolder) {
              const needsRebuild = (prevFolder !== '' && prevFolder !== newFolder) ? true : prev.needsRebuild;
              return {
                ...prev,
                outputFolder: newFolder,
                needsRebuild
              };
            }
            return prev;
          });
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
    setJobConfig(prev => {
      const configChanged = 
        prev.machineType !== config.machineType ||
        prev.minInstances !== config.minInstances ||
        prev.maxInstances !== config.maxInstances ||
        prev.gcsStagingPath !== config.gcsStagingPath ||
        prev.network !== config.network ||
        prev.subnetwork !== config.subnetwork;

      if (configChanged) {
        setPipelineConfig(p => p.needsRebuild ? p : { ...p, needsRebuild: true });
      }
      return config;
    });
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

  const onLayout = useCallback(() => {
    // 1. Build adjacency lists
    const adj: Record<string, string[]> = {};
    const inDegree: Record<string, number> = {};
    
    nodes.forEach(n => {
      adj[n.id] = [];
      inDegree[n.id] = 0;
    });
    
    edges.forEach(e => {
      if (adj[e.source] && adj[e.target] !== undefined) {
        adj[e.source].push(e.target);
        inDegree[e.target]++;
      }
    });

    // 2. Queue for Kahn's topological sort to compute columns (ranks)
    const ranks: Record<string, number> = {};
    const queue: string[] = [];
    
    // Find all root nodes (in-degree = 0)
    nodes.forEach(n => {
      if (inDegree[n.id] === 0) {
        queue.push(n.id);
        ranks[n.id] = 0;
      }
    });
    
    while (queue.length > 0) {
      const curr = queue.shift()!;
      const currRank = ranks[curr];
      
      adj[curr].forEach(neighbor => {
        ranks[neighbor] = Math.max(ranks[neighbor] || 0, currRank + 1);
        inDegree[neighbor]--;
        if (inDegree[neighbor] === 0) {
          queue.push(neighbor);
        }
      });
    }

    // If there are leftover nodes due to cycles, assign fallback ranks
    nodes.forEach(n => {
      if (ranks[n.id] === undefined) {
        if (n.data.type === 'SOURCE') ranks[n.id] = 0;
        else if (n.data.type === 'SINK') ranks[n.id] = 2;
        else ranks[n.id] = 1;
      }
    });

    // 3. Group nodes by their calculated column rank
    const columns: Record<number, string[]> = {};
    nodes.forEach(n => {
      const r = ranks[n.id];
      if (!columns[r]) columns[r] = [];
      columns[r].push(n.id);
    });

    // 4. Calculate new positions
    const newNodes = nodes.map(node => {
      const rank = ranks[node.id];
      const colNodes = columns[rank];
      const index = colNodes.indexOf(node.id);
      
      // Spacing constants
      const colWidth = 300;
      const rowHeight = 120;
      const startX = 80;
      const startY = 150;
      
      const x = startX + rank * colWidth;
      // Center the column vertically
      const totalHeight = (colNodes.length - 1) * rowHeight;
      const y = startY + index * rowHeight - totalHeight / 2;
      
      return {
        ...node,
        position: { x, y }
      };
    });

    takeSnapshot();
    setNodes(newNodes);
    
    // Auto fit view after positioning
    setTimeout(() => {
      fitView({ duration: 300, padding: 1 });
    }, 100);
  }, [nodes, edges, setNodes, fitView, takeSnapshot]);

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
          const { special_instructions, ...restProperties } = properties;
          const updatedData: any = {
            ...node.data,
            properties: restProperties,
          };
          if (special_instructions !== undefined) {
            updatedData.special_instructions = special_instructions;
          }
          return {
            ...node,
            data: updatedData,
          };
        }
        return node;
      })
    );
    setPipelineConfig(prev => ({ ...prev, needsRebuild: true }));
  }, [setNodes]);

  const handleAddKVMapper = useCallback((windowNodeId: string) => {
    const windowNode = nodes.find(n => n.id === windowNodeId);
    if (!windowNode) return;

    const kvMapperId = `kv_mapper_${Date.now()}`;
    const newKVMapperNode = {
      id: kvMapperId,
      type: 'pipeline',
      position: {
        x: windowNode.position.x - 250,
        y: windowNode.position.y
      },
      data: {
        label: 'KV Mapper',
        type: 'STEP',
        iconName: 'Hash',
        properties: {
          keyPropertyName: 'id'
        }
      }
    };

    takeSnapshot();

    // Find if there's an incoming edge to the window node
    const incomingEdgeIndex = edges.findIndex(e => e.target === windowNodeId);
    
    let updatedEdges = [...edges];
    if (incomingEdgeIndex !== -1) {
      // Redirect the incoming edge to target the new KV Mapper instead
      const oldEdge = edges[incomingEdgeIndex];
      const redirectedEdge = {
        ...oldEdge,
        target: kvMapperId,
        targetHandle: undefined
      };
      updatedEdges[incomingEdgeIndex] = redirectedEdge;
    }

    // Add the new edge connecting KV Mapper valid output to Window input
    const connectorEdge = {
      id: `e-${kvMapperId}-${windowNodeId}`,
      source: kvMapperId,
      sourceHandle: 'valid',
      target: windowNodeId
    };
    updatedEdges.push(connectorEdge);

    // Update both nodes and edges states
    setNodes(nds => nds.concat(newKVMapperNode));
    setEdges(updatedEdges);
    setPipelineConfig(prev => ({ ...prev, needsRebuild: true }));
  }, [nodes, edges, setNodes, setEdges, takeSnapshot]);

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
        if (data.label === 'Parse Message') {
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
  const jobsTimeoutRef = useRef<any>(null);

  const refreshRunningJobs = useCallback((regionToUse?: string) => {
    const reg = regionToUse || dataflowRegion || 'us-central1';
    console.log('[@App.tsx] refreshRunningJobs called, projectId=', projectIdRef.current, 'region=', reg);
    setIsLoadingJobs(true);
    setJobsError(null);

    if (jobsTimeoutRef.current) {
      clearTimeout(jobsTimeoutRef.current);
    }

    jobsTimeoutRef.current = setTimeout(() => {
      setIsLoadingJobs(false);
      setJobsError('Timed out waiting for Dataflow jobs from gcloud CLI. Please verify gcloud CLI login or region settings.');
    }, 16000);

    if (vscode) {
      vscode.postMessage({ 
        command: 'getRunningJobs', 
        projectId: projectIdRef.current || projectId,
        region: reg
      });
    } else {
      if (jobsTimeoutRef.current) {
        clearTimeout(jobsTimeoutRef.current);
        jobsTimeoutRef.current = null;
      }
      setIsLoadingJobs(false);
    }
  }, [projectId, dataflowRegion]);

  useEffect(() => {
    if (bottomTab === 'RUNNING_JOBS' && isLoaded) {
      refreshRunningJobs();
    }
  }, [bottomTab, isLoaded, refreshRunningJobs]);

  const handleOpenJob = useCallback((job: any) => {
    const loc = job.location || 'us-central1';
    const proj = projectIdRef.current || projectId || '';
    const url = `https://console.cloud.google.com/dataflow/jobs/${loc}/${job.id}${proj ? `?project=${proj}` : ''}`;
    if (vscode) {
      vscode.postMessage({ command: 'openExternal', url });
    } else {
      window.open(url, '_blank');
    }
  }, [projectId]);

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
            <Controls>
              <ControlButton onClick={onLayout} title="Auto Layout Diagram">
                <LayoutTemplate style={{ width: '14px', height: '14px' }} />
              </ControlButton>
            </Controls>
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
          runningJobs={runningJobs}
          isLoadingJobs={isLoadingJobs}
          jobsError={jobsError}
          onRefreshRunningJobs={refreshRunningJobs}
          onOpenJob={handleOpenJob}
          projectId={projectId}
          dataflowRegion={dataflowRegion}
          onRegionChange={(reg) => setDataflowRegion(reg)}
        />
      </div>

      {/* Property Pane on Right */}
      {selectedNodeId && nodes.find(n => n.id === selectedNodeId) && (
        <PropertyPane 
          node={nodes.find(n => n.id === selectedNodeId)!} 
          onChange={(props) => handleApplyProperties(selectedNodeId, props)} 
          runtimeVariables={runtimeVariables} 
          onAddKVMapper={handleAddKVMapper}
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
