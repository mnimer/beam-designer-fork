import React from 'react';
import { Folder, RefreshCw, FileCode, FileText, Play, Sliders, CheckCircle2, Square } from 'lucide-react';
import { filterSourceFiles } from '../../utils/fileFilters';

/**
 * SourceCodeTab Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Renders the Code Generation settings and Code Preview pane. Displays all generated .py, .java, and configuration
 * files in horizontal tabs along the top of the code editor pane for easy switching and inspection.
 * 
 * Architectural Decisions:
 * - Displays generated files as horizontal scrollable tabs directly above the code preview block.
 * - Left column contains Generator Settings (Target Language, Output Folder, Generate Code, and Stop action).
 * - Styled to match modern dark theme design with 8pt grid spacing system and tailwindcss styling.
 * - Code syntax highlighting supports Python, Java, XML, shell scripts, and configuration files.
 */
interface SourceCodeTabProps {
  generatedCode: string;
  language: 'Python' | 'Java';
  setLanguage: (lang: 'Python' | 'Java') => void;
  outputFolder: string;
  setOutputFolder: (folder: string) => void;
  onPickFolder: () => void;
  onRegenerate: () => void;
  onStopGeneration?: () => void;
  needsRebuild: boolean;
  files: string[];
  selectedFile: string | null;
  onSelectFile: (fileName: string) => void;
  selectedFileContent: string | null;
  isGenerating?: boolean;
}

/**
 * Applies lightweight syntax highlighting to source code previews.
 * 
 * @param code Raw source code text.
 * @param fileName Selected file name (used to infer language syntax).
 * @param defaultLang Fallback language when filename is not specified.
 * @returns HTML string with syntax highlight token spans.
 */
