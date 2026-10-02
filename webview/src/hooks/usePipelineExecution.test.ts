/**
 * @fileoverview Unit tests for usePipelineExecution hook.
 *
 * Tests:
 * - Initial state (status, logs, runnerCommand)
 * - handleRunNow posts runPipeline with exact payload, resets logs, sets status to running
 * - handleStopPipeline posts stopPipeline with exact payload
 * - handleClearLogs resets logs
 * - Incoming message events (pipelineStarted, pipelineLog, pipelineJobIdDetected, pipelineFinished, pipelineStopped)
 * - Log capping at MAX_EXECUTION_LOG_LINES (5000 lines, dropping oldest)
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import {
  usePipelineExecution,
  appendLog,
  MAX_EXECUTION_LOG_LINES,
  type UsePipelineExecutionOptions,
} from './usePipelineExecution';
import type { LogEntry } from '../components/BottomPanel/DeploymentTab';

describe('usePipelineExecution', () => {
  const sampleJobConfig = {
    runner: 'DataflowRunner',
    projectId: 'test-project',
    region: 'us-central1',
    jobId: 'my-job-123',
  };

  const sampleRuntimeVariables = [
    { key: 'LOG_LEVEL', value: 'INFO' },
    { key: 'NUM_WORKERS', value: '4' },
  ];

  const samplePipelineConfig = {
    language: 'Python' as const,
    outputFolder: '/workspace/output',
    needsRebuild: false,
  };

  const setup = (options?: Partial<UsePipelineExecutionOptions>) => {
    const mockPostMessage = vi.fn();
    const setJobConfig = vi.fn();

    const hook = renderHook(
      (props: UsePipelineExecutionOptions) => usePipelineExecution(props),
      {
        initialProps: {
          jobConfig: sampleJobConfig,
          runtimeVariables: sampleRuntimeVariables,
          pipelineConfig: samplePipelineConfig,
          setJobConfig,
          projectId: 'test-project',
          vscode: { postMessage: mockPostMessage },
          ...options,
        },
      }
    );

    return { ...hook, mockPostMessage, setJobConfig };
  };

  it('initializes with default execution state', () => {
    const { result } = setup();

    expect(result.current.pipelineLogs).toEqual([]);
    expect(result.current.pipelineStatus).toBe('idle');
    expect(result.current.runnerCommand).toBe('');
  });

  it('handleRunNow posts runPipeline with exact payload, resets logs, and sets status to running', () => {
    const { result, mockPostMessage } = setup();

    // Populate existing log to verify it resets on run
    act(() => {
      result.current.setPipelineLogs([
        { id: '1', text: 'previous log', stream: 'stdout', timestamp: '12:00:00' },
      ]);
    });
    expect(result.current.pipelineLogs).toHaveLength(1);

    act(() => {
      result.current.handleRunNow();
    });

    expect(result.current.pipelineLogs).toEqual([]);
    expect(result.current.pipelineStatus).toBe('running');
    expect(mockPostMessage).toHaveBeenCalledTimes(1);
    expect(mockPostMessage).toHaveBeenCalledWith({
      command: 'runPipeline',
      jobConfig: sampleJobConfig,
      runtimeVariables: sampleRuntimeVariables,
      pipelineConfig: samplePipelineConfig,
    });
  });

  it('handleStopPipeline posts stopPipeline with exact payload', () => {
    const { result, mockPostMessage } = setup();

    act(() => {
      result.current.handleStopPipeline();
    });

    expect(mockPostMessage).toHaveBeenCalledTimes(1);
    expect(mockPostMessage).toHaveBeenCalledWith({
      command: 'stopPipeline',
    });
  });

  it('handleClearLogs resets logs to an empty array', () => {
    const { result } = setup();

    act(() => {
      result.current.setPipelineLogs([
        { id: '1', text: 'log 1', stream: 'stdout', timestamp: '12:00:00' },
      ]);
    });
    expect(result.current.pipelineLogs).toHaveLength(1);

    act(() => {
      result.current.handleClearLogs();
    });
    expect(result.current.pipelineLogs).toEqual([]);
  });

  describe('incoming extension host messages', () => {
    it('handles pipelineStarted: updates status, command line, and appends start log entry', () => {
      const { result } = setup();

      act(() => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: {
              command: 'pipelineStarted',
              commandLine: 'python -m my_pipeline --runner=DataflowRunner',
              runner: 'DataflowRunner',
            },
          })
        );
      });

      expect(result.current.pipelineStatus).toBe('running');
      expect(result.current.runnerCommand).toBe('python -m my_pipeline --runner=DataflowRunner');
      expect(result.current.pipelineLogs).toHaveLength(1);
      expect(result.current.pipelineLogs[0].text).toContain('Pipeline execution initiated (DataflowRunner)');
      expect(result.current.pipelineLogs[0].stream).toBe('stdout');
    });

    it('handles pipelineLog: appends log entries with correct stream', () => {
      const { result } = setup();

      act(() => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: {
              command: 'pipelineLog',
              text: 'INFO:root:Processing elements...',
              stream: 'stdout',
            },
          })
        );
      });

      act(() => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: {
              command: 'pipelineLog',
              text: 'WARN:root:High memory usage detected',
              stream: 'stderr',
            },
          })
        );
      });

      expect(result.current.pipelineLogs).toHaveLength(2);
      expect(result.current.pipelineLogs[0].text).toBe('INFO:root:Processing elements...');
      expect(result.current.pipelineLogs[0].stream).toBe('stdout');
      expect(result.current.pipelineLogs[1].text).toBe('WARN:root:High memory usage detected');
      expect(result.current.pipelineLogs[1].stream).toBe('stderr');
    });

    it('handles pipelineJobIdDetected: updates jobConfig via functional updater', () => {
      const { setJobConfig } = setup();

      act(() => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: {
              command: 'pipelineJobIdDetected',
              jobId: '2026-09-29_detected_job',
              region: 'us-east1',
              projectId: 'override-project',
            },
          })
        );
      });

      expect(setJobConfig).toHaveBeenCalledTimes(1);
      const updater = setJobConfig.mock.calls[0][0];
      const prevConfig = { runner: 'DataflowRunner', region: 'us-central1' };
      const updated = updater(prevConfig);
      expect(updated).toEqual({
        runner: 'DataflowRunner',
        jobId: '2026-09-29_detected_job',
        region: 'us-east1',
        projectId: 'override-project',
      });
    });

    it('handles pipelineFinished: sets status to completed or failed based on status / exitCode', () => {
      const { result } = setup();

      act(() => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: {
              command: 'pipelineFinished',
              exitCode: 0,
            },
          })
        );
      });
      expect(result.current.pipelineStatus).toBe('completed');

      act(() => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: {
              command: 'pipelineFinished',
              exitCode: 1,
            },
          })
        );
      });
      expect(result.current.pipelineStatus).toBe('failed');

      act(() => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: {
              command: 'pipelineFinished',
              status: 'custom-status',
            },
          })
        );
      });
      expect(result.current.pipelineStatus).toBe('custom-status');
    });

    it('handles pipelineStopped: sets status to stopped', () => {
      const { result } = setup();

      act(() => {
        result.current.setPipelineStatus('running');
      });
      expect(result.current.pipelineStatus).toBe('running');

      act(() => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: {
              command: 'pipelineStopped',
            },
          })
        );
      });
      expect(result.current.pipelineStatus).toBe('stopped');
    });
  });

  describe('log capping (MAX_EXECUTION_LOG_LINES)', () => {
    it('appendLog helper caps lines at provided max and drops oldest', () => {
      const initialLogs: LogEntry[] = [
        { id: '1', text: 'Line 1', stream: 'stdout', timestamp: '10:00:00' },
        { id: '2', text: 'Line 2', stream: 'stdout', timestamp: '10:00:01' },
        { id: '3', text: 'Line 3', stream: 'stdout', timestamp: '10:00:02' },
      ];

      const newEntry: LogEntry = {
        id: '4',
        text: 'Line 4',
        stream: 'stdout',
        timestamp: '10:00:03',
      };

      const result = appendLog(initialLogs, newEntry, 3);
      expect(result).toHaveLength(3);
      expect(result[0].text).toBe('Line 2');
      expect(result[1].text).toBe('Line 3');
      expect(result[2].text).toBe('Line 4');
    });

    it('caps execution logs at MAX_EXECUTION_LOG_LINES = 5000 in hook when receiving messages', () => {
      const { result } = setup();

      // Preload with MAX_EXECUTION_LOG_LINES entries
      const bulkLogs: LogEntry[] = Array.from({ length: MAX_EXECUTION_LOG_LINES }, (_, i) => ({
        id: `bulk-${i}`,
        text: `Log line ${i}`,
        stream: 'stdout',
        timestamp: '12:00:00',
      }));

      act(() => {
        result.current.setPipelineLogs(bulkLogs);
      });
      expect(result.current.pipelineLogs).toHaveLength(MAX_EXECUTION_LOG_LINES);

      // Add one more log via message event
      act(() => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: {
              command: 'pipelineLog',
              text: 'Log line 5000 (overflow)',
              stream: 'stdout',
            },
          })
        );
      });

      expect(result.current.pipelineLogs).toHaveLength(MAX_EXECUTION_LOG_LINES);
      // First line should now be index 1 ("Log line 1")
      expect(result.current.pipelineLogs[0].text).toBe('Log line 1');
      // Last line should be the newly appended one
      expect(result.current.pipelineLogs[MAX_EXECUTION_LOG_LINES - 1].text).toBe(
        'Log line 5000 (overflow)'
      );
    });
  });
});
