/**
 * Unit tests for layout.ts pure graph positioning algorithm
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 */

import { describe, it, expect } from 'vitest';
import type { Edge } from 'reactflow';
import type { PipelineNode } from '../hooks/usePipelineGraph';
import {
  computeLayoutedNodes,
  START_X,
  START_Y,
  COL_WIDTH,
  ROW_HEIGHT,
} from './layout';

describe('computeLayoutedNodes', () => {
  it('linear chain A->B->C gets increasing x by column', () => {
    const nodes: PipelineNode[] = [
      { id: 'nodeA', type: 'pipeline', position: { x: 0, y: 0 }, data: { label: 'Node A', type: 'SOURCE', iconName: 'Radio' } },
      { id: 'nodeB', type: 'pipeline', position: { x: 0, y: 0 }, data: { label: 'Node B', type: 'STEP', iconName: 'Clock' } },
      { id: 'nodeC', type: 'pipeline', position: { x: 0, y: 0 }, data: { label: 'Node C', type: 'SINK', iconName: 'Database' } },
    ];

    const edges: Edge[] = [
      { id: 'e-AB', source: 'nodeA', target: 'nodeB' },
      { id: 'e-BC', source: 'nodeB', target: 'nodeC' },
    ];

    const result = computeLayoutedNodes(nodes, edges);

    const nodeA = result.find((n) => n.id === 'nodeA')!;
    const nodeB = result.find((n) => n.id === 'nodeB')!;
    const nodeC = result.find((n) => n.id === 'nodeC')!;

    expect(nodeA.position.x).toBe(START_X);
    expect(nodeB.position.x).toBe(START_X + COL_WIDTH);
    expect(nodeC.position.x).toBe(START_X + 2 * COL_WIDTH);

    expect(nodeA.position.x).toBeLessThan(nodeB.position.x);
    expect(nodeB.position.x).toBeLessThan(nodeC.position.x);

    expect(nodeA.position.y).toBe(START_Y);
    expect(nodeB.position.y).toBe(START_Y);
    expect(nodeC.position.y).toBe(START_Y);
  });

  it('two sources feeding one sink => both sources rank 0 and are vertically centred around the same y', () => {
    const nodes: PipelineNode[] = [
      { id: 'src1', type: 'pipeline', position: { x: 0, y: 0 }, data: { label: 'Source 1', type: 'SOURCE', iconName: 'Radio' } },
      { id: 'src2', type: 'pipeline', position: { x: 0, y: 0 }, data: { label: 'Source 2', type: 'SOURCE', iconName: 'Radio' } },
      { id: 'sink', type: 'pipeline', position: { x: 0, y: 0 }, data: { label: 'Sink', type: 'SINK', iconName: 'Database' } },
    ];

    const edges: Edge[] = [
      { id: 'e-s1-sink', source: 'src1', target: 'sink' },
      { id: 'e-s2-sink', source: 'src2', target: 'sink' },
    ];

    const result = computeLayoutedNodes(nodes, edges);

    const src1 = result.find((n) => n.id === 'src1')!;
    const src2 = result.find((n) => n.id === 'src2')!;
    const sink = result.find((n) => n.id === 'sink')!;

    // Both sources get rank 0
    expect(src1.position.x).toBe(START_X);
    expect(src2.position.x).toBe(START_X);
    expect(sink.position.x).toBe(START_X + COL_WIDTH);

    // Two sources vertically centered around START_Y
    expect(src1.position.y).toBe(START_Y - ROW_HEIGHT / 2);
    expect(src2.position.y).toBe(START_Y + ROW_HEIGHT / 2);
    expect((src1.position.y + src2.position.y) / 2).toBe(START_Y);

    // Sink is in its own column, centered at START_Y
    expect(sink.position.y).toBe(START_Y);
  });

  it('a cycle falls back to SOURCE/STEP/SINK ranks', () => {
    const nodes: PipelineNode[] = [
      { id: 'src', type: 'pipeline', position: { x: 0, y: 0 }, data: { label: 'Source', type: 'SOURCE', iconName: 'Radio' } },
      { id: 'step', type: 'pipeline', position: { x: 0, y: 0 }, data: { label: 'Step', type: 'STEP', iconName: 'Clock' } },
      { id: 'sink', type: 'pipeline', position: { x: 0, y: 0 }, data: { label: 'Sink', type: 'SINK', iconName: 'Database' } },
    ];

    // Cycle: src -> step -> sink -> src
    const edges: Edge[] = [
      { id: 'e-1', source: 'src', target: 'step' },
      { id: 'e-2', source: 'step', target: 'sink' },
      { id: 'e-3', source: 'sink', target: 'src' },
    ];

    const result = computeLayoutedNodes(nodes, edges);

    const src = result.find((n) => n.id === 'src')!;
    const step = result.find((n) => n.id === 'step')!;
    const sink = result.find((n) => n.id === 'sink')!;

    // Fallback: SOURCE=0, STEP=1, SINK=2
    expect(src.position.x).toBe(START_X);
    expect(step.position.x).toBe(START_X + COL_WIDTH);
    expect(sink.position.x).toBe(START_X + 2 * COL_WIDTH);

    expect(src.position.y).toBe(START_Y);
    expect(step.position.y).toBe(START_Y);
    expect(sink.position.y).toBe(START_Y);
  });

  it('disconnected single node', () => {
    const nodes: PipelineNode[] = [
      { id: 'single', type: 'pipeline', position: { x: 999, y: 999 }, data: { label: 'Lone Source', type: 'SOURCE', iconName: 'Radio' } },
    ];

    const result = computeLayoutedNodes(nodes, []);

    expect(result).toHaveLength(1);
    expect(result[0].position).toEqual({
      x: START_X,
      y: START_Y,
    });
  });

  it('positions side_input branches in rows above the main flow and widens columns for long labels', () => {
    const nodes: PipelineNode[] = [
      { id: 'source-orders', type: 'pipeline', position: { x: 0, y: 0 }, data: { label: 'Create Orders', type: 'SOURCE', iconName: 'Box' } },
      { id: 'source-fx-rates', type: 'pipeline', position: { x: 0, y: 0 }, data: { label: 'Create FX Rates', type: 'SOURCE', iconName: 'Box' } },
      { id: 'step-fx-rates-kv', type: 'pipeline', position: { x: 0, y: 0 }, data: { label: 'Key Rates By Currency', type: 'STEP', iconName: 'Hash' } },
      { id: 'source-target-currency', type: 'pipeline', position: { x: 0, y: 0 }, data: { label: 'Create Target Currency', type: 'SOURCE', iconName: 'Box' } },
      { id: 'step-enrich-pardo', type: 'pipeline', position: { x: 0, y: 0 }, data: { label: 'Enrich Orders With FX Side Inputs', type: 'STEP', iconName: 'Code' } },
      { id: 'sink-log', type: 'pipeline', position: { x: 0, y: 0 }, data: { label: 'Log Message', type: 'SINK', iconName: 'Terminal' } },
      { id: 'sink-log-errors', type: 'pipeline', position: { x: 0, y: 0 }, data: { label: 'Log Errors', type: 'SINK', iconName: 'Terminal' } },
    ];

    const edges: Edge[] = [
      { id: 'e1', source: 'source-orders', target: 'step-enrich-pardo' },
      { id: 'e2', source: 'source-fx-rates', target: 'step-fx-rates-kv' },
      { id: 'e3', source: 'step-fx-rates-kv', sourceHandle: 'valid', target: 'step-enrich-pardo', targetHandle: 'side_input' },
      { id: 'e4', source: 'source-target-currency', target: 'step-enrich-pardo', targetHandle: 'side_input' },
      { id: 'e5', source: 'step-enrich-pardo', sourceHandle: 'valid', target: 'sink-log' },
      { id: 'e6', source: 'step-enrich-pardo', sourceHandle: 'error', target: 'sink-log-errors' },
    ];

    const result = computeLayoutedNodes(nodes, edges);
    const byId = Object.fromEntries(result.map((n) => [n.id, n]));

    // 1. "Create Orders" is directly to the left of the ParDo on the same horizontal row
    expect(byId['source-orders'].position.y).toBe(byId['step-enrich-pardo'].position.y);
    expect(byId['source-orders'].position.x).toBeLessThan(byId['step-enrich-pardo'].position.x);

    // 2. "Create FX Rates" is one row above "Create Orders", with "Key Rates By Currency" to its right on the same row
    expect(byId['source-fx-rates'].position.y).toBe(byId['source-orders'].position.y - ROW_HEIGHT);
    expect(byId['step-fx-rates-kv'].position.y).toBe(byId['source-fx-rates'].position.y);
    expect(byId['step-fx-rates-kv'].position.x).toBeGreaterThan(byId['source-fx-rates'].position.x);
    expect(byId['step-fx-rates-kv'].position.x).toBeLessThan(byId['step-enrich-pardo'].position.x);

    // 3. "Create Target Currency" is one row above "Create FX Rates"
    expect(byId['source-target-currency'].position.y).toBe(byId['source-fx-rates'].position.y - ROW_HEIGHT);
    expect(byId['source-target-currency'].position.x).toBe(byId['source-fx-rates'].position.x);

    // 4. Both Log sinks are well to the right of the wide ParDo (no overlap) and centered around the ParDo's Y
    expect(byId['sink-log'].position.x).toBeGreaterThanOrEqual(byId['step-enrich-pardo'].position.x + 400);
    expect(byId['sink-log-errors'].position.x).toBe(byId['sink-log'].position.x);
    expect((byId['sink-log'].position.y + byId['sink-log-errors'].position.y) / 2).toBe(
      byId['step-enrich-pardo'].position.y
    );
  });
});
