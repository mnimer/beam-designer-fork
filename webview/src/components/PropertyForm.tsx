import React from 'react';
import { PubSubProperties } from '../properties/source/PubSub';
import { BigQueryProperties } from '../properties/sink/BigQuery';
import { WindowingProperties } from '../properties/step/Windowing';

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
    formContent = <BigQueryProperties node={node} onChange={onChange} />;
  } else if (label.includes('Windowing')) {
    formContent = <WindowingProperties node={node} onChange={onChange} />;
  } else {
    formContent = <div className="text-sm text-slate-400">Generic properties for {label}</div>;
  }

  return (
    <>
      {formContent}
    </>
  );
};
