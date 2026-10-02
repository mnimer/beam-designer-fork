/**
 * @fileoverview Execution terminal sandbox displaying live runner command and log streams.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

import React, { useState, useEffect, useRef } from 'react';
import { Terminal, ExternalLink, Copy, Check, RotateCcw } from 'lucide-react';
import { getLogLineColorClass } from './logClassifier';
import type { LogStream } from '../../../utils/sharedTypes';

/**
 * Log entry payload from pipeline execution.
 */
export interface LogEntry {
  id: string;
  text: string;
  stream: LogStream;
  timestamp: string;
}

/**
 * Props for the ExecutionTerminal component.
 */
export interface ExecutionTerminalProps {
  /** Currently selected runner identifier ('DirectRunner' | 'Dataflow' | 'Spark') */
  runner: string;
  /** Command line string to preview in the terminal header */
  displayedCommand: string;
  /** Array of streamed log entries from stdout/stderr */
  pipelineLogs?: LogEntry[];
  /** Optional Cloud Console URL for the active or completed job */
  gcpConsoleUrl?: string;
  /** Callback invoked when the user clicks the open console button */
  onOpenConsole?: (url: string) => void;
  /** Callback invoked when the user clicks the clear logs button */
  onClearLogs?: () => void;
}

/**
 * Terminal sandbox panel rendering runner command preview and auto-scrolling log lines.
 */
export const ExecutionTerminal: React.FC<ExecutionTerminalProps> = ({
  runner,
  displayedCommand,
  pipelineLogs = [],
  gcpConsoleUrl,
  onOpenConsole,
  onClearLogs,
}) => {
  const [copiedLogs, setCopiedLogs] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll terminal log viewer on new log entries
  useEffect(() => {
    if (logsEndRef.current && typeof logsEndRef.current.scrollIntoView === 'function') {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [pipelineLogs]);

  // Copy all terminal logs to clipboard
  const handleCopyLogs = () => {
    const fullLogText = pipelineLogs.map(l => l.text).join('');
    if (navigator.clipboard && fullLogText) {
      navigator.clipboard.writeText(fullLogText);
      setCopiedLogs(true);
      setTimeout(() => setCopiedLogs(false), 2000);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-[#161922] rounded-xl border border-slate-700/80 overflow-hidden shadow-lg min-w-0">
      {/* Panel Header */}
      <div className="border-b border-slate-700/80 bg-[#11141c] py-2.5 px-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span className="text-xs font-bold tracking-wider text-slate-200 uppercase">
            EXECUTION SANDBOX
          </span>
          <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-slate-800 text-slate-300 border border-slate-700">
            {runner === 'DirectRunner' ? 'local' : runner === 'Dataflow' ? 'dataflow' : 'spark'}
          </span>
        </div>

        {/* GCP Cloud Console Link if Job ID is present */}
        {gcpConsoleUrl && (
          <button
            type="button"
            onClick={() => onOpenConsole ? onOpenConsole(gcpConsoleUrl) : window.open(gcpConsoleUrl, '_blank', 'noopener,noreferrer')}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded bg-blue-600/20 text-blue-300 border border-blue-500/40 hover:bg-blue-600/30 transition cursor-pointer"
            title="Open job in Google Cloud Console"
          >
            <span>Open in GCP Console</span>
            <ExternalLink className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Sandbox Content Area */}
      <div className="flex-1 flex flex-col p-4 overflow-hidden gap-3 min-h-0">
        {/* Runner Command Preview Card */}
        <div className="flex flex-col gap-1.5 shrink-0">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            RUNNER COMMAND
          </span>
          <div className="bg-[#0d1017] p-3 rounded-lg border border-slate-800 font-mono text-xs text-slate-300 whitespace-pre-wrap select-all leading-relaxed">
            {displayedCommand}
          </div>
        </div>

        {/* Runner Output Log Viewer */}
        <div className="flex-1 flex flex-col min-h-0 bg-[#0d1017] rounded-lg border border-slate-800 overflow-hidden">
          {/* Log Header Toolbar */}
          <div className="border-b border-slate-800 bg-[#11141c]/90 px-3 py-1.5 flex items-center justify-between shrink-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              RUNNER OUTPUT
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyLogs}
                disabled={pipelineLogs.length === 0}
                className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-slate-400 hover:text-white hover:bg-slate-800/80 rounded transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                title="Copy logs to clipboard"
              >
                {copiedLogs ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedLogs ? 'Copied' : 'Copy'}</span>
              </button>
              {onClearLogs && (
                <button
                  type="button"
                  onClick={onClearLogs}
                  disabled={pipelineLogs.length === 0}
                  className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-slate-400 hover:text-rose-400 hover:bg-slate-800/80 rounded transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Clear runner logs"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Clear</span>
                </button>
              )}
            </div>
          </div>

          {/* Terminal Stream Viewport */}
          <div className="flex-1 p-3 overflow-y-auto font-mono text-xs leading-relaxed select-text space-y-0.5">
            {pipelineLogs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-2 font-mono text-xs py-10">
                <Terminal className="w-8 h-8 text-slate-600 opacity-60" />
                <span>Press &apos;RUN PIPELINE&apos; to execute or deploy</span>
              </div>
            ) : (
              pipelineLogs.flatMap((entry) => {
                const lines = entry.text.split('\n');
                return lines.map((line, idx) => {
                  if (!line && idx === lines.length - 1) return null;
                  const colorClass = getLogLineColorClass(line, entry.stream);

                  return (
                    <div 
                      key={`${entry.id}-${idx}`} 
                      className={`whitespace-pre-wrap ${colorClass}`}
                    >
                      {line || '\u00A0'}
                    </div>
                  );
                });
              })
            )}
            <div ref={logsEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
};
