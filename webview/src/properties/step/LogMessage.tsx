import React from 'react';

interface LogMessageNode {
  data: {
    properties?: {
      logLevel?: 'Debug' | 'Info' | 'Warning' | 'Error';
    };
  };
}

interface LogMessagePropertiesProps {
  node: LogMessageNode;
  onChange: (properties: any) => void;
}

export const LogMessageProperties: React.FC<LogMessagePropertiesProps> = ({ node, onChange }) => {
  const properties = node.data.properties || {};
  const logLevel = properties.logLevel || 'Info';

  // Handle select change and propagate up
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({ ...properties, [e.target.name]: e.target.value });
  };

  // Helper text based on selected log level
  const getHelperText = () => {
    switch (logLevel) {
      case 'Debug':
        return 'Output detailed debugging information, typically only useful in non-production environments.';
      case 'Info':
        return '';
      case 'Warning':
        return 'Indicate potential issues or unusual events that do not stop pipeline execution.';
      case 'Error':
        return 'Log critical errors indicating a failure or significant issue during processing.';
      default:
        return '';
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label className="text-xs font-bold uppercase text-slate-500">Log Level</label>
        <select 
          name="logLevel" 
          value={logLevel} 
          onChange={handleChange} 
          className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
        >
          <option value="Debug">Debug</option>
          <option value="Info">Info</option>
          <option value="Warning">Warning</option>
          <option value="Error">Error</option>
        </select>
      </div>

      {getHelperText() && (
        <div className="text-xs text-slate-400 mt-1 leading-relaxed bg-slate-800/40 p-2.5 rounded border border-slate-700/50">
          {getHelperText()}
        </div>
      )}
    </div>
  );
};
