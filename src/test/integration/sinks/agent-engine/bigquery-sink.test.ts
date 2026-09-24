/**
 * BigQueryIO Sink (agent-engine) Integration Test
 *
 * Generated integration test suite adhering to standardized DAG topology.
 * Evaluates generated Apache Beam repository across Java and Python using Gemini 3.7 Flash.
 */

import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { runPipelineIntegrationTest, loadBeamPipeline } from '../../codegen-runner';

const PIPELINE_BEAM = loadBeamPipeline(path.join(__dirname, 'bigquery-sink.beam'));

describe('BigQueryIO Sink (agent-engine) Code Generation', () => {
    it('generates valid Java pipeline and passes multi-agent evaluation', async () => {
        const results = await runPipelineIntegrationTest({
            testName: 'BigQueryIO Sink (agent-engine) (Java)',
            beamContent: PIPELINE_BEAM,
            languages: ['Java']
        });
        expect(results.Java).toBe(true);
    }, 180000);

    it('generates valid Python pipeline and passes multi-agent evaluation', async () => {
        const results = await runPipelineIntegrationTest({
            testName: 'BigQueryIO Sink (agent-engine) (Python)',
            beamContent: PIPELINE_BEAM,
            languages: ['Python']
        });
        expect(results.Python).toBe(true);
    }, 180000);
});

/**
 * Programmatic test runner for BigQueryIO Sink (agent-engine).
 */
export async function runBigquerySinkTest(): Promise<void> {
    const results = await runPipelineIntegrationTest({
        testName: 'BigQueryIO Sink (agent-engine)',
        beamContent: PIPELINE_BEAM,
        languages: ['Java', 'Python']
    });
    if (!results.Java || !results.Python) {
        throw new Error('BigQueryIO Sink (agent-engine) pipeline test failed');
    }
}
