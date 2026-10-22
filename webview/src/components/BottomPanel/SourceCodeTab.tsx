/**
 * @fileoverview SourceCodeTab component orchestrating code generation settings, vertical file explorer, and safe code viewing.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  Copy,
  Download,
  FileCode,
  RefreshCw,
  Search,
} from 'lucide-react';
import { filterGeneratedFiles, sortGeneratedFiles } from '../../utils/fileFilters';
import { validateDiagramLanguageSupport } from '../../utils/nodeLanguageSupport';
import { GeneratorSettings, type TokenUsage } from './sourceCode/GeneratorSettings';
import { FileTabBar } from './sourceCode/FileTabBar';
import { CodeViewer } from './sourceCode/CodeViewer';
import { FindInFilesBar } from './sourceCode/FindInFilesBar';
import { tokenize } from './sourceCode/syntaxTokenizer';
import { useBottomPanel } from './BottomPanelContext';

export type { TokenUsage };

/** Default Gemini model displayed in the code preview header badge. */
export const DEFAULT_CODEGEN_MODEL = 'gemini-3.7-flash';

/**
 * Props for the SourceCodeTab component.
 */
export interface SourceCodeTabProps {
  /** Optional custom highlighter function (legacy / test memoisation hook). */
  readonly highlighter?: (
    code: string,
    fileName: string | null,
    defaultLang: 'Python' | 'Java',
  ) => string;
}

// Control structures to exclude from method/function highlighting
const JAVA_CONTROL_KEYWORDS = new Set(['if', 'for', 'while', 'switch', 'catch']);
const PYTHON_CONTROL_KEYWORDS = new Set(['if', 'for', 'while', 'elif', 'with']);

