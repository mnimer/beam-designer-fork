/**
 * ContextualTextIO Source (agent-engine) Integration Test
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Generated integration test suite adhering to standardized DAG topology.
 * Evaluates generated Apache Beam repository across Java using Gemini 3.7 Flash.
 */

import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { runPipelineIntegrationTest, loadBeamPipeline } from '../../codegen-runner';

const PIPELINE_BEAM = loadBeamPipeline(path.join(__dirname, 'contextualtextio-source.beam'));

describe('ContextualTextIO Source (agent-engine) Code Generation', () => {
    it('generates valid Java pipeline and passes multi-agent evaluation', async () => {
        const results = await runPipelineIntegrationTest({
            testName: 'ContextualTextIO Source (agent-engine) (Java)',
            beamContent: PIPELINE_BEAM,
            languages: ['Java']
        });
        expect(results.Java).toBe(true);
    }, 180000);});

/**
 * Programmatic test runner for ContextualTextIO Source (agent-engine).
 */
export async function runContextualtextioSourceTest(): Promise<void> {
    const results = await runPipelineIntegrationTest({
        testName: 'ContextualTextIO Source (agent-engine)',
        beamContent: PIPELINE_BEAM,
        languages: ['Java']
    });
    if (!results.Java) {
        throw new Error('ContextualTextIO Source (agent-engine) pipeline test failed');
    }
}
