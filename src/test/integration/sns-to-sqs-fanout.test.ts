/**
 * SNS to SQS Fanout Pipeline Integration Test (I19)
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Validates end-to-end code generation for Apache Beam streaming pipelines connecting
 * an Amazon SNS Topic Source (via SQS subscription queue), a ParDo transform unpacking
 * SNS notification envelopes and filtering message attributes, and an Amazon SQS Sink.
 * Evaluates generated code using the Multi-Agent Evaluation Harness.
 *
 * Loads pipeline definition from sidecar file: sns-to-sqs-fanout.beam
 */

import { describe, it, expect } from 'vitest';
import { runPipelineIntegrationTest, loadBeamPipeline } from './codegen-runner';

const SNS_TO_SQS_FANOUT_BEAM = loadBeamPipeline('sns-to-sqs-fanout.beam');

describe('SNS to SQS Fanout Pipeline Code Generation (I19)', () => {
    it('generates valid Java pipeline and passes Gemini evaluation', async () => {
        const results = await runPipelineIntegrationTest({
            testName: 'SNS-to-SQS-Fanout (Java)',
            beamContent: SNS_TO_SQS_FANOUT_BEAM,
            languages: ['Java']
        });
        expect(results.Java).toBe(true);
    }, 180000);

    it('generates valid Python pipeline and passes Gemini evaluation', async () => {
        const results = await runPipelineIntegrationTest({
            testName: 'SNS-to-SQS-Fanout (Python)',
            beamContent: SNS_TO_SQS_FANOUT_BEAM,
            languages: ['Python']
        });
        expect(results.Python).toBe(true);
    }, 180000);
});

/**
 * Programmatic test runner for SNS to SQS Fanout test suite.
 */
export async function runSnsToSqsFanoutTest(): Promise<void> {
    const results = await runPipelineIntegrationTest({
        testName: 'SNS-to-SQS-Fanout Pipeline',
        beamContent: SNS_TO_SQS_FANOUT_BEAM,
        languages: ['Java', 'Python']
    });
    if (!results.Java || !results.Python) {
        throw new Error('SNS to SQS fanout pipeline integration test failed');
    }
}
