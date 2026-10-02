/**
 * @fileoverview Pure layout calculation module for pipeline graph nodes using Kahn's topological sort.
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 */

import type { Edge } from 'reactflow';
import type { PipelineNode } from '../hooks/usePipelineGraph';

/** Starting X coordinate for rank 0 columns, px. */
export const START_X = 80;

/** Starting Y baseline coordinate for centering columns, px. */
export const START_Y = 150;

/** Horizontal distance between rank columns, px. */
export const COL_WIDTH = 300;

/** Vertical distance between nodes in the same column, px. */
export const ROW_HEIGHT = 120;

/**
 * Computes topological columns using Kahn's algorithm and positions nodes left-to-right.
 * 
 * Rank assignment:
 * - Root nodes (in-degree = 0) start at rank 0.
 * - For each traversed node, downstream neighbors receive rank = max(neighborRank, currentRank + 1).
 * - Leftover nodes due to cycles fall back to predefined ranks:
 *   SOURCE = 0, STEP = 1, SINK = 2.
 * 
 * Vertical centering:
 * - Nodes within each column are centered vertically around startY (150).
 * 
 * @param targetNodes - List of pipeline nodes to position
 * @param targetEdges - Directed edges representing dependencies between nodes
 * @returns Array of pipeline nodes with updated { x, y } coordinates in position
 */
export function computeLayoutedNodes(targetNodes: PipelineNode[], targetEdges: Edge[]): PipelineNode[] {
  // 1. Build adjacency lists
  const adj: Record<string, string[]> = {};
  const inDegree: Record<string, number> = {};

  targetNodes.forEach((n) => {
    adj[n.id] = [];
    inDegree[n.id] = 0;
  });

  targetEdges.forEach((e) => {
    if (adj[e.source] && adj[e.target] !== undefined) {
      adj[e.source].push(e.target);
      inDegree[e.target]++;
    }
  });

  // 2. Queue for Kahn's topological sort to compute columns (ranks)
  const ranks: Record<string, number> = {};
  const queue: string[] = [];

  // Find all root nodes (in-degree = 0)
  targetNodes.forEach((n) => {
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
  targetNodes.forEach((n) => {
    if (ranks[n.id] === undefined) {
      if (n.data?.type === 'SOURCE') ranks[n.id] = 0;
      else if (n.data?.type === 'SINK') ranks[n.id] = 2;
      else ranks[n.id] = 1;
    }
  });

  // 3. Group nodes by their calculated column rank
  const columns: Record<number, string[]> = {};
  targetNodes.forEach((n) => {
    const r = ranks[n.id];
    if (!columns[r]) columns[r] = [];
    columns[r].push(n.id);
  });

  // 4. Calculate new positions
  return targetNodes.map((node) => {
    const rank = ranks[node.id];
    const colNodes = columns[rank];
    const index = colNodes.indexOf(node.id);

    // Spacing constants adhering to 8pt design
    const x = START_X + rank * COL_WIDTH;
    // Center the column vertically
    const totalHeight = (colNodes.length - 1) * ROW_HEIGHT;
    const y = START_Y + index * ROW_HEIGHT - totalHeight / 2;

    return {
      ...node,
      position: { x, y },
    };
  });
}
