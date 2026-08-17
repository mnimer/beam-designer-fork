import React from 'react';

interface FilterNode {
  data: {
    system_instructions?: string;
    special_instructions?: string;
    properties?: {
      compareTarget?: 'Message Property' | 'Header Property';
      property?: string;
      operator?: '==' | '!=' | '>' | '<';
      value?: string;
      system_instructions?: string;
      special_instructions?: string;
    };
  };
}

interface FilterPropertiesProps {
  node: FilterNode;
  onChange: (properties: any) => void;
}

export const generateFilterSystemInstruction = (
  compareTarget: string,
  prop: string,
  op: string,
  val: string
): string => {
  if (prop.trim()) {
    const target = compareTarget === 'Header Property' ? 'message header' : 'message property';
    if (val.trim()) {
      return `Filter elements where ${target} '${prop.trim()}' ${op} '${val.trim()}'.`;
    }
    return `Filter elements where ${target} '${prop.trim()}' ${op} value.`;
  }
  return 'Create a custom function with a todo comment and return true.';
};

export const FilterProperties: React.FC<FilterPropertiesProps> = ({ node, onChange }) => {
  const properties = node.data.properties || {};
  const compareTarget = properties.compareTarget || 'Message Property';
  const property = properties.property || '';
  const operator = properties.operator || '==';
  const value = properties.value || '';

  const handleCompareTargetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newTarget = e.target.value as 'Message Property' | 'Header Property';
    const newInstructions = generateFilterSystemInstruction(newTarget, property, operator, value);
    onChange({
      ...properties,
      compareTarget: newTarget,
      property,
      operator,
      value,
      system_instructions: newInstructions,
    });
  };

  const handlePropertyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newProp = e.target.value;
    const newInstructions = generateFilterSystemInstruction(compareTarget, newProp, operator, value);
    onChange({
      ...properties,
      compareTarget,
      property: newProp,
      operator,
      value,
      system_instructions: newInstructions,
    });
  };

  const handleOperatorChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newOp = e.target.value as '==' | '!=' | '>' | '<';
    const newInstructions = generateFilterSystemInstruction(compareTarget, property, newOp, value);
    onChange({
      ...properties,
      compareTarget,
      property,
      operator: newOp,
      value,
      system_instructions: newInstructions,
    });
  };

  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value;
    const newInstructions = generateFilterSystemInstruction(compareTarget, property, operator, newVal);
    onChange({
      ...properties,
      compareTarget,
      property,
      operator,
      value: newVal,
      system_instructions: newInstructions,
    });
  };

  return (
    <div className="flex-1 flex flex-col gap-4">
      {/* Compare Dropdown */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-bold uppercase text-slate-500">Compare</label>
        <select
          name="compareTarget"
          value={compareTarget}
          onChange={handleCompareTargetChange}
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
        >
          <option value="Message Property">Message Property</option>
          <option value="Header Property">Header Property</option>
        </select>
      </div>

      {/* Property */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-bold uppercase text-slate-500">Property</label>
        <input
          type="text"
          name="property"
          value={property}
          onChange={handlePropertyChange}
          placeholder="e.g. status"
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500 w-full"
        />
      </div>

      {/* Operator */}
      <div className="flex flex-col items-center">
        <select
          name="operator"
          value={operator}
          onChange={handleOperatorChange}
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500 text-center w-28 cursor-pointer"
        >
          <option value="==">==</option>
          <option value="!=">!=</option>
          <option value=">">&gt;</option>
          <option value="<">&lt;</option>
        </select>
      </div>

      {/* Value */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-bold uppercase text-slate-500">Value</label>
        <input
          type="text"
          name="value"
          value={value}
          onChange={handleValueChange}
          placeholder="e.g. active"
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500 w-full"
        />
      </div>

      <div className="text-xs text-slate-400 mt-1 leading-relaxed bg-slate-800/40 p-2.5 rounded border border-slate-700/50">
        Filter elements based on boolean conditions or properties.
      </div>
    </div>
  );
};
