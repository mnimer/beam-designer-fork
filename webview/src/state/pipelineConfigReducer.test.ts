/**
 * @fileoverview Tests for pipelineConfigReducer and its update helpers.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

import { describe, it, expect } from 'vitest';
import {
  pipelineConfigReducer,
  withRebuildIfChanged,
  type PipelineConfig,
  type PipelineConfigAction,
} from './pipelineConfigReducer';

describe('pipelineConfigReducer', () => {
  const baseConfig: PipelineConfig = {
    language: 'Python',
    outputFolder: 'output/dir',
    needsRebuild: false,
  };

  describe('setLanguage action', () => {
    it('updates language and marks needsRebuild true when language changes', () => {
      const next = pipelineConfigReducer(baseConfig, {
        type: 'setLanguage',
        language: 'Java',
      });
      expect(next).toEqual({
        language: 'Java',
        outputFolder: 'output/dir',
        needsRebuild: true,
      });
    });

    it('returns identical reference when language is unchanged', () => {
      const next = pipelineConfigReducer(baseConfig, {
        type: 'setLanguage',
        language: 'Python',
      });
      expect(next).toBe(baseConfig);
    });

    it('preserves needsRebuild true when language changes on an already dirty state', () => {
      const dirtyConfig: PipelineConfig = { ...baseConfig, needsRebuild: true };
      const next = pipelineConfigReducer(dirtyConfig, {
        type: 'setLanguage',
        language: 'Java',
      });
      expect(next.needsRebuild).toBe(true);
      expect(next.language).toBe('Java');
    });
  });

  describe('setOutputFolder action', () => {
    it('updates outputFolder and marks needsRebuild true when folder changes', () => {
      const next = pipelineConfigReducer(baseConfig, {
        type: 'setOutputFolder',
        folder: 'new/dir',
      });
      expect(next).toEqual({
        language: 'Python',
        outputFolder: 'new/dir',
        needsRebuild: true,
      });
    });

    it('returns identical reference and preserves needsRebuild false when outputFolder is unchanged', () => {
      const next = pipelineConfigReducer(baseConfig, {
        type: 'setOutputFolder',
        folder: 'output/dir',
      });
      expect(next).toBe(baseConfig);
      expect(next.needsRebuild).toBe(false);
    });

    it('returns identical reference and preserves needsRebuild true when outputFolder is unchanged on dirty state', () => {
      const dirtyConfig: PipelineConfig = { ...baseConfig, needsRebuild: true };
      const next = pipelineConfigReducer(dirtyConfig, {
        type: 'setOutputFolder',
        folder: 'output/dir',
      });
      expect(next).toBe(dirtyConfig);
      expect(next.needsRebuild).toBe(true);
    });

    it('marks needsRebuild true when transitioning from empty to non-empty folder', () => {
      const emptyFolderConfig: PipelineConfig = {
        language: 'Python',
        outputFolder: '',
        needsRebuild: false,
      };
      const next = pipelineConfigReducer(emptyFolderConfig, {
        type: 'setOutputFolder',
        folder: 'initial/folder',
      });
      expect(next.needsRebuild).toBe(true);
      expect(next.outputFolder).toBe('initial/folder');
    });
  });

  describe('syncOutputFolderFromHost action', () => {
    it('returns identical reference when folder is unchanged', () => {
      const next = pipelineConfigReducer(baseConfig, {
        type: 'syncOutputFolderFromHost',
        folder: 'output/dir',
      });
      expect(next).toBe(baseConfig);
    });

    it('sets needsRebuild to true when prev folder was non-empty and changes', () => {
      const next = pipelineConfigReducer(baseConfig, {
        type: 'syncOutputFolderFromHost',
        folder: 'another/folder',
      });
      expect(next.needsRebuild).toBe(true);
      expect(next.outputFolder).toBe('another/folder');
    });

    it('preserves needsRebuild false when prev folder was empty', () => {
      const emptyFolderConfig: PipelineConfig = {
        language: 'Python',
        outputFolder: '',
        needsRebuild: false,
      };
      const next = pipelineConfigReducer(emptyFolderConfig, {
        type: 'syncOutputFolderFromHost',
        folder: 'auto/default',
      });
      expect(next.needsRebuild).toBe(false);
      expect(next.outputFolder).toBe('auto/default');
    });

    it('preserves existing needsRebuild true when prev folder was empty and dirty', () => {
      const dirtyEmptyConfig: PipelineConfig = {
        language: 'Python',
        outputFolder: '',
        needsRebuild: true,
      };
      const next = pipelineConfigReducer(dirtyEmptyConfig, {
        type: 'syncOutputFolderFromHost',
        folder: 'auto/default',
      });
      expect(next.needsRebuild).toBe(true);
      expect(next.outputFolder).toBe('auto/default');
    });
  });

  describe('markBuilt action', () => {
    it('sets needsRebuild to false when currently true', () => {
      const dirtyConfig: PipelineConfig = { ...baseConfig, needsRebuild: true };
      const next = pipelineConfigReducer(dirtyConfig, { type: 'markBuilt' });
      expect(next.needsRebuild).toBe(false);
      expect(next).not.toBe(dirtyConfig);
    });

    it('returns identical reference when already built (needsRebuild is false)', () => {
      const next = pipelineConfigReducer(baseConfig, { type: 'markBuilt' });
      expect(next).toBe(baseConfig);
    });
  });

  describe('markDirty action', () => {
    it('sets needsRebuild to true when currently false', () => {
      const next = pipelineConfigReducer(baseConfig, { type: 'markDirty' });
      expect(next.needsRebuild).toBe(true);
      expect(next).not.toBe(baseConfig);
    });

    it('returns identical reference when already dirty (needsRebuild is true)', () => {
      const dirtyConfig: PipelineConfig = { ...baseConfig, needsRebuild: true };
      const next = pipelineConfigReducer(dirtyConfig, { type: 'markDirty' });
      expect(next).toBe(dirtyConfig);
    });
  });

  describe('reset action', () => {
    it('replaces entire config when new config has different values', () => {
      const newConfig: PipelineConfig = {
        language: 'Java',
        outputFolder: 'java/out',
        needsRebuild: true,
      };
      const next = pipelineConfigReducer(baseConfig, {
        type: 'reset',
        config: newConfig,
      });
      expect(next).toEqual(newConfig);
    });

    it('returns identical reference when new config has same values as current state', () => {
      const duplicateConfig: PipelineConfig = {
        language: 'Python',
        outputFolder: 'output/dir',
        needsRebuild: false,
      };
      const next = pipelineConfigReducer(baseConfig, {
        type: 'reset',
        config: duplicateConfig,
      });
      expect(next).toBe(baseConfig);
    });
  });

  describe('unhandled action types', () => {
    it('returns identical reference on unknown action', () => {
      const next = pipelineConfigReducer(baseConfig, {
        type: 'unknownAction',
      } as unknown as PipelineConfigAction);
      expect(next).toBe(baseConfig);
    });
  });
});

describe('withRebuildIfChanged helper', () => {
  const baseConfig: PipelineConfig = {
    language: 'Python',
    outputFolder: 'orig/dir',
    needsRebuild: false,
  };

  it('returns identical reference when patch matches current fields', () => {
    const next = withRebuildIfChanged(baseConfig, {
      language: 'Python',
      outputFolder: 'orig/dir',
    });
    expect(next).toBe(baseConfig);
  });

  it('updates field and flags needsRebuild when language changes', () => {
    const next = withRebuildIfChanged(baseConfig, { language: 'Java' });
    expect(next).toEqual({
      language: 'Java',
      outputFolder: 'orig/dir',
      needsRebuild: true,
    });
  });

  it('updates field and flags needsRebuild when outputFolder changes', () => {
    const next = withRebuildIfChanged(baseConfig, { outputFolder: 'new/dir' });
    expect(next).toEqual({
      language: 'Python',
      outputFolder: 'new/dir',
      needsRebuild: true,
    });
  });

  it('returns identical reference when empty patch is provided', () => {
    const next = withRebuildIfChanged(baseConfig, {});
    expect(next).toBe(baseConfig);
  });
});
