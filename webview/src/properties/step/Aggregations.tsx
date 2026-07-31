import React from 'react';

interface AggregationNode {
  data: {
    label: string;
  };
}

interface AggregationPropertiesProps {
  node: AggregationNode;
  onChange: (properties: any) => void;
}

const DESCRIPTIONS: Record<string, string> = {
  'Approximate Quantiles': 'Computes approximate quantiles of the elements in a collection.',
  'Approximate Unique': 'Estimates the number of unique elements in a collection.',
  'Co Group By Key': 'Groups results from multiple collections by their common keys.',
  'Combine': 'Combines elements in a collection using a global combine function.',
  'Combine With Context': 'Combines elements in a collection using side inputs or contextual state.',
  'Count': 'Counts the number of elements in a collection.',
  'Distinct': 'Removes duplicate elements from a collection.',
  'Group By Key': 'Groups key-value pairs by their keys.',
  'Group Into Batches': 'Groups elements into batches of a specified size or duration.',
  'Batch Elements': 'Batches elements into smaller groups for downstream processing.',
  'Latest': 'Obtains the latest element or value according to timestamps.',
  'Max': 'Computes the maximum element or value in a collection.',
  'Mean': 'Computes the arithmetic mean of elements in a collection.',
  'Min': 'Computes the minimum element or value in a collection.',
  'Sample': 'Takes a random sample of elements from a collection.',
  'Sum': 'Computes the sum of elements in a collection.',
  'Top': 'Finds the top elements in a collection according to a comparator.',
};

export const AggregationProperties: React.FC<AggregationPropertiesProps> = ({ node }) => {
  const label = node.data.label;
  const description = DESCRIPTIONS[label] || 'Aggregation properties are currently empty.';

  return (
    <div className="flex flex-col gap-4">
      <div className="text-sm text-slate-400">
        {label} properties are currently empty. {description}
      </div>
    </div>
  );
};