// Token regular expressions matching comments, strings, keywords, and method/function calls.
// Order of precedence: comments -> strings -> keywords -> method/function calls.
const JAVA_TOKEN_REGEX =
  /(\/\/[^\r\n]*|\/\*[\s\S]*?\*\/)|("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|\b(package|import|public|class|private|static|void|main|new|return|if|else|for|while|extends|implements|final|null|double|int|float|boolean|String)\b|(\b[a-zA-Z_]\w*\b)(?=\s*\()/g;
const PYTHON_TOKEN_REGEX =
  /(#[^\r\n]*)|("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|\b(import|from|def|with|as|if|__name__|__main__|return|for|while|in|elif|else|try|except|lambda)\b|(\b[a-zA-Z_]\w*\b)(?=\s*\()/g;

/**
 * Escapes special regular expression characters in a literal search query.
 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Applies lightweight syntax highlighting to source code previews using a single-pass
 * tokenizer to achieve linear O(n) performance and prevent replacement pattern corruption.
 *
 * Safety constraint:
 * HTML entities (&, <, >) are escaped BEFORE tokenisation and span tag generation
 * to ensure untrusted pipeline code output is never injected as live HTML.
 */
// eslint-disable-next-line react-refresh/only-export-components
export const highlightCode = (
  code: string,
  fileName: string | null,
  defaultLang: 'Python' | 'Java',
): string => {
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

  const regex = new RegExp(
    isJava ? JAVA_TOKEN_REGEX.source : PYTHON_TOKEN_REGEX.source,
    'g',
  );
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
 * Renders the code generation settings, vertical generated files list, and single-file code preview pane.
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

  const [copied, setCopied] = useState(false);
  const [isFindOpen, setIsFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState('');
  const [findCaseSensitive, setFindCaseSensitive] = useState(false);

  // Validate whether all nodes in the diagram support the selected target SDK language
  const languageValidation = useMemo(
    () => validateDiagramLanguageSupport(nodes ?? [], language),
    [nodes, language],
  );

  // Combine topological DAG errors with language compatibility errors (deduplicated)
  const effectiveValidationErrors = useMemo(
    () =>
      Array.from(
        new Set([...(validationErrors || []), ...languageValidation.errors]),
      ),
    [validationErrors, languageValidation.errors],
  );

  const effectiveIsGraphValid =
    isGraphValid !== false && languageValidation.isValid;

  // Filter and sort all user-facing generated files (source, dependencies, docs, Docker, scripts)
  const generatedFiles = useMemo(
    () => sortGeneratedFiles(filterGeneratedFiles(files ?? []), language),
    [files, language],
  );

  // Determine the active file for preview
  const defaultFile = language === 'Python' ? 'pipeline.py' : 'Pipeline.java';
  const activeFileName =
    selectedFile ||
    (generatedFiles.length > 0 ? generatedFiles[0] : defaultFile);

  // Determine the raw code content to preview
  const rawCode = selectedFile
    ? selectedFileContent || ''
    : selectedFileContent || generatedCode;

  // Active language derived from file extension or user-selected language
  const activeLanguage = useMemo((): 'Python' | 'Java' => {
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

  const displayedFiles =
    generatedFiles.length > 0 ? generatedFiles : [defaultFile];

  // Count matches in active file when Find bar is open
  const matchCount = useMemo((): number => {
    const trimmed = findQuery.trim();
    if (!trimmed || !rawCode) return 0;
    const flags = findCaseSensitive ? 'g' : 'gi';
    const regex = new RegExp(escapeRegExp(trimmed), flags);
    const matches = rawCode.match(regex);
    return matches ? matches.length : 0;
  }, [rawCode, findQuery, findCaseSensitive]);

  // Keyboard shortcut Ctrl+F / Cmd+F to open Find bar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setIsFindOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleCopy = (): void => {
    if (!rawCode) return;
    if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(rawCode);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadFile = (): void => {
    if (!rawCode) return;
    const blob = new Blob([rawCode], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeFileName.split('/').pop() || activeFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Derive display package name for validation indicator
  const rawFolderName = outputFolder
    ? outputFolder.replace(/^\.\//, '').replace(/\/$/, '')
    : '';
  const packageDisplayName = rawFolderName || 'scratch_flow';

  return (
    <div className="flex h-full gap-4 text-slate-300">
      {/* Left Column: Generator Settings */}
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

      {/* Right Column: File List Sidebar & Single-File Code Preview */}
      <div className="flex-1 flex flex-col bg-[#0d1117] rounded border border-[#30363d] overflow-hidden min-w-0">
        {isGenerating ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-500">
            <RefreshCw className="w-10 h-10 text-emerald-500 mb-3 animate-spin" />
            <p className="text-sm font-semibold mb-1 text-slate-300">
              Generating Pipeline Code...
            </p>
            <p className="text-xs max-w-sm text-slate-500">
              Gemini is building your Apache Beam source files. This will only
              take a moment...
            </p>
          </div>
        ) : !effectiveIsGraphValid && effectiveValidationErrors.length > 0 ? (
          <div
            className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-400"
            data-testid="codegen-preview-blocked"
          >
            <div className="p-3 bg-rose-950/40 rounded-full border border-rose-800/60 mb-3">
              <AlertCircle className="w-8 h-8 text-rose-400" />
            </div>
            <p className="text-sm font-bold mb-1.5 text-rose-300">
              Cannot Generate {language} Code
            </p>
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
              Switch the target language to <strong>Java</strong> or adjust
              diagram nodes to enable code generation.
            </p>
          </div>
        ) : needsRebuild ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-500">
            <RefreshCw className="w-10 h-10 text-amber-500/80 mb-3" />
            <p className="text-sm font-semibold mb-1 text-slate-300">
              Unsaved Pipeline Changes
            </p>
            <p className="text-xs max-w-sm text-slate-500">
              The diagram has changed since last build. Click{' '}
              <strong className="text-emerald-400">Generate Code</strong> on the
              left to regenerate all source files.
            </p>
          </div>
        ) : (
          <div className="flex flex-col h-full min-h-0">
            {/* Top Header Bar: Active Filename, Model Badge, and File Actions */}
            <div className="h-10 border-b border-[#30363d] bg-[#161b22] px-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <FileCode className="w-4 h-4 text-blue-400 shrink-0" />
                <span
                  data-testid="active-file-header-name"
                  className="text-xs font-mono font-semibold text-slate-200 truncate"
                >
                  <span>{activeFileName.slice(0, 1)}</span>
                  <span>{activeFileName.slice(1)}</span>
                </span>
                <span
                  data-testid="active-model-badge"
                  className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-mono bg-blue-950/60 border border-blue-800/50 text-blue-300 shrink-0"
                >
                  Model: {DEFAULT_CODEGEN_MODEL}
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsFindOpen((prev) => !prev)}
                  data-testid="find-in-code-btn"
                  title="Find in File (Ctrl+F)"
                  className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded border transition cursor-pointer ${
                    isFindOpen
                      ? 'bg-blue-600/20 border-blue-500/50 text-blue-300'
                      : 'bg-[#21262d] hover:bg-[#30363d] border-[#30363d] text-slate-300'
                  }`}
                >
                  <Search className="w-3.5 h-3.5" />
                  Find
                </button>
                <button
                  type="button"
                  onClick={handleCopy}
                  data-testid="copy-code-btn"
                  className="flex items-center gap-1.5 px-2.5 py-1 text-xs bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] rounded text-slate-300 transition cursor-pointer"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  {copied ? 'Copied' : 'Copy'}
                </button>
                <button
                  type="button"
                  onClick={handleDownloadFile}
                  data-testid="download-code-btn"
                  title="Download current file"
                  className="flex items-center gap-1.5 px-2.5 py-1 text-xs bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] rounded text-slate-300 transition cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download
                </button>
              </div>
            </div>

            {/* Inline Find Bar */}
            <FindInFilesBar
              isOpen={isFindOpen}
              query={findQuery}
              onQueryChange={setFindQuery}
              caseSensitive={findCaseSensitive}
              onToggleCaseSensitive={() =>
                setFindCaseSensitive((prev) => !prev)
              }
              matchCount={matchCount}
              onClose={() => setIsFindOpen(false)}
            />

            {/* Main Split Body: Vertical File List on Left + Code Viewer on Right */}
            <div className="flex-1 flex min-h-0 overflow-hidden">
              <FileTabBar
                files={displayedFiles}
                selectedFile={selectedFile}
                onSelectFile={onSelectFile}
              />

              <CodeViewer
                tokens={tokens}
                outputFolder={outputFolder}
                activeFileName={activeFileName}
                searchQuery={isFindOpen ? findQuery : ''}
                searchCaseSensitive={findCaseSensitive}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SourceCodeTab;
