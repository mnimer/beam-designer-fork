/**
 * LogMessage Properties Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Renders the property configuration panel for Apache Beam LogMessage transform steps (logging elements via SLF4J/logging).
 * 
 * Architectural Decisions:
 * - Configures Log Level (Debug, Info, Warning, Error) and custom message format template.
 * - Integrates InfoTooltip components explaining logger severity levels.
 * - Provides Code Generation Instructions textarea for custom LLM prompts.
 */

import React from 'react';
import { InfoTooltip } from '../../components/InfoTooltip';

interface LogMessageNode {
  data: {
    label?: string;
    beam_transform?: string;
    system_instructions?: string;
    special_instructions?: string;
    properties?: {
      logLevel?: 'Debug' | 'Info' | 'Warning' | 'Error';
      logPrefix?: string;
      system_instructions?: string;
      special_instructions?: string;
      codeGenerationPrompt?: string;
      prompt?: string;
      [key: string]: any;
    };
  };
}

interface LogMessagePropertiesProps {
  node: LogMessageNode;
  onChange: (properties: any) => void;
}

export const LogMessageProperties: React.FC<LogMessagePropertiesProps> = ({ node, onChange }) => {
  const properties = node.data.properties || {};
  const logLevel = properties.logLevel || 'Info';
  const logPrefix = properties.logPrefix || '';

  const systemInstructions =
    node.data.system_instructions ??
    node.data.special_instructions ??
    properties.system_instructions ??
    properties.special_instructions ??
    '';

  // Handle input and select changes and propagate up
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    onChange({ ...properties, [e.target.name]: e.target.value });
  };

  const handleInstructionsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange({
      ...properties,
      system_instructions: e.target.value
    });
  };

  // Helper text based on selected log level
  const getHelperText = () => {
    switch (logLevel) {
      case 'Debug':
        return 'Output detailed debugging information, typically only useful in non-production environments.';
      case 'Info':
        return 'Informational messages highlighting pipeline progress and throughput metrics.';
      case 'Warning':
        return 'Indicate potential issues or unusual events that do not stop pipeline execution.';
      case 'Error':
        return 'Log critical errors indicating a failure or significant issue during processing.';
      default:
        return '';
    }
  };

  return (
    <div className="flex-1 flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label htmlFor="logLevelSelect" className="flex items-center text-xs font-bold uppercase text-slate-500">
          <span>Log Level</span>
          <InfoTooltip text="Severity level used by the logger (SLF4J in Java / logging in Python)." />
        </label>
        <select 
          id="logLevelSelect"
          name="logLevel" 
          value={logLevel} 
          onChange={handleChange} 
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
        >
          <option value="Debug">Debug</option>
          <option value="Info">Info</option>
          <option value="Warning">Warning</option>
          <option value="Error">Error</option>
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="logPrefixInput" className="flex items-center text-xs font-bold uppercase text-slate-500">
          <span>Log Message Prefix / Format</span>
          <InfoTooltip text="Custom message prefix or pattern prepended to each logged element (e.g. Processing record: )." />
        </label>
        <input
          id="logPrefixInput"
          type="text"
          name="logPrefix"
          value={logPrefix}
          onChange={handleChange}
          placeholder="e.g. Processing element: "
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
        />
      </div>

      {getHelperText() && (
        <div className="text-xs text-slate-400 mt-1 leading-relaxed bg-slate-800/40 p-2.5 rounded border border-slate-700/50">
          {getHelperText()}
        </div>
      )}

      {/* Flexible Spacer */}
      <div className="flex-1 min-h-4" />

      {/* Code Generation Instructions */}
      <div className="flex flex-col gap-2 pt-2 border-t border-slate-700/60">
        <label htmlFor="logSystemInstructions" className="text-xs font-bold uppercase text-slate-500">
          Code Generation Instructions
        </label>
        <textarea
          id="logSystemInstructions"
          name="system_instructions"
          value={systemInstructions}
          onChange={handleInstructionsChange}
          placeholder="Enter custom instructions for logging code generation..."
          rows={3}
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500 resize-y"
        />
      </div>
    </div>
  );
};
