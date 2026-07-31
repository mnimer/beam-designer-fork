import React from 'react';

/**
 * PubSub Sink Properties Component
 * 
 * This component renders the property panel for a PubSub Sink node.
 * It allows users to configure the topic for PubSub.
 */
interface PubSubSinkPropertiesProps {
  node: any;
  onChange: (properties: any) => void;
}

export const PubSubSinkProperties: React.FC<PubSubSinkPropertiesProps> = ({ node, onChange }) => {
  const properties = node.data.properties || {};
  const [topics, setTopics] = React.useState<string[]>([]);

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
    </div>
  );
};
