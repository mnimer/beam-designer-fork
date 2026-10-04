/**
 * ParDoProperties Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Renders the property configuration panel for Apache Beam ParDo transform steps (ParDo.of(DoFn)).
 * It provides a header bar with a documentation link, a prompt textarea at the top for code
 * generation, a detailed hint box, a Side Inputs configuration section (F1), and system
 * instructions at the bottom separated by a vertical spacer.
 * 
 * Architectural Decisions:
 * - Code Generation Prompt is positioned at the top to prioritize user prompt input.
 * - Hint text instructs the user on specifying incoming message handling and output format.
 * - System instructions are pushed to the bottom using a flexible spacer.
 * - Defaults system instructions to "Wrap the generated code in a try/catch, returning all errors to a separate pcollection".
 * - Integrates InfoTooltip components explaining DoFn execution model and error handling.
 * - Side Inputs (F1): the `sideInputs` array in `node.data.properties` is auto-synchronised by
 *   `usePipelineGraph` from edges connected to the `side_input` handle, so this panel never adds or
 *   removes bindings itself — it only edits the per-binding configuration (`variableName`, `viewType`,
 *   `hasDefaultValue`/`defaultValue` for `SINGLETON`, `refreshPattern`, `updateIntervalSeconds`).
 *   All option values mirror the official Beam side input documentation; nothing is invented.
 */

import React from 'react';
import { PropertyField } from '../../components/common/PropertyField';
import { SelectField } from '../../components/common/SelectField';
import { SystemInstructionsField } from '../../components/common/SystemInstructionsField';
import { ExternalDocsLink } from '../../components/common/ExternalDocsLink';
import { InfoTooltip } from '../../components/InfoTooltip';
import { getNodeDocumentation } from '../../utils/nodeDocumentation';
import {
  SIDE_INPUT_DOCS_URL,
  SIDE_INPUT_VIEW_TYPES,
  SIDE_INPUT_REFRESH_PATTERNS,
  DEFAULT_SIDE_INPUT_UPDATE_INTERVAL_SECONDS,
  normalizeSideInputBindings,
  type SideInputBinding,
  type SideInputViewType,
  type SideInputRefreshPattern,
} from '../../../../src/shared/sideInputs';

/**
 * React Flow node shape for the ParDo step transform.
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
      /** Persisted bindings; accepted as `unknown` and normalised because YAML may be hand-edited. */
      sideInputs?: SideInputBinding[] | unknown;
      [key: string]: unknown;
    };
  };
}

/**
 * Props for the {@link ParDoProperties} component.
 */
interface ParDoPropertiesProps {
  node: ParDoNode;
  onChange: (properties: Record<string, unknown>) => void;
}

const DEFAULT_SYSTEM_INSTRUCTIONS = 'Wrap the generated code in a try/catch, returning all errors to a separate pcollection';

/** Human-readable labels and SDK mappings for each documented view type. */
const VIEW_TYPE_OPTIONS: { value: SideInputViewType; label: string }[] = [
  { value: 'SINGLETON', label: 'SINGLETON — View.asSingleton() / AsSingleton' },
  { value: 'ITERABLE', label: 'ITERABLE — View.asIterable() / AsIter' },
  { value: 'LIST', label: 'LIST — View.asList() / AsList' },
  { value: 'MAP', label: 'MAP — View.asMap() / AsDict' },
  { value: 'MULTIMAP', label: 'MULTIMAP — View.asMultimap() / GroupByKey + AsDict' },
];

/** Human-readable labels for each documented refresh pattern. */
const REFRESH_PATTERN_OPTIONS: { value: SideInputRefreshPattern; label: string }[] = [
  { value: 'STATIC', label: 'STATIC — bounded / window-matched' },
  { value: 'SLOWLY_UPDATING_GLOBAL_WINDOW', label: 'SLOWLY_UPDATING_GLOBAL_WINDOW — Pattern 1' },
  { value: 'SLOWLY_UPDATING_WINDOWED', label: 'SLOWLY_UPDATING_WINDOWED — Pattern 2 (PeriodicImpulse)' },
];

const VIEW_TYPE_TOOLTIP =
  'SINGLETON: exactly one element per window (errors on >1; supports a default when empty). ' +
  'ITERABLE: lazy sequential access, preferred over LIST when the view is large because LIST materialises every element into worker memory. ' +
  'MAP / MULTIMAP: require KV<K, V> (Java) or (key, value) 2-tuples (Python); MAP needs unique keys per window, MULTIMAP groups duplicate keys into Map<K, Iterable<V>>.';

