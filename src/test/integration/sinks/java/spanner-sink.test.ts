/**
 * SpannerIO Sink (java) Integration Test (IO34)
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Generated integration test suite adhering to standardized DAG topology.
 * Evaluates generated Apache Beam repository across Java using Gemini 3.7 Flash.
 */

import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { runPipelineIntegrationTest, loadBeamPipeline } from '../../codegen-runner';

const PIPELINE_BEAM = loadBeamPipeline(path.join(__dirname, 'spanner-sink.beam'));

describe('SpannerIO Sink (java) Code Generation', () => {
    it('generates valid Java pipeline and passes multi-agent evaluation', async () => {
        const results = await runPipelineIntegrationTest({
            testName: 'SpannerIO Sink (java) (Java)',
            beamContent: PIPELINE_BEAM,
            languages: ['Java']
        });
        expect(results.Java).toBe(true);
    }, 180000);
});

/**
 * Programmatic test runner for SpannerIO Sink (java).
 */
export async function runSpannerSinkTest(): Promise<void> {
    const results = await runPipelineIntegrationTest({
        testName: 'SpannerIO Sink (java)',
        beamContent: PIPELINE_BEAM,
        languages: ['Java']
    });
    if (!results.Java) {
        throw new Error('SpannerIO Sink (java) pipeline test failed');
    }
}
