/**
 * OtherProperties Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Renders the property configuration panel for Apache Beam general transforms (Flatten, Reshuffle).
 * 
 * Architectural Decisions:
 * - Provides context-aware descriptions for Flatten and ReShuffle transforms.
 * - Integrates InfoTooltip components and Code Generation Instructions textarea.
 */

import React from 'react';
import { InfoTooltip } from '../../components/InfoTooltip';
import { PropertyField } from '../../components/common/PropertyField';

interface OtherNode {
  data: {
    label: string;
    beam_transform?: string;
    system_instructions?: string;
    special_instructions?: string;
    properties?: {
      system_instructions?: string;
      special_instructions?: string;
      codeGenerationPrompt?: string;
      prompt?: string;
      [key: string]: any;
    };
  };
}

interface OtherPropertiesProps {
  node: OtherNode;
  onChange: (properties: any) => void;
}

const DESCRIPTIONS: Record<string, string> = {
  'Flatten': 'Merges multiple PCollection objects of the same type into a single logical PCollection.',
  'ReShuffle': 'Redistributes elements across workers by assigning temporary random keys to break fusion and balance load.',
  'Reshuffle': 'Redistributes elements across workers by assigning temporary random keys to break fusion and balance load.'
};

export const OtherProperties: React.FC<OtherPropertiesProps> = ({ node, onChange }) => {
  const transform = node.data.beam_transform || node.data.label;
  const label = node.data.label;
  const description = DESCRIPTIONS[transform] || DESCRIPTIONS[label] || 'Transform properties are currently empty.';
  const properties = node.data.properties || {};

  const systemInstructions =
    node.data.system_instructions ??
    node.data.special_instructions ??
    properties.system_instructions ??
    properties.special_instructions ??
    '';

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
      <div className="text-sm text-slate-400 bg-slate-800/40 p-3 rounded border border-slate-700/50">
        <div className="font-semibold text-slate-300 mb-1 flex items-center">
          <span>{label}</span>
          <InfoTooltip text={description} />
        </div>
        {description}
      </div>

      {/* Flexible Spacer */}
      <div className="flex-1 min-h-4" />

      {/* Code Generation Instructions */}
      <PropertyField
        id="otherSystemInstructions"
        name="system_instructions"
        label="Code Generation Instructions"
        containerClassName="flex flex-col gap-2 pt-2 border-t border-slate-700/60"
        type="textarea"
        rows={3}
        value={systemInstructions}
        onChange={handleInstructionsChange}
        placeholder={`Enter custom instructions for ${label} code generation...`}
        mono={false}
      />
    </div>
  );
};
