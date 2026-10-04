import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BottomPanel } from './BottomPanel';
import { useBottomPanel } from './BottomPanelContext';
import { renderWithBottomPanel } from './testUtils';

// Mock sub-components
vi.mock('./DeploymentTab', () => ({
  DeploymentTab: () => <div data-testid="deployment-tab">Deployment Content</div>
}));
vi.mock('./SourceCodeTab', () => ({
  SourceCodeTab: () => {
    const { codegen, pipelineConfig } = useBottomPanel();
    return (
      <div data-testid="source-code-tab">
        {codegen.generatedCode}
        {codegen.tokenUsage && (
          <span data-testid="mock-token-usage">
            {codegen.tokenUsage.inputTokens}/{codegen.tokenUsage.outputTokens}
          </span>
        )}
        <button data-testid="set-language-btn" onClick={() => pipelineConfig.setLanguage?.('Java')}>Set Java</button>
        <button data-testid="set-language-same-btn" onClick={() => pipelineConfig.setLanguage?.('Python')}>Set Python</button>
        <button data-testid="set-output-folder-btn" onClick={() => pipelineConfig.setOutputFolder?.('/new/path')}>Set New Folder</button>
        <button data-testid="set-output-folder-same-btn" onClick={() => pipelineConfig.setOutputFolder?.('')}>Set Same Folder</button>
      </div>
    );
  }
}));

