/**
 * FileIO Dynamic Destinations Pipeline Integration Test (I11)
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Validates end-to-end code generation for Apache Beam pipelines using FileIO
 * to match and read CSV files, extract date/country partition keys via ParDo,
 * and dynamically write output partitioned by country using FileIO writeDynamic.
 * Evaluates generated code using the Multi-Agent Evaluation Harness.
 *
 * Loads pipeline definition from sidecar file: fileio-dynamic-destinations.beam
 *
 * Architectural decisions:
 * - Keeps test definitions declarative by separating pipeline configuration (.beam sidecar) from evaluation logic.
 * - Implements individual language-specific Vitest assertions for isolated error reporting per-language.
 * - Sets a robust timeout (180s) to handle generative latency from the underlying Gemini model.
 * - Provides a programmatic entrypoint (runFileIoDynamicDestinationsTest) to allow execution outside of test runners.
 */

import { describe, it, expect } from 'vitest';
import { runPipelineIntegrationTest, loadBeamPipeline } from './codegen-runner';

const FILEIO_DYNAMIC_DESTINATIONS_BEAM = loadBeamPipeline('fileio-dynamic-destinations.beam');

describe('FileIO Dynamic Destinations Pipeline Code Generation', () => {
    it('generates valid Java pipeline and passes Gemini evaluation', async () => {
        const results = await runPipelineIntegrationTest({
            testName: 'FileIO-Dynamic-Destinations (Java)',
            beamContent: FILEIO_DYNAMIC_DESTINATIONS_BEAM,
            languages: ['Java']
        });
        expect(results.Java).toBe(true);
    }, 180000);

    it('generates valid Python pipeline and passes Gemini evaluation', async () => {
        const results = await runPipelineIntegrationTest({
            testName: 'FileIO-Dynamic-Destinations (Python)',
            beamContent: FILEIO_DYNAMIC_DESTINATIONS_BEAM,
            languages: ['Python']
        });
        expect(results.Python).toBe(true);
    }, 180000);
});

/**
 * Programmatic test runner for FileIO Dynamic Destinations suite.
 */
export async function runFileIoDynamicDestinationsTest(): Promise<void> {
    const results = await runPipelineIntegrationTest({
        testName: 'FileIO-Dynamic-Destinations Pipeline',
        beamContent: FILEIO_DYNAMIC_DESTINATIONS_BEAM,
        languages: ['Java', 'Python']
    });
    if (!results.Java || !results.Python) {
        throw new Error('FileIO Dynamic Destinations pipeline test failed');
    }
}
