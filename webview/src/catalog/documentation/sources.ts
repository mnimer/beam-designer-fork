/**
 * @fileoverview Documentation metadata registry for Apache Beam source nodes.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

import type { NodeDocMetadata } from './types';

/**
 * Documentation metadata for Apache Beam source nodes (streaming, database, data services, and file sources).
 */
export const SOURCE_DOCS: Record<string, NodeDocMetadata> = {
  // =========================================================================
  // Streaming Sources
  // =========================================================================
  'SOURCE:AmqpIO': {
    title: 'AMQP Source (AmqpIO.read)',
    description: 'Consumes streaming or bounded messages from AMQP 1.0 broker addresses into an Apache Beam PCollection.',
    docsUrl: 'https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/amqp/AmqpIO.html',
  },
  'SOURCE:DicomIO': {
    title: 'DICOM Source (HealthcareIO / DicomIO)',
    description: 'Searches DICOM stores via QIDO-RS or reads medical imaging study metadata from the Google Cloud Healthcare API.',
    docsUrl: 'https://beam.apache.org/documentation/io/built-in/healthcare/',
  },
  'DicomSearch': {
    title: 'DICOM Source (HealthcareIO / DicomIO)',
    description: 'Searches DICOM stores via QIDO-RS or reads medical imaging study metadata from the Google Cloud Healthcare API.',
    docsUrl: 'https://beam.apache.org/documentation/io/built-in/healthcare/',
  },
  'SOURCE:FhirIO': {
    title: 'FHIR Source (HealthcareIO / FhirIO)',
    description: 'Reads, searches, or exports clinical FHIR resources from a Google Cloud Healthcare API FHIR store.',
    docsUrl: 'https://beam.apache.org/documentation/io/built-in/healthcare/',
  },
  'SOURCE:GenerateSequence': {
    title: 'GenerateSequence Source',
    description: 'Generates a bounded or unbounded sequence of Long integers at a configurable rate for testing and synthetic triggers.',
    docsUrl: 'https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/GenerateSequence.html',
  },
  'GenerateSequence': {
    title: 'GenerateSequence Source',
    description: 'Generates a bounded or unbounded sequence of Long integers at a configurable rate for testing and synthetic triggers.',
    docsUrl: 'https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/GenerateSequence.html',
  },
  'SOURCE:HL7v2IO': {
    title: 'HL7v2 Source (HealthcareIO / HL7v2IO)',
    description: 'Reads or filters clinical HL7v2 messages from a Google Cloud Healthcare API HL7v2 store.',
    docsUrl: 'https://beam.apache.org/documentation/io/built-in/healthcare/',
  },
  'SOURCE:JmsIO': {
    title: 'JMS Source (JmsIO.read)',
    description: 'Consumes messages from a Java Message Service (JMS) queue or topic such as ActiveMQ or IBM MQ.',
    docsUrl: 'https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/jms/JmsIO.html',
  },
  'ReadFromJms': {
    title: 'JMS Source (JmsIO.read)',
    description: 'Consumes messages from a Java Message Service (JMS) queue or topic such as ActiveMQ or IBM MQ.',
    docsUrl: 'https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/jms/JmsIO.html',
  },
  'SOURCE:KafkaIO': {
    title: 'Apache Kafka Source (KafkaIO.read)',
    description: 'Reads streaming or bounded key-value records from one or more Apache Kafka topics with configurable consumer offsets and watermarks.',
    docsUrl: 'https://beam.apache.org/documentation/io/built-in/kafka/',
  },
  'ReadFromKafka': {
    title: 'Apache Kafka Source (ReadFromKafka)',
    description: 'Reads streaming or bounded key-value records from one or more Apache Kafka topics with configurable consumer offsets and watermarks.',
    docsUrl: 'https://beam.apache.org/documentation/io/built-in/kafka/',
  },
  'SOURCE:KinesisIO': {
    title: 'Amazon Kinesis Source (KinesisIO.read)',
    description: 'Consumes real-time streaming data records from an Amazon Kinesis Data Stream starting from a shard position or timestamp.',
    docsUrl: 'https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/aws2/kinesis/KinesisIO.html',
  },
  'ReadDataFromKinesis': {
    title: 'Amazon Kinesis Source (ReadDataFromKinesis)',
    description: 'Consumes real-time streaming data records from an Amazon Kinesis Data Stream starting from a shard position or timestamp.',
    docsUrl: 'https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/aws2/kinesis/KinesisIO.html',
  },
  'SOURCE:MqttIO': {
    title: 'MQTT Source (MqttIO.read)',
    description: 'Subscribes to an MQTT broker topic filter and ingests IoT and telemetry messages into a PCollection.',
    docsUrl: 'https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/mqtt/MqttIO.html',
  },
  'ReadFromMqtt': {
    title: 'MQTT Source (ReadFromMqtt)',
    description: 'Subscribes to an MQTT broker topic filter and ingests IoT and telemetry messages into a PCollection.',
    docsUrl: 'https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/mqtt/MqttIO.html',
  },
  'SOURCE:PeriodicImpulse': {
    title: 'PeriodicImpulse Source',
    description: 'Emits timestamped impulse elements at fixed time intervals to trigger periodic side-input refreshes or polling steps.',
    docsUrl: 'https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/transforms/PeriodicImpulse.html',
  },
  'PeriodicImpulse': {
    title: 'PeriodicImpulse Source',
    description: 'Emits timestamped impulse elements at fixed time intervals to trigger periodic side-input refreshes or polling steps.',
    docsUrl: 'https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/transforms/PeriodicImpulse.html',
  },
  'SOURCE:PubSubIO': {
    title: 'Cloud Pub/Sub Source (PubsubIO.read)',
    description: 'Ingests real-time streaming messages from a Google Cloud Pub/Sub topic or subscription with optional message attributes and deduplication.',
    docsUrl: 'https://beam.apache.org/documentation/io/built-in/google-pubsub/',
  },
  'SOURCE:PubSub': {
    title: 'Cloud Pub/Sub Source (PubsubIO.read)',
    description: 'Ingests real-time streaming messages from a Google Cloud Pub/Sub topic or subscription with optional message attributes and deduplication.',
    docsUrl: 'https://beam.apache.org/documentation/io/built-in/google-pubsub/',
  },
  'SOURCE:PulsarIO': {
    title: 'Apache Pulsar Source (PulsarIO.read)',
    description: 'Consumes streaming messages from an Apache Pulsar topic with configurable start/end bounds and subscription handling.',
    docsUrl: 'https://beam.apache.org/documentation/io/built-in/pulsar/',
  },
  'SOURCE:RabbitMqIO': {
    title: 'RabbitMQ Source (RabbitMqIO.read)',
    description: 'Consumes messages from a RabbitMQ queue or exchange binding over AMQP 0-9-1.',
    docsUrl: 'https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/rabbitmq/RabbitMqIO.html',
  },
  'SOURCE:SnsIO': {
    title: 'Amazon SNS Source (SnsIO / SQS Subscription)',
    description: 'Consumes notifications published to an Amazon SNS topic via an subscribed Amazon SQS queue.',
    docsUrl: 'https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/aws2/sns/SnsIO.html',
  },
  'SOURCE:SolaceIO': {
    title: 'Solace PubSub+ Source (SolaceIO.read)',
    description: 'Consumes streaming events from a Solace PubSub+ event broker queue with parallel session readers and deduplication.',
    docsUrl: 'https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/solace/SolaceIO.html',
  },
  'SOURCE:SqsIO': {
    title: 'Amazon SQS Source (SqsIO.read)',
    description: 'Reads messages from an Amazon Simple Queue Service (SQS) queue as a streaming source.',
    docsUrl: 'https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/aws2/sqs/SqsIO.html',
  },
  'ReadFromSqs': {
    title: 'Amazon SQS Source (ReadFromSqs)',
    description: 'Reads messages from an Amazon Simple Queue Service (SQS) queue as a streaming source.',
    docsUrl: 'https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/aws2/sqs/SqsIO.html',
  },

  // =========================================================================
  // Database Sources
  // =========================================================================
  'SOURCE:BigQueryIO': {
    title: 'BigQuery Source (BigQueryIO.read)',
    description: 'Reads rows from a Google Cloud BigQuery table or executes a SQL query using Storage Read API or export jobs.',
    docsUrl: 'https://beam.apache.org/documentation/io/built-in/google-bigquery/',
  },
  'SOURCE:BigQuery': {
    title: 'BigQuery Source (BigQueryIO.read)',
    description: 'Reads rows from a Google Cloud BigQuery table or executes a SQL query using Storage Read API or export jobs.',
    docsUrl: 'https://beam.apache.org/documentation/io/built-in/google-bigquery/',
  },
  'SOURCE:BigTableIO': {
    title: 'Cloud Bigtable Source (BigtableIO.read)',
    description: 'Scans rows and cell versions from a Google Cloud Bigtable table with optional row ranges and server-side RowFilter rules.',
    docsUrl: 'https://beam.apache.org/documentation/io/built-in/bigtable/',
  },
  'SOURCE:BigtableIO': {
    title: 'Cloud Bigtable Source (BigtableIO.read)',
    description: 'Scans rows and cell versions from a Google Cloud Bigtable table with optional row ranges and server-side RowFilter rules.',
    docsUrl: 'https://beam.apache.org/documentation/io/built-in/bigtable/',
  },
  'SOURCE:CassandraIO': {
    title: 'Apache Cassandra Source (CassandraIO.read)',
    description: 'Reads rows from an Apache Cassandra keyspace and table using CQL queries or token-range splitting.',
    docsUrl: 'https://beam.apache.org/documentation/io/built-in/cassandra/',
  },
  'SOURCE:ClickHouseIO': {
    title: 'ClickHouse Source (ClickHouseIO / JDBC)',
    description: 'Queries analytical columnar tables in ClickHouse over JDBC into Beam Rows or typed records.',
    docsUrl: 'https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/clickhouse/ClickHouseIO.html',
  },
  'SOURCE:DatabaseIO': {
    title: 'Relational Database Source (DatabaseIO)',
    description: 'Reads rows from relational databases (PostgreSQL, MySQL, SQL Server, Oracle) using preconfigured JDBC engine presets.',
    docsUrl: 'https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/jdbc/JdbcIO.html',
  },
  'SOURCE:DatastoreIO': {
    title: 'Cloud Datastore Source (DatastoreIO.v1.read)',
    description: 'Reads Entity records from Google Cloud Datastore using a GQL query or structured Kind filter.',
    docsUrl: 'https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/gcp/datastore/DatastoreIO.html',
  },
  'SOURCE:DynamoDBIO': {
    title: 'Amazon DynamoDB Source (DynamoDBIO.read)',
    description: 'Scans items and attributes from an Amazon DynamoDB table in parallel across segments.',
    docsUrl: 'https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/aws2/dynamodb/DynamoDBIO.html',
  },
  'SOURCE:FirestoreIO': {
    title: 'Cloud Firestore Source (FirestoreIO)',
    description: 'Lists documents or executes structured queries against a Google Cloud Firestore collection.',
    docsUrl: 'https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/gcp/firestore/FirestoreIO.html',
  },
  'SOURCE:HBaseIO': {
    title: 'Apache HBase Source (HBaseIO.read)',
    description: 'Scans rows from an Apache HBase table across region splits using ZooKeeper quorum discovery.',
    docsUrl: 'https://beam.apache.org/documentation/io/built-in/hbase/',
  },
  'SOURCE:InfluxDbIO': {
    title: 'InfluxDB Source (InfluxDbIO.read)',
    description: 'Reads time-series measurements and points from an InfluxDB database or retention policy.',
    docsUrl: 'https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/influxdb/InfluxDbIO.html',
  },
  'SOURCE:JdbcIO': {
    title: 'JDBC Source (JdbcIO.read)',
    description: 'Executes SQL queries or partitioned table reads against any JDBC-compliant relational database.',
    docsUrl: 'https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/jdbc/JdbcIO.html',
  },
  'SOURCE:KuduIO': {
    title: 'Apache Kudu Source (KuduIO.read)',
    description: 'Scans columnar rows from an Apache Kudu table with optional predicate pushdown and projected columns.',
    docsUrl: 'https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/kudu/KuduIO.html',
  },
  'SOURCE:MongoDbIO': {
    title: 'MongoDB Source (MongoDbIO.read)',
    description: 'Reads BSON documents from a MongoDB collection with optional filter projection and aggregation pipeline stages.',
    docsUrl: 'https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/mongodb/MongoDbIO.html',
  },
  'SOURCE:MongoDbGridFSIO': {
    title: 'MongoDB GridFS Source (MongoDbGridFSIO.read)',
    description: 'Reads large chunked files and binary streams stored in a MongoDB GridFS bucket.',
    docsUrl: 'https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/mongodb/MongoDbGridFSIO.html',
  },
  'SOURCE:Neo4jIO': {
    title: 'Neo4j Graph Source (Neo4jIO.readAll)',
    description: 'Executes parameterized Cypher read queries against a Neo4j graph database and maps results to Beam elements.',
    docsUrl: 'https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/neo4j/Neo4jIO.html',
  },
  'SOURCE:RedisIO': {
    title: 'Redis Source (RedisIO.read)',
    description: 'Reads key-value pairs matching a glob key pattern from a Redis server or cache cluster.',
    docsUrl: 'https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/redis/RedisIO.html',
  },
  'SOURCE:SingleStoreDBIO': {
    title: 'SingleStoreDB Source (SingleStoreIO.read)',
    description: 'Reads rows from a SingleStoreDB distributed SQL table or query with parallel partition reading.',
    docsUrl: 'https://beam.apache.org/documentation/io/built-in/singlestoredb/',
  },
  'SOURCE:SingleStoreIO': {
    title: 'SingleStoreDB Source (SingleStoreIO.read)',
    description: 'Reads rows from a SingleStoreDB distributed SQL table or query with parallel partition reading.',
    docsUrl: 'https://beam.apache.org/documentation/io/built-in/singlestoredb/',
  },
  'SOURCE:SnowflakeIO': {
    title: 'Snowflake Source (SnowflakeIO.read)',
    description: 'Reads data from a Snowflake table or SQL query into a PCollection via cloud storage staging.',
    docsUrl: 'https://beam.apache.org/documentation/io/built-in/snowflake/',
  },
  'SOURCE:SpannerIO': {
    title: 'Cloud Spanner Source (SpannerIO.read)',
    description: 'Reads rows from a Google Cloud Spanner table, index, or SQL query with strong consistency or timestamp bounds.',
    docsUrl: 'https://beam.apache.org/documentation/io/built-in/google-cloud-spanner/',
  },

  // =========================================================================
  // Data Services Sources
  // =========================================================================
  'SOURCE:ArrowFlightIO': {
    title: 'Apache Arrow Flight Source',
    description: 'Fetches high-throughput columnar Arrow RecordBatches from an Apache Arrow Flight gRPC endpoint.',
    docsUrl: 'https://beam.apache.org/documentation/io/connectors/',
  },
  'SOURCE:CdapIO': {
    title: 'CDAP Plugin Source (CdapIO.read)',
    description: 'Reads bounded or streaming records through any Cask Data Application Platform (CDAP) Hub source plugin.',
    docsUrl: 'https://beam.apache.org/documentation/io/built-in/cdap/',
  },
  'SOURCE:CloudBigtable': {
    title: 'Cloud Bigtable (HBase) Source',
    description: 'Scans rows from Google Cloud Bigtable using the HBase client API (CloudBigtableIO.read).',
    docsUrl: 'https://cloud.google.com/bigtable/docs/hbase-dataflow-java',
  },
  'SOURCE:CloudSQL': {
    title: 'Cloud SQL (PostgreSQL) Source',
    description: 'Queries a Google Cloud SQL instance using the Cloud SQL Connector or Auth Proxy.',
    docsUrl: 'https://github.com/GoogleCloudPlatform/python-docs-samples/tree/main/cloud-sql/postgres/sqlalchemy',
  },
  'SOURCE:CogniteDataFusion': {
    title: 'Cognite Data Fusion Source',
    description: 'Reads industrial assets, events, time series, files, and RAW rows from Cognite Data Fusion (CogniteIO).',
    docsUrl: 'https://cognite-beam-connector.readthedocs-hosted.com/en/latest/',
  },
  'SOURCE:CosmosIO': {
    title: 'Azure Cosmos DB Source (CosmosIO.read)',
    description: 'Queries JSON documents from an Azure Cosmos DB database and container using SQL queries.',
    docsUrl: 'https://beam.apache.org/documentation/io/connectors/',
  },
  'SOURCE:DebeziumIO': {
    title: 'Debezium CDC Source (DebeziumIO.read)',
    description: 'Streams real-time Change Data Capture (CDC) events from MySQL, PostgreSQL, SQL Server, or Db2 via Debezium connectors.',
    docsUrl: 'https://beam.apache.org/documentation/io/built-in/debezium/',
  },
  'SOURCE:ElasticsearchIO': {
    title: 'Elasticsearch Source (ElasticsearchIO.read)',
    description: 'Reads documents from an Elasticsearch index or scroll query across shards.',
    docsUrl: 'https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/elasticsearch/ElasticsearchIO.html',
  },
  'SOURCE:FlinkStreamingImpulseSource': {
    title: 'Flink Streaming Impulse Source',
    description: 'Generates synthetic unbounded impulse byte arrays on the Apache Flink runner for streaming Python pipelines.',
    docsUrl: 'https://beam.apache.org/releases/pydoc/current/apache_beam.io.flink.flink_streaming_impulse_source.html',
  },
  'SOURCE:GoogleAdsIO': {
    title: 'Google Ads Source (GoogleAdsIO.read)',
    description: 'Executes Google Ads Query Language (GAQL) queries against the Google Ads API to stream GoogleAdsRow records.',
    docsUrl: 'https://beam.apache.org/documentation/io/built-in/google-ads/',
  },
  'GoogleAdsIO': {
    title: 'Google Ads Source (GoogleAdsIO.read)',
    description: 'Executes Google Ads Query Language (GAQL) queries against the Google Ads API to stream GoogleAdsRow records.',
    docsUrl: 'https://beam.apache.org/documentation/io/built-in/google-ads/',
  },
  'SOURCE:HadoopFormatIO': {
    title: 'Hadoop InputFormat Source (HadoopFormatIO.read)',
    description: 'Reads key-value records from any storage system implementing a Hadoop MapReduce InputFormat.',
    docsUrl: 'https://beam.apache.org/documentation/io/built-in/hadoop/',
  },
  'SOURCE:HCatalogIO': {
    title: 'Apache Hive / HCatalog Source (HCatalogIO.read)',
    description: 'Reads HCatRecord rows from a partitioned table registered in an Apache Hive Metastore.',
    docsUrl: 'https://beam.apache.org/documentation/io/built-in/hcatalog/',
  },
  'SOURCE:KineticaDB': {
    title: 'KineticaDB Source (KineticaIO.read)',
    description: 'Reads typed RecordObject entities from a Kinetica GPU-accelerated database table.',
    docsUrl: 'https://github.com/kineticadb/kinetica-connector-beam',
  },
  'SOURCE:MySQL': {
    title: 'MySQL Source (ReadFromMySQL)',
    description: 'Reads rows from a MySQL database using SQL queries and parallel splitters (beam-mysql-connector).',
    docsUrl: 'https://github.com/bennylp/beam-mysql-connector',
  },
  'SOURCE:MySQLPostgreSQLOracleSQLServer': {
    title: 'Multi-Database JDBC Source (Beam YAML)',
    description: 'Reads rows from MySQL, PostgreSQL, Oracle, or SQL Server via Beam YAML standard JDBC schema transforms.',
    docsUrl: 'https://beam.apache.org/releases/yamldoc/current/',
  },
  'SOURCE:Pyodbc': {
    title: 'Pyodbc Source (ReadFromDB / pyodbc)',
    description: 'Queries an ODBC-compliant database from Python Beam pipelines using pyodbc drivers.',
    docsUrl: 'https://github.com/314e/beam-pyodbc-connector',
  },
  'SOURCE:SolrIO': {
    title: 'Apache Solr Source (SolrIO.read)',
    description: 'Reads SolrDocument records from an Apache SolrCloud collection using ZooKeeper discovery and cursor paging.',
    docsUrl: 'https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/solr/SolrIO.html',
  },
  'SOURCE:SparkReceiverIO': {
    title: 'Spark Receiver Source (SparkReceiverIO.read)',
    description: 'Ingests unbounded data streams through any custom Apache Spark Streaming Receiver implementation.',
    docsUrl: 'https://beam.apache.org/documentation/io/built-in/spark-receiver/',
  },
  'SOURCE:Tinybird': {
    title: 'Tinybird Source (Pipes & Query HTTP API)',
    description: 'tinybird-beam is ingest-only; reads are generated as a Beam ParDo over the Tinybird Pipes/Query HTTP API (bounded).',
    docsUrl: 'https://github.com/tinybirdco/tinybird-beam',
  },
  'SOURCE:TrepWsIO': {
    title: 'Refinitiv TREP WebSocket Source (TrepWsIO.read)',
    description: 'Streams real-time financial market data (RICs and fields) from LSEG / Refinitiv TREP or RTO over WebSocket.',
    docsUrl: 'https://github.com/Refinitiv/trep-websockets-beam-io',
  },
  'SOURCE:RequestResponseIO': {
    title: 'Web APIs Source (RequestResponseIO)',
    description: 'Calls external HTTP/REST or gRPC Web APIs with automatic backoff, throttling, caching, and dead-letter handling.',
    docsUrl: 'https://beam.apache.org/documentation/io/built-in/web-apis/',
  },
  'SOURCE:WebAPIs': {
    title: 'Web APIs Source (RequestResponseIO)',
    description: 'Calls external HTTP/REST or gRPC Web APIs with automatic backoff, throttling, caching, and dead-letter handling.',
    docsUrl: 'https://beam.apache.org/documentation/io/built-in/web-apis/',
  },
  'SOURCE:Web APIs (RequestResponseIO)': {
    title: 'Web APIs Source (RequestResponseIO)',
    description: 'Calls external HTTP/REST or gRPC Web APIs with automatic backoff, throttling, caching, and dead-letter handling.',
    docsUrl: 'https://beam.apache.org/documentation/io/built-in/web-apis/',
  },

  // =========================================================================
  // File Sources
  // =========================================================================
  'SOURCE:AvroIO': {
    title: 'Apache Avro Source (AvroIO.read)',
    description: 'Reads Avro-serialized generic records or specific generated classes from file patterns on GCS, S3, HDFS, or local disk.',
    docsUrl: 'https://beam.apache.org/documentation/io/built-in/avro/',
  },
  'ReadFromAvro': {
    title: 'Apache Avro Source (ReadFromAvro)',
    description: 'Reads Avro-serialized generic records or specific generated classes from file patterns on GCS, S3, HDFS, or local disk.',
    docsUrl: 'https://beam.apache.org/documentation/io/built-in/avro/',
  },
  'SOURCE:AzureBlobStoreFileSystem': {
    title: 'Azure Blob Storage Source (azfs://)',
    description: 'Reads files stored in Microsoft Azure Blob Storage containers using the Beam Azure filesystem provider.',
    docsUrl: 'https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/azure/blobstore/AzureBlobStoreFileSystemRegistrar.html',
  },
  'SOURCE:ContextualTextIO': {
    title: 'ContextualTextIO Source',
    description: 'Reads text lines along with rich RecordWithMetadata context including source file name, line number, and byte offset.',
    docsUrl: 'https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/ContextualTextIO.html',
  },
  'SOURCE:CsvIO': {
    title: 'CSV Source (CsvIO / ReadFromCsv)',
    description: 'Reads delimited CSV files with header parsing, custom delimiters, and automatic Beam Schema mapping.',
    docsUrl: 'https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/csv/CsvIO.html',
  },
  'ReadFromCsv': {
    title: 'CSV Source (ReadFromCsv)',
    description: 'Reads delimited CSV files with header parsing, custom delimiters, and automatic Beam Schema mapping.',
    docsUrl: 'https://beam.apache.org/releases/pydoc/current/apache_beam.io.filebasedsource.html',
  },
  'SOURCE:FileIO': {
    title: 'FileIO Source (FileIO.match / readMatches)',
    description: 'Matches file globs once or watches directories continuously for new files, yielding ReadableFile handles.',
    docsUrl: 'https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/FileIO.html',
  },
  'SOURCE:FileIO.match': {
    title: 'FileIO Source (FileIO.match)',
    description: 'Matches file globs once or watches directories continuously for new files, yielding MatchResult.Metadata.',
    docsUrl: 'https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/FileIO.html',
  },
  'FileIO.match': {
    title: 'FileIO Source (FileIO.match)',
    description: 'Matches file globs once or watches directories continuously for new files, yielding MatchResult.Metadata.',
    docsUrl: 'https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/FileIO.html',
  },
  'SOURCE:GcsFileSystem': {
    title: 'Google Cloud Storage Source (gs://)',
    description: 'Reads objects from Google Cloud Storage buckets using the Beam GCS filesystem connector.',
    docsUrl: 'https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/extensions/gcp/storage/GcsFileSystemRegistrar.html',
  },
  'SOURCE:HadoopFileSystem': {
    title: 'Hadoop FileSystem Source (hdfs://)',
    description: 'Reads files from Apache Hadoop Distributed File System (HDFS) clusters.',
    docsUrl: 'https://beam.apache.org/documentation/io/built-in/hadoop/',
  },
  'SOURCE:IcebergIO': {
    title: 'Apache Iceberg Source (Managed IcebergIO)',
    description: 'Reads snapshots or streaming appends from Apache Iceberg lakehouse tables via Beam Managed I/O.',
    docsUrl: 'https://beam.apache.org/documentation/io/built-in/iceberg/',
  },
  'SOURCE:JsonIO': {
    title: 'JSON Source (JsonIO / ReadFromJson)',
    description: 'Reads newline-delimited JSON (NDJSON / JSONL) files and parses each line into structured records.',
    docsUrl: 'https://beam.apache.org/releases/pydoc/current/apache_beam.io.textio.html',
  },
  'ReadFromJson': {
    title: 'JSON Source (ReadFromJson)',
    description: 'Reads newline-delimited JSON (NDJSON / JSONL) files and parses each line into structured records.',
    docsUrl: 'https://beam.apache.org/releases/pydoc/current/apache_beam.io.textio.html',
  },
  'SOURCE:LocalFileSystem': {
    title: 'Local FileSystem Source',
    description: 'Reads files from worker-accessible local or network-mounted disk paths.',
    docsUrl: 'https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/FileSystems.html',
  },
  'SOURCE:ParquetIO': {
    title: 'Apache Parquet Source (ParquetIO.read)',
    description: 'Reads columnar Apache Parquet files with optional column projection and filter pushdown.',
    docsUrl: 'https://beam.apache.org/documentation/io/built-in/parquet/',
  },
  'ReadFromParquet': {
    title: 'Apache Parquet Source (ReadFromParquet)',
    description: 'Reads columnar Apache Parquet files with optional column projection and filter pushdown.',
    docsUrl: 'https://beam.apache.org/documentation/io/built-in/parquet/',
  },
  'SOURCE:S3FileSystem': {
    title: 'Amazon S3 Source (s3://)',
    description: 'Reads objects from Amazon S3 or S3-compatible object storage buckets.',
    docsUrl: 'https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/aws2/s3/DefaultS3FileSystemSchemeRegistrar.html',
  },
  'SOURCE:TextIO': {
    title: 'TextIO Source (TextIO.read)',
    description: 'Reads newline-delimited text files from local disk or cloud object storage (with automatic gzip/bzip2 decompression).',
    docsUrl: 'https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/TextIO.html',
  },
  'SOURCE:TFRecordIO': {
    title: 'TFRecord Source (TFRecordIO.read)',
    description: 'Reads binary TensorFlow TFRecord files containing serialized tf.train.Example records for ML pipelines.',
    docsUrl: 'https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/TFRecordIO.html',
  },
  'ReadFromTFRecord': {
    title: 'TFRecord Source (ReadFromTFRecord)',
    description: 'Reads binary TensorFlow TFRecord files containing serialized tf.train.Example records for ML pipelines.',
    docsUrl: 'https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/TFRecordIO.html',
  },
  'SOURCE:ThriftIO': {
    title: 'Apache Thrift Source (ThriftIO.read)',
    description: 'Reads Apache Thrift binary or compact structs from files using a configured TProtocolFactory.',
    docsUrl: 'https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/thrift/ThriftIO.html',
  },
  'SOURCE:TikaIO': {
    title: 'Apache Tika Source (TikaIO.parse)',
    description: 'Extracts text content and metadata from rich documents (PDF, DOCX, XLSX, HTML) using Apache Tika.',
    docsUrl: 'https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/tika/TikaIO.html',
  },
  'SOURCE:XmlIO': {
    title: 'XML Source (XmlIO.read)',
    description: 'Reads repeating XML record elements from files and unmarshals them via JAXB bindings.',
    docsUrl: 'https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/xml/XmlIO.html',
  },
  'SOURCE:Create': {
    title: 'Create Source (Create.of)',
    description: 'Creates a bounded PCollection from an in-memory list of static elements for prototyping and testing.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/other/create/',
  },
  'Create': {
    title: 'Create Source (Create.of)',
    description: 'Creates a bounded PCollection from an in-memory list of static elements for prototyping and testing.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/other/create/',
  },
};
