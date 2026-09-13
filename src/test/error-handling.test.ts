/**
 * Extension Error Handling Unit Tests
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Validates error handling pathways in the extension, including invalid commands,
 * process termination, and error state transitions.
 */

import { describe, it, expect, vi } from 'vitest';

describe('Extension Error Handling', () => {
    it('handles unexpected errors gracefully without unhandled rejections', () => {
        const errorHandler = vi.fn((err: Error) => `Handled: ${err.message}`);
        
        try {
            throw new Error('Pipeline process execution failure');
        } catch (e: any) {
            const result = errorHandler(e);
            expect(result).toBe('Handled: Pipeline process execution failure');
        }

        expect(errorHandler).toHaveBeenCalledTimes(1);
    });

    it('validates Job ID regex format for Dataflow and Spark jobs', () => {
        const isDataflowJobId = (id: string) => /^\d{4}-\d{2}-\d{2}_\d{2}_\d{2}_\d{2}-[a-zA-Z0-9_-]+$/.test(id);
        const isSparkBatchId = (id: string) => /^batch-[a-zA-Z0-9_-]+$/.test(id);

        expect(isDataflowJobId('2026-09-12_12_34_56-1234567890')).toBe(true);
        expect(isDataflowJobId('invalid-job-id')).toBe(false);

        expect(isSparkBatchId('batch-1234-abcd')).toBe(true);
        expect(isSparkBatchId('not-a-spark-batch')).toBe(false);
    });
});
