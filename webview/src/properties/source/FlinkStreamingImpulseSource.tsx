/**
 * FlinkStreamingImpulseSourceProperties Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Renders the property configuration panel for the Apache Beam FlinkStreamingImpulseSource
 * streaming source node. FlinkStreamingImpulseSource is a Python-only synthetic impulse generator
 * designed specifically for streaming pipelines executing on the Apache Flink Runner
 * (apache_beam.io.flink.flink_streaming_impulse_source.FlinkStreamingImpulseSource).
 * 
 * Architectural Decisions:
 * - Exposes emission interval (intervalMs, positive integer, default 500ms) mapped to .set_interval_ms(int).
 * - Exposes message count (messageCount, non-negative integer or 0/blank for unbounded) mapped to .set_message_count(int).
 * - Provides a dynamic derived stream mode indicator showing whether the stream is unbounded (continuous) or bounded to N impulses.
 * - Prominently highlights FlinkRunner requirement (--runner=FlinkRunner) and explicitly notes the absence of a native Java SDK equivalent.
 * - Exposes Flink JobManager endpoint (flinkMaster) clearly demarcated as a pipeline-level option (--flink_master in FlinkRunnerOptions).
 * - Provides quick helper buttons ('[auto]', 'localhost:8081') for JobManager endpoints.
 * - Pure event-driven state flow via onChange({ ...properties, [name]: value }) without internal form state duplication.
 * - Adheres strictly to the 8pt grid system, VS Code dark theme styling, and accessible ARIA attributes.
 */

import React from 'react';
import { Server, Zap, CheckCircle2 } from 'lucide-react';
import { PropertyField } from '../../components/common/PropertyField';
import { SystemInstructionsField } from '../../components/common/SystemInstructionsField';
import { resolveSystemInstructions } from '../../utils/systemInstructions';

/** Persisted configuration properties for the Flink streaming impulse source node. */
export interface FlinkStreamingImpulseSourcePropertiesData {
  intervalMs?: number | string;
  messageCount?: number | string;
  flinkMaster?: string;
  system_instructions?: string;
  special_instructions?: string;
  [key: string]: any;
}

/** React Flow node shape for the Flink streaming impulse source panel, including its persisted configuration data. */
export interface FlinkStreamingImpulseSourceNode {
  data: {
    label: string;
    beam_transform?: string;
    system_instructions?: string;
    special_instructions?: string;
    properties?: FlinkStreamingImpulseSourcePropertiesData;
  };
}

/** Props for the {@link FlinkStreamingImpulseSourceProperties} component. */
export interface FlinkStreamingImpulseSourcePropertiesProps {
  node: FlinkStreamingImpulseSourceNode;
  onChange: (properties: any) => void;
}

/**
 * FlinkStreamingImpulseSourceProperties renders the configuration form for Flink synthetic impulse streams.
 * 
 * @param props Component properties containing the active node data and onChange callback.
 * @returns React component.
 */
