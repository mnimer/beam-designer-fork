/**
 * Unit tests for useVsCodeBridge hook
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Tests:
 * - IPC handshake (ready, getSubnetworks, getSamples)
 * - Handling loadPipeline message and updating pipeline state
 * - Handling the deferred projectIdResolved message (P9) without clobbering user input
 * - Handling codeRegenerated message and clearing selected file state
 * - Stale closure avoidance via render-time ref assignments
 * - findMainPipelineFile resolution logic
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useVsCodeBridge,
  findMainPipelineFile,
  isPlaceholderProjectId,
  PLACEHOLDER_PROJECT_ID,
  type PipelineConfig,
} from './useVsCodeBridge';

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

describe('isPlaceholderProjectId', () => {
  it('treats the placeholder, empty, whitespace and undefined as unset', () => {
    expect(isPlaceholderProjectId(PLACEHOLDER_PROJECT_ID)).toBe(true);
    expect(isPlaceholderProjectId('')).toBe(true);
    expect(isPlaceholderProjectId('   ')).toBe(true);
    expect(isPlaceholderProjectId(undefined)).toBe(true);
  });

  it('treats any other value as a real project', () => {
    expect(isPlaceholderProjectId('my-project')).toBe(false);
  });
});

describe('useVsCodeBridge - projectIdResolved (P9 deferred gcloud lookup)', () => {
  beforeEach(() => {
    (window as any).vscode = { postMessage: vi.fn() };
  });

  afterEach(() => {
    delete (window as any).vscode;
  });

  /** Renders the hook with the given current projectId and returns the setter spy. */
  const renderWithProject = (projectId: string) => {
    const setProjectId = vi.fn();
    renderHook(() =>
      useVsCodeBridge({
        setNodes: vi.fn(),
        setEdges: vi.fn(),
        setRuntimeVariables: vi.fn(),
        setJobConfig: vi.fn(),
        pipelineConfig: { language: 'Python', outputFolder: '', needsRebuild: false },
        setPipelineConfig: vi.fn(),
        filename: 'test',
        setFilename: vi.fn(),
        projectId,
        setProjectId,
      })
    );
    return setProjectId;
  };

  const dispatchResolved = (projectId: string | undefined) => {
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', { data: { command: 'projectIdResolved', projectId } })
      );
    });
  };

  it('fills in the project when the webview still shows the placeholder', () => {
    const setProjectId = renderWithProject(PLACEHOLDER_PROJECT_ID);
    dispatchResolved('gcloud-default');
    expect(setProjectId).toHaveBeenCalledWith('gcloud-default');
  });

  it('fills in the project when the current value is empty', () => {
    const setProjectId = renderWithProject('');
    dispatchResolved('gcloud-default');
    expect(setProjectId).toHaveBeenCalledWith('gcloud-default');
  });

  it('does not clobber a project the user (or the pipeline) already set', () => {
    // The lookup can take seconds; by then the user may have typed a value or the
    // loaded .beam may have supplied one. The late gcloud answer must lose.
    const setProjectId = renderWithProject('user-typed-project');
    dispatchResolved('gcloud-default');
    expect(setProjectId).not.toHaveBeenCalled();
  });

  it('ignores an empty resolution (gcloud unavailable)', () => {
    const setProjectId = renderWithProject(PLACEHOLDER_PROJECT_ID);
    dispatchResolved(undefined);
    expect(setProjectId).not.toHaveBeenCalled();
  });

  it('still honours the legacy projectId field on loadPipeline', () => {
    const setProjectId = renderWithProject(PLACEHOLDER_PROJECT_ID);
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { command: 'loadPipeline', filename: 'a.beam', data: null, projectId: 'legacy-proj' },
        })
      );
    });
    expect(setProjectId).toHaveBeenCalledWith('legacy-proj');
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

  afterEach(() => {
    delete (window as any).vscode;
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

  afterEach(() => {
    delete (window as any).vscode;
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

  it('resets isGenerating when receiving codeGenerationStopped message', () => {
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

    expect(result.current.isGenerating).toBe(false);

    act(() => {
      result.current.handleRegenerate({
        nodes: [],
        edges: [],
        runtimeVariables: [],
        jobConfig: {},
      });
    });

    expect(result.current.isGenerating).toBe(true);

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            command: 'codeGenerationStopped',
          },
        })
      );
    });

    expect(result.current.isGenerating).toBe(false);
  });

  it('logs a warning when codeRegenerated reports failure with an error message', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
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
      result.current.handleRegenerate({
        nodes: [],
        edges: [],
        runtimeVariables: [],
        jobConfig: {},
      });
    });

    expect(result.current.isGenerating).toBe(true);

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            command: 'codeRegenerated',
            success: false,
            error: 'Generation timed out',
          },
        })
      );
    });

    expect(result.current.isGenerating).toBe(false);
    expect(warnSpy).toHaveBeenCalledWith(
      '[useVsCodeBridge] Code generation failed:',
      'Generation timed out'
    );

    warnSpy.mockRestore();
  });

  it('does not console.log YAML data or raw message on loadPipeline', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
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
        filename: 'default_job',
        setFilename,
        projectId: 'proj',
        setProjectId,
      })
    );

    const secretValue = 'SUPER_SECRET_RUNTIME_KEY_98765';
    const yamlData = `
nodes: []
edges: []
runtimeVariables:
  - key: 'SECRET_KEY'
    value: '${secretValue}'
`;

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            command: 'loadPipeline',
            filename: 'test_pipeline.beam',
            data: yamlData,
          },
        })
      );
    });

    // Verify secret value is never logged to devtools console
    for (const callArgs of logSpy.mock.calls) {
      const callString = JSON.stringify(callArgs);
      expect(callString).not.toContain(secretValue);
      expect(callString).not.toContain('Parsed YAML data:');
    }

    // Verify sanitized log message format
    expect(logSpy).toHaveBeenCalledWith('[useVsCodeBridge] Received loadPipeline for', 'test_pipeline.beam');

    logSpy.mockRestore();
  });

  it('updates selectedFileContent when receiving fileContentLoaded message', () => {
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

    expect(result.current.selectedFileContent).toBeNull();

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            command: 'fileContentLoaded',
            filePath: 'pipeline.py',
            content: 'import apache_beam as beam',
          },
        })
      );
    });

    expect(result.current.selectedFileContent).toBe('import apache_beam as beam');
  });

  it('updates selectedFileContent with error text when receiving fileContentError message', () => {
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
            command: 'fileContentError',
            filePath: 'missing.py',
            error: 'File does not exist',
          },
        })
      );
    });

    expect(result.current.selectedFileContent).toBe('// Unable to display missing.py: File does not exist');
  });

  it('folderSelected: re-selecting the same output folder does not dirty the pipeline or reallocate reference', () => {
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
            command: 'folderSelected',
            path: 'custom/out',
          },
        })
      );
    });

    expect(setPipelineConfig).toHaveBeenCalledTimes(1);
    const updater = setPipelineConfig.mock.calls[0][0];
    const prev = { language: 'Python' as const, outputFolder: 'custom/out', needsRebuild: false };
    const next = updater(prev);
    expect(next).toBe(prev);
    expect(next.needsRebuild).toBe(false);
  });

  it('folderSelected: selecting a different output folder sets needsRebuild to true', () => {
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
            command: 'folderSelected',
            path: 'new/different/out',
          },
        })
      );
    });

    expect(setPipelineConfig).toHaveBeenCalledTimes(1);
    const updater = setPipelineConfig.mock.calls[0][0];
    const prev = { language: 'Python' as const, outputFolder: 'custom/out', needsRebuild: false };
    const next = updater(prev);
    expect(next.outputFolder).toBe('new/different/out');
    expect(next.needsRebuild).toBe(true);
  });

  it('normalizes lowercase java to Java and unsupported go to Python on loadPipeline', () => {
    const setPipelineConfig = vi.fn();
    renderHook(() =>
      useVsCodeBridge({
        setNodes: vi.fn(),
        setEdges: vi.fn(),
        setRuntimeVariables: vi.fn(),
        setJobConfig: vi.fn(),
        pipelineConfig: { language: 'Python', outputFolder: '', needsRebuild: false },
        setPipelineConfig,
        filename: 'test',
        setFilename: vi.fn(),
        projectId: 'proj',
        setProjectId: vi.fn(),
      })
    );

    // 1. Loading with language: java (lowercase)
    const yamlJava = `
nodes: []
edges: []
pipelineConfig:
  language: java
  outputFolder: 'out'
`;
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            command: 'loadPipeline',
            filename: 'test.beam',
            data: yamlJava,
          },
        })
      );
    });

    const javaUpdater = setPipelineConfig.mock.calls[setPipelineConfig.mock.calls.length - 1][0];
    const initialConfig: PipelineConfig = { language: 'Python', outputFolder: '', needsRebuild: false };
    const resultingConfigJava = javaUpdater(initialConfig);
    expect(resultingConfigJava.language).toBe('Java');

    // 2. Loading with language: go (unsupported)
    const yamlGo = `
nodes: []
edges: []
pipelineConfig:
  language: go
  outputFolder: 'out'
`;
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            command: 'loadPipeline',
            filename: 'test.beam',
            data: yamlGo,
          },
        })
      );
    });

    const goUpdater = setPipelineConfig.mock.calls[setPipelineConfig.mock.calls.length - 1][0];
    const resultingConfigGo = goUpdater(initialConfig);
    expect(resultingConfigGo.language).toBe('Python');
  });
});


