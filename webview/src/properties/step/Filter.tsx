import React from 'react';

interface FilterNode {
  data: {
    label: string;
  };
}

interface FilterPropertiesProps {
  node: FilterNode;
  onChange: (properties: any) => void;
}

export const FilterProperties: React.FC<FilterPropertiesProps> = () => {
  return (
    <div className="flex flex-col gap-4">
      <div className="text-sm text-slate-400">
        Filter properties are currently empty. Configure matching rules or functions to filter elements.
      </div>
    </div>
  );
};
