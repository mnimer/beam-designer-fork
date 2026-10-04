/**
 * Hook for Apache Beam pipeline graph state and mutation helpers
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Handles React Flow node and edge state management, drag-and-drop ingestion,
 * connection validation, topological auto-layout, edge redirection (M16),
 * property application, and node deletion.
 *
 * Side inputs (F1): edges targeting the `side_input` handle on ParDo nodes are rendered with a
 * dashed violet stroke and a "side" label, and `properties.sideInputs` on every ParDo node is
 * auto-synchronised with those edges so the property panel and canvas never drift apart.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  useNodesState,
  useEdgesState,
  addEdge,
  type Node,
  type Edge,
  type Connection,
} from 'reactflow';
import { validateDagTopology, type DagValidationResult } from '../utils/dagValidator';
import { computeLayoutedNodes } from '../graph/layout';
import { createNodeId, createNodesForPaletteItem } from '../graph/nodeFactory';
import { isPubSubSourceNode, isPubSubNode, isDicomIoNode } from '../graph/nodeKinds';
import { pipelineConfigReducer } from '../state/pipelineConfigReducer';
import {
  isParDoNodeData,
  isSideInputEdge,
  syncSideInputBindings,
} from '../../../src/shared/sideInputs';

/**
 * Data payload stored within React Flow nodes for Apache Beam transforms.
 */
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

/**
 * Options for configuring the {@link usePipelineGraph} hook.
 */
export interface UsePipelineGraphOptions {
  takeSnapshot: () => void;
  setPipelineConfig: React.Dispatch<React.SetStateAction<any>>;
  project?: (position: { x: number; y: number }) => { x: number; y: number };
  fitView?: (options?: any) => void;
}

