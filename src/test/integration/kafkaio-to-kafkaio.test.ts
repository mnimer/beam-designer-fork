/**
 * KafkaIO to KafkaIO Pipeline Integration Test
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Validates end-to-end code generation for Apache Beam streaming pipelines connecting
 * a KafkaIO streaming source, a ParDo processing step with error routing,
 * a KafkaIO streaming sink with exactly-once semantics, and a LogMessage error sink.
 * Evaluates generated code using the Multi-Agent Evaluation Harness.
 *
 * Loads pipeline definition from sidecar file: kafkaio-to-kafkaio.beam
 */

import { describe, it, expect } from 'vitest';
import { runPipelineIntegrationTest, loadBeamPipeline } from './codegen-runner';

const KAFKAIO_TO_KAFKAIO_BEAM = loadBeamPipeline('kafkaio-to-kafkaio.beam');

describe('KafkaIO to KafkaIO Pipeline Code Generation', () => {
    it('generates valid Java pipeline and passes Gemini evaluation', async () => {
        const results = await runPipelineIntegrationTest({
            testName: 'KafkaIO-to-KafkaIO (Java)',
            beamContent: KAFKAIO_TO_KAFKAIO_BEAM,
            languages: ['Java']
        });
        expect(results.Java).toBe(true);
    }, 180000);

    it('generates valid Python pipeline and passes Gemini evaluation', async () => {
        const results = await runPipelineIntegrationTest({
            testName: 'KafkaIO-to-KafkaIO (Python)',
            beamContent: KAFKAIO_TO_KAFKAIO_BEAM,
            languages: ['Python']
        });
        expect(results.Python).toBe(true);
    }, 180000);
});

/**
 * Programmatic test runner for KafkaIO to KafkaIO suite.
 */
export async function runKafkaIoToKafkaIoTest(): Promise<void> {
    const results = await runPipelineIntegrationTest({
        testName: 'KafkaIO-to-KafkaIO Pipeline',
        beamContent: KAFKAIO_TO_KAFKAIO_BEAM,
        languages: ['Java', 'Python']
    });
    if (!results.Java || !results.Python) {
        throw new Error('KafkaIO to KafkaIO pipeline test failed');
    }
}
