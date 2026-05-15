import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SourceCodeTab } from './SourceCodeTab';

describe('SourceCodeTab', () => {
  const mockProps = {
    generatedCode: 'print("pipeline")',
    language: 'Python' as const,
    setLanguage: vi.fn(),
    outputFolder: 'src/output',
    setOutputFolder: vi.fn(),
    onPickFolder: vi.fn(),
    onRegenerate: vi.fn(),
    needsRebuild: false,
    files: ['job.py', 'requirements.txt'],
    selectedFile: null,
    onSelectFile: vi.fn(),
    selectedFileContent: null
  };

  it('renders correctly with default props when needsRebuild is false', () => {
    render(<SourceCodeTab {...mockProps} />);

    // Check language options
    expect(screen.getByLabelText('Python')).toBeInTheDocument();
    expect(screen.getByLabelText('Java')).toBeInTheDocument();
    expect(screen.getByLabelText('Python')).toBeChecked();

    // Check folder inputs
    expect(screen.getByPlaceholderText('Default (pipeline directory)')).toHaveValue('src/output');

    // Check action buttons
    expect(screen.getByText('GENERATE CODE')).toBeInTheDocument();

    // Check files are shown
    expect(screen.getByText('job.py')).toBeInTheDocument();
    expect(screen.getByText('requirements.txt')).toBeInTheDocument();

    // Default code should be visible
    expect(screen.getByText((_content, node) => {
      return node?.tagName === 'CODE' && node?.textContent === 'print("pipeline")';
    })).toBeInTheDocument();
  });

  it('calls setLanguage when selecting radio buttons', () => {
    render(<SourceCodeTab {...mockProps} />);

    fireEvent.click(screen.getByLabelText('Java'));
    expect(mockProps.setLanguage).toHaveBeenCalledWith('Java');
  });

  it('calls setOutputFolder when typing in folder input', () => {
    render(<SourceCodeTab {...mockProps} />);

    const input = screen.getByPlaceholderText('Default (pipeline directory)');
    fireEvent.change(input, { target: { value: 'new/path' } });
    expect(mockProps.setOutputFolder).toHaveBeenCalledWith('new/path');
  });

  it('calls onPickFolder when clicking browse folder button', () => {
    render(<SourceCodeTab {...mockProps} />);

    const button = screen.getByTitle('Browse Folder');
    fireEvent.click(button);
    expect(mockProps.onPickFolder).toHaveBeenCalled();
  });

  it('calls onRegenerate when clicking regenerate button', () => {
    render(<SourceCodeTab {...mockProps} />);

    fireEvent.click(screen.getByText('GENERATE CODE'));
    expect(mockProps.onRegenerate).toHaveBeenCalled();
  });

  it('calls onSelectFile when clicking a file from the list', () => {
    render(<SourceCodeTab {...mockProps} />);

    fireEvent.click(screen.getByText('job.py'));
    expect(mockProps.onSelectFile).toHaveBeenCalledWith('job.py');
  });

  it('renders rebuild warning and hides file list/code preview when needsRebuild is true', () => {
    render(<SourceCodeTab {...mockProps} needsRebuild={true} />);

    // Warning text should be visible
    expect(screen.getByText(/Pipeline has unsaved changes/)).toBeInTheDocument();
    expect(screen.getByText(/Unsaved Pipeline Changes/)).toBeInTheDocument();

    // File list should not show the files
    expect(screen.queryByText('job.py')).not.toBeInTheDocument();
    expect(screen.queryByText('requirements.txt')).not.toBeInTheDocument();

    // Code preview should not show the default code
    expect(screen.queryByText('print("pipeline")')).not.toBeInTheDocument();
  });

  it('renders selected file content when selectedFile is set', () => {
    render(
      <SourceCodeTab
        {...mockProps}
        selectedFile="requirements.txt"
        selectedFileContent="apache-beam==2.55.0"
      />
    );

    // Selected file header (span inside header bar)
    expect(screen.getByText('requirements.txt', { selector: 'span' })).toBeInTheDocument();

    // Selected file content
    expect(screen.getByText('apache-beam==2.55.0')).toBeInTheDocument();
  });
});
