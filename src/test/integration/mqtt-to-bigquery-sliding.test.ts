/**
 * MqttIO to BigQueryIO Sliding Window Pipeline Integration Test (I9)
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Validates end-to-end code generation for Apache Beam streaming pipelines connecting
 * an MQTT broker source (subscribing to sensors/# with QoS 1),
 * a ParseMessage JSON step, a Sliding Window transform (300s duration, 60s period),
 * a Mean combiner per sensor, and a BigQueryIO sink using streaming inserts.
 * Evaluates generated code using the Multi-Agent Evaluation Harness.
 *
 * Loads pipeline definition from sidecar file: mqtt-to-bigquery-sliding.beam
 */

import { describe, it, expect } from 'vitest';
import { runPipelineIntegrationTest, loadBeamPipeline } from './codegen-runner';

const MQTT_TO_BIGQUERY_SLIDING_BEAM = loadBeamPipeline('mqtt-to-bigquery-sliding.beam');

describe('MqttIO to BigQueryIO Sliding Window Pipeline Code Generation', () => {
    it('generates valid Java pipeline and passes Gemini evaluation', async () => {
        const results = await runPipelineIntegrationTest({
            testName: 'MqttIO-to-BigQueryIO-Sliding (Java)',
            beamContent: MQTT_TO_BIGQUERY_SLIDING_BEAM,
            languages: ['Java']
        });
        expect(results.Java).toBe(true);
    }, 180000);

    it('generates valid Python pipeline and passes Gemini evaluation', async () => {
        const results = await runPipelineIntegrationTest({
            testName: 'MqttIO-to-BigQueryIO-Sliding (Python)',
            beamContent: MQTT_TO_BIGQUERY_SLIDING_BEAM,
            languages: ['Python']
        });
        expect(results.Python).toBe(true);
    }, 180000);
});

/**
 * Programmatic test runner for Mqtt to BigQuery Sliding suite.
 */
export async function runMqttToBigQuerySlidingTest(): Promise<void> {
    const results = await runPipelineIntegrationTest({
        testName: 'MqttIO-to-BigQueryIO-Sliding Pipeline',
        beamContent: MQTT_TO_BIGQUERY_SLIDING_BEAM,
        languages: ['Java', 'Python']
    });
    if (!results.Java || !results.Python) {
        throw new Error('Mqtt to BigQuery Sliding pipeline test failed');
    }
}
