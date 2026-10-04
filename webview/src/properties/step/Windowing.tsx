/**
 * Windowing Properties Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Renders the property configuration panel for Apache Beam Windowing transform steps
 * (Window.into(FixedWindows | SlidingWindows | Sessions)).
 * 
 * Architectural Decisions:
 * - In Apache Beam, Window transforms require valid positive duration/period specifications.
 * - Fixed Windows require positive Duration.
 * - Sliding Windows require positive Duration and Period (every).
 * - Session Windows require positive Gap Duration and operate on Key-Value pairs.
 * - Enforces required field indicators, error messages, and aria attributes on window parameter fields.
 * - Integrates InfoTooltip components explaining windowing semantics.
 * - Provides Code Generation Instructions textarea for custom LLM prompts.
 */

import React from 'react';
import { InfoTooltip } from '../../components/InfoTooltip';
import { SystemInstructionsField } from '../../components/common/SystemInstructionsField';
import { resolveSystemInstructions } from '../../utils/systemInstructions';

/**
 * React Flow node shape for the Windowing step transform.
 */
interface WindowingNode {
  id: string;
  data: {
    label?: string;
    beam_transform?: string;
    system_instructions?: string;
    special_instructions?: string;
    properties?: {
      windowType?: 'Fixed Window' | 'Sliding Window' | 'Session Window';
      fixedDuration?: string | number;
      fixedDurationUnit?: 'Seconds' | 'Minutes' | 'Hours';
      slidingDuration?: string | number;
      slidingDurationUnit?: 'Seconds' | 'Minutes' | 'Hours';
      slidingPeriod?: string | number;
      slidingPeriodUnit?: 'Seconds' | 'Minutes' | 'Hours';
      slidingOffset?: string | number;
      slidingOffsetUnit?: 'Seconds' | 'Minutes' | 'Hours';
      sessionGapDuration?: string | number;
      sessionGapDurationUnit?: 'Seconds' | 'Minutes' | 'Hours';
      system_instructions?: string;
      special_instructions?: string;
      codeGenerationPrompt?: string;
      prompt?: string;
      [key: string]: any;
    };
  };
}

/**
 * Props for the {@link WindowingProperties} component.
 */
interface WindowingPropertiesProps {
  node: WindowingNode;
  onChange: (properties: any) => void;
  onAddKVMapper?: (windowNodeId: string) => void;
}

/**
 * Property configuration panel for Apache Beam windowing transforms (Fixed, Sliding, Session windows).
 *
 * @param props The selected windowing node, change callback, and optional KV mapper quick-action handler.
 * @returns The rendered windowing properties panel.
 */
