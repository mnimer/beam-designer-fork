/**
 * PubSub Source Properties Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Renders the property configuration panel for Google Cloud Pub/Sub Source nodes
 * in Apache Beam pipelines (e.g. PubsubIO.readMessagesWithAttributes() / PubsubIO.readStrings()).
 * 
 * Architectural Decisions:
 * - In Apache Beam, a PubSub source requires EITHER a topic OR a subscription.
 * - Enforces mutual clearing: selecting or typing a topic clears subscription, and vice-versa.
 * - Flags validation error and applies red border highlighting when neither topic nor subscription is specified.
 * - Uses shared PropertyField and useAssetLoader primitives to maintain 8pt grid spacing and eliminate DRY violations.
 * - Provides a flexible spacer and Code Generation Instructions textarea for custom LLM prompts.
 */

import React from 'react';
import { PropertyField } from '../../components/common/PropertyField';
import { useAssetLoader } from '../../hooks/useAssetLoader';

interface PubSubPropertiesProps {
  node: {
    data: {
      properties?: {
        topic?: string;
        subscription?: string;
        system_instructions?: string;
        special_instructions?: string;
        [key: string]: any;
      };
      system_instructions?: string;
      special_instructions?: string;
    };
  };
  onChange: (properties: any) => void;
}

export const PubSubProperties: React.FC<PubSubPropertiesProps> = ({ node, onChange }) => {
  const properties = node.data.properties || {};

  // NOTE: Leverage useAssetLoader to request and observe topics and subscriptions with inline error support
  const { items: topics, error: topicError } = useAssetLoader<string>('topics');
  const { items: subscriptions, error: subscriptionError } = useAssetLoader<string>('subscriptions');

  const topic = properties.topic || '';
  const subscription = properties.subscription || '';

  // Validation: In Beam PubSub source, either topic or subscription is required
  const isInvalid = !topic.trim() && !subscription.trim();

  // System instructions text with fallback
  const systemInstructions =
    node.data.system_instructions ??
    node.data.special_instructions ??
    properties.system_instructions ??
    properties.special_instructions ??
    '';

  /**
   * Handles input changes with mutual exclusivity between topic and subscription.
   *
   * @param e Form change event from input or select.
   */
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const newProperties = { ...properties, [name]: value };

    // Mutual clearing for UI
    if (name === 'topic') {
      newProperties.subscription = '';
    } else if (name === 'subscription') {
      newProperties.topic = '';
    }

    // Priority validation: save only topic OR subscription
    if (newProperties.subscription) {
      delete newProperties.topic;
    } else if (newProperties.topic) {
      delete newProperties.subscription;
    }

    onChange(newProperties);
  };

  /**
   * Handles code generation instructions textarea change.
   *
   * @param e Form change event from textarea.
   */
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
        id="pubsubTopic"
        name="topic"
        label="Topic"
        required="Either Topic or Subscription is required"
        tooltip="Cloud Pub/Sub topic to read from (e.g. projects/my-project/topics/my-topic). Beam requires either a Topic or a Subscription."
        value={topic}
        invalid={isInvalid}
        error={topicError}
        onChange={handleChange}
        placeholder="projects/my-project/topics/my-topic"
        list="topic-options"
        datalist={topics}
        helperText={
          <span>
            Sample: <code className="text-slate-300 bg-slate-800/60 px-1 py-0.5 rounded">projects/my-project/topics/my-topic</code>
          </span>
        }
      />

      <div className="flex items-center gap-2">
        <div className="flex-1 border-t border-slate-700/60" />
        <span className="text-xs font-bold uppercase text-slate-500">OR</span>
        <div className="flex-1 border-t border-slate-700/60" />
      </div>

      {/* Subscription Input */}
      <PropertyField
        id="pubsubSubscription"
        name="subscription"
        label="Subscription"
        required="Either Topic or Subscription is required"
        tooltip="Cloud Pub/Sub subscription to read from (e.g. projects/my-project/subscriptions/my-sub). Beam requires either a Topic or a Subscription."
        value={subscription}
        invalid={isInvalid}
        error={subscriptionError}
        onChange={handleChange}
        placeholder="projects/my-project/subscriptions/my-sub"
        list="subscription-options"
        datalist={subscriptions}
        helperText={
          <span>
            Sample: <code className="text-slate-300 bg-slate-800/60 px-1 py-0.5 rounded">projects/my-project/subscriptions/my-sub</code>
          </span>
        }
      />

      {/* Validation Warning */}
      {isInvalid && (
        <div className="p-2.5 rounded bg-red-500/10 border border-red-500/30 text-xs text-red-400">
          Either a Topic or a Subscription is required for PubSub source.
        </div>
      )}

      {/* Flexible Spacer */}
      <div className="flex-1 min-h-4" />

      {/* Code Generation Instructions */}
      <div className="flex flex-col gap-2 pt-2 border-t border-slate-700/60">
        <PropertyField
          id="pubsubSourceSystemInstructions"
          name="system_instructions"
          label="Code Generation Instructions"
          type="textarea"
          value={systemInstructions}
          onChange={handleInstructionsChange}
          placeholder="Enter custom instructions for PubSub source code generation..."
          rows={3}
          mono={false}
        />
      </div>
    </div>
  );
};
