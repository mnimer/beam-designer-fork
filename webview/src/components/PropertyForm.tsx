/**
 * PropertyForm Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Container component dispatching specific node property sheets based on the selected canvas node's type, label, and beam_transform.
 * 
 * Architectural Decisions:
 * - Delegates specific property forms to modular components in source, sink, and step subdirectories.
 * - Matches node labels and beam_transform metadata.
 * - Supports Streaming Sources (PubSub, GenerateSequence, PeriodicImpulse), Database, File, Aggregations, and Transform steps.
 * - Supports MqttIO Source and Sink property forms for streaming IoT workloads.
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
import { AvroIOSourceProperties } from '../properties/source/AvroIO';
import { AvroIOSinkProperties } from '../properties/sink/AvroIO';
import { MqttIOSourceProperties } from '../properties/source/MqttIO';
import { MqttIOSinkProperties } from '../properties/sink/MqttIO';
interface PropertyFormProps {
  node: any;
  onChange: (properties: any) => void;
  onAddKVMapper?: (windowNodeId: string) => void;
}

export const PropertyForm: React.FC<PropertyFormProps> = ({ node, onChange, onAddKVMapper }) => {
  const label = node?.data?.label || '';
  const beamTransform = node?.data?.beam_transform || '';
  const nodeType = (node?.data?.type || '').toUpperCase();
  const labelLower = label.toLowerCase();
  const transformLower = beamTransform.toLowerCase();

  let formContent = null;

  // Determine which form to show based on the node label and beam_transform
  if (label.includes('PubSub') || beamTransform.includes('PubSub')) {
    if (nodeType === 'SOURCE') {
      formContent = <PubSubProperties node={node} onChange={onChange} />;
    } else {
      formContent = <PubSubSinkProperties node={node} onChange={onChange} />;
    }
  } else if (label.includes('Generate Sequence') || beamTransform === 'GenerateSequence') {
    formContent = <GenerateSequenceProperties node={node} onChange={onChange} />;
  } else if (label.includes('Periodic Impulse') || beamTransform === 'PeriodicImpulse') {
    formContent = <PeriodicImpulseProperties node={node} onChange={onChange} />;
  } else if (label === 'Create' || beamTransform === 'Create') {
    formContent = <CreateProperties node={node} onChange={onChange} />;
  } else if (label.includes('BigQuery') || beamTransform.includes('BigQuery')) {
    if (nodeType === 'SOURCE') {
      formContent = <BigQuerySourceProperties node={node} onChange={onChange} />;
    } else {
      formContent = <BigQuerySinkProperties node={node} onChange={onChange} />;
    }
  } else if (label.includes('TextIO') || beamTransform === 'TextIO') {
    if (nodeType === 'SOURCE') {
      formContent = <TextIOSourceProperties node={node} onChange={onChange} />;
    } else {
      formContent = <TextIOSinkProperties node={node} onChange={onChange} />;
    }
  } else if (
    label.includes('AvroIO') || 
    beamTransform === 'AvroIO' || 
    beamTransform === 'ReadFromAvro' || 
    beamTransform === 'WriteToAvro' ||
    labelLower.includes('avro') ||
    transformLower.includes('avro')
  ) {
    if (nodeType === 'SOURCE' || (!nodeType && (labelLower.includes('source') || labelLower.includes('read') || transformLower.includes('read')))) {
      formContent = <AvroIOSourceProperties node={node} onChange={onChange} />;
    } else {
      formContent = <AvroIOSinkProperties node={node} onChange={onChange} />;
    }
  } else if (label.includes('FileIO') || beamTransform.startsWith('FileIO')) {
    if (label.includes('Read Matches') || beamTransform === 'FileIO.readMatches') {
      formContent = <FileIOReadMatchesProperties node={node} onChange={onChange} />;
    } else if (nodeType === 'SOURCE' || beamTransform === 'FileIO.match') {
      formContent = <FileIOSourceProperties node={node} onChange={onChange} />;
    } else {
      formContent = <FileIOSinkProperties node={node} onChange={onChange} />;
    }
  } else if (label.includes('Jdbc') || label.includes('JDBC') || beamTransform === 'JdbcIO') {
    if (nodeType === 'SOURCE') {
      formContent = <JdbcIOSourceProperties node={node} onChange={onChange} />;
    } else {
      formContent = <JdbcIOSinkProperties node={node} onChange={onChange} />;
    }
  } else if (
    labelLower.includes('kafka') || 
    transformLower.includes('kafka') || 
    beamTransform === 'ReadFromKafka' || 
    beamTransform === 'WriteToKafka'
  ) {
    if (nodeType === 'SOURCE' || (!nodeType && (labelLower.includes('source') || labelLower.includes('read') || transformLower.includes('read')))) {
      formContent = <KafkaIOSourceProperties node={node} onChange={onChange} />;
    } else {
      formContent = <KafkaIOSinkProperties node={node} onChange={onChange} />;
    }
  } else if (
    labelLower.includes('mqtt') || 
    transformLower.includes('mqtt') || 
    beamTransform === 'MqttIO' ||
    beamTransform === 'ReadFromMqtt' || 
    beamTransform === 'WriteToMqtt'
  ) {
    if (nodeType === 'SOURCE' || (!nodeType && (labelLower.includes('source') || labelLower.includes('read') || transformLower.includes('read')))) {
      formContent = <MqttIOSourceProperties node={node} onChange={onChange} />;
    } else {
      formContent = <MqttIOSinkProperties node={node} onChange={onChange} />;
    }
  } else if (
    label === 'Window' || 
    label.includes('Windowing') || 
    label === 'Fixed Window' || 
    label === 'Fixed Windows' || 
    label === 'Sliding Windows' || 
    label === 'User Windows' ||
    beamTransform === 'Window' ||
    beamTransform === 'Windowing' ||
    transformLower.includes('window')
  ) {
    formContent = <WindowingProperties node={node} onChange={onChange} onAddKVMapper={onAddKVMapper} />;
  } else if (label === 'Parse Message' || beamTransform === 'ParseMessage') {
    formContent = <ParseMessageProperties node={node} onChange={onChange} />;
  } else if (label.toLowerCase().includes('timestamp') || label === 'WithTimestamps' || label === 'Add Timestamp' || beamTransform === 'WithTimestamps') {
    formContent = <WithTimestampsProperties node={node} onChange={onChange} />;
  } else if (label === 'Log Message' || beamTransform === 'LogMessage') {
    formContent = <LogMessageProperties node={node} onChange={onChange} />;
  } else if (label === 'KV Mapper' || beamTransform === 'KVMapper') {
    formContent = <KVMapperProperties node={node} onChange={onChange} />;
  } else if (label === 'Filter' || beamTransform === 'Filter') {
    formContent = <FilterProperties node={node} onChange={onChange} />;
  } else if (label === 'FlatMap' || beamTransform === 'FlatMap') {
    formContent = <FlatMapProperties node={node} onChange={onChange} />;
  } else if (label === 'Map' || beamTransform === 'Map') {
    formContent = <MapProperties node={node} onChange={onChange} />;
  } else if (label === 'ParDo' || beamTransform === 'ParDo') {
    formContent = <ParDoProperties node={node} onChange={onChange} />;
  } else if (
    [
      'Approximate Quantiles', 'Approximate Quantile', 'ApproximateQuantiles',
      'Approximate Unique', 'ApproximateUnique',
      'Co Group By Key', 'CoGroupByKey',
      'Combine', 'Combine With Context', 'CombineWithContext',
      'Count', 'Distinct',
      'Group By Key', 'GroupByKey',
      'Group Into Batches', 'GroupIntoBatches',
      'Batch Elements', 'BatchElements',
      'Latest', 'Max', 'Mean', 'Min', 'Sample', 'Sum', 'Top'
    ].includes(label) ||
    [
      'Approximate Quantiles', 'Approximate Quantile', 'ApproximateQuantiles',
      'Approximate Unique', 'ApproximateUnique',
      'Co Group By Key', 'CoGroupByKey',
      'Combine', 'Combine With Context', 'CombineWithContext',
      'Count', 'Distinct',
      'Group By Key', 'GroupByKey',
      'Group Into Batches', 'GroupIntoBatches',
      'Batch Elements', 'BatchElements',
      'Latest', 'Max', 'Mean', 'Min', 'Sample', 'Sum', 'Top'
    ].includes(beamTransform)
  ) {
    formContent = <AggregationProperties node={node} onChange={onChange} />;
  } else if (
    label === 'Flatten' ||
    label === 'ReShuffle' ||
    label === 'Reshuffle' ||
    beamTransform === 'Flatten' ||
    beamTransform === 'Reshuffle' ||
    beamTransform === 'ReShuffle'
  ) {
    formContent = <OtherProperties node={node} onChange={onChange} />;
  } else {
    formContent = <div className="text-sm text-slate-400">Nothing to customize</div>;
  }

  return (
    <>
      {formContent}
    </>
  );
};
