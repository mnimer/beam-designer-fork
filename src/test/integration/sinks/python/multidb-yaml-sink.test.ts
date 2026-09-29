/**
 * MySQLPostgreSQLOracleSQLServer Sink (python) Integration Test (IO79)
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Generated integration test suite adhering to standardized DAG topology.
 * Evaluates generated Apache Beam repository across Python using Gemini 3.7 Flash.
 */

import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { runPipelineIntegrationTest, loadBeamPipeline } from '../../codegen-runner';

const PIPELINE_BEAM = loadBeamPipeline(path.join(__dirname, 'multidb-yaml-sink.beam'));

describe('MySQLPostgreSQLOracleSQLServer Sink (python) Code Generation', () => {
    it('generates valid Python pipeline and passes multi-agent evaluation', async () => {
        const results = await runPipelineIntegrationTest({
            testName: 'MySQLPostgreSQLOracleSQLServer Sink (python) (Python)',
            beamContent: PIPELINE_BEAM,
            languages: ['Python']
        });
        expect(results.Python).toBe(true);
    }, 180000);
});

/**
 * Programmatic test runner for MySQLPostgreSQLOracleSQLServer Sink (python).
 */
export async function runMultidbYamlSinkTest(): Promise<void> {
    const results = await runPipelineIntegrationTest({
        testName: 'MySQLPostgreSQLOracleSQLServer Sink (python)',
        beamContent: PIPELINE_BEAM,
        languages: ['Python']
    });
    if (!results.Python) {
        throw new Error('MySQLPostgreSQLOracleSQLServer Sink (python) pipeline test failed');
    }
}
