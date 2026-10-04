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

    it('flags FhirIO.readResources() when missing an upstream PubSubIO connection and passes when connected', () => {
        const fhirNode: DagNode = {
            id: 'fhir_1',
            data: {
                label: 'FhirIO Source',
                type: 'SOURCE',
                beam_transform: 'FhirIO',
                properties: { readMode: 'readResources' },
            },
        };
        const sinkNode: DagNode = { id: 'sink_1', data: { label: 'Sink', type: 'SINK' } };

        const invalidRes = validateDagTopology([fhirNode, sinkNode], [{ id: 'e1', source: 'fhir_1', target: 'sink_1' }]);
        expect(invalidRes.isValid).toBe(false);
        expect(invalidRes.missingUpstreamNodeIds).toEqual(['fhir_1']);
        expect(invalidRes.errors[0]).toContain('requires an upstream PubSubIO node');

        const pubSubNode: DagNode = { id: 'pubsub_1', data: { label: 'PubSub', type: 'SOURCE', beam_transform: 'PubSubIO' } };
        const validRes = validateDagTopology(
            [pubSubNode, fhirNode, sinkNode],
            [
                { id: 'e0', source: 'pubsub_1', target: 'fhir_1' },
                { id: 'e1', source: 'fhir_1', target: 'sink_1' },
            ]
        );
        expect(validRes.isValid).toBe(true);
        expect(validRes.missingUpstreamNodeIds).toEqual([]);

        const fhirSearchNode: DagNode = {
            ...fhirNode,
            data: { ...fhirNode.data, properties: { readMode: 'searchResources' } },
        };
        const invalidUpstreamRes = validateDagTopology(
            [pubSubNode, fhirSearchNode, sinkNode],
            [
                { id: 'e0', source: 'pubsub_1', target: 'fhir_1' },
                { id: 'e1', source: 'fhir_1', target: 'sink_1' },
            ]
        );
        expect(invalidUpstreamRes.isValid).toBe(false);
        expect(invalidUpstreamRes.invalidUpstreamNodeIds).toEqual(['fhir_1']);
        expect(invalidUpstreamRes.errors[0]).toContain('FhirIO.searchResources() on node "FhirIO Source" (fhir_1) does not accept an upstream connection');
    });

    it('flags DicomIO.readStudyMetadata() when missing an upstream PubSubIO connection and flags dicomSearch when still connected', () => {
        const dicomNode: DagNode = {
            id: 'dicom_1',
            data: {
                label: 'DicomIO Source',
                type: 'SOURCE',
                beam_transform: 'DicomIO',
                properties: { readMode: 'readStudyMetadata' },
            },
        };
        const sinkNode: DagNode = { id: 'sink_1', data: { label: 'Sink', type: 'SINK' } };

        const missingRes = validateDagTopology([dicomNode, sinkNode], [{ id: 'e1', source: 'dicom_1', target: 'sink_1' }]);
        expect(missingRes.isValid).toBe(false);
        expect(missingRes.missingUpstreamNodeIds).toEqual(['dicom_1']);
        expect(missingRes.errors[0]).toContain('DicomIO.readStudyMetadata() on node "DicomIO Source" (dicom_1) requires an upstream PubSubIO node');

        const pubSubNode: DagNode = { id: 'pubsub_1', data: { label: 'PubSub', type: 'SOURCE', beam_transform: 'PubSubIO' } };
        const validRes = validateDagTopology(
            [pubSubNode, dicomNode, sinkNode],
            [
                { id: 'e0', source: 'pubsub_1', target: 'dicom_1' },
                { id: 'e1', source: 'dicom_1', target: 'sink_1' },
            ]
        );
        expect(validRes.isValid).toBe(true);

        const dicomSearchNode: DagNode = {
            ...dicomNode,
            data: { ...dicomNode.data, properties: { readMode: 'dicomSearch' } },
        };
        const invalidUpstreamRes = validateDagTopology(
            [pubSubNode, dicomSearchNode, sinkNode],
            [
                { id: 'e0', source: 'pubsub_1', target: 'dicom_1' },
                { id: 'e1', source: 'dicom_1', target: 'sink_1' },
            ]
        );
        expect(invalidUpstreamRes.isValid).toBe(false);
        expect(invalidUpstreamRes.invalidUpstreamNodeIds).toEqual(['dicom_1']);
        expect(invalidUpstreamRes.errors[0]).toContain('DicomIO.dicomSearch() on node "DicomIO Source" (dicom_1) does not accept an upstream connection');
    });
});

