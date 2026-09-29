/**
 * MySQLPostgreSQLOracleSQLServer Source (java) Integration Test (IO79)
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Generated integration test suite adhering to standardized DAG topology.
 * Evaluates generated Apache Beam repository across Java using Gemini 3.7 Flash.
 */

import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { runPipelineIntegrationTest, loadBeamPipeline } from '../../codegen-runner';

const PIPELINE_BEAM = loadBeamPipeline(path.join(__dirname, 'multidb-yaml-source.beam'));

describe('MySQLPostgreSQLOracleSQLServer Source (java) Code Generation', () => {
    it('generates valid Java pipeline and passes multi-agent evaluation', async () => {
        const results = await runPipelineIntegrationTest({
            testName: 'MySQLPostgreSQLOracleSQLServer Source (java) (Java)',
            beamContent: PIPELINE_BEAM,
            languages: ['Java']
        });
        expect(results.Java).toBe(true);
    }, 180000);
});

/**
 * Programmatic test runner for MySQLPostgreSQLOracleSQLServer Source (java).
 */
export async function runMultidbYamlSourceTest(): Promise<void> {
    const results = await runPipelineIntegrationTest({
        testName: 'MySQLPostgreSQLOracleSQLServer Source (java)',
        beamContent: PIPELINE_BEAM,
        languages: ['Java']
    });
    if (!results.Java) {
        throw new Error('MySQLPostgreSQLOracleSQLServer Source (java) pipeline test failed');
    }
}
