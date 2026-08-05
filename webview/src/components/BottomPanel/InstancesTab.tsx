import React, { useMemo } from 'react';
import { ExternalLink, RefreshCw, AlertCircle, Layers } from 'lucide-react';

export interface DataflowJob {
  id: string;
  name: string;
  state: string;
  location?: string;
  type?: string;
  creationTime?: string;
  stateTime?: string;
}

interface InstancesTabProps {
  jobs?: DataflowJob[];
  isLoading?: boolean;
  error?: string | null;
  onRefresh?: (region?: string) => void;
  onOpenJob?: (job: DataflowJob) => void;
  projectId?: string;
  selectedRegion?: string;
  onRegionChange?: (region: string) => void;
}

const getStatusBadge = (state: string) => {
  const normalized = (state || '').toUpperCase();
  if (normalized.includes('RUNNING')) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold bg-green-500/20 text-green-400 border border-green-500/30">
        <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
        Running
      </span>
    );
  }
  if (normalized.includes('DONE') || normalized.includes('DRAINED')) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30">
        <span className="w-1.5 h-1.5 bg-blue-400 rounded-full" />
        {state}
      </span>
    );
  }
  if (normalized.includes('PENDING') || normalized.includes('QUEUED')) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
        <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full" />
        {state}
      </span>
    );
  }
  if (normalized.includes('FAILED')) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold bg-red-500/20 text-red-400 border border-red-500/30">
        <span className="w-1.5 h-1.5 bg-red-400 rounded-full" />
        Failed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold bg-slate-500/20 text-slate-400 border border-slate-500/30">
      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full" />
      {state || 'Unknown'}
    </span>
  );
};

export const InstancesTab: React.FC<InstancesTabProps> = ({
  jobs = [],
  isLoading = false,
  error = null,
  onRefresh,
  onOpenJob,
  projectId,
  selectedRegion = 'us-central1',
  onRegionChange
}) => {
  // Group jobs by state
  const groupedJobs = useMemo(() => {
    const groups: Record<string, DataflowJob[]> = {};
    jobs.forEach(job => {
      const stateKey = job.state || 'Unknown';
      if (!groups[stateKey]) {
        groups[stateKey] = [];
      }
      groups[stateKey].push(job);
    });
    return groups;
  }, [jobs]);

  const handleOpenJob = (job: DataflowJob) => {
    if (onOpenJob) {
      onOpenJob(job);
    } else {
      const loc = job.location || selectedRegion || 'us-central1';
      const proj = projectId || '';
      const url = `https://console.cloud.google.com/dataflow/jobs/${loc}/${job.id}${proj ? `?project=${proj}` : ''}`;
      window.open(url, '_blank');
    }
  };

  const getStatusPriority = (state: string) => {
    const normalized = (state || '').toUpperCase();
    if (normalized.includes('RUNNING')) return 1;
    if (normalized.includes('PENDING') || normalized.includes('QUEUED')) return 2;
    if (normalized.includes('DONE') || normalized.includes('DRAINED')) return 3;
    if (normalized.includes('FAILED')) return 4;
    if (normalized.includes('CANCEL') || normalized.includes('STOPPED')) return 5;
    return 6;
  };

  const groupKeys = Object.keys(groupedJobs).sort((a, b) => {
    return getStatusPriority(a) - getStatusPriority(b);
  });

  const handleRegionSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newRegion = e.target.value;
    if (onRegionChange) {
      onRegionChange(newRegion);
    }
    if (onRefresh) {
      onRefresh(newRegion);
    }
  };

  return (
    <div className="h-full flex flex-col gap-3 text-slate-300">
      {/* Top Controls Header */}
      <div className="flex justify-between items-center bg-[#1E202A] px-3 py-2 rounded border border-slate-700 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Dataflow Jobs {jobs.length > 0 && `(${jobs.length})`}
            </span>
            {projectId && projectId !== 'YOUR_PROJECT_ID' && (
              <span className="text-xs px-2 py-0.5 bg-slate-800 text-slate-400 rounded border border-slate-700 font-mono">
                {projectId}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 pl-2 border-l border-slate-700">
            <label className="text-xs font-semibold text-slate-400 uppercase">Region:</label>
            <select
              value={selectedRegion}
              onChange={handleRegionSelect}
              className="bg-[#252836] text-slate-200 text-xs p-1 rounded border border-slate-700 font-mono focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="us-central1">us-central1</option>
              <option value="us-east1">us-east1</option>
              <option value="us-east4">us-east4</option>
              <option value="us-west1">us-west1</option>
              <option value="us-west2">us-west2</option>
              <option value="europe-west1">europe-west1</option>
              <option value="europe-west3">europe-west3</option>
              <option value="asia-east1">asia-east1</option>
              <option value="ALL">All Regions (Slower)</option>
            </select>
          </div>
        </div>
        <button
          onClick={() => onRefresh && onRefresh(selectedRegion)}
          disabled={isLoading}
          className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded transition cursor-pointer disabled:opacity-50"
          title="Refresh Dataflow Jobs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Main Content Area */}
      <div className="bg-[#252836] rounded border border-slate-700 flex-1 overflow-auto p-3 min-h-0">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-400 gap-2">
            <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
            <span className="text-sm font-semibold">Fetching Dataflow Jobs...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-48 text-red-400 gap-2 p-4 text-center">
            <AlertCircle className="w-8 h-8 text-red-500" />
            <span className="text-sm font-semibold">{error}</span>
            <button
              onClick={() => onRefresh && onRefresh(selectedRegion)}
              className="mt-2 px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded text-xs font-semibold cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : jobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-500 gap-2">
            <Layers className="w-8 h-8 text-slate-600" />
            <span className="text-sm font-semibold">No Dataflow jobs found for this project.</span>
            <span className="text-xs text-slate-500">Run a pipeline or refresh to check for active jobs.</span>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {groupKeys.map(statusKey => {
              const groupList = groupedJobs[statusKey];
              return (
                <div key={statusKey} className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 border-b border-slate-700/80 pb-1">
                    {getStatusBadge(statusKey)}
                    <span className="text-xs font-bold text-slate-400">
                      ({groupList.length})
                    </span>
                  </div>
                  <table className="w-full text-xs text-left border-collapse">
                    <thead className="text-slate-500 uppercase font-bold bg-slate-800/60">
                      <tr>
                        <th className="p-2">Job Name</th>
                        <th className="p-2">Type</th>
                        <th className="p-2">Location</th>
                        <th className="p-2">Created</th>
                        <th className="p-2">Job ID</th>
                        <th className="p-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupList.map(job => (
                        <tr
                          key={job.id}
                          onClick={() => handleOpenJob(job)}
                          className="border-t border-slate-700/50 hover:bg-slate-700/30 transition cursor-pointer group"
                        >
                          <td className="p-2 font-semibold text-white group-hover:text-blue-400 transition">
                            {job.name}
                          </td>
                          <td className="p-2 text-slate-300">{job.type || 'Batch'}</td>
                          <td className="p-2 text-slate-400 font-mono">{job.location || 'us-central1'}</td>
                          <td className="p-2 text-slate-400">{job.creationTime || '-'}</td>
                          <td className="p-2 text-slate-400 font-mono">{job.id}</td>
                          <td className="p-2 text-right">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenJob(job);
                              }}
                              className="inline-flex items-center gap-1 px-2 py-1 bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 hover:text-blue-300 rounded transition border border-blue-500/30 text-xs font-medium cursor-pointer"
                              title="Open Job in Google Cloud Console"
                            >
                              Console
                              <ExternalLink className="w-3 h-3" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
