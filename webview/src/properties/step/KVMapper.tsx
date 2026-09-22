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
import { PropertyField } from '../../components/common/PropertyField';

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

  /**
   * Handles input changes for key and value property names
   */
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    onChange({ ...properties, [e.target.name]: e.target.value });
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
      <PropertyField
        id="kvKeyPropertyName"
        name="keyPropertyName"
        label="Key Property Name"
        required="Required"
        tooltip="Field or attribute name to extract as the Key for the KV<K, V> pair. Required."
        invalid={isKeyPropertyInvalid}
        error={isKeyPropertyInvalid ? 'Key property name is required.' : null}
        value={keyPropertyName}
        onChange={handleChange}
        placeholder="e.g. id, userId"
        mono={false}
      />

      <PropertyField
        id="kvValuePropertyName"
        name="valuePropertyName"
        label="Value Property Name (Optional)"
        tooltip="Optional field to extract as the Value. If left empty, the entire element is preserved as the value."
        value={valuePropertyName}
        onChange={handleChange}
        placeholder="Leave empty for entire element"
        mono={false}
      />

      <div className="text-xs text-slate-400 mt-1 leading-relaxed bg-slate-800/40 p-2.5 rounded border border-slate-700/50">
        Extract a property from the element to act as the key, creating a key-value pair (KV element) for keyed transforms like GroupByKey and Session Windows.
      </div>

      {/* Flexible Spacer */}
      <div className="flex-1 min-h-4" />

      {/* Code Generation Instructions */}
      <PropertyField
        id="kvSystemInstructions"
        name="system_instructions"
        label="Code Generation Instructions"
        containerClassName="flex flex-col gap-2 pt-2 border-t border-slate-700/60"
        type="textarea"
        rows={3}
        value={systemInstructions}
        onChange={handleInstructionsChange}
        placeholder="Enter custom instructions for KV mapping code generation..."
        mono={false}
      />
    </div>
  );
};
