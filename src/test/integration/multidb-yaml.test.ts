/**
 * MySQL / PostgreSQL / Oracle / SQL Server (IO79, Beam YAML) Pipeline Integration Test
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Validates end-to-end code generation for an Apache Beam pipeline that uses the
 * MySQLPostgreSQLOracleSQLServer node (the Beam YAML ReadFrom<Db> / WriteTo<Db> JDBC
 * schema transforms). It reads shipped orders from PostgreSQL, normalizes order
 * totals to USD in a ParDo, and writes them to SQL Server. Both database passwords
 * are Google Cloud Secret Manager references (passwordSecret).
 * Evaluates generated code using the Multi-Agent Evaluation Harness.
 *
 * Loads pipeline definition from sidecar file: multidb-yaml.beam
 *
 * Architectural decisions:
 * - Code generation targets only Java and Python, so the YAML node is generated as
 *   its native equivalent: Java JdbcIO, and Python apache_beam.io.jdbc
 *   ReadFromJdbc / WriteToJdbc (project decision D1).
 * - Uses two different database flavors (PostgreSQL source, SQL Server sink) to
 *   exercise per-flavor driver selection (a bundled Postgres driver versus an
 *   mssql-jdbc Maven dependency or Python classpath).
 * - Not registered in codegen.test.ts (that aggregator re-registers every suite).
 */

import { describe, it, expect } from 'vitest';
import { runPipelineIntegrationTest, loadBeamPipeline } from './codegen-runner';

const MULTIDB_YAML_BEAM = loadBeamPipeline('multidb-yaml.beam');

describe('MySQL/PostgreSQL/Oracle/SQL Server YAML (IO79) Pipeline Code Generation', () => {
    it('generates valid Java pipeline and passes Gemini evaluation', async () => {
        const results = await runPipelineIntegrationTest({
            testName: 'MultiDB-YAML Postgres-to-SQLServer (Java)',
            beamContent: MULTIDB_YAML_BEAM,
            languages: ['Java']
        });
        expect(results.Java).toBe(true);
    }, 180000);

    it('generates valid Python pipeline and passes Gemini evaluation', async () => {
        const results = await runPipelineIntegrationTest({
            testName: 'MultiDB-YAML Postgres-to-SQLServer (Python)',
            beamContent: MULTIDB_YAML_BEAM,
            languages: ['Python']
        });
        expect(results.Python).toBe(true);
    }, 180000);
});

/**
 * Programmatic test runner for the multi-database YAML integration test suite.
 */
export async function runMultiDbYamlTest(): Promise<void> {
    const results = await runPipelineIntegrationTest({
        testName: 'MultiDB-YAML Postgres-to-SQLServer Pipeline',
        beamContent: MULTIDB_YAML_BEAM,
        languages: ['Java', 'Python']
    });
    if (!results.Java || !results.Python) {
        throw new Error('MultiDB YAML pipeline test failed');
    }
}
