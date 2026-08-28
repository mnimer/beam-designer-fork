import React from 'react';
import { FolderOpen, RefreshCw, FileCode, FileText, Play } from 'lucide-react';

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
 * - Left column contains Generator Settings (Target Language, Output Folder, and Generate Code trigger).
 * - Code syntax highlighting supports Python, Java, XML, shell scripts, and configuration files.
 * - Adheres to 8pt grid spacing system and tailwindcss styling.
 */
interface SourceCodeTabProps {
  generatedCode: string;
  language: 'Python' | 'Java';
  setLanguage: (lang: 'Python' | 'Java') => void;
  outputFolder: string;
  setOutputFolder: (folder: string) => void;
  onPickFolder: () => void;
  onRegenerate: () => void;
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
  needsRebuild,
  files,
  selectedFile,
  onSelectFile,
  selectedFileContent,
  isGenerating = false
}) => {
  // Filter files to only show .java and .py source files
  const sourceFiles = (files || []).filter(
    (file) => file.endsWith('.py') || file.endsWith('.java')
  );

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

  return (
    <div className="flex h-full gap-4 text-slate-300">
      {/* Left Column: Generator Settings (280px fixed width) */}
      <div className="w-72 shrink-0 flex flex-col bg-[#1E202A] rounded border border-slate-700 overflow-hidden">
        {/* Panel Header */}
        <div className="border-b border-slate-700 bg-[#151722] py-2 px-4 flex items-center justify-between">
          <span className="text-xs font-bold tracking-wider text-slate-300 uppercase">
            Generator Settings
          </span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded border border-slate-700">
            {language}
          </span>
        </div>

        {/* Panel Content */}
        <div className="flex-1 flex flex-col p-4 gap-4 overflow-y-auto">
          {/* Target Framework / Language */}
          <div>
            <label className="text-xs font-bold uppercase text-slate-400 block mb-2">Language</label>
            <div className="grid grid-cols-2 gap-2">
              <label className={`flex items-center justify-center gap-2 py-2 px-3 rounded border text-xs font-semibold cursor-pointer transition ${language === 'Python' ? 'bg-blue-600/20 text-blue-300 border-blue-500' : 'bg-[#252836] text-slate-400 border-slate-700 hover:border-slate-600'}`}>
                <input
                  type="radio"
                  name="language"
                  value="Python"
                  checked={language === 'Python'}
                  onChange={() => setLanguage('Python')}
                  className="sr-only"
                />
                <span>Python</span>
              </label>
              <label className={`flex items-center justify-center gap-2 py-2 px-3 rounded border text-xs font-semibold cursor-pointer transition ${language === 'Java' ? 'bg-blue-600/20 text-blue-300 border-blue-500' : 'bg-[#252836] text-slate-400 border-slate-700 hover:border-slate-600'}`}>
                <input
                  type="radio"
                  name="language"
                  value="Java"
                  checked={language === 'Java'}
                  onChange={() => setLanguage('Java')}
                  className="sr-only"
                />
                <span>Java</span>
              </label>
            </div>
          </div>

          {/* Output Folder Picker */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase text-slate-400 block">Target Folder</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={outputFolder}
                onChange={(e) => setOutputFolder(e.target.value)}
                placeholder="Default (pipeline directory)"
                className="bg-[#252836] text-white px-3 py-2 rounded border border-slate-700 text-xs flex-1 min-w-0 font-mono focus:outline-none focus:border-blue-500"
              />
              <button
                type="button"
                onClick={onPickFolder}
                className="bg-slate-700 hover:bg-slate-600 text-white px-2.5 py-2 rounded border border-slate-600 flex items-center justify-center shrink-0 transition cursor-pointer"
                title="Browse Folder"
              >
                <FolderOpen className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Generate Code Action Button */}
          <div className="mt-auto pt-2">
            <button
              type="button"
              onClick={onRegenerate}
              disabled={isGenerating}
              className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded text-xs font-bold w-full cursor-pointer transition shadow-md ${
                isGenerating
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white active:scale-[0.98]'
              }`}
            >
              {isGenerating ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-current" />
              )}
              <span>{isGenerating ? 'GENERATING CODE...' : 'Generate Code'}</span>
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
