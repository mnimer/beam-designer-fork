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
 * - Integrates InfoTooltip components explaining topic URI format.
 * - Provides Code Generation Instructions textarea for custom LLM prompts.
 */

import React from 'react';
import { InfoTooltip } from '../../components/InfoTooltip';

interface PubSubSinkPropertiesProps {
  node: any;
  onChange: (properties: any) => void;
}

export const PubSubSinkProperties: React.FC<PubSubSinkPropertiesProps> = ({ node, onChange }) => {
  const properties = node.data.properties || {};
  const topic = properties.topic || '';
  const [topics, setTopics] = React.useState<string[]>([]);

  const isInvalid = !topic.trim();

  // System instructions text with fallback
  const systemInstructions =
    node.data.system_instructions ??
    node.data.special_instructions ??
    properties.system_instructions ??
    properties.special_instructions ??
    '';

  React.useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.command === 'topicsLoaded') {
        setTopics(message.topics);
      }
    };
    window.addEventListener('message', handleMessage);
    
    const vscode = (window as any).vscode;
    if (vscode) {
      vscode.postMessage({ command: 'getTopics' });
    }

    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Handle input changes and propagate up
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const newProperties = { ...properties, [name]: value };
    onChange(newProperties);
  };

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
        <label htmlFor="pubsubSinkTopic" className="flex items-center text-xs font-bold uppercase text-slate-500">
          <span>Topic</span>
          <span className="text-red-400 ml-1 font-bold" title="Required">*</span>
          <InfoTooltip text="Cloud Pub/Sub topic to publish messages to in format projects/<PROJECT>/topics/<TOPIC>. Required." />
        </label>
        <input
          id="pubsubSinkTopic"
          type="text"
          name="topic"
          aria-required="true"
          aria-invalid={isInvalid}
          value={topic}
          onChange={handleChange}
          placeholder="projects/my-project/topics/my-topic"
          list="topic-options"
          className={`bg-[#252836] text-white p-2 rounded border text-sm focus:outline-none ${
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
        {isInvalid ? (
          <span className="text-xs text-red-400">Topic is required.</span>
        ) : (
          <span className="text-xs text-slate-400">Sample: projects/my-project/topics/my-topic</span>
        )}
      </div>

      {/* Flexible Spacer */}
      <div className="flex-1 min-h-4" />

      {/* Code Generation Instructions */}
      <div className="flex flex-col gap-2 pt-2 border-t border-slate-700/60">
        <label htmlFor="pubsubSinkSystemInstructions" className="text-xs font-bold uppercase text-slate-500">
          Code Generation Instructions
        </label>
        <textarea
          id="pubsubSinkSystemInstructions"
          name="system_instructions"
          value={systemInstructions}
          onChange={handleInstructionsChange}
          placeholder="Enter custom instructions for PubSub sink code generation..."
          rows={3}
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500 resize-y"
        />
      </div>
    </div>
  );
};
