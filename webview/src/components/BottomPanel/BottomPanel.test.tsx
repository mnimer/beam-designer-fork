import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BottomPanel } from './BottomPanel';

// Mock sub-components
vi.mock('./DeploymentTab', () => ({
  DeploymentTab: () => <div data-testid="deployment-tab">Deployment Content</div>
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

  it('renders tab headers and file count badge for source files', () => {
    render(<BottomPanel {...mockProps} folderFiles={['pipeline.py', 'helper.py', 'requirements.txt']} />);

    expect(screen.getByText('DEPLOYMENT')).toBeInTheDocument();
    expect(screen.getByText('SOURCE CODE')).toBeInTheDocument();
    expect(screen.getByText('2 files')).toBeInTheDocument();
    expect(screen.queryByText('RUNNING JOBS')).not.toBeInTheDocument();
  });

  it('renders DeploymentTab when bottomTab is DEPLOYMENT', () => {
    render(<BottomPanel {...mockProps} bottomTab="DEPLOYMENT" />);

    expect(screen.getByTestId('deployment-tab')).toBeInTheDocument();
  });

  it('renders SourceCodeTab when bottomTab is SOURCE_CODE', () => {
    render(<BottomPanel {...mockProps} bottomTab="SOURCE_CODE" />);

    expect(screen.getByTestId('source-code-tab')).toBeInTheDocument();
    expect(screen.getByText('print("hello")')).toBeInTheDocument();
  });

  it('calls setBottomTab when clicking tabs', () => {
    render(<BottomPanel {...mockProps} />);

    fireEvent.click(screen.getByText('SOURCE CODE'));
    expect(mockProps.setBottomTab).toHaveBeenCalledWith('SOURCE_CODE');

    fireEvent.click(screen.getByText('DEPLOYMENT'));
    expect(mockProps.setBottomTab).toHaveBeenCalledWith('DEPLOYMENT');
  });

  it('renders expand/collapse button and triggers onToggleExpand', () => {
    const onToggleExpand = vi.fn();
    const { rerender } = render(
      <BottomPanel {...mockProps} isExpanded={false} onToggleExpand={onToggleExpand} />
    );

    const expandBtn = screen.getByLabelText('Expand Panel');
    expect(expandBtn).toBeInTheDocument();
    fireEvent.click(expandBtn);
    expect(onToggleExpand).toHaveBeenCalledTimes(1);

    rerender(
      <BottomPanel {...mockProps} isExpanded={true} onToggleExpand={onToggleExpand} />
    );
    expect(screen.getByLabelText('Collapse Panel')).toBeInTheDocument();
  });

  it('applies high-contrast active styling to the selected tab and muted styling to inactive tabs', () => {
    render(<BottomPanel {...mockProps} bottomTab="SOURCE_CODE" />);

    const sourceCodeBtn = screen.getByRole('button', { name: /SOURCE CODE/i });
    const deploymentBtn = screen.getByRole('button', { name: /DEPLOYMENT/i });

    expect(sourceCodeBtn.className).toContain('text-[var(--vscode-text-primary');
    expect(sourceCodeBtn.className).toContain('border-[var(--vscode-highlight');

    expect(deploymentBtn.className).toContain('text-[var(--vscode-text-muted');
  });

  // P7: Verify folderFiles filtering is memoised and does not recompute on every render
  it('memoises the sourceFiles filtering across re-renders when folderFiles does not change (P7)', () => {
    const folderFiles = ['pipeline.py', 'helper.py', 'config.json'];
    const filterSpy = vi.spyOn(folderFiles, 'filter');

    const { rerender } = render(
      <BottomPanel {...mockProps} folderFiles={folderFiles} bottomTab="DEPLOYMENT" />
    );
    expect(filterSpy).toHaveBeenCalledTimes(1);

    // Re-rendering with an unrelated prop change (bottomTab) does not re-run filter
    rerender(
      <BottomPanel {...mockProps} folderFiles={folderFiles} bottomTab="SOURCE_CODE" />
    );
    expect(filterSpy).toHaveBeenCalledTimes(1);

    // Re-rendering with a new folderFiles reference re-runs filter
    const newFiles = ['pipeline.py', 'updated.py'];
    const newFilterSpy = vi.spyOn(newFiles, 'filter');
    rerender(
      <BottomPanel {...mockProps} folderFiles={newFiles} bottomTab="SOURCE_CODE" />
    );
    expect(newFilterSpy).toHaveBeenCalledTimes(1);
  });
});