/**
 * Custom React hook managing pipeline graph nodes, edges, selection, validation, layout, and transform mutations.
 *
 * @param options Graph initialization and synchronization options.
 * @returns State and event handlers for the React Flow canvas.
 */
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

  const hasPubSubSource = nodes.some(isPubSubSourceNode);

  // Wrap state changes to set needsRebuild: true when structural nodes change
  const handleNodesChange = useCallback(
    (changes: any) => {
      onNodesChange(changes);
      const requiresRebuild = changes.some((c: any) => c.type === 'add' || c.type === 'remove');
      if (requiresRebuild) {
        setPipelineConfig((prev: any) => pipelineConfigReducer(prev, { type: 'markDirty' }));
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
        setPipelineConfig((prev: any) => pipelineConfigReducer(prev, { type: 'markDirty' }));
      }
    },
    [onEdgesChange, setPipelineConfig]
  );

  /**
   * Keeps `properties.sideInputs` on every ParDo node in lockstep with the edges connected to
   * its `side_input` handle (connect → binding added with defaults, disconnect → binding removed,
   * upstream rename → `sourceLabel` refreshed). The updater returns the SAME array reference when
   * nothing changed, so React bails out of the state update and no render loop is possible.
   */
  useEffect(() => {
    setNodes((nds) => {
      const labelFor = (id: string) => nds.find((n) => n.id === id)?.data?.label;
      let changed = false;
      const next = nds.map((node) => {
        if (!isParDoNodeData(node.data)) {
          return node;
        }
        const connected = edges
          .filter((e) => e.target === node.id && isSideInputEdge(e))
          .map((e) => e.source);
        const existing = node.data.properties?.sideInputs;
        const hasExisting = Array.isArray(existing) && existing.length > 0;
        if (connected.length === 0 && !hasExisting) {
          return node; // Nothing to sync; avoid writing empty arrays into legacy pipelines
        }
        const { bindings, changed: bindingsChanged } = syncSideInputBindings(existing, connected, labelFor);
        if (!bindingsChanged) {
          return node;
        }
        changed = true;
        return {
          ...node,
          data: {
            ...node.data,
            properties: { ...(node.data.properties || {}), sideInputs: bindings },
          },
        };
      });
      return changed ? next : nds;
    });
  }, [edges, nodes, setNodes]);

  // Disallow direct connection from SOURCE to SINK without intervening transform steps,
  // and only accept `side_input` connections on ParDo targets.
  const isValidConnection = useCallback(
    (connection: Connection) => {
      const sourceNode = nodes.find((n) => n.id === connection.source);
      const targetNode = nodes.find((n) => n.id === connection.target);

      if (sourceNode?.data?.type === 'SOURCE' && targetNode?.data?.type === 'SINK') {
        return false;
      }

      if (isSideInputEdge(connection as any) && !isParDoNodeData(targetNode?.data)) {
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
      setPipelineConfig((prev: any) => pipelineConfigReducer(prev, { type: 'markDirty' }));
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
      setPipelineConfig((prev: any) => pipelineConfigReducer(prev, { type: 'markDirty' }));
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
      setPipelineConfig((prev: any) => pipelineConfigReducer(prev, { type: 'markDirty' }));
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

      const kvMapperId = createNodeId('kv_mapper_');
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
      setPipelineConfig((prev: any) => pipelineConfigReducer(prev, { type: 'markDirty' }));
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
        return isPubSubNode(src);
      });
      if (alreadyConnected) return;

      const pubSubId = createNodeId('pubsub_');
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
      setPipelineConfig((prev: any) => pipelineConfigReducer(prev, { type: 'markDirty' }));
    },
    [nodes, edges, setNodes, setEdges, takeSnapshot, setPipelineConfig]
  );

  const triggerFitView = useCallback(() => {
    if (fitView) {
      setTimeout(() => {
        fitView({ duration: 300, padding: 1 });
      }, 100);
    }
  }, [fitView]);

  const onLayout = useCallback(() => {
    const newNodes = computeLayoutedNodes(nodes, edges);
    takeSnapshot();
    setNodes(newNodes);
    triggerFitView();
  }, [nodes, edges, setNodes, takeSnapshot, triggerFitView]);

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

      const { nodes: newNodes, edges: newEdges } = createNodesForPaletteItem(
        data,
        position,
        nodes,
        edges
      );

      takeSnapshot();
      setNodes((prev) => [...prev, ...newNodes]);
      if (newEdges.length > 0) {
        setEdges((prev) => [...prev, ...newEdges]);
      }
      setPipelineConfig((prev: any) => pipelineConfigReducer(prev, { type: 'markDirty' }));
    },
    [project, setNodes, setEdges, nodes, edges, takeSnapshot, setPipelineConfig]
  );

  /**
   * Directly adds a node to the React Flow canvas when '+' is clicked on a SidebarItem,
   * and triggers auto-layout + fitView so the newly added node is immediately visible on screen.
   */
  const handleAddNode = useCallback(
    (label: string, type: string, iconName: string, beamTransform?: string) => {
      const nodeCount = nodes.length;
      const position = {
        x: 100 + (nodeCount % 6) * 60,
        y: 100 + (nodeCount % 6) * 60,
      };

      const { nodes: newNodes, edges: newEdges } = createNodesForPaletteItem(
        { label, type, iconName, beamTransform, nodeType: 'pipeline' },
        position,
        nodes,
        edges
      );

      const nextEdges = newEdges.length > 0 ? [...edges, ...newEdges] : edges;

      takeSnapshot();
      setNodes((prev) => computeLayoutedNodes([...prev, ...newNodes], nextEdges));
      if (newEdges.length > 0) {
        setEdges((prev) => [...prev, ...newEdges]);
      }
      setPipelineConfig((prev: any) => pipelineConfigReducer(prev, { type: 'markDirty' }));
      triggerFitView();
    },
    [nodes, edges, setNodes, setEdges, takeSnapshot, setPipelineConfig, triggerFitView]
  );

  // Deletes currently selected node or edge and records undo snapshot
  const deleteSelected = useCallback(() => {
    if (selectedNodeId) {
      takeSnapshot();
      setNodes((nds) => nds.filter((node) => node.id !== selectedNodeId));
      setEdges((eds) => eds.filter((edge) => edge.source !== selectedNodeId && edge.target !== selectedNodeId));
      setSelectedNodeId(null);
      setPipelineConfig((prev: any) => pipelineConfigReducer(prev, { type: 'markDirty' }));
    } else if (selectedEdgeId) {
      takeSnapshot();
      setEdges((eds) => eds.filter((edge) => edge.id !== selectedEdgeId));
      setSelectedEdgeId(null);
      setPipelineConfig((prev: any) => pipelineConfigReducer(prev, { type: 'markDirty' }));
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
    const sideInputMismatchSet = new Set(dagValidation.sideInputMismatchNodeIds || []);

    return nodes.map((node) => {
      const isMissingUpstream = missingUpstreamSet.has(node.id);
      const isInvalidUpstream = invalidUpstreamSet.has(node.id);
      const isSideInputMismatch = sideInputMismatchSet.has(node.id);
      const hasCycle = cycleSet.has(node.id);
      const hasValidationError = isMissingUpstream || isInvalidUpstream || isSideInputMismatch;
      const isOrphan = orphanSet.has(node.id);
      const isParDo = isParDoNodeData(node.data);
      const isDicom = isDicomIoNode(node);
      const transformName = isDicom ? 'DicomIO' : 'FhirIO';
      const requiredMode = isDicom ? 'readStudyMetadata' : 'readResources';
      const readMode = node.data?.properties?.readMode || requiredMode;
      // ParDo side input errors carry their own validator message (keyed by "(nodeId)")
      const parDoError = isParDo && (isMissingUpstream || isSideInputMismatch)
        ? dagValidation.errors.find((e) => e.startsWith('ParDo node') && e.includes(`(${node.id})`))
        : undefined;
      const validationError = parDoError
        ? parDoError
        : isMissingUpstream
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
      if (isSideInputEdge(edge)) {
        return {
          ...edge,
          label: edge.label ?? 'side',
          labelStyle: { fill: '#fde047', fontSize: 10, fontWeight: 600, ...(edge.labelStyle || {}) },
          labelBgStyle: { fill: '#1E202A', fillOpacity: 0.9, ...(edge.labelBgStyle || {}) },
          labelBgPadding: edge.labelBgPadding ?? [4, 2],
          labelBgBorderRadius: edge.labelBgBorderRadius ?? 4,
          style: {
            ...edge.style,
            stroke: '#facc15',
            strokeDasharray: '5 4',
            strokeWidth: 1.5,
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
