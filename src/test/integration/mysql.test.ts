/**
 * MySQL (IO75) Pipeline Integration Test
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Validates end-to-end Python code generation for a pipeline that reads orders from MySQL
 * with the beam-mysql-connector ReadFromMySQL source (NoSplitter), normalizes each row (Map),
 * and writes the result to a second MySQL database with WriteToMySQL (batch_size 500).
 * Database passwords are Secret Manager references (passwordSecret) resolved at pipeline
 * construction. Evaluated with the Multi-Agent Evaluation Harness.
 *
 * Loads pipeline definition from sidecar file: mysql.beam
 */

import { describe, it, expect } from 'vitest';
import { runPipelineIntegrationTest, loadBeamPipeline } from './codegen-runner';

const MYSQL_BEAM = loadBeamPipeline('mysql.beam');

describe('MySQL (IO75) Pipeline Code Generation', () => {
    it('generates valid Python pipeline and passes Gemini evaluation', async () => {
        const results = await runPipelineIntegrationTest({
            testName: 'MySQL-Orders-Normalize (Python)',
            beamContent: MYSQL_BEAM,
            languages: ['Python']
        });
        expect(results.Python).toBe(true);
    }, 180000);
});

/**
 * Programmatic test runner for the MySQL (IO75) integration test suite.
 */
export async function runMySqlTest(): Promise<void> {
    const results = await runPipelineIntegrationTest({
        testName: 'MySQL-Orders-Normalize Pipeline',
        beamContent: MYSQL_BEAM,
        languages: ['Python']
    });
    if (!results.Python) {
        throw new Error('MySQL (IO75) pipeline test failed');
    }
}
