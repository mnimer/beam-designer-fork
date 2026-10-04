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
import { usePipelineGraph, type PipelineNode } from './usePipelineGraph';

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

  it('keeps both nodes when adding two nodes back-to-back in the same act()', () => {
    const takeSnapshot = vi.fn();
    const setPipelineConfig = vi.fn();

    const { result } = renderHook(() =>
      usePipelineGraph({ takeSnapshot, setPipelineConfig })
    );

    act(() => {
      result.current.handleAddNode('Source 1', 'SOURCE', 'Radio');
      result.current.handleAddNode('Source 2', 'SOURCE', 'Radio');
    });

    expect(result.current.nodes).toHaveLength(2);
    expect(result.current.nodes.map((n) => n.data.label)).toEqual(['Source 1', 'Source 2']);
    expect(result.current.nodes[0].id).not.toBe(result.current.nodes[1].id);
  });

  it('keeps all nodes and edges when adding a regular node and a FileIO pair back-to-back in the same act()', () => {
    const takeSnapshot = vi.fn();
    const setPipelineConfig = vi.fn();

    const { result } = renderHook(() =>
      usePipelineGraph({ takeSnapshot, setPipelineConfig })
    );

    act(() => {
      result.current.handleAddNode('PubSub', 'SOURCE', 'Radio', 'PubSubIO');
      result.current.handleAddNode('FileIO', 'SOURCE', 'Folder', 'FileIO');
    });

    // 1 PubSub + 2 FileIO nodes = 3 nodes
    expect(result.current.nodes).toHaveLength(3);
    const ids = new Set(result.current.nodes.map((n) => n.id));
    expect(ids.size).toBe(3);
    expect(result.current.edges).toHaveLength(1);
  });
});


