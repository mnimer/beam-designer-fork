/**
 * Filter Properties Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Renders the property configuration panel for Apache Beam Filter transform steps (Filter.by(...) / beam.Filter(...)).
 * 
 * Architectural Decisions:
 * - In Apache Beam, Filter evaluates a predicate on each element.
 * - Enforces required field indicators and validation on property.
 * - Integrates InfoTooltip components explaining predicate comparison against message and header properties.
 * - Provides Code Generation Instructions textarea for custom LLM prompts.
 */

import React from 'react';
import { InfoTooltip } from '../../components/InfoTooltip';
import { PropertyField } from '../../components/common/PropertyField';

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
      codeGenerationPrompt?: string;
      prompt?: string;
      [key: string]: any;
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

  const isPropertyInvalid = !property.trim();

  // System instructions text with fallback
  const systemInstructions =
    node.data.system_instructions ??
    node.data.special_instructions ??
    properties.system_instructions ??
    properties.special_instructions ??
    '';

  /**
   * Handles changes to the compare target select dropdown
   */
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

  /**
   * Handles changes to the property/field name input
   */
  const handlePropertyChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
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

  /**
   * Handles changes to the comparison operator select dropdown
   */
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

  /**
   * Handles changes to the target value input
   */
  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
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

  /**
   * Handles changes to the code generation instructions textarea
   */
  const handleInstructionsChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    onChange({
      ...properties,
      system_instructions: e.target.value
    });
  };

  return (
    <div className="flex-1 flex flex-col gap-4">
      {/* Compare Dropdown */}
      <div className="flex flex-col gap-2">
        <label htmlFor="filterCompareTarget" className="flex items-center text-xs font-bold uppercase text-slate-500">
          <span>Compare Target</span>
          <InfoTooltip text="Target payload location to evaluate: Message Property (data payload field) or Header Property (metadata attributes)." />
        </label>
        <select
          id="filterCompareTarget"
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
      <PropertyField
        id="filterPropertyInput"
        name="property"
        label="Property / Field Name"
        required="Required"
        tooltip="Name of the payload or header attribute to inspect in the filter predicate. Required."
        invalid={isPropertyInvalid}
        error={isPropertyInvalid ? 'Property name is required.' : null}
        value={property}
        onChange={handlePropertyChange}
        placeholder="e.g. status"
        mono={false}
        className="w-full"
      />

      {/* Operator */}
      <div className="flex flex-col items-center">
        <label htmlFor="filterOperatorSelect" className="flex items-center text-xs font-bold uppercase text-slate-500 mb-1">
          <span>Operator</span>
          <InfoTooltip text="Comparison operator applied between the field value and the target value." />
        </label>
        <select
          id="filterOperatorSelect"
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
      <PropertyField
        id="filterValueInput"
        name="value"
        label="Target Value"
        tooltip="Literal value to compare against."
        value={value}
        onChange={handleValueChange}
        placeholder="e.g. active"
        mono={false}
        className="w-full"
      />

      <div className="text-xs text-slate-400 mt-1 leading-relaxed bg-slate-800/40 p-2.5 rounded border border-slate-700/50">
        Filter elements based on boolean conditions or properties.
      </div>

      {/* Flexible Spacer */}
      <div className="flex-1 min-h-4" />

      {/* Code Generation Instructions */}
      <PropertyField
        id="filterSystemInstructions"
        name="system_instructions"
        label="Code Generation Instructions"
        containerClassName="flex flex-col gap-2 pt-2 border-t border-slate-700/60"
        type="textarea"
        rows={3}
        value={systemInstructions}
        onChange={handleInstructionsChange}
        placeholder="Enter custom instructions for Filter code generation..."
        mono={false}
      />
    </div>
  );
};
