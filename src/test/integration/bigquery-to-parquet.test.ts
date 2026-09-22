/**
 * BigQueryIO to ParquetIO Pipeline Integration Test
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Validates end-to-end code generation for Apache Beam batch pipelines exporting
 * data from BigQuery using SQL queries, projecting into columnar record types,
 * and writing Snappy-compressed Parquet files via ParquetIO.
 * Evaluates generated code using the Multi-Agent Evaluation Harness.
 *
 * Loads pipeline definition from sidecar file: bigquery-to-parquet.beam
 */

import { describe, it, expect } from 'vitest';
import { runPipelineIntegrationTest, loadBeamPipeline } from './codegen-runner';

const BIGQUERY_TO_PARQUET_BEAM = loadBeamPipeline('bigquery-to-parquet.beam');

describe('BigQueryIO to ParquetIO Pipeline Code Generation', () => {
    it('generates valid Java pipeline and passes Gemini evaluation', async () => {
        const results = await runPipelineIntegrationTest({
            testName: 'BigQueryIO-to-ParquetIO (Java)',
            beamContent: BIGQUERY_TO_PARQUET_BEAM,
            languages: ['Java']
        });
        expect(results.Java).toBe(true);
    }, 180000);

    it('generates valid Python pipeline and passes Gemini evaluation', async () => {
        const results = await runPipelineIntegrationTest({
            testName: 'BigQueryIO-to-ParquetIO (Python)',
            beamContent: BIGQUERY_TO_PARQUET_BEAM,
            languages: ['Python']
        });
        expect(results.Python).toBe(true);
    }, 180000);
});

/**
 * Programmatic test runner for BigQuery to Parquet suite.
 */
export async function runBigQueryToParquetTest(): Promise<void> {
    const results = await runPipelineIntegrationTest({
        testName: 'BigQueryIO-to-ParquetIO Pipeline',
        beamContent: BIGQUERY_TO_PARQUET_BEAM,
        languages: ['Java', 'Python']
    });
    if (!results.Java || !results.Python) {
        throw new Error('BigQuery to Parquet pipeline test failed');
    }
}
