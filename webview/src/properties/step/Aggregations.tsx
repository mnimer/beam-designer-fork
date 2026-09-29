/**
 * Aggregation Properties Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Renders the property configuration panel for Apache Beam aggregation transform steps
 * (Combine, Count, Distinct, GroupByKey, GroupIntoBatches, Min, Max, Mean, Sum, Top, etc.).
 * 
 * Architectural Decisions:
 * - Provides context-aware Beam descriptions for each aggregation transform.
 * - Integrates InfoTooltip components and Code Generation Instructions textarea.
 */

import React from 'react';
import { PropertyField } from '../../components/common/PropertyField';
import {
  DEFAULT_BEAM_TRANSFORMS_DOCS_URL,
  getNodeDocumentation,
  openNodeDocs,
} from '../../utils/nodeDocumentation';

interface AggregationNode {
  data: {
    label: string;
    beam_transform?: string;
    system_instructions?: string;
    special_instructions?: string;
    properties?: {
      batchSize?: string | number;
      system_instructions?: string;
      special_instructions?: string;
      codeGenerationPrompt?: string;
      prompt?: string;
      [key: string]: any;
    };
  };
}

interface AggregationPropertiesProps {
  node: AggregationNode;
  onChange: (properties: any) => void;
}

const DESCRIPTIONS: Record<string, string> = {
  'Approximate Quantiles': 'Computes approximate quantiles of the elements in a collection.',
  'ApproximateQuantiles': 'Computes approximate quantiles of the elements in a collection.',
  'Approximate Unique': 'Estimates the number of unique elements in a collection.',
  'ApproximateUnique': 'Estimates the number of unique elements in a collection.',
  'Co Group By Key': 'Groups results from multiple collections by their common keys.',
  'CoGroupByKey': 'Groups results from multiple collections by their common keys.',
  'Combine': 'Combines elements in a collection using a global combine function.',
  'Combine With Context': 'Combines elements in a collection using side inputs or contextual state.',
  'CombineWithContext': 'Combines elements in a collection using side inputs or contextual state.',
  'Count': 'Counts the number of elements in a collection.',
  'Distinct': 'Removes duplicate elements from a collection.',
  'Group By Key': 'Groups key-value pairs by their keys.',
  'GroupByKey': 'Groups key-value pairs by their keys.',
  'Group Into Batches': 'Groups elements into batches of a specified size or duration.',
  'GroupIntoBatches': 'Groups elements into batches of a specified size or duration.',
  'Batch Elements': 'Batches elements into smaller groups for downstream processing.',
  'BatchElements': 'Batches elements into smaller groups for downstream processing.',
  'Latest': 'Obtains the latest element or value according to timestamps.',
  'Max': 'Computes the maximum element or value in a collection.',
  'Mean': 'Computes the arithmetic mean of elements in a collection.',
  'Min': 'Computes the minimum element or value in a collection.',
  'Sample': 'Takes a random sample of elements from a collection.',
  'Sum': 'Computes the sum of elements in a collection.',
  'Top': 'Finds the top elements in a collection according to a comparator.',
};

export const AggregationProperties: React.FC<AggregationPropertiesProps> = ({ node, onChange }) => {
  const transform = node.data.beam_transform || node.data.label;
  const label = node.data.label;
  const description = DESCRIPTIONS[transform] || DESCRIPTIONS[label] || 'Aggregation properties are currently empty.';
  const doc = getNodeDocumentation(node);
  const docsUrl = doc?.docsUrl ?? DEFAULT_BEAM_TRANSFORMS_DOCS_URL;
  const properties = node.data.properties || {};
  const isBatchNode = label === 'Group Into Batches' || label === 'Batch Elements' || transform === 'GroupIntoBatches' || transform === 'BatchElements';
  const batchSize = properties.batchSize ?? '';

  const systemInstructions =
    node.data.system_instructions ??
    node.data.special_instructions ??
    properties.system_instructions ??
    properties.special_instructions ??
    '';

  /**
   * Handles input changes for batch size
   */
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    onChange({
      ...properties,
      [e.target.name]: e.target.value
    });
  };

  /**
   * Handles changes for system instructions textarea
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
          <span className="font-semibold text-slate-200">{label}</span>
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

      {isBatchNode && (
        <PropertyField
          id="aggBatchSize"
          type="number"
          name="batchSize"
          label="Batch Size (.ofSize)"
          tooltip="Maximum number of elements in each batch."
          min="1"
          value={batchSize}
          onChange={handleChange}
          placeholder="e.g. 100"
        />
      )}

      {/* Flexible Spacer */}
      <div className="flex-1 min-h-4" />

      {/* Code Generation Instructions */}
      <PropertyField
        id="aggSystemInstructions"
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
