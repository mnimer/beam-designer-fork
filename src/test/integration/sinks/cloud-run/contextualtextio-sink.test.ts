/**
 * ContextualTextIO Sink (cloud-run) Integration Test
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Generated integration test suite adhering to standardized DAG topology.
 * Evaluates generated Apache Beam repository across Java using Gemini 3.7 Flash.
 */

import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { runPipelineIntegrationTest, loadBeamPipeline } from '../../codegen-runner';

const PIPELINE_BEAM = loadBeamPipeline(path.join(__dirname, 'contextualtextio-sink.beam'));

describe('ContextualTextIO Sink (cloud-run) Code Generation', () => {
    it('generates valid Java pipeline and passes multi-agent evaluation', async () => {
        const results = await runPipelineIntegrationTest({
            testName: 'ContextualTextIO Sink (cloud-run) (Java)',
            beamContent: PIPELINE_BEAM,
            languages: ['Java']
        });
        expect(results.Java).toBe(true);
    }, 180000);});

/**
 * Programmatic test runner for ContextualTextIO Sink (cloud-run).
 */
export async function runContextualtextioSinkTest(): Promise<void> {
    const results = await runPipelineIntegrationTest({
        testName: 'ContextualTextIO Sink (cloud-run)',
        beamContent: PIPELINE_BEAM,
        languages: ['Java']
    });
    if (!results.Java) {
        throw new Error('ContextualTextIO Sink (cloud-run) pipeline test failed');
    }
}
