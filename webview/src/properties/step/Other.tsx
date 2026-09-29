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
import {
  DEFAULT_BEAM_TRANSFORMS_DOCS_URL,
  getNodeDocumentation,
  openNodeDocs,
} from '../../utils/nodeDocumentation';

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
  'Reshuffle': 'Redistributes elements across workers by assigning temporary random keys to break fusion and balance load.',
  'Keys': 'Extracts the key from each KV<K, V> element in a PCollection.',
  'KvSwap': 'Swaps the key and value of each KV<K, V> element to produce KV<V, K>.',
  'KV Swap': 'Swaps the key and value of each KV<K, V> element to produce KV<V, K>.',
  'ToString': 'Converts every element, key-value pair, or iterable in a PCollection to its String representation.',
  'To String': 'Converts every element, key-value pair, or iterable in a PCollection to its String representation.',
  'Values': 'Extracts the value from each KV<K, V> element in a PCollection.',
};

export const OtherProperties: React.FC<OtherPropertiesProps> = ({ node, onChange }) => {
  const transform = node.data.beam_transform || node.data.label;
  const label = node.data.label;
  const description = DESCRIPTIONS[transform] || DESCRIPTIONS[label] || 'Transform properties are currently empty.';
  const doc = getNodeDocumentation(node);
  const docsUrl = doc?.docsUrl ?? DEFAULT_BEAM_TRANSFORMS_DOCS_URL;
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
      <div className="flex flex-col gap-1.5 p-2.5 rounded bg-slate-800/40 border border-slate-700/60 text-xs text-slate-300">
        <div className="flex items-center justify-between gap-2">
          <div className="font-semibold text-slate-200 flex items-center">
            <span>{label}</span>
            <InfoTooltip text={description} />
          </div>
          <button
            type="button"
            onClick={() => openNodeDocs(docsUrl)}
            aria-label={`Open ${label} documentation`}
            className="text-blue-400 hover:text-blue-300 font-semibold cursor-pointer shrink-0"
          >
            Docs ↗
          </button>
        </div>
        <p className="text-slate-400">{description}</p>
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
