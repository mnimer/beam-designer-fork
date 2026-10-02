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
import { formatSampleTitle, getSamplePipelines, computePipelineFlow } from '../../extension';

// Mock vscode module
vi.mock('vscode', async () => (await import('./helpers/vscodeMock')).createVscodeMock());

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
});

describe('getSamplePipelines', () => {
    const mockContext: any = {
        extensionPath: path.resolve(__dirname, '../../../')
    };

    it('discovers and parses the generate-mock-data.beam and pubsub-to-bigquery.beam samples from disk', async () => {
        const samples = await getSamplePipelines(mockContext);
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
});

