/**
 * KinesisIO to AvroIO Pipeline Integration Test (I7)
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Validates end-to-end code generation for Apache Beam streaming pipelines connecting
 * an Amazon Kinesis source (reading from telemetry-stream with TRIM_HORIZON),
 * a ParseMessage JSON step, and an AvroIO sink with windowed writes to Google Cloud Storage.
 * Evaluates generated code using the Multi-Agent Evaluation Harness.
 *
 * Loads pipeline definition from sidecar file: kinesis-to-avro.beam
 */

import { describe, it, expect } from 'vitest';
import { runPipelineIntegrationTest, loadBeamPipeline } from './codegen-runner';

const KINESIS_TO_AVRO_BEAM = loadBeamPipeline('kinesis-to-avro.beam');

describe('KinesisIO to AvroIO Pipeline Code Generation', () => {
    it('generates valid Java pipeline and passes Gemini evaluation', async () => {
        const results = await runPipelineIntegrationTest({
            testName: 'KinesisIO-to-AvroIO (Java)',
            beamContent: KINESIS_TO_AVRO_BEAM,
            languages: ['Java']
        });
        expect(results.Java).toBe(true);
    }, 180000);

    it('generates valid Python pipeline and passes Gemini evaluation', async () => {
        const results = await runPipelineIntegrationTest({
            testName: 'KinesisIO-to-AvroIO (Python)',
            beamContent: KINESIS_TO_AVRO_BEAM,
            languages: ['Python']
        });
        expect(results.Python).toBe(true);
    }, 180000);
});

/**
 * Programmatic test runner for Kinesis to Avro suite.
 */
export async function runKinesisToAvroTest(): Promise<void> {
    const results = await runPipelineIntegrationTest({
        testName: 'KinesisIO-to-AvroIO Pipeline',
        beamContent: KINESIS_TO_AVRO_BEAM,
        languages: ['Java', 'Python']
    });
    if (!results.Java || !results.Python) {
        throw new Error('Kinesis to Avro pipeline test failed');
    }
}
