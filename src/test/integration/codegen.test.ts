/**
 * Master Integration Test Suite for Apache Beam Codegen
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Sequentially executes all end-to-end integration test suites:
 * - I1: JdbcIO to JdbcIO (Java & Python)
 * - I2: KafkaIO to KafkaIO (Java & Python)
 * - I3: PubSubIO to BigQueryIO (Java & Python)
 * - I4: BigQueryIO to ParquetIO (Java & Python)
 * - I5: TextIO WordCount (Java & Python)
 * - I6: GenerateSequence to PubSubIO Fixed Windowing (Java & Python)
 * - I7: KinesisIO to AvroIO (Java & Python)
 * - I8: SqsIO to SnsIO Filtered (Java & Python)
 * - I9: MqttIO to BigQueryIO Sliding Window (Java & Python)
 * - I10: JmsIO to JmsIO Batching (Java & Python)
 * - I11: FileIO Dynamic Destinations (Java & Python)
 * - I12: AvroIO to ParquetIO Lakehouse (Java & Python)
 * - I13: PeriodicImpulse to JdbcIO (Java & Python)
 * - I14: Create Aggregations KV (Java & Python)
 * - I15: PubSubIO to BigQueryIO Session Windows (Java & Python)
 * - I16: Multi-Source Flatten to BigQueryIO (Java & Python)
 * - I17: CoGroupByKey Relational Join (Java & Python)
 * - I18: Distinct and Statistical Sampling (Java & Python)
 * - I19: SNS to SQS Fanout (Java & Python)
 * - I20: MQTT to MQTT Retained with DLQ (Java & Python)
 */

import { runJdbcIoToJdbcIoTest } from './jdbcio-to-jdbcio.test';
import { runKafkaIoToKafkaIoTest } from './kafkaio-to-kafkaio.test';
import { runPubSubToBigQueryTest } from './pubsub-to-bigquery.test';
import { runBigQueryToParquetTest } from './bigquery-to-parquet.test';
import { runTextIoWordCountTest } from './textio-wordcount.test';
import { runGenerateSequencePubSubFixedTest } from './generatesequence-pubsub-fixed.test';
import { runKinesisToAvroTest } from './kinesis-to-avro.test';
import { runSqsToSnsFilteredTest } from './sqs-to-sns-filtered.test';
import { runMqttToBigQuerySlidingTest } from './mqtt-to-bigquery-sliding.test';
import { runJmsToJmsBatchingTest } from './jms-to-jms-batching.test';
import { runFileIoDynamicDestinationsTest } from './fileio-dynamic-destinations.test';
import { runAvroToParquetLakehouseTest } from './avro-to-parquet-lakehouse.test';
import { runPeriodicImpulseToJdbcTest } from './periodic-impulse-to-jdbc.test';
import { runCreateAggregationsKvTest } from './create-aggregations-kv.test';
import { runPubSubSessionWindowsTest } from './pubsub-session-windows.test';
import { runMultiSourceFlattenBigQueryTest } from './multi-source-flatten-bigquery.test';
import { runCoGroupByKeyRelationalJoinTest } from './cogroupbykey-relational-join.test';
import { runDistinctStatisticalSamplingTest } from './distinct-statistical-sampling.test';
import { runSnsToSqsFanoutTest } from './sns-to-sqs-fanout.test';
import { runMqttToMqttRetainedTest } from './mqtt-to-mqtt-retained.test';

/**
 * Runs all integration test suites sequentially and reports summary status.
 */
export async function runAllIntegrationTests(): Promise<void> {
    console.log('======================================================');
    console.log('🚀 Starting All Apache Beam Pipeline Integration Tests');
    console.log('======================================================');

    try {
        await runJdbcIoToJdbcIoTest();
        await runKafkaIoToKafkaIoTest();
        await runPubSubToBigQueryTest();
        await runBigQueryToParquetTest();
        await runTextIoWordCountTest();
        await runGenerateSequencePubSubFixedTest();
        await runKinesisToAvroTest();
        await runSqsToSnsFilteredTest();
        await runMqttToBigQuerySlidingTest();
        await runJmsToJmsBatchingTest();
        await runFileIoDynamicDestinationsTest();
        await runAvroToParquetLakehouseTest();
        await runPeriodicImpulseToJdbcTest();
        await runCreateAggregationsKvTest();
        await runPubSubSessionWindowsTest();
        await runMultiSourceFlattenBigQueryTest();
        await runCoGroupByKeyRelationalJoinTest();
        await runDistinctStatisticalSamplingTest();
        await runSnsToSqsFanoutTest();
        await runMqttToMqttRetainedTest();
        console.log('\n🎉 ALL INTEGRATION SUITES PASSED SUCCESSFULLY!');
    } catch (err: any) {
        console.error('\n❌ INTEGRATION SUITE FAILURE:', err.message || err);
        process.exit(1);
    }
}

if (require.main === module) {
    runAllIntegrationTests().catch((err) => {
        console.error('Fatal test error:', err);
        process.exit(1);
    });
}
