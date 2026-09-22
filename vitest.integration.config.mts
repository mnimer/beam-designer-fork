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

const yamlRawPlugin = {
    name: 'yaml-raw-loader',
    transform(code: string, id: string) {
        // Strip any query parameters (like ?raw) if present before checking extension
        const cleanId = id.split('?')[0];
        if (cleanId.endsWith('.yaml') || cleanId.endsWith('.yml') || cleanId.endsWith('.beam')) {
            return {
                code: `export default ${JSON.stringify(code)};`,
                map: null,
            };
        }
    },
};

export default defineConfig({
    plugins: [yamlRawPlugin],
    test: {
        include: ['src/test/integration/**/*.test.ts'],
        exclude: ['**/node_modules/**', '**/dist/**'],
        testTimeout: 180000, // 3 minutes timeout for Gemini LLM generation and evaluation
        hookTimeout: 60000,
        globals: true,
        environment: 'node',
        maxConcurrency: 3,
    },
});
