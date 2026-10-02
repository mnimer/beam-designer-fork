/**
 * @fileoverview Hook managing pipeline execution lifecycle, logs, and extension host IPC.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Responsibilities:
 * - Tracks pipeline execution status ('idle' | 'running' | 'completed' | 'failed' | 'stopped').
 * - Manages execution log streaming with bound capping (MAX_EXECUTION_LOG_LINES = 5000) to prevent memory leaks.
 * - Manages active runner command string.
 * - Dispatches outbound runPipeline and stopPipeline commands to extension host.
 * - Listens for live execution messages from extension host (pipelineStarted, pipelineLog,
 *   pipelineJobIdDetected, pipelineFinished, pipelineStopped).
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { LogEntry } from '../components/BottomPanel/DeploymentTab';
import type { LogStream } from '../utils/sharedTypes';
import type { PipelineConfig } from '../state/pipelineConfigReducer';
import type { RuntimeVariable } from './useRuntimeVariables';
import { postToHost } from '../bridge/vscodeApi';
import type { WebviewToHostMessage } from '../utils/protocol';

export type { LogEntry, LogStream };

/**
 * Valid execution states for an Apache Beam pipeline run.
 */
export type PipelineStatus = 'idle' | 'running' | 'completed' | 'failed' | 'stopped';

/**
 * Maximum number of log lines retained in memory.
 * Oldest log lines beyond this cap are dropped to prevent memory exhaustion during long-running jobs.
 */
export const MAX_EXECUTION_LOG_LINES = 5000;

/**
 * Appends a new log entry to the log array, capping the result at `maxLines` by dropping oldest entries.
 *
 * @param prev Current log entries.
 * @param newEntry Entry to append.
 * @param maxLines Maximum allowable log lines (defaults to MAX_EXECUTION_LOG_LINES).
 * @returns Updated array with length <= maxLines.
 */
export function appendLog(
  prev: LogEntry[],
  newEntry: LogEntry,
  maxLines = MAX_EXECUTION_LOG_LINES
): LogEntry[] {
  const updated = [...prev, newEntry];
  if (updated.length > maxLines) {
    return updated.slice(updated.length - maxLines);
  }
  return updated;
}

/**
 * Options for the `usePipelineExecution` hook.
 */
export interface UsePipelineExecutionOptions<TConfig extends Record<string, unknown> = Record<string, unknown>> {
  jobConfig: TConfig;
  runtimeVariables: RuntimeVariable[];
  pipelineConfig: PipelineConfig;
  setJobConfig?: React.Dispatch<React.SetStateAction<TConfig>>;
  projectId?: string;
  /**
   * Optional VS Code API instance override.
   * @internal Test seam allowing mock message posting in unit tests.
   */
  vscode?: { postMessage: (message: unknown) => void } | null;
}

/**
 * Result shape returned by the `usePipelineExecution` hook.
 */
export interface UsePipelineExecutionResult {
  pipelineLogs: LogEntry[];
  setPipelineLogs: React.Dispatch<React.SetStateAction<LogEntry[]>>;
  pipelineStatus: PipelineStatus;
  setPipelineStatus: React.Dispatch<React.SetStateAction<PipelineStatus>>;
  runnerCommand: string;
  setRunnerCommand: React.Dispatch<React.SetStateAction<string>>;
  handleRunNow: () => void;
  handleStopPipeline: () => void;
  handleClearLogs: () => void;
}

/**
 * Hook for managing pipeline execution state, log streaming, and extension host IPC.
 *
 * @param options Pipeline configurations, variables, and dispatchers.
 * @returns Execution states, log buffer, and control handlers.
 */
