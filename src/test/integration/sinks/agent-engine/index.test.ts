/**
 * Master Test Suite for Sinks (agent-engine)
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
import { runSplunkSinkTest } from './splunk-sink.test';
import { runFhirSinkTest } from './fhir-sink.test';
import { runHl7v2SinkTest } from './hl7v2-sink.test';
import { runDicomSinkTest } from './dicom-sink.test';
import { runWebapisSinkTest } from './webapis-sink.test';
import { runDatadogSinkTest } from './datadog-sink.test';
import { runAmqpSinkTest } from './amqp-sink.test';
import { runRabbitmqSinkTest } from './rabbitmq-sink.test';
import { runPulsarSinkTest } from './pulsar-sink.test';
import { runSolaceSinkTest } from './solace-sink.test';
import { runAzureblobstorefilesystemSinkTest } from './azureblobstorefilesystem-sink.test';
import { runContextualtextioSinkTest } from './contextualtextio-sink.test';
import { runCsvioSinkTest } from './csvio-sink.test';
import { runGcsfilesystemSinkTest } from './gcsfilesystem-sink.test';
import { runHadoopfilesystemSinkTest } from './hadoopfilesystem-sink.test';
import { runIcebergSinkTest } from './iceberg-sink.test';
import { runJsonioSinkTest } from './jsonio-sink.test';
import { runLocalfilesystemSinkTest } from './localfilesystem-sink.test';
import { runS3filesystemSinkTest } from './s3filesystem-sink.test';
import { runTfrecordioSinkTest } from './tfrecordio-sink.test';
import { runThriftioSinkTest } from './thriftio-sink.test';
import { runTikaioSinkTest } from './tikaio-sink.test';
import { runXmlioSinkTest } from './xmlio-sink.test';

export async function runAllSinksAgentengineTests(): Promise<void> {
    console.log('Running all Sink integration tests for agent-engine...');
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
    await runSplunkSinkTest();
    await runFhirSinkTest();
    await runHl7v2SinkTest();
    await runDicomSinkTest();
    await runWebapisSinkTest();
    await runDatadogSinkTest();
    await runAmqpSinkTest();
    await runRabbitmqSinkTest();
    await runPulsarSinkTest();
    await runSolaceSinkTest();
    await runAzureblobstorefilesystemSinkTest();
    await runContextualtextioSinkTest();
    await runCsvioSinkTest();
    await runGcsfilesystemSinkTest();
    await runHadoopfilesystemSinkTest();
    await runIcebergSinkTest();
    await runJsonioSinkTest();
    await runLocalfilesystemSinkTest();
    await runS3filesystemSinkTest();
    await runTfrecordioSinkTest();
    await runThriftioSinkTest();
    await runTikaioSinkTest();
    await runXmlioSinkTest();
}

describe('Sinks Suite (agent-engine)', () => {
    it('is registered and ready for execution', () => {
        expect(typeof runAllSinksAgentengineTests).toBe('function');
    });
});
