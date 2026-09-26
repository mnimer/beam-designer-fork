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
import { runFhirSourceTest } from './fhir-source.test';
import { runHl7v2SourceTest } from './hl7v2-source.test';
import { runDicomSourceTest } from './dicom-source.test';
import { runGoogleadsSourceTest } from './googleads-source.test';
import { runWebapisSourceTest } from './webapis-source.test';
import { runAmqpSourceTest } from './amqp-source.test';
import { runRabbitmqSourceTest } from './rabbitmq-source.test';
import { runFlinkstreamingimpulseSourceTest } from './flinkstreamingimpulse-source.test';
import { runPulsarSourceTest } from './pulsar-source.test';
import { runSolaceSourceTest } from './solace-source.test';
import { runAzureblobstorefilesystemSourceTest } from './azureblobstorefilesystem-source.test';
import { runContextualtextioSourceTest } from './contextualtextio-source.test';
import { runCsvioSourceTest } from './csvio-source.test';
import { runGcsfilesystemSourceTest } from './gcsfilesystem-source.test';
import { runHadoopfilesystemSourceTest } from './hadoopfilesystem-source.test';
import { runIcebergSourceTest } from './iceberg-source.test';
import { runJsonioSourceTest } from './jsonio-source.test';
import { runLocalfilesystemSourceTest } from './localfilesystem-source.test';
import { runS3filesystemSourceTest } from './s3filesystem-source.test';
import { runTfrecordioSourceTest } from './tfrecordio-source.test';
import { runThriftioSourceTest } from './thriftio-source.test';
import { runTikaioSourceTest } from './tikaio-source.test';
import { runXmlioSourceTest } from './xmlio-source.test';

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
    await runFhirSourceTest();
    await runHl7v2SourceTest();
    await runDicomSourceTest();
    await runGoogleadsSourceTest();
    await runWebapisSourceTest();
    await runAmqpSourceTest();
    await runRabbitmqSourceTest();
    await runFlinkstreamingimpulseSourceTest();
    await runPulsarSourceTest();
    await runSolaceSourceTest();
    await runAzureblobstorefilesystemSourceTest();
    await runContextualtextioSourceTest();
    await runCsvioSourceTest();
    await runGcsfilesystemSourceTest();
    await runHadoopfilesystemSourceTest();
    await runIcebergSourceTest();
    await runJsonioSourceTest();
    await runLocalfilesystemSourceTest();
    await runS3filesystemSourceTest();
    await runTfrecordioSourceTest();
    await runThriftioSourceTest();
    await runTikaioSourceTest();
    await runXmlioSourceTest();
}

describe('Sources Suite (agent-engine)', () => {
    it('is registered and ready for execution', () => {
        expect(typeof runAllSourcesAgentengineTests).toBe('function');
    });
});
