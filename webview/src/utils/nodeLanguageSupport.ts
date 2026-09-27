/**
 * Node Language Support Registry & Validation Utilities
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Centralizes SDK language compatibility tracking across all Apache Beam Designer
 * palette nodes (Sources, Steps, and Sinks) so the UI and code generator can
 * validate whether a pipeline diagram is compatible with a selected target SDK
 * language (Java, Python, Go, TypeScript).
 *
 * Architectural Decisions:
 * - Single Source of Truth: Maps each `beamTransform` identifier to its supported
 *   SDK languages (`BeamSdkLanguage[]`).
 * - Extensible Multi-Language Design: Built to scale beyond Java and Python as
 *   Go and TypeScript SDK support is rolled out across transforms.
 * - Java-Only Connectors: Explicitly marks `ContextualTextIO`, `TikaIO`,
 *   `ThriftIO`, and `XmlIO` as `['Java']` because Apache Beam provides no native
 *   Python SDK modules or stock cross-language expansion services for these four
 *   file connectors.
 * - Zero Python-Only Connectors: All currently registered palette transforms
 *   support Java (`getPythonOnlyTransforms()` returns `[]`).
 */

import { inferBeamTransform } from './legacyNodeMigration';

export type BeamSdkLanguage = 'Java' | 'Python' | 'Go' | 'TypeScript';

export const SUPPORTED_BEAM_LANGUAGES: readonly BeamSdkLanguage[] = [
  'Java',
  'Python',
  'Go',
  'TypeScript',
] as const;

export interface NodeLanguageMetadata {
  beamTransform: string;
  displayName: string;
  supportedLanguages: readonly BeamSdkLanguage[];
}

/**
 * Default supported languages for standard Beam connectors and transforms
 * when not overridden by a language-specific entry in the registry.
 */
export const DEFAULT_SUPPORTED_LANGUAGES: readonly BeamSdkLanguage[] = [
  'Java',
  'Python',
] as const;

/**
 * Complete registry of all palette node `beamTransform` identifiers and the
 * Apache Beam SDK languages in which code generation is supported.
 */
