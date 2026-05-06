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
  const [topics, setTopics] = React.useState<string[]>([]);
  const [subscriptions, setSubscriptions] = React.useState<string[]>([]);

  React.useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.command === 'topicsLoaded') {
        setTopics(message.topics);
      } else if (message.command === 'subscriptionsLoaded') {
        setSubscriptions(message.subscriptions);
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

  // Handle input changes and propagate up
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const newProperties = { ...properties, [name]: value };

    // 1. Mutual clearing for UI
    if (name === 'topic') {
      newProperties.subscription = '';
    } else if (name === 'subscription') {
      newProperties.topic = '';
    }

    // 2. Priority validation: save only topic OR subscription
    if (newProperties.subscription) {
      delete newProperties.topic;
    } else if (newProperties.topic) {
      delete newProperties.subscription;
    }

    onChange(newProperties);
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
          list="topic-options"
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm"
        />
        <datalist id="topic-options">
          {topics.map(t => (
            <option key={t} value={t} />
          ))}
        </datalist>
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
          list="subscription-options"
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm"
        />
        <datalist id="subscription-options">
          {subscriptions.map(s => (
            <option key={s} value={s} />
          ))}
        </datalist>
        <span className="text-xs text-slate-600">Sample: projects/my-project/subscriptions/my-sub</span>
      </div>

      {/* Divider */}
      <div className="border-t border-slate-700"></div>

      {/* Output Format Section */}
      <div className="flex flex-col gap-2">
        <label htmlFor="outputFormat" className="text-xs font-bold uppercase text-slate-500">Output Format</label>
        <select
          id="outputFormat"
          name="outputFormat"
          value={properties.outputFormat || 'String'}
          onChange={handleChange}
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm"
        >
          <option value="String">String</option>
          <option value="JSON">JSON</option>
        </select>
      </div>
    </div>
  );
};
