/**
 * Unit tests for useVsCodeBridge hook
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Tests:
 * - IPC handshake (ready, getSubnetworks, getSamples)
 * - Handling loadPipeline message and updating pipeline state
 * - Handling codeRegenerated message and clearing selected file state
 * - Stale closure avoidance via render-time ref assignments
 * - findMainPipelineFile resolution logic
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useVsCodeBridge, findMainPipelineFile, type PipelineConfig } from './useVsCodeBridge';

describe('findMainPipelineFile', () => {
  it('returns null for empty array', () => {
    expect(findMainPipelineFile([], 'Python')).toBeNull();
  });

  it('selects matching python pipeline file based on filename', () => {
    const files = ['setup.py', 'wordcount.py', 'utils.py'];
    expect(findMainPipelineFile(files, 'Python', 'wordcount.beam')).toBe('wordcount.py');
  });

  it('selects matching java pipeline file based on filename', () => {
    const files = ['WordCount.java', 'Utils.java', 'pom.xml'];
    expect(findMainPipelineFile(files, 'Java', 'wordcount.beam')).toBe('WordCount.java');
  });

  it('falls back to generic pipeline file when exact name match is missing', () => {
    const files = ['pipeline.py', 'helper.py'];
    expect(findMainPipelineFile(files, 'Python', 'unknown.beam')).toBe('pipeline.py');
  });
});

describe('useVsCodeBridge - injected vscode handle', () => {
  // Regression: UseVsCodeBridgeOptions has always declared a `vscode` option, but every
  // IPC sender re-derived the handle from `window.vscode` directly, so the option was
  // silently dead. Anything passing it got the global anyway. These tests pin that the
  // injected handle is the one actually used.
  beforeEach(() => {
    (window as any).vscode = { postMessage: vi.fn() };
  });

  /**
   * Builds the required option bag with no-op state setters, so each test only has to
   * express the part it cares about.
   */
  const baseOptions = () => ({
    setNodes: vi.fn(),
    setEdges: vi.fn(),
    setRuntimeVariables: vi.fn(),
    setJobConfig: vi.fn(),
    pipelineConfig: { language: 'Python', outputFolder: '', needsRebuild: false } as PipelineConfig,
    setPipelineConfig: vi.fn(),
    filename: 'test',
    setFilename: vi.fn(),
    projectId: 'proj',
    setProjectId: vi.fn(),
  });

  it('sends the startup handshake through the injected handle, not the global', () => {
    const injected = { postMessage: vi.fn() };
    const globalPostMessage = (window as any).vscode.postMessage;

    renderHook(() => useVsCodeBridge({ ...baseOptions(), vscode: injected }));

    expect(injected.postMessage).toHaveBeenCalledWith({ command: 'ready' });
    expect(globalPostMessage).not.toHaveBeenCalled();
  });

  it('routes an outbound request through the injected handle', () => {
    const injected = { postMessage: vi.fn() };
    const globalPostMessage = (window as any).vscode.postMessage;

    const { result } = renderHook(() => useVsCodeBridge({ ...baseOptions(), vscode: injected }));

    act(() => {
      result.current.handlePickFolder();
    });

    expect(injected.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ command: 'pickFolder' })
    );
    expect(globalPostMessage).not.toHaveBeenCalled();
  });

  it('still falls back to the global handle when no option is supplied', () => {
    const globalPostMessage = (window as any).vscode.postMessage;

    renderHook(() => useVsCodeBridge(baseOptions()));

    expect(globalPostMessage).toHaveBeenCalledWith({ command: 'ready' });
  });
});

