import React from 'react';
import { PubSubProperties } from '../properties/source/PubSubIO';
import { BigQuerySourceProperties } from '../properties/source/BigQueryIO';
import { CreateProperties } from '../properties/source/CreateIO';
import { BigQuerySinkProperties } from '../properties/sink/BigQueryIO';
import { PubSubSinkProperties } from '../properties/sink/PubSubIO';
import { WindowingProperties } from '../properties/step/Windowing';
import { ParseMessageProperties } from '../properties/step/ParseMessage';
import { LogMessageProperties } from '../properties/step/LogMessage';
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

/**
 * PropertyForm Component
 * 
 * This component acts as a container for specific node property forms.
 * It determines which property form to display based on the node's label and beam_transform.
 * 
 * Architectural Decisions:
 * - Delegated specific forms to individual components in subfolders.
 * - Uses string matching on labels and beam_transform attributes to identify node types.
 * - Includes support for FileIO (match, readMatches, sink) and TextIO (source, sink).
 * - Includes OtherProperties for miscellaneous transforms (e.g. Flatten, ReShuffle).
 */
interface PropertyFormProps {
  node: any;
  onChange: (properties: any) => void;
  onAddKVMapper?: (windowNodeId: string) => void;
}

export const PropertyForm: React.FC<PropertyFormProps> = ({ node, onChange, onAddKVMapper }) => {
  const { label } = node.data;

  let formContent = null;

  // Determine which form to show based on the node label
  // NOTE: This assumes naming conventions in labels.
  if (label.includes('PubSub')) {
    if (node.data.type === 'SOURCE') {
      formContent = <PubSubProperties node={node} onChange={onChange} />;
    } else {
      formContent = <PubSubSinkProperties node={node} onChange={onChange} />;
    }
  } else if (label === 'Create') {
    formContent = <CreateProperties node={node} onChange={onChange} />;
  } else if (label.includes('BigQuery')) {
    if (node.data.type === 'SOURCE') {
      formContent = <BigQuerySourceProperties node={node} onChange={onChange} />;
    } else {
      formContent = <BigQuerySinkProperties node={node} onChange={onChange} />;
    }
  } else if (label.includes('TextIO') || node.data.beam_transform === 'TextIO') {
    if (node.data.type === 'SOURCE') {
      formContent = <TextIOSourceProperties node={node} onChange={onChange} />;
    } else {
      formContent = <TextIOSinkProperties node={node} onChange={onChange} />;
    }
  } else if (label.includes('FileIO') || (node.data.beam_transform && node.data.beam_transform.startsWith('FileIO'))) {
    if (label.includes('Read Matches') || node.data.beam_transform === 'FileIO.readMatches') {
      formContent = <FileIOReadMatchesProperties node={node} onChange={onChange} />;
    } else if (node.data.type === 'SOURCE' || node.data.beam_transform === 'FileIO.match') {
      formContent = <FileIOSourceProperties node={node} onChange={onChange} />;
    } else {
      formContent = <FileIOSinkProperties node={node} onChange={onChange} />;
    }
  } else if (
    label === 'Window' || 
    label.includes('Windowing') || 
    label === 'Fixed Window' || 
    label === 'Fixed Windows' || 
    label === 'Sliding Windows' || 
    label === 'User Windows'
  ) {
    formContent = <WindowingProperties node={node} onChange={onChange} onAddKVMapper={onAddKVMapper} />;
  } else if (label === 'Parse Message') {
    formContent = <ParseMessageProperties node={node} onChange={onChange} />;
  } else if (label.toLowerCase().includes('timestamp') || label === 'WithTimestamps' || node.data.beam_transform === 'WithTimestamps') {
    formContent = <WithTimestampsProperties node={node} onChange={onChange} />;
  } else if (label === 'Log Message') {
    formContent = <LogMessageProperties node={node} onChange={onChange} />;
  } else if (label === 'KV Mapper') {
    formContent = <KVMapperProperties node={node} onChange={onChange} />;
  } else if (label === 'Filter') {
    formContent = <FilterProperties node={node} onChange={onChange} />;
  } else if (label === 'FlatMap') {
    formContent = <FlatMapProperties node={node} onChange={onChange} />;
  } else if (label === 'Map') {
    formContent = <MapProperties node={node} onChange={onChange} />;
  } else if (label === 'ParDo' || node.data.beam_transform === 'ParDo') {
    formContent = <ParDoProperties node={node} onChange={onChange} />;
  } else if (
    label === 'Approximate Quantiles' ||
    label === 'Approximate Unique' ||
    label === 'Co Group By Key' ||
    label === 'Combine' ||
    label === 'Combine With Context' ||
    label === 'Count' ||
    label === 'Distinct' ||
    label === 'Group By Key' ||
    label === 'Group Into Batches' ||
    label === 'Batch Elements' ||
    label === 'Latest' ||
    label === 'Max' ||
    label === 'Mean' ||
    label === 'Min' ||
    label === 'Sample' ||
    label === 'Sum' ||
    label === 'Top'
  ) {
    formContent = <AggregationProperties node={node} onChange={onChange} />;
  } else if (
    label === 'Flatten' ||
    label === 'ReShuffle' ||
    label === 'Reshuffle' ||
    node.data.beam_transform === 'Flatten' ||
    node.data.beam_transform === 'Reshuffle' ||
    node.data.beam_transform === 'ReShuffle'
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
