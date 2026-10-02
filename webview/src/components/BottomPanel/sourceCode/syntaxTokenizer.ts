/**
 * @fileoverview Syntax tokenizer for Python and Java code previews.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

/**
 * Represents a single syntactic token or unformatted text segment.
 */
export interface CodeToken {
  /** Literal text of the token. */
  text: string;
  /** Optional Tailwind CSS classes for syntax highlighting. */
  className?: string;
}

// Control structures to exclude from method/function highlighting
const JAVA_CONTROL_KEYWORDS = new Set(['if', 'for', 'while', 'switch', 'catch']);
const PYTHON_CONTROL_KEYWORDS = new Set(['if', 'for', 'while', 'elif', 'with']);

// Token regular expressions matching comments, strings, keywords, and method/function calls.
// Order of precedence: comments -> strings -> keywords -> method/function calls.
const JAVA_TOKEN_REGEX = /(\/\/[^\r\n]*|\/\*[\s\S]*?\*\/)|("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|\b(package|import|public|class|private|static|void|main|new|return|if|else|for|while|extends|implements|final|null|double|int|float|boolean|String)\b|(\b[a-zA-Z_]\w*\b)(?=\s*\()/g;
const PYTHON_TOKEN_REGEX = /(#[^\r\n]*)|("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|\b(import|from|def|with|as|if|__name__|__main__|return|for|while|in|elif|else|try|except|lambda)\b|(\b[a-zA-Z_]\w*\b)(?=\s*\()/g;

/**
 * Tokenizes raw source code text into an array of styled tokens.
 *
 * Performs single-pass O(n) regex matching on unescaped code so that React can
 * safely render literal text without raw HTML injection.
 *
 * @param code Raw source code text.
 * @param language Target programming language ('Python' | 'Java' or file path).
 * @returns Array of CodeToken objects containing text and optional CSS class names.
 */
export function tokenize(code: string, language: string): CodeToken[] {
  if (!code) {
    return [];
  }

  const langLower = language.toLowerCase();
  const isJava =
    langLower === 'java' ||
    langLower.endsWith('.java') ||
    langLower.endsWith('.xml');

  // Single-pass tokenize: scan through code once, capturing tokens and appending literal segments.
  const regex = new RegExp(isJava ? JAVA_TOKEN_REGEX.source : PYTHON_TOKEN_REGEX.source, 'g');
  const tokens: CodeToken[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(code)) !== null) {
    // Append plain code preceding the matched token
    if (match.index > lastIndex) {
      tokens.push({ text: code.slice(lastIndex, match.index) });
    }

    const [fullMatch, comment, str, kw, fn] = match;
    if (comment) {
      tokens.push({ text: comment, className: 'text-slate-500' });
    } else if (str) {
      tokens.push({ text: str, className: 'text-green-400' });
    } else if (kw) {
      tokens.push({ text: kw, className: 'text-pink-500 font-bold' });
    } else if (fn) {
      const controls = isJava ? JAVA_CONTROL_KEYWORDS : PYTHON_CONTROL_KEYWORDS;
      if (controls.has(fn)) {
        tokens.push({ text: fn });
      } else {
        tokens.push({ text: fn, className: 'text-blue-400' });
      }
    } else {
      tokens.push({ text: fullMatch });
    }
    lastIndex = regex.lastIndex;
  }

  // Append remaining plain code
  if (lastIndex < code.length) {
    tokens.push({ text: code.slice(lastIndex) });
  }

  return tokens;
}
