/**
 * PubSub Sink Properties Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Renders the property panel for Apache Beam PubsubIO Write Sink nodes (PubsubIO.write().to(...)).
 * 
 * Architectural Decisions:
 * - In Apache Beam, PubsubIO.write() strictly requires a target Pub/Sub topic.
 * - Enforces required field indicators, error messages, and aria attributes on topic.
 * - Uses shared PropertyField and useAssetLoader primitives to maintain 8pt grid spacing and eliminate DRY violations.
 * - Provides Code Generation Instructions textarea for custom LLM prompts.
 */

import React from 'react';
import { PropertyField } from '../../components/common/PropertyField';
import { useAssetLoader } from '../../hooks/useAssetLoader';

interface PubSubSinkPropertiesProps {
  node: any;
  onChange: (properties: any) => void;
}

export const PubSubSinkProperties: React.FC<PubSubSinkPropertiesProps> = ({ node, onChange }) => {
  const properties = node.data.properties || {};
  const topic = properties.topic || '';

  // NOTE: Leverage useAssetLoader to request and observe topics with inline error support
  const { items: topics, error: topicError } = useAssetLoader<string>('topics');

  const isInvalid = !topic.trim();

  // System instructions text with fallback
  const systemInstructions =
    node.data.system_instructions ??
    node.data.special_instructions ??
    properties.system_instructions ??
    properties.special_instructions ??
    '';

  // Handle input changes and propagate up
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const newProperties = { ...properties, [name]: value };
    onChange(newProperties);
  };

  const handleInstructionsChange = (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    onChange({
      ...properties,
      system_instructions: e.target.value
    });
  };

  return (
    <div className="flex-1 flex flex-col gap-4">
      {/* Topic Input */}
      <PropertyField
        id="pubsubSinkTopic"
        name="topic"
        label="Topic"
        required={true}
        tooltip="Cloud Pub/Sub topic to publish messages to in format projects/<PROJECT>/topics/<TOPIC>. Required."
        value={topic}
        invalid={isInvalid}
        error={topicError || (isInvalid ? 'Topic is required.' : null)}
        onChange={handleChange}
        placeholder="projects/my-project/topics/my-topic"
        list="topic-options"
        datalist={topics}
        mono={false}
        helperText={isInvalid ? undefined : 'Sample: projects/my-project/topics/my-topic'}
      />

      {/* Flexible Spacer */}
      <div className="flex-1 min-h-4" />

      {/* Code Generation Instructions */}
      <div className="flex flex-col gap-2 pt-2 border-t border-slate-700/60">
        <PropertyField
          id="pubsubSinkSystemInstructions"
          name="system_instructions"
          label="Code Generation Instructions"
          type="textarea"
          value={systemInstructions}
          onChange={handleInstructionsChange}
          placeholder="Enter custom instructions for PubSub sink code generation..."
          rows={3}
          mono={false}
        />
      </div>
    </div>
  );
};
