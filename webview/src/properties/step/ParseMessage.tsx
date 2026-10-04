/**
 * ParseMessage Properties Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Renders the property configuration panel for Apache Beam payload parsing steps (JSON, Base64, String decoding).
 * 
 * Architectural Decisions:
 * - Configures format decoder strategy for incoming raw messages.
 * - Integrates InfoTooltip components explaining payload serialization formats.
 * - Provides Code Generation Instructions textarea for custom LLM prompts.
 */

import React from 'react';
import { InfoTooltip } from '../../components/InfoTooltip';
import { SystemInstructionsField } from '../../components/common/SystemInstructionsField';
import { resolveSystemInstructions } from '../../utils/systemInstructions';

/**
 * React Flow node shape for the Parse Message step transform.
 */
interface ParseMessageNode {
  data: {
    label?: string;
    beam_transform?: string;
    system_instructions?: string;
    special_instructions?: string;
    properties?: {
      messageType?: 'JSON' | 'Base64' | 'String';
      system_instructions?: string;
      special_instructions?: string;
      codeGenerationPrompt?: string;
      prompt?: string;
      [key: string]: any;
    };
  };
}

/**
 * Props for the {@link ParseMessageProperties} component.
 */
interface ParseMessagePropertiesProps {
  node: ParseMessageNode;
  onChange: (properties: any) => void;
}

/**
 * Property configuration panel for the Apache Beam Parse Message payload decoding transform.
 *
 * @param props The selected parse message node and change notification callback.
 * @returns The rendered parse message properties panel.
 */
export const ParseMessageProperties: React.FC<ParseMessagePropertiesProps> = ({ node, onChange }) => {
  const properties = node.data.properties || {};
  const messageType = properties.messageType || 'JSON';
  const systemInstructions = resolveSystemInstructions(node);

  /**
   * Handles select or textarea changes and propagates up
   */
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    onChange({ ...properties, [name]: value });
  };

  /**
   * Returns contextual helper text based on selected message payload decoder type
   */
  const getHelperText = () => {
    switch (messageType) {
      case 'JSON':
        return 'Parse JSON message payloads and convert them to structured Java Beans, Row, or Map / Dict formats.';
      case 'Base64':
        return 'Decode Base64 encoded byte payloads into raw binary or UTF-8 text.';
      case 'String':
        return 'Decode message payload bytes into UTF-8 Strings.';
      default:
        return '';
    }
  };

  return (
    <div className="flex-1 flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label htmlFor="parseMessageTypeSelect" className="flex items-center text-xs font-bold uppercase text-slate-500">
          <span>Message Type</span>
          <InfoTooltip text="Payload format of the incoming byte/string message to parse (JSON, Base64, or String)." />
        </label>
        <select 
          id="parseMessageTypeSelect"
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

      {/* Code Generation Instructions */}
      <SystemInstructionsField
        id="parseMessageSystemInstructions"
        value={systemInstructions}
        placeholder="Enter code generation instructions for message parsing..."
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

