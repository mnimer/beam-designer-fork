/**
 * GenerateSequence to PubSubIO with Fixed Windowing Integration Test
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Validates end-to-end code generation for synthetic streaming Apache Beam pipelines
 * connecting GenerateSequence source, WithTimestamps event-time assignment, 60s Fixed Windowing,
 * KVMapper, GroupByKey, Sum aggregation, and PubSubIO sink.
 * Specifically validates that unbounded streams apply explicit windowing before GroupByKey
 * to avoid Beam runtime grouping exceptions.
 * Evaluates generated code using the Multi-Agent Evaluation Harness.
 *
 * Loads pipeline definition from sidecar file: generatesequence-pubsub-fixed.beam
 */

import { describe, it, expect } from 'vitest';
import { runPipelineIntegrationTest, loadBeamPipeline } from './codegen-runner';

const GENERATE_SEQUENCE_PUBSUB_BEAM = loadBeamPipeline('generatesequence-pubsub-fixed.beam');

describe('GenerateSequence to PubSubIO Fixed Windowing Pipeline Code Generation', () => {
    it('generates valid Java pipeline and passes Gemini evaluation', async () => {
        const results = await runPipelineIntegrationTest({
            testName: 'GenerateSequence-PubSub-Fixed (Java)',
            beamContent: GENERATE_SEQUENCE_PUBSUB_BEAM,
            languages: ['Java']
        });
        expect(results.Java).toBe(true);
    }, 180000);

    it('generates valid Python pipeline and passes Gemini evaluation', async () => {
        const results = await runPipelineIntegrationTest({
            testName: 'GenerateSequence-PubSub-Fixed (Python)',
            beamContent: GENERATE_SEQUENCE_PUBSUB_BEAM,
            languages: ['Python']
        });
        expect(results.Python).toBe(true);
    }, 180000);
});

/**
 * Programmatic test runner for GenerateSequence to PubSub suite.
 */
export async function runGenerateSequencePubSubFixedTest(): Promise<void> {
    const results = await runPipelineIntegrationTest({
        testName: 'GenerateSequence-PubSub-Fixed Pipeline',
        beamContent: GENERATE_SEQUENCE_PUBSUB_BEAM,
        languages: ['Java', 'Python']
    });
    if (!results.Java || !results.Python) {
        throw new Error('GenerateSequence to PubSub fixed windowing pipeline test failed');
    }
}
