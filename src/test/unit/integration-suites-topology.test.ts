/**
 * Integration Test Suites Topology & Schema Unit Test
 *
 * Validates that all generated .beam DAG files across:
 * - src/integration/sources/agent-engine & cloud-run
 * - src/integration/sinks/agent-engine & cloud-run
 * - src/integration/steps/agent-engine & cloud-run
 *
 * strictly adhere to topological DAG rules via Kahn's algorithm (0 cycles, 0 orphans, valid edges),
 * enforce the required pipeline patterns, and achieve 100% coverage across all 31 Step Node Types.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import { validateDagTopology, DagNode, DagEdge } from '../../dagValidator';

interface BeamFileContent {
    nodes: DagNode[];
    edges: DagEdge[];
    runtimeVariables?: { key: string; value: string }[];
    jobConfig?: Record<string, unknown>;
    pipelineConfig?: Record<string, unknown>;
}

function getBeamFiles(dir: string): string[] {
    if (!fs.existsSync(dir)) return [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    let files: string[] = [];
    for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) {
            files = files.concat(getBeamFiles(full));
        } else if (e.isFile() && e.name.endsWith('.beam')) {
            files.push(full);
        }
    }
    return files;
}

describe('Integration Suites DAG Topology and Pattern Verification', () => {
    const integrationDir = path.resolve(__dirname, '../integration');
    const splitBeamFiles = [
        ...getBeamFiles(path.join(integrationDir, 'sources')),
        ...getBeamFiles(path.join(integrationDir, 'sinks')),
        ...getBeamFiles(path.join(integrationDir, 'steps')),
    ];

    it('contains all expected 130 integration .beam files across sources, sinks, and steps', () => {
        expect(splitBeamFiles.length).toBe(130);
    });

    it('validates every .beam file passes Kahn algorithm with 0 cycles and 0 orphans', () => {
        for (const filePath of splitBeamFiles) {
            const content = fs.readFileSync(filePath, 'utf-8');
            const parsed = yaml.parse(content) as BeamFileContent;
            expect(parsed, `Failed to parse YAML: ${filePath}`).toBeDefined();
            expect(Array.isArray(parsed.nodes), `Nodes missing in ${filePath}`).toBe(true);
            expect(Array.isArray(parsed.edges), `Edges missing in ${filePath}`).toBe(true);

            const result = validateDagTopology(parsed.nodes, parsed.edges);
            expect(result.isValid, `DAG invalid in ${filePath}: ${result.errors.join(', ')}`).toBe(true);
            expect(result.hasCycles, `Cycle detected in ${filePath}`).toBe(false);
            expect(result.orphanNodeIds.length, `Orphan nodes in ${filePath}`).toBe(0);
        }
    });

    it('enforces properties-only policy (no system_instructions on SOURCE, SINK, or non-ParDo STEP nodes)', () => {
        for (const filePath of splitBeamFiles) {
            const parsed = yaml.parse(fs.readFileSync(filePath, 'utf-8')) as BeamFileContent;
            for (const node of parsed.nodes) {
                const isParDo = node.data?.type === 'STEP' && node.data?.beam_transform === 'ParDo';
                if (!isParDo) {
                    expect(node.data?.system_instructions, `Unexpected system_instructions on ${node.id} in ${filePath}`).toBeUndefined();
                }
            }
        }
    });

    it('enforces SOURCE tests follow IO Connector -> ParDo -> Log Message pattern', () => {
        const sourceDirs = [
            path.join(integrationDir, 'sources', 'agent-engine'),
            path.join(integrationDir, 'sources', 'cloud-run')
        ];
        for (const dir of sourceDirs) {
            const files = getBeamFiles(dir);
            expect(files.length).toBe(29);
            for (const file of files) {
                const parsed = yaml.parse(fs.readFileSync(file, 'utf-8')) as BeamFileContent;
                expect(parsed.nodes.length, `Expected 3 nodes in ${file}`).toBe(3);
                expect(parsed.nodes[0].data?.type).toBe('SOURCE');
                expect(parsed.nodes[1].data?.beam_transform).toBe('ParDo');
                expect(parsed.nodes[2].data?.beam_transform).toBe('LogMessage');
                expect(parsed.nodes[2].data?.type).toBe('SINK');

                expect(parsed.edges.length).toBe(2);
                expect(parsed.edges[0].source).toBe(parsed.nodes[0].id);
                expect(parsed.edges[0].target).toBe(parsed.nodes[1].id);
                expect(parsed.edges[1].source).toBe(parsed.nodes[1].id);
                expect(parsed.edges[1].target).toBe(parsed.nodes[2].id);
            }
        }
    });

    it('enforces SINK tests follow Create/GenerateSequence -> ParDo -> IO Connector pattern', () => {
        const sinkDirs = [
            path.join(integrationDir, 'sinks', 'agent-engine'),
            path.join(integrationDir, 'sinks', 'cloud-run')
        ];
        for (const dir of sinkDirs) {
            const files = getBeamFiles(dir);
            expect(files.length).toBe(27);
            for (const file of files) {
                const parsed = yaml.parse(fs.readFileSync(file, 'utf-8')) as BeamFileContent;
                expect(parsed.nodes.length, `Expected 3 nodes in ${file}`).toBe(3);
                const sourceTransform = parsed.nodes[0].data?.beam_transform;
                expect(['Create', 'GenerateSequence']).toContain(sourceTransform);
                expect(parsed.nodes[1].data?.beam_transform).toBe('ParDo');
                expect(parsed.nodes[2].data?.type).toBe('SINK');

                expect(parsed.edges.length).toBe(2);
                expect(parsed.edges[0].source).toBe(parsed.nodes[0].id);
                expect(parsed.edges[0].target).toBe(parsed.nodes[1].id);
                expect(parsed.edges[1].source).toBe(parsed.nodes[1].id);
                expect(parsed.edges[1].target).toBe(parsed.nodes[2].id);
            }
        }
    });

    it('achieves 100% coverage across all 31 Step Node Types in steps/ test suites', () => {
        const ALL_31_STEP_TRANSFORMS = [
            'ParDo', 'ParseMessage', 'WithTimestamps', 'Filter', 'FlatMap',
            'Keys', 'KVMapper', 'KvSwap', 'Map', 'ToString', 'Values',
            'ApproximateQuantiles', 'ApproximateUnique', 'BatchElements', 'CoGroupByKey',
            'Combine', 'CombineWithContext', 'Count', 'Distinct', 'GroupByKey',
            'GroupIntoBatches', 'Latest', 'Max', 'Mean', 'Min', 'Sample', 'Sum', 'Top',
            'WindowInto', 'Flatten', 'Reshuffle'
        ];

        const stepDir = path.join(integrationDir, 'steps', 'agent-engine');
        const files = getBeamFiles(stepDir);
        expect(files.length).toBe(9);

        const found = new Set<string>();
        for (const file of files) {
            const parsed = yaml.parse(fs.readFileSync(file, 'utf-8')) as BeamFileContent;
            for (const n of parsed.nodes) {
                if (n.data?.beam_transform && ALL_31_STEP_TRANSFORMS.includes(n.data.beam_transform)) {
                    found.add(n.data.beam_transform);
                }
            }
        }

        expect(found.size).toBe(ALL_31_STEP_TRANSFORMS.length);
        for (const transform of ALL_31_STEP_TRANSFORMS) {
            expect(found.has(transform), `Missing step transform: ${transform}`).toBe(true);
        }
    });
});
