/**
 * Steps: PCollection Stream Merging: Flatten (python) Integration Test
 *
 * Generated integration test suite adhering to standardized DAG topology.
 * Evaluates generated Apache Beam repository across Python using Gemini 3.7 Flash.
 */

import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { runPipelineIntegrationTest, loadBeamPipeline } from '../../codegen-runner';

const PIPELINE_BEAM = loadBeamPipeline(path.join(__dirname, 'multi-branch-flatten.beam'));

describe('Steps: PCollection Stream Merging: Flatten (python) Code Generation', () => {
    it('generates valid Python pipeline and passes multi-agent evaluation', async () => {
        const results = await runPipelineIntegrationTest({
            testName: 'Steps: PCollection Stream Merging: Flatten (python) (Python)',
            beamContent: PIPELINE_BEAM,
            languages: ['Python']
        });
        expect(results.Python).toBe(true);
    }, 180000);
});

/**
 * Programmatic test runner for Steps: PCollection Stream Merging: Flatten (python).
 */
export async function runMultiBranchFlattenTest(): Promise<void> {
    const results = await runPipelineIntegrationTest({
        testName: 'Steps: PCollection Stream Merging: Flatten (python)',
        beamContent: PIPELINE_BEAM,
        languages: ['Python']
    });
    if (!results.Python) {
        throw new Error('Steps: PCollection Stream Merging: Flatten (python) pipeline test failed');
    }
}