export function usePipelineExecution<TConfig extends Record<string, unknown> = Record<string, unknown>>({
  jobConfig,
  runtimeVariables,
  pipelineConfig,
  setJobConfig,
  projectId,
  vscode,
}: UsePipelineExecutionOptions<TConfig>): UsePipelineExecutionResult {
  const [pipelineLogs, setPipelineLogs] = useState<LogEntry[]>([]);
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatus>('idle');
  const [runnerCommand, setRunnerCommand] = useState<string>('');

  // Refs for freshest configs to prevent stale closures without reattaching event listeners
  const jobConfigRef = useRef(jobConfig);
  const runtimeVariablesRef = useRef(runtimeVariables);
  const pipelineConfigRef = useRef(pipelineConfig);
  const setJobConfigRef = useRef(setJobConfig);
  const projectIdRef = useRef(projectId);
  const vscodeRef = useRef(vscode);

  // Synchronise refs in effect to avoid accessing/updating refs during render
  useEffect(() => {
    jobConfigRef.current = jobConfig;
    runtimeVariablesRef.current = runtimeVariables;
    pipelineConfigRef.current = pipelineConfig;
    setJobConfigRef.current = setJobConfig;
    projectIdRef.current = projectId;
    vscodeRef.current = vscode;
  }, [jobConfig, runtimeVariables, pipelineConfig, setJobConfig, projectId, vscode]);

  const post = useCallback((message: WebviewToHostMessage) => {
    const customVs = vscodeRef.current;
    if (customVs && typeof customVs.postMessage === 'function') {
      customVs.postMessage(message);
    } else {
      postToHost(message);
    }
  }, []);

  // Outbound run handler: clears logs, sets status to running, posts runPipeline command
  const handleRunNow = useCallback(() => {
    console.log('[@usePipelineExecution] handleRunNow called');
    setPipelineLogs([]);
    setPipelineStatus('running');
    post({
      command: 'runPipeline',
      jobConfig: jobConfigRef.current,
      runtimeVariables: runtimeVariablesRef.current,
      pipelineConfig: pipelineConfigRef.current,
    });
  }, [post]);

  // Outbound stop handler: posts stopPipeline command
  const handleStopPipeline = useCallback(() => {
    console.log('[@usePipelineExecution] handleStopPipeline called');
    post({
      command: 'stopPipeline',
    });
  }, [post]);

  // Clear logs handler
  const handleClearLogs = useCallback(() => {
    setPipelineLogs([]);
  }, []);

  // Inbound execution event listener from extension host
  useEffect(() => {
    const handleExecutionMessage = (event: MessageEvent) => {
      const message = event.data;
      if (!message) return;

      if (message.command === 'pipelineStarted') {
        setPipelineStatus('running');
        if (message.commandLine) {
          setRunnerCommand(message.commandLine);
        }
        const startEntry: LogEntry = {
          id: `start-${Date.now()}`,
          text: `[${new Date().toLocaleTimeString()}] Pipeline execution initiated (${message.runner || 'DirectRunner'})...\n`,
          stream: 'stdout',
          timestamp: new Date().toLocaleTimeString(),
        };
        setPipelineLogs((prev) => appendLog(prev, startEntry));
      } else if (message.command === 'pipelineLog') {
        const stream: LogStream = message.stream === 'stderr' ? 'stderr' : 'stdout';
        const logEntry: LogEntry = {
          id: `log-${Date.now()}-${Math.random()}`,
          text: message.text || '',
          stream,
          timestamp: new Date().toLocaleTimeString(),
        };
        setPipelineLogs((prev) => appendLog(prev, logEntry));
      } else if (message.command === 'pipelineJobIdDetected') {
        if (setJobConfigRef.current) {
          setJobConfigRef.current((prev: TConfig) => ({
            ...prev,
            jobId: message.jobId,
            region: message.region || (prev as Record<string, unknown>).region || 'us-central1',
            projectId: message.projectId || (prev as Record<string, unknown>).projectId || projectIdRef.current,
          }));
        }
      } else if (message.command === 'pipelineFinished') {
        setPipelineStatus(message.status || (message.exitCode === 0 ? 'completed' : 'failed'));
      } else if (message.command === 'pipelineStopped') {
        setPipelineStatus('stopped');
      }
    };

    window.addEventListener('message', handleExecutionMessage);
    return () => window.removeEventListener('message', handleExecutionMessage);
  }, []);

  return {
    pipelineLogs,
    setPipelineLogs,
    pipelineStatus,
    setPipelineStatus,
    runnerCommand,
    setRunnerCommand,
    handleRunNow,
    handleStopPipeline,
    handleClearLogs,
  };
}
