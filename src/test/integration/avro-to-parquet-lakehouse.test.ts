/**
 * AvroIO to ParquetIO Lakehouse Pipeline Integration Test (I12)
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Validates end-to-end code generation for Apache Beam pipelines migrating binary Avro
 * records into columnar Snappy-compressed Parquet lakehouse files using AvroIO, Map schema
 * projection, and ParquetIO.
 * Evaluates generated code using the Multi-Agent Evaluation Harness.
 *
 * Loads pipeline definition from sidecar file: avro-to-parquet-lakehouse.beam
 */

import { describe, it, expect } from 'vitest';
import { runPipelineIntegrationTest, loadBeamPipeline } from './codegen-runner';

const AVRO_TO_PARQUET_LAKEHOUSE_BEAM = loadBeamPipeline('avro-to-parquet-lakehouse.beam');

describe('AvroIO to ParquetIO Lakehouse Pipeline Code Generation', () => {
    it('generates valid Java pipeline and passes Gemini evaluation', async () => {
        const results = await runPipelineIntegrationTest({
            testName: 'Avro-to-Parquet-Lakehouse (Java)',
            beamContent: AVRO_TO_PARQUET_LAKEHOUSE_BEAM,
            languages: ['Java']
        });
        expect(results.Java).toBe(true);
    }, 180000);

    it('generates valid Python pipeline and passes Gemini evaluation', async () => {
        const results = await runPipelineIntegrationTest({
            testName: 'Avro-to-Parquet-Lakehouse (Python)',
            beamContent: AVRO_TO_PARQUET_LAKEHOUSE_BEAM,
            languages: ['Python']
        });
        expect(results.Python).toBe(true);
    }, 180000);
});

/**
 * Programmatic test runner for Avro to Parquet Lakehouse suite.
 */
export async function runAvroToParquetLakehouseTest(): Promise<void> {
    const results = await runPipelineIntegrationTest({
        testName: 'Avro-to-Parquet-Lakehouse Pipeline',
        beamContent: AVRO_TO_PARQUET_LAKEHOUSE_BEAM,
        languages: ['Java', 'Python']
    });
    if (!results.Java || !results.Python) {
        throw new Error('Avro to Parquet Lakehouse pipeline test failed');
    }
}
