/**
 * Steps: ParDo Side Inputs Enrichment (python) Integration Test
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Exercises F1 — a ParDo whose main input (orders) is enriched from two side inputs connected
 * through the `side_input` handle: a MAP view (`pvalue.AsDict`) of FX rates keyed by currency and a
 * SINGLETON view (`pvalue.AsSingleton(..., default_value=...)`) holding the target currency.
 * Evaluates the generated Apache Beam repository for Python using the Multi-Agent Evaluation Harness.
 */

import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { runPipelineIntegrationTest, loadBeamPipeline } from '../../codegen-runner';

const PIPELINE_BEAM = loadBeamPipeline(path.join(__dirname, 'pardo-side-inputs.beam'));

describe('Steps: ParDo Side Inputs Enrichment (python) Code Generation', () => {
    it('generates valid Python pipeline with pvalue.As* side inputs and passes multi-agent evaluation', async () => {
        const results = await runPipelineIntegrationTest({
            testName: 'Steps: ParDo Side Inputs Enrichment (python) (Python)',
            beamContent: PIPELINE_BEAM,
            languages: ['Python']
        });
        expect(results.Python).toBe(true);
    }, 180000);
});

/**
 * Programmatic test runner for Steps: ParDo Side Inputs Enrichment (python).
 */
export async function runParDoSideInputsTest(): Promise<void> {
    const results = await runPipelineIntegrationTest({
        testName: 'Steps: ParDo Side Inputs Enrichment (python)',
        beamContent: PIPELINE_BEAM,
        languages: ['Python']
    });
    if (!results.Python) {
        throw new Error('Steps: ParDo Side Inputs Enrichment (python) pipeline test failed');
    }
}
