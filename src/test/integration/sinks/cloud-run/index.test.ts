/**
 * Master Test Suite for Sinks (cloud-run)
 */
import { describe, it, expect } from 'vitest';
import { runBigquerySinkTest } from './bigquery-sink.test';
import { runJdbcSinkTest } from './jdbc-sink.test';
import { runFileSinkTest } from './file-sink.test';
import { runParquetSinkTest } from './parquet-sink.test';
import { runAvroSinkTest } from './avro-sink.test';
import { runTextSinkTest } from './text-sink.test';
import { runLogmessageSinkTest } from './logmessage-sink.test';
import { runPubsubSinkTest } from './pubsub-sink.test';
import { runKafkaSinkTest } from './kafka-sink.test';
import { runKinesisSinkTest } from './kinesis-sink.test';
import { runSnsSinkTest } from './sns-sink.test';
import { runSqsSinkTest } from './sqs-sink.test';
import { runJmsSinkTest } from './jms-sink.test';
import { runMqttSinkTest } from './mqtt-sink.test';

export async function runAllSinksCloudrunTests(): Promise<void> {
    console.log('Running all Sink integration tests for cloud-run...');
    await runBigquerySinkTest();
    await runJdbcSinkTest();
    await runFileSinkTest();
    await runParquetSinkTest();
    await runAvroSinkTest();
    await runTextSinkTest();
    await runLogmessageSinkTest();
    await runPubsubSinkTest();
    await runKafkaSinkTest();
    await runKinesisSinkTest();
    await runSnsSinkTest();
    await runSqsSinkTest();
    await runJmsSinkTest();
    await runMqttSinkTest();
}

describe('Sinks Suite (cloud-run)', () => {
    it('is registered and ready for execution', () => {
        expect(typeof runAllSinksCloudrunTests).toBe('function');
    });
});
