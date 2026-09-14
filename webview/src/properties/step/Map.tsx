/**
 * Map Properties Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Renders the property configuration panel for Apache Beam MapElements / Map transform steps.
 * 
 * Architectural Decisions:
 * - Map transforms apply a 1-to-1 function mapping to each input element.
 * - Integrates InfoTooltip components explaining Map semantics.
 * - Provides Code Generation Instructions textarea for custom LLM prompts.
 */

import React from 'react';
import { PropertyField } from '../../components/common/PropertyField';

interface MapNode {
  data: {
    label: string;
    beam_transform?: string;
    system_instructions?: string;
    special_instructions?: string;
    properties?: {
      mappingFunction?: string;
      outputType?: string;
      system_instructions?: string;
      special_instructions?: string;
      codeGenerationPrompt?: string;
      prompt?: string;
      [key: string]: any;
    };
  };
}

interface MapPropertiesProps {
  node: MapNode;
  onChange: (properties: any) => void;
}

export const MapProperties: React.FC<MapPropertiesProps> = ({ node, onChange }) => {
  const properties = node.data.properties || {};
  const mappingFunction = properties.mappingFunction || '';
  const outputType = properties.outputType || '';

  const systemInstructions =
    node.data.system_instructions ??
    node.data.special_instructions ??
    properties.system_instructions ??
    properties.special_instructions ??
    '';

  /**
   * Handles input changes for mapping function and output type
   */
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    onChange({
      ...properties,
      [name]: value
    });
  };

  /**
   * Handles changes to code generation instructions
   */
  const handleInstructionsChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    onChange({
      ...properties,
      system_instructions: e.target.value
    });
  };

  return (
    <div className="flex-1 flex flex-col gap-4">
      {/* Mapping Function / Expression */}
      <PropertyField
        id="mapFunctionInput"
        name="mappingFunction"
        label="Mapping Function / Expression"
        tooltip="Lambda expression, method reference, or custom map function applied to each element (e.g. element -> element.toUpperCase())."
        value={mappingFunction}
        onChange={handleChange}
        placeholder="e.g. element -> element.toUpperCase()"
      />

      {/* Output Type */}
      <PropertyField
        id="mapOutputTypeInput"
        name="outputType"
        label="Output Type Descriptor"
        tooltip="Optional output TypeDescriptor or class name (e.g. TypeDescriptors.strings())."
        value={outputType}
        onChange={handleChange}
        placeholder="e.g. String, KV<String, Integer>"
      />

      <div className="text-xs text-slate-400 mt-1 leading-relaxed bg-slate-800/40 p-2.5 rounded border border-slate-700/50">
        Apply a 1-to-1 transformation mapping function to each input element.
      </div>

      {/* Flexible Spacer */}
      <div className="flex-1 min-h-4" />

      {/* Code Generation Instructions */}
      <PropertyField
        id="mapSystemInstructions"
        name="system_instructions"
        label="Code Generation Instructions"
        containerClassName="flex flex-col gap-2 pt-2 border-t border-slate-700/60"
        type="textarea"
        rows={3}
        value={systemInstructions}
        onChange={handleInstructionsChange}
        placeholder="Enter custom instructions for Map transform code generation..."
        mono={false}
      />
    </div>
  );
};
