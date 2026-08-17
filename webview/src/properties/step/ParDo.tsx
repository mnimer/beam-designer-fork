import React from 'react';

/**
 * ParDoProperties Component
 * 
 * Purpose:
 * Renders the property panel for the ParDo node in the Apache Beam Designer.
 * It provides a prompt textarea at the top for code generation, a detailed hint box,
 * and system instructions at the bottom separated by a vertical spacer.
 * 
 * Architectural Decisions:
 * - Code Generation Prompt is positioned at the top to prioritize user prompt input.
 * - Hint text instructs the user on specifying incoming message handling and output format.
 * - System instructions are pushed to the bottom using a flexible spacer.
 * - Defaults system instructions to "Wrap the generated code in a try/catch, returning all errors to a separate pcollection".
 */

interface ParDoNode {
  data: {
    system_instructions?: string;
    special_instructions?: string;
    beam_transform?: string;
    properties?: {
      codeGenerationPrompt?: string;
      prompt?: string;
      system_instructions?: string;
      special_instructions?: string;
      [key: string]: any;
    };
  };
}

interface ParDoPropertiesProps {
  node: ParDoNode;
  onChange: (properties: any) => void;
}

const DEFAULT_SYSTEM_INSTRUCTIONS = 'Wrap the generated code in a try/catch, returning all errors to a separate pcollection';

export const ParDoProperties: React.FC<ParDoPropertiesProps> = ({ node, onChange }) => {
  // Extract existing properties or fallback to empty object
  const properties = node.data.properties || {};

  // Code generation prompt text
  const codeGenerationPrompt =
    properties.codeGenerationPrompt ?? properties.prompt ?? '';

  // System instructions text with default fallback
  const systemInstructions =
    node.data.system_instructions ??
    node.data.special_instructions ??
    properties.system_instructions ??
    properties.special_instructions ??
    DEFAULT_SYSTEM_INSTRUCTIONS;

  /**
   * Handle changes to the Code Generation Prompt textarea
   * Updates prompt property and preserves system instructions
   */
  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    // Get updated prompt text from event
    const newPrompt = e.target.value;

    // Propagate changes up to parent component
    onChange({
      ...properties,
      codeGenerationPrompt: newPrompt,
      system_instructions: systemInstructions,
    });
  };

  /**
   * Handle changes to the System Instructions textarea
   * Updates system_instructions property and preserves code generation prompt
   */
  const handleInstructionsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    // Get updated system instructions text from event
    const newInstructions = e.target.value;

    // Propagate changes up to parent component
    onChange({
      ...properties,
      codeGenerationPrompt,
      system_instructions: newInstructions,
    });
  };

  return (
    <div className="flex-1 flex flex-col gap-4">
      {/* Code Generation Prompt Section at Top */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-bold uppercase text-slate-500">
          Code Generation Prompt
        </label>
        <textarea
          name="codeGenerationPrompt"
          value={codeGenerationPrompt}
          onChange={handlePromptChange}
          placeholder="Enter instructions for code generation..."
          rows={4}
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500 resize-y"
        />
        <div className="text-xs text-slate-400 mt-1 leading-relaxed bg-slate-800/40 p-2.5 rounded border border-slate-700/50">
          Note: Write instructions that cover what should happen to the incoming messages and what the output format should be.
        </div>
      </div>

      {/* Flexible Spacer taking up all free space to bottom-align System Instructions */}
      <div className="flex-1" />

      {/* System Instructions Section at Bottom */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-bold uppercase text-slate-500">
          System Instructions
        </label>
        <textarea
          name="system_instructions"
          value={systemInstructions}
          onChange={handleInstructionsChange}
          placeholder="Enter system instructions..."
          rows={3}
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500 resize-y"
        />
      </div>
    </div>
  );
};
