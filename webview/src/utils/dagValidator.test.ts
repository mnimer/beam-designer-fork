/**
 * Unit Tests for DAG Topology Validator (Kahn's Algorithm)
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Validates 100% of the DAG topology validator functionality including simple acyclic pipelines,
 * multi-branch fan-in/fan-out graphs, 2-node cycles, 3-node cycles, self-loops, disjoint cycles,
 * orphan node detection, edge ID tracking, and Beam semantic warnings.
 */

import { describe, it, expect } from 'vitest';
import { validateDagTopology, type DagNode, type DagEdge } from './dagValidator';

describe('validateDagTopology (Kahn\'s Algorithm)', () => {
  it('returns valid for an empty graph', () => {
    const res = validateDagTopology([], []);
    expect(res.isValid).toBe(true);
    expect(res.hasCycles).toBe(false);
    expect(res.sortedNodeIds).toEqual([]);
    expect(res.cycleNodeIds).toEqual([]);
    expect(res.cycleEdgeIds).toEqual([]);
    expect(res.orphanNodeIds).toEqual([]);
    expect(res.errors).toEqual([]);
    expect(res.warnings).toEqual([]);
  });

  it('handles a single node pipeline without warnings or cycles', () => {
    const nodes: DagNode[] = [
      { id: 'src_1', type: 'pipeline', data: { label: 'PubSub Source', type: 'SOURCE' } },
    ];
    const res = validateDagTopology(nodes, []);
    expect(res.isValid).toBe(true);
    expect(res.hasCycles).toBe(false);
    expect(res.sortedNodeIds).toEqual(['src_1']);
    expect(res.orphanNodeIds).toEqual([]);
    // Single node source emits warning for missing sink
    expect(res.warnings).toContain('Pipeline has no SINK node. At least one SINK is recommended for output delivery.');
  });

  it('correctly sorts a standard linear DAG (Source -> Step -> Sink)', () => {
    const nodes: DagNode[] = [
      { id: 'src_1', type: 'pipeline', data: { label: 'BigQuery Source', type: 'SOURCE' } },
      { id: 'step_1', type: 'pipeline', data: { label: 'Filter Step', type: 'STEP' } },
      { id: 'sink_1', type: 'pipeline', data: { label: 'GCS Sink', type: 'SINK' } },
    ];
    const edges: DagEdge[] = [
      { id: 'e1', source: 'src_1', target: 'step_1' },
      { id: 'e2', source: 'step_1', target: 'sink_1' },
    ];

    const res = validateDagTopology(nodes, edges);
    expect(res.isValid).toBe(true);
    expect(res.hasCycles).toBe(false);
    expect(res.sortedNodeIds).toEqual(['src_1', 'step_1', 'sink_1']);
    expect(res.cycleNodeIds).toEqual([]);
    expect(res.cycleEdgeIds).toEqual([]);
    expect(res.orphanNodeIds).toEqual([]);
    expect(res.errors).toEqual([]);
    expect(res.warnings).toEqual([]);
  });

  it('correctly sorts fan-out and fan-in branching DAGs', () => {
    // source -> (branchA, branchB) -> merge -> sink
    const nodes: DagNode[] = [
      { id: 'src', data: { label: 'Source', type: 'SOURCE' } },
      { id: 'bA', data: { label: 'Branch A', type: 'STEP' } },
      { id: 'bB', data: { label: 'Branch B', type: 'STEP' } },
      { id: 'merge', data: { label: 'Flatten', type: 'STEP' } },
      { id: 'sink', data: { label: 'Sink', type: 'SINK' } },
    ];
    const edges: DagEdge[] = [
      { id: 'e1', source: 'src', target: 'bA' },
      { id: 'e2', source: 'src', target: 'bB' },
      { id: 'e3', source: 'bA', target: 'merge' },
      { id: 'e4', source: 'bB', target: 'merge' },
      { id: 'e5', source: 'merge', target: 'sink' },
    ];

    const res = validateDagTopology(nodes, edges);
    expect(res.isValid).toBe(true);
    expect(res.hasCycles).toBe(false);
    expect(res.sortedNodeIds[0]).toBe('src');
    expect(res.sortedNodeIds[res.sortedNodeIds.length - 1]).toBe('sink');
    expect(res.sortedNodeIds.indexOf('bA')).toBeLessThan(res.sortedNodeIds.indexOf('merge'));
    expect(res.sortedNodeIds.indexOf('bB')).toBeLessThan(res.sortedNodeIds.indexOf('merge'));
    expect(res.errors).toHaveLength(0);
  });

  it('detects a 2-node cycle (A -> B -> A) and isolates cycle nodes and edges', () => {
    const nodes: DagNode[] = [
      { id: 'node_1', data: { label: 'Step 1', type: 'STEP' } },
      { id: 'node_2', data: { label: 'Step 2', type: 'STEP' } },
    ];
    const edges: DagEdge[] = [
      { id: 'edge_1_2', source: 'node_1', target: 'node_2' },
      { id: 'edge_2_1', source: 'node_2', target: 'node_1' },
    ];

    const res = validateDagTopology(nodes, edges);
    expect(res.isValid).toBe(false);
    expect(res.hasCycles).toBe(true);
    expect(res.sortedNodeIds).toEqual([]);
    expect(res.cycleNodeIds.sort()).toEqual(['node_1', 'node_2'].sort());
    expect(res.cycleEdgeIds.sort()).toEqual(['edge_1_2', 'edge_2_1'].sort());
    expect(res.errors[0]).toContain('Cyclic dependency detected in pipeline graph');
    expect(res.cyclePathString).toContain('Step 1 (node_1)');
    expect(res.cyclePathString).toContain('Step 2 (node_2)');
  });

  it('detects a 3-node cycle (A -> B -> C -> A)', () => {
    const nodes: DagNode[] = [
      { id: 'n1', data: { label: 'Node 1', type: 'STEP' } },
      { id: 'n2', data: { label: 'Node 2', type: 'STEP' } },
      { id: 'n3', data: { label: 'Node 3', type: 'STEP' } },
    ];
    const edges: DagEdge[] = [
      { id: 'e1', source: 'n1', target: 'n2' },
      { id: 'e2', source: 'n2', target: 'n3' },
      { id: 'e3', source: 'n3', target: 'n1' },
    ];

    const res = validateDagTopology(nodes, edges);
    expect(res.isValid).toBe(false);
    expect(res.hasCycles).toBe(true);
    expect(res.sortedNodeIds).toHaveLength(0);
    expect(res.cycleNodeIds.sort()).toEqual(['n1', 'n2', 'n3'].sort());
    expect(res.cycleEdgeIds.sort()).toEqual(['e1', 'e2', 'e3'].sort());
    expect(res.errors[0]).toContain('Cyclic dependency detected');
  });

  it('detects a self-loop cycle (A -> A)', () => {
    const nodes: DagNode[] = [
      { id: 'loop_node', data: { label: 'Self Loop Step', type: 'STEP' } },
    ];
    const edges: DagEdge[] = [
      { id: 'e_self', source: 'loop_node', target: 'loop_node' },
    ];

    const res = validateDagTopology(nodes, edges);
    expect(res.isValid).toBe(false);
    expect(res.hasCycles).toBe(true);
    expect(res.cycleNodeIds).toEqual(['loop_node']);
    expect(res.cycleEdgeIds).toEqual(['e_self']);
  });

  it('detects cycles embedded within a larger acyclic graph', () => {
    // src -> c1 -> c2 -> c1, and c2 -> sink
    const nodes: DagNode[] = [
      { id: 'src', data: { label: 'Source', type: 'SOURCE' } },
      { id: 'c1', data: { label: 'Cycle 1', type: 'STEP' } },
      { id: 'c2', data: { label: 'Cycle 2', type: 'STEP' } },
      { id: 'sink', data: { label: 'Sink', type: 'SINK' } },
    ];
    const edges: DagEdge[] = [
      { id: 'e_in', source: 'src', target: 'c1' },
      { id: 'e_c1', source: 'c1', target: 'c2' },
      { id: 'e_c2', source: 'c2', target: 'c1' },
      { id: 'e_out', source: 'c2', target: 'sink' },
    ];

    const res = validateDagTopology(nodes, edges);
    expect(res.isValid).toBe(false);
    expect(res.hasCycles).toBe(true);
    expect(res.cycleNodeIds).toContain('c1');
    expect(res.cycleNodeIds).toContain('c2');
    expect(res.cycleEdgeIds).toContain('e_c1');
    expect(res.cycleEdgeIds).toContain('e_c2');
  });

  it('identifies orphan disconnected nodes as fatal topology errors', () => {
    const nodes: DagNode[] = [
      { id: 'src', data: { label: 'Source', type: 'SOURCE' } },
      { id: 'sink', data: { label: 'Sink', type: 'SINK' } },
      { id: 'orphan_1', data: { label: 'Floating Transform', type: 'STEP' } },
      { id: 'orphan_2', data: { label: 'Forgotten Step', type: 'STEP' } },
    ];
    const edges: DagEdge[] = [
      { id: 'e1', source: 'src', target: 'sink' },
    ];

    const res = validateDagTopology(nodes, edges);
    expect(res.isValid).toBe(false);
    expect(res.hasCycles).toBe(false);
    expect(res.orphanNodeIds).toEqual(['orphan_1', 'orphan_2']);
    expect(res.errors).toHaveLength(1);
    expect(res.errors[0]).toContain('Orphan node(s) detected');
    expect(res.errors[0]).toContain('"Floating Transform" (orphan_1)');
    expect(res.errors[0]).toContain('"Forgotten Step" (orphan_2)');
  });

  it('ignores dangling edges that reference non-existent node IDs', () => {
    const nodes: DagNode[] = [
      { id: 'src', data: { label: 'Source', type: 'SOURCE' } },
      { id: 'sink', data: { label: 'Sink', type: 'SINK' } },
    ];
    const edges: DagEdge[] = [
      { id: 'e1', source: 'src', target: 'sink' },
      { id: 'e_dangling', source: 'ghost_source', target: 'ghost_target' },
    ];

    const res = validateDagTopology(nodes, edges);
    expect(res.isValid).toBe(true);
    expect(res.hasCycles).toBe(false);
    expect(res.sortedNodeIds).toEqual(['src', 'sink']);
  });

  it('warns when missing source or sink', () => {
    const nodes: DagNode[] = [
      { id: 'step_only', data: { label: 'Step Only', type: 'STEP' } },
    ];
    const res = validateDagTopology(nodes, []);
    expect(res.isValid).toBe(true);
    expect(res.warnings).toContain('Pipeline has no SOURCE node. At least one SOURCE is required for execution.');
    expect(res.warnings).toContain('Pipeline has no SINK node. At least one SINK is recommended for output delivery.');
  });

  it('flags FhirIO node in readResources mode when no upstream PubSubIO node is connected', () => {
    const nodes: DagNode[] = [
      {
        id: 'fhir_1',
        data: {
          label: 'FhirIO Source',
          type: 'SOURCE',
          beam_transform: 'FhirIO',
          properties: { readMode: 'readResources' },
        },
      },
      { id: 'sink_1', data: { label: 'Log Message', type: 'SINK' } },
    ];
    const edges: DagEdge[] = [{ id: 'e1', source: 'fhir_1', target: 'sink_1' }];

    const res = validateDagTopology(nodes, edges);
    expect(res.isValid).toBe(false);
    expect(res.missingUpstreamNodeIds).toEqual(['fhir_1']);
    expect(res.errors[0]).toContain('FhirIO.readResources() on node "FhirIO Source" (fhir_1) requires an upstream PubSubIO node');
  });

  it('approves FhirIO node in readResources mode when an upstream PubSubIO node is connected', () => {
    const nodes: DagNode[] = [
      { id: 'pubsub_1', data: { label: 'PubSub', type: 'SOURCE', beam_transform: 'PubSubIO' } },
      {
        id: 'fhir_1',
        data: {
          label: 'FhirIO Source',
          type: 'SOURCE',
          beam_transform: 'FhirIO',
          properties: { readMode: 'readResources' },
        },
      },
      { id: 'sink_1', data: { label: 'Log Message', type: 'SINK' } },
    ];
    const edges: DagEdge[] = [
      { id: 'e0', source: 'pubsub_1', target: 'fhir_1' },
      { id: 'e1', source: 'fhir_1', target: 'sink_1' },
    ];

    const res = validateDagTopology(nodes, edges);
    expect(res.isValid).toBe(true);
    expect(res.missingUpstreamNodeIds).toEqual([]);
    expect(res.errors).toEqual([]);
  });

  it('flags FhirIO node in searchResources mode when an upstream PubSubIO node is still connected', () => {
    const nodes: DagNode[] = [
      { id: 'pubsub_1', data: { label: 'PubSub', type: 'SOURCE', beam_transform: 'PubSubIO' } },
      {
        id: 'fhir_1',
        data: {
          label: 'FhirIO Source',
          type: 'SOURCE',
          beam_transform: 'FhirIO',
          properties: { readMode: 'searchResources' },
        },
      },
      { id: 'sink_1', data: { label: 'Log Message', type: 'SINK' } },
    ];
    const edges: DagEdge[] = [
      { id: 'e0', source: 'pubsub_1', target: 'fhir_1' },
      { id: 'e1', source: 'fhir_1', target: 'sink_1' },
    ];

    const res = validateDagTopology(nodes, edges);
    expect(res.isValid).toBe(false);
    expect(res.invalidUpstreamNodeIds).toEqual(['fhir_1']);
    expect(res.errors[0]).toContain(
      'FhirIO.searchResources() on node "FhirIO Source" (fhir_1) does not accept an upstream connection'
    );
  });

  it('flags DicomIO node in readStudyMetadata mode when missing an upstream PubSubIO connection and passes when connected', () => {
    const dicomNode: DagNode = {
      id: 'dicom_1',
      data: {
        label: 'DicomIO Source',
        type: 'SOURCE',
        beam_transform: 'DicomIO',
        properties: { readMode: 'readStudyMetadata' },
      },
    };
    const sinkNode: DagNode = { id: 'sink_1', data: { label: 'Log Message', type: 'SINK' } };

    const missingRes = validateDagTopology([dicomNode, sinkNode], [{ id: 'e1', source: 'dicom_1', target: 'sink_1' }]);
    expect(missingRes.isValid).toBe(false);
    expect(missingRes.missingUpstreamNodeIds).toEqual(['dicom_1']);
    expect(missingRes.errors[0]).toContain(
      'DicomIO.readStudyMetadata() on node "DicomIO Source" (dicom_1) requires an upstream PubSubIO node'
    );

    const pubSubNode: DagNode = { id: 'pubsub_1', data: { label: 'PubSub', type: 'SOURCE', beam_transform: 'PubSubIO' } };
    const validRes = validateDagTopology(
      [pubSubNode, dicomNode, sinkNode],
      [
        { id: 'e0', source: 'pubsub_1', target: 'dicom_1' },
        { id: 'e1', source: 'dicom_1', target: 'sink_1' },
      ]
    );
    expect(validRes.isValid).toBe(true);
    expect(validRes.missingUpstreamNodeIds).toEqual([]);
    expect(validRes.errors).toEqual([]);
  });

  it('flags DicomIO node in dicomSearch mode when an upstream PubSubIO node is still connected', () => {
    const nodes: DagNode[] = [
      { id: 'pubsub_1', data: { label: 'PubSub', type: 'SOURCE', beam_transform: 'PubSubIO' } },
      {
        id: 'dicom_1',
        data: {
          label: 'DicomIO Source',
          type: 'SOURCE',
          beam_transform: 'DicomIO',
          properties: { readMode: 'dicomSearch' },
        },
      },
      { id: 'sink_1', data: { label: 'Log Message', type: 'SINK' } },
    ];
    const edges: DagEdge[] = [
      { id: 'e0', source: 'pubsub_1', target: 'dicom_1' },
      { id: 'e1', source: 'dicom_1', target: 'sink_1' },
    ];

    const res = validateDagTopology(nodes, edges);
    expect(res.isValid).toBe(false);
    expect(res.invalidUpstreamNodeIds).toEqual(['dicom_1']);
    expect(res.errors[0]).toContain(
      'DicomIO.dicomSearch() on node "DicomIO Source" (dicom_1) does not accept an upstream connection'
    );
  });
});

