/**
 * Steps: ParDo Side Inputs Enrichment (java) Integration Test
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Exercises F1 — a ParDo whose main input (orders) is enriched from two side inputs connected
 * through the `side_input` handle: a MAP view (`View.asMap()`) of FX rates keyed by currency and a
 * SINGLETON view (`View.asSingleton().withDefaultValue(...)`) holding the target currency.
 * Evaluates the generated Apache Beam repository for Java using the Multi-Agent Evaluation Harness.
 */

import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { runPipelineIntegrationTest, loadBeamPipeline } from '../../codegen-runner';

const PIPELINE_BEAM = loadBeamPipeline(path.join(__dirname, 'pardo-side-inputs.beam'));

describe('Steps: ParDo Side Inputs Enrichment (java) Code Generation', () => {
    it('generates valid Java pipeline with PCollectionView side inputs and passes multi-agent evaluation', async () => {
        const results = await runPipelineIntegrationTest({
            testName: 'Steps: ParDo Side Inputs Enrichment (java) (Java)',
            beamContent: PIPELINE_BEAM,
            languages: ['Java']
        });
        expect(results.Java).toBe(true);
    }, 180000);
});

/**
 * Programmatic test runner for Steps: ParDo Side Inputs Enrichment (java).
 */
export async function runParDoSideInputsTest(): Promise<void> {
    const results = await runPipelineIntegrationTest({
        testName: 'Steps: ParDo Side Inputs Enrichment (java)',
        beamContent: PIPELINE_BEAM,
        languages: ['Java']
    });
    if (!results.Java) {
        throw new Error('Steps: ParDo Side Inputs Enrichment (java) pipeline test failed');
    }
}
