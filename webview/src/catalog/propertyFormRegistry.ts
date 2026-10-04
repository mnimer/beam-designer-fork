/** @fileoverview Registry mapping node keys to dedicated property form components.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Bundle-size design (P8):
 * The ~150 dedicated property panels are the bulk of the webview's JavaScript, yet a
 * user only ever opens a handful of them per session. Every panel is therefore
 * registered as a `React.lazy` component backed by a dynamic `import()`, so Vite emits
 * one chunk per panel module under `assets/chunks/` and the entry bundle stays small.
 * The chunk is fetched the first time a node of that kind is selected and cached by the
 * module system afterwards.
 *
 * Consumers must render registry entries inside a `<Suspense>` boundary (see
 * components/PropertyForm.tsx). Code that needs the concrete component (tests,
 * preloading) can resolve it with {@link loadPropertyForm}.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';

/**
 * Shared props accepted by dynamic property form components registered in the registry.
 */
export interface PropertyFormProps {
  node: any;
  onChange: (properties: any) => void;
  onAddKVMapper?: (windowNodeId: string) => void;
  onAddPubSubSource?: (targetNodeId: string) => void;
}

/** Any React component usable as a property form (eager or lazy). */
export type PropertyFormComponent = React.ComponentType<PropertyFormProps>;

/** Async factory resolving a property form module to its concrete component. */
type PropertyFormLoader = () => Promise<PropertyFormComponent>;

/**
 * Lazy registry entry -> memoised loader of the concrete component behind it.
 * Backs {@link loadPropertyForm}; a WeakMap so entries can never leak.
 */
const FORM_LOADERS = new WeakMap<object, PropertyFormLoader>();

/**
 * Wraps a property form module import as a code-split `React.lazy` component.
 *
 * The loader promise is memoised so that an explicit {@link loadPropertyForm} preload and
 * the subsequent Suspense render share a single in-flight import. A rejected import is
 * dropped from the memo so `loadPropertyForm` callers can retry; note that `React.lazy`
 * itself caches the first outcome for the lifetime of the wrapper.
 *
 * @param load Dynamic import resolving to the concrete form component.
 * @returns Lazy component suitable as a registry value.
 */
function lazyForm(load: PropertyFormLoader): React.LazyExoticComponent<PropertyFormComponent> {
  let pending: Promise<PropertyFormComponent> | undefined;
  const loadOnce: PropertyFormLoader = () => {
    if (!pending) {
      pending = load().catch((error: unknown) => {
        pending = undefined;
        throw error;
      });
    }
    return pending;
  };
  const Lazy = React.lazy(() => loadOnce().then((Component) => ({ default: Component })));
  FORM_LOADERS.set(Lazy, loadOnce);
  return Lazy;
}

/**
 * Resolves the concrete component behind a registry entry, triggering its chunk download
 * if necessary. Eager (non-lazy) components resolve to themselves.
 *
 * Use this to warm a panel's chunk ahead of time, or in tests that need to assert on the
 * real component rather than its lazy wrapper.
 *
 * @param entry A value from {@link PROPERTY_FORM_REGISTRY}.
 * @returns Promise of the concrete property form component.
 */
export function loadPropertyForm(entry: PropertyFormComponent): Promise<PropertyFormComponent> {
  const loader = FORM_LOADERS.get(entry);
  return loader ? loader() : Promise.resolve(entry);
}

