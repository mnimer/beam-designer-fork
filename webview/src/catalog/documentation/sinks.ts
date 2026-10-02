/**
 * @fileoverview Documentation metadata registry for Apache Beam sink nodes.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

import type { NodeDocMetadata } from './types';

/**
 * Documentation metadata for Apache Beam sink nodes (streaming, database, data services, file, and logging sinks).
 */
export const SINK_DOCS: Record<string, NodeDocMetadata> = {
  // =========================================================================
  // Streaming Sinks
  // =========================================================================
  'SINK:AmqpIO': {
    title: 'AMQP Sink (AmqpIO.write)',
    description: 'Publishes messages from a PCollection to an AMQP 1.0 message broker address.',
    docsUrl: 'https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/amqp/AmqpIO.html',
  },
  'SINK:DicomIO': {
    title: 'DICOM Sink (HealthcareIO / DicomIO)',
    description: 'Uploads DICOM medical imaging instances to a Google Cloud Healthcare API DICOM store via STOW-RS.',
    docsUrl: 'https://beam.apache.org/documentation/io/built-in/healthcare/',
  },
  'UploadToDicomStore': {
    title: 'DICOM Sink (UploadToDicomStore)',
    description: 'Uploads DICOM medical imaging instances to a Google Cloud Healthcare API DICOM store via STOW-RS.',
    docsUrl: 'https://beam.apache.org/documentation/io/built-in/healthcare/',
  },
  'SINK:FhirIO': {
    title: 'FHIR Sink (HealthcareIO / FhirIO)',
    description: 'Executes FHIR bundles or imports clinical FHIR resources into a Google Cloud Healthcare API FHIR store.',
    docsUrl: 'https://beam.apache.org/documentation/io/built-in/healthcare/',
  },
  'SINK:HL7v2IO': {
    title: 'HL7v2 Sink (HealthcareIO / HL7v2IO)',
    description: 'Ingests clinical HL7v2 messages into a Google Cloud Healthcare API HL7v2 store.',
    docsUrl: 'https://beam.apache.org/documentation/io/built-in/healthcare/',
  },
  'SINK:JmsIO': {
    title: 'JMS Sink (JmsIO.write)',
    description: 'Publishes messages from a PCollection to a Java Message Service (JMS) queue or topic.',
    docsUrl: 'https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/jms/JmsIO.html',
  },
  'WriteToJms': {
    title: 'JMS Sink (WriteToJms)',
    description: 'Publishes messages from a PCollection to a Java Message Service (JMS) queue or topic.',
    docsUrl: 'https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/jms/JmsIO.html',
  },
  'SINK:KafkaIO': {
    title: 'Apache Kafka Sink (KafkaIO.write)',
    description: 'Publishes key-value records or values to an Apache Kafka topic with configurable serializers and delivery semantics.',
    docsUrl: 'https://beam.apache.org/documentation/io/built-in/kafka/',
  },
  'WriteToKafka': {
    title: 'Apache Kafka Sink (WriteToKafka)',
    description: 'Publishes key-value records or values to an Apache Kafka topic with configurable serializers and delivery semantics.',
    docsUrl: 'https://beam.apache.org/documentation/io/built-in/kafka/',
  },
  'SINK:KinesisIO': {
    title: 'Amazon Kinesis Sink (KinesisIO.write)',
    description: 'Writes streaming records to an Amazon Kinesis Data Stream using partition keys and PutRecords batching.',
    docsUrl: 'https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/aws2/kinesis/KinesisIO.html',
  },
  'WriteToKinesis': {
    title: 'Amazon Kinesis Sink (WriteToKinesis)',
    description: 'Writes streaming records to an Amazon Kinesis Data Stream using partition keys and PutRecords batching.',
    docsUrl: 'https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/aws2/kinesis/KinesisIO.html',
  },
  'SINK:MqttIO': {
    title: 'MQTT Sink (MqttIO.write)',
    description: 'Publishes byte payloads from a PCollection to an MQTT broker topic with optional retained flag.',
    docsUrl: 'https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/mqtt/MqttIO.html',
  },
  'WriteToMqtt': {
    title: 'MQTT Sink (WriteToMqtt)',
    description: 'Publishes byte payloads from a PCollection to an MQTT broker topic with optional retained flag.',
    docsUrl: 'https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/mqtt/MqttIO.html',
  },
  'SINK:PubSubIO': {
    title: 'Cloud Pub/Sub Sink (PubsubIO.write)',
    description: 'Publishes messages and optional metadata attributes to a Google Cloud Pub/Sub topic.',
    docsUrl: 'https://beam.apache.org/documentation/io/built-in/google-pubsub/',
  },
  'SINK:PubSub': {
    title: 'Cloud Pub/Sub Sink (PubsubIO.write)',
    description: 'Publishes messages and optional metadata attributes to a Google Cloud Pub/Sub topic.',
    docsUrl: 'https://beam.apache.org/documentation/io/built-in/google-pubsub/',
  },
  'SINK:PulsarIO': {
    title: 'Apache Pulsar Sink (PulsarIO.write)',
    description: 'Publishes messages from a PCollection to an Apache Pulsar topic.',
    docsUrl: 'https://beam.apache.org/documentation/io/built-in/pulsar/',
  },
  'SINK:RabbitMqIO': {
    title: 'RabbitMQ Sink (RabbitMqIO.write)',
    description: 'Publishes messages to a RabbitMQ queue or exchange over AMQP 0-9-1.',
    docsUrl: 'https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/rabbitmq/RabbitMqIO.html',
  },
  'SINK:SnsIO': {
    title: 'Amazon SNS Sink (SnsIO.write)',
    description: 'Publishes notification messages to an Amazon Simple Notification Service (SNS) topic ARN.',
    docsUrl: 'https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/aws2/sns/SnsIO.html',
  },
  'SINK:SolaceIO': {
    title: 'Solace PubSub+ Sink (SolaceIO.write)',
    description: 'Publishes streaming or persistent messages to a Solace PubSub+ event broker queue or topic.',
    docsUrl: 'https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/solace/SolaceIO.html',
  },
  'SINK:SqsIO': {
    title: 'Amazon SQS Sink (SqsIO.write)',
    description: 'Sends batched messages to an Amazon Simple Queue Service (SQS) standard or FIFO queue.',
    docsUrl: 'https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/aws2/sqs/SqsIO.html',
  },
  'WriteToSqs': {
    title: 'Amazon SQS Sink (WriteToSqs)',
    description: 'Sends batched messages to an Amazon Simple Queue Service (SQS) standard or FIFO queue.',
    docsUrl: 'https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/aws2/sqs/SqsIO.html',
  },

  // =========================================================================
  // Database Sinks
  // =========================================================================
  'SINK:BigQueryIO': {
    title: 'BigQuery Sink (BigQueryIO.write)',
    description: 'Writes or streams elements into a Google Cloud BigQuery table using Storage Write API, streaming inserts, or file loads.',
    docsUrl: 'https://beam.apache.org/documentation/io/built-in/google-bigquery/',
  },
  'SINK:BigQuery': {
    title: 'BigQuery Sink (BigQueryIO.write)',
    description: 'Writes or streams elements into a Google Cloud BigQuery table using Storage Write API, streaming inserts, or file loads.',
    docsUrl: 'https://beam.apache.org/documentation/io/built-in/google-bigquery/',
  },
  'SINK:BigTableIO': {
    title: 'Cloud Bigtable Sink (BigtableIO.write)',
    description: 'Writes batched row mutations (SetCell, DeleteFromColumn, DeleteFromRow) to a Google Cloud Bigtable table.',
    docsUrl: 'https://beam.apache.org/documentation/io/built-in/bigtable/',
  },
  'SINK:BigtableIO': {
    title: 'Cloud Bigtable Sink (BigtableIO.write)',
    description: 'Writes batched row mutations (SetCell, DeleteFromColumn, DeleteFromRow) to a Google Cloud Bigtable table.',
    docsUrl: 'https://beam.apache.org/documentation/io/built-in/bigtable/',
  },
  'SINK:CassandraIO': {
    title: 'Apache Cassandra Sink (CassandraIO.write)',
    description: 'Writes or deletes mapped entities in an Apache Cassandra keyspace table.',
    docsUrl: 'https://beam.apache.org/documentation/io/built-in/cassandra/',
  },
  'SINK:ClickHouseIO': {
    title: 'ClickHouse Sink (ClickHouseIO.write)',
    description: 'Bulk-inserts schema-aware Beam Rows into a ClickHouse analytical table with configurable block retries.',
    docsUrl: 'https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/clickhouse/ClickHouseIO.html',
  },
  'SINK:DatabaseIO': {
    title: 'Relational Database Sink (DatabaseIO)',
    description: 'Writes batched rows into relational databases (PostgreSQL, MySQL, SQL Server, Oracle) using JDBC engine presets.',
    docsUrl: 'https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/jdbc/JdbcIO.html',
  },
  'SINK:DatastoreIO': {
    title: 'Cloud Datastore Sink (DatastoreIO.v1.write)',
    description: 'Upserts or deletes Entity records in Google Cloud Datastore in automatically throttled batches.',
    docsUrl: 'https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/gcp/datastore/DatastoreIO.html',
  },
  'SINK:DynamoDBIO': {
    title: 'Amazon DynamoDB Sink (DynamoDBIO.write)',
    description: 'Writes or deletes items in an Amazon DynamoDB table using BatchWriteItem requests.',
    docsUrl: 'https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/aws2/dynamodb/DynamoDBIO.html',
  },
  'SINK:FirestoreIO': {
    title: 'Cloud Firestore Sink (FirestoreIO)',
    description: 'Applies batched document writes, updates, or deletes to Google Cloud Firestore.',
    docsUrl: 'https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/gcp/firestore/FirestoreIO.html',
  },
  'SINK:HBaseIO': {
    title: 'Apache HBase Sink (HBaseIO.write)',
    description: 'Writes Put and Delete mutations to an Apache HBase table.',
    docsUrl: 'https://beam.apache.org/documentation/io/built-in/hbase/',
  },
  'SINK:InfluxDbIO': {
    title: 'InfluxDB Sink (InfluxDbIO.write)',
    description: 'Writes line-protocol time-series points to an InfluxDB database and retention policy.',
    docsUrl: 'https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/influxdb/InfluxDbIO.html',
  },
  'SINK:JdbcIO': {
    title: 'JDBC Sink (JdbcIO.write)',
    description: 'Executes parameterized INSERT, UPDATE, or MERGE SQL statements in batches against a JDBC database.',
    docsUrl: 'https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/jdbc/JdbcIO.html',
  },
  'SINK:KuduIO': {
    title: 'Apache Kudu Sink (KuduIO.write)',
    description: 'Inserts, upserts, or updates columnar rows in an Apache Kudu table.',
    docsUrl: 'https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/kudu/KuduIO.html',
  },
  'SINK:MongoDbIO': {
    title: 'MongoDB Sink (MongoDbIO.write)',
    description: 'Inserts or upserts BSON documents into a MongoDB collection in ordered or unordered batches.',
    docsUrl: 'https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/mongodb/MongoDbIO.html',
  },
  'SINK:MongoDbGridFSIO': {
    title: 'MongoDB GridFS Sink (MongoDbGridFSIO.write)',
    description: 'Writes large files and binary streams into a MongoDB GridFS bucket with configurable chunk size.',
    docsUrl: 'https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/mongodb/MongoDbGridFSIO.html',
  },
  'SINK:Neo4jIO': {
    title: 'Neo4j Graph Sink (Neo4jIO.writeUnwind)',
    description: 'Writes graph nodes and relationships to a Neo4j database using batched Cypher UNWIND statements.',
    docsUrl: 'https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/neo4j/Neo4jIO.html',
  },
  'SINK:RedisIO': {
    title: 'Redis Sink (RedisIO.write)',
    description: 'Writes key-value pairs or data structure updates (SET, LPUSH, RPUSH, SADD, PFADD, INCBY) to Redis with optional TTL.',
    docsUrl: 'https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/redis/RedisIO.html',
  },
  'SINK:SingleStoreDBIO': {
    title: 'SingleStoreDB Sink (SingleStoreIO.write)',
    description: 'Bulk-loads elements into a SingleStoreDB table using high-throughput LOAD DATA batching.',
    docsUrl: 'https://beam.apache.org/documentation/io/built-in/singlestoredb/',
  },
  'SINK:SingleStoreIO': {
    title: 'SingleStoreDB Sink (SingleStoreIO.write)',
    description: 'Bulk-loads elements into a SingleStoreDB table using high-throughput LOAD DATA batching.',
    docsUrl: 'https://beam.apache.org/documentation/io/built-in/singlestoredb/',
  },
  'SINK:SnowflakeIO': {
    title: 'Snowflake Sink (SnowflakeIO.write)',
    description: 'Loads PCollection records into a Snowflake table via cloud storage staging (COPY INTO) or Snowpipe streaming.',
    docsUrl: 'https://beam.apache.org/documentation/io/built-in/snowflake/',
  },
  'SINK:SpannerIO': {
    title: 'Cloud Spanner Sink (SpannerIO.write)',
    description: 'Applies batched Mutation objects (Insert, Update, InsertOrUpdate, Replace, Delete) to a Google Cloud Spanner database.',
    docsUrl: 'https://beam.apache.org/documentation/io/built-in/google-cloud-spanner/',
  },

  // =========================================================================
  // Data Services Sinks
  // =========================================================================
  'SINK:ArrowFlightIO': {
    title: 'Apache Arrow Flight Sink (DoPut)',
    description: 'Streams columnar Arrow RecordBatches to an Apache Arrow Flight server via DoPut.',
    docsUrl: 'https://beam.apache.org/documentation/io/connectors/',
  },
  'SINK:CdapIO': {
    title: 'CDAP Plugin Sink (CdapIO.write)',
    description: 'Writes bounded records through any Cask Data Application Platform (CDAP) Hub batch sink plugin.',
    docsUrl: 'https://beam.apache.org/documentation/io/built-in/cdap/',
  },
  'SINK:CloudBigtable': {
    title: 'Cloud Bigtable (HBase) Sink',
    description: 'Writes HBase Put and Delete mutations to a Google Cloud Bigtable table (CloudBigtableIO.writeToTable).',
    docsUrl: 'https://cloud.google.com/bigtable/docs/hbase-dataflow-java',
  },
  'SINK:CloudSQL': {
    title: 'Cloud SQL (PostgreSQL) Sink',
    description: 'Writes batched rows into a Google Cloud SQL table using the Cloud SQL Connector or Auth Proxy.',
    docsUrl: 'https://github.com/GoogleCloudPlatform/python-docs-samples/tree/main/cloud-sql/postgres/sqlalchemy',
  },
  'SINK:CogniteDataFusion': {
    title: 'Cognite Data Fusion Sink',
    description: 'Upserts or deletes industrial assets, events, time series points, files, and RAW rows in Cognite Data Fusion.',
    docsUrl: 'https://cognite-beam-connector.readthedocs-hosted.com/en/latest/',
  },
  'SINK:ElasticsearchIO': {
    title: 'Elasticsearch Sink (ElasticsearchIO.write)',
    description: 'Bulk-indexes or upserts JSON documents into an Elasticsearch index.',
    docsUrl: 'https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/elasticsearch/ElasticsearchIO.html',
  },
  'SINK:HadoopFormatIO': {
    title: 'Hadoop OutputFormat Sink (HadoopFormatIO.write)',
    description: 'Writes key-value pairs to any storage system implementing a Hadoop MapReduce OutputFormat.',
    docsUrl: 'https://beam.apache.org/documentation/io/built-in/hadoop/',
  },
  'SINK:HCatalogIO': {
    title: 'Apache Hive / HCatalog Sink (HCatalogIO.write)',
    description: 'Writes HCatRecord rows into a table registered in an Apache Hive Metastore.',
    docsUrl: 'https://beam.apache.org/documentation/io/built-in/hcatalog/',
  },
  'SINK:KineticaDB': {
    title: 'KineticaDB Sink (KineticaIO.write)',
    description: 'Inserts typed RecordObject entities into an existing Kinetica GPU-accelerated database table.',
    docsUrl: 'https://github.com/kineticadb/kinetica-connector-beam',
  },
  'SINK:MySQL': {
    title: 'MySQL Sink (WriteToMySQL)',
    description: 'Writes batched dictionary records into a MySQL database table (beam-mysql-connector).',
    docsUrl: 'https://github.com/bennylp/beam-mysql-connector',
  },
  'SINK:MySQLPostgreSQLOracleSQLServer': {
    title: 'Multi-Database JDBC Sink (Beam YAML)',
    description: 'Writes rows to MySQL, PostgreSQL, Oracle, or SQL Server via Beam YAML standard JDBC schema transforms.',
    docsUrl: 'https://beam.apache.org/releases/yamldoc/current/',
  },
  'SINK:Pyodbc': {
    title: 'Pyodbc Sink (WriteToDB / pyodbc)',
    description: 'Writes batched rows into an ODBC-compliant database table from Python Beam pipelines using pyodbc.',
    docsUrl: 'https://github.com/314e/beam-pyodbc-connector',
  },
  'SINK:SolrIO': {
    title: 'Apache Solr Sink (SolrIO.write)',
    description: 'Batches and indexes SolrInputDocument records into an Apache SolrCloud collection.',
    docsUrl: 'https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/solr/SolrIO.html',
  },
  'SINK:Tinybird': {
    title: 'Tinybird Sink (WriteToTinybird)',
    description: 'Ingest batches to a Tinybird Data Source via tinybird.beam.WriteToTinybird',
    docsUrl: 'https://github.com/tinybirdco/tinybird-beam',
  },
  'SINK:TrepWsIO': {
    title: 'Refinitiv TREP WebSocket Sink (Post Bridge)',
    description: 'Contributes market data updates to LSEG / Refinitiv TREP or RTO via the WebSocket API Post protocol (tr_json2).',
    docsUrl: 'https://github.com/Refinitiv/trep-websockets-beam-io',
  },
  'SINK:RequestResponseIO': {
    title: 'Web APIs Sink (RequestResponseIO)',
    description: 'Sends request payloads to external HTTP/REST or gRPC Web APIs with automatic retries, throttling, and failure routing.',
    docsUrl: 'https://beam.apache.org/documentation/io/built-in/web-apis/',
  },
  'SINK:WebAPIs': {
    title: 'Web APIs Sink (RequestResponseIO)',
    description: 'Sends request payloads to external HTTP/REST or gRPC Web APIs with automatic retries, throttling, and failure routing.',
    docsUrl: 'https://beam.apache.org/documentation/io/built-in/web-apis/',
  },
  'SINK:Web APIs (RequestResponseIO)': {
    title: 'Web APIs Sink (RequestResponseIO)',
    description: 'Sends request payloads to external HTTP/REST or gRPC Web APIs with automatic retries, throttling, and failure routing.',
    docsUrl: 'https://beam.apache.org/documentation/io/built-in/web-apis/',
  },

  // =========================================================================
  // File Sinks
  // =========================================================================
  'SINK:AvroIO': {
    title: 'Apache Avro Sink (AvroIO.write)',
    description: 'Writes generic or specific Avro records to sharded `.avro` files with configurable codec compression.',
    docsUrl: 'https://beam.apache.org/documentation/io/built-in/avro/',
  },
  'WriteToAvro': {
    title: 'Apache Avro Sink (WriteToAvro)',
    description: 'Writes generic or specific Avro records to sharded `.avro` files with configurable codec compression.',
    docsUrl: 'https://beam.apache.org/documentation/io/built-in/avro/',
  },
  'SINK:AzureBlobStoreFileSystem': {
    title: 'Azure Blob Storage Sink (azfs://)',
    description: 'Writes output files to Microsoft Azure Blob Storage containers using the Beam Azure filesystem provider.',
    docsUrl: 'https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/azure/blobstore/AzureBlobStoreFileSystemRegistrar.html',
  },
  'SINK:ContextualTextIO': {
    title: 'ContextualTextIO Sink',
    description: 'Writes text lines to sharded output files with optional header, footer, and shard naming templates.',
    docsUrl: 'https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/ContextualTextIO.html',
  },
  'SINK:CsvIO': {
    title: 'CSV Sink (CsvIO / WriteToCsv)',
    description: 'Writes schema-aware records or rows to sharded CSV files with configurable delimiter and header options.',
    docsUrl: 'https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/csv/CsvIO.html',
  },
  'WriteToCsv': {
    title: 'CSV Sink (WriteToCsv)',
    description: 'Writes schema-aware records or rows to sharded CSV files with configurable delimiter and header options.',
    docsUrl: 'https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/csv/CsvIO.html',
  },
  'SINK:FileIO': {
    title: 'FileIO Sink (FileIO.write / writeDynamic)',
    description: 'Writes elements to static or dynamically partitioned output files using a pluggable FileIO.Sink.',
    docsUrl: 'https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/FileIO.html',
  },
  'SINK:GcsFileSystem': {
    title: 'Google Cloud Storage Sink (gs://)',
    description: 'Writes sharded output objects to Google Cloud Storage buckets using the Beam GCS filesystem connector.',
    docsUrl: 'https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/extensions/gcp/storage/GcsFileSystemRegistrar.html',
  },
  'SINK:HadoopFileSystem': {
    title: 'Hadoop FileSystem Sink (hdfs://)',
    description: 'Writes sharded output files to Apache Hadoop Distributed File System (HDFS) cluster paths.',
    docsUrl: 'https://beam.apache.org/documentation/io/built-in/hadoop/',
  },
  'SINK:IcebergIO': {
    title: 'Apache Iceberg Sink (Managed IcebergIO)',
    description: 'Appends or dynamically routes records into Apache Iceberg lakehouse tables with ACID snapshot commits.',
    docsUrl: 'https://beam.apache.org/documentation/io/built-in/iceberg/',
  },
  'SINK:JsonIO': {
    title: 'JSON Sink (JsonIO.write / WriteToJson)',
    description: 'Serializes structured elements or Beam Rows as newline-delimited JSON (NDJSON) files.',
    docsUrl: 'https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/extensions/jackson/AsJsons.html',
  },
  'WriteToJson': {
    title: 'JSON Sink (WriteToJson)',
    description: 'Serializes structured elements or Beam Rows as newline-delimited JSON (NDJSON) files.',
    docsUrl: 'https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/extensions/jackson/AsJsons.html',
  },
  'SINK:LocalFileSystem': {
    title: 'Local FileSystem Sink',
    description: 'Writes sharded output files to worker-local or shared filesystem directory paths.',
    docsUrl: 'https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/FileSystems.html',
  },
  'SINK:ParquetIO': {
    title: 'Apache Parquet Sink (ParquetIO.sink)',
    description: 'Writes records into columnar Apache Parquet files with configurable Avro schema and compression codec.',
    docsUrl: 'https://beam.apache.org/documentation/io/built-in/parquet/',
  },
  'WriteToParquet': {
    title: 'Apache Parquet Sink (WriteToParquet)',
    description: 'Writes records into columnar Apache Parquet files with configurable Avro schema and compression codec.',
    docsUrl: 'https://beam.apache.org/documentation/io/built-in/parquet/',
  },
  'SINK:S3FileSystem': {
    title: 'Amazon S3 Sink (s3://)',
    description: 'Writes sharded output objects to Amazon S3 or S3-compatible object storage buckets.',
    docsUrl: 'https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/aws2/s3/DefaultS3FileSystemSchemeRegistrar.html',
  },
  'SINK:TextIO': {
    title: 'TextIO Sink (TextIO.write)',
    description: 'Writes string elements as newline-delimited text files with optional headers, footers, and compression.',
    docsUrl: 'https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/TextIO.html',
  },
  'SINK:TFRecordIO': {
    title: 'TFRecord Sink (TFRecordIO.write)',
    description: 'Writes binary byte arrays or serialized TensorFlow Example records into sharded `.tfrecord` files.',
    docsUrl: 'https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/TFRecordIO.html',
  },
  'WriteToTFRecord': {
    title: 'TFRecord Sink (WriteToTFRecord)',
    description: 'Writes binary byte arrays or serialized TensorFlow Example records into sharded `.tfrecord` files.',
    docsUrl: 'https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/TFRecordIO.html',
  },
  'SINK:ThriftIO': {
    title: 'Apache Thrift Sink (ThriftIO.sink)',
    description: 'Serializes Apache Thrift TBase objects to files using a configured TProtocolFactory.',
    docsUrl: 'https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/thrift/ThriftIO.html',
  },
  'SINK:TikaIO': {
    title: 'Apache Tika Sink (FileIO.write)',
    description: 'Persists extracted document text and metadata produced by Tika parsing into output files.',
    docsUrl: 'https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/tika/TikaIO.html',
  },
  'SINK:XmlIO': {
    title: 'XML Sink (XmlIO.write)',
    description: 'Marshals JAXB-annotated objects into XML files enclosed by a configurable root element.',
    docsUrl: 'https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/xml/XmlIO.html',
  },

  // =========================================================================
  // Logging Sinks
  // =========================================================================
  'SINK:DatadogIO': {
    title: 'Datadog Logs Sink (DatadogIO.write)',
    description: 'Batches and sends structured DatadogEvent log entries to the Datadog HTTP Logs Intake API.',
    docsUrl: 'https://beam.apache.org/documentation/io/connectors/',
  },
  'SINK:DatadogWrite': {
    title: 'Datadog Logs Sink (DatadogIO.write)',
    description: 'Batches and sends structured DatadogEvent log entries to the Datadog HTTP Logs Intake API.',
    docsUrl: 'https://beam.apache.org/documentation/io/connectors/',
  },
  'DatadogIO': {
    title: 'Datadog Logs Sink (DatadogIO.write)',
    description: 'Batches and sends structured DatadogEvent log entries to the Datadog HTTP Logs Intake API.',
    docsUrl: 'https://beam.apache.org/documentation/io/connectors/',
  },
  'DatadogWrite': {
    title: 'Datadog Logs Sink (DatadogIO.write)',
    description: 'Batches and sends structured DatadogEvent log entries to the Datadog HTTP Logs Intake API.',
    docsUrl: 'https://beam.apache.org/documentation/io/connectors/',
  },
  'SINK:LogMessage': {
    title: 'Log Message Sink (ParDo Logger)',
    description: 'Logs each incoming PCollection element to worker stdout/Cloud Logging at the configured severity level.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/elementwise/pardo/',
  },
  'STEP:LogMessage': {
    title: 'Log Message Step (ParDo Logger)',
    description: 'Logs each incoming PCollection element to worker stdout/Cloud Logging at the configured severity level.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/elementwise/pardo/',
  },
  'LogMessage': {
    title: 'Log Message Sink (ParDo Logger)',
    description: 'Logs each incoming PCollection element to worker stdout/Cloud Logging at the configured severity level.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/elementwise/pardo/',
  },
  'SINK:SplunkIO': {
    title: 'Splunk HEC Sink (SplunkIO.write)',
    description: 'Batches and forwards SplunkEvent payloads to a Splunk HTTP Event Collector (HEC) endpoint.',
    docsUrl: 'https://beam.apache.org/documentation/io/built-in/splunk/',
  },
  'SplunkIO': {
    title: 'Splunk HEC Sink (SplunkIO.write)',
    description: 'Batches and forwards SplunkEvent payloads to a Splunk HTTP Event Collector (HEC) endpoint.',
    docsUrl: 'https://beam.apache.org/documentation/io/built-in/splunk/',
  },
};
