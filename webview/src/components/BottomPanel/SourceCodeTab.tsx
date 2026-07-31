import React, { useState } from 'react';
import { FolderOpen, RefreshCw } from 'lucide-react';

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

const highlightCode = (code: string, fileName: string | null, defaultLang: 'Python' | 'Java') => {
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
    const id = `___TOKEN_${tokenCounter++}___`;
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
    const id = `___TOKEN_${index}___`;
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
  const [activeLeftTab, setActiveLeftTab] = useState<'GENERATION' | 'FILES'>('GENERATION');

  // Auto-switch to files tab when code generation completes
  const prevNeedsRebuild = React.useRef(needsRebuild);
  React.useEffect(() => {
    if (prevNeedsRebuild.current && !needsRebuild) {
      setActiveLeftTab('FILES');
    }
    prevNeedsRebuild.current = needsRebuild;
  }, [needsRebuild]);

  return (
    <div className="flex h-full gap-6 text-slate-300">
      {/* Left Column (25% width) */}
      <div className="w-1/4 flex flex-col bg-[#1E202A] rounded border border-slate-700 overflow-hidden">
        {/* Nested Tab Headers */}
        <div className="flex border-b border-slate-700 bg-[#151722]">
          <button
            type="button"
            className={`flex-1 py-2 px-3 text-xs font-semibold tracking-wider transition cursor-pointer text-center ${activeLeftTab === 'GENERATION'
                ? 'text-white bg-[#1E202A] border-b-2 border-blue-500'
                : 'text-slate-500 hover:text-slate-300 bg-[#151722]'
              }`}
            onClick={() => setActiveLeftTab('GENERATION')}
          >
            Code Generation
          </button>
          <button
            type="button"
            className={`flex-1 py-2 px-3 text-xs font-semibold tracking-wider transition cursor-pointer text-center ${activeLeftTab === 'FILES'
                ? 'text-white bg-[#1E202A] border-b-2 border-blue-500'
                : 'text-slate-500 hover:text-slate-300 bg-[#151722]'
              }`}
            onClick={() => setActiveLeftTab('FILES')}
          >
            Generated Code
          </button>
        </div>

        {/* Nested Tab Content */}
        <div className="flex-1 flex flex-col p-4 min-h-0 overflow-y-auto">
          {activeLeftTab === 'GENERATION' && (
            <div className="flex flex-col gap-4">
              {/* Language selector */}
              <div>
                <label className="text-xs font-bold uppercase text-slate-500 block mb-2">Language</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="language"
                      value="Python"
                      checked={language === 'Python'}
                      onChange={() => setLanguage('Python')}
                      className="accent-blue-500"
                    />
                    Python
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="language"
                      value="Java"
                      checked={language === 'Java'}
                      onChange={() => setLanguage('Java')}
                      className="accent-blue-500"
                    />
                    Java
                  </label>
                </div>
              </div>

              {/* Output Folder Picker */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold uppercase text-slate-500 block">Output Folder</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={outputFolder}
                    onChange={(e) => setOutputFolder(e.target.value)}
                    placeholder="Default (pipeline directory)"
                    className="bg-[#252836] text-white p-2 rounded border border-slate-700 text-sm flex-1 min-w-0"
                  />
                  <button
                    type="button"
                    onClick={onPickFolder}
                    className="bg-slate-700 hover:bg-slate-600 text-white p-2 rounded border border-slate-600 flex items-center justify-center shrink-0"
                    title="Browse Folder"
                  >
                    <FolderOpen className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Regenerate Button */}
              <button
                type="button"
                onClick={onRegenerate}
                disabled={isGenerating}
                className={`flex items-center justify-center gap-2 px-4 py-2 rounded text-sm font-bold w-full cursor-pointer transition ${isGenerating
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    : needsRebuild
                      ? 'bg-blue-600 hover:bg-blue-700 text-white animate-pulse'
                      : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                  }`}
              >
                <RefreshCw className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
                {isGenerating ? 'GENERATING...' : 'GENERATE CODE'}
              </button>
            </div>
          )}

          {activeLeftTab === 'FILES' && (
            <div className="flex-1 flex flex-col min-h-0">
              <label className="text-xs font-bold uppercase text-slate-500 mb-2 block">Generated Files</label>
              {needsRebuild ? (
                <div className="text-xs text-amber-500 italic p-2 bg-amber-950/30 rounded border border-amber-900/50">
                  Pipeline has unsaved changes. Click "GENERATE CODE" to update the file list.
                </div>
              ) : files.length === 0 ? (
                <div className="text-xs text-slate-500 italic">No files found in folder.</div>
              ) : (
                <div className="flex-1 overflow-y-auto pr-1">
                  <ul className="flex flex-col gap-1">
                    {files.map((file) => (
                      <li key={file}>
                        <button
                          onClick={() => onSelectFile(file)}
                          className={`text-left text-sm w-full py-1.5 px-3 rounded hover:bg-slate-800 transition cursor-pointer ${selectedFile === file
                              ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30 font-semibold'
                              : 'text-slate-400 hover:text-slate-200'
                            }`}
                        >
                          {file}
                        </button>
                      </li>
                    ))}
                      </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right Column (75% width) */}
      <div className="w-3/4 flex flex-col bg-[#1E202A] rounded border border-slate-700 overflow-hidden">
        {isGenerating ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-500">
            <RefreshCw className="w-12 h-12 text-slate-600 mb-4 animate-spin" />
            <p className="text-sm font-semibold mb-1 text-slate-400">Generating Code...</p>
            <p className="text-xs max-w-sm">Gemini is generating all of the source code files. This may take a few minutes...</p>
          </div>
        ) : needsRebuild ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-500">
            <RefreshCw className="w-12 h-12 text-slate-600 mb-4" />
            <p className="text-sm font-semibold mb-1 text-slate-400">Unsaved Pipeline Changes</p>
            <p className="text-xs max-w-sm">The source code files are out of date. Please configure output options and click "GENERATE CODE" on the left to see the updated code.</p>
          </div>
        ) : (
          <div className="flex flex-col h-full">
            <div className="bg-[#151722] px-4 py-2 border-b border-slate-700 flex justify-between items-center">
              <span className="text-xs font-mono font-bold text-slate-400">
                {selectedFile || (language === 'Python' ? 'pipeline.py' : 'Pipeline.java')}
              </span>
            </div>
            <div className="flex-1 p-4 overflow-auto font-mono text-xs">
              <pre>
                <code dangerouslySetInnerHTML={{
                  __html: highlightCode(
                    selectedFile ? (selectedFileContent || '') : generatedCode,
                    selectedFile,
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
