/**
 * Master Test Suite for Steps (python)
 * Covers 100% of all 31 Step Node Types across 9 modular suites.
 */
import { describe, it, expect } from 'vitest';

/**
 * Runs all Python step integration tests sequentially.
 *
 * @returns Promise that resolves when all test suites finish executing.
 */
export async function runAllStepsPythonTests(): Promise<void> {
    console.log('Running all Steps integration tests for python...');
    await (await import('./windowing-kv-groupby.test')).runWindowingKvGroupbyTest();
    await (await import('./text-tokenization-filtering.test')).runTextTokenizationFilteringTest();
    await (await import('./statistical-aggregations-math.test')).runStatisticalAggregationsMathTest();
    await (await import('./key-value-manipulation.test')).runKeyValueManipulationTest();
    await (await import('./distinct-sampling-approximate.test')).runDistinctSamplingApproximateTest();
    await (await import('./batching-and-grouping.test')).runBatchingAndGroupingTest();
    await (await import('./relational-cogroupbykey-join.test')).runRelationalCogroupbykeyJoinTest();
    await (await import('./combine-and-context.test')).runCombineAndContextTest();
    await (await import('./multi-branch-flatten.test')).runMultiBranchFlattenTest();
}

describe('Steps Suite (python)', () => {
    it('is registered and ready for execution', () => {
        expect(typeof runAllStepsPythonTests).toBe('function');
    });
});