export const WindowingProperties: React.FC<WindowingPropertiesProps> = ({ node, onChange, onAddKVMapper }) => {
  const properties = node.data.properties || {};
  const windowType = properties.windowType || 'Fixed Window';

  const fixedDuration = properties.fixedDuration !== undefined ? String(properties.fixedDuration) : '60';
  const slidingDuration = properties.slidingDuration !== undefined ? String(properties.slidingDuration) : '600';
  const slidingPeriod = properties.slidingPeriod !== undefined ? String(properties.slidingPeriod) : '300';
  const slidingOffset = properties.slidingOffset !== undefined ? String(properties.slidingOffset) : '60';
  const sessionGapDuration = properties.sessionGapDuration !== undefined ? String(properties.sessionGapDuration) : '30';

  // Validation rules
  const isFixedDurationInvalid = !fixedDuration.trim() || Number(fixedDuration) <= 0;
  const isSlidingDurationInvalid = !slidingDuration.trim() || Number(slidingDuration) <= 0;
  const isSlidingPeriodInvalid = !slidingPeriod.trim() || Number(slidingPeriod) <= 0;
  const isSessionGapInvalid = !sessionGapDuration.trim() || Number(sessionGapDuration) <= 0;

  // System instructions text with fallback
  const systemInstructions = resolveSystemInstructions(node);

  /**
   * Handles input and select changes for window parameters
   */
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    onChange({ ...properties, [e.target.name]: e.target.value });
  };

  return (
    <div className="flex-1 flex flex-col gap-4">
      {/* Window Type Select */}
      <div className="flex flex-col gap-2">
        <label htmlFor="windowTypeSelect" className="flex items-center text-xs font-bold uppercase text-slate-500">
          <span>Window Type</span>
          <InfoTooltip text="Beam windowing strategy: Fixed (non-overlapping time buckets), Sliding (overlapping intervals), or Session (gap-based activity bursts per key)." />
        </label>
        <select 
          id="windowTypeSelect"
          name="windowType" 
          value={windowType} 
          onChange={handleChange} 
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
        >
          <option value="Fixed Window">Fixed Window</option>
          <option value="Sliding Window">Sliding Window</option>
          <option value="Session Window">Session Window</option>
        </select>
      </div>

      {/* Fixed Window Form */}
      {windowType === 'Fixed Window' && (
        <div className="flex flex-col gap-4 border-t border-slate-700/50 pt-3">
          <div className="flex flex-col gap-2">
            <label htmlFor="fixedDurationInput" className="flex items-center text-xs font-bold uppercase text-slate-500">
              <span>Duration</span>
              <span className="text-red-400 ml-1 font-bold" title="Required">*</span>
              <InfoTooltip text="Fixed window size in duration units (e.g. 60 seconds). Required." />
            </label>
            <div className="flex gap-2">
              <input 
                id="fixedDurationInput"
                type="number" 
                name="fixedDuration" 
                min="1"
                aria-required="true"
                aria-invalid={isFixedDurationInvalid}
                value={fixedDuration} 
                onChange={handleChange} 
                placeholder="60"
                className={`flex-1 bg-[#252836] text-white p-2 rounded border text-sm focus:outline-none ${
                  isFixedDurationInvalid
                    ? 'border-red-500/80 focus:border-red-500'
                    : 'border-slate-700 focus:border-blue-500'
                }`}
              />
              <select
                id="fixedDurationUnitSelect"
                name="fixedDurationUnit"
                value={properties.fixedDurationUnit || 'Seconds'}
                onChange={handleChange}
                className="w-32 bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="Seconds">Seconds</option>
                <option value="Minutes">Minutes</option>
                <option value="Hours">Hours</option>
              </select>
            </div>
            {isFixedDurationInvalid && (
              <span className="text-xs text-red-400">Positive duration is required.</span>
            )}
          </div>
        </div>
      )}

      {/* Sliding Window Form */}
      {windowType === 'Sliding Window' && (
        <div className="flex flex-col gap-4 border-t border-slate-700/50 pt-3">
          {/* Sliding Duration */}
          <div className="flex flex-col gap-2">
            <label htmlFor="slidingDurationInput" className="flex items-center text-xs font-bold uppercase text-slate-500">
              <span>Duration</span>
              <span className="text-red-400 ml-1 font-bold" title="Required">*</span>
              <InfoTooltip text="Total length of each sliding window (e.g. 10 minutes). Required." />
            </label>
            <div className="flex gap-2">
              <input 
                id="slidingDurationInput"
                type="number" 
                name="slidingDuration" 
                min="1"
                aria-required="true"
                aria-invalid={isSlidingDurationInvalid}
                value={slidingDuration} 
                onChange={handleChange} 
                placeholder="600"
                className={`flex-1 bg-[#252836] text-white p-2 rounded border text-sm focus:outline-none ${
                  isSlidingDurationInvalid
                    ? 'border-red-500/80 focus:border-red-500'
                    : 'border-slate-700 focus:border-blue-500'
                }`}
              />
              <select
                id="slidingDurationUnitSelect"
                name="slidingDurationUnit"
                value={properties.slidingDurationUnit || 'Seconds'}
                onChange={handleChange}
                className="w-32 bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="Seconds">Seconds</option>
                <option value="Minutes">Minutes</option>
                <option value="Hours">Hours</option>
              </select>
            </div>
            {isSlidingDurationInvalid && (
              <span className="text-xs text-red-400">Positive duration is required.</span>
            )}
          </div>

          {/* Sliding Period */}
          <div className="flex flex-col gap-2">
            <label htmlFor="slidingPeriodInput" className="flex items-center text-xs font-bold uppercase text-slate-500">
              <span>Period (Every)</span>
              <span className="text-red-400 ml-1 font-bold" title="Required">*</span>
              <InfoTooltip text="How frequently a new sliding window begins (e.g. every 5 minutes). Required." />
            </label>
            <div className="flex gap-2">
              <input 
                id="slidingPeriodInput"
                type="number" 
                name="slidingPeriod" 
                min="1"
                aria-required="true"
                aria-invalid={isSlidingPeriodInvalid}
                value={slidingPeriod} 
                onChange={handleChange} 
                placeholder="300"
                className={`flex-1 bg-[#252836] text-white p-2 rounded border text-sm focus:outline-none ${
                  isSlidingPeriodInvalid
                    ? 'border-red-500/80 focus:border-red-500'
                    : 'border-slate-700 focus:border-blue-500'
                }`}
              />
              <select
                id="slidingPeriodUnitSelect"
                name="slidingPeriodUnit"
                value={properties.slidingPeriodUnit || 'Seconds'}
                onChange={handleChange}
                className="w-32 bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="Seconds">Seconds</option>
                <option value="Minutes">Minutes</option>
                <option value="Hours">Hours</option>
              </select>
            </div>
            {isSlidingPeriodInvalid && (
              <span className="text-xs text-red-400">Positive period is required.</span>
            )}
          </div>

          {/* Sliding Offset */}
          <div className="flex flex-col gap-2">
            <label htmlFor="slidingOffsetInput" className="flex items-center text-xs font-bold uppercase text-slate-500">
              <span>Offset</span>
              <InfoTooltip text="Optional start-time offset from the Unix epoch." />
            </label>
            <div className="flex gap-2">
              <input 
                id="slidingOffsetInput"
                type="number" 
                name="slidingOffset" 
                value={slidingOffset} 
                onChange={handleChange} 
                placeholder="60"
                className="flex-1 bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
              />
              <select
                id="slidingOffsetUnitSelect"
                name="slidingOffsetUnit"
                value={properties.slidingOffsetUnit || 'Seconds'}
                onChange={handleChange}
                className="w-32 bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="Seconds">Seconds</option>
                <option value="Minutes">Minutes</option>
                <option value="Hours">Hours</option>
              </select>
            </div>
          </div>

          {/* Sliding Description */}
          <span className="text-xs text-slate-400 mt-1 leading-relaxed">
            Example of a 10-minute window that calculates statistics every 5 minutes. However, you want the windows to align perfectly with a 1-minute offset.
          </span>
        </div>
      )}

      {/* Session Window Form */}
      {windowType === 'Session Window' && (
        <div className="flex flex-col gap-4 border-t border-slate-700/50 pt-3">
          <div className="flex flex-col gap-2">
            <label htmlFor="sessionGapDurationInput" className="flex items-center text-xs font-bold uppercase text-slate-500">
              <span>Gap Duration</span>
              <span className="text-red-400 ml-1 font-bold" title="Required">*</span>
              <InfoTooltip text="Minimum duration of inactivity between elements that demarcates separate user sessions. Required." />
            </label>
            <div className="flex gap-2">
              <input 
                id="sessionGapDurationInput"
                type="number" 
                name="sessionGapDuration" 
                min="1"
                aria-required="true"
                aria-invalid={isSessionGapInvalid}
                value={sessionGapDuration} 
                onChange={handleChange} 
                placeholder="30"
                className={`flex-1 bg-[#252836] text-white p-2 rounded border text-sm focus:outline-none ${
                  isSessionGapInvalid
                    ? 'border-red-500/80 focus:border-red-500'
                    : 'border-slate-700 focus:border-blue-500'
                }`}
              />
              <select
                id="sessionGapDurationUnitSelect"
                name="sessionGapDurationUnit"
                value={properties.sessionGapDurationUnit || 'Minutes'}
                onChange={handleChange}
                className="w-32 bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="Seconds">Seconds</option>
                <option value="Minutes">Minutes</option>
                <option value="Hours">Hours</option>
              </select>
            </div>
            {isSessionGapInvalid && (
              <span className="text-xs text-red-400">Positive gap duration is required.</span>
            )}
          </div>

          {/* Warning Message & Button */}
          <div className="flex flex-col gap-2 mt-2 p-3 rounded bg-amber-500/10 border border-amber-500/30">
            <span className="text-xs text-amber-400 font-medium">
              This option requires a KV Input value.
            </span>
            <button
              type="button"
              onClick={() => onAddKVMapper && onAddKVMapper(node.id)}
              className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs py-1.5 px-3 rounded transition-colors cursor-pointer"
            >
              Add KV Mapper
            </button>
          </div>
        </div>
      )}

      {/* Code Generation Instructions */}
      <SystemInstructionsField
        id="windowingSystemInstructions"
        value={systemInstructions}
        placeholder="Enter custom instructions for Windowing code generation..."
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
