/**
 * CreateIO Properties Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Renders property editor for Apache Beam in-memory Create transform (beam.Create / Create.of).
 * 
 * Architectural Decisions:
 * - Requires at least one non-empty element for valid PCollection generation.
 * - Integrates InfoTooltip explaining Create.of in-memory semantics.
 * - Provides dynamic add/remove rows for test elements.
 * - Includes Code Generation Instructions textarea for custom LLM prompts.
 */

import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { InfoTooltip } from '../../components/InfoTooltip';
import { PropertyField } from '../../components/common/PropertyField';

interface CreatePropertiesProps {
  node: any;
  onChange: (properties: any) => void;
}

export const CreateProperties: React.FC<CreatePropertiesProps> = ({ node, onChange }) => {
  const properties = node.data.properties || {};
  const elements: string[] = properties.elements || [''];

  const isInvalid = elements.length === 0 || elements.every(el => !el.trim());

  // System instructions text with fallback
  const systemInstructions =
    node.data.system_instructions ??
    node.data.special_instructions ??
    properties.system_instructions ??
    properties.special_instructions ??
    '';

  const updateElements = (newElements: string[]) => {
    onChange({ ...properties, elements: newElements });
  };

  const handleElementChange = (index: number, value: string) => {
    const newElements = [...elements];
    newElements[index] = value;
    updateElements(newElements);
  };

  const addElement = () => {
    updateElements([...elements, '']);
  };

  const removeElement = (index: number) => {
    if (elements.length === 1) {
      updateElements(['']);
    } else {
      updateElements(elements.filter((_, i) => i !== index));
    }
  };

  const handleInstructionsChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    onChange({
      ...properties,
      system_instructions: e.target.value
    });
  };

  return (
    <div className="flex-1 flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <label className="flex items-center text-xs font-bold uppercase text-slate-500">
          <span>In-Memory Elements</span>
          <span className="text-red-400 ml-1 font-bold" title="Required">*</span>
          <InfoTooltip text="Elements to instantiate directly in memory into a PCollection (via Create.of() / beam.Create()). At least one element required." />
        </label>
      </div>

      <div className="flex flex-col gap-3 max-h-[400px] overflow-y-auto pr-1">
        {elements.map((element, index) => {
          const isRowEmpty = !element.trim();
          return (
            <div
              key={index}
              className={`flex gap-2 items-start bg-slate-800/40 p-2 rounded border ${
                isInvalid && isRowEmpty
                  ? 'border-red-500/80'
                  : 'border-slate-700/50'
              }`}
            >
              <textarea
                value={element}
                aria-required="true"
                aria-invalid={isInvalid && isRowEmpty}
                onChange={(e) => handleElementChange(index, e.target.value)}
                placeholder={`Element ${index + 1} (text, number, json...)`}
                rows={1}
                className={`flex-1 bg-[#252836] text-white p-2 rounded border text-sm font-mono resize-y focus:outline-none ${
                  isInvalid && isRowEmpty
                    ? 'border-red-500/80 focus:border-red-500'
                    : 'border-slate-700 focus:border-blue-500'
                }`}
              />
              <button
                type="button"
                onClick={() => removeElement(index)}
                className="text-red-400 hover:text-red-300 hover:bg-red-950/30 p-1.5 rounded transition-all self-center"
                title="Remove Element"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>

      {isInvalid && (
        <span className="text-xs text-red-400">At least one non-empty element is required.</span>
      )}

      <button
        type="button"
        onClick={addElement}
        className="flex items-center justify-center gap-1 text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded transition-colors font-semibold w-full mt-1"
      >
        <Plus className="w-3.5 h-3.5" /> Add Item
      </button>

      <span className="text-xs text-slate-400 font-medium">
        These elements will be created directly in memory as a PCollection (e.g. via beam.Create).
      </span>

      {/* Flexible Spacer */}
      <div className="flex-1 min-h-4" />

      {/* Code Generation Instructions */}
      <div className="flex flex-col gap-2 pt-2 border-t border-slate-700/60">
        <PropertyField
          id="createSystemInstructions"
          name="system_instructions"
          label="Code Generation Instructions"
          type="textarea"
          value={systemInstructions}
          onChange={handleInstructionsChange}
          placeholder="Enter custom instructions for Create.of() code generation..."
          rows={3}
          mono={false}
        />
      </div>
    </div>
  );
};
