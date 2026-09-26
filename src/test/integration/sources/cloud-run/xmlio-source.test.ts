/**
 * XmlIO Source (cloud-run) Integration Test
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Generated integration test suite adhering to standardized DAG topology.
 * Evaluates generated Apache Beam repository across Java using Gemini 3.7 Flash.
 */

import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { runPipelineIntegrationTest, loadBeamPipeline } from '../../codegen-runner';

const PIPELINE_BEAM = loadBeamPipeline(path.join(__dirname, 'xmlio-source.beam'));

describe('XmlIO Source (cloud-run) Code Generation', () => {
    it('generates valid Java pipeline and passes multi-agent evaluation', async () => {
        const results = await runPipelineIntegrationTest({
            testName: 'XmlIO Source (cloud-run) (Java)',
            beamContent: PIPELINE_BEAM,
            languages: ['Java']
        });
        expect(results.Java).toBe(true);
    }, 180000);});

/**
 * Programmatic test runner for XmlIO Source (cloud-run).
 */
export async function runXmlioSourceTest(): Promise<void> {
    const results = await runPipelineIntegrationTest({
        testName: 'XmlIO Source (cloud-run)',
        beamContent: PIPELINE_BEAM,
        languages: ['Java']
    });
    if (!results.Java) {
        throw new Error('XmlIO Source (cloud-run) pipeline test failed');
    }
}
