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
import { SystemInstructionsField } from '../../components/common/SystemInstructionsField';
import { resolveSystemInstructions } from '../../utils/systemInstructions';
import {
  DEFAULT_BEAM_TRANSFORMS_DOCS_URL,
  getNodeDocumentation,
  openNodeDocs,
} from '../../utils/nodeDocumentation';

/**
 * React Flow node shape for utility step transforms (Flatten, Reshuffle, Keys, Values, etc.).
 */
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

/**
 * Props for the {@link OtherProperties} component.
 */
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

/**
 * Property configuration panel for auxiliary Apache Beam transforms (Flatten, Reshuffle, Keys, etc.).
 *
 * @param props The selected node and change notification callback.
 * @returns The rendered transform properties panel.
 */
export const OtherProperties: React.FC<OtherPropertiesProps> = ({ node, onChange }) => {
  const transform = node.data.beam_transform || node.data.label;
  const label = node.data.label;
  const description = DESCRIPTIONS[transform] || DESCRIPTIONS[label] || 'Transform properties are currently empty.';
  const doc = getNodeDocumentation(node);
  const docsUrl = doc?.docsUrl ?? DEFAULT_BEAM_TRANSFORMS_DOCS_URL;
  const properties = node.data.properties || {};

  const systemInstructions = resolveSystemInstructions(node);

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

      {/* Code Generation Instructions */}
      <SystemInstructionsField
        id="otherSystemInstructions"
        value={systemInstructions}
        placeholder={`Enter custom instructions for ${label} code generation...`}
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
