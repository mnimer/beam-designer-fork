import React from 'react';
import { PubSubProperties } from '../properties/source/PubSubIO';
import { BigQuerySourceProperties } from '../properties/source/BigQueryIO';
import { BigQuerySinkProperties } from '../properties/sink/BigQueryIO';
import { WindowingProperties } from '../properties/step/Windowing';
import { ParseMessageProperties } from '../properties/step/ParseMessage';
import { LogMessageProperties } from '../properties/step/LogMessage';
import { KVMapperProperties } from '../properties/step/KVMapper';
import { FilterProperties } from '../properties/step/Filter';
import { FlatMapProperties } from '../properties/step/FlatMap';
import { MapProperties } from '../properties/step/Map';

/**
 * PropertyForm Component
 * 
 * This component acts as a container for specific node property forms.
 * It determines which property form to display based on the node's label.
 * 
 * Architectural Decisions:
 * - Delegated specific forms to individual components in subfolders.
 * - Uses string matching on labels to identify node types (could be improved to use a type field).
 */
interface PropertyFormProps {
  node: any;
  onChange: (properties: any) => void;
}

export const PropertyForm: React.FC<PropertyFormProps> = ({ node, onChange }) => {
  const { label } = node.data;

  let formContent = null;

  // Determine which form to show based on the node label
  // NOTE: This assumes naming conventions in labels.
  if (label.includes('PubSub')) {
    formContent = <PubSubProperties node={node} onChange={onChange} />;
  } else if (label.includes('BigQuery')) {
    if (node.data.type === 'SOURCE') {
      formContent = <BigQuerySourceProperties node={node} onChange={onChange} />;
    } else {
      formContent = <BigQuerySinkProperties node={node} onChange={onChange} />;
    }
  } else if (
    label === 'Window' || 
    label.includes('Windowing') || 
    label === 'Fixed Window' || 
    label === 'Fixed Windows' || 
    label === 'Sliding Windows' || 
    label === 'User Windows'
  ) {
    formContent = <WindowingProperties node={node} onChange={onChange} />;
  } else if (label === 'Parse Message') {
    formContent = <ParseMessageProperties node={node} onChange={onChange} />;
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
  } else {
    formContent = <div className="text-sm text-slate-400">Generic properties for {label}</div>;
  }

  return (
    <>
      {formContent}
    </>
  );
};
