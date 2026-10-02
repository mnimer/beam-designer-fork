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
import { getVsCodeApi } from '../bridge/vscodeApi';

/**
 * Serializable state snapshot representing an Apache Beam pipeline design.
 */
export interface PipelineState {
  nodes: any[];
  edges: any[];
  runtimeVariables: { key: string; value: string }[];
  jobConfig: any;
  pipelineConfig: any;
}

/**
 * Options for configuring debounced pipeline autosave in {@link usePipelinePersistence}.
 */
export interface UsePipelinePersistenceOptions {
  nodes: any[];
  edges: any[];
  runtimeVariables: { key: string; value: string }[];
  jobConfig: any;
  pipelineConfig: any;
  isLoaded: boolean;
  loadRevision?: number;
  vscode?: { postMessage: (msg: any) => void } | null;
  /**
   * Debounce delay in milliseconds.
   * Default: 2000ms (2s), chosen to prevent excessive synchronous host writes during active
   * graph editing while keeping persistence responsive.
   */
  debounceMs?: number;
}

/**
 * Strips transient React Flow runtime layout and selection fields from a node before serialization.
 */
const sanitizeNodeForSerialization = (node: any): any => {
  if (!node || typeof node !== 'object') return node;
  const { width, height, selected, dragging, positionAbsolute, ...persistedFields } = node;
  void width;
  void height;
  void selected;
  void dragging;
  void positionAbsolute;
  return persistedFields;
};

/**
 * Strips transient React Flow selection fields from an edge before serialization.
 */
const sanitizeEdgeForSerialization = (edge: any): any => {
  if (!edge || typeof edge !== 'object') return edge;
  const { selected, ...persistedFields } = edge;
  void selected;
  return persistedFields;
};

/**
 * Serializes the pipeline state object into a YAML string, excluding transient React Flow view state.
 */
export const serializePipeline = (state: PipelineState): string => {
  const cleanState: PipelineState = {
    nodes: Array.isArray(state.nodes) ? state.nodes.map(sanitizeNodeForSerialization) : [],
    edges: Array.isArray(state.edges) ? state.edges.map(sanitizeEdgeForSerialization) : [],
    runtimeVariables: state.runtimeVariables,
    jobConfig: state.jobConfig,
    pipelineConfig: state.pipelineConfig,
  };
  return YAML.stringify(cleanState);
};

/**
 * Custom hook that monitors pipeline state and debounces saving YAML data to the VS Code host.
 * Seeds baseline on initial load and skips the save call if the serialized YAML is identical
 * to the last saved output (dirty-check).
 */
export function usePipelinePersistence({
  nodes,
  edges,
  runtimeVariables,
  jobConfig,
  pipelineConfig,
  isLoaded,
  loadRevision,
  vscode,
  debounceMs = 2000,
}: UsePipelinePersistenceOptions) {
  // Track the last serialized YAML string to avoid redundant saves of identical state
  const lastSavedYamlRef = useRef<string | null>(null);
  const lastLoadRevisionRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    console.log('[@usePipelinePersistence] Save effect checked, isLoaded=', isLoaded);
    if (!isLoaded) {
      lastSavedYamlRef.current = null;
      return;
    }

    const state: PipelineState = {
      nodes,
      edges,
      runtimeVariables,
      jobConfig,
      pipelineConfig,
    };
    const yamlStr = serializePipeline(state);

    // Seed baseline on initial load or when an external loadPipeline event increments loadRevision
    if (
      lastSavedYamlRef.current === null ||
      (loadRevision !== undefined && lastLoadRevisionRef.current !== loadRevision)
    ) {
      lastSavedYamlRef.current = yamlStr;
      lastLoadRevisionRef.current = loadRevision;
      console.log('[@usePipelinePersistence] Seeded baseline YAML on load');
      return;
    }

    // P6: Dirty check - skip scheduling timer if byte-identical to last saved YAML
    if (lastSavedYamlRef.current === yamlStr) {
      console.log('[@usePipelinePersistence] Skipped redundant save, state identical');
      return;
    }

    console.log('[@usePipelinePersistence] Save effect scheduled');

    const timer = setTimeout(() => {
      const activeVsCode = vscode !== undefined ? vscode : (getVsCodeApi() ?? null);
      if (activeVsCode) {
        // P6: Dirty check - skip post entirely if byte-identical to last saved YAML
        if (lastSavedYamlRef.current === yamlStr) {
          console.log('[@usePipelinePersistence] Skipped redundant save, state identical');
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
  }, [nodes, edges, runtimeVariables, jobConfig, pipelineConfig, isLoaded, loadRevision, vscode, debounceMs]);

  return {
    lastSavedYamlRef,
    serializePipeline,
  };
}
