/**
 * PropertyForm Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Container component dispatching specific node property sheets based on immutable node metadata
 * (beam_transform and/or componentType, qualified by node type) rather than user-editable labels.
 * 
 * Architectural Decisions:
 * - Uses a declarative PROPERTY_FORM_REGISTRY map for fast, immutable metadata dispatch.
 * - Resolves keys using type-qualified keys (`${type}:${transform}`) and direct transform names.
 * - Fails fast: Displays an explicit "No property form registered for type <type>" message if no registry entry matches.
 * - Never inspects or falls back to user-editable display labels, preventing property sheet corruption on node renaming.
 * - Supports Streaming Sources (PubSub, GenerateSequence, PeriodicImpulse, SnsIO, MqttIO), Streaming Sinks (PubSub, Kafka, SnsIO, MqttIO),
 *   Database, File, Aggregations, and Transform steps.
 */
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

export interface PropertyFormProps {
  node: any;
  onChange: (properties: any) => void;
  onAddKVMapper?: (windowNodeId: string) => void;
}

/**
 * Map of immutable metadata keys (`${type}:${beamTransform}` or direct transform name)
 * to their respective property form components.
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
  'SOURCE:SnsIO': SnsIOSourceProperties,
  'SOURCE:JmsIO': JmsIOSourceProperties,
  'SOURCE:SqsIO': SqsIOSourceProperties,
  'SOURCE:MqttIO': MqttIOSourceProperties,
  'SOURCE:GenerateSequence': GenerateSequenceProperties,
  'SOURCE:PeriodicImpulse': PeriodicImpulseProperties,
  'SOURCE:Create': CreateProperties,

  // Direct Source transforms (Python Beam transforms / unique names)
  'ReadFromAvro': AvroIOSourceProperties,
  'ReadFromKafka': KafkaIOSourceProperties,
  'ReadFromJms': JmsIOSourceProperties,
  'ReadDataFromKinesis': KinesisIOSourceProperties,
  'ReadFromParquet': ParquetIOSourceProperties,
  'ReadFromSqs': SqsIOSourceProperties,
  'ReadFromMqtt': MqttIOSourceProperties,
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
  'SINK:SnsIO': SnsIOSinkProperties,
  'SINK:JmsIO': JmsIOSinkProperties,
  'SINK:SqsIO': SqsIOSinkProperties,
  'SINK:MqttIO': MqttIOSinkProperties,
  'SINK:LogMessage': LogMessageProperties,

  // Direct Sink transforms (Python Beam transforms / unique names)
  'WriteToAvro': AvroIOSinkProperties,
  'WriteToKafka': KafkaIOSinkProperties,
  'WriteToJms': JmsIOSinkProperties,
  'WriteToKinesis': KinesisIOSinkProperties,
  'WriteToParquet': ParquetIOSinkProperties,
  'WriteToSqs': SqsIOSinkProperties,
  'WriteToMqtt': MqttIOSinkProperties,
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
};

/**
 * Resolves a property form component from the registry using the node's immutable metadata.
 * 
 * Precedence:
 * 1. Type-qualified key: `${nodeType}:${transform}` (e.g. "SOURCE:PubSubIO", "SINK:BigQueryIO")
 * 2. Direct transform key: `${transform}` (e.g. "ParDo", "WindowInto", "ReadFromKafka")
 * 
 * NOTE: Does NOT fall back to label matching under any circumstances.
 * 
 * @param node - React Flow node object
 * @returns Registered React component or undefined if unregistered
 */
export function getPropertyFormComponent(node: any): React.FC<PropertyFormProps> | undefined {
  const transform = node?.data?.beam_transform || node?.data?.componentType || '';
  const nodeType = (node?.data?.type || '').toUpperCase();

  if (!transform) {
    return undefined;
  }

  // 1. Try type-qualified key (e.g. "SOURCE:PubSubIO", "SINK:KafkaIO")
  if (nodeType) {
    const qualifiedKey = `${nodeType}:${transform}`;
    if (PROPERTY_FORM_REGISTRY[qualifiedKey]) {
      return PROPERTY_FORM_REGISTRY[qualifiedKey];
    }
  }

  // 2. Try direct transform key (e.g. "ParDo", "WindowInto", "ReadFromKafka")
  if (PROPERTY_FORM_REGISTRY[transform]) {
    return PROPERTY_FORM_REGISTRY[transform];
  }

  return undefined;
}

/**
 * Container component that dispatches specific node property sheets based on immutable node metadata.
 * Renders an explicit unregistered message when no matching registry entry is found.
 */
export const PropertyForm: React.FC<PropertyFormProps> = ({ node, onChange, onAddKVMapper }) => {
  const Component = getPropertyFormComponent(node);

  if (!Component) {
    // Fail fast with explicit visible message rather than silent generic form or label fallback
    const rawType = node?.data?.beam_transform || node?.data?.componentType || node?.data?.type || 'unknown';
    return (
      <div className="p-4 text-sm text-[var(--vscode-descriptionForeground,#94a3b8)]">
        No property form registered for type &quot;{rawType}&quot;
      </div>
    );
  }

  return <Component node={node} onChange={onChange} onAddKVMapper={onAddKVMapper} />;
};
