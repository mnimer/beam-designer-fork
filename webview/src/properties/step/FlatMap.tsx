/**
 * FlatMap Properties Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Renders the property configuration panel for Apache Beam FlatMap transform steps (FlatMapElements / FlatMap).
 * 
 * Architectural Decisions:
 * - In Apache Beam, FlatMap produces 0 or more elements per input element.
 * - When splitVia is 'Token', delimiter is required.
 * - When splitVia is 'Regex', regexPattern is required.
 * - Enforces required validation, visual error feedback, and aria attributes.
 * - Integrates InfoTooltip components explaining element splitting and mapping mechanics.
 * - Provides Code Generation Instructions textarea for custom LLM prompts.
 */

import React from 'react';
import { InfoTooltip } from '../../components/InfoTooltip';
import { PropertyField } from '../../components/common/PropertyField';
import { SystemInstructionsField } from '../../components/common/SystemInstructionsField';
import { resolveSystemInstructions } from '../../utils/systemInstructions';

/**
 * React Flow node shape for the FlatMap step transform.
 */
interface FlatMapNode {
  data: {
    system_instructions?: string;
    special_instructions?: string;
    properties?: {
      splitVia?: '' | 'Token' | 'Regex';
      delimiter?: string;
      regexPattern?: string;
      system_instructions?: string;
      special_instructions?: string;
      codeGenerationPrompt?: string;
      prompt?: string;
      [key: string]: any;
    };
  };
}

/**
 * Props for the {@link FlatMapProperties} component.
 */
interface FlatMapPropertiesProps {
  node: FlatMapNode;
  onChange: (properties: any) => void;
}

/**
 * Property configuration panel for the Apache Beam FlatMap one-to-many transform.
 *
 * @param props The selected flat map node and change notification callback.
 * @returns The rendered flat map properties panel.
 */
export const FlatMapProperties: React.FC<FlatMapPropertiesProps> = ({ node, onChange }) => {
  const properties = node.data.properties || {};
  const splitVia = properties.splitVia || '';
  const delimiter = properties.delimiter !== undefined ? properties.delimiter : ',';
  const regexPattern = properties.regexPattern !== undefined ? properties.regexPattern : '';

  const isDelimiterInvalid = splitVia === 'Token' && !delimiter;
  const isRegexInvalid = splitVia === 'Regex' && !regexPattern.trim();

  const systemInstructions = resolveSystemInstructions(node);

  /**
   * Handles changes to the split via strategy dropdown
   */
  const handleSplitViaChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newSplitVia = e.target.value as '' | 'Token' | 'Regex';
    onChange({
      ...properties,
      splitVia: newSplitVia,
      delimiter,
      regexPattern,
      system_instructions: systemInstructions,
    });
  };

  /**
   * Handles changes to the single character delimiter input
   */
  const handleDelimiterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const newDelimiter = e.target.value;
    onChange({
      ...properties,
      splitVia,
      delimiter: newDelimiter,
      regexPattern,
      system_instructions: systemInstructions,
    });
  };

  /**
   * Handles changes to the regex pattern input
   */
  const handleRegexPatternChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const newRegex = e.target.value;
    onChange({
      ...properties,
      splitVia,
      delimiter,
      regexPattern: newRegex,
      system_instructions: systemInstructions,
    });
  };

  return (
    <div className="flex-1 flex flex-col gap-4">
      {/* Split via Dropdown */}
      <div className="flex flex-col gap-2">
        <label htmlFor="flatMapSplitVia" className="flex items-center text-xs font-bold uppercase text-slate-500">
          <span>Split via</span>
          <InfoTooltip text="Preset strategy for mapping each string element into multiple tokens: delimiter-based Token or regular expression Regex." />
        </label>
        <select
          id="flatMapSplitVia"
          name="splitVia"
          value={splitVia}
          onChange={handleSplitViaChange}
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
        >
          <option value=""></option>
          <option value="Token">Token</option>
          <option value="Regex">Regex</option>
        </select>
      </div>

      {/* Conditional Token Field */}
      {splitVia === 'Token' && (
        <PropertyField
          id="flatMapDelimiter"
          name="delimiter"
          label="Token / Delimiter"
          required="Required"
          tooltip="Single character delimiter used to split elements (e.g. comma, tab, space). Required."
          invalid={isDelimiterInvalid}
          error={isDelimiterInvalid ? 'Delimiter is required.' : null}
          value={delimiter}
          onChange={handleDelimiterChange}
          maxLength={1}
          placeholder=","
          className="w-24 text-center font-mono"
        />
      )}

      {/* Conditional Regex Field */}
      {splitVia === 'Regex' && (
        <PropertyField
          id="flatMapRegexPattern"
          name="regexPattern"
          label="Regex Expression"
          required="Required"
          tooltip="Regular expression pattern to extract tokens from each element (e.g. [A-Za-z]+). Required."
          invalid={isRegexInvalid}
          error={isRegexInvalid ? 'Regex pattern is required.' : null}
          value={regexPattern}
          onChange={handleRegexPatternChange}
          placeholder="e.g. [A-Za-z]+"
        />
      )}

      <div className="text-xs text-slate-400 mt-1 leading-relaxed bg-slate-800/40 p-2.5 rounded border border-slate-700/50">
        Map single input elements to 0 or more output elements (e.g. splitting strings or flattening arrays).
      </div>

      <SystemInstructionsField
        id="flatMapSystemInstructions"
        value={systemInstructions}
        placeholder="Enter code generation instructions for FlatMap..."
        onChange={(value) =>
          onChange({
            ...properties,
            splitVia,
            delimiter,
            regexPattern,
            system_instructions: value,
          })
        }
      />
    </div>
  );
};
