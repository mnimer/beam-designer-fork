import React from 'react';

interface WithTimestampsNode {
  data: {
    system_instructions?: string;
    special_instructions?: string;
    properties?: {
      timestampType?: 'Current Time' | 'Message Property' | 'Header Property';
      propertyName?: string;
      system_instructions?: string;
      special_instructions?: string;
    };
  };
}

interface WithTimestampsPropertiesProps {
  node: WithTimestampsNode;
  onChange: (properties: any) => void;
}

export const generateTimestampSystemInstruction = (type: string, propName: string): string => {
  if (type === 'Message Property') {
    return propName ? `Extract timestamp from message field '${propName}'.` : 'Extract timestamp from message field.';
  }
  if (type === 'Header Property') {
    return propName ? `Extract timestamp from message header '${propName}'.` : 'Extract timestamp from message header.';
  }
  return 'Attach current system time to each element.';
};

export const WithTimestampsProperties: React.FC<WithTimestampsPropertiesProps> = ({ node, onChange }) => {
  const properties = node.data.properties || {};
  const timestampType = properties.timestampType || 'Current Time';
  const propertyName = properties.propertyName || '';
  const systemInstructions =
    node.data.system_instructions ??
    node.data.special_instructions ??
    properties.system_instructions ??
    properties.special_instructions ??
    generateTimestampSystemInstruction(timestampType, propertyName);

  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newType = e.target.value as 'Current Time' | 'Message Property' | 'Header Property';
    const newInstructions = generateTimestampSystemInstruction(newType, propertyName);
    onChange({
      ...properties,
      timestampType: newType,
      propertyName,
      system_instructions: newInstructions,
    });
  };

  const handlePropertyNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPropName = e.target.value;
    const newInstructions = generateTimestampSystemInstruction(timestampType, newPropName);
    onChange({
      ...properties,
      timestampType,
      propertyName: newPropName,
      system_instructions: newInstructions,
    });
  };

  const handleInstructionsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange({
      ...properties,
      timestampType,
      propertyName,
      system_instructions: e.target.value,
    });
  };

  const showPropertyNameInput = timestampType === 'Message Property' || timestampType === 'Header Property';

  return (
    <div className="flex-1 flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label className="text-xs font-bold uppercase text-slate-500">Timestamp Source</label>
        <select
          name="timestampType"
          value={timestampType}
          onChange={handleTypeChange}
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
        >
          <option value="Current Time">Current Time</option>
          <option value="Message Property">Message Property</option>
          <option value="Header Property">Header Property</option>
        </select>
      </div>

      {showPropertyNameInput && (
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold uppercase text-slate-500">Property Name</label>
          <input
            type="text"
            name="propertyName"
            value={propertyName}
            onChange={handlePropertyNameChange}
            placeholder={timestampType === 'Header Property' ? 'e.g. publish_time' : 'e.g. event_timestamp'}
            className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
          />
        </div>
      )}

      <div className="text-xs text-slate-400 mt-1 leading-relaxed bg-slate-800/40 p-2.5 rounded border border-slate-700/50">
        Assign timestamps to incoming elements for windowing and event-time processing.
      </div>

      {/* Flexible Spacer taking up all free space to bottom-align Code Generation Instructions */}
      <div className="flex-1" />

      <div className="flex flex-col gap-2">
        <label className="text-xs font-bold uppercase text-slate-500">Code Generation Instructions</label>
        <textarea
          name="system_instructions"
          value={systemInstructions}
          onChange={handleInstructionsChange}
          placeholder="Enter code generation instructions..."
          rows={3}
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500 resize-y"
        />
      </div>
    </div>
  );
};
