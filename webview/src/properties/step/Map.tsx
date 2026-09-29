/**
 * Map Properties Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Renders the property configuration panel for Apache Beam MapElements / Map transform steps.
 * Captures the mapping expression and the output data type, so the node is fully described by
 * its properties alone and needs no prose instructions.
 * 
 * Architectural Decisions:
 * - Map transforms apply a 1-to-1 transformation to each input element.
 * - The Mapping Function field carries a worked example in its placeholder
 *   (`element -> element.toUpperCase()`). That example is what makes the field usable: a Map
 *   step is by definition a self-contained one-liner, so a user can write it directly.
 *   NOTE: this field was briefly removed on the theory that users could not know what to type.
 *   It was restored because the example answers that, and because specifying the expression in
 *   a property is strictly less redundant than restating it in prose. Anything that genuinely
 *   cannot be expressed as a one-line expression is a ParDo, not a Map.
 * - Output type uses a SelectField of canonical Beam types rather than free text, and preserves
 *   custom persisted types dynamically to prevent silent data loss.
 * - Integrates InfoTooltip components explaining Map semantics.
 * - Code Generation Instructions remain available as an escape hatch, but are expected to be
 *   empty: the mapping expression and output type already fully specify the transform.
 */

import React from 'react';
import { PropertyField } from '../../components/common/PropertyField';
import { SelectField } from '../../components/common/SelectField';
import type { SelectFieldOption } from '../../components/common/SelectField';

export const MAP_OUTPUT_TYPE_OPTIONS: SelectFieldOption[] = [
  { value: '', label: 'Select output type…' },
  { value: 'String', label: 'String / str' },
  { value: 'Integer', label: 'Integer / int' },
  { value: 'Double', label: 'Double / float' },
  { value: 'Boolean', label: 'Boolean / bool' },
  { value: 'Map', label: 'Map / dict' },
  { value: 'TableRow', label: 'TableRow (BigQuery)' },
  { value: 'GenericRecord', label: 'GenericRecord (Avro)' },
  { value: 'Row', label: 'Row (Beam schema)' },
  { value: 'KV<String, String>', label: 'KV<String, String>' },
  { value: 'byte[]', label: 'byte[] / bytes' }
];

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

  // NOTE: Insert custom option directly after placeholder to prevent silent data loss
  // when an existing pipeline persisted an unknown custom class in outputType.
  const isCustomType = Boolean(
    outputType && !MAP_OUTPUT_TYPE_OPTIONS.some((opt) => opt.value === outputType)
  );
  const options: SelectFieldOption[] = isCustomType
    ? [
        MAP_OUTPUT_TYPE_OPTIONS[0],
        { value: outputType, label: `${outputType} (custom)` },
        ...MAP_OUTPUT_TYPE_OPTIONS.slice(1)
      ]
    : MAP_OUTPUT_TYPE_OPTIONS;

  /**
   * Handles input changes for property fields including output type select
   */
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    onChange({
      ...properties,
      [name]: value
    });
  };

  /**
   * Handles changes to code generation instructions
   */
  const handleInstructionsChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
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
        tooltip="One-line lambda or method reference applied to each element. A Map step is self-contained by definition; if the logic needs more than an expression, use a ParDo step instead."
        value={mappingFunction}
        onChange={handleChange}
        placeholder="e.g. element -> element.toUpperCase()"
      />

      {/* Output Data Type */}
      <SelectField
        id="mapOutputTypeSelect"
        name="outputType"
        label="Output Data Type"
        tooltip="Data type each element is converted into, used to emit the correct TypeDescriptor."
        value={outputType}
        options={options}
        onChange={handleChange}
      />

      <div className="text-xs text-slate-400 mt-1 leading-relaxed bg-slate-800/40 p-2.5 rounded border border-slate-700/50">
        Apply a 1-to-1 transformation to each input element.
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
        placeholder="Optional — only for edge cases the mapping expression cannot convey..."
        mono={false}
      />
    </div>
  );
};
