import React from 'react';
import { DeploymentTab } from './DeploymentTab';
import { InstancesTab } from './InstancesTab';
import { SourceCodeTab } from './SourceCodeTab';

/**
 * BottomPanel Component
 * 
 * This component acts as a container for the bottom panel tabs.
 * It displays the tab headers and renders the content for the active tab.
 * 
 * Architectural Decisions:
 * - Container component for bottom tabs.
 * - Delegates content rendering to specific tab components.
 */
interface BottomPanelProps {
  bottomTab: string;
  setBottomTab: (tab: string) => void;
  jobConfig: any;
  setJobConfig: (config: any) => void;
  runtimeVariables: { key: string, value: string }[];
  addVariable: () => void;
  updateVariable: (index: number, field: 'key' | 'value', value: string) => void;
  deleteVariable: (index: number) => void;
  isJobIdValid: (value: string) => boolean;
  generatedCode: string;
  onRunNow: () => void;
}

export const BottomPanel: React.FC<BottomPanelProps> = ({
  bottomTab,
  setBottomTab,
  jobConfig,
  setJobConfig,
  runtimeVariables,
  addVariable,
  updateVariable,
  deleteVariable,
  isJobIdValid,
  generatedCode,
  onRunNow
}) => {
  return (
    <div className="h-1/3 bg-[#151722] border-t border-slate-700 flex flex-col">
      {/* Tab Headers */}
      <div className="flex border-b border-slate-700 bg-[#1E202A] px-4">
        <button
          className={`py-2 px-4 text-xs font-semibold tracking-wider ${bottomTab === 'DEPLOYMENT' ? 'text-white border-b-2 border-blue-500' : 'text-slate-500 hover:text-slate-300'}`}
          onClick={() => setBottomTab('DEPLOYMENT')}
        >
          DEPLOYMENT
        </button>
        <button
          className={`py-2 px-4 text-xs font-semibold tracking-wider ${bottomTab === 'RUNNING_INSTANCES' ? 'text-white border-b-2 border-blue-500' : 'text-slate-500 hover:text-slate-300'}`}
          onClick={() => setBottomTab('RUNNING_INSTANCES')}
        >
          RUNNING INSTANCES
        </button>
        <button
          className={`py-2 px-4 text-xs font-semibold tracking-wider ${bottomTab === 'SOURCE_CODE' ? 'text-white border-b-2 border-blue-500' : 'text-slate-500 hover:text-slate-300'}`}
          onClick={() => setBottomTab('SOURCE_CODE')}
        >
          SOURCE CODE
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto p-4">
        {bottomTab === 'DEPLOYMENT' && (
          <DeploymentTab 
            jobConfig={jobConfig}
            setJobConfig={setJobConfig}
            runtimeVariables={runtimeVariables}
            addVariable={addVariable}
            updateVariable={updateVariable}
            deleteVariable={deleteVariable}
            isJobIdValid={isJobIdValid}
            onRunNow={onRunNow}
          />
        )}

        {bottomTab === 'RUNNING_INSTANCES' && (
          <InstancesTab />
        )}

        {bottomTab === 'SOURCE_CODE' && (
          <SourceCodeTab generatedCode={generatedCode} />
        )}
      </div>
    </div>
  );
};
