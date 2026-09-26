/**
 * Hook for Apache Beam pipeline graph state and mutation helpers
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Handles React Flow node and edge state management, drag-and-drop ingestion,
 * connection validation, topological auto-layout, edge redirection (M16),
 * property application, and node deletion.
 */

import { useCallback, useMemo, useState } from 'react';
import {
  useNodesState,
  useEdgesState,
  addEdge,
  type Node,
  type Edge,
  type Connection,
} from 'reactflow';
import { validateDagTopology, type DagValidationResult } from '../utils/dagValidator';

export interface PipelineNodeData {
  label: string;
  type: string;
  iconName: string;
  beam_transform?: string;
  system_instructions?: string;
  properties?: Record<string, any>;
  hasCycle?: boolean;
  hasValidationError?: boolean;
  isOrphan?: boolean;
  validationError?: string;
  validationWarning?: string;
}

export type PipelineNode = Node<PipelineNodeData>;

// NOTE: Initial nodes and edges start empty so opening any .beam file
// does not flash placeholder or mock nodes before loadPipeline message arrives.
export const initialNodes: PipelineNode[] = [];
export const initialEdges: Edge[] = [];

export interface UsePipelineGraphOptions {
  takeSnapshot: () => void;
  setPipelineConfig: React.Dispatch<React.SetStateAction<any>>;
  project?: (position: { x: number; y: number }) => { x: number; y: number };
  fitView?: (options?: any) => void;
}

