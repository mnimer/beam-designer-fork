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
import { InfoTooltip } from '../../components/InfoTooltip';

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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    onChange({
      ...properties,
      [name]: value
    });
  };

  const handleInstructionsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange({
      ...properties,
      system_instructions: e.target.value
    });
  };

  return (
    <div className="flex-1 flex flex-col gap-4">
      {/* Mapping Function / Expression */}
      <div className="flex flex-col gap-2">
        <label htmlFor="mapFunctionInput" className="flex items-center text-xs font-bold uppercase text-slate-500">
          <span>Mapping Function / Expression</span>
          <InfoTooltip text="Lambda expression, method reference, or custom map function applied to each element (e.g. element -> element.toUpperCase())." />
        </label>
        <input
          id="mapFunctionInput"
          type="text"
          name="mappingFunction"
          value={mappingFunction}
          onChange={handleChange}
          placeholder="e.g. element -> element.toUpperCase()"
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500 font-mono"
        />
      </div>

      {/* Output Type */}
      <div className="flex flex-col gap-2">
        <label htmlFor="mapOutputTypeInput" className="flex items-center text-xs font-bold uppercase text-slate-500">
          <span>Output Type Descriptor</span>
          <InfoTooltip text="Optional output TypeDescriptor or class name (e.g. TypeDescriptors.strings())." />
        </label>
        <input
          id="mapOutputTypeInput"
          type="text"
          name="outputType"
          value={outputType}
          onChange={handleChange}
          placeholder="e.g. String, KV<String, Integer>"
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500 font-mono"
        />
      </div>

      <div className="text-xs text-slate-400 mt-1 leading-relaxed bg-slate-800/40 p-2.5 rounded border border-slate-700/50">
        Apply a 1-to-1 transformation mapping function to each input element.
      </div>

      {/* Flexible Spacer */}
      <div className="flex-1 min-h-4" />

      {/* Code Generation Instructions */}
      <div className="flex flex-col gap-2 pt-2 border-t border-slate-700/60">
        <label htmlFor="mapSystemInstructions" className="text-xs font-bold uppercase text-slate-500">
          Code Generation Instructions
        </label>
        <textarea
          id="mapSystemInstructions"
          name="system_instructions"
          value={systemInstructions}
          onChange={handleInstructionsChange}
          placeholder="Enter custom instructions for Map transform code generation..."
          rows={3}
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500 resize-y"
        />
      </div>
    </div>
  );
};
