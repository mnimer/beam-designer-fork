/**
 * Master Test Suite for Sinks (java)
 */
import { describe, it, expect } from 'vitest';

/**
 * Runs all Java sink integration tests sequentially.
 *
 * @returns Promise that resolves when all test suites finish executing.
 */
export async function runAllSinksJavaTests(): Promise<void> {
    console.log('Running all Sink integration tests for java...');
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
    await (await import('./sns-sink.test')).runSnsSinkTest();
    await (await import('./sqs-sink.test')).runSqsSinkTest();
    await (await import('./jms-sink.test')).runJmsSinkTest();
    await (await import('./mqtt-sink.test')).runMqttSinkTest();
    await (await import('./cassandra-sink.test')).runCassandraSinkTest();
    await (await import('./hadoopformat-sink.test')).runHadoopformatSinkTest();
    await (await import('./hbase-sink.test')).runHbaseSinkTest();
    await (await import('./hcatalog-sink.test')).runHcatalogSinkTest();
    await (await import('./kudu-sink.test')).runKuduSinkTest();
    await (await import('./solr-sink.test')).runSolrSinkTest();
    await (await import('./elasticsearch-sink.test')).runElasticsearchSinkTest();
    await (await import('./bigtable-sink.test')).runBigtableSinkTest();
    await (await import('./datastore-sink.test')).runDatastoreSinkTest();
    await (await import('./snowflake-sink.test')).runSnowflakeSinkTest();
    await (await import('./spanner-sink.test')).runSpannerSinkTest();
    await (await import('./mongodb-sink.test')).runMongodbSinkTest();
    await (await import('./mongodbgridfs-sink.test')).runMongodbgridfsSinkTest();
    await (await import('./redis-sink.test')).runRedisSinkTest();
    await (await import('./dynamodb-sink.test')).runDynamodbSinkTest();
    await (await import('./clickhouse-sink.test')).runClickhouseSinkTest();
    await (await import('./arrowflight-sink.test')).runArrowflightSinkTest();
    await (await import('./database-sink.test')).runDatabaseSinkTest();
    await (await import('./firestore-sink.test')).runFirestoreSinkTest();
    await (await import('./neo4j-sink.test')).runNeo4jSinkTest();
    await (await import('./influxdb-sink.test')).runInfluxdbSinkTest();
    await (await import('./cdap-sink.test')).runCdapSinkTest();
    await (await import('./singlestoredb-sink.test')).runSinglestoredbSinkTest();
    await (await import('./splunk-sink.test')).runSplunkSinkTest();
    await (await import('./fhir-sink.test')).runFhirSinkTest();
    await (await import('./hl7v2-sink.test')).runHl7v2SinkTest();
    await (await import('./dicom-sink.test')).runDicomSinkTest();
    await (await import('./webapis-sink.test')).runWebapisSinkTest();
    await (await import('./datadog-sink.test')).runDatadogSinkTest();
    await (await import('./amqp-sink.test')).runAmqpSinkTest();
    await (await import('./rabbitmq-sink.test')).runRabbitmqSinkTest();
    await (await import('./pulsar-sink.test')).runPulsarSinkTest();
    await (await import('./solace-sink.test')).runSolaceSinkTest();
    await (await import('./azureblobstorefilesystem-sink.test')).runAzureblobstorefilesystemSinkTest();
    await (await import('./contextualtextio-sink.test')).runContextualtextioSinkTest();
    await (await import('./csvio-sink.test')).runCsvioSinkTest();
    await (await import('./gcsfilesystem-sink.test')).runGcsfilesystemSinkTest();
    await (await import('./hadoopfilesystem-sink.test')).runHadoopfilesystemSinkTest();
    await (await import('./iceberg-sink.test')).runIcebergSinkTest();
    await (await import('./jsonio-sink.test')).runJsonioSinkTest();
    await (await import('./localfilesystem-sink.test')).runLocalfilesystemSinkTest();
    await (await import('./s3filesystem-sink.test')).runS3filesystemSinkTest();
    await (await import('./tfrecordio-sink.test')).runTfrecordioSinkTest();
    await (await import('./thriftio-sink.test')).runThriftioSinkTest();
    await (await import('./tikaio-sink.test')).runTikaioSinkTest();
    await (await import('./xmlio-sink.test')).runXmlioSinkTest();
    await (await import('./cloudbigtable-hbase-sink.test')).runCloudbigtableHbaseSinkTest();
    await (await import('./cognitedatafusion-sink.test')).runCognitedatafusionSinkTest();
    await (await import('./kineticadb-sink.test')).runKineticadbSinkTest();
    await (await import('./trepwsio-sink.test')).runTrepwsioSinkTest();
    await (await import('./multidb-yaml-sink.test')).runMultidbYamlSinkTest();
}

describe('Sinks Suite (java)', () => {
    it('is registered and ready for execution', () => {
        expect(typeof runAllSinksJavaTests).toBe('function');
    });
});
