import React, { useState, useEffect, useRef } from 'react';
import { 
  Trash2, 
  Play, 
  Square, 
  Sliders, 
  Variable, 
  Terminal, 
  ExternalLink, 
  Copy, 
  Check, 
  Eye, 
  EyeOff, 
  Plus, 
  Loader2, 
  RotateCcw
} from 'lucide-react';

/**
 * LogEntry Interface
 */
export interface LogEntry {
  id: string;
  text: string;
  stream: 'stdout' | 'stderr';
  timestamp: string;
}

/**
 * DeploymentTab Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Renders the DEPLOYMENT tab in the bottom panel with a split layout:
 * - Left Panel (25%-30% width): Target environment configuration (DirectRunner, Dataflow, Serverless Spark),
 *   Dataflow machine options, worker scaling, and Runtime Values & Secrets manager.
 * - Right Panel (70%-75% width): Live Execution Sandbox streaming stdout/stderr logs from running pipelines
 *   with runner command preview, auto-scrolling terminal, copy/clear controls, and GCP Console deep links.
 * 
 * Architectural Decisions:
 * - Implements 25%/75% split matching the design specification.
 * - Captures child process output directly inside the webview instead of launching external VS Code terminals.
 * - Automatically detects GCP Dataflow Job IDs and Spark Batch IDs to persist in diagram JSON and display Cloud Console links.
 * - Adheres strictly to the 8pt grid system, Tailwind CSS tokens, and semantic dark theme colors.
 * - Adds secret masking (eye toggle) for sensitive runtime variable values.
 */
export interface DeploymentTabProps {
  jobConfig: {
    runner: string;
    machineType?: string;
    minInstances?: number;
    maxInstances?: number;
    gcsStagingPath?: string;
    network?: string;
    subnetwork?: string;
    jobId?: string;
    region?: string;
    projectId?: string;
  };
  setJobConfig: (config: any) => void;
  runtimeVariables: { key: string, value: string }[];
  addVariable: () => void;
  updateVariable: (index: number, field: 'key' | 'value', value: string) => void;
  deleteVariable: (index: number) => void;
  isJobIdValid: (value: string) => boolean;
  onRunNow: () => void;
  onStopPipeline?: () => void;
  subnetworks: {name: string, region: string, network: string, value: string}[];
  needsRebuild?: boolean;
  pipelineLogs?: LogEntry[];
  pipelineStatus?: 'idle' | 'running' | 'completed' | 'failed' | 'stopped';
  runnerCommand?: string;
  onClearLogs?: () => void;
  onOpenConsole?: (url: string) => void;
  projectId?: string;
}

