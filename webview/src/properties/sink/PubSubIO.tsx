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
import { SystemInstructionsField } from '../../components/common/SystemInstructionsField';
import { resolveSystemInstructions } from '../../utils/systemInstructions';
import { useAssetLoader } from '../../hooks/useAssetLoader';

/**
 * Props for the PubSubSinkProperties component.
 */
interface PubSubSinkPropertiesProps {
  node: any;
  onChange: (properties: any) => void;
}

/**
 * Dedicated property panel for the Pub/Sub sink node. Configures target Pub/Sub topic destination.
 *
 * @param props The selected node and the onChange callback used to persist edits.
 */
export const PubSubSinkProperties: React.FC<PubSubSinkPropertiesProps> = ({ node, onChange }) => {
  const properties = node.data.properties || {};
  const topic = properties.topic || '';

  // NOTE: Leverage useAssetLoader to request and observe topics with inline error support
  const { items: topics, error: topicError } = useAssetLoader<string>('topics');

  const isInvalid = !topic.trim();

  // System instructions text with fallback
  const systemInstructions = resolveSystemInstructions(node);

  // Handle input changes and propagate up
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const newProperties = { ...properties, [name]: value };
    onChange(newProperties);
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

      {/* Code Generation Instructions */}
      <SystemInstructionsField
        id="pubsubSinkSystemInstructions"
        value={systemInstructions}
        placeholder="Enter custom instructions for PubSub sink code generation..."
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
