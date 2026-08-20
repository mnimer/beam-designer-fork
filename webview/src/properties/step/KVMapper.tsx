/**
 * KVMapper Properties Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Renders the property configuration panel for Apache Beam KV mapping transform steps (MapElements.via(KV.of(...))).
 * 
 * Architectural Decisions:
 * - In Apache Beam, KV mapping produces KV<Key, Value> pairs for downstream GroupByKey / Windowing operations.
 * - Key property name is required to specify which field/attribute becomes the key.
 * - Enforces required field indicators, error messages, and aria attributes.
 * - Integrates InfoTooltip components explaining key extraction semantics.
 * - Provides Code Generation Instructions textarea for custom LLM prompts.
 */

import React from 'react';
import { InfoTooltip } from '../../components/InfoTooltip';

interface KVMapperNode {
  data: {
    label?: string;
    beam_transform?: string;
    system_instructions?: string;
    special_instructions?: string;
    properties?: {
      keyPropertyName?: string;
      valuePropertyName?: string;
      system_instructions?: string;
      special_instructions?: string;
      codeGenerationPrompt?: string;
      prompt?: string;
      [key: string]: any;
    };
  };
}

interface KVMapperPropertiesProps {
  node: KVMapperNode;
  onChange: (properties: any) => void;
}

export const KVMapperProperties: React.FC<KVMapperPropertiesProps> = ({ node, onChange }) => {
  const properties = node.data.properties || {};
  const keyPropertyName = properties.keyPropertyName || '';
  const valuePropertyName = properties.valuePropertyName || '';

  const isKeyPropertyInvalid = !keyPropertyName.trim();

  // System instructions text with fallback
  const systemInstructions =
    node.data.system_instructions ??
    node.data.special_instructions ??
    properties.system_instructions ??
    properties.special_instructions ??
    '';

  // Handle input change and propagate up
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...properties, [e.target.name]: e.target.value });
  };

  const handleInstructionsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange({
      ...properties,
      system_instructions: e.target.value
    });
  };

  return (
    <div className="flex-1 flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label htmlFor="kvKeyPropertyName" className="flex items-center text-xs font-bold uppercase text-slate-500">
          <span>Key Property Name</span>
          <span className="text-red-400 ml-1 font-bold" title="Required">*</span>
          <InfoTooltip text="Field or attribute name to extract as the Key for the KV<K, V> pair. Required." />
        </label>
        <input 
          id="kvKeyPropertyName"
          type="text" 
          name="keyPropertyName" 
          aria-required="true"
          aria-invalid={isKeyPropertyInvalid}
          value={keyPropertyName} 
          onChange={handleChange} 
          placeholder="e.g. id, userId"
          className={`bg-[#252836] text-white p-2 rounded border text-sm focus:outline-none ${
            isKeyPropertyInvalid
              ? 'border-red-500/80 focus:border-red-500'
              : 'border-slate-700 focus:border-blue-500'
          }`}
        />
        {isKeyPropertyInvalid && (
          <span className="text-xs text-red-400">Key property name is required.</span>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="kvValuePropertyName" className="flex items-center text-xs font-bold uppercase text-slate-500">
          <span>Value Property Name (Optional)</span>
          <InfoTooltip text="Optional field to extract as the Value. If left empty, the entire element is preserved as the value." />
        </label>
        <input 
          id="kvValuePropertyName"
          type="text" 
          name="valuePropertyName" 
          value={valuePropertyName} 
          onChange={handleChange} 
          placeholder="Leave empty for entire element"
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
        />
      </div>

      <div className="text-xs text-slate-400 mt-1 leading-relaxed bg-slate-800/40 p-2.5 rounded border border-slate-700/50">
        Extract a property from the element to act as the key, creating a key-value pair (KV element) for keyed transforms like GroupByKey and Session Windows.
      </div>

      {/* Flexible Spacer */}
      <div className="flex-1 min-h-4" />

      {/* Code Generation Instructions */}
      <div className="flex flex-col gap-2 pt-2 border-t border-slate-700/60">
        <label htmlFor="kvSystemInstructions" className="text-xs font-bold uppercase text-slate-500">
          Code Generation Instructions
        </label>
        <textarea
          id="kvSystemInstructions"
          name="system_instructions"
          value={systemInstructions}
          onChange={handleInstructionsChange}
          placeholder="Enter custom instructions for KV mapping code generation..."
          rows={3}
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500 resize-y"
        />
      </div>
    </div>
  );
};
