/**
 * TikaIO Sink (agent-engine) Integration Test
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Generated integration test suite adhering to standardized DAG topology.
 * Evaluates generated Apache Beam repository across Java using Gemini 3.7 Flash.
 */

import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { runPipelineIntegrationTest, loadBeamPipeline } from '../../codegen-runner';

const PIPELINE_BEAM = loadBeamPipeline(path.join(__dirname, 'tikaio-sink.beam'));

describe('TikaIO Sink (agent-engine) Code Generation', () => {
    it('generates valid Java pipeline and passes multi-agent evaluation', async () => {
        const results = await runPipelineIntegrationTest({
            testName: 'TikaIO Sink (agent-engine) (Java)',
            beamContent: PIPELINE_BEAM,
            languages: ['Java']
        });
        expect(results.Java).toBe(true);
    }, 180000);});

/**
 * Programmatic test runner for TikaIO Sink (agent-engine).
 */
export async function runTikaioSinkTest(): Promise<void> {
    const results = await runPipelineIntegrationTest({
        testName: 'TikaIO Sink (agent-engine)',
        beamContent: PIPELINE_BEAM,
        languages: ['Java']
    });
    if (!results.Java) {
        throw new Error('TikaIO Sink (agent-engine) pipeline test failed');
    }
}
