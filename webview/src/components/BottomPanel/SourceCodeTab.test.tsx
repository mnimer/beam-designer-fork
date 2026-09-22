import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SourceCodeTab, highlightCode } from './SourceCodeTab';

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

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly with default props when needsRebuild is false', () => {
    render(<SourceCodeTab {...mockProps} />);

    // Check language options
    expect(screen.getByLabelText('Python')).toBeInTheDocument();
    expect(screen.getByLabelText('Java')).toBeInTheDocument();
    expect(screen.getByLabelText('Python')).toBeChecked();

    // Check folder inputs
    expect(screen.getByPlaceholderText('./scratch_flow/')).toHaveValue('src/output');

    // Check action buttons
    expect(screen.getByText('Generate Code')).toBeInTheDocument();
    expect(screen.getByText('Stop')).toBeInTheDocument();

    // Check only .py and .java files are shown in the horizontal tabs
    expect(screen.getByText('job.py')).toBeInTheDocument();
    expect(screen.queryByText('requirements.txt')).not.toBeInTheDocument();

    // Default code should be visible
    expect(screen.getByText((_content, node) => {
      return node?.tagName === 'CODE' && node?.textContent === 'print("pipeline")';
    })).toBeInTheDocument();
  });

  it('filters out venv, node_modules, and build cache files from the file list', () => {
    render(
      <SourceCodeTab
        {...mockProps}
        files={[
          'pipeline.py',
          'venv/lib/python3.11/site-packages/beam.py',
          'node_modules/pkg/index.js',
          '.venv/lib/site-packages/test.py',
          '__pycache__/pipeline.pyc'
        ]}
      />
    );

    expect(screen.getByText('pipeline.py')).toBeInTheDocument();
    expect(screen.queryByText('venv/lib/python3.11/site-packages/beam.py')).not.toBeInTheDocument();
    expect(screen.queryByText('.venv/lib/site-packages/test.py')).not.toBeInTheDocument();
  });

  it('calls onStopGeneration when clicking Stop button', () => {
    const onStopGeneration = vi.fn();
    render(<SourceCodeTab {...mockProps} isGenerating={true} onStopGeneration={onStopGeneration} />);

    const stopBtn = screen.getByText('Stop');
    fireEvent.click(stopBtn);
    expect(onStopGeneration).toHaveBeenCalled();
  });

  it('calls setLanguage when selecting radio buttons', () => {
    render(<SourceCodeTab {...mockProps} />);

    fireEvent.click(screen.getByLabelText('Java'));
    expect(mockProps.setLanguage).toHaveBeenCalledWith('Java');
  });

  it('calls setOutputFolder when typing in folder input', () => {
    render(<SourceCodeTab {...mockProps} />);

    const input = screen.getByPlaceholderText('./scratch_flow/');
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

    fireEvent.click(screen.getByText('Generate Code'));
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
        files={['job.py', 'custom_transform.py', 'requirements.txt']}
        selectedFile="custom_transform.py"
        selectedFileContent="def process(element): return element"
      />
    );

    // Selected file tab button
    expect(screen.getByText('custom_transform.py', { selector: 'span' })).toBeInTheDocument();

    // Selected file content
    expect(screen.getByText((_content, node) => {
      return node?.tagName === 'CODE' && node?.textContent === 'def process(element): return element';
    })).toBeInTheDocument();
  });

  describe('highlightCode', () => {
    it('correctly highlights Java main method without token leakage', () => {
      const code = 'public static void main(String[] args) {\n    System.out.println("Hello");\n}';
      const highlighted = highlightCode(code, 'ParseMessagePipeline.java', 'Java');
      expect(highlighted).toContain('main');
      expect(highlighted).not.toContain('___TOKEN_');
      expect(highlighted).not.toContain('\uE000TOKEN_');
    });

    it('correctly highlights Python def main without token leakage', () => {
      const code = 'def main():\n    print("Hello")';
      const highlighted = highlightCode(code, 'pipeline.py', 'Python');
      expect(highlighted).toContain('main');
      expect(highlighted).not.toContain('___TOKEN_');
      expect(highlighted).not.toContain('\uE000TOKEN_');
    });

    // M11 (c): Correctness regression - special replacement patterns must render literally
    it('renders replacement patterns ($&, $`, $\', $1) literally without expansion or corruption', () => {
      const code = 'cost = "$& tax"\nprefix = "$` before"\nsuffix = "$\' after"\ngroup = "$1 match"';
      const highlighted = highlightCode(code, 'pipeline.py', 'Python');
      expect(highlighted).toContain('$&amp; tax');
      expect(highlighted).toContain('$` before');
      expect(highlighted).toContain("$\' after");
      expect(highlighted).toContain('$1 match');
      expect(highlighted).not.toContain('\uE000TOKEN_');
      expect(highlighted).not.toContain('___TOKEN_');
    });

    // M11: Security - HTML escaping before tokenisation prevents XSS
    it('escapes HTML tags to prevent XSS injection from untrusted model code', () => {
      const maliciousCode = '<script>alert(1)</script>\n<img src=x onerror=1>';
      const highlighted = highlightCode(maliciousCode, 'pipeline.py', 'Python');

      expect(highlighted).not.toContain('<script>');
      expect(highlighted).not.toContain('</script>');
      expect(highlighted).not.toContain('<img');
      expect(highlighted).toContain('&lt;script&gt;');
      expect(highlighted).toContain('&lt;/script&gt;');
      expect(highlighted).toContain('&lt;img src=x onerror=1&gt;');
    });

    // M11: Behaviour preserved for representative Python snippet
    it('preserves expected syntax highlighting spans for representative Python snippets', () => {
      const pythonSnippet = '# Pipeline definition\nimport apache_beam as beam\n\ndef run():\n    msg = "Hello World"\n    print(msg)';
      const highlighted = highlightCode(pythonSnippet, 'pipeline.py', 'Python');

      // Comments
      expect(highlighted).toContain('<span class="text-slate-500"># Pipeline definition</span>');
      // Keywords
      expect(highlighted).toContain('<span class="text-pink-500 font-bold">import</span>');
      expect(highlighted).toContain('<span class="text-pink-500 font-bold">as</span>');
      expect(highlighted).toContain('<span class="text-pink-500 font-bold">def</span>');
      // Strings
      expect(highlighted).toContain('<span class="text-green-400">"Hello World"</span>');
      // Functions
      expect(highlighted).toContain('<span class="text-blue-400">run</span>');
      expect(highlighted).toContain('<span class="text-blue-400">print</span>');
    });

    // M11: Behaviour preserved for representative Java snippet
    it('preserves expected syntax highlighting spans for representative Java snippets', () => {
      const javaSnippet = '// Main pipeline class\npackage com.example;\n\npublic class Pipeline {\n    /* entrypoint */\n    public static void main(String[] args) {\n        System.out.println("Started");\n    }\n}';
      const highlighted = highlightCode(javaSnippet, 'Pipeline.java', 'Java');

      // Comments
      expect(highlighted).toContain('<span class="text-slate-500">// Main pipeline class</span>');
      expect(highlighted).toContain('<span class="text-slate-500">/* entrypoint */</span>');
      // Keywords
      expect(highlighted).toContain('<span class="text-pink-500 font-bold">package</span>');
      expect(highlighted).toContain('<span class="text-pink-500 font-bold">public</span>');
      expect(highlighted).toContain('<span class="text-pink-500 font-bold">class</span>');
      expect(highlighted).toContain('<span class="text-pink-500 font-bold">static</span>');
      expect(highlighted).toContain('<span class="text-pink-500 font-bold">void</span>');
      expect(highlighted).toContain('<span class="text-pink-500 font-bold">main</span>');
      expect(highlighted).toContain('<span class="text-pink-500 font-bold">String</span>');
      // Strings
      expect(highlighted).toContain('<span class="text-green-400">"Started"</span>');
      // Methods
      expect(highlighted).toContain('<span class="text-blue-400">println</span>');
    });

    // M11 (b): Memoisation - re-rendering with identical code/language/file does not recompute
    it('does not recompute highlightCode when re-rendering with identical props', () => {
      const spy = vi.fn(highlightCode);
      const { rerender } = render(<SourceCodeTab {...mockProps} highlighter={spy} />);
      expect(spy).toHaveBeenCalledTimes(1);

      // Re-rendering with an unrelated prop change does NOT re-run the highlighter
      rerender(<SourceCodeTab {...mockProps} highlighter={spy} outputFolder="new/output/folder" />);
      expect(spy).toHaveBeenCalledTimes(1);

      // Re-rendering with changed code DOES re-run the highlighter
      rerender(<SourceCodeTab {...mockProps} highlighter={spy} generatedCode="print('updated')" />);
      expect(spy).toHaveBeenCalledTimes(2);
    });

    it('renders token usage message when tokenUsage prop is provided', () => {
      render(
        <SourceCodeTab
          {...mockProps}
          tokenUsage={{
            inputTokens: 1420,
            outputTokens: 856,
            totalTokens: 2276,
          }}
        />
      );

      const tokenBox = screen.getByTestId('token-usage');
      expect(tokenBox).toBeInTheDocument();
      expect(screen.getByText('Tokens:')).toBeInTheDocument();
      expect(screen.getByText('1,420')).toBeInTheDocument();
      expect(screen.getByText('856')).toBeInTheDocument();
    });

    it('does not render token usage message when tokenUsage is null or undefined', () => {
      render(<SourceCodeTab {...mockProps} tokenUsage={null} />);
      expect(screen.queryByTestId('token-usage')).not.toBeInTheDocument();
    });

    it('disables Generate Code button and displays validation error callout when isGraphValid is false', () => {
      render(
        <SourceCodeTab
          {...mockProps}
          isGraphValid={false}
          validationErrors={['Cyclic dependency detected: Step 1 -> Step 2 -> Step 1']}
        />
      );

      const generateBtn = screen.getByText('Generate Code').closest('button');
      expect(generateBtn).toBeDisabled();

      const errorCallout = screen.getByTestId('codegen-validation-error');
      expect(errorCallout).toBeInTheDocument();
      expect(errorCallout).toHaveTextContent('Cannot Generate Code');
      expect(errorCallout).toHaveTextContent('Cyclic dependency detected: Step 1 -> Step 2 -> Step 1');

      // Clicking disabled button does not trigger onRegenerate
      fireEvent.click(generateBtn!);
      expect(mockProps.onRegenerate).not.toHaveBeenCalled();
      expect(generateBtn).toHaveAttribute(
        'title',
        'Cannot Generate Code:\nCyclic dependency detected: Step 1 -> Step 2 -> Step 1'
      );
      expect(screen.getByText('Generation disabled: resolve diagram errors to continue')).toBeInTheDocument();
    });

    it('displays multiple validation errors and formats them as a list with tooltip on button', () => {
      render(
        <SourceCodeTab
          {...mockProps}
          isGraphValid={false}
          validationErrors={[
            'Cyclic dependency detected: Step 1 -> Step 2 -> Step 1',
            'Orphan node(s) detected: "Unconnected" (orphan). All steps must be connected into the pipeline.',
          ]}
        />
      );

      const generateBtn = screen.getByText('Generate Code').closest('button');
      expect(generateBtn).toBeDisabled();
      expect(generateBtn).toHaveAttribute(
        'title',
        'Cannot Generate Code:\nCyclic dependency detected: Step 1 -> Step 2 -> Step 1\nOrphan node(s) detected: "Unconnected" (orphan). All steps must be connected into the pipeline.'
      );

      const errorCallout = screen.getByTestId('codegen-validation-error');
      expect(errorCallout).toHaveTextContent('Cyclic dependency detected: Step 1 -> Step 2 -> Step 1');
      expect(errorCallout).toHaveTextContent('Orphan node(s) detected: "Unconnected" (orphan)');
      expect(screen.getByText('Generation disabled: resolve diagram errors to continue')).toBeInTheDocument();
    });

    it('enables Generate Code button and hides error callout when isGraphValid is true', () => {
      render(
        <SourceCodeTab
          {...mockProps}
          isGraphValid={true}
          validationErrors={[]}
        />
      );

      const generateBtn = screen.getByText('Generate Code').closest('button');
      expect(generateBtn).not.toBeDisabled();
      expect(generateBtn).not.toHaveAttribute('title');
      expect(screen.queryByTestId('codegen-validation-error')).not.toBeInTheDocument();
      expect(screen.queryByText('Generation disabled: resolve diagram errors to continue')).not.toBeInTheDocument();
    });
    it('renders token usage message when tokenUsage prop is provided', () => {
      render(
        <SourceCodeTab
          {...mockProps}
          tokenUsage={{
            inputTokens: 1420,
            outputTokens: 856,
            totalTokens: 2276,
          }}
        />
      );

      const tokenBox = screen.getByTestId('token-usage');
      expect(tokenBox).toBeInTheDocument();
      expect(screen.getByText('Tokens:')).toBeInTheDocument();
      expect(screen.getByText('1,420')).toBeInTheDocument();
      expect(screen.getByText('856')).toBeInTheDocument();
    });

    it('does not render token usage message when tokenUsage is null or undefined', () => {
      render(<SourceCodeTab {...mockProps} tokenUsage={null} />);
      expect(screen.queryByTestId('token-usage')).not.toBeInTheDocument();
    });
  });
});

