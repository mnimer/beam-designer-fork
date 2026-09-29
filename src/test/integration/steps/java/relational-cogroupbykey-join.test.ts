/**
 * Steps: Relational Multi-Stream Join: CoGroupByKey (java) Integration Test
 *
 * Generated integration test suite adhering to standardized DAG topology.
 * Evaluates generated Apache Beam repository across Java using Gemini 3.7 Flash.
 */

import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { runPipelineIntegrationTest, loadBeamPipeline } from '../../codegen-runner';

const PIPELINE_BEAM = loadBeamPipeline(path.join(__dirname, 'relational-cogroupbykey-join.beam'));

describe('Steps: Relational Multi-Stream Join: CoGroupByKey (java) Code Generation', () => {
    it('generates valid Java pipeline and passes multi-agent evaluation', async () => {
        const results = await runPipelineIntegrationTest({
            testName: 'Steps: Relational Multi-Stream Join: CoGroupByKey (java) (Java)',
            beamContent: PIPELINE_BEAM,
            languages: ['Java']
        });
        expect(results.Java).toBe(true);
    }, 180000);
});

/**
 * Programmatic test runner for Steps: Relational Multi-Stream Join: CoGroupByKey (java).
 */
export async function runRelationalCogroupbykeyJoinTest(): Promise<void> {
    const results = await runPipelineIntegrationTest({
        testName: 'Steps: Relational Multi-Stream Join: CoGroupByKey (java)',
        beamContent: PIPELINE_BEAM,
        languages: ['Java']
    });
    if (!results.Java) {
        throw new Error('Steps: Relational Multi-Stream Join: CoGroupByKey (java) pipeline test failed');
    }
}
