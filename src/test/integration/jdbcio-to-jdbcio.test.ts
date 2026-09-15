/**
 * JdbcIO to JdbcIO Pipeline Integration Test
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Validates end-to-end code generation for Apache Beam pipelines connecting
 * a PostgreSQL JdbcIO source, a ParDo transform step, and a MySQL JdbcIO sink.
 * Evaluates generated code using the Multi-Agent Evaluation Harness.
 *
 * Loads pipeline definition from sidecar file: jdbcio-to-jdbcio.yaml
 */

import { describe, it, expect } from 'vitest';
import { runPipelineIntegrationTest } from './codegen-runner';
import JDBCIO_TO_JDBCIO_YAML from './jdbcio-to-jdbcio.yaml';

describe('JdbcIO to JdbcIO Pipeline Code Generation', () => {
    it('generates valid Java pipeline and passes Gemini evaluation', async () => {
        const results = await runPipelineIntegrationTest({
            testName: 'JdbcIO-to-JdbcIO (Java)',
            yamlContent: JDBCIO_TO_JDBCIO_YAML,
            languages: ['Java']
        });
        expect(results.Java).toBe(true);
    }, 180000);

    it('generates valid Python pipeline and passes Gemini evaluation', async () => {
        const results = await runPipelineIntegrationTest({
            testName: 'JdbcIO-to-JdbcIO (Python)',
            yamlContent: JDBCIO_TO_JDBCIO_YAML,
            languages: ['Python']
        });
        expect(results.Python).toBe(true);
    }, 180000);
});

/**
 * Programmatic test runner for JdbcIO to JdbcIO integration test suite.
 */
export async function runJdbcIoToJdbcIoTest(): Promise<void> {
    const results = await runPipelineIntegrationTest({
        testName: 'JdbcIO-to-JdbcIO Pipeline',
        yamlContent: JDBCIO_TO_JDBCIO_YAML,
        languages: ['Java', 'Python']
    });
    if (!results.Java || !results.Python) {
        throw new Error('JdbcIO to JdbcIO pipeline test failed');
    }
}

/**
 * Backward compatibility alias for runJdbcIoToJdbcIoTest.
 */
export const runJdbcToJdbcTest = runJdbcIoToJdbcIoTest;

