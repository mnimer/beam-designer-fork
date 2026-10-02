/**
 * Legacy Node Migration Utility
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Provides deterministic, one-time migration for legacy canvas nodes saved in older .beam
 * files that lack an explicit `beam_transform` metadata property.
 * 
 * Architectural Decisions:
 * - Uses (type, iconName, label) triple to deterministically infer `beam_transform`.
 * - Prioritizes immutable (type, iconName) pairs as the primary key and only uses label
 *   to disambiguate nodes sharing identical icons (e.g. Radio for PubSub vs MQTT).
 * - Strictly idempotent: Never overwrites an existing `beam_transform`.
 * - Returns null for unknown nodes to preserve fail-fast unregistered state.
 * - Logs observable summary when migration occurs at pipeline load time.
 */

/**
 * Shape of legacy node data read from older pipeline YAML representations.
 */
export interface LegacyNodeData {
  label?: string;
  type?: string;
  iconName?: string;
  beam_transform?: string;
  componentType?: string;
  [key: string]: any;
}

const KNOWN_AGGREGATIONS = [
  'Approximate Quantiles', 'Approximate Quantile', 'ApproximateQuantiles',
  'Approximate Unique', 'ApproximateUnique',
  'Co Group By Key', 'CoGroupByKey',
  'Combine', 'Combine With Context', 'CombineWithContext',
  'Count', 'Distinct',
  'Group By Key', 'GroupByKey',
  'Group Into Batches', 'GroupIntoBatches',
  'Batch Elements', 'BatchElements',
  'Latest', 'Max', 'Mean', 'Min', 'Sample', 'Sum', 'Top'
];

/**
 * Infers the canonical `beam_transform` for a legacy node based on its (type, iconName, label) triple.
 * 
 * NOTE: Idempotent - if `beam_transform` is already present, returns it directly.
 * Returns null if the node cannot be deterministically identified.
 * 
 * @param data - The legacy node data dictionary
 * @returns Canonical beam_transform string or null if unknown
 */
