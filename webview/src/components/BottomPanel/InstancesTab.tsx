import React from 'react';

/**
 * InstancesTab Component
 * 
 * This component renders the content for the RUNNING INSTANCES tab in the bottom panel.
 * It displays a table of mock running instances.
 * 
 * Architectural Decisions:
 * - Uses mock data as per current implementation.
 */
export const InstancesTab: React.FC = () => {
  return (
    <div className="h-full flex flex-col">
      <div className="bg-[#252836] rounded border border-slate-700 flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-800 text-slate-400 text-xs uppercase">
            <tr>
              <th className="text-left p-2">Instance Name</th>
              <th className="text-left p-2">Runner</th>
              <th className="text-left p-2">Status</th>
              <th className="text-left p-2">Duration</th>
              <th className="text-left p-2">Job ID</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-slate-700">
              <td className="p-2">prod-analytics-etl</td>
              <td className="p-2">Dataflow</td>
              <td className="p-2 flex items-center gap-1">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                Running
              </td>
              <td className="p-2">12h 45m</td>
              <td className="p-2">df-89234</td>
            </tr>
            <tr className="border-t border-slate-700">
              <td className="p-2">batch-ringout-backfill</td>
              <td className="p-2">Dataflow</td>
              <td className="p-2 flex items-center gap-1">
                <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                Canceled
              </td>
              <td className="p-2">45m</td>
              <td className="p-2">df-88322</td>
            </tr>
            <tr className="border-t border-slate-700">
              <td className="p-2">streaming-logs-archiver</td>
              <td className="p-2">Dataflow</td>
              <td className="p-2 flex items-center gap-1">
                <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                Stopped
              </td>
              <td className="p-2">15d 2h</td>
              <td className="p-2">df-77161</td>
            </tr>
            <tr className="border-t border-slate-700">
              <td className="p-2">ml-insight-generator</td>
              <td className="p-2">Serverless Spark</td>
              <td className="p-2 flex items-center gap-1">
                <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
                Pending
              </td>
              <td className="p-2">1s</td>
              <td className="p-2">sp-11389</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};
