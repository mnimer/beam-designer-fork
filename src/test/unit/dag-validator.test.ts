/**
 * Unit Tests for Extension Host DAG Validator
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Tests that validateDagTopology functions properly in the extension host environment,
 * preventing cyclic topologies from reaching code generation.
 */

import { describe, it, expect } from 'vitest';
import { validateDagTopology, type DagNode, type DagEdge } from '../../dagValidator';

describe('Extension Host validateDagTopology', () => {
    it('approves a valid pipeline graph', () => {
        const nodes: DagNode[] = [
            { id: 'src', data: { label: 'PubSub', type: 'SOURCE' } },
            { id: 'step', data: { label: 'Transform', type: 'STEP' } },
            { id: 'sink', data: { label: 'BigQuery', type: 'SINK' } },
        ];
        const edges: DagEdge[] = [
            { id: 'e1', source: 'src', target: 'step' },
            { id: 'e2', source: 'step', target: 'sink' },
        ];

        const res = validateDagTopology(nodes, edges);
        expect(res.isValid).toBe(true);
        expect(res.hasCycles).toBe(false);
        expect(res.sortedNodeIds).toEqual(['src', 'step', 'sink']);
        expect(res.errors).toHaveLength(0);
    });

    it('rejects a cyclic pipeline graph and returns cycle node IDs', () => {
        const nodes: DagNode[] = [
            { id: 'n1', data: { label: 'Step 1', type: 'STEP' } },
            { id: 'n2', data: { label: 'Step 2', type: 'STEP' } },
        ];
        const edges: DagEdge[] = [
            { id: 'e1', source: 'n1', target: 'n2' },
            { id: 'e2', source: 'n2', target: 'n1' },
        ];

        const res = validateDagTopology(nodes, edges);
        expect(res.isValid).toBe(false);
        expect(res.hasCycles).toBe(true);
        expect(res.cycleNodeIds.sort()).toEqual(['n1', 'n2'].sort());
        expect(res.errors[0]).toContain('Cyclic dependency detected');
    });

    it('identifies disconnected orphan components as fatal topology errors', () => {
        const nodes: DagNode[] = [
            { id: 's1', data: { label: 'Source', type: 'SOURCE' } },
            { id: 's2', data: { label: 'Sink', type: 'SINK' } },
            { id: 'orphan', data: { label: 'Unconnected', type: 'STEP' } },
        ];
        const edges: DagEdge[] = [
            { id: 'e1', source: 's1', target: 's2' },
        ];

        const res = validateDagTopology(nodes, edges);
        expect(res.isValid).toBe(false);
        expect(res.orphanNodeIds).toEqual(['orphan']);
        expect(res.errors).toHaveLength(1);
        expect(res.errors[0]).toContain('Orphan node(s) detected');
    });
});
