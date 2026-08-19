import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['src/test/**/*.test.ts'],
        testTimeout: 180000, // 3 minutes timeout for Gemini LLM generation and evaluation
        hookTimeout: 60000,
        globals: true,
        environment: 'node',
    },
});
