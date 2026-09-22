/**
 * JmsIO to JmsIO Batching Pipeline Integration Test (I10)
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Validates end-to-end code generation for Apache Beam streaming pipelines connecting
 * an Apache ActiveMQ Artemis JMS queue source (orders.incoming),
 * a GroupIntoBatches transform grouping elements into 100-record bundles,
 * a bulk payload processing ParDo step, and a JMS queue sink (orders.batched).
 * Evaluates generated code using the Multi-Agent Evaluation Harness.
 *
 * Loads pipeline definition from sidecar file: jms-to-jms-batching.beam
 */

import { describe, it, expect } from 'vitest';
import { runPipelineIntegrationTest, loadBeamPipeline } from './codegen-runner';

const JMS_TO_JMS_BATCHING_BEAM = loadBeamPipeline('jms-to-jms-batching.beam');

describe('JmsIO to JmsIO Batching Pipeline Code Generation', () => {
    it('generates valid Java pipeline and passes Gemini evaluation', async () => {
        const results = await runPipelineIntegrationTest({
            testName: 'JmsIO-to-JmsIO-Batching (Java)',
            beamContent: JMS_TO_JMS_BATCHING_BEAM,
            languages: ['Java']
        });
        expect(results.Java).toBe(true);
    }, 180000);

    it('generates valid Python pipeline and passes Gemini evaluation', async () => {
        const results = await runPipelineIntegrationTest({
            testName: 'JmsIO-to-JmsIO-Batching (Python)',
            beamContent: JMS_TO_JMS_BATCHING_BEAM,
            languages: ['Python']
        });
        expect(results.Python).toBe(true);
    }, 180000);
});

/**
 * Programmatic test runner for Jms to Jms Batching suite.
 */
export async function runJmsToJmsBatchingTest(): Promise<void> {
    const results = await runPipelineIntegrationTest({
        testName: 'JmsIO-to-JmsIO-Batching Pipeline',
        beamContent: JMS_TO_JMS_BATCHING_BEAM,
        languages: ['Java', 'Python']
    });
    if (!results.Java || !results.Python) {
        throw new Error('Jms to Jms Batching pipeline test failed');
    }
}
