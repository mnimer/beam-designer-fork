/**
 * PubSubIO to BigQueryIO Pipeline Integration Test
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Validates end-to-end code generation for Apache Beam streaming pipelines connecting
 * a Google Cloud Pub/Sub source (subscription read with timestamp attributes),
 * a ParseMessage JSON step, a ParDo schema validation step with tagged DLQ error routing,
 * a BigQueryIO sink using the Storage Write API, and a LogMessage error sink.
 * Evaluates generated code using the Multi-Agent Evaluation Harness.
 *
 * Loads pipeline definition from sidecar file: pubsub-to-bigquery.beam
 */

import { describe, it, expect } from 'vitest';
import { runPipelineIntegrationTest, loadBeamPipeline } from './codegen-runner';

const PUBSUB_TO_BIGQUERY_BEAM = loadBeamPipeline('pubsub-to-bigquery.beam');

describe('PubSubIO to BigQueryIO Pipeline Code Generation', () => {
    it('generates valid Java pipeline and passes Gemini evaluation', async () => {
        const results = await runPipelineIntegrationTest({
            testName: 'PubSubIO-to-BigQueryIO (Java)',
            beamContent: PUBSUB_TO_BIGQUERY_BEAM,
            languages: ['Java']
        });
        expect(results.Java).toBe(true);
    }, 180000);

    it('generates valid Python pipeline and passes Gemini evaluation', async () => {
        const results = await runPipelineIntegrationTest({
            testName: 'PubSubIO-to-BigQueryIO (Python)',
            beamContent: PUBSUB_TO_BIGQUERY_BEAM,
            languages: ['Python']
        });
        expect(results.Python).toBe(true);
    }, 180000);
});

/**
 * Programmatic test runner for PubSub to BigQuery suite.
 */
export async function runPubSubToBigQueryTest(): Promise<void> {
    const results = await runPipelineIntegrationTest({
        testName: 'PubSubIO-to-BigQueryIO Pipeline',
        beamContent: PUBSUB_TO_BIGQUERY_BEAM,
        languages: ['Java', 'Python']
    });
    if (!results.Java || !results.Python) {
        throw new Error('PubSub to BigQuery pipeline test failed');
    }
}
