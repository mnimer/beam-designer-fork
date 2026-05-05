import React from 'react';

/**
 * SourceCodeTab Component
 * 
 * This component renders the content for the SOURCE CODE tab in the bottom panel.
 * It displays the generated Python code with syntax highlighting.
 * 
 * Architectural Decisions:
 * - Includes a simple syntax highlighter for Python.
 * - Uses dangerouslySetInnerHTML to render highlighted code.
 */
interface SourceCodeTabProps {
  generatedCode: string;
}

const highlightPython = (code: string) => {
  if (!code) return '';
  
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
    
  tempCode = tempCode.replace(/(#.*)/g, (match) => addToken(match, 'text-slate-500'));
  tempCode = tempCode.replace(/(['"])(.*?)\1/g, (match) => addToken(match, 'text-green-400'));
  tempCode = tempCode.replace(/\b(import|from|def|with|as|if|__name__|__main__|return)\b/g, (match) => addToken(match, 'text-pink-500 font-bold'));
  tempCode = tempCode.replace(/\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g, (_match, p1) => {
    const id = addToken(p1, 'text-blue-400');
    return `${id}(`;
  });
  
  tokens.forEach((token, index) => {
    const id = `___TOKEN_${index}___`;
    tempCode = tempCode.replace(id, token);
  });
  
  return tempCode;
};

export const SourceCodeTab: React.FC<SourceCodeTabProps> = ({ generatedCode }) => {
  return (
    <div className="h-full bg-[#1E202A] rounded border border-slate-700 p-4 overflow-auto">
      <pre className="text-xs font-mono text-slate-300">
        <code dangerouslySetInnerHTML={{ __html: highlightPython(generatedCode) || 'No code generated yet. Make a change or save to generate.' }} />
      </pre>
    </div>
  );
};
