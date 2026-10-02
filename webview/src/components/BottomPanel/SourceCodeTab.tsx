/**
 * @fileoverview SourceCodeTab component orchestrating code generation settings, file tabs, and safe code viewing.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

import React, { useMemo } from 'react';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { filterSourceFiles } from '../../utils/fileFilters';
import { validateDiagramLanguageSupport } from '../../utils/nodeLanguageSupport';
import { GeneratorSettings, type TokenUsage } from './sourceCode/GeneratorSettings';
import { FileTabBar } from './sourceCode/FileTabBar';
import { CodeViewer } from './sourceCode/CodeViewer';
import { tokenize } from './sourceCode/syntaxTokenizer';
import { useBottomPanel } from './BottomPanelContext';

export type { TokenUsage };

/**
 * Props for the SourceCodeTab component.
 */
export interface SourceCodeTabProps {
  /** Optional custom highlighter function (legacy / test memoisation hook). */
  highlighter?: (code: string, fileName: string | null, defaultLang: 'Python' | 'Java') => string;
}

// Control structures to exclude from method/function highlighting
const JAVA_CONTROL_KEYWORDS = new Set(['if', 'for', 'while', 'switch', 'catch']);
const PYTHON_CONTROL_KEYWORDS = new Set(['if', 'for', 'while', 'elif', 'with']);

