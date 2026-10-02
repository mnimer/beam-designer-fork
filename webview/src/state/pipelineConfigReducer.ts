/**
 * @fileoverview Reducer and update helpers for managing pipeline configuration state.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

/**
 * Configuration settings for the pipeline generator and language target.
 */
export interface PipelineConfig {
  language: 'Python' | 'Java';
  outputFolder: string;
  needsRebuild: boolean;
}

/**
 * Discriminated union of actions supported by `pipelineConfigReducer`.
 */
export type PipelineConfigAction =
  | { type: 'setLanguage'; language: 'Python' | 'Java' }
  | { type: 'setOutputFolder'; folder: string }
  /** Host-driven sync; first hydration from '' does not dirty the pipeline, any later change does. */
  | { type: 'syncOutputFolderFromHost'; folder: string }
  | { type: 'markBuilt' }
  | { type: 'markDirty' }
  | { type: 'reset'; config: PipelineConfig };

/**
 * Pure helper that merges a partial patch (excluding `needsRebuild`) into `prev`
 * and flags `needsRebuild: true` if and only if any patched field differs from `prev`.
 * If no fields change, the original `prev` reference is preserved.
 *
 * @param prev The current pipeline configuration state.
 * @param patch Partial fields to compare and merge into the configuration.
 * @returns An updated PipelineConfig with needsRebuild: true if changed, or prev unchanged.
 */
export function withRebuildIfChanged(
  prev: PipelineConfig,
  patch: Partial<Omit<PipelineConfig, 'needsRebuild'>>
): PipelineConfig {
  const keys = Object.keys(patch) as (keyof Omit<PipelineConfig, 'needsRebuild'>)[];
  let changed = false;
  for (const key of keys) {
    if (patch[key] !== undefined && patch[key] !== prev[key]) {
      changed = true;
      break;
    }
  }

  if (!changed) {
    return prev;
  }

  return {
    ...prev,
    ...patch,
    needsRebuild: true,
  };
}

/**
 * Pure reducer function for pipeline configuration state transitions.
 * Guarantees referential equality when an action results in no effective state changes.
 *
 * @param state The current pipeline configuration state.
 * @param action The configuration action to process.
 * @returns The next pipeline configuration state or the identical state reference if no change occurred.
 */
export function pipelineConfigReducer(
  state: PipelineConfig,
  action: PipelineConfigAction
): PipelineConfig {
  switch (action.type) {
    case 'setLanguage':
      return withRebuildIfChanged(state, { language: action.language });

    case 'setOutputFolder':
      return withRebuildIfChanged(state, { outputFolder: action.folder });

    case 'syncOutputFolderFromHost': {
      if (state.outputFolder === action.folder) {
        return state;
      }
      const needsRebuild =
        state.outputFolder !== '' && state.outputFolder !== action.folder
          ? true
          : state.needsRebuild;
      return {
        ...state,
        outputFolder: action.folder,
        needsRebuild,
      };
    }

    case 'markBuilt':
      if (!state.needsRebuild) {
        return state;
      }
      return {
        ...state,
        needsRebuild: false,
      };

    case 'markDirty':
      if (state.needsRebuild) {
        return state;
      }
      return {
        ...state,
        needsRebuild: true,
      };

    case 'reset':
      if (
        state.language === action.config.language &&
        state.outputFolder === action.config.outputFolder &&
        state.needsRebuild === action.config.needsRebuild
      ) {
        return state;
      }
      return {
        ...action.config,
      };

    default:
      return state;
  }
}
