import React from 'react';

interface FlatMapNode {
  data: {
    system_instructions?: string;
    special_instructions?: string;
    properties?: {
      splitVia?: '' | 'Token' | 'Regex';
      delimiter?: string;
      regexPattern?: string;
      system_instructions?: string;
      special_instructions?: string;
    };
  };
}

interface FlatMapPropertiesProps {
  node: FlatMapNode;
  onChange: (properties: any) => void;
}

export const FlatMapProperties: React.FC<FlatMapPropertiesProps> = ({ node, onChange }) => {
  const properties = node.data.properties || {};
  const splitVia = properties.splitVia || '';
  const delimiter = properties.delimiter !== undefined ? properties.delimiter : ',';
  const regexPattern = properties.regexPattern !== undefined ? properties.regexPattern : '';

  const systemInstructions =
    node.data.system_instructions ??
    node.data.special_instructions ??
    properties.system_instructions ??
    properties.special_instructions ??
    '';

  const handleSplitViaChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newSplitVia = e.target.value as '' | 'Token' | 'Regex';
    onChange({
      ...properties,
      splitVia: newSplitVia,
      delimiter,
      regexPattern,
      system_instructions: systemInstructions,
    });
  };

  const handleDelimiterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDelimiter = e.target.value;
    onChange({
      ...properties,
      splitVia,
      delimiter: newDelimiter,
      regexPattern,
      system_instructions: systemInstructions,
    });
  };

  const handleRegexPatternChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newRegex = e.target.value;
    onChange({
      ...properties,
      splitVia,
      delimiter,
      regexPattern: newRegex,
      system_instructions: systemInstructions,
    });
  };

  const handleInstructionsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange({
      ...properties,
      splitVia,
      delimiter,
      regexPattern,
      system_instructions: e.target.value,
    });
  };

  return (
    <div className="flex-1 flex flex-col gap-4">
      {/* Split via Dropdown */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-bold uppercase text-slate-500">Split via</label>
        <select
          name="splitVia"
          value={splitVia}
          onChange={handleSplitViaChange}
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
        >
          <option value=""></option>
          <option value="Token">Token</option>
          <option value="Regex">Regex</option>
        </select>
      </div>

      {/* Conditional Token Field */}
      {splitVia === 'Token' && (
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold uppercase text-slate-500">Token / Delimiter</label>
          <input
            type="text"
            name="delimiter"
            value={delimiter}
            onChange={handleDelimiterChange}
            maxLength={1}
            placeholder=","
            className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500 w-24 text-center font-mono"
          />
        </div>
      )}

      {/* Conditional Regex Field */}
      {splitVia === 'Regex' && (
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold uppercase text-slate-500">Regex Expression</label>
          <input
            type="text"
            name="regexPattern"
            value={regexPattern}
            onChange={handleRegexPatternChange}
            placeholder="e.g. [A-Za-z]+"
            className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500 font-mono"
          />
        </div>
      )}

      <div className="text-xs text-slate-400 mt-1 leading-relaxed bg-slate-800/40 p-2.5 rounded border border-slate-700/50">
        Map single input elements to 0 or more output elements (e.g. splitting strings or flattening arrays).
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
