/**
 * Cloud SQL (IO74) Pipeline Integration Test
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Validates end-to-end Python code generation for a pipeline that reads orders from a
 * Cloud SQL for PostgreSQL instance (CloudSQL Source: parameterized SQLAlchemy query via
 * the Cloud SQL Python Connector), marks them fulfilled (Map), and upserts them into a
 * second Cloud SQL database (CloudSQL Sink honoring update_ignores). Database passwords are
 * Secret Manager references (passwordSecret) resolved at pipeline construction; no
 * connection URL embeds a credential. Evaluated with the Multi-Agent Evaluation Harness.
 *
 * Loads pipeline definition from sidecar file: cloudsql.beam
 */

import { describe, it, expect } from 'vitest';
import { runPipelineIntegrationTest, loadBeamPipeline } from './codegen-runner';

const CLOUDSQL_BEAM = loadBeamPipeline('cloudsql.beam');

describe('Cloud SQL (IO74) Pipeline Code Generation', () => {
    it('generates valid Python pipeline and passes Gemini evaluation', async () => {
        const results = await runPipelineIntegrationTest({
            testName: 'CloudSQL-Orders-Upsert (Python)',
            beamContent: CLOUDSQL_BEAM,
            languages: ['Python']
        });
        expect(results.Python).toBe(true);
    }, 180000);
});

/**
 * Programmatic test runner for the Cloud SQL (IO74) integration test suite.
 */
export async function runCloudSqlTest(): Promise<void> {
    const results = await runPipelineIntegrationTest({
        testName: 'CloudSQL-Orders-Upsert Pipeline',
        beamContent: CLOUDSQL_BEAM,
        languages: ['Python']
    });
    if (!results.Python) {
        throw new Error('Cloud SQL (IO74) pipeline test failed');
    }
}
