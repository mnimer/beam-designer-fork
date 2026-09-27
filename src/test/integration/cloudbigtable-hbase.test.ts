/**
 * Cloud Bigtable (HBase based) Pipeline Integration Test (IO68)
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Validates end-to-end code generation for an Apache Beam batch pipeline connecting
 * a Cloud Bigtable (HBase based) Source (CloudBigtableIO.read with an HBase Scan),
 * a ParDo converting HBase Results into archive Puts, and a Cloud Bigtable (HBase based)
 * Sink (CloudBigtableIO.writeToTable) whose service-account key is resolved from
 * Secret Manager at runtime. Java only: the connector's target language per TASK.md IO68.
 * Evaluates generated code using the Multi-Agent Evaluation Harness.
 *
 * Loads pipeline definition from sidecar file: cloudbigtable-hbase.beam
 */

import { describe, it, expect } from 'vitest';
import { runPipelineIntegrationTest, loadBeamPipeline } from './codegen-runner';

const CLOUDBIGTABLE_HBASE_BEAM = loadBeamPipeline('cloudbigtable-hbase.beam');

describe('Cloud Bigtable (HBase based) Pipeline Code Generation (IO68)', () => {
    it('generates valid Java pipeline and passes Gemini evaluation', async () => {
        const results = await runPipelineIntegrationTest({
            testName: 'CloudBigtable-HBase-Archive (Java)',
            beamContent: CLOUDBIGTABLE_HBASE_BEAM,
            languages: ['Java']
        });
        expect(results.Java).toBe(true);
    }, 180000);
});

/**
 * Programmatic test runner for the Cloud Bigtable (HBase based) integration test suite.
 */
export async function runCloudBigtableHbaseTest(): Promise<void> {
    const results = await runPipelineIntegrationTest({
        testName: 'CloudBigtable-HBase-Archive Pipeline',
        beamContent: CLOUDBIGTABLE_HBASE_BEAM,
        languages: ['Java']
    });
    if (!results.Java) {
        throw new Error('Cloud Bigtable (HBase based) pipeline integration test failed');
    }
}
