import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['src/test/**/*.test.ts'],
        exclude: ['src/test/integration/**', 'node_modules/**', 'dist/**'],
        testTimeout: 10000,
        hookTimeout: 10000,
        globals: true,
        environment: 'node',
    },
});
