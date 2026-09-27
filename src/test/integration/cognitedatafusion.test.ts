/**
 * Cognite Data Fusion Events Curation Pipeline Integration Test (IO69)
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Validates end-to-end code generation for an Apache Beam batch pipeline that reads
 * maintenance Events from Cognite Data Fusion with the community Cognite Beam connector
 * (CogniteIO.readEvents), curates them in a ParDo, and upserts them into a second CDF
 * project (CogniteIO.writeEvents). Both CDF nodes authenticate with OAuth2 client
 * credentials whose client secret is a Google Cloud Secret Manager reference
 * (clientSecretSecret) resolved natively by the connector's GcpSecretConfig.
 * Evaluates generated code using the Multi-Agent Evaluation Harness.
 *
 * Java only: TASK.md IO69 targets Java, and the Cognite Beam connector has no Python SDK.
 *
 * Loads pipeline definition from sidecar file: cognitedatafusion.beam
 */

import { describe, it, expect } from 'vitest';
import { runPipelineIntegrationTest, loadBeamPipeline } from './codegen-runner';

const COGNITE_DATA_FUSION_BEAM = loadBeamPipeline('cognitedatafusion.beam');

describe('Cognite Data Fusion Events Curation Pipeline Code Generation (IO69)', () => {
    it('generates valid Java pipeline and passes Gemini evaluation', async () => {
        const results = await runPipelineIntegrationTest({
            testName: 'CogniteDataFusion-Events-Curation (Java)',
            beamContent: COGNITE_DATA_FUSION_BEAM,
            languages: ['Java']
        });
        expect(results.Java).toBe(true);
    }, 180000);
});

/**
 * Programmatic test runner for the Cognite Data Fusion test suite.
 */
export async function runCogniteDataFusionTest(): Promise<void> {
    const results = await runPipelineIntegrationTest({
        testName: 'CogniteDataFusion-Events-Curation Pipeline',
        beamContent: COGNITE_DATA_FUSION_BEAM,
        languages: ['Java']
    });
    if (!results.Java) {
        throw new Error('Cognite Data Fusion pipeline integration test failed');
    }
}
