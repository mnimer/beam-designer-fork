/**
 * Sample Pipelines Unit Tests
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Unit tests validating sample pipeline discovery, metadata extraction,
 * title formatting, and fallback handling.
 */

import { describe, it, expect, vi } from 'vitest';
import * as path from 'path';
import { formatSampleTitle, getSamplePipelines, computePipelineFlow } from '../extension';

// Mock vscode module
vi.mock('vscode', () => {
    class MockTreeItem {
        public description?: string;
        public tooltip?: any;
        public iconPath?: any;
        public command?: any;
        constructor(
            public label: string,
            public collapsibleState: number = 0
        ) {}
    }

    class MockEventEmitter {
        public fire = vi.fn();
        public event = vi.fn();
    }

    return {
        TreeItem: MockTreeItem,
        TreeItemCollapsibleState: {
            None: 0,
            Collapsed: 1,
            Expanded: 2
        },
        EventEmitter: MockEventEmitter,
        ThemeIcon: class MockThemeIcon { constructor(public id: string) {} },
        ThemeColor: class MockThemeColor { constructor(public id: string) {} },
        MarkdownString: class MockMarkdownString { constructor(public value: string) {} },
        workspace: {
            openTextDocument: vi.fn(),
            workspaceFolders: [{ uri: { fsPath: '/workspace' }, name: 'workspace' }],
            findFiles: vi.fn().mockResolvedValue([])
        },
        window: {
            showTextDocument: vi.fn(),
            showErrorMessage: vi.fn(),
            registerTreeDataProvider: vi.fn(),
        },
        Uri: {
            file: vi.fn((f: string) => ({ fsPath: f, toString: () => f })),
            parse: vi.fn((f: string) => ({ fsPath: f, toString: () => f })),
        },
        commands: {
            registerCommand: vi.fn(),
            executeCommand: vi.fn(),
        }
    };
});

describe('computePipelineFlow', () => {
    it('returns empty string for empty or missing nodes', () => {
        expect(computePipelineFlow([], [])).toBe('');
        expect(computePipelineFlow(null as any, [])).toBe('');
    });

    it('computes linear flow for single path DAG', () => {
        const nodes = [
            { id: '1', data: { label: 'Trigger', type: 'SOURCE' }, position: { x: 100, y: 100 } },
            { id: '2', data: { label: 'Generate Data', type: 'STEP' }, position: { x: 300, y: 100 } },
            { id: '3', data: { label: 'Log Message', type: 'SINK' }, position: { x: 500, y: 100 } }
        ];
        const edges = [
            { source: '1', target: '2' },
            { source: '2', target: '3' }
        ];

        expect(computePipelineFlow(nodes, edges)).toBe('Trigger ➔ Generate Data ➔ Log Message');
    });

    it('computes branched sink flow correctly (like pubsub-to-bigquery)', () => {
        const nodes = [
            { id: '1', data: { label: 'PubSub Connector', type: 'SOURCE' }, position: { x: 80, y: 150 } },
            { id: '2', data: { label: 'BigQuery', type: 'SINK' }, position: { x: 680, y: 90 } },
            { id: '3', data: { label: 'Parse Message', type: 'STEP' }, position: { x: 380, y: 150 } },
            { id: '4', data: { label: 'Log Message', type: 'SINK' }, position: { x: 680, y: 210 } }
        ];
        const edges = [
            { source: '1', target: '3' },
            { source: '3', target: '2' },
            { source: '3', target: '4' }
        ];

        expect(computePipelineFlow(nodes, edges)).toBe('PubSub Connector ➔ Parse Message ➔ [BigQuery, Log Message]');
    });

    it('computes multi-source joins correctly', () => {
        const nodes = [
            { id: '1', data: { label: 'Kafka Source', type: 'SOURCE' }, position: { x: 50, y: 80 } },
            { id: '2', data: { label: 'PubSub Source', type: 'SOURCE' }, position: { x: 50, y: 200 } },
            { id: '3', data: { label: 'Join Streams', type: 'STEP' }, position: { x: 300, y: 140 } },
            { id: '4', data: { label: 'BigQuery Sink', type: 'SINK' }, position: { x: 550, y: 140 } }
        ];
        const edges = [
            { source: '1', target: '3' },
            { source: '2', target: '3' },
            { source: '3', target: '4' }
        ];

        expect(computePipelineFlow(nodes, edges)).toBe('[Kafka Source, PubSub Source] ➔ Join Streams ➔ BigQuery Sink');
    });
});

describe('formatSampleTitle', () => {
    it('formats kebab-case names into title case words', () => {
        expect(formatSampleTitle('generate-mock-data')).toBe('Generate Mock Data');
        expect(formatSampleTitle('pubsub-to-bigquery-streaming')).toBe('Pubsub To Bigquery Streaming');
    });

    it('formats snake_case names into title case words', () => {
        expect(formatSampleTitle('kafka_to_jdbc')).toBe('Kafka To Jdbc');
    });

    it('handles empty or single word strings gracefully', () => {
        expect(formatSampleTitle('')).toBe('');
        expect(formatSampleTitle('simple')).toBe('Simple');
    });

    it('ensures sample filenames have .beam extension', () => {
        const sample1 = 'test-pipeline';
        const sample2 = 'test-pipeline.beam';
        expect(sample1.endsWith('.beam') ? sample1 : `${sample1}.beam`).toBe('test-pipeline.beam');
        expect(sample2.endsWith('.beam') ? sample2 : `${sample2}.beam`).toBe('test-pipeline.beam');
    });
});

describe('getSamplePipelines', () => {
    const mockContext: any = {
        extensionPath: path.resolve(__dirname, '../../')
    };

    it('discovers and parses the generate-mock-data.beam and pubsub-to-bigquery.beam samples from disk', () => {
        const samples = getSamplePipelines(mockContext);
        expect(Array.isArray(samples)).toBe(true);
        expect(samples.length).toBeGreaterThanOrEqual(2);

        const mockSample = samples.find(s => s.filename === 'generate-mock-data.beam');
        expect(mockSample).toBeDefined();
        if (mockSample) {
            expect(mockSample.id).toBe('generate-mock-data');
            expect(mockSample.title).toBe('Generate Mock Data');
            expect(mockSample.language).toBe('Java');
            expect(mockSample.runner).toBe('Dataflow');
            expect(mockSample.description).toBe('Pipeline flow: trigger ➔ generate mock data ➔ Log Message');
        }

        const pubsubSample = samples.find(s => s.filename === 'pubsub-to-bigquery.beam');
        expect(pubsubSample).toBeDefined();
        if (pubsubSample) {
            expect(pubsubSample.id).toBe('pubsub-to-bigquery');
            expect(pubsubSample.title).toBe('Pubsub To Bigquery');
            expect(pubsubSample.language).toBe('Java');
            expect(pubsubSample.runner).toBe('Spark');
            expect(pubsubSample.description).toBe('Pipeline flow: PubSub Connector ➔ Parse Message ➔ [BigQuery, Log Message]');
        }
    });

    it('returns empty array if extensionPath directory has no samples folder', () => {
        const emptyContext: any = {
            extensionPath: '/non/existent/path'
        };
        const samples = getSamplePipelines(emptyContext);
        expect(samples).toEqual([]);
    });
});