export const NODE_LANGUAGE_SUPPORT_REGISTRY: Readonly<Record<string, NodeLanguageMetadata>> = {
  // ============================================================================
  // JAVA-ONLY FILE CONNECTORS (4 connectors)
  // ============================================================================
  ContextualTextIO: {
    beamTransform: 'ContextualTextIO',
    displayName: 'ContextualTextIO',
    supportedLanguages: ['Java'],
  },
  TikaIO: {
    beamTransform: 'TikaIO',
    displayName: 'TikaIO',
    supportedLanguages: ['Java'],
  },
  ThriftIO: {
    beamTransform: 'ThriftIO',
    displayName: 'ThriftIO',
    supportedLanguages: ['Java'],
  },
  XmlIO: {
    beamTransform: 'XmlIO',
    displayName: 'XmlIO',
    supportedLanguages: ['Java'],
  },

  // ============================================================================
  // MULTI-LANGUAGE FILE & TABLE STORAGE CONNECTORS
  // ============================================================================
  TextIO: {
    beamTransform: 'TextIO',
    displayName: 'TextIO',
    supportedLanguages: ['Java', 'Python', 'Go', 'TypeScript'],
  },
  FileIO: {
    beamTransform: 'FileIO',
    displayName: 'FileIO',
    supportedLanguages: ['Java', 'Python'],
  },
  AvroIO: {
    beamTransform: 'AvroIO',
    displayName: 'AvroIO',
    supportedLanguages: ['Java', 'Python', 'Go'],
  },
  ParquetIO: {
    beamTransform: 'ParquetIO',
    displayName: 'ParquetIO',
    supportedLanguages: ['Java', 'Python', 'Go'],
  },
  TFRecordIO: {
    beamTransform: 'TFRecordIO',
    displayName: 'TFRecordIO',
    supportedLanguages: ['Java', 'Python'],
  },
  CsvIO: {
    beamTransform: 'CsvIO',
    displayName: 'CsvIO',
    supportedLanguages: ['Java', 'Python'],
  },
  JsonIO: {
    beamTransform: 'JsonIO',
    displayName: 'JsonIO',
    supportedLanguages: ['Java', 'Python'],
  },
  IcebergIO: {
    beamTransform: 'IcebergIO',
    displayName: 'Iceberg',
    supportedLanguages: ['Java', 'Python'],
  },
  GcsFileSystem: {
    beamTransform: 'GcsFileSystem',
    displayName: 'GcsFileSystem',
    supportedLanguages: ['Java', 'Python', 'Go'],
  },
  S3FileSystem: {
    beamTransform: 'S3FileSystem',
    displayName: 'S3FileSystem',
    supportedLanguages: ['Java', 'Python', 'Go'],
  },
  AzureBlobStoreFileSystem: {
    beamTransform: 'AzureBlobStoreFileSystem',
    displayName: 'AzureBlobStoreFileSystem',
    supportedLanguages: ['Java', 'Python'],
  },
  HadoopFileSystem: {
    beamTransform: 'HadoopFileSystem',
    displayName: 'HadoopFileSystem',
    supportedLanguages: ['Java', 'Python'],
  },
  LocalFileSystem: {
    beamTransform: 'LocalFileSystem',
    displayName: 'LocalFileSystem',
    supportedLanguages: ['Java', 'Python', 'Go', 'TypeScript'],
  },

  // ============================================================================
  // STREAMING, MESSAGING & DATABASE CONNECTORS
  // ============================================================================
  KafkaIO: {
    beamTransform: 'KafkaIO',
    displayName: 'Kafka',
    supportedLanguages: ['Java', 'Python', 'Go'],
  },
  KinesisIO: {
    beamTransform: 'KinesisIO',
    displayName: 'Kinesis',
    supportedLanguages: ['Java', 'Python'],
  },
  PubSubIO: {
    beamTransform: 'PubSubIO',
    displayName: 'PubSub',
    supportedLanguages: ['Java', 'Python', 'Go'],
  },
  SnsIO: {
    beamTransform: 'SnsIO',
    displayName: 'SNS',
    supportedLanguages: ['Java', 'Python'],
  },
  JmsIO: {
    beamTransform: 'JmsIO',
    displayName: 'JMS',
    supportedLanguages: ['Java', 'Python'],
  },
  SqsIO: {
    beamTransform: 'SqsIO',
    displayName: 'SQS',
    supportedLanguages: ['Java', 'Python'],
  },
  MqttIO: {
    beamTransform: 'MqttIO',
    displayName: 'MQTT',
    supportedLanguages: ['Java', 'Python'],
  },
  AmqpIO: {
    beamTransform: 'AmqpIO',
    displayName: 'AMQP',
    supportedLanguages: ['Java', 'Python'],
  },
  RabbitMqIO: {
    beamTransform: 'RabbitMqIO',
    displayName: 'RabbitMQ',
    supportedLanguages: ['Java', 'Python'],
  },
  PulsarIO: {
    beamTransform: 'PulsarIO',
    displayName: 'Pulsar',
    supportedLanguages: ['Java', 'Python'],
  },
  SolaceIO: {
    beamTransform: 'SolaceIO',
    displayName: 'Solace',
    supportedLanguages: ['Java', 'Python'],
  },
  FlinkStreamingImpulseSource: {
    beamTransform: 'FlinkStreamingImpulseSource',
    displayName: 'Flink Streaming Impulse',
    supportedLanguages: ['Python'],
  },
  GenerateSequence: {
    beamTransform: 'GenerateSequence',
    displayName: 'Generate Sequence',
    supportedLanguages: ['Java', 'Python', 'Go'],
  },
  PeriodicImpulse: {
    beamTransform: 'PeriodicImpulse',
    displayName: 'Periodic Impulse',
    supportedLanguages: ['Java', 'Python'],
  },
  BigQueryIO: {
    beamTransform: 'BigQueryIO',
    displayName: 'BigQuery',
    supportedLanguages: ['Java', 'Python', 'Go'],
  },
  JdbcIO: {
    beamTransform: 'JdbcIO',
    displayName: 'JdbcIO',
    supportedLanguages: ['Java', 'Python', 'Go'],
  },
  CassandraIO: {
    beamTransform: 'CassandraIO',
    displayName: 'Cassandra',
    supportedLanguages: ['Java', 'Python'],
  },
  HBaseIO: {
    beamTransform: 'HBaseIO',
    displayName: 'HBase',
    supportedLanguages: ['Java', 'Python'],
  },
  KuduIO: {
    beamTransform: 'KuduIO',
    displayName: 'Kudu',
    supportedLanguages: ['Java', 'Python'],
  },
  MongoDbIO: {
    beamTransform: 'MongoDbIO',
    displayName: 'MongoDB',
    supportedLanguages: ['Java', 'Python'],
  },
  RedisIO: {
    beamTransform: 'RedisIO',
    displayName: 'Redis',
    supportedLanguages: ['Java', 'Python'],
  },
  ClickHouseIO: {
    beamTransform: 'ClickHouseIO',
    displayName: 'ClickHouse',
    supportedLanguages: ['Java', 'Python'],
  },
  DatastoreIO: {
    beamTransform: 'DatastoreIO',
    displayName: 'Cloud Datastore',
    supportedLanguages: ['Java', 'Python'],
  },
  DynamoDBIO: {
    beamTransform: 'DynamoDBIO',
    displayName: 'DynamoDB',
    supportedLanguages: ['Java', 'Python'],
  },
  FirestoreIO: {
    beamTransform: 'FirestoreIO',
    displayName: 'Firestore',
    supportedLanguages: ['Java', 'Python'],
  },
  InfluxDbIO: {
    beamTransform: 'InfluxDbIO',
    displayName: 'InfluxDB',
    supportedLanguages: ['Java', 'Python'],
  },
  Neo4jIO: {
    beamTransform: 'Neo4jIO',
    displayName: 'Neo4j',
    supportedLanguages: ['Java', 'Python'],
  },
  SingleStoreDBIO: {
    beamTransform: 'SingleStoreDBIO',
    displayName: 'SingleStoreDB',
    supportedLanguages: ['Java', 'Python'],
  },
  SnowflakeIO: {
    beamTransform: 'SnowflakeIO',
    displayName: 'Snowflake',
    supportedLanguages: ['Java', 'Python'],
  },
  SpannerIO: {
    beamTransform: 'SpannerIO',
    displayName: 'Cloud Spanner',
    supportedLanguages: ['Java', 'Python', 'Go'],
  },
  BigTableIO: {
    beamTransform: 'BigTableIO',
    displayName: 'Cloud Bigtable',
    supportedLanguages: ['Java', 'Python', 'Go'],
  },
  MongoDbGridFSIO: {
    beamTransform: 'MongoDbGridFSIO',
    displayName: 'MongoDB GridFS',
    supportedLanguages: ['Java', 'Python'],
  },
  DatabaseIO: {
    beamTransform: 'DatabaseIO',
    displayName: 'Database',
    supportedLanguages: ['Java', 'Python'],
  },
  ElasticsearchIO: {
    beamTransform: 'ElasticsearchIO',
    displayName: 'Elasticsearch',
    supportedLanguages: ['Java', 'Python'],
  },
  SolrIO: {
    beamTransform: 'SolrIO',
    displayName: 'Solr',
    supportedLanguages: ['Java', 'Python'],
  },
  HadoopFormatIO: {
    beamTransform: 'HadoopFormatIO',
    displayName: 'Hadoop Format',
    supportedLanguages: ['Java', 'Python'],
  },
  HCatalogIO: {
    beamTransform: 'HCatalogIO',
    displayName: 'HCatalog',
    supportedLanguages: ['Java', 'Python'],
  },
  DebeziumIO: {
    beamTransform: 'DebeziumIO',
    displayName: 'Debezium CDC',
    supportedLanguages: ['Java', 'Python'],
  },
  CdapIO: {
    beamTransform: 'CdapIO',
    displayName: 'CDAP',
    supportedLanguages: ['Java', 'Python'],
  },
  ArrowFlightIO: {
    beamTransform: 'ArrowFlightIO',
    displayName: 'Arrow Flight',
    supportedLanguages: ['Java', 'Python'],
  },
  CosmosIO: {
    beamTransform: 'CosmosIO',
    displayName: 'Azure Cosmos DB',
    supportedLanguages: ['Java', 'Python'],
  },
  SparkReceiverIO: {
    beamTransform: 'SparkReceiverIO',
    displayName: 'Spark Receiver',
    supportedLanguages: ['Java', 'Python'],
  },
  Create: {
    beamTransform: 'Create',
    displayName: 'Create',
    supportedLanguages: ['Java', 'Python', 'Go', 'TypeScript'],
  },
  LogMessage: {
    beamTransform: 'LogMessage',
    displayName: 'Log Message',
    supportedLanguages: ['Java', 'Python', 'Go', 'TypeScript'],
  },
  CloudBigtable: {
    beamTransform: 'CloudBigtable',
    displayName: 'Cloud Bigtable (HBase based)',
    supportedLanguages: ['Java', 'Python'],
  },
  CogniteDataFusion: {
    beamTransform: 'CogniteDataFusion',
    displayName: 'Cognite Data Fusion',
    supportedLanguages: ['Java', 'Python'],
  },
  KineticaDB: {
    beamTransform: 'KineticaDB',
    displayName: 'KineticaDB',
    supportedLanguages: ['Java', 'Python'],
  },
  TrepWsIO: {
    beamTransform: 'TrepWsIO',
    displayName: 'TrepWsIO',
    supportedLanguages: ['Java', 'Python'],
  },
  CloudSQL: {
    beamTransform: 'CloudSQL',
    displayName: 'Cloud SQL',
    supportedLanguages: ['Java', 'Python'],
  },
  MySQL: {
    beamTransform: 'MySQL',
    displayName: 'MySQL',
    supportedLanguages: ['Java', 'Python'],
  },
  Pyodbc: {
    beamTransform: 'Pyodbc',
    displayName: 'Pyodbc',
    supportedLanguages: ['Java', 'Python'],
  },
  Tinybird: {
    beamTransform: 'Tinybird',
    displayName: 'Tinybird',
    supportedLanguages: ['Java', 'Python'],
  },
  MySQLPostgreSQLOracleSQLServer: {
    beamTransform: 'MySQLPostgreSQLOracleSQLServer',
    displayName: 'MySQL, PostgreSQL, Oracle, SQL Server',
    supportedLanguages: ['Java', 'Python'],
  },

  // ============================================================================
  // HEALTHCARE CONNECTORS (CLOUD HEALTHCARE API)
  // ============================================================================
  FhirIO: {
    beamTransform: 'FhirIO',
    displayName: 'FhirIO',
    supportedLanguages: ['Java', 'Python'],
  },
  HL7v2IO: {
    beamTransform: 'HL7v2IO',
    displayName: 'HL7v2IO',
    supportedLanguages: ['Java', 'Python'],
  },
  DicomIO: {
    beamTransform: 'DicomIO',
    displayName: 'DicomIO',
    supportedLanguages: ['Java', 'Python'],
  },

  // ============================================================================
  // SAAS & HTTP/RPC CONNECTORS
  // ============================================================================
  GoogleAdsIO: {
    beamTransform: 'GoogleAdsIO',
    displayName: 'GoogleAdsIO',
    supportedLanguages: ['Java', 'Python'],
  },
  RequestResponseIO: {
    beamTransform: 'RequestResponseIO',
    displayName: 'Web APIs (RequestResponseIO)',
    supportedLanguages: ['Java', 'Python'],
  },

  // ============================================================================
  // OBSERVABILITY & LOGGING SINKS
  // ============================================================================
  SplunkIO: {
    beamTransform: 'SplunkIO',
    displayName: 'SplunkIO',
    supportedLanguages: ['Java', 'Python'],
  },
  DatadogIO: {
    beamTransform: 'DatadogIO',
    displayName: 'DatadogIO',
    supportedLanguages: ['Java', 'Python'],
  },

  // ============================================================================
  // STEP / CORE PTRANSFORM NODES
  // ============================================================================
  ParDo: {
    beamTransform: 'ParDo',
    displayName: 'ParDo',
    supportedLanguages: ['Java', 'Python', 'Go', 'TypeScript'],
  },
  ParseMessage: {
    beamTransform: 'ParseMessage',
    displayName: 'Parse Message',
    supportedLanguages: ['Java', 'Python'],
  },
  WithTimestamps: {
    beamTransform: 'WithTimestamps',
    displayName: 'Add Timestamp',
    supportedLanguages: ['Java', 'Python', 'Go'],
  },
  Filter: {
    beamTransform: 'Filter',
    displayName: 'Filter',
    supportedLanguages: ['Java', 'Python', 'Go', 'TypeScript'],
  },
  FlatMap: {
    beamTransform: 'FlatMap',
    displayName: 'FlatMap',
    supportedLanguages: ['Java', 'Python', 'Go', 'TypeScript'],
  },
  Keys: {
    beamTransform: 'Keys',
    displayName: 'Keys',
    supportedLanguages: ['Java', 'Python', 'Go'],
  },
  KVMapper: {
    beamTransform: 'KVMapper',
    displayName: 'KV Mapper',
    supportedLanguages: ['Java', 'Python', 'Go'],
  },
  KvSwap: {
    beamTransform: 'KvSwap',
    displayName: 'KV Swap',
    supportedLanguages: ['Java', 'Python', 'Go'],
  },
  Map: {
    beamTransform: 'Map',
    displayName: 'Map',
    supportedLanguages: ['Java', 'Python', 'Go', 'TypeScript'],
  },
  ToString: {
    beamTransform: 'ToString',
    displayName: 'To String',
    supportedLanguages: ['Java', 'Python', 'Go'],
  },
  Values: {
    beamTransform: 'Values',
    displayName: 'Values',
    supportedLanguages: ['Java', 'Python', 'Go'],
  },
  ApproximateQuantiles: {
    beamTransform: 'ApproximateQuantiles',
    displayName: 'Approximate Quantiles',
    supportedLanguages: ['Java', 'Python'],
  },
  ApproximateUnique: {
    beamTransform: 'ApproximateUnique',
    displayName: 'Approximate Unique',
    supportedLanguages: ['Java', 'Python'],
  },
  BatchElements: {
    beamTransform: 'BatchElements',
    displayName: 'Batch Elements',
    supportedLanguages: ['Java', 'Python'],
  },
  CoGroupByKey: {
    beamTransform: 'CoGroupByKey',
    displayName: 'Co Group By Key',
    supportedLanguages: ['Java', 'Python', 'Go'],
  },
  Combine: {
    beamTransform: 'Combine',
    displayName: 'Combine',
    supportedLanguages: ['Java', 'Python', 'Go'],
  },
  CombineWithContext: {
    beamTransform: 'CombineWithContext',
    displayName: 'Combine With Context',
    supportedLanguages: ['Java', 'Python'],
  },
  Count: {
    beamTransform: 'Count',
    displayName: 'Count',
    supportedLanguages: ['Java', 'Python', 'Go', 'TypeScript'],
  },
  Distinct: {
    beamTransform: 'Distinct',
    displayName: 'Distinct',
    supportedLanguages: ['Java', 'Python', 'Go'],
  },
  GroupByKey: {
    beamTransform: 'GroupByKey',
    displayName: 'Group By Key',
    supportedLanguages: ['Java', 'Python', 'Go', 'TypeScript'],
  },
  GroupIntoBatches: {
    beamTransform: 'GroupIntoBatches',
    displayName: 'Group Into Batches',
    supportedLanguages: ['Java', 'Python'],
  },
  Latest: {
    beamTransform: 'Latest',
    displayName: 'Latest',
    supportedLanguages: ['Java', 'Python'],
  },
  Max: {
    beamTransform: 'Max',
    displayName: 'Max',
    supportedLanguages: ['Java', 'Python', 'Go'],
  },
  Mean: {
    beamTransform: 'Mean',
    displayName: 'Mean',
    supportedLanguages: ['Java', 'Python', 'Go'],
  },
  Min: {
    beamTransform: 'Min',
    displayName: 'Min',
    supportedLanguages: ['Java', 'Python', 'Go'],
  },
  Sample: {
    beamTransform: 'Sample',
    displayName: 'Sample',
    supportedLanguages: ['Java', 'Python'],
  },
  Sum: {
    beamTransform: 'Sum',
    displayName: 'Sum',
    supportedLanguages: ['Java', 'Python', 'Go'],
  },
  Top: {
    beamTransform: 'Top',
    displayName: 'Top',
    supportedLanguages: ['Java', 'Python'],
  },
  WindowInto: {
    beamTransform: 'WindowInto',
    displayName: 'Window',
    supportedLanguages: ['Java', 'Python', 'Go', 'TypeScript'],
  },
  Flatten: {
    beamTransform: 'Flatten',
    displayName: 'Flatten',
    supportedLanguages: ['Java', 'Python', 'Go', 'TypeScript'],
  },
  Reshuffle: {
    beamTransform: 'Reshuffle',
    displayName: 'ReShuffle',
    supportedLanguages: ['Java', 'Python', 'Go'],
  },
};

