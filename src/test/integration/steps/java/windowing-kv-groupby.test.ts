/**
 * Steps: Windowing, KV Mapping and Grouping (java) Integration Test
 *
 * Generated integration test suite adhering to standardized DAG topology.
 * Evaluates generated Apache Beam repository across Java using Gemini 3.7 Flash.
 */

import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { runPipelineIntegrationTest, loadBeamPipeline } from '../../codegen-runner';

const PIPELINE_BEAM = loadBeamPipeline(path.join(__dirname, 'windowing-kv-groupby.beam'));

describe('Steps: Windowing, KV Mapping and Grouping (java) Code Generation', () => {
    it('generates valid Java pipeline and passes multi-agent evaluation', async () => {
        const results = await runPipelineIntegrationTest({
            testName: 'Steps: Windowing, KV Mapping and Grouping (java) (Java)',
            beamContent: PIPELINE_BEAM,
            languages: ['Java']
        });
        expect(results.Java).toBe(true);
    }, 180000);
});

/**
 * Programmatic test runner for Steps: Windowing, KV Mapping and Grouping (java).
 */
export async function runWindowingKvGroupbyTest(): Promise<void> {
    const results = await runPipelineIntegrationTest({
        testName: 'Steps: Windowing, KV Mapping and Grouping (java)',
        beamContent: PIPELINE_BEAM,
        languages: ['Java']
    });
    if (!results.Java) {
        throw new Error('Steps: Windowing, KV Mapping and Grouping (java) pipeline test failed');
    }
}
