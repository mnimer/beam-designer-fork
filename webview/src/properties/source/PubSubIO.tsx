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
 * - Integrates InfoTooltip components linking field definitions to official Apache Beam documentation.
 * - Provides a flexible spacer and Code Generation Instructions textarea for custom LLM prompts.
 */

import React, { useState, useEffect } from 'react';
import { InfoTooltip } from '../../components/InfoTooltip';

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
  const [topics, setTopics] = useState<string[]>([]);
  const [subscriptions, setSubscriptions] = useState<string[]>([]);

  // NOTE: Listen for topic and subscription list events from the VS Code extension host
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.command === 'topicsLoaded') {
        setTopics(message.topics || []);
      } else if (message.command === 'subscriptionsLoaded') {
        setSubscriptions(message.subscriptions || []);
      }
    };
    window.addEventListener('message', handleMessage);
    
    const vscode = (window as any).vscode;
    if (vscode) {
      vscode.postMessage({ command: 'getTopics' });
      vscode.postMessage({ command: 'getSubscriptions' });
    }

    return () => window.removeEventListener('message', handleMessage);
  }, []);

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

  // NOTE: Handles input changes with mutual exclusivity between topic and subscription
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
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

  // Handles code generation instructions textarea change
  const handleInstructionsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange({
      ...properties,
      system_instructions: e.target.value
    });
  };

  return (
    <div className="flex-1 flex flex-col gap-4">
      {/* Topic Input */}
      <div className="flex flex-col gap-2">
        <label htmlFor="pubsubTopic" className="flex items-center text-xs font-bold uppercase text-slate-500">
          <span>Topic</span>
          <span className="text-red-400 ml-1 font-bold" title="Either Topic or Subscription is required">*</span>
          <InfoTooltip text="Cloud Pub/Sub topic to read from (e.g. projects/my-project/topics/my-topic). Beam requires either a Topic or a Subscription." />
        </label>
        <input
          id="pubsubTopic"
          type="text"
          name="topic"
          aria-required="true"
          aria-invalid={isInvalid}
          value={topic}
          onChange={handleChange}
          placeholder="projects/my-project/topics/my-topic"
          list="topic-options"
          className={`bg-[#252836] text-white p-2 rounded border text-sm focus:outline-none font-mono ${
            isInvalid
              ? 'border-red-500/80 focus:border-red-500'
              : 'border-slate-700 focus:border-blue-500'
          }`}
        />
        <datalist id="topic-options">
          {topics.map(t => (
            <option key={t} value={t} />
          ))}
        </datalist>
        <span className="text-xs text-slate-400">
          Sample: <code className="text-slate-300 bg-slate-800/60 px-1 py-0.5 rounded">projects/my-project/topics/my-topic</code>
        </span>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1 border-t border-slate-700/60" />
        <span className="text-xs font-bold uppercase text-slate-500">OR</span>
        <div className="flex-1 border-t border-slate-700/60" />
      </div>

      {/* Subscription Input */}
      <div className="flex flex-col gap-2">
        <label htmlFor="pubsubSubscription" className="flex items-center text-xs font-bold uppercase text-slate-500">
          <span>Subscription</span>
          <span className="text-red-400 ml-1 font-bold" title="Either Topic or Subscription is required">*</span>
          <InfoTooltip text="Cloud Pub/Sub subscription to read from (e.g. projects/my-project/subscriptions/my-sub). Beam requires either a Topic or a Subscription." />
        </label>
        <input
          id="pubsubSubscription"
          type="text"
          name="subscription"
          aria-required="true"
          aria-invalid={isInvalid}
          value={subscription}
          onChange={handleChange}
          placeholder="projects/my-project/subscriptions/my-sub"
          list="subscription-options"
          className={`bg-[#252836] text-white p-2 rounded border text-sm focus:outline-none font-mono ${
            isInvalid
              ? 'border-red-500/80 focus:border-red-500'
              : 'border-slate-700 focus:border-blue-500'
          }`}
        />
        <datalist id="subscription-options">
          {subscriptions.map(s => (
            <option key={s} value={s} />
          ))}
        </datalist>
        <span className="text-xs text-slate-400">
          Sample: <code className="text-slate-300 bg-slate-800/60 px-1 py-0.5 rounded">projects/my-project/subscriptions/my-sub</code>
        </span>
      </div>

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
        <label htmlFor="pubsubSourceSystemInstructions" className="text-xs font-bold uppercase text-slate-500">
          Code Generation Instructions
        </label>
        <textarea
          id="pubsubSourceSystemInstructions"
          name="system_instructions"
          value={systemInstructions}
          onChange={handleInstructionsChange}
          placeholder="Enter custom instructions for PubSub source code generation..."
          rows={3}
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500 resize-y"
        />
      </div>
    </div>
  );
};
