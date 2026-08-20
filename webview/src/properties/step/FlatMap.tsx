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

interface FlatMapPropertiesProps {
  node: FlatMapNode;
  onChange: (properties: any) => void;
}

export const FlatMapProperties: React.FC<FlatMapPropertiesProps> = ({ node, onChange }) => {
  const properties = node.data.properties || {};
  const splitVia = properties.splitVia || '';
  const delimiter = properties.delimiter !== undefined ? properties.delimiter : ',';
  const regexPattern = properties.regexPattern !== undefined ? properties.regexPattern : '';

  const isDelimiterInvalid = splitVia === 'Token' && !delimiter;
  const isRegexInvalid = splitVia === 'Regex' && !regexPattern.trim();

  const systemInstructions =
    node.data.system_instructions ??
    node.data.special_instructions ??
    properties.system_instructions ??
    properties.special_instructions ??
    '';

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

  const handleDelimiterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDelimiter = e.target.value;
    onChange({
      ...properties,
      splitVia,
      delimiter: newDelimiter,
      regexPattern,
      system_instructions: systemInstructions,
    });
  };

  const handleRegexPatternChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newRegex = e.target.value;
    onChange({
      ...properties,
      splitVia,
      delimiter,
      regexPattern: newRegex,
      system_instructions: systemInstructions,
    });
  };

  const handleInstructionsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange({
      ...properties,
      splitVia,
      delimiter,
      regexPattern,
      system_instructions: e.target.value,
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
        <div className="flex flex-col gap-2">
          <label htmlFor="flatMapDelimiter" className="flex items-center text-xs font-bold uppercase text-slate-500">
            <span>Token / Delimiter</span>
            <span className="text-red-400 ml-1 font-bold" title="Required">*</span>
            <InfoTooltip text="Single character delimiter used to split elements (e.g. comma, tab, space). Required." />
          </label>
          <input
            id="flatMapDelimiter"
            type="text"
            name="delimiter"
            aria-required="true"
            aria-invalid={isDelimiterInvalid}
            value={delimiter}
            onChange={handleDelimiterChange}
            maxLength={1}
            placeholder=","
            className={`bg-[#252836] text-white p-2 rounded border text-sm focus:outline-none w-24 text-center font-mono ${
              isDelimiterInvalid
                ? 'border-red-500/80 focus:border-red-500'
                : 'border-slate-700 focus:border-blue-500'
            }`}
          />
          {isDelimiterInvalid && (
            <span className="text-xs text-red-400">Delimiter is required.</span>
          )}
        </div>
      )}

      {/* Conditional Regex Field */}
      {splitVia === 'Regex' && (
        <div className="flex flex-col gap-2">
          <label htmlFor="flatMapRegexPattern" className="flex items-center text-xs font-bold uppercase text-slate-500">
            <span>Regex Expression</span>
            <span className="text-red-400 ml-1 font-bold" title="Required">*</span>
            <InfoTooltip text="Regular expression pattern to extract tokens from each element (e.g. [A-Za-z]+). Required." />
          </label>
          <input
            id="flatMapRegexPattern"
            type="text"
            name="regexPattern"
            aria-required="true"
            aria-invalid={isRegexInvalid}
            value={regexPattern}
            onChange={handleRegexPatternChange}
            placeholder="e.g. [A-Za-z]+"
            className={`bg-[#252836] text-white p-2 rounded border text-sm focus:outline-none font-mono ${
              isRegexInvalid
                ? 'border-red-500/80 focus:border-red-500'
                : 'border-slate-700 focus:border-blue-500'
            }`}
          />
          {isRegexInvalid && (
            <span className="text-xs text-red-400">Regex pattern is required.</span>
          )}
        </div>
      )}

      <div className="text-xs text-slate-400 mt-1 leading-relaxed bg-slate-800/40 p-2.5 rounded border border-slate-700/50">
        Map single input elements to 0 or more output elements (e.g. splitting strings or flattening arrays).
      </div>

      {/* Flexible Spacer taking up all free space to bottom-align Code Generation Instructions */}
      <div className="flex-1 min-h-4" />

      <div className="flex flex-col gap-2 pt-2 border-t border-slate-700/60">
        <label htmlFor="flatMapSystemInstructions" className="text-xs font-bold uppercase text-slate-500">
          Code Generation Instructions
        </label>
        <textarea
          id="flatMapSystemInstructions"
          name="system_instructions"
          value={systemInstructions}
          onChange={handleInstructionsChange}
          placeholder="Enter code generation instructions for FlatMap..."
          rows={3}
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500 resize-y"
        />
      </div>
    </div>
  );
};
