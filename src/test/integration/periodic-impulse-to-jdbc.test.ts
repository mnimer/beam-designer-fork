/**
 * PeriodicImpulse to JdbcIO Pipeline Integration Test (I13)
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Validates end-to-end code generation for Apache Beam pipelines executing periodic
 * ETL using PeriodicImpulse, calling an external REST metrics API via ParDo, and writing
 * database rows into MySQL via JdbcIO with parameterized SQL.
 * Evaluates generated code using the Multi-Agent Evaluation Harness.
 *
 * Loads pipeline definition from sidecar file: periodic-impulse-to-jdbc.beam
 *
 * Architectural decisions:
 * - Employs a declarative yaml/json representation within periodic-impulse-to-jdbc.beam to avoid hardcoding pipeline stages.
 * - Utilizes separate, sequential execution of Java and Python test scenarios with generous 180s timeouts to accommodate LLM invocation over Vertex AI.
 * - Supports programmatic run capability (runPeriodicImpulseToJdbcTest) for automated task runner invocations and debugging.
 */

import { describe, it, expect } from 'vitest';
import { runPipelineIntegrationTest, loadBeamPipeline } from './codegen-runner';

const PERIODIC_IMPULSE_TO_JDBC_BEAM = loadBeamPipeline('periodic-impulse-to-jdbc.beam');

describe('PeriodicImpulse to JdbcIO Pipeline Code Generation', () => {
    it('generates valid Java pipeline and passes Gemini evaluation', async () => {
        const results = await runPipelineIntegrationTest({
            testName: 'PeriodicImpulse-to-JdbcIO (Java)',
            beamContent: PERIODIC_IMPULSE_TO_JDBC_BEAM,
            languages: ['Java']
        });
        expect(results.Java).toBe(true);
    }, 180000);

    it('generates valid Python pipeline and passes Gemini evaluation', async () => {
        const results = await runPipelineIntegrationTest({
            testName: 'PeriodicImpulse-to-JdbcIO (Python)',
            beamContent: PERIODIC_IMPULSE_TO_JDBC_BEAM,
            languages: ['Python']
        });
        expect(results.Python).toBe(true);
    }, 180000);
});

/**
 * Programmatic test runner for PeriodicImpulse to JdbcIO suite.
 */
export async function runPeriodicImpulseToJdbcTest(): Promise<void> {
    const results = await runPipelineIntegrationTest({
        testName: 'PeriodicImpulse-to-JdbcIO Pipeline',
        beamContent: PERIODIC_IMPULSE_TO_JDBC_BEAM,
        languages: ['Java', 'Python']
    });
    if (!results.Java || !results.Python) {
        throw new Error('PeriodicImpulse to JdbcIO pipeline test failed');
    }
}
