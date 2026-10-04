/**
 * @fileoverview Hook managing runtime variables state and mutations.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

import { useState, useCallback } from 'react';
import { pipelineConfigReducer, type PipelineConfig } from '../state/pipelineConfigReducer';

/**
 * Key-value pair representing a runtime pipeline variable.
 */
export interface RuntimeVariable {
  key: string;
  value: string;
}

/**
 * Default runtime variables provided to a newly initialized pipeline.
 */
export const DEFAULT_RUNTIME_VARIABLES: readonly RuntimeVariable[] = Object.freeze([
  Object.freeze({ key: 'LOG_LEVEL', value: 'INFO' }),
  Object.freeze({ key: 'NUM_WORKERS', value: '2' }),
]);

/**
 * Options for the `useRuntimeVariables` hook.
 */
export interface UseRuntimeVariablesOptions {
  takeSnapshot: () => void;
  setPipelineConfig: React.Dispatch<React.SetStateAction<PipelineConfig>>;
  initial?: RuntimeVariable[] | readonly RuntimeVariable[];
}

/**
 * Return type of the `useRuntimeVariables` hook.
 */
export interface UseRuntimeVariablesResult {
  runtimeVariables: RuntimeVariable[];
  setRuntimeVariables: React.Dispatch<React.SetStateAction<RuntimeVariable[]>>;
  addVariable: () => void;
  updateVariable: (index: number, field: 'key' | 'value', value: string) => void;
  deleteVariable: (index: number) => void;
}

/**
 * Hook for managing pipeline runtime variables with snapshot capture and functional updates.
 *
 * @param options Hook configuration containing takeSnapshot and setPipelineConfig callbacks.
 * @returns State and mutation functions for runtime variables.
 */
export function useRuntimeVariables({
  takeSnapshot,
  setPipelineConfig,
  initial = DEFAULT_RUNTIME_VARIABLES,
}: UseRuntimeVariablesOptions): UseRuntimeVariablesResult {
  const [runtimeVariables, setRuntimeVariables] = useState<RuntimeVariable[]>(() =>
    initial.map((v) => ({ ...v }))
  );

  const addVariable = useCallback(() => {
    takeSnapshot();
    setRuntimeVariables((prev) => [...prev, { key: 'NEW_VAR', value: 'value' }]);
    setPipelineConfig((prev) => pipelineConfigReducer(prev, { type: 'markDirty' }));
  }, [takeSnapshot, setPipelineConfig]);

  const updateVariable = useCallback(
    (index: number, field: 'key' | 'value', value: string) => {
      takeSnapshot();
      setRuntimeVariables((prev) =>
        prev.map((v, i) => (i === index ? { ...v, [field]: value } : v))
      );
      setPipelineConfig((prev) => pipelineConfigReducer(prev, { type: 'markDirty' }));
    },
    [takeSnapshot, setPipelineConfig]
  );

  const deleteVariable = useCallback(
    (index: number) => {
      takeSnapshot();
      setRuntimeVariables((prev) => prev.filter((_, i) => i !== index));
      setPipelineConfig((prev) => pipelineConfigReducer(prev, { type: 'markDirty' }));
    },
    [takeSnapshot, setPipelineConfig]
  );

  return {
    runtimeVariables,
    setRuntimeVariables,
    addVariable,
    updateVariable,
    deleteVariable,
  };
}