export const DeploymentTab: React.FC<DeploymentTabProps> = ({
  jobConfig,
  setJobConfig,
  runtimeVariables,
  addVariable,
  updateVariable,
  deleteVariable,
  isJobIdValid,
  onRunNow,
  onStopPipeline,
  subnetworks,
  needsRebuild = false,
  pipelineLogs = [],
  pipelineStatus = 'idle',
  runnerCommand = '',
  onClearLogs,
  onOpenConsole,
  projectId = 'YOUR_PROJECT_ID'
}) => {
  const [copiedLogs, setCopiedLogs] = useState(false);
  const [visibleSecrets, setVisibleSecrets] = useState<Record<number, boolean>>({});
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll terminal log viewer on new log entries
  useEffect(() => {
    if (logsEndRef.current && typeof logsEndRef.current.scrollIntoView === 'function') {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [pipelineLogs]);

  // Toggle secret visibility for a specific runtime variable index
  const toggleSecretVisibility = (index: number) => {
    setVisibleSecrets(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  // Copy all terminal logs to clipboard
  const handleCopyLogs = () => {
    const fullLogText = pipelineLogs.map(l => l.text).join('');
    if (navigator.clipboard && fullLogText) {
      navigator.clipboard.writeText(fullLogText);
      setCopiedLogs(true);
      setTimeout(() => setCopiedLogs(false), 2000);
    }
  };

  // Compute GCP Cloud Console link when jobId is available
  const effectiveProjectId = jobConfig.projectId || projectId || 'YOUR_PROJECT_ID';
  const effectiveRegion = jobConfig.region || 'us-central1';
  let gcpConsoleUrl = '';
  if (jobConfig.jobId) {
    if (jobConfig.runner === 'Dataflow') {
      gcpConsoleUrl = `https://console.cloud.google.com/dataflow/jobs/${effectiveRegion}/${jobConfig.jobId}?project=${effectiveProjectId}`;
    } else if (jobConfig.runner === 'Spark') {
      gcpConsoleUrl = `https://console.cloud.google.com/dataproc/batches/${effectiveRegion}/${jobConfig.jobId}?project=${effectiveProjectId}`;
    }
  }

  // Format displayed runner command preview
  const defaultCommandPreview = jobConfig.runner === 'DirectRunner'
    ? `# Using Python / Java Direct Runner (Local Machine)\npython src/pipeline.py --runner=DirectRunner`
    : jobConfig.runner === 'Dataflow'
      ? `# Submitting Apache Beam Flex Template Job to Google Cloud Dataflow\ngcloud dataflow flex-template run ... --region=${effectiveRegion}`
      : `# Submitting Apache Beam Job to Serverless Spark (Dataproc)\ngcloud dataproc batches submit pyspark ...`;
  const displayedCommand = runnerCommand || defaultCommandPreview;

  // Compute status badge styling
  const renderStatusBadge = () => {
    switch (pipelineStatus) {
      case 'running':
        return (
          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1 animate-pulse">
            <Loader2 className="w-2.5 h-2.5 animate-spin" />
            Running
          </span>
        );
      case 'completed':
        return (
          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
            Success
          </span>
        );
      case 'failed':
        return (
          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40">
            Failed
          </span>
        );
      case 'stopped':
        return (
          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-slate-500/20 text-slate-300 border border-slate-500/40">
            Stopped
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40">
            Ready
          </span>
        );
    }
  };

  return (
    <div className="flex gap-4 h-full text-slate-300">
      {/* ========================================================================= */}
      {/* Left Panel (25%-30% width): Deployment & Runner Settings */}
      {/* ========================================================================= */}
      <div className="w-[30%] min-w-[300px] max-w-[380px] flex flex-col bg-[#161922] rounded-xl border border-slate-700/80 overflow-hidden shadow-lg">
        {/* Panel Header */}
        <div className="border-b border-slate-700/80 bg-[#11141c] py-2.5 px-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span className="text-xs font-bold tracking-wider text-slate-200 uppercase">
              DEPLOYMENT &amp; RUNNER
            </span>
          </div>
          {renderStatusBadge()}
        </div>

        {/* Panel Content */}
        <div className="flex-1 flex flex-col p-4 overflow-y-auto justify-between gap-4">
          <div className="flex flex-col gap-4">
            {/* Target Environment Selector */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Target Environment
              </label>
              <select 
                value={jobConfig.runner} 
                onChange={(e) => setJobConfig({...jobConfig, runner: e.target.value})}
                className="bg-[#0d1017] text-white px-3 py-2 rounded-lg border border-slate-800 focus:outline-none focus:border-blue-500 text-xs shadow-inner transition cursor-pointer"
              >
                <option value="DirectRunner">💻 Direct Runner (Local Machine)</option>
                <option value="Dataflow">☁️ Cloud Dataflow (Google Cloud)</option>
                <option value="Spark">⚡ Serverless Spark (Dataproc)</option>
              </select>
            </div>

            {/* Contextual Options: Google Cloud Dataflow */}
            {jobConfig.runner === 'Dataflow' && (
              <div className="flex flex-col gap-3 p-3 bg-[#0d1017]/80 rounded-lg border border-slate-800">
                <div className="text-[11px] font-bold uppercase tracking-wider text-blue-400">
                  Dataflow Options
                </div>

                {/* Machine Type */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Machine Type
                  </label>
                  <select 
                    value={jobConfig.machineType || 'n1-standard-1'} 
                    onChange={(e) => setJobConfig({...jobConfig, machineType: e.target.value})}
                    className="bg-[#161922] text-white px-2.5 py-1.5 rounded border border-slate-700 text-xs focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="n1-standard-1">n1-standard-1 (1 vCPU, 3.75 GB)</option>
                    <option value="n1-standard-2">n1-standard-2 (2 vCPU, 7.5 GB)</option>
                    <option value="n1-standard-4">n1-standard-4 (4 vCPU, 15 GB)</option>
                    <option value="n2-standard-2">n2-standard-2 (2 vCPU, 8 GB)</option>
                    <option value="n2-standard-4">n2-standard-4 (4 vCPU, 16 GB)</option>
                  </select>
                </div>

                {/* Min and Max Workers */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Min Workers
                    </label>
                    <input 
                      type="number" 
                      min={1} 
                      max={999} 
                      value={jobConfig.minInstances ?? 1} 
                      onChange={(e) => setJobConfig({...jobConfig, minInstances: parseInt(e.target.value, 10) || 1})}
                      className="bg-[#161922] text-white px-2.5 py-1.5 rounded border border-slate-700 text-xs font-mono focus:outline-none focus:border-blue-500 w-full"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Max Workers
                    </label>
                    <input 
                      type="number" 
                      min={1} 
                      max={999} 
                      value={jobConfig.maxInstances ?? 10} 
                      onChange={(e) => setJobConfig({...jobConfig, maxInstances: parseInt(e.target.value, 10) || 1})}
                      className="bg-[#161922] text-white px-2.5 py-1.5 rounded border border-slate-700 text-xs font-mono focus:outline-none focus:border-blue-500 w-full"
                    />
                  </div>
                </div>

                {/* GCS Staging Path */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    GCS Staging Path
                  </label>
                  <input 
                    type="text" 
                    value={jobConfig.gcsStagingPath || ''} 
                    onChange={(e) => setJobConfig({...jobConfig, gcsStagingPath: e.target.value})}
                    placeholder="gs://<bucket>/staging"
                    className="bg-[#161922] text-white px-2.5 py-1.5 rounded border border-slate-700 text-xs font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Subnetwork */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Subnetwork
                  </label>
                  <select 
                    value={jobConfig.subnetwork || ''} 
                    onChange={(e) => setJobConfig({...jobConfig, subnetwork: e.target.value})}
                    className="bg-[#161922] text-white px-2.5 py-1.5 rounded border border-slate-700 text-xs focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="">Default Subnetwork</option>
                    {subnetworks.map((sub, index) => (
                      <option key={index} value={sub.value}>{sub.name} ({sub.region})</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Contextual Options: Serverless Spark */}
            {jobConfig.runner === 'Spark' && (
              <div className="flex flex-col gap-3 p-3 bg-[#0d1017]/80 rounded-lg border border-slate-800">
                <div className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
                  Spark Options
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Subnetwork
                  </label>
                  <select 
                    value={jobConfig.subnetwork || ''} 
                    onChange={(e) => setJobConfig({...jobConfig, subnetwork: e.target.value})}
                    className="bg-[#161922] text-white px-2.5 py-1.5 rounded border border-slate-700 text-xs focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="">Default Subnetwork</option>
                    {subnetworks.map((sub, index) => (
                      <option key={index} value={sub.value}>{sub.name} ({sub.region})</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Runtime Values & Secrets Section */}
            <div className="flex flex-col gap-2 pt-2 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Variable className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                    RUNTIME VALUES &amp; SECRETS
                  </span>
                </div>
                <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded font-mono border border-slate-700">
                  {runtimeVariables.length} configured
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-tight">
                Secret keys and environment variables referenced by nodes in your diagram.
              </p>

              {/* Variables List */}
              <div className="flex flex-col gap-2 max-h-44 overflow-y-auto pr-1">
                {runtimeVariables.map((variable, index) => {
                  const isVisible = !!visibleSecrets[index];
                  const isSecretKey = variable.key.toLowerCase().includes('key') || 
                                      variable.key.toLowerCase().includes('secret') || 
                                      variable.key.toLowerCase().includes('password') || 
                                      variable.key.toLowerCase().includes('token');

                  return (
                    <div key={index} className="flex items-center gap-1.5 bg-[#0d1017] p-1.5 rounded-lg border border-slate-800">
                      <input
                        type="text"
                        value={variable.key}
                        onChange={(e) => updateVariable(index, 'key', e.target.value)}
                        placeholder="KEY"
                        className="bg-[#161922] text-white px-2 py-1 rounded border border-slate-700 focus:outline-none focus:border-blue-500 text-[11px] font-mono w-2/5 disabled:opacity-50"
                        disabled={variable.key === 'JOB_ID'}
                      />
                      <div className="relative flex-1">
                        <input
                          type={isSecretKey && !isVisible ? 'password' : 'text'}
                          value={variable.value}
                          onChange={(e) => updateVariable(index, 'value', e.target.value)}
                          placeholder="VALUE"
                          className={`bg-[#161922] px-2 py-1 rounded border border-slate-700 focus:outline-none focus:border-blue-500 text-[11px] font-mono w-full pr-6 ${
                            variable.key === 'JOB_ID' && !isJobIdValid(variable.value) ? 'text-red-400 border-red-800' : 'text-white'
                          }`}
                        />
                        {isSecretKey && (
                          <button
                            type="button"
                            onClick={() => toggleSecretVisibility(index)}
                            className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-0.5 rounded cursor-pointer"
                            title={isVisible ? 'Hide secret value' : 'Show secret value'}
                          >
                            {isVisible ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                          </button>
                        )}
                      </div>
                      {variable.key !== 'JOB_ID' && (
                        <button 
                          type="button"
                          onClick={() => deleteVariable(index)} 
                          className="text-slate-500 hover:text-red-400 p-1 rounded transition cursor-pointer"
                          title="Delete variable"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Add Variable Button */}
              <button 
                type="button"
                onClick={addVariable} 
                className="flex items-center justify-center gap-1.5 py-1.5 px-3 text-xs font-semibold text-blue-400 hover:text-blue-300 hover:bg-blue-950/40 border border-blue-900/50 rounded-lg transition cursor-pointer mt-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Variable</span>
              </button>
            </div>
          </div>

          {/* Action Buttons: Run Pipeline & Stop */}
          <div className="pt-3 border-t border-slate-800/80 flex gap-2.5">
            <button 
              type="button"
              onClick={onRunNow}
              disabled={needsRebuild || pipelineStatus === 'running'}
              className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-xs font-bold flex-1 cursor-pointer transition shadow-lg active:scale-[0.98] ${
                needsRebuild || pipelineStatus === 'running'
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed shadow-none' 
                  : 'bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white shadow-emerald-950/40'
              }`}
            >
              {pipelineStatus === 'running' ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>RUNNING...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>RUN PIPELINE</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onStopPipeline}
              className="bg-[#881337] hover:bg-[#9f1239] active:bg-[#4c0519] text-rose-200 hover:text-white px-3 py-2.5 rounded-lg text-xs font-bold w-1/4 transition cursor-pointer flex items-center justify-center gap-1.5 border border-rose-700/60 shadow-lg shadow-rose-950/30 active:scale-[0.98]"
              title="Kill running pipeline process"
            >
              <Square className="w-3 h-3 fill-current" />
              <span>STOP</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* Right Panel (70%-75% width): Live Execution Sandbox & Log Output */}
      {/* ========================================================================= */}
      <div className="flex-1 flex flex-col bg-[#161922] rounded-xl border border-slate-700/80 overflow-hidden shadow-lg min-w-0">
        {/* Panel Header */}
        <div className="border-b border-slate-700/80 bg-[#11141c] py-2.5 px-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="text-xs font-bold tracking-wider text-slate-200 uppercase">
              EXECUTION SANDBOX
            </span>
            <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-slate-800 text-slate-300 border border-slate-700">
              {jobConfig.runner === 'DirectRunner' ? 'local' : jobConfig.runner === 'Dataflow' ? 'dataflow' : 'spark'}
            </span>
          </div>

          {/* GCP Cloud Console Link if Job ID is present */}
          {gcpConsoleUrl && (
            <button
              type="button"
              onClick={() => onOpenConsole ? onOpenConsole(gcpConsoleUrl) : window.open(gcpConsoleUrl, '_blank')}
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
                    const upper = line.toUpperCase();
                    let colorClass = 'text-slate-200';

                    if (line.startsWith('[Execution completed')) {
                      colorClass = 'text-emerald-400 font-bold';
                    } else if (line.startsWith('[Execution stopped')) {
                      colorClass = 'text-amber-400 font-bold';
                    } else if (line.startsWith('[Execution failed') || line.startsWith('[Process execution error') || line.startsWith('[Error]')) {
                      colorClass = 'text-rose-400 font-bold';
                    } else if (
                      upper.includes('[SUCCESS]') || 
                      upper.includes('BUILD SUCCESS') || 
                      upper.includes('SUCCESS:') ||
                      upper.includes('STATE DONE') ||
                      upper.includes('FINISHED SUCCESSFULLY')
                    ) {
                      colorClass = 'text-emerald-400';
                    } else if (
                      upper.includes('[WARNING]') || 
                      upper.includes('[WARN]') || 
                      upper.includes('WARN ') || 
                      upper.includes('WARNING:') ||
                      upper.includes('DEPRECATED')
                    ) {
                      colorClass = 'text-amber-400';
                    } else if (
                      upper.includes('[ERROR]') || 
                      upper.includes('ERROR:') || 
                      upper.includes('EXCEPTION') || 
                      upper.includes('FATAL') || 
                      upper.includes('BUILD FAILURE')
                    ) {
                      colorClass = 'text-rose-400';
                    } else if (
                      upper.includes('[INFO]') || 
                      upper.includes('INFO ') || 
                      upper.includes('[DEBUG]') || 
                      upper.includes('DEBUG ')
                    ) {
                      colorClass = 'text-slate-200';
                    } else if (entry.stream === 'stderr') {
                      // Generic stderr messages that aren't marked as INFO/SUCCESS/WARN
                      colorClass = 'text-slate-300';
                    }

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
    </div>
  );
};
