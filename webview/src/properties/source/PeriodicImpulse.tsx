import React from 'react';
import { InfoTooltip } from '../../components/InfoTooltip';
import { PropertyField } from '../../components/common/PropertyField';
import { SystemInstructionsField } from '../../components/common/SystemInstructionsField';
import { resolveSystemInstructions } from '../../utils/systemInstructions';

/**
 * PeriodicImpulse Properties Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * This component provides a property configuration panel for the PeriodicImpulse streaming source node.
 * It allows developers to configure periodic pulse emission interval, start time, stop time/duration,
 * catch up mode, and custom code generation instructions for Apache Beam pipelines in Java and Python.
 * 
 * Architectural Decisions:
 * - Supports emission interval in seconds (default: 1s).
 * - Supports start mode: 'now' (Instant.now() / time.time()) vs custom timestamp.
 * - Supports stop mode: 'never' (infinite stream), 'duration' (run for N seconds/minutes/hours), or 'custom_timestamp'.
 * - Supports optional 'catchUpToNow' boolean.
 * - Integrates interactive InfoTooltip components next to all field labels.
 * - Follows the 8pt grid system for spacing and consistent dark theme styling.
 */

/** Persisted configuration properties for the PeriodicImpulse transform node. */
export interface PeriodicImpulsePropertiesData {
  intervalSeconds?: number | string;
  startMode?: 'now' | 'custom_timestamp';
  startTimestamp?: number | string;
  stopMode?: 'never' | 'duration' | 'custom_timestamp';
  durationSeconds?: number | string;
  stopTimestamp?: number | string;
  catchUpToNow?: boolean;
  system_instructions?: string;
  special_instructions?: string;
}

/** React Flow node shape for the PeriodicImpulse source panel, including its persisted configuration data. */
export interface PeriodicImpulseNode {
  data: {
    label: string;
    beam_transform?: string;
    system_instructions?: string;
    special_instructions?: string;
    properties?: PeriodicImpulsePropertiesData;
  };
}

/** Props for the {@link PeriodicImpulseProperties} component. */
interface PeriodicImpulsePropertiesProps {
  node: PeriodicImpulseNode;
  onChange: (properties: any) => void;
}

/**
 * PeriodicImpulseProperties Component
 * 
 * Renders form fields for configuring Beam PeriodicImpulse transform.
 */
