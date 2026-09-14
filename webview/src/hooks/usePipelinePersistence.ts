/**
 * Hook for Apache Beam pipeline persistence
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Handles serialization of pipeline state to YAML and debounced autosaving to the VS Code extension host.
 * Implements dirty-checking (P6) to avoid redundant writes when the serialized state has not changed.
 */

import { useEffect, useRef } from 'react';
import YAML from 'yaml';

export interface PipelineState {
  nodes: any[];
  edges: any[];
  runtimeVariables: { key: string; value: string }[];
  jobConfig: any;
  pipelineConfig: any;
}

export interface UsePipelinePersistenceOptions {
  nodes: any[];
  edges: any[];
  runtimeVariables: { key: string; value: string }[];
  jobConfig: any;
  pipelineConfig: any;
  isLoaded: boolean;
  vscode?: { postMessage: (msg: any) => void } | null;
  /**
   * Debounce delay in milliseconds.
   * Default: 2000ms (2s), chosen to prevent excessive synchronous host writes during active
   * graph editing while keeping persistence responsive.
   */
  debounceMs?: number;
}

/**
 * Serializes the pipeline state object into a YAML string.
 */
export const serializePipeline = (state: PipelineState): string => {
  return YAML.stringify(state);
};

/**
 * Custom hook that monitors pipeline state and debounces saving YAML data to the VS Code host.
 * Skips the save call if the serialized YAML is identical to the last saved output (dirty-check).
 */
export function usePipelinePersistence({
  nodes,
  edges,
  runtimeVariables,
  jobConfig,
  pipelineConfig,
  isLoaded,
  vscode,
  debounceMs = 2000,
}: UsePipelinePersistenceOptions) {
  // Track the last serialized YAML string to avoid redundant saves of unchanged state
  const lastSavedYamlRef = useRef<string | null>(null);

  useEffect(() => {
    console.log('[@usePipelinePersistence] Save effect checked, isLoaded=', isLoaded);
    if (!isLoaded) return;
    console.log('[@usePipelinePersistence] Save effect scheduled');

    const timer = setTimeout(() => {
      const activeVsCode = vscode !== undefined ? vscode : (typeof window !== 'undefined' ? (window as any).vscode : null);
      if (activeVsCode) {
        const state: PipelineState = {
          nodes,
          edges,
          runtimeVariables,
          jobConfig,
          pipelineConfig,
        };
        const yamlStr = serializePipeline(state);

        // P6: Dirty check - skip post entirely if byte-identical to last saved YAML
        if (lastSavedYamlRef.current === yamlStr) {
          console.log('[@usePipelinePersistence] Skipped redundant save, state unchanged');
          return;
        }

        lastSavedYamlRef.current = yamlStr;
        console.log('[@usePipelinePersistence] YAML generated & saved');

        activeVsCode.postMessage({
          command: 'savePipeline',
          data: yamlStr,
        });
        console.log('[@usePipelinePersistence] Sent savePipeline message (YAML config only)');
      }
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [nodes, edges, runtimeVariables, jobConfig, pipelineConfig, isLoaded, vscode, debounceMs]);

  return {
    lastSavedYamlRef,
    serializePipeline,
  };
}
