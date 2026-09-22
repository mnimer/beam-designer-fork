/**
 * TextIO WordCount Pipeline Integration Test
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Validates end-to-end code generation for canonical Apache Beam WordCount batch pipelines
 * connecting TextIO ReadLines source, FlatMap ExtractWords tokenizer, Count CountWords combiner,
 * Map FormatAsText formatter, and TextIO WriteCounts sink (matching the official Beam Getting Started Quickstart).
 * Evaluates generated code using the Multi-Agent Evaluation Harness.
 *
 * Loads pipeline definition from sidecar file: textio-wordcount.beam
 */

import { describe, it, expect } from 'vitest';
import { runPipelineIntegrationTest, loadBeamPipeline } from './codegen-runner';

const TEXTIO_WORDCOUNT_BEAM = loadBeamPipeline('textio-wordcount.beam');

describe('TextIO WordCount Pipeline Code Generation', () => {
    it('generates valid Java pipeline and passes Gemini evaluation', async () => {
        const results = await runPipelineIntegrationTest({
            testName: 'TextIO-WordCount (Java)',
            beamContent: TEXTIO_WORDCOUNT_BEAM,
            languages: ['Java']
        });
        expect(results.Java).toBe(true);
    }, 180000);

    it('generates valid Python pipeline and passes Gemini evaluation', async () => {
        const results = await runPipelineIntegrationTest({
            testName: 'TextIO-WordCount (Python)',
            beamContent: TEXTIO_WORDCOUNT_BEAM,
            languages: ['Python']
        });
        expect(results.Python).toBe(true);
    }, 180000);
});

/**
 * Programmatic test runner for TextIO WordCount suite.
 */
export async function runTextIoWordCountTest(): Promise<void> {
    const results = await runPipelineIntegrationTest({
        testName: 'TextIO-WordCount Pipeline',
        beamContent: TEXTIO_WORDCOUNT_BEAM,
        languages: ['Java', 'Python']
    });
    if (!results.Java || !results.Python) {
        throw new Error('TextIO WordCount pipeline test failed');
    }
}