describe('Extension Host validateDagTopology — ParDo side inputs (F1)', () => {
    const sourceNode: DagNode = { id: 'src', data: { label: 'PubSub', type: 'SOURCE', beam_transform: 'PubSubIO' } };
    const lookupNode: DagNode = { id: 'lookup', data: { label: 'Lookup Table', type: 'SOURCE', beam_transform: 'BigQueryIO' } };
    const sinkNode: DagNode = { id: 'sink', data: { label: 'BigQuery', type: 'SINK', beam_transform: 'BigQueryIO' } };

    const parDoNode = (sideInputs?: unknown): DagNode => ({
        id: 'pardo',
        data: {
            label: 'Enrich',
            type: 'STEP',
            beam_transform: 'ParDo',
            properties: sideInputs === undefined ? {} : { sideInputs },
        },
    });

    it('approves a ParDo with a main input and a side input edge', () => {
        const edges: DagEdge[] = [
            { id: 'e1', source: 'src', target: 'pardo' },
            { id: 'e2', source: 'lookup', target: 'pardo', targetHandle: 'side_input' },
            { id: 'e3', source: 'pardo', target: 'sink', sourceHandle: 'valid' },
        ];
        const res = validateDagTopology(
            [sourceNode, lookupNode, parDoNode([{ sourceNodeId: 'lookup', variableName: 'lookupTable', viewType: 'MAP', refreshPattern: 'STATIC' }]), sinkNode],
            edges
        );
        expect(res.isValid).toBe(true);
        expect(res.missingUpstreamNodeIds).toEqual([]);
        expect(res.sideInputMismatchNodeIds).toEqual([]);
        expect(res.sortedNodeIds.indexOf('lookup')).toBeLessThan(res.sortedNodeIds.indexOf('pardo'));
    });

    it('treats an explicit targetHandle "main" as the primary input', () => {
        const edges: DagEdge[] = [
            { id: 'e1', source: 'src', target: 'pardo', targetHandle: 'main' },
            { id: 'e2', source: 'lookup', target: 'pardo', targetHandle: 'side_input' },
            { id: 'e3', source: 'pardo', target: 'sink' },
        ];
        const res = validateDagTopology([sourceNode, lookupNode, parDoNode(), sinkNode], edges);
        expect(res.isValid).toBe(true);
        expect(res.missingUpstreamNodeIds).toEqual([]);
    });

    it('flags a ParDo that only has side input edges as missing its main input', () => {
        const edges: DagEdge[] = [
            { id: 'e2', source: 'lookup', target: 'pardo', targetHandle: 'side_input' },
            { id: 'e3', source: 'pardo', target: 'sink' },
        ];
        const res = validateDagTopology([lookupNode, parDoNode(), sinkNode], edges);
        expect(res.isValid).toBe(false);
        expect(res.missingUpstreamNodeIds).toEqual(['pardo']);
        expect(res.errors[0]).toContain('ParDo node "Enrich" (pardo) only has side input connections');
    });

    it('does not flag a ParDo with no incoming edges at all as side-input-only (orphan rules apply instead)', () => {
        const res = validateDagTopology(
            [sourceNode, parDoNode(), sinkNode],
            [{ id: 'e1', source: 'src', target: 'sink' }]
        );
        expect(res.missingUpstreamNodeIds).toEqual([]);
        expect(res.orphanNodeIds).toEqual(['pardo']);
    });

    it('flags configured sideInputs that have no matching side_input edge', () => {
        const edges: DagEdge[] = [
            { id: 'e1', source: 'src', target: 'pardo' },
            { id: 'e3', source: 'pardo', target: 'sink' },
        ];
        const res = validateDagTopology(
            [sourceNode, lookupNode, parDoNode([{ sourceNodeId: 'lookup', sourceLabel: 'Lookup Table', variableName: 'lookupTable', viewType: 'MAP', refreshPattern: 'STATIC' }]), sinkNode],
            edges
        );
        expect(res.isValid).toBe(false);
        expect(res.sideInputMismatchNodeIds).toEqual(['pardo']);
        expect(res.errors.some((e) => e.includes('configures side input(s) lookupTable ("Lookup Table" lookup) without a matching side_input edge'))).toBe(true);
    });

    it('flags configured sideInputs that reference a deleted upstream node', () => {
        const edges: DagEdge[] = [
            { id: 'e1', source: 'src', target: 'pardo' },
            { id: 'e2', source: 'ghost', target: 'pardo', targetHandle: 'side_input' }, // dangling edge to a deleted node
            { id: 'e3', source: 'pardo', target: 'sink' },
        ];
        const res = validateDagTopology(
            [sourceNode, parDoNode([{ sourceNodeId: 'ghost', variableName: 'ghostView', viewType: 'SINGLETON', refreshPattern: 'STATIC' }]), sinkNode],
            edges
        );
        expect(res.isValid).toBe(false);
        expect(res.sideInputMismatchNodeIds).toEqual(['pardo']);
    });

    it('ignores side-input rules for non-ParDo steps and malformed sideInputs values', () => {
        const mapNode: DagNode = { id: 'map', data: { label: 'Map', type: 'STEP', beam_transform: 'Map', properties: { sideInputs: [{ sourceNodeId: 'nope' }] } } };
        const edges: DagEdge[] = [
            { id: 'e1', source: 'src', target: 'map' },
            { id: 'e2', source: 'map', target: 'sink' },
        ];
        const res = validateDagTopology([sourceNode, mapNode, sinkNode], edges);
        expect(res.isValid).toBe(true);
        expect(res.sideInputMismatchNodeIds).toEqual([]);

        const malformed = validateDagTopology(
            [sourceNode, parDoNode('not-an-array'), sinkNode],
            [{ id: 'e1', source: 'src', target: 'pardo' }, { id: 'e2', source: 'pardo', target: 'sink' }]
        );
        expect(malformed.isValid).toBe(true);
    });
});
