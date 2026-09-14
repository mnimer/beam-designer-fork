/**
 * Vitest Configuration (Integration Tests)
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Integration test configuration for live Gemini LLM generation and evaluation suites.
 * Configured with 3-minute timeouts for long-running network operations.
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['src/test/integration/**/*.test.ts'],
        exclude: ['**/node_modules/**', '**/dist/**'],
        testTimeout: 180000, // 3 minutes timeout for Gemini LLM generation and evaluation
        hookTimeout: 60000,
        globals: true,
        environment: 'node',
    },
});
