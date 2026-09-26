/**
 * ContextualTextIO Sink (agent-engine) Integration Test
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

describe('ContextualTextIO Sink (agent-engine) Code Generation', () => {
    it('generates valid Java pipeline and passes multi-agent evaluation', async () => {
        const results = await runPipelineIntegrationTest({
            testName: 'ContextualTextIO Sink (agent-engine) (Java)',
            beamContent: PIPELINE_BEAM,
            languages: ['Java']
        });
        expect(results.Java).toBe(true);
    }, 180000);});

/**
 * Programmatic test runner for ContextualTextIO Sink (agent-engine).
 */
export async function runContextualtextioSinkTest(): Promise<void> {
    const results = await runPipelineIntegrationTest({
        testName: 'ContextualTextIO Sink (agent-engine)',
        beamContent: PIPELINE_BEAM,
        languages: ['Java']
    });
    if (!results.Java) {
        throw new Error('ContextualTextIO Sink (agent-engine) pipeline test failed');
    }
}
