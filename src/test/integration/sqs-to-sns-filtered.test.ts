/**
 * SqsIO to SnsIO Filtered Pipeline Integration Test (I8)
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Validates end-to-end code generation for Apache Beam streaming pipelines connecting
 * an Amazon SQS source (reading up to 100 records from an SQS queue),
 * a Filter transform filtering for high-priority messages,
 * a ParDo enrichment transform, and an Amazon SNS topic sink.
 * Evaluates generated code using the Multi-Agent Evaluation Harness.
 *
 * Loads pipeline definition from sidecar file: sqs-to-sns-filtered.beam
 */

import { describe, it, expect } from 'vitest';
import { runPipelineIntegrationTest, loadBeamPipeline } from './codegen-runner';

const SQS_TO_SNS_FILTERED_BEAM = loadBeamPipeline('sqs-to-sns-filtered.beam');

describe('SqsIO to SnsIO Filtered Pipeline Code Generation', () => {
    it('generates valid Java pipeline and passes Gemini evaluation', async () => {
        const results = await runPipelineIntegrationTest({
            testName: 'SqsIO-to-SnsIO-Filtered (Java)',
            beamContent: SQS_TO_SNS_FILTERED_BEAM,
            languages: ['Java']
        });
        expect(results.Java).toBe(true);
    }, 180000);

    it('generates valid Python pipeline and passes Gemini evaluation', async () => {
        const results = await runPipelineIntegrationTest({
            testName: 'SqsIO-to-SnsIO-Filtered (Python)',
            beamContent: SQS_TO_SNS_FILTERED_BEAM,
            languages: ['Python']
        });
        expect(results.Python).toBe(true);
    }, 180000);
});

/**
 * Programmatic test runner for Sqs to Sns Filtered suite.
 */
export async function runSqsToSnsFilteredTest(): Promise<void> {
    const results = await runPipelineIntegrationTest({
        testName: 'SqsIO-to-SnsIO-Filtered Pipeline',
        beamContent: SQS_TO_SNS_FILTERED_BEAM,
        languages: ['Java', 'Python']
    });
    if (!results.Java || !results.Python) {
        throw new Error('Sqs to Sns Filtered pipeline test failed');
    }
}