/**
 * Normalizes any transform string or label to its canonical registry key.
 * E.g., 'TikaIO Parse' -> 'TikaIO', 'tika' -> 'TikaIO', 'ContextualTextIO Read' -> 'ContextualTextIO',
 * 'Iceberg' -> 'IcebergIO', 'FileIO.match' -> 'FileIO', etc.
 */
export function normalizeTransformName(raw?: string): string {
  if (!raw || typeof raw !== 'string') {
    return '';
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return '';
  }

  // Exact match in registry
  if (NODE_LANGUAGE_SUPPORT_REGISTRY[trimmed]) {
    return trimmed;
  }

  const lower = trimmed.toLowerCase();

  // Case-insensitive direct match in registry
  for (const key of Object.keys(NODE_LANGUAGE_SUPPORT_REGISTRY)) {
    if (key.toLowerCase() === lower) {
      return key;
    }
  }

  // Check known aliases and substrings
  if (lower.includes('tika')) return 'TikaIO';
  if (lower.includes('contextualtext') || lower.includes('contextual text') || lower.includes('contextual')) return 'ContextualTextIO';
  if (lower.includes('thrift')) return 'ThriftIO';
  if (lower.includes('xml')) return 'XmlIO';
  if (lower.includes('iceberg')) return 'IcebergIO';
  if (lower.includes('tfrecord')) return 'TFRecordIO';
  if (lower.includes('csv')) return 'CsvIO';
  if (lower.includes('json') && !lower.includes('simplejson')) return 'JsonIO';
  if (lower.includes('parquet')) return 'ParquetIO';
  if (lower.includes('avro')) return 'AvroIO';
  if (lower.includes('fileio')) return 'FileIO';
  if (lower.includes('textio')) return 'TextIO';
  if (lower.includes('hadoopformat') || lower.includes('hadoop format')) return 'HadoopFormatIO';
  if (lower.includes('hadoop') || lower.includes('hdfs')) return 'HadoopFileSystem';
  if (lower.includes('azure') || lower.includes('blobstorage') || lower.includes('azfs')) return 'AzureBlobStoreFileSystem';
  if (lower.includes('s3') || lower.includes('s3filesystem')) return 'S3FileSystem';
  if (lower.includes('gcs') || lower.includes('gcsfilesystem')) return 'GcsFileSystem';
  if (lower.includes('localfile') || lower.includes('local filesystem')) return 'LocalFileSystem';
  if (lower.includes('bigquery')) return 'BigQueryIO';
  if (lower.includes('pubsub')) return 'PubSubIO';
  if (lower.includes('kafka')) return 'KafkaIO';
  if (lower.includes('kinesis')) return 'KinesisIO';
  if (lower.includes('sns')) return 'SnsIO';
  if (lower.includes('sqs')) return 'SqsIO';
  if (lower.includes('jms')) return 'JmsIO';
  if (lower.includes('mqtt')) return 'MqttIO';
  if (lower.includes('jdbc')) return 'JdbcIO';
  if (lower.includes('pardo')) return 'ParDo';
  if (lower.includes('amqp')) return 'AmqpIO';
  if (lower.includes('rabbitmq')) return 'RabbitMqIO';
  if (lower.includes('pulsar')) return 'PulsarIO';
  if (lower.includes('solace')) return 'SolaceIO';
  if (lower.includes('flinkstreamingimpulse') || lower.includes('flink streaming impulse') || lower.includes('flink impulse')) return 'FlinkStreamingImpulseSource';
  if (lower.includes('log message') || lower === 'logmessage') return 'LogMessage';

  return trimmed;
}