export function inferBeamTransform(data: LegacyNodeData): string | null {
  if (!data) {
    return null;
  }

  // Idempotent: Never overwrite an existing beam_transform or componentType
  if (data.beam_transform) {
    return data.beam_transform;
  }
  if (data.componentType) {
    return data.componentType;
  }

  const type = (data.type || '').toUpperCase();
  const icon = data.iconName || '';
  const label = (data.label || '').trim();
  const labelLower = label.toLowerCase();

  // =========================================================================
  // Primary Strategy: (type, iconName) with label disambiguation
  // =========================================================================

  if (type === 'SOURCE') {
    switch (icon) {
      case 'ListOrdered':
        return 'GenerateSequence';
      case 'Zap':
        return 'PeriodicImpulse';
      case 'Box':
        return 'Create';
      case 'FileText':
        if (labelLower.includes('tika')) return 'TikaIO';
        if (labelLower.includes('contextual')) return 'ContextualTextIO';
        if (labelLower.includes('csv')) return 'CsvIO';
        return 'TextIO';
      case 'HardDrive':
        return 'HadoopFileSystem';
      case 'Cloud':
        if (labelLower.includes('gcs') || labelLower.includes('google')) return 'GcsFileSystem';
        if (labelLower.includes('s3') || labelLower.includes('amazon') || labelLower.includes('aws')) return 'S3FileSystem';
        if (labelLower.includes('azure') || labelLower.includes('blob')) return 'AzureBlobStoreFileSystem';
        return 'KinesisIO';
      case 'Share2':
        return 'SnsIO';
      case 'Folder':
        if (labelLower.includes('local')) return 'LocalFileSystem';
        return 'FileIO.match';
      case 'Radio':
        return labelLower.includes('mqtt') ? 'MqttIO' : 'PubSubIO';
      case 'Database':
        if (labelLower.includes('iceberg')) return 'IcebergIO';
        return labelLower.includes('jdbc') ? 'JdbcIO' : 'BigQueryIO';
      case 'Cable':
        if (labelLower.includes('jms')) return 'JmsIO';
        if (labelLower.includes('sqs')) return 'SqsIO';
        return 'KafkaIO';
      case 'FileCode':
        if (labelLower.includes('xml')) return 'XmlIO';
        if (labelLower.includes('thrift')) return 'ThriftIO';
        if (labelLower.includes('tfrecord')) return 'TFRecordIO';
        if (labelLower.includes('json')) return 'JsonIO';
        return labelLower.includes('parquet') ? 'ParquetIO' : 'AvroIO';
      default:
        break;
    }
  } else if (type === 'SINK') {
    switch (icon) {
      case 'Terminal':
        return 'LogMessage';
      case 'FileText':
        if (labelLower.includes('tika')) return 'TikaIO';
        if (labelLower.includes('contextual')) return 'ContextualTextIO';
        if (labelLower.includes('csv')) return 'CsvIO';
        return 'TextIO';
      case 'HardDrive':
        return 'HadoopFileSystem';
      case 'Cloud':
        if (labelLower.includes('gcs') || labelLower.includes('google')) return 'GcsFileSystem';
        if (labelLower.includes('s3') || labelLower.includes('amazon') || labelLower.includes('aws')) return 'S3FileSystem';
        if (labelLower.includes('azure') || labelLower.includes('blob')) return 'AzureBlobStoreFileSystem';
        return 'KinesisIO';
      case 'Share2':
        return 'SnsIO';
      case 'Folder':
        if (labelLower.includes('local')) return 'LocalFileSystem';
        return 'FileIO';
      case 'Radio':
        return labelLower.includes('mqtt') ? 'MqttIO' : 'PubSubIO';
      case 'Database':
        if (labelLower.includes('iceberg')) return 'IcebergIO';
        return labelLower.includes('jdbc') ? 'JdbcIO' : 'BigQueryIO';
      case 'Cable':
        if (labelLower.includes('jms')) return 'JmsIO';
        if (labelLower.includes('sqs')) return 'SqsIO';
        return 'KafkaIO';
      case 'FileCode':
        if (labelLower.includes('xml')) return 'XmlIO';
        if (labelLower.includes('thrift')) return 'ThriftIO';
        if (labelLower.includes('tfrecord')) return 'TFRecordIO';
        if (labelLower.includes('json')) return 'JsonIO';
        return labelLower.includes('parquet') ? 'ParquetIO' : 'AvroIO';
      default:
        break;
    }
  } else if (type === 'STEP') {
    switch (icon) {
      case 'Code':
        return 'ParDo';
      case 'Terminal':
        return 'LogMessage';
      case 'Calendar':
        return 'WithTimestamps';
      case 'Filter':
        return 'Filter';
      case 'GitMerge':
        return 'FlatMap';
      case 'Hash':
        return 'KVMapper';
      case 'Activity':
        return 'Map';
      case 'Clock':
        return 'Window';
      case 'Layers':
        return 'Flatten';
      case 'Shuffle':
        return 'Reshuffle';
      case 'FileCode':
        return (labelLower.includes('fileio') || labelLower.includes('read matches'))
          ? 'FileIO.readMatches'
          : 'ParseMessage';
      case 'BarChart': {
        const found = KNOWN_AGGREGATIONS.find(agg => agg.toLowerCase() === labelLower);
        return found || 'Combine';
      }
      default:
        break;
    }
  }

  // =========================================================================
  // Secondary Strategy: Disambiguate by known label substring from legacy inventory
  // =========================================================================

  if (labelLower.includes('tika')) return 'TikaIO';
  if (labelLower.includes('contextual')) return 'ContextualTextIO';
  if (labelLower.includes('thrift')) return 'ThriftIO';
  if (labelLower.includes('xml')) return 'XmlIO';
  if (labelLower.includes('iceberg')) return 'IcebergIO';
  if (labelLower.includes('tfrecord')) return 'TFRecordIO';
  if (labelLower.includes('csv')) return 'CsvIO';
  if (labelLower.includes('json') && !labelLower.includes('simplejson')) return 'JsonIO';
  if (labelLower.includes('hadoop') || labelLower.includes('hdfs')) return 'HadoopFileSystem';
  if (labelLower.includes('azure') || labelLower.includes('blob')) return 'AzureBlobStoreFileSystem';
  if (labelLower.includes('s3')) return 'S3FileSystem';
  if (labelLower.includes('gcs')) return 'GcsFileSystem';
  if (labelLower.includes('localfile') || labelLower.includes('local filesystem')) return 'LocalFileSystem';
  if (label.includes('PubSub')) return 'PubSubIO';
  if (label.includes('BigQuery')) return 'BigQueryIO';
  if (label.includes('Kafka') || labelLower.includes('kafka')) return 'KafkaIO';
  if (label.includes('TextIO')) return 'TextIO';
  if (label.includes('FileIO')) {
    if (label.includes('Read Matches')) return 'FileIO.readMatches';
    return type === 'SOURCE' ? 'FileIO.match' : 'FileIO';
  }
  if (label.includes('Jdbc') || label.includes('JDBC')) return 'JdbcIO';
  if (label.includes('Generate Sequence')) return 'GenerateSequence';
  if (label.includes('Periodic Impulse')) return 'PeriodicImpulse';
  if (label === 'Create') return 'Create';
  if (labelLower.includes('avro')) return 'AvroIO';
  if (labelLower.includes('parquet')) return 'ParquetIO';
  if (labelLower.includes('sns')) return 'SnsIO';
  if (labelLower.includes('jms')) return 'JmsIO';
  if (labelLower.includes('sqs')) return 'SqsIO';
  if (labelLower.includes('mqtt')) return 'MqttIO';
  if (label === 'Log Message') return 'LogMessage';
  if (labelLower.includes('window')) return 'Window';
  if (label === 'Parse Message') return 'ParseMessage';
  if (labelLower.includes('timestamp')) return 'WithTimestamps';
  if (label === 'KV Mapper') return 'KVMapper';
  if (label === 'Filter') return 'Filter';
  if (label === 'FlatMap') return 'FlatMap';
  if (label === 'Map') return 'Map';
  if (label === 'ParDo') return 'ParDo';
  if (label === 'Flatten') return 'Flatten';
  if (label.toLowerCase() === 'reshuffle') return 'Reshuffle';

  const aggMatch = KNOWN_AGGREGATIONS.find(agg => agg.toLowerCase() === labelLower);
  if (aggMatch) {
    return aggMatch;
  }

  // No confident match: Fail fast rather than guess
  return null;
}

/**
 * Migrates an array of canvas nodes loaded from a .beam YAML file, enriching
 * legacy nodes that lack `beam_transform` metadata.
 * 
 * NOTE: Logs a single-line summary when legacy nodes are migrated.
 * 
 * @param nodes - Array of React Flow node objects
 * @returns Migrated array of React Flow node objects
 */
export function migrateLegacyNodes(nodes: any[]): any[] {
  if (!Array.isArray(nodes) || nodes.length === 0) {
    return nodes || [];
  }

  let migratedCount = 0;

  const migrated = nodes.map((node) => {
    if (!node || !node.data) {
      return node;
    }

    // Skip nodes that already have beam_transform metadata
    if (node.data.beam_transform) {
      return node;
    }

    const inferred = inferBeamTransform(node.data);
    if (inferred) {
      migratedCount++;
      return {
        ...node,
        data: {
          ...node.data,
          beam_transform: inferred,
        },
      };
    }

    return node;
  });

  if (migratedCount > 0) {
    console.log(`[Migration] Migrated ${migratedCount} legacy node${migratedCount === 1 ? '' : 's'} to include beam_transform metadata`);
  }

  return migrated;
}
