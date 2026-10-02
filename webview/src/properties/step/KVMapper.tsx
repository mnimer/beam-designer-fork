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
import { SystemInstructionsField } from '../../components/common/SystemInstructionsField';
import { resolveSystemInstructions } from '../../utils/systemInstructions';

/**
 * React Flow node shape for the Key-Value Mapper step transform.
 */
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

/**
 * Props for the {@link KVMapperProperties} component.
 */
interface KVMapperPropertiesProps {
  node: KVMapperNode;
  onChange: (properties: any) => void;
}

/**
 * Property configuration panel for the Apache Beam Key-Value Mapper transform.
 *
 * @param props The selected KV mapper node and change notification callback.
 * @returns The rendered KV mapper properties panel.
 */
export const KVMapperProperties: React.FC<KVMapperPropertiesProps> = ({ node, onChange }) => {
  const properties = node.data.properties || {};
  const keyPropertyName = properties.keyPropertyName || '';
  const valuePropertyName = properties.valuePropertyName || '';

  const isKeyPropertyInvalid = !keyPropertyName.trim();

  // System instructions text with fallback
  const systemInstructions = resolveSystemInstructions(node);

  /**
   * Handles input changes for key and value property names
   */
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    onChange({ ...properties, [e.target.name]: e.target.value });
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

      {/* Code Generation Instructions */}
      <SystemInstructionsField
        id="kvSystemInstructions"
        value={systemInstructions}
        placeholder="Enter custom instructions for KV mapping code generation..."
        onChange={(value) =>
          onChange({
            ...properties,
            system_instructions: value,
          })
        }
      />
    </div>
  );
};