// ---------------------------------------------------------------------------
// Lazily-loaded panel components (one dynamic import per source module).
// Keep each declaration on a single line so the module path stays greppable.
// ---------------------------------------------------------------------------
const PubSubProperties = lazyForm(() => import('../properties/source/PubSubIO').then((m) => m.PubSubProperties));
const BigQuerySourceProperties = lazyForm(() => import('../properties/source/BigQueryIO').then((m) => m.BigQuerySourceProperties));
const CreateProperties = lazyForm(() => import('../properties/source/CreateIO').then((m) => m.CreateProperties));
const GenerateSequenceProperties = lazyForm(() => import('../properties/source/GenerateSequence').then((m) => m.GenerateSequenceProperties));
const PeriodicImpulseProperties = lazyForm(() => import('../properties/source/PeriodicImpulse').then((m) => m.PeriodicImpulseProperties));
const BigQuerySinkProperties = lazyForm(() => import('../properties/sink/BigQueryIO').then((m) => m.BigQuerySinkProperties));
const PubSubSinkProperties = lazyForm(() => import('../properties/sink/PubSubIO').then((m) => m.PubSubSinkProperties));
const WindowingProperties = lazyForm(() => import('../properties/step/Windowing').then((m) => m.WindowingProperties));
const ParseMessageProperties = lazyForm(() => import('../properties/step/ParseMessage').then((m) => m.ParseMessageProperties));
const LogMessageProperties = lazyForm(() => import('../properties/sink/LogMessage').then((m) => m.LogMessageProperties));
const KVMapperProperties = lazyForm(() => import('../properties/step/KVMapper').then((m) => m.KVMapperProperties));
const FilterProperties = lazyForm(() => import('../properties/step/Filter').then((m) => m.FilterProperties));
const FlatMapProperties = lazyForm(() => import('../properties/step/FlatMap').then((m) => m.FlatMapProperties));
const MapProperties = lazyForm(() => import('../properties/step/Map').then((m) => m.MapProperties));
const AggregationProperties = lazyForm(() => import('../properties/step/Aggregations').then((m) => m.AggregationProperties));
const WithTimestampsProperties = lazyForm(() => import('../properties/step/WithTimestamps').then((m) => m.WithTimestampsProperties));
const ParDoProperties = lazyForm(() => import('../properties/step/ParDo').then((m) => m.ParDoProperties));
const OtherProperties = lazyForm(() => import('../properties/step/Other').then((m) => m.OtherProperties));
const TextIOSourceProperties = lazyForm(() => import('../properties/source/TextIO').then((m) => m.TextIOSourceProperties));
const TextIOSinkProperties = lazyForm(() => import('../properties/sink/TextIO').then((m) => m.TextIOSinkProperties));
const FileIOSourceProperties = lazyForm(() => import('../properties/source/FileIO').then((m) => m.FileIOSourceProperties));
const FileIOReadMatchesProperties = lazyForm(() => import('../properties/source/FileIO').then((m) => m.FileIOReadMatchesProperties));
const FileIOSinkProperties = lazyForm(() => import('../properties/sink/FileIO').then((m) => m.FileIOSinkProperties));
const JdbcIOSourceProperties = lazyForm(() => import('../properties/source/JdbcIO').then((m) => m.JdbcIOSourceProperties));
const JdbcIOSinkProperties = lazyForm(() => import('../properties/sink/JdbcIO').then((m) => m.JdbcIOSinkProperties));
const KafkaIOSourceProperties = lazyForm(() => import('../properties/source/KafkaIO').then((m) => m.KafkaIOSourceProperties));
const KafkaIOSinkProperties = lazyForm(() => import('../properties/sink/KafkaIO').then((m) => m.KafkaIOSinkProperties));
const KinesisIOSourceProperties = lazyForm(() => import('../properties/source/KinesisIO').then((m) => m.KinesisIOSourceProperties));
const KinesisIOSinkProperties = lazyForm(() => import('../properties/sink/KinesisIO').then((m) => m.KinesisIOSinkProperties));
const ParquetIOSourceProperties = lazyForm(() => import('../properties/source/ParquetIO').then((m) => m.ParquetIOSourceProperties));
const ParquetIOSinkProperties = lazyForm(() => import('../properties/sink/ParquetIO').then((m) => m.ParquetIOSinkProperties));
const AvroIOSourceProperties = lazyForm(() => import('../properties/source/AvroIO').then((m) => m.AvroIOSourceProperties));
const AvroIOSinkProperties = lazyForm(() => import('../properties/sink/AvroIO').then((m) => m.AvroIOSinkProperties));
const SnsIOSourceProperties = lazyForm(() => import('../properties/source/SnsIO').then((m) => m.SnsIOSourceProperties));
const SnsIOSinkProperties = lazyForm(() => import('../properties/sink/SnsIO').then((m) => m.SnsIOSinkProperties));
const JmsIOSourceProperties = lazyForm(() => import('../properties/source/JmsIO').then((m) => m.JmsIOSourceProperties));
const JmsIOSinkProperties = lazyForm(() => import('../properties/sink/JmsIO').then((m) => m.JmsIOSinkProperties));
const SqsIOSourceProperties = lazyForm(() => import('../properties/source/SqsIO').then((m) => m.SqsIOSourceProperties));
const SqsIOSinkProperties = lazyForm(() => import('../properties/sink/SqsIO').then((m) => m.SqsIOSinkProperties));
const MqttIOSourceProperties = lazyForm(() => import('../properties/source/MqttIO').then((m) => m.MqttIOSourceProperties));
const MqttIOSinkProperties = lazyForm(() => import('../properties/sink/MqttIO').then((m) => m.MqttIOSinkProperties));
const CassandraIOSourceProperties = lazyForm(() => import('../properties/source/CassandraIO').then((m) => m.CassandraIOSourceProperties));
const CassandraIOSinkProperties = lazyForm(() => import('../properties/sink/CassandraIO').then((m) => m.CassandraIOSinkProperties));
const HBaseIOSourceProperties = lazyForm(() => import('../properties/source/HBaseIO').then((m) => m.HBaseIOSourceProperties));
const HBaseIOSinkProperties = lazyForm(() => import('../properties/sink/HBaseIO').then((m) => m.HBaseIOSinkProperties));
const KuduIOSourceProperties = lazyForm(() => import('../properties/source/KuduIO').then((m) => m.KuduIOSourceProperties));
const KuduIOSinkProperties = lazyForm(() => import('../properties/sink/KuduIO').then((m) => m.KuduIOSinkProperties));
const MongoDbIOSourceProperties = lazyForm(() => import('../properties/source/MongoDbIO').then((m) => m.MongoDbIOSourceProperties));
const MongoDbIOSinkProperties = lazyForm(() => import('../properties/sink/MongoDbIO').then((m) => m.MongoDbIOSinkProperties));
const RedisIOSourceProperties = lazyForm(() => import('../properties/source/RedisIO').then((m) => m.RedisIOSourceProperties));
const RedisIOSinkProperties = lazyForm(() => import('../properties/sink/RedisIO').then((m) => m.RedisIOSinkProperties));
const BigTableIOSourceProperties = lazyForm(() => import('../properties/source/BigTableIO').then((m) => m.BigTableIOSourceProperties));
const BigTableIOSinkProperties = lazyForm(() => import('../properties/sink/BigTableIO').then((m) => m.BigTableIOSinkProperties));
const ClickHouseIOSourceProperties = lazyForm(() => import('../properties/source/ClickHouseIO').then((m) => m.ClickHouseIOSourceProperties));
const ClickHouseIOSinkProperties = lazyForm(() => import('../properties/sink/ClickHouseIO').then((m) => m.ClickHouseIOSinkProperties));
const DatabaseIOSourceProperties = lazyForm(() => import('../properties/source/DatabaseIO').then((m) => m.DatabaseIOSourceProperties));
const DatabaseIOSinkProperties = lazyForm(() => import('../properties/sink/DatabaseIO').then((m) => m.DatabaseIOSinkProperties));
const DatastoreIOSourceProperties = lazyForm(() => import('../properties/source/DatastoreIO').then((m) => m.DatastoreIOSourceProperties));
const DatastoreIOSinkProperties = lazyForm(() => import('../properties/sink/DatastoreIO').then((m) => m.DatastoreIOSinkProperties));
const DynamoDBIOSourceProperties = lazyForm(() => import('../properties/source/DynamoDBIO').then((m) => m.DynamoDBIOSourceProperties));
const DynamoDBIOSinkProperties = lazyForm(() => import('../properties/sink/DynamoDBIO').then((m) => m.DynamoDBIOSinkProperties));
const ElasticsearchIOSourceProperties = lazyForm(() => import('../properties/source/ElasticsearchIO').then((m) => m.ElasticsearchIOSourceProperties));
const ElasticsearchIOSinkProperties = lazyForm(() => import('../properties/sink/ElasticsearchIO').then((m) => m.ElasticsearchIOSinkProperties));
const FirestoreIOSourceProperties = lazyForm(() => import('../properties/source/FirestoreIO').then((m) => m.FirestoreIOSourceProperties));
const FirestoreIOSinkProperties = lazyForm(() => import('../properties/sink/FirestoreIO').then((m) => m.FirestoreIOSinkProperties));
const HadoopFormatIOSourceProperties = lazyForm(() => import('../properties/source/HadoopFormatIO').then((m) => m.HadoopFormatIOSourceProperties));
const HadoopFormatIOSinkProperties = lazyForm(() => import('../properties/sink/HadoopFormatIO').then((m) => m.HadoopFormatIOSinkProperties));
const InfluxDbIOSourceProperties = lazyForm(() => import('../properties/source/InfluxDbIO').then((m) => m.InfluxDbIOSourceProperties));
const InfluxDbIOSinkProperties = lazyForm(() => import('../properties/sink/InfluxDbIO').then((m) => m.InfluxDbIOSinkProperties));
const MongoDbGridFSIOSourceProperties = lazyForm(() => import('../properties/source/MongoDbGridFSIO').then((m) => m.MongoDbGridFSIOSourceProperties));
const MongoDbGridFSIOSinkProperties = lazyForm(() => import('../properties/sink/MongoDbGridFSIO').then((m) => m.MongoDbGridFSIOSinkProperties));
const Neo4jIOSourceProperties = lazyForm(() => import('../properties/source/Neo4jIO').then((m) => m.Neo4jIOSourceProperties));
const Neo4jIOSinkProperties = lazyForm(() => import('../properties/sink/Neo4jIO').then((m) => m.Neo4jIOSinkProperties));
const SingleStoreDBIOSourceProperties = lazyForm(() => import('../properties/source/SingleStoreDBIO').then((m) => m.SingleStoreDBIOSourceProperties));
const SingleStoreDBIOSinkProperties = lazyForm(() => import('../properties/sink/SingleStoreDBIO').then((m) => m.SingleStoreDBIOSinkProperties));
const SnowflakeIOSourceProperties = lazyForm(() => import('../properties/source/SnowflakeIO').then((m) => m.SnowflakeIOSourceProperties));
const SnowflakeIOSinkProperties = lazyForm(() => import('../properties/sink/SnowflakeIO').then((m) => m.SnowflakeIOSinkProperties));
const SolrIOSourceProperties = lazyForm(() => import('../properties/source/SolrIO').then((m) => m.SolrIOSourceProperties));
const SolrIOSinkProperties = lazyForm(() => import('../properties/sink/SolrIO').then((m) => m.SolrIOSinkProperties));
const SpannerIOSourceProperties = lazyForm(() => import('../properties/source/SpannerIO').then((m) => m.SpannerIOSourceProperties));
const SpannerIOSinkProperties = lazyForm(() => import('../properties/sink/SpannerIO').then((m) => m.SpannerIOSinkProperties));
const CdapIOSourceProperties = lazyForm(() => import('../properties/source/CdapIO').then((m) => m.CdapIOSourceProperties));
const CdapIOSinkProperties = lazyForm(() => import('../properties/sink/CdapIO').then((m) => m.CdapIOSinkProperties));
const CosmosIOSourceProperties = lazyForm(() => import('../properties/source/CosmosIO').then((m) => m.CosmosIOSourceProperties));
const DebeziumIOSourceProperties = lazyForm(() => import('../properties/source/DebeziumIO').then((m) => m.DebeziumIOSourceProperties));
const HCatalogIOSourceProperties = lazyForm(() => import('../properties/source/HCatalogIO').then((m) => m.HCatalogIOSourceProperties));
const HCatalogIOSinkProperties = lazyForm(() => import('../properties/sink/HCatalogIO').then((m) => m.HCatalogIOSinkProperties));
const ArrowFlightIOSourceProperties = lazyForm(() => import('../properties/source/ArrowFlightIO').then((m) => m.ArrowFlightIOSourceProperties));
const ArrowFlightIOSinkProperties = lazyForm(() => import('../properties/sink/ArrowFlightIO').then((m) => m.ArrowFlightIOSinkProperties));
const SparkReceiverIOSourceProperties = lazyForm(() => import('../properties/source/SparkReceiverIO').then((m) => m.SparkReceiverIOSourceProperties));
const FhirIOSourceProperties = lazyForm(() => import('../properties/source/FhirIO').then((m) => m.FhirIOSourceProperties));
const FhirIOSinkProperties = lazyForm(() => import('../properties/sink/FhirIO').then((m) => m.FhirIOSinkProperties));
const HL7v2IOSourceProperties = lazyForm(() => import('../properties/source/HL7v2IO').then((m) => m.HL7v2IOSourceProperties));
const HL7v2IOSinkProperties = lazyForm(() => import('../properties/sink/HL7v2IO').then((m) => m.HL7v2IOSinkProperties));
const DicomIOSourceProperties = lazyForm(() => import('../properties/source/DicomIO').then((m) => m.DicomIOSourceProperties));
const DicomIOSinkProperties = lazyForm(() => import('../properties/sink/DicomIO').then((m) => m.DicomIOSinkProperties));
const SplunkIOSinkProperties = lazyForm(() => import('../properties/sink/SplunkIO').then((m) => m.SplunkIOSinkProperties));
const GoogleAdsIOSourceProperties = lazyForm(() => import('../properties/source/GoogleAdsIO').then((m) => m.GoogleAdsIOSourceProperties));
const RequestResponseIOSourceProperties = lazyForm(() => import('../properties/source/RequestResponseIO').then((m) => m.RequestResponseIOSourceProperties));
const RequestResponseIOSinkProperties = lazyForm(() => import('../properties/sink/RequestResponseIO').then((m) => m.RequestResponseIOSinkProperties));
const DatadogIOSinkProperties = lazyForm(() => import('../properties/sink/DatadogIO').then((m) => m.DatadogIOSinkProperties));
const AmqpIOSourceProperties = lazyForm(() => import('../properties/source/AmqpIO').then((m) => m.AmqpIOSourceProperties));
const AmqpIOSinkProperties = lazyForm(() => import('../properties/sink/AmqpIO').then((m) => m.AmqpIOSinkProperties));
const RabbitMqIOSourceProperties = lazyForm(() => import('../properties/source/RabbitMqIO').then((m) => m.RabbitMqIOSourceProperties));
const RabbitMqIOSinkProperties = lazyForm(() => import('../properties/sink/RabbitMqIO').then((m) => m.RabbitMqIOSinkProperties));
const PulsarIOSourceProperties = lazyForm(() => import('../properties/source/PulsarIO').then((m) => m.PulsarIOSourceProperties));
const PulsarIOSinkProperties = lazyForm(() => import('../properties/sink/PulsarIO').then((m) => m.PulsarIOSinkProperties));
const SolaceIOSourceProperties = lazyForm(() => import('../properties/source/SolaceIO').then((m) => m.SolaceIOSourceProperties));
const SolaceIOSinkProperties = lazyForm(() => import('../properties/sink/SolaceIO').then((m) => m.SolaceIOSinkProperties));
const FlinkStreamingImpulseSourceProperties = lazyForm(() => import('../properties/source/FlinkStreamingImpulseSource').then((m) => m.FlinkStreamingImpulseSourceProperties));
const TFRecordIOSourceProperties = lazyForm(() => import('../properties/source/TFRecordIO').then((m) => m.TFRecordIOSourceProperties));
const TFRecordIOSinkProperties = lazyForm(() => import('../properties/sink/TFRecordIO').then((m) => m.TFRecordIOSinkProperties));
const CsvIOSourceProperties = lazyForm(() => import('../properties/source/CsvIO').then((m) => m.CsvIOSourceProperties));
const CsvIOSinkProperties = lazyForm(() => import('../properties/sink/CsvIO').then((m) => m.CsvIOSinkProperties));
const XmlIOSourceProperties = lazyForm(() => import('../properties/source/XmlIO').then((m) => m.XmlIOSourceProperties));
const XmlIOSinkProperties = lazyForm(() => import('../properties/sink/XmlIO').then((m) => m.XmlIOSinkProperties));
const JsonIOSourceProperties = lazyForm(() => import('../properties/source/JsonIO').then((m) => m.JsonIOSourceProperties));
const JsonIOSinkProperties = lazyForm(() => import('../properties/sink/JsonIO').then((m) => m.JsonIOSinkProperties));
const ContextualTextIOSourceProperties = lazyForm(() => import('../properties/source/ContextualTextIO').then((m) => m.ContextualTextIOSourceProperties));
const ContextualTextIOSinkProperties = lazyForm(() => import('../properties/sink/ContextualTextIO').then((m) => m.ContextualTextIOSinkProperties));
const ThriftIOSourceProperties = lazyForm(() => import('../properties/source/ThriftIO').then((m) => m.ThriftIOSourceProperties));
const ThriftIOSinkProperties = lazyForm(() => import('../properties/sink/ThriftIO').then((m) => m.ThriftIOSinkProperties));
const HadoopFileSystemSourceProperties = lazyForm(() => import('../properties/source/HadoopFileSystem').then((m) => m.HadoopFileSystemSourceProperties));
const HadoopFileSystemSinkProperties = lazyForm(() => import('../properties/sink/HadoopFileSystem').then((m) => m.HadoopFileSystemSinkProperties));
const GcsFileSystemSourceProperties = lazyForm(() => import('../properties/source/GcsFileSystem').then((m) => m.GcsFileSystemSourceProperties));
const GcsFileSystemSinkProperties = lazyForm(() => import('../properties/sink/GcsFileSystem').then((m) => m.GcsFileSystemSinkProperties));
const LocalFileSystemSourceProperties = lazyForm(() => import('../properties/source/LocalFileSystem').then((m) => m.LocalFileSystemSourceProperties));
const LocalFileSystemSinkProperties = lazyForm(() => import('../properties/sink/LocalFileSystem').then((m) => m.LocalFileSystemSinkProperties));
const S3FileSystemSourceProperties = lazyForm(() => import('../properties/source/S3FileSystem').then((m) => m.S3FileSystemSourceProperties));
const S3FileSystemSinkProperties = lazyForm(() => import('../properties/sink/S3FileSystem').then((m) => m.S3FileSystemSinkProperties));
const AzureBlobStoreFileSystemSourceProperties = lazyForm(() => import('../properties/source/AzureBlobStoreFileSystem').then((m) => m.AzureBlobStoreFileSystemSourceProperties));
const AzureBlobStoreFileSystemSinkProperties = lazyForm(() => import('../properties/sink/AzureBlobStoreFileSystem').then((m) => m.AzureBlobStoreFileSystemSinkProperties));
const IcebergIOSourceProperties = lazyForm(() => import('../properties/source/IcebergIO').then((m) => m.IcebergIOSourceProperties));
const IcebergIOSinkProperties = lazyForm(() => import('../properties/sink/IcebergIO').then((m) => m.IcebergIOSinkProperties));
const TikaIOSourceProperties = lazyForm(() => import('../properties/source/TikaIO').then((m) => m.TikaIOSourceProperties));
const TikaIOSinkProperties = lazyForm(() => import('../properties/sink/TikaIO').then((m) => m.TikaIOSinkProperties));
const CloudBigtableSourceProperties = lazyForm(() => import('../properties/source/CloudBigtable').then((m) => m.CloudBigtableSourceProperties));
const CloudBigtableSinkProperties = lazyForm(() => import('../properties/sink/CloudBigtable').then((m) => m.CloudBigtableSinkProperties));
const CogniteDataFusionSourceProperties = lazyForm(() => import('../properties/source/CogniteDataFusion').then((m) => m.CogniteDataFusionSourceProperties));
const CogniteDataFusionSinkProperties = lazyForm(() => import('../properties/sink/CogniteDataFusion').then((m) => m.CogniteDataFusionSinkProperties));
const KineticaDBSourceProperties = lazyForm(() => import('../properties/source/KineticaDB').then((m) => m.KineticaDBSourceProperties));
const KineticaDBSinkProperties = lazyForm(() => import('../properties/sink/KineticaDB').then((m) => m.KineticaDBSinkProperties));
const TrepWsIOSourceProperties = lazyForm(() => import('../properties/source/TrepWsIO').then((m) => m.TrepWsIOSourceProperties));
const TrepWsIOSinkProperties = lazyForm(() => import('../properties/sink/TrepWsIO').then((m) => m.TrepWsIOSinkProperties));
const CloudSQLSourceProperties = lazyForm(() => import('../properties/source/CloudSQL').then((m) => m.CloudSQLSourceProperties));
const CloudSQLSinkProperties = lazyForm(() => import('../properties/sink/CloudSQL').then((m) => m.CloudSQLSinkProperties));
const MySQLSourceProperties = lazyForm(() => import('../properties/source/MySQL').then((m) => m.MySQLSourceProperties));
const MySQLSinkProperties = lazyForm(() => import('../properties/sink/MySQL').then((m) => m.MySQLSinkProperties));
const PyodbcSourceProperties = lazyForm(() => import('../properties/source/Pyodbc').then((m) => m.PyodbcSourceProperties));
const PyodbcSinkProperties = lazyForm(() => import('../properties/sink/Pyodbc').then((m) => m.PyodbcSinkProperties));
const TinybirdSourceProperties = lazyForm(() => import('../properties/source/Tinybird').then((m) => m.TinybirdSourceProperties));
const TinybirdSinkProperties = lazyForm(() => import('../properties/sink/Tinybird').then((m) => m.TinybirdSinkProperties));
const MySQLPostgreSQLOracleSQLServerSourceProperties = lazyForm(() => import('../properties/source/MySQLPostgreSQLOracleSQLServer').then((m) => m.MySQLPostgreSQLOracleSQLServerSourceProperties));
const MySQLPostgreSQLOracleSQLServerSinkProperties = lazyForm(() => import('../properties/sink/MySQLPostgreSQLOracleSQLServer').then((m) => m.MySQLPostgreSQLOracleSQLServerSinkProperties));


