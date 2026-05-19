import React from 'react';
import { PubSubProperties } from '../properties/source/PubSubIO';
import { BigQuerySourceProperties } from '../properties/source/BigQueryIO';
import { BigQuerySinkProperties } from '../properties/sink/BigQueryIO';
import { WindowingProperties } from '../properties/step/Windowing';
import { ParseJSONProperties } from '../properties/step/ParseJSON';
import { ParseBase64Properties } from '../properties/step/ParseBase64';
import { FixedWindowsProperties } from '../properties/step/FixedWindows';
import { SlidingWindowsProperties } from '../properties/step/SlidingWindows';
import { UserWindowsProperties } from '../properties/step/UserWindows';

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
  } else if (label === 'Fixed Windows') {
    formContent = <FixedWindowsProperties node={node} onChange={onChange} />;
  } else if (label === 'Sliding Windows') {
    formContent = <SlidingWindowsProperties node={node} onChange={onChange} />;
  } else if (label === 'User Windows') {
    formContent = <UserWindowsProperties node={node} onChange={onChange} />;
  } else if (label.includes('Windowing') || label === 'Fixed Window') {
    formContent = <WindowingProperties node={node} onChange={onChange} />;
  } else if (label === 'Parse JSON') {
    formContent = <ParseJSONProperties node={node} onChange={onChange} />;
  } else if (label === 'Parse Base64') {
    formContent = <ParseBase64Properties node={node} onChange={onChange} />;
  } else {
    formContent = <div className="text-sm text-slate-400">Generic properties for {label}</div>;
  }

  return (
    <>
      {formContent}
    </>
  );
};
