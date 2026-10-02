/** @fileoverview Registry mapping node keys to dedicated property form components.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { PubSubProperties } from '../properties/source/PubSubIO';
import { BigQuerySourceProperties } from '../properties/source/BigQueryIO';
import { CreateProperties } from '../properties/source/CreateIO';
import { GenerateSequenceProperties } from '../properties/source/GenerateSequence';
import { PeriodicImpulseProperties } from '../properties/source/PeriodicImpulse';
import { BigQuerySinkProperties } from '../properties/sink/BigQueryIO';
import { PubSubSinkProperties } from '../properties/sink/PubSubIO';
import { WindowingProperties } from '../properties/step/Windowing';
import { ParseMessageProperties } from '../properties/step/ParseMessage';
import { LogMessageProperties } from '../properties/sink/LogMessage';
import { KVMapperProperties } from '../properties/step/KVMapper';
import { FilterProperties } from '../properties/step/Filter';
import { FlatMapProperties } from '../properties/step/FlatMap';
import { MapProperties } from '../properties/step/Map';
import { AggregationProperties } from '../properties/step/Aggregations';
import { WithTimestampsProperties } from '../properties/step/WithTimestamps';
import { ParDoProperties } from '../properties/step/ParDo';
import { OtherProperties } from '../properties/step/Other';
import { TextIOSourceProperties } from '../properties/source/TextIO';
import { TextIOSinkProperties } from '../properties/sink/TextIO';
import { FileIOSourceProperties, FileIOReadMatchesProperties } from '../properties/source/FileIO';
import { FileIOSinkProperties } from '../properties/sink/FileIO';
import { JdbcIOSourceProperties } from '../properties/source/JdbcIO';
import { JdbcIOSinkProperties } from '../properties/sink/JdbcIO';
import { KafkaIOSourceProperties } from '../properties/source/KafkaIO';
import { KafkaIOSinkProperties } from '../properties/sink/KafkaIO';
import { KinesisIOSourceProperties } from '../properties/source/KinesisIO';
import { KinesisIOSinkProperties } from '../properties/sink/KinesisIO';
import { ParquetIOSourceProperties } from '../properties/source/ParquetIO';
import { ParquetIOSinkProperties } from '../properties/sink/ParquetIO';
import { AvroIOSourceProperties } from '../properties/source/AvroIO';
import { AvroIOSinkProperties } from '../properties/sink/AvroIO';
import { SnsIOSourceProperties } from '../properties/source/SnsIO';
import { SnsIOSinkProperties } from '../properties/sink/SnsIO';
import { JmsIOSourceProperties } from '../properties/source/JmsIO';
import { JmsIOSinkProperties } from '../properties/sink/JmsIO';
import { SqsIOSourceProperties } from '../properties/source/SqsIO';
import { SqsIOSinkProperties } from '../properties/sink/SqsIO';
import { MqttIOSourceProperties } from '../properties/source/MqttIO';
import { MqttIOSinkProperties } from '../properties/sink/MqttIO';
import { CassandraIOSourceProperties } from '../properties/source/CassandraIO';
import { CassandraIOSinkProperties } from '../properties/sink/CassandraIO';
import { HBaseIOSourceProperties } from '../properties/source/HBaseIO';
import { HBaseIOSinkProperties } from '../properties/sink/HBaseIO';
import { KuduIOSourceProperties } from '../properties/source/KuduIO';
import { KuduIOSinkProperties } from '../properties/sink/KuduIO';
import { MongoDbIOSourceProperties } from '../properties/source/MongoDbIO';
import { MongoDbIOSinkProperties } from '../properties/sink/MongoDbIO';
import { RedisIOSourceProperties } from '../properties/source/RedisIO';
import { RedisIOSinkProperties } from '../properties/sink/RedisIO';
import { BigTableIOSourceProperties } from '../properties/source/BigTableIO';
import { BigTableIOSinkProperties } from '../properties/sink/BigTableIO';
import { ClickHouseIOSourceProperties } from '../properties/source/ClickHouseIO';
import { ClickHouseIOSinkProperties } from '../properties/sink/ClickHouseIO';
import { DatabaseIOSourceProperties } from '../properties/source/DatabaseIO';
import { DatabaseIOSinkProperties } from '../properties/sink/DatabaseIO';
import { DatastoreIOSourceProperties } from '../properties/source/DatastoreIO';
import { DatastoreIOSinkProperties } from '../properties/sink/DatastoreIO';
import { DynamoDBIOSourceProperties } from '../properties/source/DynamoDBIO';
import { DynamoDBIOSinkProperties } from '../properties/sink/DynamoDBIO';
import { ElasticsearchIOSourceProperties } from '../properties/source/ElasticsearchIO';
import { ElasticsearchIOSinkProperties } from '../properties/sink/ElasticsearchIO';
import { FirestoreIOSourceProperties } from '../properties/source/FirestoreIO';
import { FirestoreIOSinkProperties } from '../properties/sink/FirestoreIO';
import { HadoopFormatIOSourceProperties } from '../properties/source/HadoopFormatIO';
import { HadoopFormatIOSinkProperties } from '../properties/sink/HadoopFormatIO';
import { InfluxDbIOSourceProperties } from '../properties/source/InfluxDbIO';
import { InfluxDbIOSinkProperties } from '../properties/sink/InfluxDbIO';
import { MongoDbGridFSIOSourceProperties } from '../properties/source/MongoDbGridFSIO';
import { MongoDbGridFSIOSinkProperties } from '../properties/sink/MongoDbGridFSIO';
import { Neo4jIOSourceProperties } from '../properties/source/Neo4jIO';
import { Neo4jIOSinkProperties } from '../properties/sink/Neo4jIO';
import { SingleStoreDBIOSourceProperties } from '../properties/source/SingleStoreDBIO';
import { SingleStoreDBIOSinkProperties } from '../properties/sink/SingleStoreDBIO';
import { SnowflakeIOSourceProperties } from '../properties/source/SnowflakeIO';
import { SnowflakeIOSinkProperties } from '../properties/sink/SnowflakeIO';
import { SolrIOSourceProperties } from '../properties/source/SolrIO';
import { SolrIOSinkProperties } from '../properties/sink/SolrIO';
import { SpannerIOSourceProperties } from '../properties/source/SpannerIO';
import { SpannerIOSinkProperties } from '../properties/sink/SpannerIO';
import { CdapIOSourceProperties } from '../properties/source/CdapIO';
import { CdapIOSinkProperties } from '../properties/sink/CdapIO';
import { CosmosIOSourceProperties } from '../properties/source/CosmosIO';
import { DebeziumIOSourceProperties } from '../properties/source/DebeziumIO';
import { HCatalogIOSourceProperties } from '../properties/source/HCatalogIO';
import { HCatalogIOSinkProperties } from '../properties/sink/HCatalogIO';
import { ArrowFlightIOSourceProperties } from '../properties/source/ArrowFlightIO';
import { ArrowFlightIOSinkProperties } from '../properties/sink/ArrowFlightIO';
import { SparkReceiverIOSourceProperties } from '../properties/source/SparkReceiverIO';
import { FhirIOSourceProperties } from '../properties/source/FhirIO';
import { FhirIOSinkProperties } from '../properties/sink/FhirIO';
import { HL7v2IOSourceProperties } from '../properties/source/HL7v2IO';
import { HL7v2IOSinkProperties } from '../properties/sink/HL7v2IO';
import { DicomIOSourceProperties } from '../properties/source/DicomIO';
import { DicomIOSinkProperties } from '../properties/sink/DicomIO';
import { SplunkIOSinkProperties } from '../properties/sink/SplunkIO';
import { GoogleAdsIOSourceProperties } from '../properties/source/GoogleAdsIO';
import { RequestResponseIOSourceProperties } from '../properties/source/RequestResponseIO';
import { RequestResponseIOSinkProperties } from '../properties/sink/RequestResponseIO';
import { DatadogIOSinkProperties } from '../properties/sink/DatadogIO';
import { AmqpIOSourceProperties } from '../properties/source/AmqpIO';
import { AmqpIOSinkProperties } from '../properties/sink/AmqpIO';
import { RabbitMqIOSourceProperties } from '../properties/source/RabbitMqIO';
import { RabbitMqIOSinkProperties } from '../properties/sink/RabbitMqIO';
import { PulsarIOSourceProperties } from '../properties/source/PulsarIO';
import { PulsarIOSinkProperties } from '../properties/sink/PulsarIO';
import { SolaceIOSourceProperties } from '../properties/source/SolaceIO';
import { SolaceIOSinkProperties } from '../properties/sink/SolaceIO';
import { FlinkStreamingImpulseSourceProperties } from '../properties/source/FlinkStreamingImpulseSource';
import { TFRecordIOSourceProperties } from '../properties/source/TFRecordIO';
import { TFRecordIOSinkProperties } from '../properties/sink/TFRecordIO';
import { CsvIOSourceProperties } from '../properties/source/CsvIO';
import { CsvIOSinkProperties } from '../properties/sink/CsvIO';
import { XmlIOSourceProperties } from '../properties/source/XmlIO';
import { XmlIOSinkProperties } from '../properties/sink/XmlIO';
import { JsonIOSourceProperties } from '../properties/source/JsonIO';
import { JsonIOSinkProperties } from '../properties/sink/JsonIO';
import { ContextualTextIOSourceProperties } from '../properties/source/ContextualTextIO';
import { ContextualTextIOSinkProperties } from '../properties/sink/ContextualTextIO';
import { ThriftIOSourceProperties } from '../properties/source/ThriftIO';
import { ThriftIOSinkProperties } from '../properties/sink/ThriftIO';
import { HadoopFileSystemSourceProperties } from '../properties/source/HadoopFileSystem';
import { HadoopFileSystemSinkProperties } from '../properties/sink/HadoopFileSystem';
import { GcsFileSystemSourceProperties } from '../properties/source/GcsFileSystem';
import { GcsFileSystemSinkProperties } from '../properties/sink/GcsFileSystem';
import { LocalFileSystemSourceProperties } from '../properties/source/LocalFileSystem';
import { LocalFileSystemSinkProperties } from '../properties/sink/LocalFileSystem';
import { S3FileSystemSourceProperties } from '../properties/source/S3FileSystem';
import { S3FileSystemSinkProperties } from '../properties/sink/S3FileSystem';
import { AzureBlobStoreFileSystemSourceProperties } from '../properties/source/AzureBlobStoreFileSystem';
import { AzureBlobStoreFileSystemSinkProperties } from '../properties/sink/AzureBlobStoreFileSystem';
import { IcebergIOSourceProperties } from '../properties/source/IcebergIO';
import { IcebergIOSinkProperties } from '../properties/sink/IcebergIO';
import { TikaIOSourceProperties } from '../properties/source/TikaIO';
import { TikaIOSinkProperties } from '../properties/sink/TikaIO';
import { CloudBigtableSourceProperties } from '../properties/source/CloudBigtable';
import { CloudBigtableSinkProperties } from '../properties/sink/CloudBigtable';
import { CogniteDataFusionSourceProperties } from '../properties/source/CogniteDataFusion';
import { CogniteDataFusionSinkProperties } from '../properties/sink/CogniteDataFusion';
import { KineticaDBSourceProperties } from '../properties/source/KineticaDB';
import { KineticaDBSinkProperties } from '../properties/sink/KineticaDB';
import { TrepWsIOSourceProperties } from '../properties/source/TrepWsIO';
import { TrepWsIOSinkProperties } from '../properties/sink/TrepWsIO';
import { CloudSQLSourceProperties } from '../properties/source/CloudSQL';
import { CloudSQLSinkProperties } from '../properties/sink/CloudSQL';
import { MySQLSourceProperties } from '../properties/source/MySQL';
import { MySQLSinkProperties } from '../properties/sink/MySQL';
import { PyodbcSourceProperties } from '../properties/source/Pyodbc';
import { PyodbcSinkProperties } from '../properties/sink/Pyodbc';
import { TinybirdSourceProperties } from '../properties/source/Tinybird';
import { TinybirdSinkProperties } from '../properties/sink/Tinybird';
import { MySQLPostgreSQLOracleSQLServerSourceProperties } from '../properties/source/MySQLPostgreSQLOracleSQLServer';
import { MySQLPostgreSQLOracleSQLServerSinkProperties } from '../properties/sink/MySQLPostgreSQLOracleSQLServer';

/**
 * Shared props accepted by dynamic property form components registered in the registry.
 */
export interface PropertyFormProps {
  node: any;
  onChange: (properties: any) => void;
  onAddKVMapper?: (windowNodeId: string) => void;
  onAddPubSubSource?: (targetNodeId: string) => void;
}

/**
 * Map of immutable metadata keys (`${type}:${beamTransform}` or direct transform name)
 * to their respective property form components.
 *
 * Each entry maps a node key to its dedicated panel component.
 *
 * NOTE: Keys are matched against immutable metadata (beam_transform / componentType),
 * NEVER against user-editable node labels.
 */
export const PROPERTY_FORM_REGISTRY: Record<string, React.FC<PropertyFormProps>> = {
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
