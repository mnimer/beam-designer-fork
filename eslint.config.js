/**
 * ESLint Configuration (Flat Config)
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Root ESLint flat configuration for the VS Code extension codebase.
 * Enforces critical correctness rules including no-duplicate-case,
 * no-fallthrough, and TypeScript unused-variable checks.
 */

const js = require('@eslint/js');
const globals = require('globals');
const tsParser = require('@typescript-eslint/parser');
const tsPlugin = require('@typescript-eslint/eslint-plugin');

module.exports = [
  {
    // Global ignore patterns: skip build outputs and subproject directories
    ignores: ['out/**', 'dist/**', 'node_modules/**', 'webview/**'],
  },
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      globals: {
        ...globals.node,
        ...globals.es2021,
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...tsPlugin.configs.recommended.rules,
      // Mandatory correctness rules. These are hard errors and gate `npm test`
      // via the `pretest` script -- they must never be downgraded to silence a
      // finding. `no-duplicate-case` in particular is the rule that mechanically
      // catches the class of bug where two identical `case` labels appear in one
      // `switch` and the second becomes unreachable dead code (finding M1).
      'no-duplicate-case': 'error',
      'no-fallthrough': 'error',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],

      // NOTE: The rules below are deliberately 'warn' rather than 'error' so the
      // lint gate can be enforced in `pretest` today instead of being switched
      // off wholesale. They are tracked, not forgiven -- each has a defined exit.
      //
      'no-case-declarations': 'error',
      // TODO: Two remaining trivia in extension.ts (one empty function, one
      // inferrable type annotation). Promote to 'error' once cleaned up.
      '@typescript-eslint/no-empty-function': 'warn',
      '@typescript-eslint/no-inferrable-types': 'warn',
    },
  },
];
