/**
 * Steps: Windowing, KV Mapping and Grouping (python) Integration Test
 *
 * Generated integration test suite adhering to standardized DAG topology.
 * Evaluates generated Apache Beam repository across Python using Gemini 3.7 Flash.
 */

import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { runPipelineIntegrationTest, loadBeamPipeline } from '../../codegen-runner';

const PIPELINE_BEAM = loadBeamPipeline(path.join(__dirname, 'windowing-kv-groupby.beam'));

describe('Steps: Windowing, KV Mapping and Grouping (python) Code Generation', () => {
    it('generates valid Python pipeline and passes multi-agent evaluation', async () => {
        const results = await runPipelineIntegrationTest({
            testName: 'Steps: Windowing, KV Mapping and Grouping (python) (Python)',
            beamContent: PIPELINE_BEAM,
            languages: ['Python']
        });
        expect(results.Python).toBe(true);
    }, 180000);
});

/**
 * Programmatic test runner for Steps: Windowing, KV Mapping and Grouping (python).
 */
export async function runWindowingKvGroupbyTest(): Promise<void> {
    const results = await runPipelineIntegrationTest({
        testName: 'Steps: Windowing, KV Mapping and Grouping (python)',
        beamContent: PIPELINE_BEAM,
        languages: ['Python']
    });
    if (!results.Python) {
        throw new Error('Steps: Windowing, KV Mapping and Grouping (python) pipeline test failed');
    }
}
