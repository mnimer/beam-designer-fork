
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BottomPanel } from './BottomPanel';

// Mock sub-components
vi.mock('./DeploymentTab', () => ({
  DeploymentTab: () => <div data-testid="deployment-tab">Deployment Content</div>
}));
vi.mock('./InstancesTab', () => ({
  InstancesTab: () => <div data-testid="instances-tab">Instances Content</div>
}));
vi.mock('./SourceCodeTab', () => ({
  SourceCodeTab: ({ generatedCode }: any) => <div data-testid="source-code-tab">{generatedCode}</div>
}));

describe('BottomPanel', () => {
  const mockProps = {
    bottomTab: 'DEPLOYMENT',
    setBottomTab: vi.fn(),
    jobConfig: {},
    setJobConfig: vi.fn(),
    runtimeVariables: [],
    addVariable: vi.fn(),
    updateVariable: vi.fn(),
    deleteVariable: vi.fn(),
    isJobIdValid: vi.fn().mockReturnValue(true),
    generatedCode: 'print("hello")',
    onRunNow: vi.fn(),
    networks: [],
    subnetworks: [],
    pipelineConfig: { language: 'Python' as const, outputFolder: '', needsRebuild: false },
    setPipelineConfig: vi.fn(),
    onRegenerate: vi.fn(),
    folderFiles: [],
    selectedFileName: null,
    selectedFileContent: null,
    onPickFolder: vi.fn(),
    onSelectFile: vi.fn()
  };

  it('renders tab headers', () => {
    render(<BottomPanel {...mockProps} />);

    expect(screen.getByText('DEPLOYMENT')).toBeInTheDocument();
    expect(screen.getByText('RUNNING JOBS')).toBeInTheDocument();
    expect(screen.getByText('SOURCE CODE')).toBeInTheDocument();
  });

  it('renders DeploymentTab when bottomTab is DEPLOYMENT', () => {
    render(<BottomPanel {...mockProps} bottomTab="DEPLOYMENT" />);

    expect(screen.getByTestId('deployment-tab')).toBeInTheDocument();
  });

  it('renders InstancesTab when bottomTab is RUNNING_JOBS', () => {
    render(<BottomPanel {...mockProps} bottomTab="RUNNING_JOBS" />);

    expect(screen.getByTestId('instances-tab')).toBeInTheDocument();
  });

  it('renders SourceCodeTab when bottomTab is SOURCE_CODE', () => {
    render(<BottomPanel {...mockProps} bottomTab="SOURCE_CODE" />);

    expect(screen.getByTestId('source-code-tab')).toBeInTheDocument();
    expect(screen.getByText('print("hello")')).toBeInTheDocument();
  });

  it('calls setBottomTab when clicking tabs', () => {
    render(<BottomPanel {...mockProps} />);

    fireEvent.click(screen.getByText('RUNNING JOBS'));
    expect(mockProps.setBottomTab).toHaveBeenCalledWith('RUNNING_JOBS');
  });

  it('applies high-contrast active styling to the selected tab and muted styling to inactive tabs', () => {
    render(<BottomPanel {...mockProps} bottomTab="SOURCE_CODE" />);

    const sourceCodeBtn = screen.getByText('SOURCE CODE');
    const deploymentBtn = screen.getByText('DEPLOYMENT');
    const runningJobsBtn = screen.getByText('RUNNING JOBS');

    expect(sourceCodeBtn.className).toContain('text-[var(--vscode-text-primary)]');
    expect(sourceCodeBtn.className).toContain('border-[var(--vscode-highlight)]');

    expect(deploymentBtn.className).toContain('text-[var(--vscode-text-muted)]');
    expect(runningJobsBtn.className).toContain('text-[var(--vscode-text-muted)]');
  });
});