/**
 * Robustly extracts the canonical Beam transform name from any React Flow node.
 * Checks snake_case `beam_transform` (standard across this codebase), camelCase `beamTransform`,
 * node properties, componentType, and falls back to inferring from (type, iconName, label).
 */
export function resolveNodeBeamTransform(node: any): string {
  if (!node) return '';
  const data = node.data || {};
  const props = data.properties || {};

  // 1. Direct explicit transform metadata
  const explicit =
    data.beam_transform ||
    data.beamTransform ||
    props.beam_transform ||
    props.beamTransform ||
    node.beam_transform ||
    node.beamTransform ||
    data.componentType;

  if (explicit && typeof explicit === 'string') {
    const canonical = normalizeTransformName(explicit);
    if (canonical) {
      return canonical;
    }
  }

  // 2. Infer via legacy migration rules (type, iconName, label)
  const inferred = inferBeamTransform(data);
  if (inferred) {
    const canonical = normalizeTransformName(inferred);
    if (canonical) {
      return canonical;
    }
  }

  // 3. Fallback to label
  if (data.label && typeof data.label === 'string') {
    const fromLabel = normalizeTransformName(data.label);
    if (fromLabel) {
      return fromLabel;
    }
  }

  return '';
}

/**
 * Normalizes any string representation of a Beam SDK language to the canonical enum.
 */
