/**
 * Node Documentation Metadata Registry
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Centralizes short descriptions and official Apache Beam documentation links for all
 * Source, Step, and Sink property panels so users can learn what each connector or
 * transform does and open the corresponding Apache Beam documentation page.
 */

export interface NodeDocMetadata {
  title: string;
  description: string;
  docsUrl: string;
}

export const DEFAULT_BEAM_IO_DOCS_URL = 'https://beam.apache.org/documentation/io/connectors/';
export const DEFAULT_BEAM_TRANSFORMS_DOCS_URL = 'https://beam.apache.org/documentation/transforms/java/overview/';

/**
 * Opens an external documentation URL via the VS Code webview bridge.
 */
export function openNodeDocs(url: string): void {
  const vscode = (window as unknown as { vscode?: { postMessage?: (msg: unknown) => void } }).vscode;
  if (vscode && typeof vscode.postMessage === 'function') {
    vscode.postMessage({ command: 'openExternal', url });
  }
}

/**
 * Registry of documentation metadata indexed by type-qualified key (`SOURCE:<transform>`,
 * `SINK:<transform>`, `STEP:<transform>`) or direct transform name.
 */
export const NODE_DOCUMENTATION_REGISTRY: Record<string, NodeDocMetadata> = {
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

  // =========================================================================
  // Core, Element, Parser, and Window Transforms (Steps)
  // =========================================================================
  'STEP:FileIO.readMatches': {
    title: 'FileIO.readMatches Transform',
    description: 'Converts matched file metadata (MatchResult.Metadata) into FileIO.ReadableFile handles for downstream reading.',
    docsUrl: 'https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/FileIO.html',
  },
  'FileIO.readMatches': {
    title: 'FileIO.readMatches Transform',
    description: 'Converts matched file metadata (MatchResult.Metadata) into FileIO.ReadableFile handles for downstream reading.',
    docsUrl: 'https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/FileIO.html',
  },
  'STEP:ParDo': {
    title: 'ParDo Transform (ParDo.of)',
    description: 'Applies a general-purpose parallel DoFn to each element for custom filtering, enrichment, or multi-output routing.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/elementwise/pardo/',
  },
  'ParDo': {
    title: 'ParDo Transform (ParDo.of)',
    description: 'Applies a general-purpose parallel DoFn to each element for custom filtering, enrichment, or multi-output routing.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/elementwise/pardo/',
  },
  'STEP:ParseMessage': {
    title: 'Parse Message Transform',
    description: 'Decodes raw incoming byte or string payloads (JSON, Base64, or UTF-8 String) into structured pipeline elements.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/elementwise/pardo/',
  },
  'ParseMessage': {
    title: 'Parse Message Transform',
    description: 'Decodes raw incoming byte or string payloads (JSON, Base64, or UTF-8 String) into structured pipeline elements.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/elementwise/pardo/',
  },
  'STEP:WithTimestamps': {
    title: 'WithTimestamps Transform',
    description: 'Assigns an event-time Instant to each element in a PCollection for event-time windowing and watermark tracking.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/elementwise/withtimestamps/',
  },
  'WithTimestamps': {
    title: 'WithTimestamps Transform',
    description: 'Assigns an event-time Instant to each element in a PCollection for event-time windowing and watermark tracking.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/elementwise/withtimestamps/',
  },
  'STEP:Filter': {
    title: 'Filter Transform (Filter.by)',
    description: 'Retains only elements in a PCollection that satisfy a boolean predicate function.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/elementwise/filter/',
  },
  'Filter': {
    title: 'Filter Transform (Filter.by)',
    description: 'Retains only elements in a PCollection that satisfy a boolean predicate function.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/elementwise/filter/',
  },
  'STEP:FlatMap': {
    title: 'FlatMapElements Transform',
    description: 'Applies a one-to-many function to each element and flattens the resulting iterables into a single PCollection.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/elementwise/flatmapelements/',
  },
  'FlatMap': {
    title: 'FlatMapElements Transform',
    description: 'Applies a one-to-many function to each element and flattens the resulting iterables into a single PCollection.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/elementwise/flatmapelements/',
  },
  'STEP:KVMapper': {
    title: 'KV Mapper Transform (WithKeys / MapElements)',
    description: 'Maps each element into a KV<Key, Value> pair so downstream keyed transforms and aggregations can group by key.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/elementwise/withkeys/',
  },
  'KVMapper': {
    title: 'KV Mapper Transform (WithKeys / MapElements)',
    description: 'Maps each element into a KV<Key, Value> pair so downstream keyed transforms and aggregations can group by key.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/elementwise/withkeys/',
  },
  'STEP:Map': {
    title: 'MapElements Transform',
    description: 'Transforms each element in a PCollection one-to-one using a pure mapping function or expression.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/elementwise/mapelements/',
  },
  'Map': {
    title: 'MapElements Transform',
    description: 'Transforms each element in a PCollection one-to-one using a pure mapping function or expression.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/elementwise/mapelements/',
  },
  'STEP:Window': {
    title: 'Window Transform (Window.into)',
    description: 'Subdivides a PCollection into finite event-time windows (Fixed, Sliding, or Session) for windowed aggregations.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/other/window/',
  },
  'Window': {
    title: 'Window Transform (Window.into)',
    description: 'Subdivides a PCollection into finite event-time windows (Fixed, Sliding, or Session) for windowed aggregations.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/other/window/',
  },
  'STEP:Windowing': {
    title: 'Window Transform (Window.into)',
    description: 'Subdivides a PCollection into finite event-time windows (Fixed, Sliding, or Session) for windowed aggregations.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/other/window/',
  },
  'Windowing': {
    title: 'Window Transform (Window.into)',
    description: 'Subdivides a PCollection into finite event-time windows (Fixed, Sliding, or Session) for windowed aggregations.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/other/window/',
  },
  'STEP:WindowInto': {
    title: 'Window Transform (Window.into)',
    description: 'Subdivides a PCollection into finite event-time windows (Fixed, Sliding, or Session) for windowed aggregations.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/other/window/',
  },
  'WindowInto': {
    title: 'Window Transform (Window.into)',
    description: 'Subdivides a PCollection into finite event-time windows (Fixed, Sliding, or Session) for windowed aggregations.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/other/window/',
  },

  // =========================================================================
  // Aggregation Transforms
  // =========================================================================
  'STEP:ApproximateQuantiles': {
    title: 'ApproximateQuantiles',
    description: 'Computes approximate quantiles of the elements in a collection.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/aggregation/approximatequantiles/',
  },
  'ApproximateQuantiles': {
    title: 'ApproximateQuantiles',
    description: 'Computes approximate quantiles of the elements in a collection.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/aggregation/approximatequantiles/',
  },
  'Approximate Quantiles': {
    title: 'Approximate Quantiles',
    description: 'Computes approximate quantiles of the elements in a collection.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/aggregation/approximatequantiles/',
  },
  'Approximate Quantile': {
    title: 'Approximate Quantile',
    description: 'Computes approximate quantiles of the elements in a collection.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/aggregation/approximatequantiles/',
  },
  'STEP:ApproximateUnique': {
    title: 'ApproximateUnique',
    description: 'Estimates the number of unique elements in a collection.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/aggregation/approximateunique/',
  },
  'ApproximateUnique': {
    title: 'ApproximateUnique',
    description: 'Estimates the number of unique elements in a collection.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/aggregation/approximateunique/',
  },
  'Approximate Unique': {
    title: 'Approximate Unique',
    description: 'Estimates the number of unique elements in a collection.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/aggregation/approximateunique/',
  },
  'STEP:BatchElements': {
    title: 'BatchElements',
    description: 'Batches elements into smaller groups for downstream processing.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/python/aggregation/batchelements/',
  },
  'BatchElements': {
    title: 'BatchElements',
    description: 'Batches elements into smaller groups for downstream processing.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/python/aggregation/batchelements/',
  },
  'Batch Elements': {
    title: 'Batch Elements',
    description: 'Batches elements into smaller groups for downstream processing.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/python/aggregation/batchelements/',
  },
  'STEP:CoGroupByKey': {
    title: 'CoGroupByKey',
    description: 'Groups results from multiple collections by their common keys.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/aggregation/cogroupbykey/',
  },
  'CoGroupByKey': {
    title: 'CoGroupByKey',
    description: 'Groups results from multiple collections by their common keys.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/aggregation/cogroupbykey/',
  },
  'Co Group By Key': {
    title: 'Co Group By Key',
    description: 'Groups results from multiple collections by their common keys.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/aggregation/cogroupbykey/',
  },
  'STEP:Combine': {
    title: 'Combine',
    description: 'Combines elements in a collection using a global combine function.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/aggregation/combine/',
  },
  'Combine': {
    title: 'Combine',
    description: 'Combines elements in a collection using a global combine function.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/aggregation/combine/',
  },
  'STEP:CombineWithContext': {
    title: 'CombineWithContext',
    description: 'Combines elements in a collection using side inputs or contextual state.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/aggregation/combine/',
  },
  'CombineWithContext': {
    title: 'CombineWithContext',
    description: 'Combines elements in a collection using side inputs or contextual state.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/aggregation/combine/',
  },
  'Combine With Context': {
    title: 'Combine With Context',
    description: 'Combines elements in a collection using side inputs or contextual state.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/aggregation/combine/',
  },
  'STEP:Count': {
    title: 'Count',
    description: 'Counts the number of elements in a collection.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/aggregation/count/',
  },
  'Count': {
    title: 'Count',
    description: 'Counts the number of elements in a collection.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/aggregation/count/',
  },
  'STEP:Distinct': {
    title: 'Distinct',
    description: 'Removes duplicate elements from a collection.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/aggregation/distinct/',
  },
  'Distinct': {
    title: 'Distinct',
    description: 'Removes duplicate elements from a collection.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/aggregation/distinct/',
  },
  'STEP:GroupByKey': {
    title: 'GroupByKey',
    description: 'Groups key-value pairs by their keys.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/aggregation/groupbykey/',
  },
  'GroupByKey': {
    title: 'GroupByKey',
    description: 'Groups key-value pairs by their keys.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/aggregation/groupbykey/',
  },
  'Group By Key': {
    title: 'Group By Key',
    description: 'Groups key-value pairs by their keys.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/aggregation/groupbykey/',
  },
  'STEP:GroupIntoBatches': {
    title: 'GroupIntoBatches',
    description: 'Groups elements into batches of a specified size or duration.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/aggregation/groupintobatches/',
  },
  'GroupIntoBatches': {
    title: 'GroupIntoBatches',
    description: 'Groups elements into batches of a specified size or duration.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/aggregation/groupintobatches/',
  },
  'Group Into Batches': {
    title: 'Group Into Batches',
    description: 'Groups elements into batches of a specified size or duration.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/aggregation/groupintobatches/',
  },
  'STEP:Latest': {
    title: 'Latest',
    description: 'Obtains the latest element or value according to timestamps.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/aggregation/latest/',
  },
  'Latest': {
    title: 'Latest',
    description: 'Obtains the latest element or value according to timestamps.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/aggregation/latest/',
  },
  'STEP:Max': {
    title: 'Max',
    description: 'Computes the maximum element or value in a collection.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/aggregation/max/',
  },
  'Max': {
    title: 'Max',
    description: 'Computes the maximum element or value in a collection.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/aggregation/max/',
  },
  'STEP:Mean': {
    title: 'Mean',
    description: 'Computes the arithmetic mean of elements in a collection.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/aggregation/mean/',
  },
  'Mean': {
    title: 'Mean',
    description: 'Computes the arithmetic mean of elements in a collection.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/aggregation/mean/',
  },
  'STEP:Min': {
    title: 'Min',
    description: 'Computes the minimum element or value in a collection.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/aggregation/min/',
  },
  'Min': {
    title: 'Min',
    description: 'Computes the minimum element or value in a collection.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/aggregation/min/',
  },
  'STEP:Sample': {
    title: 'Sample',
    description: 'Takes a random sample of elements from a collection.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/aggregation/sample/',
  },
  'Sample': {
    title: 'Sample',
    description: 'Takes a random sample of elements from a collection.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/aggregation/sample/',
  },
  'STEP:Sum': {
    title: 'Sum',
    description: 'Computes the sum of elements in a collection.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/aggregation/sum/',
  },
  'Sum': {
    title: 'Sum',
    description: 'Computes the sum of elements in a collection.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/aggregation/sum/',
  },
  'STEP:Top': {
    title: 'Top',
    description: 'Finds the top elements in a collection according to a comparator.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/aggregation/top/',
  },
  'Top': {
    title: 'Top',
    description: 'Finds the top elements in a collection according to a comparator.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/aggregation/top/',
  },

  // =========================================================================
  // Other / Utility Transforms
  // =========================================================================
  'STEP:Flatten': {
    title: 'Flatten',
    description: 'Merges multiple PCollection objects of the same type into a single logical PCollection.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/other/flatten/',
  },
  'Flatten': {
    title: 'Flatten',
    description: 'Merges multiple PCollection objects of the same type into a single logical PCollection.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/other/flatten/',
  },
  'STEP:Reshuffle': {
    title: 'Reshuffle',
    description: 'Redistributes elements across workers by assigning temporary random keys to break fusion and balance load.',
    docsUrl: 'https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/transforms/Reshuffle.html',
  },
  'Reshuffle': {
    title: 'Reshuffle',
    description: 'Redistributes elements across workers by assigning temporary random keys to break fusion and balance load.',
    docsUrl: 'https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/transforms/Reshuffle.html',
  },
  'STEP:ReShuffle': {
    title: 'ReShuffle',
    description: 'Redistributes elements across workers by assigning temporary random keys to break fusion and balance load.',
    docsUrl: 'https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/transforms/Reshuffle.html',
  },
  'ReShuffle': {
    title: 'ReShuffle',
    description: 'Redistributes elements across workers by assigning temporary random keys to break fusion and balance load.',
    docsUrl: 'https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/transforms/Reshuffle.html',
  },
  'STEP:Keys': {
    title: 'Keys',
    description: 'Extracts the key from each KV<K, V> element in a PCollection.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/elementwise/keys/',
  },
  'Keys': {
    title: 'Keys',
    description: 'Extracts the key from each KV<K, V> element in a PCollection.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/elementwise/keys/',
  },
  'STEP:KvSwap': {
    title: 'KV Swap (KvSwap)',
    description: 'Swaps the key and value of each KV<K, V> element to produce KV<V, K>.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/elementwise/kvswap/',
  },
  'KvSwap': {
    title: 'KV Swap (KvSwap)',
    description: 'Swaps the key and value of each KV<K, V> element to produce KV<V, K>.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/elementwise/kvswap/',
  },
  'KV Swap': {
    title: 'KV Swap (KvSwap)',
    description: 'Swaps the key and value of each KV<K, V> element to produce KV<V, K>.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/elementwise/kvswap/',
  },
  'STEP:ToString': {
    title: 'ToString',
    description: 'Converts every element, key-value pair, or iterable in a PCollection to its String representation.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/elementwise/tostring/',
  },
  'ToString': {
    title: 'ToString',
    description: 'Converts every element, key-value pair, or iterable in a PCollection to its String representation.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/elementwise/tostring/',
  },
  'To String': {
    title: 'To String',
    description: 'Converts every element, key-value pair, or iterable in a PCollection to its String representation.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/elementwise/tostring/',
  },
  'STEP:Values': {
    title: 'Values',
    description: 'Extracts the value from each KV<K, V> element in a PCollection.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/elementwise/values/',
  },
  'Values': {
    title: 'Values',
    description: 'Extracts the value from each KV<K, V> element in a PCollection.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/elementwise/values/',
  },
};

