/**
 * Create Source (python) Integration Test
 *
 * Generated integration test suite adhering to standardized DAG topology.
 * Evaluates generated Apache Beam repository across Python using Gemini 3.7 Flash.
 */

import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { runPipelineIntegrationTest, loadBeamPipeline } from '../../codegen-runner';

const PIPELINE_BEAM = loadBeamPipeline(path.join(__dirname, 'create-source.beam'));

describe('Create Source (python) Code Generation', () => {
    it('generates valid Python pipeline and passes multi-agent evaluation', async () => {
        const results = await runPipelineIntegrationTest({
            testName: 'Create Source (python) (Python)',
            beamContent: PIPELINE_BEAM,
            languages: ['Python']
        });
        expect(results.Python).toBe(true);
    }, 180000);
});

/**
 * Programmatic test runner for Create Source (python).
 */
export async function runCreateSourceTest(): Promise<void> {
    const results = await runPipelineIntegrationTest({
        testName: 'Create Source (python)',
        beamContent: PIPELINE_BEAM,
        languages: ['Python']
    });
    if (!results.Python) {
        throw new Error('Create Source (python) pipeline test failed');
    }
}