export function normalizeLanguage(lang?: string): BeamSdkLanguage {
  if (!lang || typeof lang !== 'string') return 'Python';
  const lower = lang.trim().toLowerCase();
  if (lower === 'java') return 'Java';
  if (lower === 'python') return 'Python';
  if (lower === 'go') return 'Go';
  if (lower === 'typescript' || lower === 'ts') return 'TypeScript';
  return (lang.charAt(0).toUpperCase() + lang.slice(1).toLowerCase()) as BeamSdkLanguage;
}

/**
 * Returns the list of SDK languages supported by a given `beamTransform`.
 * Defaults to `['Java', 'Python']` for standard connectors not explicitly
 * restricted in `NODE_LANGUAGE_SUPPORT_REGISTRY`.
 */
export function getSupportedLanguages(beamTransform?: string): readonly BeamSdkLanguage[] {
  if (!beamTransform) {
    return DEFAULT_SUPPORTED_LANGUAGES;
  }
  const canonical = normalizeTransformName(beamTransform);
  const entry = NODE_LANGUAGE_SUPPORT_REGISTRY[canonical] || NODE_LANGUAGE_SUPPORT_REGISTRY[beamTransform];
  return entry ? entry.supportedLanguages : DEFAULT_SUPPORTED_LANGUAGES;
}

