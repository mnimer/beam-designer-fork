import React from 'react';

interface ParseBase64PropertiesProps {
  node: any;
  onChange: (properties: any) => void;
}

export const ParseBase64Properties: React.FC<ParseBase64PropertiesProps> = () => {
  return (
    <div className="flex flex-col gap-4">
      <div className="text-sm text-slate-300">
        Parse PubSub Message and convert decode Base64 Bytes
      </div>
    </div>
  );
};
