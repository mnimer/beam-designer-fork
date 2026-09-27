/**
 * KineticaDB (IO70) Pipeline Integration Test
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Validates end-to-end code generation for an Apache Beam pipeline that reads raw
 * IoT sensor readings from Kinetica via the Kinetica Beam connector (KineticaIO.read),
 * normalizes temperatures in a ParDo, and writes the curated rows back to Kinetica
 * (KineticaIO.write). The Kinetica password is supplied as a Google Cloud Secret
 * Manager reference (passwordSecret) and must be resolved at pipeline construction.
 * Evaluates generated code using the Multi-Agent Evaluation Harness.
 *
 * Loads pipeline definition from sidecar file: kineticadb.beam
 *
 * Architectural decisions:
 * - Java only: the Kinetica connector (com.kinetica:apache-beam-kineticaio) is a
 *   Java-SDK library with no Python SDK or registered cross-language expansion
 *   service, so a Python generation would have nothing native to target.
 * - Not registered in codegen.test.ts (that aggregator re-registers every suite).
 */

import { describe, it, expect } from 'vitest';
import { runPipelineIntegrationTest, loadBeamPipeline } from './codegen-runner';

const KINETICADB_BEAM = loadBeamPipeline('kineticadb.beam');

describe('KineticaDB (IO70) Pipeline Code Generation', () => {
    it('generates valid Java pipeline and passes Gemini evaluation', async () => {
        const results = await runPipelineIntegrationTest({
            testName: 'KineticaDB-to-KineticaDB (Java)',
            beamContent: KINETICADB_BEAM,
            languages: ['Java']
        });
        expect(results.Java).toBe(true);
    }, 180000);
});

/**
 * Programmatic test runner for the KineticaDB integration test suite.
 */
export async function runKineticaDbTest(): Promise<void> {
    const results = await runPipelineIntegrationTest({
        testName: 'KineticaDB-to-KineticaDB Pipeline',
        beamContent: KINETICADB_BEAM,
        languages: ['Java']
    });
    if (!results.Java) {
        throw new Error('KineticaDB pipeline test failed');
    }
}
