/**
 * AvroIO Sink (java) Integration Test
 *
 * Generated integration test suite adhering to standardized DAG topology.
 * Evaluates generated Apache Beam repository across Java using Gemini 3.7 Flash.
 */

import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { runPipelineIntegrationTest, loadBeamPipeline } from '../../codegen-runner';

const PIPELINE_BEAM = loadBeamPipeline(path.join(__dirname, 'avro-sink.beam'));

describe('AvroIO Sink (java) Code Generation', () => {
    it('generates valid Java pipeline and passes multi-agent evaluation', async () => {
        const results = await runPipelineIntegrationTest({
            testName: 'AvroIO Sink (java) (Java)',
            beamContent: PIPELINE_BEAM,
            languages: ['Java']
        });
        expect(results.Java).toBe(true);
    }, 180000);
});

/**
 * Programmatic test runner for AvroIO Sink (java).
 */
export async function runAvroSinkTest(): Promise<void> {
    const results = await runPipelineIntegrationTest({
        testName: 'AvroIO Sink (java)',
        beamContent: PIPELINE_BEAM,
        languages: ['Java']
    });
    if (!results.Java) {
        throw new Error('AvroIO Sink (java) pipeline test failed');
    }
}
