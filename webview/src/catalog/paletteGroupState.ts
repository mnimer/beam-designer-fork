/** @fileoverview Helpers and defaults for persisting palette accordion group state.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

/**
 * Storage key for persisting palette accordion group states.
 */
export const GROUPS_STORAGE_KEY = 'beam_node_groups_state';

/**
 * Default open state for all palette accordion groups.
 * To keep panels fitting comfortably on screen, only the first category group in each tab is open by default.
 */
export const defaultGroupOpenState: Record<string, boolean> = {
  sources_streaming_sources: true,
  sources_database_sources: false,
  sources_data_services_sources: false,
  sources_file_sources: false,
  sources_other_sources: false,
  steps_core_transforms: true,
  steps_message_parsers: false,
  steps_element_transforms: false,
  steps_aggregations: false,
  steps_windows: false,
  steps_other_transforms: false,
  sinks_streaming_sinks: true,
  sinks_database_sinks: false,
  sinks_data_services_sinks: false,
  sinks_file_sinks: false,
  sinks_logging_sinks: false,
  samples_sample_pipelines: true,
};

/**
 * Subset of the VS Code webview API used for state retrieval and persistence.
 */
interface VsCodeStateApi {
  getState?: () => Record<string, unknown> | null | undefined;
  setState?: (state: unknown) => void;
}

/**
 * Reads persisted group open/closed state from VS Code state (with localStorage fallback).
 *
 * @returns Record mapping group keys to their boolean open states.
 */
export const getPersistedGroupState = (): Record<string, boolean> => {
  try {
    const vs = typeof window !== 'undefined'
      ? (window as unknown as { vscode?: VsCodeStateApi }).vscode
      : undefined;
    if (vs?.getState) {
      const state = vs.getState();
      if (state && typeof state.nodePaletteGroups === 'object' && state.nodePaletteGroups !== null) {
        return { ...defaultGroupOpenState, ...(state.nodePaletteGroups as Record<string, boolean>) };
      }
    }
  } catch {
    // Ignore error
  }

  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(GROUPS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (typeof parsed === 'object' && parsed !== null) {
          return { ...defaultGroupOpenState, ...parsed };
        }
      }
    }
  } catch {
    // Ignore error
  }

  return defaultGroupOpenState;
};

/**
 * Persists group open/closed state into VS Code state (with localStorage fallback).
 *
 * @param groups Record mapping group keys to their boolean open states.
 */
export const persistGroupState = (groups: Record<string, boolean>): void => {
  try {
    const vs = typeof window !== 'undefined'
      ? (window as unknown as { vscode?: VsCodeStateApi }).vscode
      : undefined;
    if (vs?.setState) {
      const current = vs.getState?.() || {};
      vs.setState({
        ...current,
        nodePaletteGroups: groups,
      });
    }
  } catch {
    // Ignore error
  }

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify(groups));
    }
  } catch {
    // Ignore error
  }
};
