import React from 'react';

interface ParseMessageNode {
  data: {
    special_instructions?: string;
    properties?: {
      messageType?: 'JSON' | 'Base64' | 'String';
      special_instructions?: string;
    };
  };
}

interface ParseMessagePropertiesProps {
  node: ParseMessageNode;
  onChange: (properties: any) => void;
}

export const ParseMessageProperties: React.FC<ParseMessagePropertiesProps> = ({ node, onChange }) => {
  const properties = node.data.properties || {};
  const messageType = properties.messageType || 'JSON';
  const specialInstructions = node.data.special_instructions ?? properties.special_instructions ?? '';

  // Handle select or textarea change and propagate up
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    onChange({ ...properties, [name]: value });
  };

  // Helper text based on selected message type
  const getHelperText = () => {
    switch (messageType) {
      case 'JSON':
        return 'Parse PubSub JSON message and convert it to a dictionary (Dict) format.';
      case 'Base64':
        return 'Decode PubSub Message and decode Base64 bytes.';
      case 'String':
        return 'Decode PubSub message bytes into a UTF-8 String.';
      default:
        return '';
    }
  };

  return (
    <div className="flex-1 flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label className="text-xs font-bold uppercase text-slate-500">Message Type</label>
        <select 
          name="messageType" 
          value={messageType} 
          onChange={handleChange} 
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
        >
          <option value="JSON">JSON</option>
          <option value="Base64">Base64</option>
          <option value="String">String</option>
        </select>
      </div>

      <div className="text-xs text-slate-400 mt-1 leading-relaxed bg-slate-800/40 p-2.5 rounded border border-slate-700/50">
        {getHelperText()}
      </div>

      {/* Flexible Spacer taking up all free space to bottom-align Special Instructions */}
      <div className="flex-1" />

      <div className="flex flex-col gap-2">
        <label className="text-xs font-bold uppercase text-slate-500">Special Instructions</label>
        <textarea
          name="special_instructions"
          value={specialInstructions}
          onChange={handleChange}
          placeholder="Enter special instructions..."
          rows={3}
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500 resize-y"
        />
      </div>
    </div>
  );
};