const REFRESH_PATTERN_TOOLTIP =
  'STATIC: the upstream PCollection is converted directly into a view (Beam projects a GlobalWindow view into every main-input window). ' +
  'SLOWLY_UPDATING_GLOBAL_WINDOW (Pattern 1): GenerateSequence/PeriodicImpulse → GlobalWindows + Repeatedly(AfterProcessingTime) + discarding panes so the latest firing overwrites the view. ' +
  'SLOWLY_UPDATING_WINDOWED (Pattern 2): PeriodicImpulse(...).applyWindowing() so each refresh lands in its own fixed window, aligned 1:1 with a windowed main input.';

/**
 * Property configuration panel for the Apache Beam ParDo generic processing transform.
 *
 * @param props The selected ParDo node and change notification callback.
 * @returns The rendered ParDo properties panel.
 */
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

  // Side input bindings (auto-synchronised from side_input edges by usePipelineGraph)
  const sideInputs = normalizeSideInputBindings(properties.sideInputs);

  // Header metadata from the documentation catalog (falls back to the side input guide)
  const doc = getNodeDocumentation(node);
  const headerTitle = doc?.title ?? 'ParDo Transform (ParDo.of)';
  const headerDescription =
    doc?.description ?? 'Applies a general-purpose parallel DoFn to each element, with optional PCollectionView side inputs.';
  const docsUrl = doc?.docsUrl ?? SIDE_INPUT_DOCS_URL;

  /**
   * Handle changes to the Code Generation Prompt textarea
   * Updates prompt property and preserves system instructions
   */
  const handlePromptChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
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
   * Applies a partial update to the side input binding at `index` and propagates the full
   * properties object (prompt + system instructions preserved) to the parent.
   */
  const updateSideInput = (index: number, patch: Partial<SideInputBinding>) => {
    const next = sideInputs.map((binding, i) => (i === index ? { ...binding, ...patch } : binding));
    onChange({
      ...properties,
      codeGenerationPrompt,
      system_instructions: systemInstructions,
      sideInputs: next,
    });
  };

  return (
    <div className="flex-1 flex flex-col gap-4">
      {/* Header bar with documentation link (IO connector panel convention) */}
      <div className="flex flex-col gap-1.5 p-2.5 rounded bg-slate-800/40 border border-slate-700/60 text-xs text-slate-300">
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold text-slate-200">{headerTitle}</span>
          <ExternalDocsLink url={docsUrl} ariaLabel="Open ParDo side inputs documentation" />
        </div>
        <p className="text-slate-400">{headerDescription}</p>
        <p className="text-slate-400">
          Connect auxiliary PCollections to the top
          <span className="font-mono text-yellow-300"> side_input </span>
          handle to read them as PCollectionViews inside the DoFn.
        </p>
      </div>

      {/* Code Generation Prompt Section at Top */}
      <PropertyField
        id="pardoPrompt"
        name="codeGenerationPrompt"
        label="Code Generation Prompt"
        tooltip="User-defined processing logic instructions for generating the Beam DoFn (@ProcessElement method)."
        type="textarea"
        rows={4}
        value={codeGenerationPrompt}
        onChange={handlePromptChange}
        placeholder="Enter instructions for code generation..."
        mono={false}
      >
        <div className="text-xs text-slate-400 mt-1 leading-relaxed bg-slate-800/40 p-2.5 rounded border border-slate-700/50">
          Note: Write instructions that cover what should happen to the incoming messages and what the output format should be.
        </div>
      </PropertyField>

      {/* Side Inputs Section (F1) — hidden when no side_input edge is connected */}
      {sideInputs.length > 0 && (
        <section className="flex flex-col gap-3" data-testid="pardo-side-inputs-section">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold uppercase text-[var(--vscode-text-muted)]">
              Side Inputs ({sideInputs.length})
            </span>
            <InfoTooltip text="Immutable auxiliary inputs (PCollectionView in Java; pvalue.AsSingleton / AsIter / AsList / AsDict in Python) available inside the DoFn alongside the main input. Bindings are created automatically when you connect an edge to the side_input handle and removed when the edge is deleted." />
          </div>

          {sideInputs.map((binding, index) => {
            const isSingleton = binding.viewType === 'SINGLETON';
            const isSlowlyUpdating = binding.refreshPattern !== 'STATIC';
            const idPrefix = `pardoSideInput-${index}`;
            return (
              <div
                key={`${binding.sourceNodeId}-${index}`}
                className="flex flex-col gap-3 p-3 rounded border border-yellow-500/30 bg-yellow-500/5"
                data-testid={`pardo-side-input-${index}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-200 truncate">
                    {binding.sourceLabel || binding.sourceNodeId}
                  </span>
                  <span
                    className="text-[10px] font-mono text-slate-400 shrink-0"
                    title="Connected upstream node id"
                    data-testid={`${idPrefix}-source`}
                  >
                    {binding.sourceNodeId}
                  </span>
                </div>

                <PropertyField
                  id={`${idPrefix}-variableName`}
                  name="variableName"
                  label="Variable Name / Tag"
                  tooltip="Identifier for the PCollectionView variable in Java (c.sideInput(<name>)) and the keyword argument in Python (def process(self, element, <name>))."
                  value={binding.variableName}
                  onChange={(e) => updateSideInput(index, { variableName: e.target.value })}
                  placeholder="e.g. lookupTable"
                  required
                />

                <SelectField
                  id={`${idPrefix}-viewType`}
                  name="viewType"
                  label="View Type"
                  tooltip={VIEW_TYPE_TOOLTIP}
                  value={binding.viewType}
                  options={VIEW_TYPE_OPTIONS.filter((o) => SIDE_INPUT_VIEW_TYPES.includes(o.value))}
                  onChange={(e) => updateSideInput(index, { viewType: e.target.value as SideInputViewType })}
                />

                {isSingleton && (
                  <label
                    htmlFor={`${idPrefix}-hasDefaultValue`}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <input
                      id={`${idPrefix}-hasDefaultValue`}
                      type="checkbox"
                      name="hasDefaultValue"
                      checked={Boolean(binding.hasDefaultValue)}
                      onChange={(e) => updateSideInput(index, { hasDefaultValue: e.target.checked })}
                      className="rounded bg-[var(--vscode-input-bg)] border-[var(--vscode-border)] text-blue-500 focus:ring-0 focus:ring-offset-0"
                    />
                    <span className="text-xs text-[var(--vscode-text-secondary)]">
                      Provide default value (.withDefaultValue / default_value)
                    </span>
                    <InfoTooltip text="Used when the side input PCollection is empty for a window. Without a default, Beam raises an error on an empty SINGLETON view." />
                  </label>
                )}

                {isSingleton && Boolean(binding.hasDefaultValue) && (
                  <PropertyField
                    id={`${idPrefix}-defaultValue`}
                    name="defaultValue"
                    label="Default Value"
                    tooltip="Literal emitted as View.asSingleton().withDefaultValue(...) in Java and pvalue.AsSingleton(pcoll, default_value=...) in Python."
                    value={binding.defaultValue ?? ''}
                    onChange={(e) => updateSideInput(index, { defaultValue: e.target.value })}
                    placeholder="e.g. 0 or 'unknown'"
                  />
                )}

                <SelectField
                  id={`${idPrefix}-refreshPattern`}
                  name="refreshPattern"
                  label="Refresh Pattern"
                  tooltip={REFRESH_PATTERN_TOOLTIP}
                  value={binding.refreshPattern}
                  options={REFRESH_PATTERN_OPTIONS.filter((o) => SIDE_INPUT_REFRESH_PATTERNS.includes(o.value))}
                  onChange={(e) => updateSideInput(index, { refreshPattern: e.target.value as SideInputRefreshPattern })}
                />

                {isSlowlyUpdating && (
                  <PropertyField
                    id={`${idPrefix}-updateIntervalSeconds`}
                    name="updateIntervalSeconds"
                    type="number"
                    min="1"
                    label="Update Interval (seconds)"
                    tooltip="Refresh cadence: GenerateSequence.withRate(1, Duration.standardSeconds(n)) / PeriodicImpulse.withInterval(...) in Java, PeriodicImpulse(fire_interval=n) in Python."
                    value={binding.updateIntervalSeconds ?? DEFAULT_SIDE_INPUT_UPDATE_INTERVAL_SECONDS}
                    onChange={(e) => {
                      const parsed = Number(e.target.value);
                      updateSideInput(index, {
                        updateIntervalSeconds: Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_SIDE_INPUT_UPDATE_INTERVAL_SECONDS,
                      });
                    }}
                    placeholder={String(DEFAULT_SIDE_INPUT_UPDATE_INTERVAL_SECONDS)}
                  />
                )}
              </div>
            );
          })}
        </section>
      )}

      {/* System Instructions Section at Bottom */}
      <SystemInstructionsField
        id="pardoSystemInstructions"
        value={systemInstructions}
        label="System Instructions"
        tooltip="System-level instructions injected into the LLM prompt (e.g. error handling, dead-letter routing, schema constraints)."
        placeholder="Enter system instructions..."
        onChange={(value) =>
          onChange({
            ...properties,
            codeGenerationPrompt,
            system_instructions: value,
          })
        }
      />
    </div>
  );
};