/**
 * Returns true if the given `beamTransform` is supported in the target SDK language.
 */
export function isNodeSupportedInLanguage(
  beamTransform: string | undefined,
  language: string
): boolean {
  const normLang = normalizeLanguage(language);
  const supported = getSupportedLanguages(beamTransform);
  return supported.includes(normLang);
}

/**
 * Returns true if the given `beamTransform` is strictly Java-only (`['Java']`).
 */
export function isJavaOnlyTransform(beamTransform?: string): boolean {
  const supported = getSupportedLanguages(beamTransform);
  return supported.length === 1 && supported[0] === 'Java';
}

/**
 * Returns true if the given `beamTransform` is strictly Python-only (`['Python']`).
 */
export function isPythonOnlyTransform(beamTransform?: string): boolean {
  const supported = getSupportedLanguages(beamTransform);
  return supported.length === 1 && supported[0] === 'Python';
}

/**
 * Returns all registered `beamTransform` identifiers that are strictly Java-only.
 */
export function getJavaOnlyTransforms(): string[] {
  return Object.values(NODE_LANGUAGE_SUPPORT_REGISTRY)
    .filter((meta) => meta.supportedLanguages.length === 1 && meta.supportedLanguages[0] === 'Java')
    .map((meta) => meta.beamTransform)
    .sort();
}