describe('validateDagTopology — ParDo side inputs (F1)', () => {
  const sourceNode: DagNode = { id: 'src', data: { label: 'PubSub', type: 'SOURCE', beam_transform: 'PubSubIO' } };
  const lookupNode: DagNode = { id: 'lookup', data: { label: 'Lookup Table', type: 'SOURCE', beam_transform: 'BigQueryIO' } };
  const sinkNode: DagNode = { id: 'sink', data: { label: 'BigQuery', type: 'SINK', beam_transform: 'BigQueryIO' } };
  const parDoNode = (sideInputs?: unknown): DagNode => ({
    id: 'pardo',
    data: { label: 'Enrich', type: 'STEP', beam_transform: 'ParDo', properties: sideInputs === undefined ? {} : { sideInputs } },
  });

  it('accepts main + side input edges on a ParDo', () => {
    const res = validateDagTopology(
      [sourceNode, lookupNode, parDoNode([{ sourceNodeId: 'lookup', variableName: 'lookupTable', viewType: 'MAP', refreshPattern: 'STATIC' }]), sinkNode],
      [
        { id: 'e1', source: 'src', target: 'pardo' },
        { id: 'e2', source: 'lookup', target: 'pardo', targetHandle: 'side_input' },
        { id: 'e3', source: 'pardo', target: 'sink', sourceHandle: 'valid' },
      ]
    );
    expect(res.isValid).toBe(true);
    expect(res.missingUpstreamNodeIds).toEqual([]);
    expect(res.sideInputMismatchNodeIds).toEqual([]);
  });

  it('flags a side-input-only ParDo in missingUpstreamNodeIds', () => {
    const res = validateDagTopology(
      [lookupNode, parDoNode(), sinkNode],
      [
        { id: 'e2', source: 'lookup', target: 'pardo', targetHandle: 'side_input' },
        { id: 'e3', source: 'pardo', target: 'sink' },
      ]
    );
    expect(res.isValid).toBe(false);
    expect(res.missingUpstreamNodeIds).toEqual(['pardo']);
    expect(res.errors[0]).toContain('only has side input connections');
  });

  it('flags stale sideInputs bindings without a matching side_input edge', () => {
    const res = validateDagTopology(
      [sourceNode, lookupNode, parDoNode([{ sourceNodeId: 'lookup', variableName: 'lookupTable', viewType: 'MAP', refreshPattern: 'STATIC' }]), sinkNode],
      [
        { id: 'e1', source: 'src', target: 'pardo' },
        { id: 'e3', source: 'pardo', target: 'sink' },
      ]
    );
    expect(res.isValid).toBe(false);
    expect(res.sideInputMismatchNodeIds).toEqual(['pardo']);
    expect(res.errors.some((e) => e.includes('without a matching side_input edge'))).toBe(true);
  });
});
