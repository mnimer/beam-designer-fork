import React from 'react';

interface MapNode {
  data: {
    label: string;
  };
}

interface MapPropertiesProps {
  node: MapNode;
  onChange: (properties: any) => void;
}

export const MapProperties: React.FC<MapPropertiesProps> = () => {
  return (
    <div className="flex flex-col gap-4">
      <div className="text-sm text-slate-400">
        Map properties are currently empty. Configure a 1-to-1 transform mapping function for elements.
      </div>
    </div>
  );
};
