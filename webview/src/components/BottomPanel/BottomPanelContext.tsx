/**
 * @fileoverview React Context providing cohesive data slices to the bottom panel tabs.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Decomposes ~37 prop-drilled fields into typed, cohesive slices:
 * - `execution`: live logs, pipeline status, runnerCommand, run, stop, clear, openConsole
 * - `jobConfig`: runner configuration object, setter, validation, subnetworks, projectId
 * - `runtimeVariables`: pipeline key-value variables and mutation handlers
 * - `pipelineConfig`: language, output directory, dirty state, and updater functions
 * - `codegen`: code generation preview, status, files, selection, and validation
 */

/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext } from 'react';
import type { LogEntry } from './DeploymentTab';
import type { TokenUsage } from './SourceCodeTab';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Execution slice of the BottomPanel context.
 */
export interface BottomPanelExecutionSlice {
  logs: LogEntry[];
  status: 'idle' | 'running' | 'completed' | 'failed' | 'stopped';
  runnerCommand: string;
  run: () => void;
  stop?: () => void;
  clear?: () => void;
  openConsole?: (url: string) => void;
}

/**
 * Job configuration slice of the BottomPanel context.
 */
export interface BottomPanelJobConfigSlice {
  value: any;
  set: (update: React.SetStateAction<any>) => void;
  isJobIdValid: (value: string) => boolean;
  subnetworks: { name: string; region: string; network: string; value: string }[];
  projectId?: string;
}

/**
 * Runtime variables slice of the BottomPanel context.
 */
export interface BottomPanelRuntimeVariablesSlice {
  variables: { key: string; value: string }[];
  addVariable: () => void;
  updateVariable: (index: number, field: 'key' | 'value', value: string) => void;
  deleteVariable: (index: number) => void;
}

/**
 * Pipeline configuration slice of the BottomPanel context.
 */
export interface BottomPanelPipelineConfigSlice {
  config: { language: 'Python' | 'Java'; outputFolder: string; needsRebuild: boolean };
  setLanguage: (lang: 'Python' | 'Java') => void;
  setOutputFolder: (folder: string) => void;
  setPipelineConfig?: (config: any) => void;
}

/**
 * Code generation slice of the BottomPanel context.
 */
export interface BottomPanelCodegenSlice {
  generatedCode: string;
  regenerate: () => void;
  stopGeneration?: () => void;
  isGenerating?: boolean;
  files: string[];
  selectedFile: string | null;
  selectedFileContent: string | null;
  pickFolder: () => void;
  selectFile: (fileName: string) => void;
  isGraphValid?: boolean;
  validationErrors?: string[];
  nodes?: any[];
  tokenUsage?: TokenUsage | null;
}

/**
 * Full context value contract provided to BottomPanel and its tabs.
 */
export interface BottomPanelContextValue {
  execution: BottomPanelExecutionSlice;
  jobConfig: BottomPanelJobConfigSlice;
  runtimeVariables: BottomPanelRuntimeVariablesSlice;
  pipelineConfig: BottomPanelPipelineConfigSlice;
  codegen: BottomPanelCodegenSlice;
}

/**
 * React Context for BottomPanel slices.
 */
export const BottomPanelContext = createContext<BottomPanelContextValue | null>(null);

/**
 * Props for the `BottomPanelProvider` component.
 */
export interface BottomPanelProviderProps {
  value: BottomPanelContextValue;
  children: React.ReactNode;
}

/**
 * Provider component supplying the BottomPanel context value to child tabs.
 */
export const BottomPanelProvider: React.FC<BottomPanelProviderProps> = ({ value, children }) => {
  return (
    <BottomPanelContext.Provider value={value}>
      {children}
    </BottomPanelContext.Provider>
  );
};

/**
 * Hook to access the BottomPanelContext.
 * Throws a descriptive error if called outside a BottomPanelProvider.
 *
 * @returns The BottomPanelContextValue.
 * @throws Error if called outside a BottomPanelProvider.
 */
export function useBottomPanel(): BottomPanelContextValue {
  const context = useContext(BottomPanelContext);
  if (!context) {
    throw new Error('useBottomPanel must be used within a BottomPanelProvider');
  }
  return context;
}
