/**
 * Steps: Deduplication and Sampling: Distinct, Sample, ApproximateUnique and Latest (agent-engine) Integration Test
 *
 * Generated integration test suite adhering to standardized DAG topology.
 * Evaluates generated Apache Beam repository across Java and Python using Gemini 3.7 Flash.
 */

import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { runPipelineIntegrationTest, loadBeamPipeline } from '../../codegen-runner';

const PIPELINE_BEAM = loadBeamPipeline(path.join(__dirname, 'distinct-sampling-approximate.beam'));

describe('Steps: Deduplication and Sampling: Distinct, Sample, ApproximateUnique and Latest (agent-engine) Code Generation', () => {
    it('generates valid Java pipeline and passes multi-agent evaluation', async () => {
        const results = await runPipelineIntegrationTest({
            testName: 'Steps: Deduplication and Sampling: Distinct, Sample, ApproximateUnique and Latest (agent-engine) (Java)',
            beamContent: PIPELINE_BEAM,
            languages: ['Java']
        });
        expect(results.Java).toBe(true);
    }, 180000);

    it('generates valid Python pipeline and passes multi-agent evaluation', async () => {
        const results = await runPipelineIntegrationTest({
            testName: 'Steps: Deduplication and Sampling: Distinct, Sample, ApproximateUnique and Latest (agent-engine) (Python)',
            beamContent: PIPELINE_BEAM,
            languages: ['Python']
        });
        expect(results.Python).toBe(true);
    }, 180000);
});

/**
 * Programmatic test runner for Steps: Deduplication and Sampling: Distinct, Sample, ApproximateUnique and Latest (agent-engine).
 */
export async function runDistinctSamplingApproximateTest(): Promise<void> {
    const results = await runPipelineIntegrationTest({
        testName: 'Steps: Deduplication and Sampling: Distinct, Sample, ApproximateUnique and Latest (agent-engine)',
        beamContent: PIPELINE_BEAM,
        languages: ['Java', 'Python']
    });
    if (!results.Java || !results.Python) {
        throw new Error('Steps: Deduplication and Sampling: Distinct, Sample, ApproximateUnique and Latest (agent-engine) pipeline test failed');
    }
}
