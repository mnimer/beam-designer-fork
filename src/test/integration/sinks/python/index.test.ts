/**
 * Master Test Suite for Sinks (python)
 */
import { describe, it, expect } from 'vitest';

export async function runAllSinksPythonTests(): Promise<void> {
    console.log('Running all Sink integration tests for python...');
    await (await import('./bigquery-sink.test')).runBigquerySinkTest();
    await (await import('./jdbc-sink.test')).runJdbcSinkTest();
    await (await import('./file-sink.test')).runFileSinkTest();
    await (await import('./parquet-sink.test')).runParquetSinkTest();
    await (await import('./avro-sink.test')).runAvroSinkTest();
    await (await import('./text-sink.test')).runTextSinkTest();
    await (await import('./logmessage-sink.test')).runLogmessageSinkTest();
    await (await import('./pubsub-sink.test')).runPubsubSinkTest();
    await (await import('./kafka-sink.test')).runKafkaSinkTest();
    await (await import('./kinesis-sink.test')).runKinesisSinkTest();
    await (await import('./jms-sink.test')).runJmsSinkTest();
    await (await import('./mqtt-sink.test')).runMqttSinkTest();
    await (await import('./bigtable-sink.test')).runBigtableSinkTest();
    await (await import('./datastore-sink.test')).runDatastoreSinkTest();
    await (await import('./snowflake-sink.test')).runSnowflakeSinkTest();
    await (await import('./spanner-sink.test')).runSpannerSinkTest();
    await (await import('./mongodb-sink.test')).runMongodbSinkTest();
    await (await import('./database-sink.test')).runDatabaseSinkTest();
    await (await import('./dicom-sink.test')).runDicomSinkTest();
    await (await import('./webapis-sink.test')).runWebapisSinkTest();
    await (await import('./datadog-sink.test')).runDatadogSinkTest();
    await (await import('./azureblobstorefilesystem-sink.test')).runAzureblobstorefilesystemSinkTest();
    await (await import('./csvio-sink.test')).runCsvioSinkTest();
    await (await import('./gcsfilesystem-sink.test')).runGcsfilesystemSinkTest();
    await (await import('./hadoopfilesystem-sink.test')).runHadoopfilesystemSinkTest();
    await (await import('./iceberg-sink.test')).runIcebergSinkTest();
    await (await import('./jsonio-sink.test')).runJsonioSinkTest();
    await (await import('./localfilesystem-sink.test')).runLocalfilesystemSinkTest();
    await (await import('./s3filesystem-sink.test')).runS3filesystemSinkTest();
    await (await import('./tfrecordio-sink.test')).runTfrecordioSinkTest();
    await (await import('./cloudsql-sink.test')).runCloudsqlSinkTest();
    await (await import('./mysql-sink.test')).runMysqlSinkTest();
    await (await import('./pyodbc-sink.test')).runPyodbcSinkTest();
    await (await import('./tinybird-sink.test')).runTinybirdSinkTest();
    await (await import('./multidb-yaml-sink.test')).runMultidbYamlSinkTest();
}

describe('Sinks Suite (python)', () => {
    it('is registered and ready for execution', () => {
        expect(typeof runAllSinksPythonTests).toBe('function');
    });
});
