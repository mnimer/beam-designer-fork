/**
 * Steps: Custom Combiners and Parsers: ParseMessage, Combine and CombineWithContext (java) Integration Test
 *
 * Generated integration test suite adhering to standardized DAG topology.
 * Evaluates generated Apache Beam repository across Java using Gemini 3.7 Flash.
 */

import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { runPipelineIntegrationTest, loadBeamPipeline } from '../../codegen-runner';

const PIPELINE_BEAM = loadBeamPipeline(path.join(__dirname, 'combine-and-context.beam'));

describe('Steps: Custom Combiners and Parsers: ParseMessage, Combine and CombineWithContext (java) Code Generation', () => {
    it('generates valid Java pipeline and passes multi-agent evaluation', async () => {
        const results = await runPipelineIntegrationTest({
            testName: 'Steps: Custom Combiners and Parsers: ParseMessage, Combine and CombineWithContext (java) (Java)',
            beamContent: PIPELINE_BEAM,
            languages: ['Java']
        });
        expect(results.Java).toBe(true);
    }, 180000);
});

/**
 * Programmatic test runner for Steps: Custom Combiners and Parsers: ParseMessage, Combine and CombineWithContext (java).
 */
export async function runCombineAndContextTest(): Promise<void> {
    const results = await runPipelineIntegrationTest({
        testName: 'Steps: Custom Combiners and Parsers: ParseMessage, Combine and CombineWithContext (java)',
        beamContent: PIPELINE_BEAM,
        languages: ['Java']
    });
    if (!results.Java) {
        throw new Error('Steps: Custom Combiners and Parsers: ParseMessage, Combine and CombineWithContext (java) pipeline test failed');
    }
}
