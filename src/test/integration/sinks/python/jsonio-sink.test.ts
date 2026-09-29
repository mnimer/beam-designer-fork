/**
 * JsonIO Sink (python) Integration Test
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Generated integration test suite adhering to standardized DAG topology.
 * Evaluates generated Apache Beam repository across Python using Gemini 3.7 Flash.
 */

import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { runPipelineIntegrationTest, loadBeamPipeline } from '../../codegen-runner';

const PIPELINE_BEAM = loadBeamPipeline(path.join(__dirname, 'jsonio-sink.beam'));

describe('JsonIO Sink (python) Code Generation', () => {
    it('generates valid Python pipeline and passes multi-agent evaluation', async () => {
        const results = await runPipelineIntegrationTest({
            testName: 'JsonIO Sink (python) (Python)',
            beamContent: PIPELINE_BEAM,
            languages: ['Python']
        });
        expect(results.Python).toBe(true);
    }, 180000);
});

/**
 * Programmatic test runner for JsonIO Sink (python).
 */
export async function runJsonioSinkTest(): Promise<void> {
    const results = await runPipelineIntegrationTest({
        testName: 'JsonIO Sink (python)',
        beamContent: PIPELINE_BEAM,
        languages: ['Python']
    });
    if (!results.Python) {
        throw new Error('JsonIO Sink (python) pipeline test failed');
    }
}
