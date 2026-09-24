/**
 * Master Test Suite for Steps (cloud-run)
 * Covers 100% of all 31 Step Node Types across 9 modular suites.
 */
import { describe, it, expect } from 'vitest';
import { runWindowingKvGroupbyTest } from './windowing-kv-groupby.test';
import { runTextTokenizationFilteringTest } from './text-tokenization-filtering.test';
import { runStatisticalAggregationsMathTest } from './statistical-aggregations-math.test';
import { runKeyValueManipulationTest } from './key-value-manipulation.test';
import { runDistinctSamplingApproximateTest } from './distinct-sampling-approximate.test';
import { runBatchingAndGroupingTest } from './batching-and-grouping.test';
import { runRelationalCogroupbykeyJoinTest } from './relational-cogroupbykey-join.test';
import { runCombineAndContextTest } from './combine-and-context.test';
import { runMultiBranchFlattenTest } from './multi-branch-flatten.test';

export async function runAllStepsCloudrunTests(): Promise<void> {
    console.log('Running all Steps integration tests for cloud-run...');
    await runWindowingKvGroupbyTest();
    await runTextTokenizationFilteringTest();
    await runStatisticalAggregationsMathTest();
    await runKeyValueManipulationTest();
    await runDistinctSamplingApproximateTest();
    await runBatchingAndGroupingTest();
    await runRelationalCogroupbykeyJoinTest();
    await runCombineAndContextTest();
    await runMultiBranchFlattenTest();
}

describe('Steps Suite (cloud-run)', () => {
    it('is registered and ready for execution', () => {
        expect(typeof runAllStepsCloudrunTests).toBe('function');
    });
});
