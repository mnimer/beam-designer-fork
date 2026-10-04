/**
 * WithTimestamps Properties Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Renders the property configuration panel for Apache Beam WithTimestamps transform steps (WithTimestamps.of(...)).
 * 
 * Architectural Decisions:
 * - In Apache Beam, WithTimestamps assigns event timestamps to elements.
 * - When Timestamp Source is 'Message Property' or 'Header Property', propertyName is required.
 * - Enforces required field indicators, error messages, and aria attributes.
 * - Integrates InfoTooltip components explaining event-time extraction and windowing alignment.
 * - Provides Code Generation Instructions textarea for custom LLM prompts.
 */

import React from 'react';
import { InfoTooltip } from '../../components/InfoTooltip';
import { PropertyField } from '../../components/common/PropertyField';
import { SystemInstructionsField } from '../../components/common/SystemInstructionsField';

/**
 * React Flow node shape for the WithTimestamps step transform.
 */
interface WithTimestampsNode {
  data: {
    label?: string;
    beam_transform?: string;
    system_instructions?: string;
    special_instructions?: string;
    properties?: {
      timestampType?: 'Current Time' | 'Message Property' | 'Header Property';
      propertyName?: string;
      system_instructions?: string;
      special_instructions?: string;
      codeGenerationPrompt?: string;
      prompt?: string;
      [key: string]: any;
    };
  };
}

/**
 * Props for the {@link WithTimestampsProperties} component.
 */
interface WithTimestampsPropertiesProps {
  node: WithTimestampsNode;
  onChange: (properties: any) => void;
}

/**
 * Generates plain English system instructions for timestamp assignment in code generation.
 *
 * @param type Timestamp source type ('Current Time' | 'Message Property' | 'Header Property').
 * @param propName Optional property or header name containing the timestamp.
 * @returns Human-readable instruction string.
 */
export const generateTimestampSystemInstruction = (type: string, propName: string): string => {
  if (type === 'Message Property') {
    return propName ? `Extract timestamp from message field '${propName}'.` : 'Extract timestamp from message field.';
  }
  if (type === 'Header Property') {
    return propName ? `Extract timestamp from message header '${propName}'.` : 'Extract timestamp from message header.';
  }
  return 'Attach current system time to each element.';
};

/**
 * Property configuration panel for the Apache Beam WithTimestamps transform.
 *
 * @param props The selected WithTimestamps node and change notification callback.
 * @returns The rendered WithTimestamps properties panel.
 */
export const WithTimestampsProperties: React.FC<WithTimestampsPropertiesProps> = ({ node, onChange }) => {
  const properties = node.data.properties || {};
  const timestampType = properties.timestampType || 'Current Time';
  const propertyName = properties.propertyName || '';

  const showPropertyNameInput = timestampType === 'Message Property' || timestampType === 'Header Property';
  const isPropertyNameInvalid = showPropertyNameInput && !propertyName.trim();

  const systemInstructions =
    node.data.system_instructions ??
    node.data.special_instructions ??
    properties.system_instructions ??
    properties.special_instructions ??
    generateTimestampSystemInstruction(timestampType, propertyName);

  /**
   * Handles changes to the timestamp source type select dropdown
   */
  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newType = e.target.value as 'Current Time' | 'Message Property' | 'Header Property';
    const newInstructions = generateTimestampSystemInstruction(newType, propertyName);
    onChange({
      ...properties,
      timestampType: newType,
      propertyName,
      system_instructions: newInstructions,
    });
  };

  /**
   * Handles changes to the timestamp property name input
   */
  const handlePropertyNameChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const newPropName = e.target.value;
    const newInstructions = generateTimestampSystemInstruction(timestampType, newPropName);
    onChange({
      ...properties,
      timestampType,
      propertyName: newPropName,
      system_instructions: newInstructions,
    });
  };

  return (
    <div className="flex-1 flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label htmlFor="withTimestampsSourceSelect" className="flex items-center text-xs font-bold uppercase text-slate-500">
          <span>Timestamp Source</span>
          <InfoTooltip text="Source of the event timestamp: Current system time, message payload field, or message metadata header." />
        </label>
        <select
          id="withTimestampsSourceSelect"
          name="timestampType"
          value={timestampType}
          onChange={handleTypeChange}
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
        >
          <option value="Current Time">Current Time</option>
          <option value="Message Property">Message Property</option>
          <option value="Header Property">Header Property</option>
        </select>
      </div>

      {showPropertyNameInput && (
        <PropertyField
          id="withTimestampsPropertyInput"
          name="propertyName"
          label="Property Name"
          required="Required"
          tooltip="Field or header attribute name containing the epoch timestamp or ISO date string. Required."
          invalid={isPropertyNameInvalid}
          error={isPropertyNameInvalid ? 'Property name is required.' : null}
          value={propertyName}
          onChange={handlePropertyNameChange}
          placeholder={timestampType === 'Header Property' ? 'e.g. publish_time' : 'e.g. event_timestamp'}
          mono={false}
        />
      )}

      <div className="text-xs text-slate-400 mt-1 leading-relaxed bg-slate-800/40 p-2.5 rounded border border-slate-700/50">
        Assign timestamps to incoming elements for windowing and event-time processing.
      </div>

      {/* Code Generation Instructions */}
      <SystemInstructionsField
        id="withTimestampsSystemInstructions"
        value={systemInstructions}
        placeholder="Enter code generation instructions for timestamp assignment..."
        onChange={(value) =>
          onChange({
            ...properties,
            timestampType,
            propertyName,
            system_instructions: value,
          })
        }
      />
    </div>
  );
};
