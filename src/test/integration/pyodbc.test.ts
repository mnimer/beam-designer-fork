/**
 * Pyodbc Source to Pyodbc Sink Pipeline Integration Test (IO76)
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Validates end-to-end code generation for an Apache Beam Python batch pipeline. The pipeline
 * reads rows from an ODBC-compliant SQL Server with pyodbc (Pyodbc Source), normalizes and
 * validates them in a ParDo with valid/error routing, batch-inserts the valid rows into a
 * reporting database with pyodbc (Pyodbc Sink), and logs rejected rows (LogMessage DLQ).
 * The Multi-Agent Evaluation Harness evaluates the generated code.
 *
 * Loads the pipeline definition from the sidecar file pyodbc.beam.
 *
 * Architectural decisions:
 * - Python only: IO76 targets Python (TASK.md §7.2 IO76), and pyodbc is a Python ODBC
 *   binding with no Java SDK equivalent. A Java run would have to swap in JdbcIO, which
 *   the evaluators would judge against a different connector.
 * - Credentials are Secret Manager short IDs (`passwordSecret`). The generated code resolves
 *   them at runtime, so no plaintext password appears in the spec or in the generated code.
 * - The 180s timeout matches the other suites (Vertex AI generation + multi-agent evaluation).
 */

import { describe, it, expect } from 'vitest';
import { runPipelineIntegrationTest, loadBeamPipeline } from './codegen-runner';

const PYODBC_BEAM = loadBeamPipeline('pyodbc.beam');

describe('Pyodbc Source to Pyodbc Sink Pipeline Code Generation', () => {
    it('generates valid Python pipeline and passes Gemini evaluation', async () => {
        const results = await runPipelineIntegrationTest({
            testName: 'Pyodbc-to-Pyodbc (Python)',
            beamContent: PYODBC_BEAM,
            languages: ['Python']
        });
        expect(results.Python).toBe(true);
    }, 180000);
});

/**
 * Programmatic test runner for the Pyodbc suite.
 */
export async function runPyodbcTest(): Promise<void> {
    const results = await runPipelineIntegrationTest({
        testName: 'Pyodbc-to-Pyodbc Pipeline',
        beamContent: PYODBC_BEAM,
        languages: ['Python']
    });
    if (!results.Python) {
        throw new Error('Pyodbc pipeline test failed');
    }
}
