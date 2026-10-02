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
import { SystemInstructionsField } from '../../components/common/SystemInstructionsField';
import { resolveSystemInstructions } from '../../utils/systemInstructions';

/** Props for the {@link CreateProperties} component. */
interface CreatePropertiesProps {
  node: any;
  onChange: (properties: any) => void;
}

/**
 * Normalizes raw elements from node properties into a typed string array.
 * Handles:
 * - JSON-stringified arrays (e.g. `'["{\\"id\\": 1}", "{\\"id\\": 2}"]'` or `'["record-1", "record-2"]'`)
 * - Stringified primitives or single strings
 * - Arrays of objects, numbers, booleans, or strings
 * - Undefined, null, or empty values
 */
export function normalizeElements(raw: any): string[] {
  if (Array.isArray(raw)) {
    if (raw.length === 0) {
      return [''];
    }
    return raw.map((el) => {
      if (typeof el === 'string') {
        return el;
      }
      if (typeof el === 'object' && el !== null) {
        try {
          return JSON.stringify(el);
        } catch {
          return String(el);
        }
      }
      return String(el ?? '');
    });
  }

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) {
      return [''];
    }
    // Check if the string represents a JSON array
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return normalizeElements(parsed);
        }
      } catch {
        // Not a valid JSON array, treat as raw single string
      }
    }
    return [raw];
  }

  if (raw !== undefined && raw !== null) {
    return [String(raw)];
  }

  return [''];
}

/**
 * Dedicated property panel for the Create (in-memory collection) source node. Configures static elements to inject into the pipeline.
 *
 * @param props The selected node and the onChange callback used to persist edits.
 */
export const CreateProperties: React.FC<CreatePropertiesProps> = ({ node, onChange }) => {
  const properties = node?.data?.properties || {};
  const elements: string[] = normalizeElements(properties.elements);

  const isInvalid = elements.length === 0 || elements.every(el => typeof el !== 'string' || !el.trim());

  // System instructions text with fallback
  const systemInstructions = resolveSystemInstructions(node);

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
    if (elements.length <= 1) {
      updateElements(['']);
    } else {
      updateElements(elements.filter((_, i) => i !== index));
    }
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

      {/* Code Generation Instructions */}
      <SystemInstructionsField
        id="createSystemInstructions"
        value={systemInstructions}
        placeholder="Enter custom instructions for Create.of() code generation..."
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
