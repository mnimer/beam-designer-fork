/**
 * KafkaIO Source (python) Integration Test
 *
 * Generated integration test suite adhering to standardized DAG topology.
 * Evaluates generated Apache Beam repository across Python using Gemini 3.7 Flash.
 */

import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { runPipelineIntegrationTest, loadBeamPipeline } from '../../codegen-runner';

const PIPELINE_BEAM = loadBeamPipeline(path.join(__dirname, 'kafka-source.beam'));

describe('KafkaIO Source (python) Code Generation', () => {
    it('generates valid Python pipeline and passes multi-agent evaluation', async () => {
        const results = await runPipelineIntegrationTest({
            testName: 'KafkaIO Source (python) (Python)',
            beamContent: PIPELINE_BEAM,
            languages: ['Python']
        });
        expect(results.Python).toBe(true);
    }, 180000);
});

/**
 * Programmatic test runner for KafkaIO Source (python).
 */
export async function runKafkaSourceTest(): Promise<void> {
    const results = await runPipelineIntegrationTest({
        testName: 'KafkaIO Source (python)',
        beamContent: PIPELINE_BEAM,
        languages: ['Python']
    });
    if (!results.Python) {
        throw new Error('KafkaIO Source (python) pipeline test failed');
    }
}
