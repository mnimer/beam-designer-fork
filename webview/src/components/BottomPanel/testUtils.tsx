import React from 'react';
import { render, type RenderResult } from '@testing-library/react';
import { vi } from 'vitest';
import {
  BottomPanelProvider,
  type BottomPanelContextValue,
} from './BottomPanelContext';
import { pipelineConfigReducer, type PipelineConfig } from '../../state/pipelineConfigReducer';
import type { LogEntry } from './DeploymentTab';
import type { TokenUsage } from './SourceCodeTab';

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface BottomPanelTestOverrides {
  // Direct slices
  execution?: Partial<BottomPanelContextValue['execution']>;
  jobConfig?: Partial<BottomPanelContextValue['jobConfig']> | any;
  runtimeVariables?: Partial<BottomPanelContextValue['runtimeVariables']> | { key: string; value: string }[];
  pipelineConfig?: Partial<BottomPanelContextValue['pipelineConfig']> | PipelineConfig;
  codegen?: Partial<BottomPanelContextValue['codegen']>;

  // Flat convenience fields
  setJobConfig?: (update: React.SetStateAction<any>) => void;
  addVariable?: () => void;
  updateVariable?: (index: number, field: 'key' | 'value', value: string) => void;
  deleteVariable?: (index: number) => void;
  isJobIdValid?: (value: string) => boolean;
  onRunNow?: () => void;
  onStopPipeline?: () => void;
  subnetworks?: { name: string; region: string; network: string; value: string }[];
  needsRebuild?: boolean;
  pipelineLogs?: LogEntry[];
  pipelineStatus?: 'idle' | 'running' | 'completed' | 'failed' | 'stopped';
  runnerCommand?: string;
  onClearLogs?: () => void;
  onOpenConsole?: (url: string) => void;
  projectId?: string;
  generatedCode?: string;
  language?: 'Python' | 'Java';
  setLanguage?: (lang: 'Python' | 'Java') => void;
  outputFolder?: string;
  setOutputFolder?: (folder: string) => void;
  setPipelineConfig?: (update: any) => void;
  onPickFolder?: () => void;
  onRegenerate?: () => void;
  onStopGeneration?: () => void;
  files?: string[];
  folderFiles?: string[];
  selectedFile?: string | null;
  selectedFileName?: string | null;
  onSelectFile?: (fileName: string) => void;
  selectedFileContent?: string | null;
  isGenerating?: boolean;
  isGraphValid?: boolean;
  validationErrors?: string[];
  nodes?: any[];
  tokenUsage?: TokenUsage | null;
}

/**
 * Creates a fully-populated BottomPanelContextValue with sensible defaults and applied overrides.
 */
