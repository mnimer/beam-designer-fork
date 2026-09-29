/**
 * Master Test Suite for Sources (java)
 */
import { describe, it, expect } from 'vitest';

export async function runAllSourcesJavaTests(): Promise<void> {
    console.log('Running all Source integration tests for java...');
    await (await import('./pubsub-source.test')).runPubsubSourceTest();
    await (await import('./kafka-source.test')).runKafkaSourceTest();
    await (await import('./kinesis-source.test')).runKinesisSourceTest();
    await (await import('./sns-source.test')).runSnsSourceTest();
    await (await import('./sqs-source.test')).runSqsSourceTest();
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
    await (await import('./cassandra-source.test')).runCassandraSourceTest();
    await (await import('./hadoopformat-source.test')).runHadoopformatSourceTest();
    await (await import('./hbase-source.test')).runHbaseSourceTest();
    await (await import('./hcatalog-source.test')).runHcatalogSourceTest();
    await (await import('./kudu-source.test')).runKuduSourceTest();
    await (await import('./solr-source.test')).runSolrSourceTest();
    await (await import('./elasticsearch-source.test')).runElasticsearchSourceTest();
    await (await import('./bigtable-source.test')).runBigtableSourceTest();
    await (await import('./datastore-source.test')).runDatastoreSourceTest();
    await (await import('./snowflake-source.test')).runSnowflakeSourceTest();
    await (await import('./spanner-source.test')).runSpannerSourceTest();
    await (await import('./debezium-source.test')).runDebeziumSourceTest();
    await (await import('./mongodb-source.test')).runMongodbSourceTest();
    await (await import('./mongodbgridfs-source.test')).runMongodbgridfsSourceTest();
    await (await import('./redis-source.test')).runRedisSourceTest();
    await (await import('./dynamodb-source.test')).runDynamodbSourceTest();
    await (await import('./clickhouse-source.test')).runClickhouseSourceTest();
    await (await import('./arrowflight-source.test')).runArrowflightSourceTest();
    await (await import('./database-source.test')).runDatabaseSourceTest();
    await (await import('./firestore-source.test')).runFirestoreSourceTest();
    await (await import('./neo4j-source.test')).runNeo4jSourceTest();
    await (await import('./influxdb-source.test')).runInfluxdbSourceTest();
    await (await import('./sparkreceiver-source.test')).runSparkreceiverSourceTest();
    await (await import('./cdap-source.test')).runCdapSourceTest();
    await (await import('./singlestoredb-source.test')).runSinglestoredbSourceTest();
    await (await import('./cosmos-source.test')).runCosmosSourceTest();
    await (await import('./fhir-source.test')).runFhirSourceTest();
    await (await import('./hl7v2-source.test')).runHl7v2SourceTest();
    await (await import('./dicom-source.test')).runDicomSourceTest();
    await (await import('./googleads-source.test')).runGoogleadsSourceTest();
    await (await import('./webapis-source.test')).runWebapisSourceTest();
    await (await import('./amqp-source.test')).runAmqpSourceTest();
    await (await import('./rabbitmq-source.test')).runRabbitmqSourceTest();
    await (await import('./pulsar-source.test')).runPulsarSourceTest();
    await (await import('./solace-source.test')).runSolaceSourceTest();
    await (await import('./azureblobstorefilesystem-source.test')).runAzureblobstorefilesystemSourceTest();
    await (await import('./contextualtextio-source.test')).runContextualtextioSourceTest();
    await (await import('./csvio-source.test')).runCsvioSourceTest();
    await (await import('./gcsfilesystem-source.test')).runGcsfilesystemSourceTest();
    await (await import('./hadoopfilesystem-source.test')).runHadoopfilesystemSourceTest();
    await (await import('./iceberg-source.test')).runIcebergSourceTest();
    await (await import('./jsonio-source.test')).runJsonioSourceTest();
    await (await import('./localfilesystem-source.test')).runLocalfilesystemSourceTest();
    await (await import('./s3filesystem-source.test')).runS3filesystemSourceTest();
    await (await import('./tfrecordio-source.test')).runTfrecordioSourceTest();
    await (await import('./thriftio-source.test')).runThriftioSourceTest();
    await (await import('./tikaio-source.test')).runTikaioSourceTest();
    await (await import('./xmlio-source.test')).runXmlioSourceTest();
    await (await import('./cloudbigtable-hbase-source.test')).runCloudbigtableHbaseSourceTest();
    await (await import('./cognitedatafusion-source.test')).runCognitedatafusionSourceTest();
    await (await import('./kineticadb-source.test')).runKineticadbSourceTest();
    await (await import('./trepwsio-source.test')).runTrepwsioSourceTest();
    await (await import('./multidb-yaml-source.test')).runMultidbYamlSourceTest();
}

describe('Sources Suite (java)', () => {
    it('is registered and ready for execution', () => {
        expect(typeof runAllSourcesJavaTests).toBe('function');
    });
});
