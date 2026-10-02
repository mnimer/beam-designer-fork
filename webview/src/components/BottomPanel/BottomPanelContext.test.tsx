/**
 * @fileoverview Unit tests for BottomPanelContext, provider, and hooks.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  useBottomPanel,
  BottomPanelProvider,
  type BottomPanelContextValue,
} from './BottomPanelContext';

describe('BottomPanelContext', () => {
  const createSampleContext = (): BottomPanelContextValue => ({
    execution: {
      logs: [{ id: '1', text: 'sample log', stream: 'stdout', timestamp: '12:00:00' }],
      status: 'running',
      runnerCommand: 'python -m pipeline',
      run: vi.fn(),
      stop: vi.fn(),
      clear: vi.fn(),
      openConsole: vi.fn(),
    },
    jobConfig: {
      value: { runner: 'DataflowRunner' },
      set: vi.fn(),
      isJobIdValid: vi.fn().mockReturnValue(true),
      subnetworks: [],
      projectId: 'test-project',
    },
    runtimeVariables: {
      variables: [{ key: 'LOG_LEVEL', value: 'DEBUG' }],
      addVariable: vi.fn(),
      updateVariable: vi.fn(),
      deleteVariable: vi.fn(),
    },
    pipelineConfig: {
      config: { language: 'Python', outputFolder: '/out', needsRebuild: false },
      setLanguage: vi.fn(),
      setOutputFolder: vi.fn(),
      setPipelineConfig: vi.fn(),
    },
    codegen: {
      generatedCode: 'print("beam")',
      regenerate: vi.fn(),
      stopGeneration: vi.fn(),
      isGenerating: false,
      files: ['pipeline.py'],
      selectedFile: 'pipeline.py',
      selectedFileContent: 'print("beam")',
      pickFolder: vi.fn(),
      selectFile: vi.fn(),
      isGraphValid: true,
      validationErrors: [],
      nodes: [],
      tokenUsage: null,
    },
  });

  it('useBottomPanel throws a descriptive error outside a BottomPanelProvider', () => {
    // Suppress React boundary console.error during expected throw
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => renderHook(() => useBottomPanel())).toThrow(
      'useBottomPanel must be used within a BottomPanelProvider'
    );

    consoleSpy.mockRestore();
  });

  it('useBottomPanel returns context slices when wrapped in BottomPanelProvider', () => {
    const value = createSampleContext();
    const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
      <BottomPanelProvider value={value}>{children}</BottomPanelProvider>
    );

    const { result } = renderHook(() => useBottomPanel(), { wrapper });

    expect(result.current.execution.status).toBe('running');
    expect(result.current.jobConfig.value.runner).toBe('DataflowRunner');
    expect(result.current.runtimeVariables.variables).toHaveLength(1);
    expect(result.current.codegen.generatedCode).toBe('print("beam")');
  });
});