describe('BottomPanel', () => {
  const mockProps = {
    bottomTab: 'DEPLOYMENT',
    setBottomTab: vi.fn(),
  };

  const defaultContext = {
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
    renderWithBottomPanel(
      <BottomPanel {...mockProps} />,
      { ...defaultContext, files: ['pipeline.py', 'helper.py', 'requirements.txt'] }
    );

    expect(screen.getByText('DEPLOYMENT')).toBeInTheDocument();
    expect(screen.getByText('Generate Code')).toBeInTheDocument();
    expect(screen.getByText('2 files')).toBeInTheDocument();
    expect(screen.queryByText('RUNNING JOBS')).not.toBeInTheDocument();
  });

  it('renders DeploymentTab when bottomTab is DEPLOYMENT', () => {
    renderWithBottomPanel(<BottomPanel {...mockProps} bottomTab="DEPLOYMENT" />, defaultContext);

    expect(screen.getByTestId('deployment-tab')).toBeInTheDocument();
  });

  it('renders SourceCodeTab when bottomTab is SOURCE_CODE', () => {
    renderWithBottomPanel(
      <BottomPanel {...mockProps} bottomTab="SOURCE_CODE" />,
      { ...defaultContext, generatedCode: 'print("hello")' }
    );

    expect(screen.getByTestId('source-code-tab')).toBeInTheDocument();
    expect(screen.getByText('print("hello")')).toBeInTheDocument();
  });

  it('calls setBottomTab when clicking tabs', () => {
    renderWithBottomPanel(<BottomPanel {...mockProps} />, defaultContext);

    fireEvent.click(screen.getByText('Generate Code'));
    expect(mockProps.setBottomTab).toHaveBeenCalledWith('SOURCE_CODE');

    fireEvent.click(screen.getByText('DEPLOYMENT'));
    expect(mockProps.setBottomTab).toHaveBeenCalledWith('DEPLOYMENT');
  });

  it('renders expand/collapse button and triggers onToggleExpand', () => {
    const onToggleExpand = vi.fn();
    const { rerenderWithContext } = renderWithBottomPanel(
      <BottomPanel {...mockProps} isExpanded={false} onToggleExpand={onToggleExpand} />,
      defaultContext
    );

    const expandBtn = screen.getByLabelText('Expand Panel');
    expect(expandBtn).toBeInTheDocument();
    fireEvent.click(expandBtn);
    expect(onToggleExpand).toHaveBeenCalledTimes(1);

    rerenderWithContext(
      <BottomPanel {...mockProps} isExpanded={true} onToggleExpand={onToggleExpand} />,
      defaultContext
    );
    expect(screen.getByLabelText('Collapse Panel')).toBeInTheDocument();
  });

  it('applies high-contrast active styling to the selected tab and muted styling to inactive tabs', () => {
    renderWithBottomPanel(<BottomPanel {...mockProps} bottomTab="SOURCE_CODE" />, defaultContext);

    const generateCodeBtn = screen.getByRole('button', { name: /Generate Code/i });
    const deploymentBtn = screen.getByRole('button', { name: /DEPLOYMENT/i });

    expect(generateCodeBtn.className).toContain('text-[var(--vscode-text-primary');
    expect(generateCodeBtn.className).toContain('border-[var(--vscode-highlight');

    expect(deploymentBtn.className).toContain('text-[var(--vscode-text-muted');
  });

  // P7: Verify folderFiles filtering is memoised and does not recompute on every render
  it('memoises the sourceFiles filtering across re-renders when folderFiles does not change (P7)', () => {
    const folderFiles = ['pipeline.py', 'helper.py', 'config.json'];
    const filterSpy = vi.spyOn(folderFiles, 'filter');

    const { rerenderWithContext } = renderWithBottomPanel(
      <BottomPanel {...mockProps} bottomTab="DEPLOYMENT" />,
      { ...defaultContext, files: folderFiles }
    );
    expect(filterSpy).toHaveBeenCalledTimes(1);

    // Re-rendering with an unrelated prop change (bottomTab) does not re-run filter
    rerenderWithContext(
      <BottomPanel {...mockProps} bottomTab="SOURCE_CODE" />,
      { ...defaultContext, files: folderFiles }
    );
    expect(filterSpy).toHaveBeenCalledTimes(1);

    // Re-rendering with a new folderFiles reference re-runs filter
    const newFiles = ['pipeline.py', 'updated.py'];
    const newFilterSpy = vi.spyOn(newFiles, 'filter');
    rerenderWithContext(
      <BottomPanel {...mockProps} bottomTab="SOURCE_CODE" />,
      { ...defaultContext, files: newFiles }
    );
    expect(newFilterSpy).toHaveBeenCalledTimes(1);
  });

  it('calls onInteract when a user clicks on any tab or child control in BottomPanel', () => {
    const onInteract = vi.fn();
    renderWithBottomPanel(<BottomPanel {...mockProps} onInteract={onInteract} />, defaultContext);

    fireEvent.click(screen.getByText('Generate Code'));
    expect(onInteract).toHaveBeenCalled();

    fireEvent.click(screen.getByText('DEPLOYMENT'));
    expect(onInteract).toHaveBeenCalled();
  });

  it('passes tokenUsage down to SourceCodeTab', () => {
    renderWithBottomPanel(
      <BottomPanel
        {...mockProps}
        bottomTab="SOURCE_CODE"
      />,
      {
        ...defaultContext,
        tokenUsage: { inputTokens: 500, outputTokens: 250, totalTokens: 750 }
      }
    );

    expect(screen.getByTestId('mock-token-usage')).toHaveTextContent('500/250');
  });

  it('sets needsRebuild to true when language changes', () => {
    const setPipelineConfig = vi.fn();
    renderWithBottomPanel(
      <BottomPanel
        {...mockProps}
        bottomTab="SOURCE_CODE"
      />,
      {
        ...defaultContext,
        pipelineConfig: { language: 'Python', outputFolder: '', needsRebuild: false },
        setPipelineConfig,
      }
    );

    fireEvent.click(screen.getByTestId('set-language-btn'));

    expect(setPipelineConfig).toHaveBeenCalledTimes(1);
    const updater = setPipelineConfig.mock.calls[0][0];
    expect(typeof updater).toBe('function');

    const prevState = { language: 'Python' as const, outputFolder: '', needsRebuild: false };
    const nextState = updater(prevState);
    expect(nextState.language).toBe('Java');
    expect(nextState.needsRebuild).toBe(true);
  });

  it('returns identical previous reference when language does not change', () => {
    const setPipelineConfig = vi.fn();
    renderWithBottomPanel(
      <BottomPanel
        {...mockProps}
        bottomTab="SOURCE_CODE"
      />,
      {
        ...defaultContext,
        pipelineConfig: { language: 'Python', outputFolder: '', needsRebuild: false },
        setPipelineConfig,
      }
    );

    fireEvent.click(screen.getByTestId('set-language-same-btn'));

    expect(setPipelineConfig).toHaveBeenCalledTimes(1);
    const updater = setPipelineConfig.mock.calls[0][0];
    expect(typeof updater).toBe('function');

    const prevState = { language: 'Python' as const, outputFolder: '', needsRebuild: false };
    const nextState = updater(prevState);
    expect(nextState).toBe(prevState);
  });

  it('sets needsRebuild to true when output folder changes', () => {
    const setPipelineConfig = vi.fn();
    renderWithBottomPanel(
      <BottomPanel
        {...mockProps}
        bottomTab="SOURCE_CODE"
      />,
      {
        ...defaultContext,
        pipelineConfig: { language: 'Python', outputFolder: '', needsRebuild: false },
        setPipelineConfig,
      }
    );

    fireEvent.click(screen.getByTestId('set-output-folder-btn'));

    expect(setPipelineConfig).toHaveBeenCalledTimes(1);
    const updater = setPipelineConfig.mock.calls[0][0];
    expect(typeof updater).toBe('function');

    const prevState = { language: 'Python' as const, outputFolder: '', needsRebuild: false };
    const nextState = updater(prevState);
    expect(nextState.outputFolder).toBe('/new/path');
    expect(nextState.needsRebuild).toBe(true);
  });

  it('returns identical previous reference when output folder does not change', () => {
    const setPipelineConfig = vi.fn();
    renderWithBottomPanel(
      <BottomPanel
        {...mockProps}
        bottomTab="SOURCE_CODE"
      />,
      {
        ...defaultContext,
        pipelineConfig: { language: 'Python', outputFolder: '', needsRebuild: false },
        setPipelineConfig,
      }
    );

    fireEvent.click(screen.getByTestId('set-output-folder-same-btn'));

    expect(setPipelineConfig).toHaveBeenCalledTimes(1);
    const updater = setPipelineConfig.mock.calls[0][0];
    expect(typeof updater).toBe('function');

    const prevState = { language: 'Python' as const, outputFolder: '', needsRebuild: false };
    const nextState = updater(prevState);
    expect(nextState).toBe(prevState);
  });
});
