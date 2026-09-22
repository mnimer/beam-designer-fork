/**
 * Multi-Source Ingestion, Merge, and Reshuffle Integration Test (I16)
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Validates end-to-end code generation for Apache Beam streaming pipelines connecting
 * PubSubIO Source + KafkaIO Source, ParseMessage (normalize to common schema),
 * Flatten (merge PCollections), Reshuffle (worker partition rebalancing & fusion breaking),
 * and BigQueryIO Sink.
 * Evaluates generated code using the Multi-Agent Evaluation Harness.
 *
 * Loads pipeline definition from sidecar file: multi-source-flatten-bigquery.beam
 */

import { describe, it, expect } from 'vitest';
import { runPipelineIntegrationTest, loadBeamPipeline } from './codegen-runner';

const MULTI_SOURCE_FLATTEN_BIGQUERY_BEAM = loadBeamPipeline('multi-source-flatten-bigquery.beam');

describe('Multi-Source Flatten to BigQuery Pipeline Code Generation (I16)', () => {
    it('generates valid Java pipeline and passes Gemini evaluation', async () => {
        const results = await runPipelineIntegrationTest({
            testName: 'Multi-Source-Flatten-BigQuery (Java)',
            beamContent: MULTI_SOURCE_FLATTEN_BIGQUERY_BEAM,
            languages: ['Java']
        });
        expect(results.Java).toBe(true);
    }, 180000);

    it('generates valid Python pipeline and passes Gemini evaluation', async () => {
        const results = await runPipelineIntegrationTest({
            testName: 'Multi-Source-Flatten-BigQuery (Python)',
            beamContent: MULTI_SOURCE_FLATTEN_BIGQUERY_BEAM,
            languages: ['Python']
        });
        expect(results.Python).toBe(true);
    }, 180000);
});

/**
 * Programmatic test runner for Multi-Source Flatten to BigQuery test suite.
 */
export async function runMultiSourceFlattenBigQueryTest(): Promise<void> {
    const results = await runPipelineIntegrationTest({
        testName: 'Multi-Source-Flatten-BigQuery Pipeline',
        beamContent: MULTI_SOURCE_FLATTEN_BIGQUERY_BEAM,
        languages: ['Java', 'Python']
    });
    if (!results.Java || !results.Python) {
        throw new Error('Multi-Source Flatten to BigQuery pipeline integration test failed');
    }
}
