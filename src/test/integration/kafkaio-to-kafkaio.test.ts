/**
 * KafkaIO to KafkaIO Pipeline Integration Test
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Validates end-to-end code generation for Apache Beam streaming pipelines connecting
 * a KafkaIO streaming source, a ParDo processing step with error routing,
 * a KafkaIO streaming sink with exactly-once semantics, and a LogMessage error sink.
 * Evaluates generated code against the Code Generation System Prompt using Gemini.
 */

import { describe, it, expect } from 'vitest';
import { runPipelineIntegrationTest } from './codegen-runner';

const KAFKAIO_TO_KAFKAIO_YAML = `nodes:
  - id: "1787183624209"
    type: pipeline
    position:
      x: 246.5
      y: 138
    data:
      label: Kafka
      type: SOURCE
      iconName: Cable
      beam_transform: KafkaIO
      properties:
        maxNumRecords: "99"
        maxReadTime: "60"
        valueDeserializer: org.apache.kafka.common.serialization.ByteArrayDeserializer
        keyDeserializer: org.apache.kafka.common.serialization.StringDeserializer
        groupId: beam-consumer
        topics: test-topic
    width: 180
    height: 62
    selected: false
    dragging: false
  - id: "1787183627568"
    type: pipeline
    position:
      x: 528.5
      y: 144
    data:
      label: ParDo
      type: STEP
      iconName: Code
      beam_transform: ParDo
      properties:
        codeGenerationPrompt: "Convert byteArray to json, return json. "
      system_instructions: Wrap the generated code in a try/catch, returning all
        errors to a separate pcollection
    width: 180
    height: 62
    selected: false
    positionAbsolute:
      x: 528.5
      y: 144
    dragging: false
  - id: "1787183631537"
    type: pipeline
    position:
      x: 816.8
      y: 131
    data:
      label: Kafka
      type: SINK
      iconName: Cable
      beam_transform: KafkaIO
      properties:
        topic: output-topic
        keySerializer: org.apache.kafka.common.serialization.StringSerializer
        useEOS: true
        bootstrapServers: localhost:9092
    width: 180
    height: 62
    selected: false
    positionAbsolute:
      x: 816.8
      y: 131
    dragging: false
  - id: "1787183639017"
    type: pipeline
    position:
      x: 747
      y: 300
    data:
      label: Log Message
      type: STEP
      iconName: Terminal
      beam_transform: LogMessage
    width: 180
    height: 62
edges:
  - id: e-1787183624209-1787183627568
    source: "1787183624209"
    target: "1787183627568"
  - source: "1787183627568"
    sourceHandle: valid
    target: "1787183631537"
    targetHandle: null
    id: reactflow__edge-1787183627568valid-1787183631537
  - source: "1787183627568"
    sourceHandle: error
    target: "1787183639017"
    targetHandle: null
    id: reactflow__edge-1787183627568error-1787183639017
runtimeVariables:
  - key: JOB_ID
    value: kafkaio-to-kafkaio
jobConfig:
  runner: DirectRunner
  machineType: n1-standard-1
  minInstances: 1
  maxInstances: 10
  gcsStagingPath: ""
  network: ""
  subnetwork: ""
pipelineConfig:
  language: Java
  outputFolder: kafkaio-to-kafkaio
  needsRebuild: true
`;

describe('KafkaIO to KafkaIO Pipeline Code Generation', () => {
    it('generates valid Java pipeline and passes Gemini evaluation', async () => {
        const results = await runPipelineIntegrationTest({
            testName: 'KafkaIO-to-KafkaIO (Java)',
            yamlContent: KAFKAIO_TO_KAFKAIO_YAML,
            languages: ['Java']
        });
        expect(results.Java).toBe(true);
    }, 180000);

    it('generates valid Python pipeline and passes Gemini evaluation', async () => {
        const results = await runPipelineIntegrationTest({
            testName: 'KafkaIO-to-KafkaIO (Python)',
            yamlContent: KAFKAIO_TO_KAFKAIO_YAML,
            languages: ['Python']
        });
        expect(results.Python).toBe(true);
    }, 180000);
});

/**
 * Programmatic test runner for KafkaIO to KafkaIO suite.
 */
export async function runKafkaIoToKafkaIoTest(): Promise<void> {
    const results = await runPipelineIntegrationTest({
        testName: 'KafkaIO-to-KafkaIO Pipeline',
        yamlContent: KAFKAIO_TO_KAFKAIO_YAML,
        languages: ['Java', 'Python']
    });
    if (!results.Java || !results.Python) {
        throw new Error('KafkaIO to KafkaIO pipeline test failed');
    }
}
