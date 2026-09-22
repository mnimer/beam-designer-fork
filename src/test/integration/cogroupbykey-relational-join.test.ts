/**
 * Multi-Collection Relational Join Integration Test (I17)
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Validates end-to-end code generation for Apache Beam batch pipelines connecting
 * Create Sources (Orders & Customers), KVMapper (keyed by customerId), CoGroupByKey,
 * ParDo (relational inner/left join), and TextIO Sink.
 * Evaluates generated code using the Multi-Agent Evaluation Harness.
 *
 * Loads pipeline definition from sidecar file: cogroupbykey-relational-join.beam
 */

import { describe, it, expect } from 'vitest';
import { runPipelineIntegrationTest, loadBeamPipeline } from './codegen-runner';

const COGROUPBYKEY_RELATIONAL_JOIN_BEAM = loadBeamPipeline('cogroupbykey-relational-join.beam');

describe('CoGroupByKey Relational Join Pipeline Code Generation (I17)', () => {
    it('generates valid Java pipeline and passes Gemini evaluation', async () => {
        const results = await runPipelineIntegrationTest({
            testName: 'CoGroupByKey-Relational-Join (Java)',
            beamContent: COGROUPBYKEY_RELATIONAL_JOIN_BEAM,
            languages: ['Java']
        });
        expect(results.Java).toBe(true);
    }, 180000);

    it('generates valid Python pipeline and passes Gemini evaluation', async () => {
        const results = await runPipelineIntegrationTest({
            testName: 'CoGroupByKey-Relational-Join (Python)',
            beamContent: COGROUPBYKEY_RELATIONAL_JOIN_BEAM,
            languages: ['Python']
        });
        expect(results.Python).toBe(true);
    }, 180000);
});

/**
 * Programmatic test runner for CoGroupByKey Relational Join test suite.
 */
export async function runCoGroupByKeyRelationalJoinTest(): Promise<void> {
    const results = await runPipelineIntegrationTest({
        testName: 'CoGroupByKey-Relational-Join Pipeline',
        beamContent: COGROUPBYKEY_RELATIONAL_JOIN_BEAM,
        languages: ['Java', 'Python']
    });
    if (!results.Java || !results.Python) {
        throw new Error('CoGroupByKey relational join pipeline integration test failed');
    }
}