export function createBottomPanelContextValue(
  overrides?: BottomPanelTestOverrides
): BottomPanelContextValue {
  const setPipelineConfig =
    overrides?.setPipelineConfig ??
    (overrides?.pipelineConfig as any)?.setPipelineConfig;

  const rawConfig: Partial<PipelineConfig> =
    (overrides?.pipelineConfig && 'config' in overrides.pipelineConfig
      ? overrides.pipelineConfig.config
      : (overrides?.pipelineConfig as Partial<PipelineConfig>)) ?? {};

  const config: PipelineConfig = {
    language: overrides?.language ?? rawConfig.language ?? 'Python',
    outputFolder: overrides?.outputFolder ?? rawConfig.outputFolder ?? '',
    needsRebuild: overrides?.needsRebuild ?? rawConfig.needsRebuild ?? false,
  };

  const rawJobConfig =
    overrides?.jobConfig && 'value' in overrides.jobConfig
      ? overrides.jobConfig.value
      : overrides?.jobConfig ?? { runner: 'DirectRunner' };

  const rawVariables =
    (overrides?.runtimeVariables && 'variables' in overrides.runtimeVariables
      ? overrides.runtimeVariables.variables
      : Array.isArray(overrides?.runtimeVariables)
        ? overrides.runtimeVariables
        : []) ?? [];

  const rawExec = overrides?.execution ?? {};
  const rawJob = (overrides?.jobConfig && 'value' in overrides.jobConfig ? overrides.jobConfig : {}) as any;
  const rawRv = (overrides?.runtimeVariables && 'variables' in overrides.runtimeVariables ? overrides.runtimeVariables : {}) as any;
  const rawCodegen = overrides?.codegen ?? {};

  return {
    execution: {
      logs: rawExec.logs ?? overrides?.pipelineLogs ?? [],
      status: rawExec.status ?? overrides?.pipelineStatus ?? 'idle',
      runnerCommand: rawExec.runnerCommand ?? overrides?.runnerCommand ?? '',
      run: rawExec.run ?? overrides?.onRunNow ?? vi.fn(),
      stop: rawExec.stop ?? overrides?.onStopPipeline ?? vi.fn(),
      clear: rawExec.clear ?? overrides?.onClearLogs ?? vi.fn(),
      openConsole: rawExec.openConsole ?? overrides?.onOpenConsole ?? vi.fn(),
    },
    jobConfig: {
      value: rawJobConfig,
      set: rawJob.set ?? overrides?.setJobConfig ?? vi.fn(),
      isJobIdValid: rawJob.isJobIdValid ?? overrides?.isJobIdValid ?? vi.fn().mockReturnValue(true),
      subnetworks: rawJob.subnetworks ?? overrides?.subnetworks ?? [],
      projectId: rawJob.projectId ?? overrides?.projectId,
    },
    runtimeVariables: {
      variables: rawVariables,
      addVariable: rawRv.addVariable ?? overrides?.addVariable ?? vi.fn(),
      updateVariable: rawRv.updateVariable ?? overrides?.updateVariable ?? vi.fn(),
      deleteVariable: rawRv.deleteVariable ?? overrides?.deleteVariable ?? vi.fn(),
    },
    pipelineConfig: {
      config,
      setLanguage:
        overrides?.setLanguage ??
        (overrides?.pipelineConfig as any)?.setLanguage ??
        ((lang) =>
          setPipelineConfig?.((prev: any) =>
            pipelineConfigReducer(prev, { type: 'setLanguage', language: lang })
          )),
      setOutputFolder:
        overrides?.setOutputFolder ??
        (overrides?.pipelineConfig as any)?.setOutputFolder ??
        ((folder) =>
          setPipelineConfig?.((prev: any) =>
            pipelineConfigReducer(prev, { type: 'setOutputFolder', folder })
          )),
      setPipelineConfig,
    },
    codegen: {
      generatedCode: rawCodegen.generatedCode ?? overrides?.generatedCode ?? '',
      regenerate: rawCodegen.regenerate ?? overrides?.onRegenerate ?? vi.fn(),
      stopGeneration: rawCodegen.stopGeneration ?? overrides?.onStopGeneration,
      isGenerating: rawCodegen.isGenerating ?? overrides?.isGenerating ?? false,
      files: rawCodegen.files ?? overrides?.files ?? overrides?.folderFiles ?? [],
      selectedFile: rawCodegen.selectedFile ?? overrides?.selectedFile ?? overrides?.selectedFileName ?? null,
      selectedFileContent: rawCodegen.selectedFileContent ?? overrides?.selectedFileContent ?? null,
      pickFolder: rawCodegen.pickFolder ?? overrides?.onPickFolder ?? vi.fn(),
      selectFile: rawCodegen.selectFile ?? overrides?.onSelectFile ?? vi.fn(),
      isGraphValid: rawCodegen.isGraphValid ?? overrides?.isGraphValid ?? true,
      validationErrors: rawCodegen.validationErrors ?? overrides?.validationErrors ?? [],
      nodes: rawCodegen.nodes ?? overrides?.nodes ?? [],
      tokenUsage: rawCodegen.tokenUsage ?? overrides?.tokenUsage ?? null,
    },
  };
}

export interface RenderWithBottomPanelResult extends RenderResult {
  contextValue: BottomPanelContextValue;
  rerenderWithContext: (
    ui: React.ReactElement,
    newOverrides?: BottomPanelTestOverrides
  ) => void;
}

/**
 * Test helper that renders a component inside BottomPanelProvider with mock/custom context.
 */
export function renderWithBottomPanel(
  ui: React.ReactElement,
  overrides?: BottomPanelTestOverrides
): RenderWithBottomPanelResult {
  let contextValue = createBottomPanelContextValue(overrides);

  const result = render(
    <BottomPanelProvider value={contextValue}>{ui}</BottomPanelProvider>
  );

  const rerenderWithContext = (
    newUi: React.ReactElement,
    newOverrides?: BottomPanelTestOverrides
  ) => {
    if (newOverrides !== undefined) {
      contextValue = createBottomPanelContextValue(newOverrides);
    }
    result.rerender(
      <BottomPanelProvider value={contextValue}>{newUi}</BottomPanelProvider>
    );
  };

  return {
    ...result,
    contextValue,
    rerenderWithContext,
  };
}
