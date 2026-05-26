import React from 'react';

interface FlatMapNode {
  data: {
    label: string;
  };
}

interface FlatMapPropertiesProps {
  node: FlatMapNode;
  onChange: (properties: any) => void;
}

export const FlatMapProperties: React.FC<FlatMapPropertiesProps> = () => {
  return (
    <div className="flex flex-col gap-4">
      <div className="text-sm text-slate-400">
        FlatMap properties are currently empty. Configure operations to map single input elements to multiple output elements.
      </div>
    </div>
  );
};
