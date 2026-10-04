/**
 * @fileoverview Pure factory functions for creating pipeline graph nodes and edges.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

import type { Edge } from 'reactflow';
import type { PipelineNode } from '../hooks/usePipelineGraph';
import { isFileIoSourceItem, isParseMessageItem, isPubSubSourceNode } from './nodeKinds';

let fallbackCounter = 0;

/**
 * Generates a unique node ID, optionally prefixed with a domain descriptor.
 * Uses crypto.randomUUID() when available, falling back to counter + Math.random
 * ONLY inside this function if the runtime environment lacks crypto.randomUUID.
 *
 * @param prefix - Optional prefix (e.g. 'kv_mapper_', 'pubsub_') to prepend to the ID.
 * @returns A unique node ID string.
 */
export function createNodeId(prefix: string = ''): string {
  let uuid: string;
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    uuid = crypto.randomUUID();
  } else {
    // Fallback counter + Math.random only when crypto.randomUUID is unavailable in runtime/tests
    fallbackCounter += 1;
    uuid = `${fallbackCounter}-${Math.random().toString(36).slice(2, 10)}`;
  }
  return prefix ? `${prefix}${uuid}` : uuid;
}

/**
 * Description of an item dragged or added from the sidebar palette.
 */
export interface PaletteItem {
  /** Node display label. */
  label: string;
  /** Node semantic type: 'SOURCE' | 'STEP' | 'SINK'. */
  type: string;
  /** Name of the icon to render. */
  iconName: string;
  /** Optional Apache Beam transform identifier (e.g. 'FileIO', 'PubSubIO'). */
  beamTransform?: string;
  /** Optional React Flow node component type (defaults to 'pipeline'). */
  nodeType?: string;
}

/**
 * Result bundle containing constructed pipeline nodes and new edges.
 */
export interface CreatedPipelineElements {
  /** Constructed pipeline nodes. */
  nodes: PipelineNode[];
  /** Constructed edges (e.g. FileIO match->readMatches or auto-wired step edges). */
  edges: Edge[];
}

/**
 * Constructs pipeline nodes and any automatic edges for a palette item.
 * Handles single node creation as well as special multi-node transforms like FileIO
 * (which generates both FileIO.match and FileIO.readMatches connected by an edge),
 * and connects step nodes to upstream sources if applicable.
 *
 * @param item - Palette item describing the node to create.
 * @param position - The target position (or drop position) on the canvas.
 * @param existingNodes - Existing pipeline nodes for determining auto-connections.
 * @param existingEdges - Existing edges in the graph.
 * @returns An object containing the created nodes and any newly created edges.
 */
export function createNodesForPaletteItem(
  item: PaletteItem,
  position: { x: number; y: number },
  existingNodes: PipelineNode[] = [],
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _existingEdges: Edge[] = []
): CreatedPipelineElements {
  const nodeType = item.nodeType ?? 'pipeline';

  // Special handling for FileIO Source: Spawns both FileIO.match() and FileIO.readMatches() connected by an edge
  if (isFileIoSourceItem(item)) {
    const matchId = createNodeId();
    const readMatchesId = createNodeId();

    const matchNode: PipelineNode = {
      id: matchId,
      type: nodeType,
      position,
      data: {
        label: 'FileIO Match',
        type: 'SOURCE',
        iconName: 'Folder',
        beam_transform: 'FileIO.match',
      },
    };

    const readMatchesNode: PipelineNode = {
      id: readMatchesId,
      type: nodeType,
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
      id: `e-${matchId}-${readMatchesId}`,
      source: matchId,
      target: readMatchesId,
    };

    return {
      nodes: [matchNode, readMatchesNode],
      edges: [edge],
    };
  }

  const nodeId = createNodeId();
  const newNode: PipelineNode = {
    id: nodeId,
    type: nodeType,
    position,
    data: {
      label: item.label,
      type: item.type,
      iconName: item.iconName,
      ...(item.beamTransform ? { beam_transform: item.beamTransform } : {}),
    },
  };

  const newEdges: Edge[] = [];
  if (item.type === 'STEP') {
    if (isParseMessageItem(item)) {
      const pubSubSource = existingNodes.find(isPubSubSourceNode);
      if (pubSubSource) {
        newEdges.push({
          id: `e-${pubSubSource.id}-${newNode.id}`,
          source: pubSubSource.id,
          target: newNode.id,
        });
      }
    } else {
      const hasStep = existingNodes.some((n) => n.data?.type === 'STEP');
      if (!hasStep) {
        const sourceNode = existingNodes.find((n) => n.data?.type === 'SOURCE');
        if (sourceNode) {
          newEdges.push({
            id: `e-${sourceNode.id}-${newNode.id}`,
            source: sourceNode.id,
            target: newNode.id,
          });
        }
      }
    }
  }

  return {
    nodes: [newNode],
    edges: newEdges,
  };
}