/**
 * Transforms whose property panels already render their own inline header card with a
 * description and a "Docs ↗" button. PropertyForm skips rendering a wrapper NodeDocsCard
 * for these transforms so the header card is never duplicated.
 */
export const SELF_DOCUMENTED_TRANSFORMS = new Set<string>([
  // 9 Community / Data Services Connectors
  'CloudBigtable',
  'CloudSQL',
  'CogniteDataFusion',
  'KineticaDB',
  'MySQL',
  'MySQLPostgreSQLOracleSQLServer',
  'Pyodbc',
  'Tinybird',
  'TrepWsIO',
  // Aggregations (rendered inline by AggregationProperties)
  'ApproximateQuantiles',
  'Approximate Quantiles',
  'Approximate Quantile',
  'ApproximateUnique',
  'Approximate Unique',
  'BatchElements',
  'Batch Elements',
  'CoGroupByKey',
  'Co Group By Key',
  'Combine',
  'CombineWithContext',
  'Combine With Context',
  'Count',
  'Distinct',
  'GroupByKey',
  'Group By Key',
  'GroupIntoBatches',
  'Group Into Batches',
  'Latest',
  'Max',
  'Mean',
  'Min',
  'Sample',
  'Sum',
  'Top',
  // Other Transforms (rendered inline by OtherProperties)
  'Flatten',
  'Reshuffle',
  'ReShuffle',
  'Keys',
  'KvSwap',
  'KV Swap',
  'ToString',
  'To String',
  'Values',
]);

/**
 * Returns true if the node's property component renders its own inline documentation header card.
 */
export function hasInlineNodeDocsCard(node: any): boolean {
  const transform = node?.data?.beam_transform || node?.data?.componentType || '';
  return SELF_DOCUMENTED_TRANSFORMS.has(transform);
}

/**
 * Resolves documentation metadata (title, description, docsUrl) for a pipeline node.
 */
export function getNodeDocumentation(node: any): NodeDocMetadata | undefined {
  const transform = node?.data?.beam_transform || node?.data?.componentType || '';
  const nodeType = (node?.data?.type || '').toUpperCase();
  const label = node?.data?.label || '';

  if (nodeType && transform) {
    const qualifiedKey = `${nodeType}:${transform}`;
    if (NODE_DOCUMENTATION_REGISTRY[qualifiedKey]) {
      return NODE_DOCUMENTATION_REGISTRY[qualifiedKey];
    }
  }

  if (transform && NODE_DOCUMENTATION_REGISTRY[transform]) {
    return NODE_DOCUMENTATION_REGISTRY[transform];
  }

  if (label && NODE_DOCUMENTATION_REGISTRY[label]) {
    return NODE_DOCUMENTATION_REGISTRY[label];
  }

  return undefined;
}