export const highlightCode = (code: string, fileName: string | null, defaultLang: 'Python' | 'Java'): string => {
  if (!code) return '';
  
  let isJava = false;
  if (fileName) {
    isJava = fileName.endsWith('.java') || fileName.endsWith('.xml');
  } else {
    isJava = defaultLang === 'Java';
  }

  const tokens: string[] = [];
  let tokenCounter = 0;
  
  const addToken = (str: string, cls: string) => {
    const id = `\uE000TOKEN_${tokenCounter++}\uE000`;
    tokens.push(`<span class="${cls}">${str}</span>`);
    return id;
  };
  
  let tempCode = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
    
  if (isJava) {
    // Comments
    tempCode = tempCode.replace(/(\/\/.*)/g, (match) => addToken(match, 'text-slate-500'));
    tempCode = tempCode.replace(/(\/\*[\s\S]*?\*\/)/g, (match) => addToken(match, 'text-slate-500'));
    // Strings
    tempCode = tempCode.replace(/(['"])(.*?)\1/g, (match) => addToken(match, 'text-green-400'));
    // Keywords
    tempCode = tempCode.replace(/\b(package|import|public|class|private|static|void|main|new|return|if|else|for|while|extends|implements|final|null|double|int|float|boolean|String)\b/g, (match) => addToken(match, 'text-pink-500 font-bold'));
    // Methods (excluding control structures)
    tempCode = tempCode.replace(/\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g, (match, p1) => {
      if (['if', 'for', 'while', 'switch', 'catch'].includes(p1)) {
        return match;
      }
      const id = addToken(p1, 'text-blue-400');
      return `${id}(`;
    });
  } else {
    // Python/Shell script comments
    tempCode = tempCode.replace(/(#.*)/g, (match) => addToken(match, 'text-slate-500'));
    // Strings
    tempCode = tempCode.replace(/(['"])(.*?)\1/g, (match) => addToken(match, 'text-green-400'));
    // Keywords (excluding print/logging, which are highlighted as functions)
    tempCode = tempCode.replace(/\b(import|from|def|with|as|if|__name__|__main__|return|for|while|in|elif|else|try|except|lambda)\b/g, (match) => addToken(match, 'text-pink-500 font-bold'));
    // Functions (excluding control structures)
    tempCode = tempCode.replace(/\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g, (match, p1) => {
      if (['if', 'for', 'while', 'elif', 'with'].includes(p1)) {
        return match;
      }
      const id = addToken(p1, 'text-blue-400');
      return `${id}(`;
    });
  }
  
  tokens.forEach((token, index) => {
    const id = `\uE000TOKEN_${index}\uE000`;
    tempCode = tempCode.replace(id, token);
  });
  
  return tempCode;
};

export const SourceCodeTab: React.FC<SourceCodeTabProps> = ({
  generatedCode,
  language,
  setLanguage,
  outputFolder,
  setOutputFolder,
  onPickFolder,
  onRegenerate,
  onStopGeneration,
  needsRebuild,
  files,
  selectedFile,
  onSelectFile,
  selectedFileContent,
  isGenerating = false
}) => {
  // Filter files to only show visible .java and .py source files (ignoring venv, caches, dependencies)
  const sourceFiles = filterSourceFiles(files);

  // Determine the active file for preview
  const defaultFile = language === 'Python' ? 'pipeline.py' : 'Pipeline.java';
  const activeFileName = selectedFile || (sourceFiles.length > 0 ? sourceFiles[0] : defaultFile);

  // Helper to pick appropriate file icon
  const getFileIcon = (fileName: string) => {
    if (fileName.endsWith('.py') || fileName.endsWith('.java')) {
      return <FileCode className="w-3.5 h-3.5 text-blue-400 shrink-0" />;
    }
    return <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />;
  };

  const displayedFiles = sourceFiles.length > 0 ? sourceFiles : [defaultFile];

  // Derive display package name for validation indicator
  const rawFolderName = outputFolder ? outputFolder.replace(/^\.\//, '').replace(/\/$/, '') : '';
  const packageDisplayName = rawFolderName || 'scratch_flow';

  return (
    <div className="flex h-full gap-4 text-slate-300">
      {/* Left Column: Generator Settings (300px width) */}
      <div className="w-76 shrink-0 flex flex-col bg-[#161922] rounded-xl border border-slate-700/80 overflow-hidden shadow-lg">
        {/* Panel Header */}
        <div className="border-b border-slate-700/80 bg-[#11141c] py-2.5 px-4 flex items-center">
          <div className="flex items-center gap-2">
            <Sliders className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span className="text-xs font-bold tracking-wider text-slate-200 uppercase">
              GENERATOR SETTINGS
            </span>
          </div>
        </div>

        {/* Panel Content */}
        <div className="flex-1 flex flex-col p-4 gap-4 overflow-y-auto">
          {/* Language Selection */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                LANGUAGE
              </label>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
                {language}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 p-1 bg-[#0d1017] rounded-lg border border-slate-800">
              <label
                className={`py-2 px-3 rounded-md text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition ${
                  language === 'Python'
                    ? 'bg-[#1c2333] text-white border border-slate-600/80 shadow-sm'
                    : 'bg-transparent text-slate-500 hover:text-slate-300 border border-transparent hover:bg-slate-800/40'
                }`}
              >
                <input
                  type="radio"
                  name="language"
                  value="Python"
                  aria-label="Python"
                  checked={language === 'Python'}
                  onChange={() => setLanguage('Python')}
                  className="sr-only"
                />
                <span className="text-sm leading-none">🐍</span>
                <span>Python</span>
              </label>

              <label
                className={`py-2 px-3 rounded-md text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition ${
                  language === 'Java'
                    ? 'bg-[#1c2333] text-white border border-slate-600/80 shadow-sm'
                    : 'bg-transparent text-slate-500 hover:text-slate-300 border border-transparent hover:bg-slate-800/40'
                }`}
              >
                <input
                  type="radio"
                  name="language"
                  value="Java"
                  aria-label="Java"
                  checked={language === 'Java'}
                  onChange={() => setLanguage('Java')}
                  className="sr-only"
                />
                <span className="text-sm leading-none">☕</span>
                <span>Java</span>
              </label>
            </div>
          </div>

          {/* Target Folder Picker */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Folder className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  TARGET FOLDER
                </label>
              </div>
              <button
                type="button"
                onClick={onPickFolder}
                className="text-xs font-medium text-blue-400 hover:text-blue-300 cursor-pointer hover:underline transition"
              >
                Paths
              </button>
            </div>

            <div className="flex gap-2 items-center">
              <input
                type="text"
                value={outputFolder}
                onChange={(e) => setOutputFolder(e.target.value)}
                placeholder="./scratch_flow/"
                className="bg-[#0d1017] text-white px-3 py-2 rounded-lg border border-slate-800 focus:outline-none focus:border-blue-500 text-xs flex-1 min-w-0 font-mono shadow-inner transition"
              />
              <button
                type="button"
                onClick={onPickFolder}
                className="bg-[#1c2333] hover:bg-[#252f42] text-slate-300 hover:text-white p-2 rounded-lg border border-slate-700/80 flex items-center justify-center shrink-0 cursor-pointer transition shadow-sm"
                title="Browse Folder"
              >
                <Folder className="w-4 h-4 text-slate-300" />
              </button>
            </div>

            {/* Validation subtitle matching screenshot */}
            <div className="flex items-center gap-1.5 text-emerald-400 text-[11px] font-mono mt-0.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="truncate">Valid {language} package name: {packageDisplayName}</span>
            </div>
          </div>

          {/* Action Buttons: Generate Code & Stop */}
          <div className="mt-auto pt-3 border-t border-slate-800/80 flex gap-2.5">
            <button
              type="button"
              onClick={onRegenerate}
              disabled={isGenerating}
              className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-xs font-bold flex-1 cursor-pointer transition shadow-lg shadow-emerald-950/40 ${
                isGenerating
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-[#059669] hover:bg-[#10b981] active:bg-[#047857] text-white active:scale-[0.98]'
              }`}
            >
              {isGenerating ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-current" />
              )}
              <span>{isGenerating ? 'Generating...' : 'Generate Code'}</span>
            </button>

            <button
              type="button"
              onClick={onStopGeneration}
              disabled={!isGenerating && !onStopGeneration}
              className={`flex items-center justify-center gap-1.5 py-2.5 px-3.5 rounded-lg text-xs font-bold transition shadow-sm ${
                isGenerating
                  ? 'bg-[#881337] hover:bg-[#9f1239] active:bg-[#4c0519] border border-rose-800/80 text-rose-200 hover:text-white cursor-pointer active:scale-[0.98]'
                  : 'bg-[#881337]/70 text-rose-300/80 border border-rose-900/40 cursor-pointer hover:bg-[#881337] hover:text-rose-100'
              }`}
              title="Stop Code Generation"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Stop</span>
            </button>
          </div>
        </div>
      </div>

      {/* Right Column: Code Preview with Horizontal File Tabs */}
      <div className="flex-1 flex flex-col bg-[#1E202A] rounded border border-slate-700 overflow-hidden min-w-0">
        {isGenerating ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-500">
            <RefreshCw className="w-10 h-10 text-emerald-500 mb-3 animate-spin" />
            <p className="text-sm font-semibold mb-1 text-slate-300">Generating Pipeline Code...</p>
            <p className="text-xs max-w-sm text-slate-500">Gemini is building your Apache Beam source files. This will only take a moment...</p>
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
            <div className="flex items-center border-b border-slate-700 bg-[#151722] px-2 overflow-x-auto min-h-[38px] shrink-0 no-scrollbar">
              {displayedFiles.map((file) => {
                const isSelected = selectedFile === file || (!selectedFile && file === displayedFiles[0]);
                return (
                  <button
                    key={file}
                    onClick={() => onSelectFile(file)}
                    className={`flex items-center gap-2 py-2 px-3 text-xs font-medium border-b-2 transition cursor-pointer shrink-0 whitespace-nowrap ${
                      isSelected
                        ? 'bg-[#1E202A] text-white border-blue-500 font-semibold'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border-transparent'
                    }`}
                  >
                    {getFileIcon(file)}
                    <span className="font-mono">{file}</span>
                  </button>
                );
              })}
            </div>

            {/* File Path & Preview Metadata Sub-header */}
            <div className="bg-[#1A1C26] px-4 py-1.5 border-b border-slate-800 flex justify-between items-center shrink-0">
              <span className="text-[11px] font-mono text-slate-400 truncate">
                ./{outputFolder ? `${outputFolder}/` : ''}{activeFileName}
              </span>
              <span className="text-[10px] font-bold tracking-wider text-slate-500 uppercase px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700">
                PREVIEW
              </span>
            </div>

            {/* Code Content Area */}
            <div className="flex-1 p-4 overflow-auto font-mono text-xs bg-[#1E202A]">
              <pre>
                <code dangerouslySetInnerHTML={{
                  __html: highlightCode(
                    selectedFile ? (selectedFileContent || '') : (selectedFileContent || generatedCode),
                    activeFileName,
                    language
                  ) || 'No code preview available.'
                }} />
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