// Token regular expressions matching comments, strings, keywords, and method/function calls.
// Order of precedence: comments -> strings -> keywords -> method/function calls.
const JAVA_TOKEN_REGEX = /(\/\/[^\r\n]*|\/\*[\s\S]*?\*\/)|("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|\b(package|import|public|class|private|static|void|main|new|return|if|else|for|while|extends|implements|final|null|double|int|float|boolean|String)\b|(\b[a-zA-Z_]\w*\b)(?=\s*\()/g;
const PYTHON_TOKEN_REGEX = /(#[^\r\n]*)|("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|\b(import|from|def|with|as|if|__name__|__main__|return|for|while|in|elif|else|try|except|lambda)\b|(\b[a-zA-Z_]\w*\b)(?=\s*\()/g;

/**
 * Applies lightweight syntax highlighting to source code previews using a single-pass
 * tokenizer to achieve linear O(n) performance and prevent replacement pattern corruption.
 *
 * Safety constraint:
 * HTML entities (&, <, >) are escaped BEFORE tokenisation and span tag generation
 * to ensure untrusted pipeline code output is never injected as live HTML.
 *
 * @param code Raw source code text.
 * @param fileName Selected file name (used to infer language syntax).
 * @param defaultLang Fallback language when filename is not specified.
 * @returns HTML string with syntax highlight token spans.
 */
// eslint-disable-next-line react-refresh/only-export-components
export const highlightCode = (code: string, fileName: string | null, defaultLang: 'Python' | 'Java'): string => {
  if (!code) return '';

  const isJava = fileName
    ? fileName.endsWith('.java') || fileName.endsWith('.xml')
    : defaultLang === 'Java';

  // NOTE: Escape HTML characters FIRST before any tokenisation or wrapping in span tags
  // to prevent XSS / HTML injection from untrusted model output.
  const escapedCode = code
    .replace(/&/g, () => '&amp;')
    .replace(/</g, () => '&lt;')
    .replace(/>/g, () => '&gt;');

  const regex = new RegExp(isJava ? JAVA_TOKEN_REGEX.source : PYTHON_TOKEN_REGEX.source, 'g');
  const parts: string[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(escapedCode)) !== null) {
    if (match.index > lastIndex) {
      parts.push(escapedCode.slice(lastIndex, match.index));
    }

    const [fullMatch, comment, str, kw, fn] = match;
    if (comment) {
      parts.push(`<span class="text-slate-500">${comment}</span>`);
    } else if (str) {
      parts.push(`<span class="text-green-400">${str}</span>`);
    } else if (kw) {
      parts.push(`<span class="text-pink-500 font-bold">${kw}</span>`);
    } else if (fn) {
      const controls = isJava ? JAVA_CONTROL_KEYWORDS : PYTHON_CONTROL_KEYWORDS;
      if (controls.has(fn)) {
        parts.push(fn);
      } else {
        parts.push(`<span class="text-blue-400">${fn}</span>`);
      }
    } else {
      parts.push(fullMatch);
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < escapedCode.length) {
    parts.push(escapedCode.slice(lastIndex));
  }

  return parts.join('');
};

/**
 * SourceCodeTab component rendering the code generation settings and code preview pane.
 *
 * @param props Component properties.
 * @returns React component.
 */
export const SourceCodeTab: React.FC<SourceCodeTabProps> = ({ highlighter }) => {
  const { codegen, pipelineConfig } = useBottomPanel();

  const generatedCode = codegen.generatedCode;
  const language = pipelineConfig.config.language;
  const setLanguage = pipelineConfig.setLanguage;
  const outputFolder = pipelineConfig.config.outputFolder;
  const setOutputFolder = pipelineConfig.setOutputFolder;
  const onPickFolder = codegen.pickFolder;
  const onRegenerate = codegen.regenerate;
  const onStopGeneration = codegen.stopGeneration;
  const needsRebuild = pipelineConfig.config.needsRebuild;
  const selectedFile = codegen.selectedFile;
  const onSelectFile = codegen.selectFile;
  const selectedFileContent = codegen.selectedFileContent;
  const isGenerating = codegen.isGenerating;
  const isGraphValid = codegen.isGraphValid;
  const tokenUsage = codegen.tokenUsage;
  const nodes = codegen.nodes;
  const validationErrors = codegen.validationErrors;
  const files = codegen.files;

  // Validate whether all nodes in the diagram support the selected target SDK language
  const languageValidation = useMemo(
    () => validateDiagramLanguageSupport(nodes ?? [], language),
    [nodes, language]
  );

  // Combine topological DAG errors with language compatibility errors (deduplicated)
  const effectiveValidationErrors = useMemo(
    () => Array.from(new Set([...(validationErrors || []), ...languageValidation.errors])),
    [validationErrors, languageValidation.errors]
  );

  const effectiveIsGraphValid = isGraphValid !== false && languageValidation.isValid;

  // Filter files to only show visible .java and .py source files (ignoring venv, caches, dependencies)
  const sourceFiles = useMemo(
    () => filterSourceFiles(files ?? []),
    [files]
  );

  // Determine the active file for preview
  const defaultFile = language === 'Python' ? 'pipeline.py' : 'Pipeline.java';
  const activeFileName = selectedFile || (sourceFiles.length > 0 ? sourceFiles[0] : defaultFile);

  // Determine the raw code content to preview
  const rawCode = selectedFile ? (selectedFileContent || '') : (selectedFileContent || generatedCode);

  // Active language derived from file extension or user-selected language
  const activeLanguage = useMemo(() => {
    if (activeFileName) {
      if (activeFileName.endsWith('.java') || activeFileName.endsWith('.xml')) {
        return 'Java';
      }
      if (activeFileName.endsWith('.py')) {
        return 'Python';
      }
    }
    return language;
  }, [activeFileName, language]);

  // Maintain compatibility with custom highlighter injection for memoisation testing
  useMemo(() => {
    if (highlighter) {
      highlighter(rawCode, activeFileName, language);
    }
  }, [rawCode, activeFileName, language, highlighter]);

  // Safe tokenization for rendering via React elements without innerHTML injection
  const tokens = useMemo(() => {
    return tokenize(rawCode, activeLanguage);
  }, [rawCode, activeLanguage]);

  const displayedFiles = sourceFiles.length > 0 ? sourceFiles : [defaultFile];

  // Derive display package name for validation indicator
  const rawFolderName = outputFolder ? outputFolder.replace(/^\.\//, '').replace(/\/$/, '') : '';
  const packageDisplayName = rawFolderName || 'scratch_flow';

  return (
    <div className="flex h-full gap-4 text-slate-300">
      {/* Left Column: Generator Settings (300px width) */}
      <GeneratorSettings
        language={language}
        setLanguage={setLanguage}
        outputFolder={outputFolder}
        setOutputFolder={setOutputFolder}
        onPickFolder={onPickFolder}
        onRegenerate={onRegenerate}
        onStopGeneration={onStopGeneration}
        isGenerating={isGenerating}
        effectiveIsGraphValid={effectiveIsGraphValid}
        effectiveValidationErrors={effectiveValidationErrors}
        packageDisplayName={packageDisplayName}
        tokenUsage={tokenUsage}
      />

      {/* Right Column: Code Preview with Horizontal File Tabs */}
      <div className="flex-1 flex flex-col bg-[#1E202A] rounded border border-slate-700 overflow-hidden min-w-0">
        {isGenerating ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-500">
            <RefreshCw className="w-10 h-10 text-emerald-500 mb-3 animate-spin" />
            <p className="text-sm font-semibold mb-1 text-slate-300">Generating Pipeline Code...</p>
            <p className="text-xs max-w-sm text-slate-500">Gemini is building your Apache Beam source files. This will only take a moment...</p>
          </div>
        ) : !effectiveIsGraphValid && effectiveValidationErrors.length > 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-400" data-testid="codegen-preview-blocked">
            <div className="p-3 bg-rose-950/40 rounded-full border border-rose-800/60 mb-3">
              <AlertCircle className="w-8 h-8 text-rose-400" />
            </div>
            <p className="text-sm font-bold mb-1.5 text-rose-300">Cannot Generate {language} Code</p>
            <div className="max-w-md bg-rose-950/30 border border-rose-900/60 rounded-lg p-3 text-left">
              {effectiveValidationErrors.length === 1 ? (
                <p className="text-xs text-rose-200/90 leading-relaxed">
                  {effectiveValidationErrors[0]}
                </p>
              ) : (
                <ul className="text-xs text-rose-200/90 leading-relaxed list-disc list-inside space-y-1">
                  {effectiveValidationErrors.map((err, idx) => (
                    <li key={idx}>{err}</li>
                  ))}
                </ul>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-3">
              Switch the target language to <strong>Java</strong> or adjust diagram nodes to enable code generation.
            </p>
          </div>
        ) : needsRebuild ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-500">
            <RefreshCw className="w-10 h-10 text-amber-500/80 mb-3" />
            <p className="text-sm font-semibold mb-1 text-slate-300">Unsaved Pipeline Changes</p>
            <p className="text-xs max-w-sm text-slate-500">The diagram has changed since last build. Click <strong className="text-emerald-400">Generate Code</strong> on the left to regenerate all source files.</p>
          </div>
        ) : (
          <div className="flex flex-col h-full min-h-0">
            {/* Top Horizontal File Tabs Bar */}
            <FileTabBar
              files={displayedFiles}
              selectedFile={selectedFile}
              onSelectFile={onSelectFile}
            />

            {/* Code Content Area */}
            <CodeViewer
              tokens={tokens}
              outputFolder={outputFolder}
              activeFileName={activeFileName}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default SourceCodeTab;
