/**
 * @fileoverview Unit tests for syntaxTokenizer.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

import { describe, it, expect } from 'vitest';
import { tokenize, type CodeToken } from './syntaxTokenizer';

describe('syntaxTokenizer', () => {
  it('returns empty array when code is empty', () => {
    expect(tokenize('', 'Python')).toEqual([]);
    expect(tokenize('', 'Java')).toEqual([]);
  });

  describe('concatenation identity', () => {
    it('concatenating token texts equals input exactly for Python with malicious and comparison strings', () => {
      const pythonSample = [
        '# Pipeline sample',
        'import apache_beam as beam',
        '<script>alert(1)</script>',
        'if a < b && c > d:',
        '    msg = "Hello \\"World\\""',
        '    print(msg)',
      ].join('\n');

      const tokens = tokenize(pythonSample, 'Python');
      const concatenated = tokens.map((t: CodeToken) => t.text).join('');
      expect(concatenated).toBe(pythonSample);
    });

    it('concatenating token texts equals input exactly for Java with malicious and comparison strings', () => {
      const javaSample = [
        '// Pipeline sample',
        'package com.example;',
        '/* multi-line comment */',
        '<script>alert(1)</script>',
        'if (a < b && c > d) {',
        '    String msg = "Hello \\"World\\"";',
        '    System.out.println(msg);',
        '}',
      ].join('\n');

      const tokens = tokenize(javaSample, 'Java');
      const concatenated = tokens.map((t: CodeToken) => t.text).join('');
      expect(concatenated).toBe(javaSample);
    });
  });

  describe('CSS class mappings match old highlighter', () => {
    it('applies correct CSS classes for Python tokens', () => {
      const pythonSnippet = '# Pipeline definition\nimport apache_beam as beam\n\ndef run():\n    msg = "Hello World"\n    print(msg)';
      const tokens = tokenize(pythonSnippet, 'Python');

      // Comment
      const commentToken = tokens.find((t) => t.text === '# Pipeline definition');
      expect(commentToken?.className).toBe('text-slate-500');

      // Keywords
      const importToken = tokens.find((t) => t.text === 'import');
      expect(importToken?.className).toBe('text-pink-500 font-bold');

      const asToken = tokens.find((t) => t.text === 'as');
      expect(asToken?.className).toBe('text-pink-500 font-bold');

      const defToken = tokens.find((t) => t.text === 'def');
      expect(defToken?.className).toBe('text-pink-500 font-bold');

      // String
      const strToken = tokens.find((t) => t.text === '"Hello World"');
      expect(strToken?.className).toBe('text-green-400');

      // Functions
      const runToken = tokens.find((t) => t.text === 'run');
      expect(runToken?.className).toBe('text-blue-400');

      const printToken = tokens.find((t) => t.text === 'print');
      expect(printToken?.className).toBe('text-blue-400');
    });

    it('applies correct CSS classes for Java tokens', () => {
      const javaSnippet = '// Main pipeline class\npackage com.example;\n\npublic class Pipeline {\n    /* entrypoint */\n    public static void main(String[] args) {\n        System.out.println("Started");\n    }\n}';
      const tokens = tokenize(javaSnippet, 'Java');

      // Comments
      const singleLineComment = tokens.find((t) => t.text === '// Main pipeline class');
      expect(singleLineComment?.className).toBe('text-slate-500');

      const blockComment = tokens.find((t) => t.text === '/* entrypoint */');
      expect(blockComment?.className).toBe('text-slate-500');

      // Keywords
      const packageToken = tokens.find((t) => t.text === 'package');
      expect(packageToken?.className).toBe('text-pink-500 font-bold');

      const publicToken = tokens.find((t) => t.text === 'public');
      expect(publicToken?.className).toBe('text-pink-500 font-bold');

      const classToken = tokens.find((t) => t.text === 'class');
      expect(classToken?.className).toBe('text-pink-500 font-bold');

      const staticToken = tokens.find((t) => t.text === 'static');
      expect(staticToken?.className).toBe('text-pink-500 font-bold');

      const voidToken = tokens.find((t) => t.text === 'void');
      expect(voidToken?.className).toBe('text-pink-500 font-bold');

      const mainToken = tokens.find((t) => t.text === 'main');
      expect(mainToken?.className).toBe('text-pink-500 font-bold');

      const stringToken = tokens.find((t) => t.text === 'String');
      expect(stringToken?.className).toBe('text-pink-500 font-bold');

      // String literal
      const strLiteral = tokens.find((t) => t.text === '"Started"');
      expect(strLiteral?.className).toBe('text-green-400');

      // Method call
      const printlnToken = tokens.find((t) => t.text === 'println');
      expect(printlnToken?.className).toBe('text-blue-400');
    });

    it('does not highlight control structures as functions in Python or Java', () => {
      const pythonControl = 'if (condition):\n    while (active):\n        pass';
      const pyTokens = tokenize(pythonControl, 'Python');
      const pyIfToken = pyTokens.find((t) => t.text === 'if');
      expect(pyIfToken?.className).toBe('text-pink-500 font-bold');
      const pyWhileToken = pyTokens.find((t) => t.text === 'while');
      expect(pyWhileToken?.className).toBe('text-pink-500 font-bold');

      const javaControl = 'if (condition) {\n    for (int i = 0; i < 10; i++) {}\n}';
      const javaTokens = tokenize(javaControl, 'Java');
      const javaIfToken = javaTokens.find((t) => t.text === 'if');
      expect(javaIfToken?.className).toBe('text-pink-500 font-bold');
      const javaForToken = javaTokens.find((t) => t.text === 'for');
      expect(javaForToken?.className).toBe('text-pink-500 font-bold');
    });
  });
});
