/**
 * Steps: Custom Combiners and Parsers: ParseMessage, Combine and CombineWithContext (python) Integration Test
 *
 * Generated integration test suite adhering to standardized DAG topology.
 * Evaluates generated Apache Beam repository across Python using Gemini 3.7 Flash.
 */

import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { runPipelineIntegrationTest, loadBeamPipeline } from '../../codegen-runner';

const PIPELINE_BEAM = loadBeamPipeline(path.join(__dirname, 'combine-and-context.beam'));

describe('Steps: Custom Combiners and Parsers: ParseMessage, Combine and CombineWithContext (python) Code Generation', () => {
    it('generates valid Python pipeline and passes multi-agent evaluation', async () => {
        const results = await runPipelineIntegrationTest({
            testName: 'Steps: Custom Combiners and Parsers: ParseMessage, Combine and CombineWithContext (python) (Python)',
            beamContent: PIPELINE_BEAM,
            languages: ['Python']
        });
        expect(results.Python).toBe(true);
    }, 180000);
});

/**
 * Programmatic test runner for Steps: Custom Combiners and Parsers: ParseMessage, Combine and CombineWithContext (python).
 */
export async function runCombineAndContextTest(): Promise<void> {
    const results = await runPipelineIntegrationTest({
        testName: 'Steps: Custom Combiners and Parsers: ParseMessage, Combine and CombineWithContext (python)',
        beamContent: PIPELINE_BEAM,
        languages: ['Python']
    });
    if (!results.Python) {
        throw new Error('Steps: Custom Combiners and Parsers: ParseMessage, Combine and CombineWithContext (python) pipeline test failed');
    }
}