describe('useVsCodeBridge', () => {
  let mockPostMessage: any;

  beforeEach(() => {
    mockPostMessage = vi.fn();
    (window as any).vscode = {
      postMessage: mockPostMessage,
    };
  });

  it('sends ready, getSubnetworks, and getSamples on mount', () => {
    const setNodes = vi.fn();
    const setEdges = vi.fn();
    const setRuntimeVariables = vi.fn();
    const setJobConfig = vi.fn();
    const setPipelineConfig = vi.fn();
    const setFilename = vi.fn();
    const setProjectId = vi.fn();

    renderHook(() =>
      useVsCodeBridge({
        setNodes,
        setEdges,
        setRuntimeVariables,
        setJobConfig,
        pipelineConfig: { language: 'Python', outputFolder: '', needsRebuild: false },
        setPipelineConfig,
        filename: 'test',
        setFilename,
        projectId: 'proj',
        setProjectId,
      })
    );

    expect(mockPostMessage).toHaveBeenCalledWith({ command: 'ready' });
    expect(mockPostMessage).toHaveBeenCalledWith({ command: 'getSubnetworks' });
    expect(mockPostMessage).toHaveBeenCalledWith({ command: 'getSamples' });
  });

  it('handles loadPipeline message and parses YAML pipeline data', () => {
    const setNodes = vi.fn();
    const setEdges = vi.fn();
    const setRuntimeVariables = vi.fn();
    const setJobConfig = vi.fn();
    const setPipelineConfig = vi.fn();
    const setFilename = vi.fn();
    const setProjectId = vi.fn();

    const { result } = renderHook(() =>
      useVsCodeBridge({
        setNodes,
        setEdges,
        setRuntimeVariables,
        setJobConfig,
        pipelineConfig: { language: 'Python', outputFolder: '', needsRebuild: false },
        setPipelineConfig,
        filename: 'default_job',
        setFilename,
        projectId: 'proj',
        setProjectId,
      })
    );

    const yamlData = `
nodes:
  - id: '1'
    type: 'pipeline'
    position: { x: 100, y: 100 }
    data: { label: 'Node 1', type: 'SOURCE', iconName: 'Radio' }
edges: []
runtimeVariables:
  - key: 'JOB_ID'
    value: 'my_job'
pipelineConfig:
  language: Python
  outputFolder: 'output/path'
  needsRebuild: false
`;

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            command: 'loadPipeline',
            filename: 'my_job.beam',
            data: yamlData,
          },
        })
      );
    });

    expect(setFilename).toHaveBeenCalledWith('my_job.beam');
    expect(setNodes).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: '1' }),
      ])
    );
    expect(setEdges).toHaveBeenCalledWith([]);
    expect(result.current.isLoaded).toBe(true);
  });

  it('clears selectedFileName and selectedFileContent on codeRegenerated', () => {
    const setNodes = vi.fn();
    const setEdges = vi.fn();
    const setRuntimeVariables = vi.fn();
    const setJobConfig = vi.fn();
    const setPipelineConfig = vi.fn();
    const setFilename = vi.fn();
    const setProjectId = vi.fn();

    const { result } = renderHook(() =>
      useVsCodeBridge({
        setNodes,
        setEdges,
        setRuntimeVariables,
        setJobConfig,
        pipelineConfig: { language: 'Python', outputFolder: 'custom/out', needsRebuild: true },
        setPipelineConfig,
        filename: 'my_job',
        setFilename,
        projectId: 'proj',
        setProjectId,
      })
    );

    act(() => {
      result.current.setSelectedFileName('old_file.py');
      result.current.setSelectedFileContent('old content');
    });

    expect(result.current.selectedFileName).toBe('old_file.py');
    expect(result.current.selectedFileContent).toBe('old content');

    mockPostMessage.mockClear();

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            command: 'codeRegenerated',
            success: true,
            code: '# new code',
          },
        })
      );
    });

    // Both filename and file content must be cleared
    expect(result.current.selectedFileName).toBeNull();
    expect(result.current.selectedFileContent).toBeNull();
    expect(result.current.generatedCode).toBe('# new code');
    expect(result.current.isGenerating).toBe(false);

    // Verifies folder files refresh was requested for current outputFolder
    expect(mockPostMessage).toHaveBeenCalledWith({
      command: 'readFolderFiles',
      folderPath: 'custom/out',
    });
  });

  it('refreshFolderFiles falls back to pipelineConfigRef.current.outputFolder', () => {
    const setNodes = vi.fn();
    const setEdges = vi.fn();
    const setRuntimeVariables = vi.fn();
    const setJobConfig = vi.fn();
    const setPipelineConfig = vi.fn();
    const setFilename = vi.fn();
    const setProjectId = vi.fn();

    let config: PipelineConfig = { language: 'Python', outputFolder: 'initial/folder', needsRebuild: false };

    const { result, rerender } = renderHook(
      (props) => useVsCodeBridge(props),
      {
        initialProps: {
          setNodes,
          setEdges,
          setRuntimeVariables,
          setJobConfig,
          pipelineConfig: config,
          setPipelineConfig,
          filename: 'job',
          setFilename,
          projectId: 'p',
          setProjectId,
        },
      }
    );

    mockPostMessage.mockClear();

    // Re-render with new outputFolder
    config = { language: 'Python', outputFolder: 'updated/folder', needsRebuild: false };
    rerender({
      setNodes,
      setEdges,
      setRuntimeVariables,
      setJobConfig,
      pipelineConfig: config,
      setPipelineConfig,
      filename: 'job',
      setFilename,
      projectId: 'p',
      setProjectId,
    });

    act(() => {
      result.current.refreshFolderFiles();
    });

    // Must have used the updated folder from ref without requiring dependency update
    expect(mockPostMessage).toHaveBeenCalledWith({
      command: 'readFolderFiles',
      folderPath: 'updated/folder',
    });
  });

  it('updates tokenUsage when receiving codeRegenerated message with tokenUsage', () => {
    const setNodes = vi.fn();
    const setEdges = vi.fn();
    const setRuntimeVariables = vi.fn();
    const setJobConfig = vi.fn();
    const setPipelineConfig = vi.fn();
    const setFilename = vi.fn();
    const setProjectId = vi.fn();

    const { result } = renderHook(() =>
      useVsCodeBridge({
        setNodes,
        setEdges,
        setRuntimeVariables,
        setJobConfig,
        pipelineConfig: { language: 'Python', outputFolder: 'custom/out', needsRebuild: false },
        setPipelineConfig,
        filename: 'my_job',
        setFilename,
        projectId: 'proj',
        setProjectId,
      })
    );

    expect(result.current.tokenUsage).toBeNull();

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            command: 'codeRegenerated',
            success: true,
            code: '# new code',
            tokenUsage: {
              inputTokens: 1200,
              outputTokens: 650,
              totalTokens: 1850,
            },
          },
        })
      );
    });

    expect(result.current.tokenUsage).toEqual({
      inputTokens: 1200,
      outputTokens: 650,
      totalTokens: 1850,
    });
  });

  it('updates tokenUsage when receiving folderFilesRead message with tokenUsage', () => {
    const setNodes = vi.fn();
    const setEdges = vi.fn();
    const setRuntimeVariables = vi.fn();
    const setJobConfig = vi.fn();
    const setPipelineConfig = vi.fn();
    const setFilename = vi.fn();
    const setProjectId = vi.fn();

    const { result } = renderHook(() =>
      useVsCodeBridge({
        setNodes,
        setEdges,
        setRuntimeVariables,
        setJobConfig,
        pipelineConfig: { language: 'Python', outputFolder: 'custom/out', needsRebuild: false },
        setPipelineConfig,
        filename: 'my_job',
        setFilename,
        projectId: 'proj',
        setProjectId,
      })
    );

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            command: 'folderFilesRead',
            files: ['pipeline.py'],
            tokenUsage: {
              inputTokens: 3000,
              outputTokens: 1500,
              totalTokens: 4500,
            },
          },
        })
      );
    });

    expect(result.current.tokenUsage).toEqual({
      inputTokens: 3000,
      outputTokens: 1500,
      totalTokens: 4500,
    });
  });
});

