/**
 * Distinct and Statistical Sampling Pipeline Integration Test (I18)
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Validates end-to-end code generation for Apache Beam pipelines connecting
 * TextIO Source, Distinct deduplication, Sample (uniform random sample),
 * ApproximateUnique distinct count estimator, and LogMessage Sink.
 * Evaluates generated code using the Multi-Agent Evaluation Harness.
 *
 * Loads pipeline definition from sidecar file: distinct-statistical-sampling.beam
 */

import { describe, it, expect } from 'vitest';
import { runPipelineIntegrationTest, loadBeamPipeline } from './codegen-runner';

const DISTINCT_STATISTICAL_SAMPLING_BEAM = loadBeamPipeline('distinct-statistical-sampling.beam');

describe('Distinct and Statistical Sampling Pipeline Code Generation (I18)', () => {
    it('generates valid Java pipeline and passes Gemini evaluation', async () => {
        const results = await runPipelineIntegrationTest({
            testName: 'Distinct-Statistical-Sampling (Java)',
            beamContent: DISTINCT_STATISTICAL_SAMPLING_BEAM,
            languages: ['Java']
        });
        expect(results.Java).toBe(true);
    }, 180000);

    it('generates valid Python pipeline and passes Gemini evaluation', async () => {
        const results = await runPipelineIntegrationTest({
            testName: 'Distinct-Statistical-Sampling (Python)',
            beamContent: DISTINCT_STATISTICAL_SAMPLING_BEAM,
            languages: ['Python']
        });
        expect(results.Python).toBe(true);
    }, 180000);
});

/**
 * Programmatic test runner for Distinct and Statistical Sampling test suite.
 */
export async function runDistinctStatisticalSamplingTest(): Promise<void> {
    const results = await runPipelineIntegrationTest({
        testName: 'Distinct-Statistical-Sampling Pipeline',
        beamContent: DISTINCT_STATISTICAL_SAMPLING_BEAM,
        languages: ['Java', 'Python']
    });
    if (!results.Java || !results.Python) {
        throw new Error('Distinct and statistical sampling pipeline integration test failed');
    }
}
