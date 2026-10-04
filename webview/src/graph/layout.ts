/**
 * @fileoverview Pure layout calculation module for pipeline graph nodes using Kahn's topological sort.
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 */

import type { Edge } from 'reactflow';
import type { PipelineNode } from '../hooks/usePipelineGraph';
import { isSideInputEdge } from '../../../src/shared/sideInputs';

/** Starting X coordinate for rank 0 columns, px. */
export const START_X = 80;

/** Starting Y baseline coordinate for centering columns, px. */
export const START_Y = 150;

/** Default horizontal distance between rank columns, px. */
export const COL_WIDTH = 300;

/** Vertical distance between nodes in the same column, px. */
export const ROW_HEIGHT = 120;

/** Minimum horizontal gap between the widest node in a column and the next column, px. */
const MIN_COL_GAP = 64;

/**
 * Estimates the rendered pixel width of a pipeline node so wide labels (e.g.
 * "Enrich Orders With FX Side Inputs") push the next column far enough right
 * to prevent overlapping downstream nodes.
 */
function estimateNodeWidth(node: PipelineNode): number {
  const labelLen = node.data?.label?.length ?? 0;
  // 88px accounts for node padding, icon badge, gap, and rename button; ~7.5px per label char.
  const fromLabel = Math.ceil(88 + labelLen * 7.5);
  const measured = typeof node.width === 'number' ? node.width : 0;
  return Math.max(180, measured, fromLabel);
}

