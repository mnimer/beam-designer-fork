/**
 * Vitest Configuration (Unit Tests)
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Default hermetic unit test configuration. Excludes live integration
 * test suites under src/test/integration to prevent billable Gemini API calls
 * during default test runs.
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['src/test/unit/**/*.test.ts'],
        exclude: ['src/test/integration/**', '**/node_modules/**', '**/dist/**'],
        testTimeout: 10000,
        hookTimeout: 10000,
        globals: true,
        environment: 'node',
    },
});
