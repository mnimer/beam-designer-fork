/**
 * Unit tests for usePipelineGraph hook
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Tests:
 * - Empty initial nodes and edges
 * - Disallowing direct SOURCE to SINK connections
 * - M16: handleAddKVMapper rewires ALL inbound edges to new KV Mapper
 * - Node label modification
 * - Property application
 * - Edge and node deletion
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePipelineGraph } from './usePipelineGraph';

describe('usePipelineGraph', () => {
  it('initializes with empty nodes and edges arrays', () => {
    const takeSnapshot = vi.fn();
    const setPipelineConfig = vi.fn();

    const { result } = renderHook(() =>
      usePipelineGraph({ takeSnapshot, setPipelineConfig })
    );

    expect(result.current.nodes).toEqual([]);
    expect(result.current.edges).toEqual([]);
    expect(result.current.hasPubSubSource).toBe(false);
  });

  it('isValidConnection disallows direct connection from SOURCE to SINK', () => {
    const takeSnapshot = vi.fn();
    const setPipelineConfig = vi.fn();

    const { result } = renderHook(() =>
      usePipelineGraph({ takeSnapshot, setPipelineConfig })
    );

    // Set up source and sink nodes
    act(() => {
      result.current.setNodes([
        { id: 'src', type: 'pipeline', position: { x: 0, y: 0 }, data: { label: 'Source', type: 'SOURCE', iconName: 'Radio' } },
        { id: 'snk', type: 'pipeline', position: { x: 200, y: 0 }, data: { label: 'Sink', type: 'SINK', iconName: 'Database' } },
        { id: 'step', type: 'pipeline', position: { x: 100, y: 0 }, data: { label: 'Step', type: 'STEP', iconName: 'Clock' } },
      ]);
    });

    // SOURCE -> SINK is invalid
    expect(result.current.isValidConnection({ source: 'src', target: 'snk', sourceHandle: null, targetHandle: null })).toBe(false);

    // SOURCE -> STEP is valid
    expect(result.current.isValidConnection({ source: 'src', target: 'step', sourceHandle: null, targetHandle: null })).toBe(true);

    // STEP -> SINK is valid
    expect(result.current.isValidConnection({ source: 'step', target: 'snk', sourceHandle: null, targetHandle: null })).toBe(true);
  });

  it('handleAddKVMapper rewires ALL inbound edges targeting window node (M16)', () => {
    const takeSnapshot = vi.fn();
    const setPipelineConfig = vi.fn();

    const { result } = renderHook(() =>
      usePipelineGraph({ takeSnapshot, setPipelineConfig })
    );

    act(() => {
      result.current.setNodes([
        { id: 's1', type: 'pipeline', position: { x: 0, y: 0 }, data: { label: 'Source 1', type: 'SOURCE', iconName: 'Radio' } },
        { id: 's2', type: 'pipeline', position: { x: 0, y: 100 }, data: { label: 'Source 2', type: 'SOURCE', iconName: 'Radio' } },
        { id: 'w1', type: 'pipeline', position: { x: 300, y: 50 }, data: { label: 'Window', type: 'STEP', iconName: 'Clock' } },
      ]);
      result.current.setEdges([
        { id: 'e1', source: 's1', target: 'w1' },
        { id: 'e2', source: 's2', target: 'w1' },
      ]);
    });

    act(() => {
      result.current.handleAddKVMapper('w1');
    });

    expect(takeSnapshot).toHaveBeenCalled();
    expect(setPipelineConfig).toHaveBeenCalled();

    // Check newly added node
    const kvNode = result.current.nodes.find((n) => n.data.beam_transform === 'KVMapper');
    expect(kvNode).toBeDefined();
    const kvId = kvNode!.id;

    // Both e1 and e2 must be rewired to kvId
    const e1 = result.current.edges.find((e) => e.id === 'e1');
    const e2 = result.current.edges.find((e) => e.id === 'e2');
    expect(e1?.target).toBe(kvId);
    expect(e2?.target).toBe(kvId);

    // New connector edge links kvId to w1
    const connector = result.current.edges.find((e) => e.source === kvId && e.target === 'w1');
    expect(connector).toBeDefined();
    expect(connector?.sourceHandle).toBe('valid');
  });

  it('handleNodeLabelChange updates node label and flags pipeline for rebuild', () => {
    const takeSnapshot = vi.fn();
    const setPipelineConfig = vi.fn();

    const { result } = renderHook(() =>
      usePipelineGraph({ takeSnapshot, setPipelineConfig })
    );

    act(() => {
      result.current.setNodes([
        { id: 'n1', type: 'pipeline', position: { x: 0, y: 0 }, data: { label: 'Old Label', type: 'SOURCE', iconName: 'Radio' } },
      ]);
    });

    act(() => {
      result.current.handleNodeLabelChange('n1', 'New Label');
    });

    expect(takeSnapshot).toHaveBeenCalled();
    expect(result.current.nodes[0].data.label).toBe('New Label');
    expect(setPipelineConfig).toHaveBeenCalled();
  });

  it('handleApplyProperties updates properties and special instructions', () => {
    const takeSnapshot = vi.fn();
    const setPipelineConfig = vi.fn();

    const { result } = renderHook(() =>
      usePipelineGraph({ takeSnapshot, setPipelineConfig })
    );

    act(() => {
      result.current.setNodes([
        { id: 'n1', type: 'pipeline', position: { x: 0, y: 0 }, data: { label: 'Node', type: 'STEP', iconName: 'Clock' } },
      ]);
    });

    act(() => {
      result.current.handleApplyProperties('n1', {
        foo: 'bar',
        system_instructions: 'custom instruction',
      });
    });

    expect(result.current.nodes[0].data.properties).toEqual({ foo: 'bar' });
    expect(result.current.nodes[0].data.system_instructions).toBe('custom instruction');
  });

  it('deleteSelected removes selected node and any associated edges', () => {
    const takeSnapshot = vi.fn();
    const setPipelineConfig = vi.fn();

    const { result } = renderHook(() =>
      usePipelineGraph({ takeSnapshot, setPipelineConfig })
    );

    act(() => {
      result.current.setNodes([
        { id: 'n1', type: 'pipeline', position: { x: 0, y: 0 }, data: { label: 'N1', type: 'SOURCE', iconName: 'Radio' } },
        { id: 'n2', type: 'pipeline', position: { x: 100, y: 0 }, data: { label: 'N2', type: 'SINK', iconName: 'Radio' } },
      ]);
      result.current.setEdges([
        { id: 'e1', source: 'n1', target: 'n2' },
      ]);
      result.current.setSelectedNodeId('n1');
    });

    act(() => {
      result.current.deleteSelected();
    });

    expect(result.current.nodes.length).toBe(1);
    expect(result.current.nodes[0].id).toBe('n2');
    expect(result.current.edges.length).toBe(0);
    expect(result.current.selectedNodeId).toBeNull();
  });

  it('deleteSelected removes selected edge', () => {
    const takeSnapshot = vi.fn();
    const setPipelineConfig = vi.fn();

    const { result } = renderHook(() =>
      usePipelineGraph({ takeSnapshot, setPipelineConfig })
    );

    act(() => {
      result.current.setEdges([
        { id: 'e1', source: 'n1', target: 'n2' },
      ]);
      result.current.setSelectedEdgeId('e1');
    });

    act(() => {
      result.current.deleteSelected();
    });

    expect(result.current.edges.length).toBe(0);
    expect(result.current.selectedEdgeId).toBeNull();
  });

  it('handleAddNode triggers auto layout and fitView when adding nodes with the + button', () => {
    vi.useFakeTimers();
    const takeSnapshot = vi.fn();
    const setPipelineConfig = vi.fn();
    const fitView = vi.fn();

    const { result } = renderHook(() =>
      usePipelineGraph({ takeSnapshot, setPipelineConfig, fitView })
    );

    // 1. Add a PubSub source node via '+'
    act(() => {
      result.current.handleAddNode('PubSub', 'SOURCE', 'Radio', 'PubSubIO');
    });

    expect(result.current.nodes).toHaveLength(1);
    expect(result.current.nodes[0].position).toEqual({ x: 80, y: 150 });

    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(fitView).toHaveBeenCalledWith({ duration: 300, padding: 1 });

    // 2. Add a first STEP node via '+' — auto-connects to the source and lays out into column 1 (x = 380)
    fitView.mockClear();
    act(() => {
      result.current.handleAddNode('ParDo', 'STEP', 'Code', 'ParDo');
    });

    expect(result.current.nodes).toHaveLength(2);
    expect(result.current.edges).toHaveLength(1);
    expect(result.current.nodes[0].position).toEqual({ x: 80, y: 150 });
    expect(result.current.nodes[1].position).toEqual({ x: 380, y: 150 });

    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(fitView).toHaveBeenCalledWith({ duration: 300, padding: 1 });

    // 3. Add a FileIO source via '+' — spawns FileIO Match (col 0) and FileIO Read Matches (col 1) and lays out all 4 nodes
    fitView.mockClear();
    act(() => {
      result.current.handleAddNode('FileIO', 'SOURCE', 'Folder', 'FileIO');
    });

    expect(result.current.nodes).toHaveLength(4);
    expect(result.current.edges).toHaveLength(2);
    const matchNode = result.current.nodes.find((n) => n.data.beam_transform === 'FileIO.match');
    const readMatchesNode = result.current.nodes.find((n) => n.data.beam_transform === 'FileIO.readMatches');
    expect(matchNode?.position.x).toBe(80);
    expect(readMatchesNode?.position.x).toBe(380);

    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(fitView).toHaveBeenCalledWith({ duration: 300, padding: 1 });
    vi.useRealTimers();
  });
});

