/**
 * TREP WebSocket Mid-Price Contribution Pipeline Integration Test (IO72)
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Validates end-to-end code generation for an Apache Beam streaming pipeline that consumes
 * FX quotes from Refinitiv TREP/ERT with the community TrepWsIO source (ERT token auth with
 * the password resolved from Google Cloud Secret Manager via passwordSecret, plus service
 * discovery), computes a mid price in a ParDo, and posts it to an internal ADS contribution
 * service through the TrepWsIO Sink bridge (a DoFn over the documented Refinitiv WebSocket
 * API: tr_json2 Login and off-stream Post with Ack). Also guards against the upstream
 * TrepWsIO.withAuthServer() bug (it must never be emitted).
 * Evaluates generated code using the Multi-Agent Evaluation Harness.
 *
 * Java only: TASK.md IO72 targets Java, and TrepWsIO is a Java-only connector.
 *
 * Loads pipeline definition from sidecar file: trepwsio.beam
 */

import { describe, it, expect } from 'vitest';
import { runPipelineIntegrationTest, loadBeamPipeline } from './codegen-runner';

const TREPWSIO_BEAM = loadBeamPipeline('trepwsio.beam');

describe('TREP WebSocket Mid-Price Contribution Pipeline Code Generation (IO72)', () => {
    it('generates valid Java pipeline and passes Gemini evaluation', async () => {
        const results = await runPipelineIntegrationTest({
            testName: 'TrepWsIO-Mid-Price-Contribution (Java)',
            beamContent: TREPWSIO_BEAM,
            languages: ['Java']
        });
        expect(results.Java).toBe(true);
    }, 180000);
});

/**
 * Programmatic test runner for the TrepWsIO test suite.
 */
export async function runTrepWsIOTest(): Promise<void> {
    const results = await runPipelineIntegrationTest({
        testName: 'TrepWsIO-Mid-Price-Contribution Pipeline',
        beamContent: TREPWSIO_BEAM,
        languages: ['Java']
    });
    if (!results.Java) {
        throw new Error('TrepWsIO pipeline integration test failed');
    }
}
