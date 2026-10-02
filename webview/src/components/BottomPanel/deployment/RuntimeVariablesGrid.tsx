/**
 * @fileoverview Runtime variables and secrets CRUD grid.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

import React, { useState } from 'react';
import { Variable, Trash2, Eye, EyeOff, Plus } from 'lucide-react';

/**
 * Key-value pair for a runtime pipeline variable or secret.
 */
export interface RuntimeVariable {
  key: string;
  value: string;
}

/**
 * Props for the RuntimeVariablesGrid component.
 */
export interface RuntimeVariablesGridProps {
  /** Array of configured runtime variables */
  runtimeVariables: RuntimeVariable[];
  /** Callback to append a new variable */
  addVariable: () => void;
  /** Callback to update an existing variable by array index */
  updateVariable: (index: number, field: 'key' | 'value', value: string) => void;
  /** Callback to remove a variable by array index */
  deleteVariable: (index: number) => void;
  /** Validation predicate to test if a JOB_ID variable value is valid */
  isJobIdValid: (value: string) => boolean;
}

/**
 * Interactive list of runtime environment variables and secrets with masking toggle.
 */
export const RuntimeVariablesGrid: React.FC<RuntimeVariablesGridProps> = ({
  runtimeVariables,
  addVariable,
  updateVariable,
  deleteVariable,
  isJobIdValid,
}) => {
  const [visibleSecrets, setVisibleSecrets] = useState<Record<number, boolean>>({});

  // Toggle secret visibility for a specific runtime variable index
  const toggleSecretVisibility = (index: number) => {
    setVisibleSecrets(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  return (
    <div className="flex flex-col gap-2 pt-2 border-t border-slate-800">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Variable className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
            RUNTIME VALUES &amp; SECRETS
          </span>
        </div>
        <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded font-mono border border-slate-700">
          {runtimeVariables.length} configured
        </span>
      </div>
      <p className="text-[11px] text-slate-400 leading-tight">
        Secret keys and environment variables referenced by nodes in your diagram.
      </p>

      {/* Variables List */}
      <div className="flex flex-col gap-2 max-h-44 overflow-y-auto pr-1">
        {runtimeVariables.map((variable, index) => {
          const isVisible = !!visibleSecrets[index];
          const isSecretKey = variable.key.toLowerCase().includes('key') || 
                              variable.key.toLowerCase().includes('secret') || 
                              variable.key.toLowerCase().includes('password') || 
                              variable.key.toLowerCase().includes('token');

          return (
            <div key={index} className="flex items-center gap-1.5 bg-[#0d1017] p-1.5 rounded-lg border border-slate-800">
              <input
                type="text"
                value={variable.key}
                onChange={(e) => updateVariable(index, 'key', e.target.value)}
                placeholder="KEY"
                className="bg-[#161922] text-white px-2 py-1 rounded border border-slate-700 focus:outline-none focus:border-blue-500 text-[11px] font-mono w-2/5 disabled:opacity-50"
                disabled={variable.key === 'JOB_ID'}
              />
              <div className="relative flex-1">
                <input
                  type={isSecretKey && !isVisible ? 'password' : 'text'}
                  value={variable.value}
                  onChange={(e) => updateVariable(index, 'value', e.target.value)}
                  placeholder="VALUE"
                  className={`bg-[#161922] px-2 py-1 rounded border border-slate-700 focus:outline-none focus:border-blue-500 text-[11px] font-mono w-full pr-6 ${
                    variable.key === 'JOB_ID' && !isJobIdValid(variable.value) ? 'text-red-400 border-red-800' : 'text-white'
                  }`}
                />
                {isSecretKey && (
                  <button
                    type="button"
                    onClick={() => toggleSecretVisibility(index)}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-0.5 rounded cursor-pointer"
                    title={isVisible ? 'Hide secret value' : 'Show secret value'}
                  >
                    {isVisible ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  </button>
                )}
              </div>
              {variable.key !== 'JOB_ID' && (
                <button 
                  type="button"
                  onClick={() => deleteVariable(index)} 
                  className="text-slate-500 hover:text-red-400 p-1 rounded transition cursor-pointer"
                  title="Delete variable"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Add Variable Button */}
      <button 
        type="button"
        onClick={addVariable} 
        className="flex items-center justify-center gap-1.5 py-1.5 px-3 text-xs font-semibold text-blue-400 hover:text-blue-300 hover:bg-blue-950/40 border border-blue-900/50 rounded-lg transition cursor-pointer mt-1"
      >
        <Plus className="w-3.5 h-3.5" />
        <span>Add Variable</span>
      </button>
    </div>
  );
};