export function usePipelineGraph({
  takeSnapshot,
  setPipelineConfig,
  project,
  fitView,
}: UsePipelineGraphOptions) {
  const [nodes, setNodes, onNodesChange] = useNodesState<PipelineNodeData>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  const hasPubSubSource = nodes.some(
    (n) => n.data?.type === 'SOURCE' && n.data?.label?.includes('PubSub')
  );

  // Wrap state changes to set needsRebuild: true when structural nodes change
  const handleNodesChange = useCallback(
    (changes: any) => {
      onNodesChange(changes);
      const requiresRebuild = changes.some((c: any) => c.type === 'add' || c.type === 'remove');
      if (requiresRebuild) {
        setPipelineConfig((prev: any) => (prev.needsRebuild ? prev : { ...prev, needsRebuild: true }));
      }
    },
    [onNodesChange, setPipelineConfig]
  );

  // Wrap edge changes to set needsRebuild: true when edges are removed
  const handleEdgesChange = useCallback(
    (changes: any) => {
      onEdgesChange(changes);
      const requiresRebuild = changes.some((c: any) => c.type === 'remove');
      if (requiresRebuild) {
        setPipelineConfig((prev: any) => (prev.needsRebuild ? prev : { ...prev, needsRebuild: true }));
      }
    },
    [onEdgesChange, setPipelineConfig]
  );

  // Disallow direct connection from SOURCE to SINK without intervening transform steps
  const isValidConnection = useCallback(
    (connection: Connection) => {
      const sourceNode = nodes.find((n) => n.id === connection.source);
      const targetNode = nodes.find((n) => n.id === connection.target);

      if (sourceNode?.data?.type === 'SOURCE' && targetNode?.data?.type === 'SINK') {
        return false;
      }

      return true;
    },
    [nodes]
  );

  // Connects two nodes with an edge and flags pipeline for rebuild
  const onConnect = useCallback(
    (params: Connection | Edge) => {
      takeSnapshot();
      setEdges((eds) => addEdge(params, eds));
      setPipelineConfig((prev: any) => ({ ...prev, needsRebuild: true }));
    },
    [setEdges, takeSnapshot, setPipelineConfig]
  );

  // Updates properties and special instructions for a specific node
  const handleApplyProperties = useCallback(
    (nodeId: string, properties: any) => {
      console.log('[@usePipelineGraph] handleApplyProperties called', nodeId, properties);
      takeSnapshot();
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === nodeId) {
            const { system_instructions, special_instructions, ...restProperties } = properties;
            const updatedData: any = {
              ...node.data,
              properties: restProperties,
            };
            const instructionsValue =
              system_instructions !== undefined ? system_instructions : special_instructions;
            if (instructionsValue !== undefined) {
              updatedData.system_instructions = instructionsValue;
            }
            return {
              ...node,
              data: updatedData,
            };
          }
          return node;
        })
      );
      setPipelineConfig((prev: any) => ({ ...prev, needsRebuild: true }));
    },
    [setNodes, takeSnapshot, setPipelineConfig]
  );

  // Updates the label/name of a specific node
  const handleNodeLabelChange = useCallback(
    (nodeId: string, newLabel: string) => {
      takeSnapshot();
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === nodeId) {
            return {
              ...node,
              data: {
                ...node.data,
                label: newLabel,
              },
            };
          }
          return node;
        })
      );
      setPipelineConfig((prev: any) => ({ ...prev, needsRebuild: true }));
    },
    [setNodes, takeSnapshot, setPipelineConfig]
  );

  /**
   * Inserts a KV Mapper step before a Window node.
   * NOTE: Rewires ALL incoming edges that targeted the Window node to target the new KV Mapper,
   * preserving edge attributes and unique IDs. Connects the new KV Mapper to the Window node.
   */
  const handleAddKVMapper = useCallback(
    (windowNodeId: string) => {
      const windowNode = nodes.find((n) => n.id === windowNodeId);
      if (!windowNode) return;

      const kvMapperId = `kv_mapper_${Date.now()}`;
      const newKVMapperNode: PipelineNode = {
        id: kvMapperId,
        type: 'pipeline',
        position: {
          x: windowNode.position.x - 250,
          y: windowNode.position.y,
        },
        data: {
          label: 'KV Mapper',
          type: 'STEP',
          iconName: 'Hash',
          beam_transform: 'KVMapper',
          properties: {
            keyPropertyName: 'id',
          },
        },
      };

      takeSnapshot();

      // Redirect ALL incoming edges to target the new KV Mapper instead.
      // NOTE: We map over all edges targeting windowNodeId rather than using findIndex,
      // ensuring multiple inbound edges are all rewired to the new KV Mapper.
      // Edge IDs and other edge properties are preserved to prevent DAG corruption.
      const updatedEdges = edges.map((edge) => {
        if (edge.target === windowNodeId) {
          return {
            ...edge,
            target: kvMapperId,
            targetHandle: undefined,
          };
        }
        return edge;
      });

      // Add the new edge connecting KV Mapper valid output to Window input
      const connectorEdge = {
        id: `e-${kvMapperId}-${windowNodeId}`,
        source: kvMapperId,
        sourceHandle: 'valid',
        target: windowNodeId,
      };
      updatedEdges.push(connectorEdge);

      // Update both nodes and edges states
      setNodes((nds) => nds.concat(newKVMapperNode));
      setEdges(updatedEdges);
      setPipelineConfig((prev: any) => ({ ...prev, needsRebuild: true }));
    },
    [nodes, edges, setNodes, setEdges, takeSnapshot, setPipelineConfig]
  );

  /**
   * Inserts a PubSubIO Source node in front of a target node (e.g. FhirIO with readResources()).
   */
  const handleAddPubSubSource = useCallback(
    (targetNodeId: string) => {
      const targetNode = nodes.find((n) => n.id === targetNodeId);
      if (!targetNode) return;

      // Avoid adding a duplicate upstream PubSubIO if one is already connected
      const alreadyConnected = edges.some((e) => {
        if (e.target !== targetNodeId) return false;
        const src = nodes.find((n) => n.id === e.source);
        return src?.data?.beam_transform === 'PubSubIO' || src?.data?.label?.includes('PubSub');
      });
      if (alreadyConnected) return;

      const pubSubId = `pubsub_${Date.now()}`;
      const newPubSubNode: PipelineNode = {
        id: pubSubId,
        type: 'pipeline',
        position: {
          x: targetNode.position.x - 250,
          y: targetNode.position.y,
        },
        data: {
          label: 'PubSub',
          type: 'SOURCE',
          iconName: 'Radio',
          beam_transform: 'PubSubIO',
          properties: {
            readMode: 'subscription',
          },
        },
      };

      const connectorEdge: Edge = {
        id: `e-${pubSubId}-${targetNodeId}`,
        source: pubSubId,
        target: targetNodeId,
      };

      takeSnapshot();
      setNodes((nds) => nds.concat(newPubSubNode));
      setEdges((eds) => eds.concat(connectorEdge));
      setPipelineConfig((prev: any) => ({ ...prev, needsRebuild: true }));
    },
    [nodes, edges, setNodes, setEdges, takeSnapshot, setPipelineConfig]
  );

  // Computes topological columns using Kahn's algorithm and positions nodes left-to-right
  const onLayout = useCallback(() => {
    // 1. Build adjacency lists
    const adj: Record<string, string[]> = {};
    const inDegree: Record<string, number> = {};

    nodes.forEach((n) => {
      adj[n.id] = [];
      inDegree[n.id] = 0;
    });

    edges.forEach((e) => {
      if (adj[e.source] && adj[e.target] !== undefined) {
        adj[e.source].push(e.target);
        inDegree[e.target]++;
      }
    });

    // 2. Queue for Kahn's topological sort to compute columns (ranks)
    const ranks: Record<string, number> = {};
    const queue: string[] = [];

    // Find all root nodes (in-degree = 0)
    nodes.forEach((n) => {
      if (inDegree[n.id] === 0) {
        queue.push(n.id);
        ranks[n.id] = 0;
      }
    });

    while (queue.length > 0) {
      const curr = queue.shift()!;
      const currRank = ranks[curr];

      adj[curr].forEach((neighbor) => {
        ranks[neighbor] = Math.max(ranks[neighbor] || 0, currRank + 1);
        inDegree[neighbor]--;
        if (inDegree[neighbor] === 0) {
          queue.push(neighbor);
        }
      });
    }

    // If there are leftover nodes due to cycles, assign fallback ranks
    nodes.forEach((n) => {
      if (ranks[n.id] === undefined) {
        if (n.data?.type === 'SOURCE') ranks[n.id] = 0;
        else if (n.data?.type === 'SINK') ranks[n.id] = 2;
        else ranks[n.id] = 1;
      }
    });

    // 3. Group nodes by their calculated column rank
    const columns: Record<number, string[]> = {};
    nodes.forEach((n) => {
      const r = ranks[n.id];
      if (!columns[r]) columns[r] = [];
      columns[r].push(n.id);
    });

    // 4. Calculate new positions
    const newNodes = nodes.map((node) => {
      const rank = ranks[node.id];
      const colNodes = columns[rank];
      const index = colNodes.indexOf(node.id);

      // Spacing constants adhering to 8pt design
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
        position: { x, y },
      };
    });

    takeSnapshot();
    setNodes(newNodes);

    // Auto fit view after positioning
    if (fitView) {
      setTimeout(() => {
        fitView({ duration: 300, padding: 1 });
      }, 100);
    }
  }, [nodes, edges, setNodes, fitView, takeSnapshot]);

  const onDragStart = useCallback(
    (event: React.DragEvent, nodeType: string, label: string, type: string, iconName: string, beamTransform?: string) => {
      event.dataTransfer.setData(
        'application/reactflow',
        JSON.stringify({ nodeType, label, type, iconName, beamTransform })
      );
      event.dataTransfer.effectAllowed = 'move';
    },
    []
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  /**
   * Handles the drop event when a node is dragged from the sidebar onto the canvas.
   * It creates a new node at the drop position and automatically connects it to a source
   * if it's the first step or if it's a PubSub specific step.
   */
  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const reactFlowBounds = document.querySelector('.react-flow')?.getBoundingClientRect();
      const dataStr = event.dataTransfer.getData('application/reactflow');

      if (!dataStr || !reactFlowBounds) {
        return;
      }

      const data = JSON.parse(dataStr);

      const rawPos = {
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      };
      const position = project ? project(rawPos) : rawPos;

      // Special handling for FileIO Source: Spawns both FileIO.match() and FileIO.readMatches() connected by an edge
      if (data.type === 'SOURCE' && (data.label === 'FileIO' || data.beamTransform === 'FileIO')) {
        const now = Date.now();
        const matchNode: PipelineNode = {
          id: `${now}`,
          type: data.nodeType,
          position,
          data: {
            label: 'FileIO Match',
            type: 'SOURCE',
            iconName: 'Folder',
            beam_transform: 'FileIO.match',
          },
        };

        const readMatchesNode: PipelineNode = {
          id: `${now + 1}`,
          type: data.nodeType,
          position: {
            x: position.x + 240,
            y: position.y,
          },
          data: {
            label: 'FileIO Read Matches',
            type: 'STEP',
            iconName: 'FileCode',
            beam_transform: 'FileIO.readMatches',
          },
        };

        const edge: Edge = {
          id: `e-${matchNode.id}-${readMatchesNode.id}`,
          source: matchNode.id,
          target: readMatchesNode.id,
        };

        takeSnapshot();
        setNodes((nds) => nds.concat([matchNode, readMatchesNode]));
        setEdges((eds) => eds.concat(edge));
        setPipelineConfig((prev: any) => ({ ...prev, needsRebuild: true }));
        return;
      }

      const newNode: PipelineNode = {
        id: `${Date.now()}`,
        type: data.nodeType,
        position,
        data: {
          label: data.label,
          type: data.type,
          iconName: data.iconName,
          ...(data.beamTransform ? { beam_transform: data.beamTransform } : {}),
        },
      };

      takeSnapshot();
      setNodes((nds) => nds.concat(newNode));
      setPipelineConfig((prev: any) => ({ ...prev, needsRebuild: true }));

      if (data.type === 'STEP') {
        if (data.label === 'Parse Message') {
          const pubSubSource = nodes.find(
            (n) => n.data?.type === 'SOURCE' && n.data?.label?.includes('PubSub')
          );
          if (pubSubSource) {
            const newEdge: Edge = {
              id: `e-${pubSubSource.id}-${newNode.id}`,
              source: pubSubSource.id,
              target: newNode.id,
            };
            setEdges((eds) => eds.concat(newEdge));
          }
        } else {
          const hasStep = nodes.some((n) => n.data?.type === 'STEP');
          if (!hasStep) {
            const sourceNode = nodes.find((n) => n.data?.type === 'SOURCE');
            if (sourceNode) {
              const newEdge: Edge = {
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
    [project, setNodes, setEdges, nodes, takeSnapshot, setPipelineConfig]
  );

  /**
   * Directly adds a node to the React Flow canvas when '+' is clicked on a SidebarItem.
   */
  const handleAddNode = useCallback(
    (label: string, type: string, iconName: string, beamTransform?: string) => {
      const nodeCount = nodes.length;
      const position = {
        x: 100 + (nodeCount % 6) * 60,
        y: 100 + (nodeCount % 6) * 60,
      };

      if (type === 'SOURCE' && (label === 'FileIO' || beamTransform === 'FileIO')) {
        const now = Date.now();
        const matchNode: PipelineNode = {
          id: `${now}`,
          type: 'pipeline',
          position,
          data: {
            label: 'FileIO Match',
            type: 'SOURCE',
            iconName: 'Folder',
            beam_transform: 'FileIO.match',
          },
        };

        const readMatchesNode: PipelineNode = {
          id: `${now + 1}`,
          type: 'pipeline',
          position: {
            x: position.x + 240,
            y: position.y,
          },
          data: {
            label: 'FileIO Read Matches',
            type: 'STEP',
            iconName: 'FileCode',
            beam_transform: 'FileIO.readMatches',
          },
        };

        const edge: Edge = {
          id: `e-${matchNode.id}-${readMatchesNode.id}`,
          source: matchNode.id,
          target: readMatchesNode.id,
        };

        takeSnapshot();
        setNodes((nds) => nds.concat([matchNode, readMatchesNode]));
        setEdges((eds) => eds.concat(edge));
        setPipelineConfig((prev: any) => ({ ...prev, needsRebuild: true }));
        return;
      }

      const newNode: PipelineNode = {
        id: `${Date.now()}`,
        type: 'pipeline',
        position,
        data: {
          label,
          type,
          iconName,
          ...(beamTransform ? { beam_transform: beamTransform } : {}),
        },
      };

      takeSnapshot();
      setNodes((nds) => nds.concat(newNode));
      setPipelineConfig((prev: any) => ({ ...prev, needsRebuild: true }));

      if (type === 'STEP') {
        if (label === 'Parse Message') {
          const pubSubSource = nodes.find(
            (n) => n.data?.type === 'SOURCE' && n.data?.label?.includes('PubSub')
          );
          if (pubSubSource) {
            const newEdge: Edge = {
              id: `e-${pubSubSource.id}-${newNode.id}`,
              source: pubSubSource.id,
              target: newNode.id,
            };
            setEdges((eds) => eds.concat(newEdge));
          }
        } else {
          const hasStep = nodes.some((n) => n.data?.type === 'STEP');
          if (!hasStep) {
            const sourceNode = nodes.find((n) => n.data?.type === 'SOURCE');
            if (sourceNode) {
              const newEdge: Edge = {
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
    [nodes, setNodes, setEdges, takeSnapshot, setPipelineConfig]
  );

  // Deletes currently selected node or edge and records undo snapshot
  const deleteSelected = useCallback(() => {
    if (selectedNodeId) {
      takeSnapshot();
      setNodes((nds) => nds.filter((node) => node.id !== selectedNodeId));
      setEdges((eds) => eds.filter((edge) => edge.source !== selectedNodeId && edge.target !== selectedNodeId));
      setSelectedNodeId(null);
      setPipelineConfig((prev: any) => ({ ...prev, needsRebuild: true }));
    } else if (selectedEdgeId) {
      takeSnapshot();
      setEdges((eds) => eds.filter((edge) => edge.id !== selectedEdgeId));
      setSelectedEdgeId(null);
      setPipelineConfig((prev: any) => ({ ...prev, needsRebuild: true }));
    }
  }, [selectedNodeId, selectedEdgeId, setNodes, setEdges, takeSnapshot, setPipelineConfig]);

  // Dynamically compute DAG topology validation using Kahn's algorithm
  const dagValidation = useMemo<DagValidationResult>(
    () => validateDagTopology(nodes as any, edges as any),
    [nodes, edges]
  );

  // Decorate nodes with topological error/warning flags for React Flow canvas rendering
  const displayNodes = useMemo(() => {
    const cycleSet = new Set(dagValidation.cycleNodeIds);
    const orphanSet = new Set(dagValidation.orphanNodeIds);
    const missingUpstreamSet = new Set(dagValidation.missingUpstreamNodeIds || []);
    const invalidUpstreamSet = new Set(dagValidation.invalidUpstreamNodeIds || []);

    return nodes.map((node) => {
      const isMissingUpstream = missingUpstreamSet.has(node.id);
      const isInvalidUpstream = invalidUpstreamSet.has(node.id);
      const hasCycle = cycleSet.has(node.id);
      const hasValidationError = isMissingUpstream || isInvalidUpstream;
      const isOrphan = orphanSet.has(node.id);
      const isDicom =
        node.data?.beam_transform === 'DicomIO' || node.data?.label?.includes('DicomIO');
      const transformName = isDicom ? 'DicomIO' : 'FhirIO';
      const requiredMode = isDicom ? 'readStudyMetadata' : 'readResources';
      const readMode = node.data?.properties?.readMode || requiredMode;
      const validationError = isMissingUpstream
        ? `${transformName}.${requiredMode}() requires an upstream PubSubIO node connected in front of it.`
        : isInvalidUpstream
        ? `${transformName}.${readMode}() does not accept an upstream connection. Remove the connected upstream node or switch back to ${transformName}.${requiredMode}().`
        : hasCycle
        ? dagValidation.errors[0]
        : undefined;

      if (
        node.data.hasCycle === hasCycle &&
        node.data.hasValidationError === hasValidationError &&
        node.data.isOrphan === isOrphan &&
        node.data.validationError === validationError
      ) {
        return node;
      }

      return {
        ...node,
        data: {
          ...node.data,
          hasCycle,
          hasValidationError,
          isOrphan,
          validationError,
          validationWarning: isOrphan ? 'Orphan node: disconnected from pipeline' : undefined,
        },
      };
    });
  }, [nodes, dagValidation]);

  // Decorate edges participating in cycles or invalid upstream connections with red styling
  const displayEdges = useMemo(() => {
    const cycleEdgeSet = new Set(dagValidation.cycleEdgeIds);
    const cycleNodeSet = new Set(dagValidation.cycleNodeIds);
    const invalidUpstreamSet = new Set(dagValidation.invalidUpstreamNodeIds || []);

    return edges.map((edge) => {
      const isCycleEdge =
        cycleEdgeSet.has(edge.id) ||
        (cycleNodeSet.has(edge.source) && cycleNodeSet.has(edge.target));
      const isInvalidUpstreamEdge = invalidUpstreamSet.has(edge.target);

      if (isCycleEdge) {
        return {
          ...edge,
          animated: true,
          style: {
            ...edge.style,
            stroke: '#f43f5e',
            strokeWidth: 2.5,
          },
        };
      }
      if (isInvalidUpstreamEdge) {
        return {
          ...edge,
          style: {
            ...edge.style,
            stroke: '#ef4444',
            strokeDasharray: '5,5',
            strokeWidth: 2,
          },
        };
      }
      return edge;
    });
  }, [edges, dagValidation]);

  return {
    nodes,
    setNodes,
    edges,
    setEdges,
    displayNodes,
    displayEdges,
    dagValidation,
    onNodesChange,
    onEdgesChange,
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
  };
}