/**
 * Returns all registered `beamTransform` identifiers that are strictly Python-only.
 */
export function getPythonOnlyTransforms(): string[] {
  return Object.values(NODE_LANGUAGE_SUPPORT_REGISTRY)
    .filter(
      (meta) => meta.supportedLanguages.length === 1 && meta.supportedLanguages[0] === 'Python'
    )
    .map((meta) => meta.beamTransform)
    .sort();
}

export interface UnsupportedDiagramNode {
  id: string;
  label: string;
  beamTransform: string;
  supportedLanguages: readonly BeamSdkLanguage[];
}

export interface DiagramLanguageValidationResult {
  isValid: boolean;
  unsupportedNodes: UnsupportedDiagramNode[];
  errors: string[];
}

/**
 * Validates all nodes in a pipeline diagram against a selected target SDK language
 * (e.g. `'Python'`, `'Java'`, `'Go'`, `'TypeScript'`).
 *
 * When one or more nodes on the canvas do not support `targetLanguage`, returns
 * `isValid: false` along with human-readable validation error messages suitable
 * for rendering in the Generate Code tab banner.
 */
export function validateDiagramLanguageSupport(
  nodes: ReadonlyArray<any>,
  targetLanguage: string
): DiagramLanguageValidationResult {
  const normTargetLanguage = normalizeLanguage(targetLanguage);
  const unsupportedNodes: UnsupportedDiagramNode[] = [];
  const errors: string[] = [];

  for (const node of nodes || []) {
    const beamTransform = resolveNodeBeamTransform(node);
    if (!beamTransform) {
      continue;
    }

    const supportedLanguages = getSupportedLanguages(beamTransform);
    if (!supportedLanguages.includes(normTargetLanguage)) {
      const label = node?.data?.label || beamTransform;
      const id = node?.id || label;
      unsupportedNodes.push({
        id,
        label,
        beamTransform,
        supportedLanguages,
      });

      const supportedList = supportedLanguages.join(', ');
      errors.push(
        `Node "${label}" (${beamTransform}) is only supported in ${supportedList} and cannot generate ${normTargetLanguage} code.`
      );
    }
  }

  return {
    isValid: unsupportedNodes.length === 0,
    unsupportedNodes,
    errors,
  };
}