describe('usePipelineGraph — ParDo side inputs (F1)', () => {
  const baseNodes = (): PipelineNode[] => [
    { id: 'src', type: 'pipeline', position: { x: 0, y: 0 }, data: { label: 'PubSub', type: 'SOURCE', iconName: 'Radio', beam_transform: 'PubSubIO' } },
    { id: 'lookup', type: 'pipeline', position: { x: 0, y: 200 }, data: { label: 'Lookup Table', type: 'SOURCE', iconName: 'Database', beam_transform: 'BigQueryIO' } },
    { id: 'pardo', type: 'pipeline', position: { x: 300, y: 0 }, data: { label: 'Enrich', type: 'STEP', iconName: 'Code', beam_transform: 'ParDo', properties: {} } },
    { id: 'map', type: 'pipeline', position: { x: 300, y: 200 }, data: { label: 'Map', type: 'STEP', iconName: 'Code', beam_transform: 'Map', properties: {} } },
    { id: 'sink', type: 'pipeline', position: { x: 600, y: 0 }, data: { label: 'BigQuery', type: 'SINK', iconName: 'Database', beam_transform: 'BigQueryIO' } },
  ];

  const setup = () => {
    const takeSnapshot = vi.fn();
    const setPipelineConfig = vi.fn();
    const hook = renderHook(() => usePipelineGraph({ takeSnapshot, setPipelineConfig }));
    act(() => {
      hook.result.current.setNodes(baseNodes());
    });
    return { ...hook, takeSnapshot, setPipelineConfig };
  };

  it('isValidConnection only accepts side_input connections on ParDo targets', () => {
    const { result } = setup();
    expect(result.current.isValidConnection({ source: 'lookup', target: 'pardo', sourceHandle: null, targetHandle: 'side_input' })).toBe(true);
    expect(result.current.isValidConnection({ source: 'lookup', target: 'map', sourceHandle: null, targetHandle: 'side_input' })).toBe(false);
  });

  it('auto-creates a sideInputs binding when an edge connects to the side_input handle', () => {
    const { result } = setup();

    act(() => {
      result.current.onConnect({ source: 'src', target: 'pardo', sourceHandle: null, targetHandle: null });
      result.current.onConnect({ source: 'lookup', target: 'pardo', sourceHandle: null, targetHandle: 'side_input' });
    });

    const pardo = result.current.nodes.find((n) => n.id === 'pardo')!;
    expect(pardo.data.properties?.sideInputs).toEqual([
      expect.objectContaining({
        sourceNodeId: 'lookup',
        sourceLabel: 'Lookup Table',
        variableName: 'lookupTable',
        viewType: 'SINGLETON',
        refreshPattern: 'STATIC',
      }),
    ]);
    // Non-ParDo nodes are never touched
    expect(result.current.nodes.find((n) => n.id === 'map')!.data.properties?.sideInputs).toBeUndefined();
  });

  it('removes the binding when the side_input edge is deleted and preserves user config for surviving bindings', () => {
    const { result } = setup();

    act(() => {
      result.current.setEdges([
        { id: 'e-main', source: 'src', target: 'pardo' },
        { id: 'e-side', source: 'lookup', target: 'pardo', targetHandle: 'side_input' },
      ]);
    });
    expect(result.current.nodes.find((n) => n.id === 'pardo')!.data.properties?.sideInputs).toHaveLength(1);

    // User customises the binding through the property panel
    act(() => {
      result.current.handleApplyProperties('pardo', {
        sideInputs: [
          { sourceNodeId: 'lookup', sourceLabel: 'Lookup Table', variableName: 'rates', viewType: 'MAP', hasDefaultValue: false, defaultValue: '', refreshPattern: 'STATIC', updateIntervalSeconds: 3600 },
        ],
      });
    });
    expect(result.current.nodes.find((n) => n.id === 'pardo')!.data.properties?.sideInputs[0]).toMatchObject({ variableName: 'rates', viewType: 'MAP' });

    // Edge removal → binding dropped
    act(() => {
      result.current.setEdges((eds) => eds.filter((e) => e.id !== 'e-side'));
    });
    expect(result.current.nodes.find((n) => n.id === 'pardo')!.data.properties?.sideInputs).toEqual([]);
  });

  it('refreshes sourceLabel when the upstream node is renamed', () => {
    const { result } = setup();
    act(() => {
      result.current.setEdges([
        { id: 'e-main', source: 'src', target: 'pardo' },
        { id: 'e-side', source: 'lookup', target: 'pardo', targetHandle: 'side_input' },
      ]);
    });
    act(() => {
      result.current.handleNodeLabelChange('lookup', 'FX Rates');
    });
    expect(result.current.nodes.find((n) => n.id === 'pardo')!.data.properties?.sideInputs[0]).toMatchObject({
      sourceLabel: 'FX Rates',
      variableName: 'lookupTable', // identifier is user-owned and must not be regenerated on rename
    });
  });

  it('renders side_input edges dashed with a "side" label and leaves main edges untouched', () => {
    const { result } = setup();
    act(() => {
      result.current.setEdges([
        { id: 'e-main', source: 'src', target: 'pardo' },
        { id: 'e-side', source: 'lookup', target: 'pardo', targetHandle: 'side_input' },
        { id: 'e-out', source: 'pardo', target: 'sink', sourceHandle: 'valid' },
      ]);
    });

    const side = result.current.displayEdges.find((e) => e.id === 'e-side')!;
    expect(side.style).toMatchObject({ strokeDasharray: '5 4', stroke: '#facc15' });
    expect(side.label).toBe('side');

    const main = result.current.displayEdges.find((e) => e.id === 'e-main')!;
    expect(main.style?.strokeDasharray).toBeUndefined();
    expect(main.label).toBeUndefined();
  });

  it('flags a side-input-only ParDo with a ParDo-specific validation error', () => {
    const { result } = setup();
    act(() => {
      result.current.setEdges([
        { id: 'e-side', source: 'lookup', target: 'pardo', targetHandle: 'side_input' },
        { id: 'e-out', source: 'pardo', target: 'sink', sourceHandle: 'valid' },
        { id: 'e-src', source: 'src', target: 'map' },
        { id: 'e-map', source: 'map', target: 'sink' },
      ]);
    });

    expect(result.current.dagValidation.missingUpstreamNodeIds).toEqual(['pardo']);
    const pardo = result.current.displayNodes.find((n) => n.id === 'pardo')!;
    expect(pardo.data.hasValidationError).toBe(true);
    expect(pardo.data.validationError).toContain('only has side input connections');
  });
});