/**
 * Computes topological columns using Kahn's algorithm and positions nodes left-to-right.
 * 
 * Rank assignment:
 * - Root nodes (in-degree = 0) start at rank 0.
 * - For each traversed node, downstream neighbors receive rank = max(neighborRank, currentRank + 1).
 * - Leftover nodes due to cycles fall back to predefined ranks:
 *   SOURCE = 0, STEP = 1, SINK = 2.
 * 
 * Vertical positioning:
 * - When no `side_input` edges are present, nodes within each column are centered vertically
 *   around `START_Y` (150).
 * - When `side_input` edges are present, main-flow nodes are centered around a shared `mainY`
 *   baseline (keeping the primary upstream input directly to the left of the ParDo), while
 *   upstream side-input branches are placed in horizontal rows above `mainY`. Branches whose
 *   terminal node is in a column closer to the ParDo are placed immediately above `mainY`, and
 *   branches originating from earlier columns are stacked higher above them so `side_input`
 *   edges arch cleanly into the top handle without crossing intermediate nodes.
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

  // 3. Group nodes by their calculated column rank and compute column X coordinates
  const columns: Record<number, string[]> = {};
  let maxRank = 0;
  targetNodes.forEach((n) => {
    const r = ranks[n.id];
    if (!columns[r]) columns[r] = [];
    columns[r].push(n.id);
    if (r > maxRank) maxRank = r;
  });

  const nodeById = new Map<string, PipelineNode>(targetNodes.map((n) => [n.id, n]));
  const colX: Record<number, number> = {};
  let currentX = START_X;
  for (let r = 0; r <= maxRank; r++) {
    colX[r] = currentX;
    const colNodeIds = columns[r] ?? [];
    const widest = colNodeIds.reduce((maxW, id) => {
      const node = nodeById.get(id);
      return node ? Math.max(maxW, estimateNodeWidth(node)) : maxW;
    }, 0);
    // Snap any widened column step to the 8pt grid
    const colStep = Math.max(COL_WIDTH, Math.ceil((widest + MIN_COL_GAP) / 8) * 8);
    currentX += colStep;
  }

  // 4. Partition side-input branches from the main pipeline flow when side_input edges exist
  const validSideEdges = targetEdges.filter(
    (e) => isSideInputEdge(e) && adj[e.source] !== undefined && adj[e.target] !== undefined
  );

  const yByNodeId: Record<string, number> = {};

  if (validSideEdges.length > 0) {
    const nonSideForward: Record<string, string[]> = {};
    const nonSideReverse: Record<string, string[]> = {};
    targetNodes.forEach((n) => {
      nonSideForward[n.id] = [];
      nonSideReverse[n.id] = [];
    });
    targetEdges.forEach((e) => {
      if (!isSideInputEdge(e) && nonSideForward[e.source] && nonSideReverse[e.target]) {
        nonSideForward[e.source].push(e.target);
        nonSideReverse[e.target].push(e.source);
      }
    });

    const sideSourceIds = new Set(validSideEdges.map((e) => e.source));
    const mainFlowNodeIds = new Set<string>();
    const mainQueue: string[] = [];

    // Seed with side_input target nodes (ParDo) and terminal sinks that aren't solely side-input sources
    validSideEdges.forEach((e) => {
      if (!mainFlowNodeIds.has(e.target)) {
        mainFlowNodeIds.add(e.target);
        mainQueue.push(e.target);
      }
    });
    targetNodes.forEach((n) => {
      if (adj[n.id].length === 0 && !sideSourceIds.has(n.id) && !mainFlowNodeIds.has(n.id)) {
        mainFlowNodeIds.add(n.id);
        mainQueue.push(n.id);
      }
    });

    // Traverse non-side edges in both directions to capture the entire main pipeline spine
    while (mainQueue.length > 0) {
      const curr = mainQueue.shift()!;
      for (const prev of nonSideReverse[curr] ?? []) {
        if (!mainFlowNodeIds.has(prev)) {
          mainFlowNodeIds.add(prev);
          mainQueue.push(prev);
        }
      }
      for (const next of nonSideForward[curr] ?? []) {
        if (!mainFlowNodeIds.has(next)) {
          mainFlowNodeIds.add(next);
          mainQueue.push(next);
        }
      }
    }

    /** Represents an upstream subgraph feeding a single side_input edge. */
    interface SideBranch {
      nodeIds: string[];
      terminalRank: number;
      rowSpan: number;
    }
    const assignedSideNodes = new Set<string>();
    const sideBranches: SideBranch[] = [];

    validSideEdges.forEach((e) => {
      if (mainFlowNodeIds.has(e.source) || assignedSideNodes.has(e.source)) {
        return;
      }
      const branchNodes: string[] = [];
      const bQueue: string[] = [e.source];
      assignedSideNodes.add(e.source);
      while (bQueue.length > 0) {
        const curr = bQueue.shift()!;
        branchNodes.push(curr);
        for (const prev of nonSideReverse[curr] ?? []) {
          if (!mainFlowNodeIds.has(prev) && !assignedSideNodes.has(prev)) {
            assignedSideNodes.add(prev);
            bQueue.push(prev);
          }
        }
      }
      // Compute max nodes sharing a single column within this branch (usually 1 for a linear chain)
      const perColCount: Record<number, number> = {};
      let rowSpan = 1;
      branchNodes.forEach((id) => {
        const r = ranks[id];
        perColCount[r] = (perColCount[r] ?? 0) + 1;
        if (perColCount[r] > rowSpan) rowSpan = perColCount[r];
      });

      sideBranches.push({
        nodeIds: branchNodes,
        terminalRank: ranks[e.source] ?? 0,
        rowSpan,
      });
    });

    // Any remaining unassigned nodes (e.g. disconnected nodes) stay with the main flow
    targetNodes.forEach((n) => {
      if (!assignedSideNodes.has(n.id)) {
        mainFlowNodeIds.add(n.id);
      }
    });

    // Order side branches so those ending in columns closest to the ParDo sit immediately above
    // the main flow, and branches ending in earlier columns sit higher above them (avoiding crossings).
    sideBranches.sort((a, b) => b.terminalRank - a.terminalRank || b.nodeIds.length - a.nodeIds.length);

    const totalSideRows = sideBranches.reduce((sum, b) => sum + b.rowSpan, 0);
    const mainY = START_Y + totalSideRows * (ROW_HEIGHT / 2);

    // Position main-flow nodes per column centered around mainY
    for (let r = 0; r <= maxRank; r++) {
      const mainColNodes = (columns[r] ?? []).filter((id) => mainFlowNodeIds.has(id));
      const totalHeight = (mainColNodes.length - 1) * ROW_HEIGHT;
      mainColNodes.forEach((id, idx) => {
        yByNodeId[id] = mainY + idx * ROW_HEIGHT - totalHeight / 2;
      });
    }

    // Stack side-input branches in rows strictly above mainY
    let rowsAboveMain = 0;
    sideBranches.forEach((branch) => {
      const branchByCol: Record<number, string[]> = {};
      branch.nodeIds.forEach((id) => {
        const r = ranks[id];
        if (!branchByCol[r]) branchByCol[r] = [];
        branchByCol[r].push(id);
      });
      const branchCenterY = mainY - (rowsAboveMain + (branch.rowSpan + 1) / 2) * ROW_HEIGHT;
      Object.values(branchByCol).forEach((colIds) => {
        const totalHeight = (colIds.length - 1) * ROW_HEIGHT;
        colIds.forEach((id, idx) => {
          yByNodeId[id] = branchCenterY + idx * ROW_HEIGHT - totalHeight / 2;
        });
      });
      rowsAboveMain += branch.rowSpan;
    });
  } else {
    // Standard vertical centering per column when no side_input edges exist
    for (let r = 0; r <= maxRank; r++) {
      const colNodes = columns[r] ?? [];
      const totalHeight = (colNodes.length - 1) * ROW_HEIGHT;
      colNodes.forEach((id, idx) => {
        yByNodeId[id] = START_Y + idx * ROW_HEIGHT - totalHeight / 2;
      });
    }
  }

  // 5. Return nodes with updated positions
  return targetNodes.map((node) => {
    const rank = ranks[node.id];
    return {
      ...node,
      position: {
        x: colX[rank],
        y: yByNodeId[node.id],
      },
    };
  });
}
