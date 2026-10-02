/**
 * Master Test Suite for Sources (python)
 */
import { describe, it, expect } from 'vitest';

/**
 * Runs all Python source integration tests sequentially.
 *
 * @returns Promise that resolves when all test suites finish executing.
 */
export async function runAllSourcesPythonTests(): Promise<void> {
    console.log('Running all Source integration tests for python...');
    await (await import('./pubsub-source.test')).runPubsubSourceTest();
    await (await import('./kafka-source.test')).runKafkaSourceTest();
    await (await import('./kinesis-source.test')).runKinesisSourceTest();
    await (await import('./jms-source.test')).runJmsSourceTest();
    await (await import('./mqtt-source.test')).runMqttSourceTest();
    await (await import('./bigquery-source.test')).runBigquerySourceTest();
    await (await import('./jdbc-source.test')).runJdbcSourceTest();
    await (await import('./file-source.test')).runFileSourceTest();
    await (await import('./parquet-source.test')).runParquetSourceTest();
    await (await import('./avro-source.test')).runAvroSourceTest();
    await (await import('./text-source.test')).runTextSourceTest();
    await (await import('./create-source.test')).runCreateSourceTest();
    await (await import('./generatesequence-source.test')).runGeneratesequenceSourceTest();
    await (await import('./periodicimpulse-source.test')).runPeriodicimpulseSourceTest();
    await (await import('./bigtable-source.test')).runBigtableSourceTest();
    await (await import('./datastore-source.test')).runDatastoreSourceTest();
    await (await import('./snowflake-source.test')).runSnowflakeSourceTest();
    await (await import('./spanner-source.test')).runSpannerSourceTest();
    await (await import('./debezium-source.test')).runDebeziumSourceTest();
    await (await import('./mongodb-source.test')).runMongodbSourceTest();
    await (await import('./database-source.test')).runDatabaseSourceTest();
    await (await import('./dicom-source.test')).runDicomSourceTest();
    await (await import('./webapis-source.test')).runWebapisSourceTest();
    await (await import('./flinkstreamingimpulse-source.test')).runFlinkstreamingimpulseSourceTest();
    await (await import('./azureblobstorefilesystem-source.test')).runAzureblobstorefilesystemSourceTest();
    await (await import('./csvio-source.test')).runCsvioSourceTest();
    await (await import('./gcsfilesystem-source.test')).runGcsfilesystemSourceTest();
    await (await import('./hadoopfilesystem-source.test')).runHadoopfilesystemSourceTest();
    await (await import('./iceberg-source.test')).runIcebergSourceTest();
    await (await import('./jsonio-source.test')).runJsonioSourceTest();
    await (await import('./localfilesystem-source.test')).runLocalfilesystemSourceTest();
    await (await import('./s3filesystem-source.test')).runS3filesystemSourceTest();
    await (await import('./tfrecordio-source.test')).runTfrecordioSourceTest();
    await (await import('./cloudsql-source.test')).runCloudsqlSourceTest();
    await (await import('./mysql-source.test')).runMysqlSourceTest();
    await (await import('./pyodbc-source.test')).runPyodbcSourceTest();
    await (await import('./tinybird-source.test')).runTinybirdSourceTest();
    await (await import('./multidb-yaml-source.test')).runMultidbYamlSourceTest();
}

describe('Sources Suite (python)', () => {
    it('is registered and ready for execution', () => {
        expect(typeof runAllSourcesPythonTests).toBe('function');
    });
});
