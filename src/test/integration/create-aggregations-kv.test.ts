/**
 * Create Aggregations KV Pipeline Integration Test (I14)
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Validates end-to-end code generation for Apache Beam pipelines using in-memory
 * Create source, KVMapper, statistical aggregation transforms (Top, ApproximateQuantiles,
 * Min, Max), and a LogMessage sink.
 * Evaluates generated code using the Multi-Agent Evaluation Harness.
 *
 * Loads pipeline definition from sidecar file: create-aggregations-kv.beam
 *
 * Architectural decisions:
 * - Keeps test definitions purely declarative by sourcing the DAG setup from the external file create-aggregations-kv.beam.
 * - Deconstructs Java and Python test scenarios into isolated Vitest steps to ensure clear visibility into language-specific generation failures.
 * - Enforces a 180s timeout limit to account for complex multi-branch pipeline generation and agentic evaluation passes.
 * - Provides a programmatic test hook (runCreateAggregationsKvTest) for on-demand execution and health checks.
 */

import { describe, it, expect } from 'vitest';
import { runPipelineIntegrationTest, loadBeamPipeline } from './codegen-runner';

const CREATE_AGGREGATIONS_KV_BEAM = loadBeamPipeline('create-aggregations-kv.beam');

describe('Create Aggregations KV Pipeline Code Generation', () => {
    it('generates valid Java pipeline and passes Gemini evaluation', async () => {
        const results = await runPipelineIntegrationTest({
            testName: 'Create-Aggregations-KV (Java)',
            beamContent: CREATE_AGGREGATIONS_KV_BEAM,
            languages: ['Java']
        });
        expect(results.Java).toBe(true);
    }, 180000);

    it('generates valid Python pipeline and passes Gemini evaluation', async () => {
        const results = await runPipelineIntegrationTest({
            testName: 'Create-Aggregations-KV (Python)',
            beamContent: CREATE_AGGREGATIONS_KV_BEAM,
            languages: ['Python']
        });
        expect(results.Python).toBe(true);
    }, 180000);
});

/**
 * Programmatic test runner for Create Aggregations KV suite.
 */
export async function runCreateAggregationsKvTest(): Promise<void> {
    const results = await runPipelineIntegrationTest({
        testName: 'Create-Aggregations-KV Pipeline',
        beamContent: CREATE_AGGREGATIONS_KV_BEAM,
        languages: ['Java', 'Python']
    });
    if (!results.Java || !results.Python) {
        throw new Error('Create Aggregations KV pipeline test failed');
    }
}
