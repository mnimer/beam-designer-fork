/**
 * MQTT to MQTT Retained with DLQ Pipeline Integration Test (I20)
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Validates end-to-end code generation for Apache Beam streaming IoT pipelines connecting
 * an MqttIO Source, a ParDo sensor threshold alert detector with a Dead Letter Queue (DLQ)
 * error branch, an MqttIO Sink with retained messages enabled and QoS 1, and a LogMessage DLQ Sink.
 * Evaluates generated code using the Multi-Agent Evaluation Harness.
 *
 * Loads pipeline definition from sidecar file: mqtt-to-mqtt-retained.beam
 */

import { describe, it, expect } from 'vitest';
import { runPipelineIntegrationTest, loadBeamPipeline } from './codegen-runner';

const MQTT_TO_MQTT_RETAINED_BEAM = loadBeamPipeline('mqtt-to-mqtt-retained.beam');

describe('MQTT to MQTT Retained with DLQ Pipeline Code Generation (I20)', () => {
    it('generates valid Java pipeline and passes Gemini evaluation', async () => {
        const results = await runPipelineIntegrationTest({
            testName: 'MQTT-to-MQTT-Retained (Java)',
            beamContent: MQTT_TO_MQTT_RETAINED_BEAM,
            languages: ['Java']
        });
        expect(results.Java).toBe(true);
    }, 180000);

    it('generates valid Python pipeline and passes Gemini evaluation', async () => {
        const results = await runPipelineIntegrationTest({
            testName: 'MQTT-to-MQTT-Retained (Python)',
            beamContent: MQTT_TO_MQTT_RETAINED_BEAM,
            languages: ['Python']
        });
        expect(results.Python).toBe(true);
    }, 180000);
});

/**
 * Programmatic test runner for MQTT to MQTT Retained test suite.
 */
export async function runMqttToMqttRetainedTest(): Promise<void> {
    const results = await runPipelineIntegrationTest({
        testName: 'MQTT-to-MQTT-Retained Pipeline',
        beamContent: MQTT_TO_MQTT_RETAINED_BEAM,
        languages: ['Java', 'Python']
    });
    if (!results.Java || !results.Python) {
        throw new Error('MQTT to MQTT retained pipeline integration test failed');
    }
}
