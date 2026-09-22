/**
 * PubSubIO User Session Windowing & Early Triggers Integration Test (I15)
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Validates end-to-end code generation for Apache Beam streaming pipelines connecting
 * PubSubIO Source, WithTimestamps event time extraction, KVMapper (keyed by userId),
 * WindowInto (Session Windows: 10m gap, early trigger 1m, allowed lateness 5m),
 * Count (per session), and BigQueryIO Sink.
 * Evaluates generated code using the Multi-Agent Evaluation Harness.
 *
 * Loads pipeline definition from sidecar file: pubsub-session-windows.beam
 */

import { describe, it, expect } from 'vitest';
import { runPipelineIntegrationTest, loadBeamPipeline } from './codegen-runner';

const PUBSUB_SESSION_WINDOWS_BEAM = loadBeamPipeline('pubsub-session-windows.beam');

describe('PubSubIO Session Windows Pipeline Code Generation (I15)', () => {
    it('generates valid Java pipeline and passes Gemini evaluation', async () => {
        const results = await runPipelineIntegrationTest({
            testName: 'PubSubIO-Session-Windows (Java)',
            beamContent: PUBSUB_SESSION_WINDOWS_BEAM,
            languages: ['Java']
        });
        expect(results.Java).toBe(true);
    }, 180000);

    it('generates valid Python pipeline and passes Gemini evaluation', async () => {
        const results = await runPipelineIntegrationTest({
            testName: 'PubSubIO-Session-Windows (Python)',
            beamContent: PUBSUB_SESSION_WINDOWS_BEAM,
            languages: ['Python']
        });
        expect(results.Python).toBe(true);
    }, 180000);
});

/**
 * Programmatic test runner for PubSub session windows test suite.
 */
export async function runPubSubSessionWindowsTest(): Promise<void> {
    const results = await runPipelineIntegrationTest({
        testName: 'PubSubIO-Session-Windows Pipeline',
        beamContent: PUBSUB_SESSION_WINDOWS_BEAM,
        languages: ['Java', 'Python']
    });
    if (!results.Java || !results.Python) {
        throw new Error('PubSub session windows pipeline integration test failed');
    }
}