export const PeriodicImpulseProperties: React.FC<PeriodicImpulsePropertiesProps> = ({ node, onChange }) => {
  // Extract existing properties with sensible defaults
  const properties = node.data.properties || {};
  const intervalSeconds = properties.intervalSeconds ?? 1;
  const startMode = properties.startMode || 'now';
  const startTimestamp = properties.startTimestamp ?? '';
  const stopMode = properties.stopMode || 'never';
  const durationSeconds = properties.durationSeconds ?? 3600;
  const stopTimestamp = properties.stopTimestamp ?? '';
  const catchUpToNow = properties.catchUpToNow ?? false;
  const systemInstructions = resolveSystemInstructions(node);

  /**
   * Handles updating property fields when inputs change.
   */
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const isCheckbox = type === 'checkbox';
    const checked = isCheckbox ? (e.target as HTMLInputElement).checked : undefined;

    const updated = {
      ...properties,
      [name]: isCheckbox ? checked : value
    };

    // Default duration when switching to duration mode
    if (name === 'stopMode' && value === 'duration' && !updated.durationSeconds) {
      updated.durationSeconds = 3600;
    }

    onChange(updated);
  };

  return (
    <div className="flex-1 flex flex-col gap-4">
      {/* Interval in Seconds */}
      <PropertyField
        id="intervalSeconds"
        name="intervalSeconds"
        label="Emission Interval (Seconds)"
        type="number"
        min="0.1"
        step="any"
        value={intervalSeconds}
        onChange={handleChange}
        placeholder="1"
        tooltip="Duration between successive impulse firings in seconds (via PeriodicImpulse.create().withInterval(Duration) or PeriodicImpulse(fire_interval))."
        helperText="Duration between successive impulse firings (e.g. 1 = every second, 60 = every minute)."
        mono={false}
      />

      {/* Start Time Mode */}
      <div className="flex flex-col gap-2">
        <label htmlFor="startMode" className="flex items-center text-xs font-bold uppercase text-slate-500">
          <span>Start Time (.startAt / start_timestamp)</span>
          <InfoTooltip text="Configures when periodic impulses begin firing (current time or custom timestamp)." />
        </label>
        <select
          id="startMode"
          name="startMode"
          value={startMode}
          onChange={handleChange}
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
        >
          <option value="now">Current Time (Instant.now() / time.time())</option>
          <option value="custom_timestamp">Custom Timestamp (Epoch Seconds)</option>
        </select>
      </div>

      {/* Custom Start Timestamp (if selected) */}
      {startMode === 'custom_timestamp' && (
        <PropertyField
          id="startTimestamp"
          name="startTimestamp"
          label="Start Epoch Timestamp (Seconds)"
          type="number"
          value={startTimestamp}
          onChange={handleChange}
          placeholder="1700000000"
          tooltip="Explicit start time as unix epoch seconds."
          mono={false}
        />
      )}

      {/* Stop Time Mode */}
      <div className="flex flex-col gap-2">
        <label htmlFor="stopMode" className="flex items-center text-xs font-bold uppercase text-slate-500">
          <span>Stop Condition (.stopAt / stop_timestamp)</span>
          <InfoTooltip text="Controls when periodic impulses stop firing (never, after duration, or custom timestamp)." />
        </label>
        <select
          id="stopMode"
          name="stopMode"
          value={stopMode}
          onChange={handleChange}
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
        >
          <option value="never">Never (Infinite Stream)</option>
          <option value="duration">After Duration (Seconds)</option>
          <option value="custom_timestamp">Custom Stop Timestamp (Epoch Seconds)</option>
        </select>
      </div>

      {/* Stop Duration in Seconds (if selected) */}
      {stopMode === 'duration' && (
        <PropertyField
          id="durationSeconds"
          name="durationSeconds"
          label="Run Duration (Seconds)"
          type="number"
          min="1"
          value={durationSeconds}
          onChange={handleChange}
          placeholder="3600 (1 hour)"
          tooltip="Stop impulses after the specified duration in seconds (e.g. 3600 = 1 hour)."
          helperText="Pipeline impulses will stop after this duration (e.g. 3600 = 1 hour)."
          mono={false}
        />
      )}

      {/* Custom Stop Timestamp (if selected) */}
      {stopMode === 'custom_timestamp' && (
        <PropertyField
          id="stopTimestamp"
          name="stopTimestamp"
          label="Stop Epoch Timestamp (Seconds)"
          type="number"
          value={stopTimestamp}
          onChange={handleChange}
          placeholder="1700003600"
          tooltip="Explicit stop time as unix epoch seconds."
          mono={false}
        />
      )}

      {/* Catch Up To Now Toggle */}
      <div className="p-3 bg-slate-800/40 rounded border border-slate-700/50">
        <label htmlFor="catchUpToNow" className="flex items-center gap-2 cursor-pointer">
          <input
            id="catchUpToNow"
            type="checkbox"
            name="catchUpToNow"
            checked={catchUpToNow}
            onChange={handleChange}
            className="w-4 h-4 rounded border-slate-700 text-blue-600 focus:ring-0 focus:ring-offset-0 bg-[#252836]"
          />
          <span className="text-sm font-medium text-slate-300">Catch Up To Now (.catchUpToNow)</span>
          <InfoTooltip text="Whether to immediately emit all missed impulses from the start timestamp up to current time (via .catchUpToNow() in Java or fire_past_windows=True)." />
        </label>
        <span className="text-xs text-slate-500 block mt-1">
          Whether to immediately emit all missed impulses from the start timestamp up to current time.
        </span>
      </div>

      {/* Code Generation Instructions */}
      <SystemInstructionsField
        id="system_instructions"
        value={systemInstructions}
        tooltip="Optional custom guidance injected into the LLM code generation prompt for this transform."
        placeholder="Enter custom instructions for code generation..."
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