export const FlinkStreamingImpulseSourceProperties: React.FC<FlinkStreamingImpulseSourcePropertiesProps> = ({ node, onChange }) => {
  const properties = node.data.properties || {};

  // Form field state values with fallbacks
  const rawInterval = properties.intervalMs;
  const intervalMs = rawInterval !== undefined ? rawInterval : 500;
  const messageCount = properties.messageCount ?? '';
  const flinkMaster = properties.flinkMaster ?? '';

  // System instructions text with fallback
  const systemInstructions = resolveSystemInstructions(node);

  /**
   * Handles generic text, select, and checkbox input changes.
   * 
   * @param e Form change event from input, select, or textarea.
   */
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const isCheckbox = type === 'checkbox';
    const checked = isCheckbox ? (e.target as HTMLInputElement).checked : undefined;

    const newProperties = {
      ...properties,
      [name]: isCheckbox ? checked : value
    };

    onChange(newProperties);
  };

  /**
   * Applies helper value to Flink JobManager endpoint.
   * 
   * @param endpoint Endpoint string (e.g., '[auto]', 'localhost:8081').
   */
  const handleApplyFlinkMaster = (endpoint: string) => {
    onChange({
      ...properties,
      flinkMaster: endpoint
    });
  };

  /**
   * Handles system instructions textarea change for custom LLM prompt overrides.
   * 
   * @param e Form change event from textarea.
   */
  // Validation calculations
  const intervalStr = String(intervalMs).trim();
  const intervalNum = Number(intervalStr);
  const isIntervalEmpty = intervalStr === '';
  const isIntervalNotPositive = isNaN(intervalNum) || intervalNum <= 0;
  const isIntervalInvalid = isIntervalEmpty || isIntervalNotPositive;
  const intervalError = isIntervalEmpty
    ? 'Emission interval is required.'
    : isIntervalNotPositive
    ? 'Emission interval must be a positive integer in milliseconds.'
    : null;

  const countStr = String(messageCount).trim();
  const countNum = Number(countStr);
  const isMessageCountInvalid = countStr !== '' && (isNaN(countNum) || countNum < 0);
  const messageCountError = isMessageCountInvalid
    ? 'Message count must be a non-negative integer (0 or empty for unbounded).'
    : null;

  // Derived unbounded indicator
  const isUnbounded = countStr === '' || countStr === '0' || countNum === 0;

  return (
    <div className="flex-1 flex flex-col gap-4">
      {/* Runner & SDK Callout */}
      <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded flex items-start gap-2.5 text-xs text-blue-200">
        <Zap size={16} className="text-blue-400 shrink-0 mt-0.5" />
        <div className="flex flex-col gap-1">
          <span className="font-semibold text-blue-300">FlinkRunner Requirement (Python Only)</span>
          <p className="text-slate-300 leading-relaxed">
            <code className="text-blue-300 bg-slate-800/80 px-1 py-0.5 rounded font-mono">FlinkStreamingImpulseSource</code> is a Python-only synthetic source designed specifically for the Apache Flink Runner (<code className="text-blue-300 bg-slate-800/80 px-1 py-0.5 rounded font-mono">--runner=FlinkRunner</code>).
            The Java SDK does not provide a native equivalent; use <code className="text-slate-300 bg-slate-800/80 px-1 py-0.5 rounded font-mono">PeriodicImpulse</code> or <code className="text-slate-300 bg-slate-800/80 px-1 py-0.5 rounded font-mono">GenerateSequence</code> when targeting Java.
          </p>
        </div>
      </div>

      {/* 1. Impulse Timing Configuration */}
      <div className="p-3 bg-[#252836]/60 rounded border border-slate-700 flex flex-col gap-3">
        <span className="flex items-center text-xs font-bold uppercase text-slate-400 gap-1.5">
          <Zap size={12} className="text-amber-400" />
          <span>Impulse Generation Settings</span>
        </span>

        {/* Emission Interval */}
        <PropertyField
          id="flink-impulse-interval"
          name="intervalMs"
          label="Emission Interval (ms)"
          type="number"
          min="1"
          step="1"
          required="Emission interval is required and must be a positive integer in milliseconds."
          aria-required="true"
          aria-invalid={isIntervalInvalid}
          value={intervalMs}
          onChange={handleChange}
          placeholder="500"
          invalid={isIntervalInvalid}
          error={intervalError}
          tooltip="Interval between successive synthetic impulse emissions in milliseconds (configured via .set_interval_ms(int)). Java SDK has no equivalent."
          helperText="Interval in milliseconds between each emitted pulse (default: 500 ms)."
          mono={true}
        />

        {/* Message Count */}
        <PropertyField
          id="flink-impulse-count"
          name="messageCount"
          label="Message Count (0 = Unbounded)"
          type="number"
          min="0"
          step="1"
          aria-invalid={isMessageCountInvalid}
          value={messageCount}
          onChange={handleChange}
          placeholder="0 (unbounded stream)"
          invalid={isMessageCountInvalid}
          error={messageCountError}
          tooltip="Number of synthetic impulses to emit before terminating (configured via .set_message_count(int)). Set to 0 or leave empty for an infinite unbounded streaming source."
          helperText="Total impulses to emit. Set to 0 or leave blank for a continuous unbounded stream."
          mono={true}
        />

        {/* Derived Stream Mode Status */}
        <div className="p-2.5 bg-[#252836]/40 rounded border border-slate-700/80 flex items-center justify-between text-xs">
          <span className="text-slate-400 font-medium">Stream Boundary:</span>
          {isUnbounded ? (
            <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Unbounded Stream (Continuous)</span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-blue-400 font-semibold">
              <CheckCircle2 size={13} className="text-blue-400" />
              <span>Bounded Stream ({countStr} impulses)</span>
            </span>
          )}
        </div>
      </div>

      {/* 2. Flink JobManager & Cluster Connection */}
      <div className="p-3 bg-[#252836]/60 rounded border border-slate-700 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Server size={12} className="text-blue-400" />
            <span className="text-xs font-bold uppercase text-slate-400">Flink Cluster Configuration</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-700/80 text-blue-300 font-mono" title="Applies to the entire pipeline on FlinkRunner">
              Pipeline Option
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handleApplyFlinkMaster('[auto]')}
              className="px-1.5 py-0.5 rounded text-[10px] bg-slate-700 text-slate-200 hover:bg-slate-600 transition-colors"
              title="Set to [auto] for local MiniCluster or environment default"
            >
              [auto]
            </button>
            <button
              type="button"
              onClick={() => handleApplyFlinkMaster('localhost:8081')}
              className="px-1.5 py-0.5 rounded text-[10px] bg-slate-700 text-slate-200 hover:bg-slate-600 transition-colors"
              title="Set to localhost:8081"
            >
              localhost:8081
            </button>
          </div>
        </div>

        <PropertyField
          id="flink-master-endpoint"
          name="flinkMaster"
          label="Flink JobManager Master (--flink_master)"
          tooltip="Target Flink JobManager endpoint URL or host:port for pipeline submission (e.g., localhost:8081, flink-jobmanager:8081, or [auto]). Configures pipeline-level option --flink_master in FlinkRunnerOptions."
          value={flinkMaster}
          onChange={handleChange}
          placeholder="localhost:8081 or [auto]"
          mono={true}
          helperText="Pipeline-Level Option (--flink_master in FlinkRunnerOptions): Target Flink JobManager for pipeline submission. Applies to the entire pipeline on FlinkRunner."
        />
      </div>

      {/* Code Generation Instructions */}
      <SystemInstructionsField
        id="flink-source-instructions"
        value={systemInstructions}
        tooltip="Custom instructions passed to the AI code generation model for this specific FlinkStreamingImpulseSource node (e.g. interval tuning, watermark emission, or synthetic payload mapping)."
        placeholder="e.g. Emit synthetic impulses every 250ms and map elements into JSON payload objects with event timestamp."
        wrapperClassName="pt-2 border-t border-slate-700/60"
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
