/**
 * Tinybird Sink Pipeline Integration Test (IO77)
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Validates end-to-end Python code generation for a streaming pipeline that reads web
 * analytics JSON from Cloud Pub/Sub, parses it, projects each event onto the Tinybird
 * Data Source columns, batches rows with BatchElements, and appends them to a Tinybird
 * Data Source through the official `tinybird.beam.WriteToTinybird` connector. The Tinybird
 * auth token is a Secret Manager reference (tokenSecret) that the generated code must
 * resolve once at pipeline construction.
 * Evaluates generated code using the Multi-Agent Evaluation Harness.
 *
 * tinybird-beam is a Python-only connector, so only the Python target is tested.
 *
 * Loads pipeline definition from sidecar file: tinybird.beam
 */

import { describe, it, expect } from 'vitest';
import { runPipelineIntegrationTest, loadBeamPipeline } from './codegen-runner';

const TINYBIRD_BEAM = loadBeamPipeline('tinybird.beam');

describe('Tinybird Sink Pipeline Code Generation', () => {
    it('generates valid Python pipeline and passes Gemini evaluation', async () => {
        const results = await runPipelineIntegrationTest({
            testName: 'PubSubIO-to-Tinybird (Python)',
            beamContent: TINYBIRD_BEAM,
            languages: ['Python']
        });
        expect(results.Python).toBe(true);
    }, 180000);
});

/**
 * Programmatic test runner for the Tinybird suite.
 * Intentionally NOT registered in codegen.test.ts (see PROJECT.md).
 */
export async function runTinybirdTest(): Promise<void> {
    const results = await runPipelineIntegrationTest({
        testName: 'PubSubIO-to-Tinybird Pipeline',
        beamContent: TINYBIRD_BEAM,
        languages: ['Python']
    });
    if (!results.Python) {
        throw new Error('Tinybird pipeline test failed');
    }
}
