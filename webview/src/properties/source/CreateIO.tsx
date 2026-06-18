import React from 'react';
import { Plus, Trash2 } from 'lucide-react';

interface CreatePropertiesProps {
  node: any;
  onChange: (properties: any) => void;
}

export const CreateProperties: React.FC<CreatePropertiesProps> = ({ node, onChange }) => {
  const properties = node.data.properties || {};
  const elements: string[] = properties.elements || [''];

  const updateElements = (newElements: string[]) => {
    onChange({ ...properties, elements: newElements });
  };

  const handleElementChange = (index: number, value: string) => {
    const newElements = [...elements];
    newElements[index] = value;
    updateElements(newElements);
  };

  const addElement = () => {
    updateElements([...elements, '']);
  };

  const removeElement = (index: number) => {
    if (elements.length === 1) {
      updateElements(['']);
    } else {
      updateElements(elements.filter((_, i) => i !== index));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <label className="text-xs font-bold uppercase text-slate-500">In-Memory Elements</label>
      </div>

      <div className="flex flex-col gap-3 max-h-[400px] overflow-y-auto pr-1">
        {elements.map((element, index) => (
          <div key={index} className="flex gap-2 items-start bg-slate-800/40 p-2 rounded border border-slate-700/50">
            <textarea
              value={element}
              onChange={(e) => handleElementChange(index, e.target.value)}
              placeholder={`Element ${index + 1} (text, number, json...)`}
              rows={1}
              className="flex-1 bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm font-mono resize-y focus:outline-none focus:border-blue-500"
            />
            <button
              type="button"
              onClick={() => removeElement(index)}
              className="text-red-400 hover:text-red-300 hover:bg-red-950/30 p-1.5 rounded transition-all self-center"
              title="Remove Element"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addElement}
        className="flex items-center justify-center gap-1 text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded transition-colors font-semibold w-full mt-1"
      >
        <Plus className="w-3.5 h-3.5" /> Add Item
      </button>

      <span className="text-xs text-slate-500 font-medium">
        These elements will be created directly in memory as a PCollection (e.g. via beam.Create).
      </span>
    </div>
  );
};
