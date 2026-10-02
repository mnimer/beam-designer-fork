/**
 * @fileoverview Tests for useRuntimeVariables hook.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useRuntimeVariables, DEFAULT_RUNTIME_VARIABLES } from './useRuntimeVariables';

describe('useRuntimeVariables', () => {
  const setup = (initial?: { key: string; value: string }[]) => {
    const takeSnapshot = vi.fn();
    const setPipelineConfig = vi.fn();

    const hook = renderHook(() =>
      useRuntimeVariables({
        takeSnapshot,
        setPipelineConfig,
        initial,
      })
    );

    return { ...hook, takeSnapshot, setPipelineConfig };
  };

  it('initializes with DEFAULT_RUNTIME_VARIABLES by default', () => {
    const { result } = setup();
    expect(result.current.runtimeVariables).toEqual(DEFAULT_RUNTIME_VARIABLES);
  });

  it('initializes with an empty array when empty array is provided', () => {
    const { result } = setup([]);
    expect(result.current.runtimeVariables).toEqual([]);
  });

  it('initializes with custom initial variables when provided', () => {
    const initial = [{ key: 'INIT_KEY', value: 'init_val' }];
    const { result } = setup(initial);
    expect(result.current.runtimeVariables).toEqual(initial);
  });

  it('addVariable captures snapshot, appends variable, and marks pipeline dirty', () => {
    const { result, takeSnapshot, setPipelineConfig } = setup([]);

    act(() => {
      result.current.addVariable();
    });

    expect(takeSnapshot).toHaveBeenCalledTimes(1);
    expect(result.current.runtimeVariables).toEqual([
      { key: 'NEW_VAR', value: 'value' },
    ]);
    expect(setPipelineConfig).toHaveBeenCalledTimes(1);

    const configUpdater = setPipelineConfig.mock.calls[0][0];
    const prevConfig = { language: 'Python' as const, outputFolder: '', needsRebuild: false };
    expect(configUpdater(prevConfig)).toEqual({
      language: 'Python',
      outputFolder: '',
      needsRebuild: true,
    });
  });

  it('updateVariable captures snapshot, updates specific field, and marks dirty', () => {
    const initial = [
      { key: 'VAR_1', value: 'val_1' },
      { key: 'VAR_2', value: 'val_2' },
    ];
    const { result, takeSnapshot, setPipelineConfig } = setup(initial);

    act(() => {
      result.current.updateVariable(1, 'value', 'updated_val_2');
    });

    expect(takeSnapshot).toHaveBeenCalledTimes(1);
    expect(result.current.runtimeVariables).toEqual([
      { key: 'VAR_1', value: 'val_1' },
      { key: 'VAR_2', value: 'updated_val_2' },
    ]);
    expect(setPipelineConfig).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.updateVariable(0, 'key', 'NEW_KEY_1');
    });

    expect(result.current.runtimeVariables[0].key).toBe('NEW_KEY_1');
  });

  it('deleteVariable captures snapshot, removes variable at index, and marks dirty', () => {
    const initial = [
      { key: 'VAR_1', value: 'val_1' },
      { key: 'VAR_2', value: 'val_2' },
    ];
    const { result, takeSnapshot, setPipelineConfig } = setup(initial);

    act(() => {
      result.current.deleteVariable(0);
    });

    expect(takeSnapshot).toHaveBeenCalledTimes(1);
    expect(result.current.runtimeVariables).toEqual([
      { key: 'VAR_2', value: 'val_2' },
    ]);
    expect(setPipelineConfig).toHaveBeenCalledTimes(1);
  });

  it('functional updaters: two addVariable calls in the same act() both apply', () => {
    const { result, takeSnapshot, setPipelineConfig } = setup([]);

    act(() => {
      result.current.addVariable();
      result.current.addVariable();
    });

    expect(takeSnapshot).toHaveBeenCalledTimes(2);
    expect(setPipelineConfig).toHaveBeenCalledTimes(2);
    expect(result.current.runtimeVariables).toHaveLength(2);
    expect(result.current.runtimeVariables).toEqual([
      { key: 'NEW_VAR', value: 'value' },
      { key: 'NEW_VAR', value: 'value' },
    ]);
  });

  it('functional updaters: two consecutive updateVariable calls in the same act() both apply', () => {
    const initial = [{ key: 'ORIG_KEY', value: 'orig_val' }];
    const { result } = setup(initial);

    act(() => {
      result.current.updateVariable(0, 'key', 'UPDATED_KEY');
      result.current.updateVariable(0, 'value', 'UPDATED_VAL');
    });

    expect(result.current.runtimeVariables).toEqual([
      { key: 'UPDATED_KEY', value: 'UPDATED_VAL' },
    ]);
  });
});