/**
 * Map of immutable metadata keys (`${type}:${beamTransform}` or direct transform name)
 * to their respective property form components.
 *
 * Each entry maps a node key to its dedicated panel component.
 *
 * NOTE: Keys are matched against immutable metadata (beam_transform / componentType),
 * NEVER against user-editable node labels.
 */
export const PROPERTY_FORM_REGISTRY: Record<string, PropertyFormComponent> = {
  // Source IOs (qualified by SOURCE:)
  'SOURCE:PubSubIO': PubSubProperties,
  'SOURCE:PubSub': PubSubProperties,
  'SOURCE:BigQueryIO': BigQuerySourceProperties,
  'SOURCE:BigQuery': BigQuerySourceProperties,
  'SOURCE:TextIO': TextIOSourceProperties,
  'SOURCE:FileIO': FileIOSourceProperties,
  'SOURCE:FileIO.match': FileIOSourceProperties,
  'SOURCE:JdbcIO': JdbcIOSourceProperties,
  'SOURCE:KafkaIO': KafkaIOSourceProperties,
  'SOURCE:KinesisIO': KinesisIOSourceProperties,
  'SOURCE:ParquetIO': ParquetIOSourceProperties,
  'SOURCE:AvroIO': AvroIOSourceProperties,
  'SOURCE:TFRecordIO': TFRecordIOSourceProperties,
  'SOURCE:CsvIO': CsvIOSourceProperties,
  'SOURCE:XmlIO': XmlIOSourceProperties,
  'SOURCE:JsonIO': JsonIOSourceProperties,
  'SOURCE:ContextualTextIO': ContextualTextIOSourceProperties,
  'SOURCE:ThriftIO': ThriftIOSourceProperties,
  'SOURCE:HadoopFileSystem': HadoopFileSystemSourceProperties,
  'SOURCE:GcsFileSystem': GcsFileSystemSourceProperties,
  'SOURCE:LocalFileSystem': LocalFileSystemSourceProperties,
  'SOURCE:S3FileSystem': S3FileSystemSourceProperties,
  'SOURCE:AzureBlobStoreFileSystem': AzureBlobStoreFileSystemSourceProperties,
  'SOURCE:IcebergIO': IcebergIOSourceProperties,
  'SOURCE:TikaIO': TikaIOSourceProperties,
  'SOURCE:SnsIO': SnsIOSourceProperties,
  'SOURCE:JmsIO': JmsIOSourceProperties,
  'SOURCE:SqsIO': SqsIOSourceProperties,
  'SOURCE:MqttIO': MqttIOSourceProperties,
  'SOURCE:CassandraIO': CassandraIOSourceProperties,
  'SOURCE:HBaseIO': HBaseIOSourceProperties,
  'SOURCE:KuduIO': KuduIOSourceProperties,
  'SOURCE:MongoDbIO': MongoDbIOSourceProperties,
  'SOURCE:RedisIO': RedisIOSourceProperties,
  'SOURCE:BigTableIO': BigTableIOSourceProperties,
  'SOURCE:BigtableIO': BigTableIOSourceProperties,
  'SOURCE:ClickHouseIO': ClickHouseIOSourceProperties,
  'SOURCE:DatabaseIO': DatabaseIOSourceProperties,
  'SOURCE:DatastoreIO': DatastoreIOSourceProperties,
  'SOURCE:DynamoDBIO': DynamoDBIOSourceProperties,
  'SOURCE:ElasticsearchIO': ElasticsearchIOSourceProperties,
  'SOURCE:FirestoreIO': FirestoreIOSourceProperties,
  'SOURCE:HadoopFormatIO': HadoopFormatIOSourceProperties,
  'SOURCE:InfluxDbIO': InfluxDbIOSourceProperties,
  'SOURCE:MongoDbGridFSIO': MongoDbGridFSIOSourceProperties,
  'SOURCE:Neo4jIO': Neo4jIOSourceProperties,
  'SOURCE:SingleStoreDBIO': SingleStoreDBIOSourceProperties,
  'SOURCE:SingleStoreIO': SingleStoreDBIOSourceProperties,
  'SOURCE:SnowflakeIO': SnowflakeIOSourceProperties,
  'SOURCE:SolrIO': SolrIOSourceProperties,
  'SOURCE:SpannerIO': SpannerIOSourceProperties,
  'SOURCE:CdapIO': CdapIOSourceProperties,
  'SOURCE:CosmosIO': CosmosIOSourceProperties,
  'SOURCE:DebeziumIO': DebeziumIOSourceProperties,
  'SOURCE:HCatalogIO': HCatalogIOSourceProperties,
  'SOURCE:ArrowFlightIO': ArrowFlightIOSourceProperties,
  'SOURCE:SparkReceiverIO': SparkReceiverIOSourceProperties,
  'SOURCE:FhirIO': FhirIOSourceProperties,
  'SOURCE:HL7v2IO': HL7v2IOSourceProperties,
  'SOURCE:DicomIO': DicomIOSourceProperties,
  'SOURCE:GoogleAdsIO': GoogleAdsIOSourceProperties,
  'SOURCE:RequestResponseIO': RequestResponseIOSourceProperties,
  'SOURCE:WebAPIs': RequestResponseIOSourceProperties,
  'SOURCE:Web APIs (RequestResponseIO)': RequestResponseIOSourceProperties,
  'SOURCE:AmqpIO': AmqpIOSourceProperties,
  'SOURCE:RabbitMqIO': RabbitMqIOSourceProperties,
  'SOURCE:PulsarIO': PulsarIOSourceProperties,
  'SOURCE:SolaceIO': SolaceIOSourceProperties,
  'SOURCE:FlinkStreamingImpulseSource': FlinkStreamingImpulseSourceProperties,
  'SOURCE:GenerateSequence': GenerateSequenceProperties,
  'SOURCE:PeriodicImpulse': PeriodicImpulseProperties,
  'SOURCE:Create': CreateProperties,
  'SOURCE:CloudBigtable': CloudBigtableSourceProperties,
  'SOURCE:CogniteDataFusion': CogniteDataFusionSourceProperties,
  'SOURCE:KineticaDB': KineticaDBSourceProperties,
  'SOURCE:TrepWsIO': TrepWsIOSourceProperties,
  'SOURCE:CloudSQL': CloudSQLSourceProperties,
  'SOURCE:MySQL': MySQLSourceProperties,
  'SOURCE:Pyodbc': PyodbcSourceProperties,
  'SOURCE:Tinybird': TinybirdSourceProperties,
  'SOURCE:MySQLPostgreSQLOracleSQLServer': MySQLPostgreSQLOracleSQLServerSourceProperties,

  // Direct Source transforms (Python Beam transforms / unique names)
  'ReadFromAvro': AvroIOSourceProperties,
  'ReadFromKafka': KafkaIOSourceProperties,
  'ReadFromJms': JmsIOSourceProperties,
  'ReadDataFromKinesis': KinesisIOSourceProperties,
  'ReadFromParquet': ParquetIOSourceProperties,
  'ReadFromTFRecord': TFRecordIOSourceProperties,
  'ReadFromCsv': CsvIOSourceProperties,
  'ReadFromJson': JsonIOSourceProperties,
  'ReadFromSqs': SqsIOSourceProperties,
  'ReadFromMqtt': MqttIOSourceProperties,
  'DicomSearch': DicomIOSourceProperties,
  'GoogleAdsIO': GoogleAdsIOSourceProperties,
  'FileIO.match': FileIOSourceProperties,
  'GenerateSequence': GenerateSequenceProperties,
  'PeriodicImpulse': PeriodicImpulseProperties,
  'Create': CreateProperties,

  // Sink IOs (qualified by SINK:)
  'SINK:PubSubIO': PubSubSinkProperties,
  'SINK:PubSub': PubSubSinkProperties,
  'SINK:BigQueryIO': BigQuerySinkProperties,
  'SINK:BigQuery': BigQuerySinkProperties,
  'SINK:TextIO': TextIOSinkProperties,
  'SINK:FileIO': FileIOSinkProperties,
  'SINK:JdbcIO': JdbcIOSinkProperties,
  'SINK:KafkaIO': KafkaIOSinkProperties,
  'SINK:KinesisIO': KinesisIOSinkProperties,
  'SINK:ParquetIO': ParquetIOSinkProperties,
  'SINK:AvroIO': AvroIOSinkProperties,
  'SINK:TFRecordIO': TFRecordIOSinkProperties,
  'SINK:CsvIO': CsvIOSinkProperties,
  'SINK:XmlIO': XmlIOSinkProperties,
  'SINK:JsonIO': JsonIOSinkProperties,
  'SINK:ContextualTextIO': ContextualTextIOSinkProperties,
  'SINK:ThriftIO': ThriftIOSinkProperties,
  'SINK:HadoopFileSystem': HadoopFileSystemSinkProperties,
  'SINK:GcsFileSystem': GcsFileSystemSinkProperties,
  'SINK:LocalFileSystem': LocalFileSystemSinkProperties,
  'SINK:S3FileSystem': S3FileSystemSinkProperties,
  'SINK:AzureBlobStoreFileSystem': AzureBlobStoreFileSystemSinkProperties,
  'SINK:IcebergIO': IcebergIOSinkProperties,
  'SINK:TikaIO': TikaIOSinkProperties,
  'SINK:SnsIO': SnsIOSinkProperties,
  'SINK:JmsIO': JmsIOSinkProperties,
  'SINK:SqsIO': SqsIOSinkProperties,
  'SINK:MqttIO': MqttIOSinkProperties,
  'SINK:CassandraIO': CassandraIOSinkProperties,
  'SINK:HBaseIO': HBaseIOSinkProperties,
  'SINK:KuduIO': KuduIOSinkProperties,
  'SINK:MongoDbIO': MongoDbIOSinkProperties,
  'SINK:RedisIO': RedisIOSinkProperties,
  'SINK:BigTableIO': BigTableIOSinkProperties,
  'SINK:BigtableIO': BigTableIOSinkProperties,
  'SINK:ClickHouseIO': ClickHouseIOSinkProperties,
  'SINK:DatabaseIO': DatabaseIOSinkProperties,
  'SINK:DatastoreIO': DatastoreIOSinkProperties,
  'SINK:DynamoDBIO': DynamoDBIOSinkProperties,
  'SINK:ElasticsearchIO': ElasticsearchIOSinkProperties,
  'SINK:FirestoreIO': FirestoreIOSinkProperties,
  'SINK:HadoopFormatIO': HadoopFormatIOSinkProperties,
  'SINK:InfluxDbIO': InfluxDbIOSinkProperties,
  'SINK:MongoDbGridFSIO': MongoDbGridFSIOSinkProperties,
  'SINK:Neo4jIO': Neo4jIOSinkProperties,
  'SINK:SingleStoreDBIO': SingleStoreDBIOSinkProperties,
  'SINK:SingleStoreIO': SingleStoreDBIOSinkProperties,
  'SINK:SnowflakeIO': SnowflakeIOSinkProperties,
  'SINK:SolrIO': SolrIOSinkProperties,
  'SINK:SpannerIO': SpannerIOSinkProperties,
  'SINK:CdapIO': CdapIOSinkProperties,
  'SINK:HCatalogIO': HCatalogIOSinkProperties,
  'SINK:ArrowFlightIO': ArrowFlightIOSinkProperties,
  'SINK:FhirIO': FhirIOSinkProperties,
  'SINK:HL7v2IO': HL7v2IOSinkProperties,
  'SINK:DicomIO': DicomIOSinkProperties,
  'SINK:SplunkIO': SplunkIOSinkProperties,
  'SINK:RequestResponseIO': RequestResponseIOSinkProperties,
  'SINK:WebAPIs': RequestResponseIOSinkProperties,
  'SINK:Web APIs (RequestResponseIO)': RequestResponseIOSinkProperties,
  'SINK:DatadogIO': DatadogIOSinkProperties,
  'SINK:DatadogWrite': DatadogIOSinkProperties,
  'SINK:AmqpIO': AmqpIOSinkProperties,
  'SINK:RabbitMqIO': RabbitMqIOSinkProperties,
  'SINK:PulsarIO': PulsarIOSinkProperties,
  'SINK:SolaceIO': SolaceIOSinkProperties,
  'SINK:LogMessage': LogMessageProperties,
  'SINK:CloudBigtable': CloudBigtableSinkProperties,
  'SINK:CogniteDataFusion': CogniteDataFusionSinkProperties,
  'SINK:KineticaDB': KineticaDBSinkProperties,
  'SINK:TrepWsIO': TrepWsIOSinkProperties,
  'SINK:CloudSQL': CloudSQLSinkProperties,
  'SINK:MySQL': MySQLSinkProperties,
  'SINK:Pyodbc': PyodbcSinkProperties,
  'SINK:Tinybird': TinybirdSinkProperties,
  'SINK:MySQLPostgreSQLOracleSQLServer': MySQLPostgreSQLOracleSQLServerSinkProperties,

  // Direct Sink transforms (Python Beam transforms / unique names)
  'WriteToAvro': AvroIOSinkProperties,
  'WriteToKafka': KafkaIOSinkProperties,
  'WriteToJms': JmsIOSinkProperties,
  'WriteToKinesis': KinesisIOSinkProperties,
  'WriteToParquet': ParquetIOSinkProperties,
  'WriteToTFRecord': TFRecordIOSinkProperties,
  'WriteToCsv': CsvIOSinkProperties,
  'WriteToJson': JsonIOSinkProperties,
  'WriteToSqs': SqsIOSinkProperties,
  'WriteToMqtt': MqttIOSinkProperties,
  'UploadToDicomStore': DicomIOSinkProperties,
  'SplunkIO': SplunkIOSinkProperties,
  'DatadogIO': DatadogIOSinkProperties,
  'DatadogWrite': DatadogIOSinkProperties,
  'LogMessage': LogMessageProperties,

  // Steps & Core Transforms (with and without STEP: prefix)
  'STEP:FileIO.readMatches': FileIOReadMatchesProperties,
  'FileIO.readMatches': FileIOReadMatchesProperties,
  'STEP:Window': WindowingProperties,
  'Window': WindowingProperties,
  'STEP:Windowing': WindowingProperties,
  'Windowing': WindowingProperties,
  'STEP:WindowInto': WindowingProperties,
  'WindowInto': WindowingProperties,
  'STEP:ParseMessage': ParseMessageProperties,
  'ParseMessage': ParseMessageProperties,
  'STEP:WithTimestamps': WithTimestampsProperties,
  'WithTimestamps': WithTimestampsProperties,
  'STEP:LogMessage': LogMessageProperties,
  'STEP:KVMapper': KVMapperProperties,
  'KVMapper': KVMapperProperties,
  'STEP:Filter': FilterProperties,
  'Filter': FilterProperties,
  'STEP:FlatMap': FlatMapProperties,
  'FlatMap': FlatMapProperties,
  'STEP:Map': MapProperties,
  'Map': MapProperties,
  'STEP:ParDo': ParDoProperties,
  'ParDo': ParDoProperties,

  // Aggregation transforms
  'STEP:ApproximateQuantiles': AggregationProperties,
  'ApproximateQuantiles': AggregationProperties,
  'Approximate Quantiles': AggregationProperties,
  'Approximate Quantile': AggregationProperties,
  'STEP:ApproximateUnique': AggregationProperties,
  'ApproximateUnique': AggregationProperties,
  'Approximate Unique': AggregationProperties,
  'STEP:CoGroupByKey': AggregationProperties,
  'CoGroupByKey': AggregationProperties,
  'Co Group By Key': AggregationProperties,
  'STEP:Combine': AggregationProperties,
  'Combine': AggregationProperties,
  'STEP:CombineWithContext': AggregationProperties,
  'CombineWithContext': AggregationProperties,
  'Combine With Context': AggregationProperties,
  'STEP:Count': AggregationProperties,
  'Count': AggregationProperties,
  'STEP:Distinct': AggregationProperties,
  'Distinct': AggregationProperties,
  'STEP:GroupByKey': AggregationProperties,
  'GroupByKey': AggregationProperties,
  'Group By Key': AggregationProperties,
  'STEP:GroupIntoBatches': AggregationProperties,
  'GroupIntoBatches': AggregationProperties,
  'Group Into Batches': AggregationProperties,
  'STEP:BatchElements': AggregationProperties,
  'BatchElements': AggregationProperties,
  'Batch Elements': AggregationProperties,
  'STEP:Latest': AggregationProperties,
  'Latest': AggregationProperties,
  'STEP:Max': AggregationProperties,
  'Max': AggregationProperties,
  'STEP:Mean': AggregationProperties,
  'Mean': AggregationProperties,
  'STEP:Min': AggregationProperties,
  'Min': AggregationProperties,
  'STEP:Sample': AggregationProperties,
  'Sample': AggregationProperties,
  'STEP:Sum': AggregationProperties,
  'Sum': AggregationProperties,
  'STEP:Top': AggregationProperties,
  'Top': AggregationProperties,

  // Other Transforms
  'STEP:Flatten': OtherProperties,
  'Flatten': OtherProperties,
  'STEP:Reshuffle': OtherProperties,
  'Reshuffle': OtherProperties,
  'STEP:ReShuffle': OtherProperties,
  'ReShuffle': OtherProperties,
  'STEP:Keys': OtherProperties,
  'Keys': OtherProperties,
  'STEP:KvSwap': OtherProperties,
  'KvSwap': OtherProperties,
  'KV Swap': OtherProperties,
  'STEP:ToString': OtherProperties,
  'ToString': OtherProperties,
  'To String': OtherProperties,
  'STEP:Values': OtherProperties,
  'Values': OtherProperties,
};
