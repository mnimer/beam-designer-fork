/**
 * Steps: Deduplication and Sampling: Distinct, Sample, ApproximateUnique and Latest (java) Integration Test
 *
 * Generated integration test suite adhering to standardized DAG topology.
 * Evaluates generated Apache Beam repository across Java using Gemini 3.7 Flash.
 */

import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { runPipelineIntegrationTest, loadBeamPipeline } from '../../codegen-runner';

const PIPELINE_BEAM = loadBeamPipeline(path.join(__dirname, 'distinct-sampling-approximate.beam'));

describe('Steps: Deduplication and Sampling: Distinct, Sample, ApproximateUnique and Latest (java) Code Generation', () => {
    it('generates valid Java pipeline and passes multi-agent evaluation', async () => {
        const results = await runPipelineIntegrationTest({
            testName: 'Steps: Deduplication and Sampling: Distinct, Sample, ApproximateUnique and Latest (java) (Java)',
            beamContent: PIPELINE_BEAM,
            languages: ['Java']
        });
        expect(results.Java).toBe(true);
    }, 180000);
});

/**
 * Programmatic test runner for Steps: Deduplication and Sampling: Distinct, Sample, ApproximateUnique and Latest (java).
 */
export async function runDistinctSamplingApproximateTest(): Promise<void> {
    const results = await runPipelineIntegrationTest({
        testName: 'Steps: Deduplication and Sampling: Distinct, Sample, ApproximateUnique and Latest (java)',
        beamContent: PIPELINE_BEAM,
        languages: ['Java']
    });
    if (!results.Java) {
        throw new Error('Steps: Deduplication and Sampling: Distinct, Sample, ApproximateUnique and Latest (java) pipeline test failed');
    }
}
