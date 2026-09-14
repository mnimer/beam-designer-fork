/**
 * Build Scripts and Configuration Unit Tests
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Unit tests validating ESLint flat config structure, mandatory lint rules
 * (no-duplicate-case, no-fallthrough, @typescript-eslint/no-unused-vars),
 * vitest configuration separation between unit and live integration runs,
 * package.json test scripts, and regression checks.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { createRequire } from 'module';

const req = createRequire(__filename);

interface FlatConfigEntry {
    files?: string[];
    ignores?: string[];
    rules?: Record<string, unknown>;
}

describe('ESLint Flat Configuration', () => {
    const rootDir = path.resolve(__dirname, '../../');
    const eslintConfigPath = path.join(rootDir, 'eslint.config.js');

    it('exists and exports a flat config array (simple case)', () => {
        expect(fs.existsSync(eslintConfigPath)).toBe(true);
        const config = req(eslintConfigPath) as FlatConfigEntry[];
        expect(Array.isArray(config)).toBe(true);
        expect(config.length).toBeGreaterThanOrEqual(2);
    });

    it('enforces mandatory correctness rules with error severity (extreme case)', () => {
        const config = req(eslintConfigPath) as FlatConfigEntry[];
        // Find the rule configuration entry targeting typescript source files
        const tsRuleConfig = config.find((entry) => 
            entry.files && entry.files.includes('src/**/*.ts')
        );
        expect(tsRuleConfig).toBeDefined();
        expect(tsRuleConfig?.rules).toBeDefined();

        const rules = tsRuleConfig?.rules ?? {};

        // 1. no-duplicate-case must be set to 'error' to catch duplicate switch branches
        expect(rules['no-duplicate-case']).toBe('error');

        // 2. no-fallthrough must be set to 'error'
        expect(rules['no-fallthrough']).toBe('error');

        // 3. no-unused-vars off, @typescript-eslint/no-unused-vars enabled
        expect(rules['no-unused-vars']).toBe('off');
        const tsUnusedVars = rules['@typescript-eslint/no-unused-vars'];
        expect(tsUnusedVars).toBeDefined();
        const severity = Array.isArray(tsUnusedVars) ? tsUnusedVars[0] : tsUnusedVars;
        expect(severity).toBe('error');
    });

    it('ignores build outputs and external subprojects', () => {
        const config = req(eslintConfigPath) as FlatConfigEntry[];
        const globalIgnores = config.find((entry) => entry.ignores);
        expect(globalIgnores).toBeDefined();
        expect(globalIgnores?.ignores).toContain('out/**');
        expect(globalIgnores?.ignores).toContain('dist/**');
        expect(globalIgnores?.ignores).toContain('node_modules/**');
        expect(globalIgnores?.ignores).toContain('webview/**');
    });
});

describe('Vitest and Test Suite Configuration', () => {
    const rootDir = path.resolve(__dirname, '../../');

    it('unit test config excludes integration suites and uses reasonable timeouts (simple & extreme case)', () => {
        const unitConfigContent = fs.readFileSync(path.join(rootDir, 'vitest.config.mts'), 'utf-8');
        expect(unitConfigContent).toContain("src/test/integration/**");
        // Must not use the 180s live Gemini integration timeout for default unit tests
        expect(unitConfigContent).not.toContain("180000");
    });

    it('integration test config targets integration suites with extended timeout', () => {
        const integConfigPath = path.join(rootDir, 'vitest.integration.config.mts');
        expect(fs.existsSync(integConfigPath)).toBe(true);
        const integConfigContent = fs.readFileSync(integConfigPath, 'utf-8');
        expect(integConfigContent).toContain("src/test/integration/**/*.test.ts");
        expect(integConfigContent).toContain("180000");
    });

    it('0-byte error-handling.test.ts has been removed to prevent vitest suite failure (failure case)', () => {
        const errorHandlingTest = path.join(rootDir, 'src/test/error-handling.test.ts');
        expect(fs.existsSync(errorHandlingTest)).toBe(false);
    });
});

describe('Package.json Scripts', () => {
    const rootDir = path.resolve(__dirname, '../../');
    const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf-8'));

    it('defines vitest unit, integration, webview, and combined test runners', () => {
        expect(pkg.scripts.test).toBe('npm run test:unit');
        expect(pkg.scripts['test:unit']).toBe('vitest run');
        expect(pkg.scripts['test:integration']).toBe('vitest run --config vitest.integration.config.mts');
        expect(pkg.scripts['test:webview']).toBe('npm --prefix webview test');
        expect(pkg.scripts['test:all']).toBe('npm run test:unit && npm run test:webview');
    });

    it('lint script targets src without legacy --ext flag', () => {
        expect(pkg.scripts.lint).toBe('eslint src');
        expect(pkg.scripts.lint).not.toContain('--ext');
    });
});
