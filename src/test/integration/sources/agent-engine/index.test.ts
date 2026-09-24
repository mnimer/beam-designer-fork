/**
 * Master Test Suite for Sources (agent-engine)
 */
import { describe, it, expect } from 'vitest';
import { runPubsubSourceTest } from './pubsub-source.test';
import { runKafkaSourceTest } from './kafka-source.test';
import { runKinesisSourceTest } from './kinesis-source.test';
import { runSnsSourceTest } from './sns-source.test';
import { runSqsSourceTest } from './sqs-source.test';
import { runJmsSourceTest } from './jms-source.test';
import { runMqttSourceTest } from './mqtt-source.test';
import { runBigquerySourceTest } from './bigquery-source.test';
import { runJdbcSourceTest } from './jdbc-source.test';
import { runFileSourceTest } from './file-source.test';
import { runParquetSourceTest } from './parquet-source.test';
import { runAvroSourceTest } from './avro-source.test';
import { runTextSourceTest } from './text-source.test';
import { runCreateSourceTest } from './create-source.test';
import { runGeneratesequenceSourceTest } from './generatesequence-source.test';
import { runPeriodicimpulseSourceTest } from './periodicimpulse-source.test';

export async function runAllSourcesAgentengineTests(): Promise<void> {
    console.log('Running all Source integration tests for agent-engine...');
    await runPubsubSourceTest();
    await runKafkaSourceTest();
    await runKinesisSourceTest();
    await runSnsSourceTest();
    await runSqsSourceTest();
    await runJmsSourceTest();
    await runMqttSourceTest();
    await runBigquerySourceTest();
    await runJdbcSourceTest();
    await runFileSourceTest();
    await runParquetSourceTest();
    await runAvroSourceTest();
    await runTextSourceTest();
    await runCreateSourceTest();
    await runGeneratesequenceSourceTest();
    await runPeriodicimpulseSourceTest();
}

describe('Sources Suite (agent-engine)', () => {
    it('is registered and ready for execution', () => {
        expect(typeof runAllSourcesAgentengineTests).toBe('function');
    });
});
