import React from 'react';

/**
 * PubSub Properties Component
 * 
 * This component renders the property panel for a PubSub node.
 * It allows users to configure the topic and subscription for PubSub.
 */
interface PubSubPropertiesProps {
  node: any;
  onChange: (properties: any) => void;
}

export const PubSubProperties: React.FC<PubSubPropertiesProps> = ({ node, onChange }) => {
  const properties = node.data.properties || {};

  // Handle input changes and propagate up
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // NOTE: We are creating a new properties object to avoid direct mutation
    onChange({ ...properties, [e.target.name]: e.target.value });
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Topic Input */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-bold uppercase text-slate-500">Topic</label>
        <input
          type="text"
          name="topic"
          value={properties.topic || ''}
          onChange={handleChange}
          placeholder="projects/my-project/topics/my-topic"
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm"
        />
        <span className="text-xs text-slate-600">Sample: projects/my-project/topics/my-topic</span>
      </div>
      <div className="text-xs font-bold uppercase text-slate-500">OR</div>
      {/* Subscription Input */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-bold uppercase text-slate-500">Subscription</label>
        <input
          type="text"
          name="subscription"
          value={properties.subscription || ''}
          onChange={handleChange}
          placeholder="projects/my-project/subscriptions/my-sub"
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm"
        />
        <span className="text-xs text-slate-600">Sample: projects/my-project/subscriptions/my-sub</span>
      </div>
    </div>
  );
};
