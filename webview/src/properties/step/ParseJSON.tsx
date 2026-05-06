import React from 'react';

interface ParseJSONPropertiesProps {
  node: any;
  onChange: (properties: any) => void;
}

export const ParseJSONProperties: React.FC<ParseJSONPropertiesProps> = () => {
  return (
    <div className="flex flex-col gap-4">
      <div className="text-sm text-slate-300">
        Parse PubSub JSON message and convert to Dict
      </div>
    </div>
  );
};
