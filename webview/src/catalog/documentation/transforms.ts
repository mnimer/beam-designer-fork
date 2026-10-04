/**
 * @fileoverview Documentation metadata registry for Apache Beam transform nodes.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

import type { NodeDocMetadata } from './types';

/**
 * Documentation metadata for Apache Beam transform nodes (core, elementwise, window, aggregation, and utility transforms).
 */
export const TRANSFORM_DOCS: Record<string, NodeDocMetadata> = {
  // =========================================================================
  // Core, Element, Parser, and Window Transforms (Steps)
  // =========================================================================
  'STEP:FileIO.readMatches': {
    title: 'FileIO.readMatches Transform',
    description: 'Converts matched file metadata (MatchResult.Metadata) into FileIO.ReadableFile handles for downstream reading.',
    docsUrl: 'https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/FileIO.html',
  },
  'FileIO.readMatches': {
    title: 'FileIO.readMatches Transform',
    description: 'Converts matched file metadata (MatchResult.Metadata) into FileIO.ReadableFile handles for downstream reading.',
    docsUrl: 'https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/io/FileIO.html',
  },
  'STEP:ParDo': {
    title: 'ParDo Transform (ParDo.of)',
    description: 'Applies a general-purpose parallel DoFn to each element for custom filtering, enrichment, or multi-output routing, with optional PCollectionView side inputs.',
    docsUrl: 'https://beam.apache.org/documentation/patterns/side-inputs/',
  },
  'ParDo': {
    title: 'ParDo Transform (ParDo.of)',
    description: 'Applies a general-purpose parallel DoFn to each element for custom filtering, enrichment, or multi-output routing, with optional PCollectionView side inputs.',
    docsUrl: 'https://beam.apache.org/documentation/patterns/side-inputs/',
  },
  'STEP:ParseMessage': {
    title: 'Parse Message Transform',
    description: 'Decodes raw incoming byte or string payloads (JSON, Base64, or UTF-8 String) into structured pipeline elements.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/elementwise/pardo/',
  },
  'ParseMessage': {
    title: 'Parse Message Transform',
    description: 'Decodes raw incoming byte or string payloads (JSON, Base64, or UTF-8 String) into structured pipeline elements.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/elementwise/pardo/',
  },
  'STEP:WithTimestamps': {
    title: 'WithTimestamps Transform',
    description: 'Assigns an event-time Instant to each element in a PCollection for event-time windowing and watermark tracking.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/elementwise/withtimestamps/',
  },
  'WithTimestamps': {
    title: 'WithTimestamps Transform',
    description: 'Assigns an event-time Instant to each element in a PCollection for event-time windowing and watermark tracking.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/elementwise/withtimestamps/',
  },
  'STEP:Filter': {
    title: 'Filter Transform (Filter.by)',
    description: 'Retains only elements in a PCollection that satisfy a boolean predicate function.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/elementwise/filter/',
  },
  'Filter': {
    title: 'Filter Transform (Filter.by)',
    description: 'Retains only elements in a PCollection that satisfy a boolean predicate function.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/elementwise/filter/',
  },
  'STEP:FlatMap': {
    title: 'FlatMapElements Transform',
    description: 'Applies a one-to-many function to each element and flattens the resulting iterables into a single PCollection.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/elementwise/flatmapelements/',
  },
  'FlatMap': {
    title: 'FlatMapElements Transform',
    description: 'Applies a one-to-many function to each element and flattens the resulting iterables into a single PCollection.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/elementwise/flatmapelements/',
  },
  'STEP:KVMapper': {
    title: 'KV Mapper Transform (WithKeys / MapElements)',
    description: 'Maps each element into a KV<Key, Value> pair so downstream keyed transforms and aggregations can group by key.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/elementwise/withkeys/',
  },
  'KVMapper': {
    title: 'KV Mapper Transform (WithKeys / MapElements)',
    description: 'Maps each element into a KV<Key, Value> pair so downstream keyed transforms and aggregations can group by key.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/elementwise/withkeys/',
  },
  'STEP:Map': {
    title: 'MapElements Transform',
    description: 'Transforms each element in a PCollection one-to-one using a pure mapping function or expression.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/elementwise/mapelements/',
  },
  'Map': {
    title: 'MapElements Transform',
    description: 'Transforms each element in a PCollection one-to-one using a pure mapping function or expression.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/elementwise/mapelements/',
  },
  'STEP:Window': {
    title: 'Window Transform (Window.into)',
    description: 'Subdivides a PCollection into finite event-time windows (Fixed, Sliding, or Session) for windowed aggregations.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/other/window/',
  },
  'Window': {
    title: 'Window Transform (Window.into)',
    description: 'Subdivides a PCollection into finite event-time windows (Fixed, Sliding, or Session) for windowed aggregations.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/other/window/',
  },
  'STEP:Windowing': {
    title: 'Window Transform (Window.into)',
    description: 'Subdivides a PCollection into finite event-time windows (Fixed, Sliding, or Session) for windowed aggregations.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/other/window/',
  },
  'Windowing': {
    title: 'Window Transform (Window.into)',
    description: 'Subdivides a PCollection into finite event-time windows (Fixed, Sliding, or Session) for windowed aggregations.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/other/window/',
  },
  'STEP:WindowInto': {
    title: 'Window Transform (Window.into)',
    description: 'Subdivides a PCollection into finite event-time windows (Fixed, Sliding, or Session) for windowed aggregations.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/other/window/',
  },
  'WindowInto': {
    title: 'Window Transform (Window.into)',
    description: 'Subdivides a PCollection into finite event-time windows (Fixed, Sliding, or Session) for windowed aggregations.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/other/window/',
  },

  // =========================================================================
  // Aggregation Transforms
  // =========================================================================
  'STEP:ApproximateQuantiles': {
    title: 'ApproximateQuantiles',
    description: 'Computes approximate quantiles of the elements in a collection.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/aggregation/approximatequantiles/',
  },
  'ApproximateQuantiles': {
    title: 'ApproximateQuantiles',
    description: 'Computes approximate quantiles of the elements in a collection.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/aggregation/approximatequantiles/',
  },
  'Approximate Quantiles': {
    title: 'Approximate Quantiles',
    description: 'Computes approximate quantiles of the elements in a collection.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/aggregation/approximatequantiles/',
  },
  'Approximate Quantile': {
    title: 'Approximate Quantile',
    description: 'Computes approximate quantiles of the elements in a collection.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/aggregation/approximatequantiles/',
  },
  'STEP:ApproximateUnique': {
    title: 'ApproximateUnique',
    description: 'Estimates the number of unique elements in a collection.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/aggregation/approximateunique/',
  },
  'ApproximateUnique': {
    title: 'ApproximateUnique',
    description: 'Estimates the number of unique elements in a collection.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/aggregation/approximateunique/',
  },
  'Approximate Unique': {
    title: 'Approximate Unique',
    description: 'Estimates the number of unique elements in a collection.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/aggregation/approximateunique/',
  },
  'STEP:BatchElements': {
    title: 'BatchElements',
    description: 'Batches elements into smaller groups for downstream processing.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/python/aggregation/batchelements/',
  },
  'BatchElements': {
    title: 'BatchElements',
    description: 'Batches elements into smaller groups for downstream processing.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/python/aggregation/batchelements/',
  },
  'Batch Elements': {
    title: 'Batch Elements',
    description: 'Batches elements into smaller groups for downstream processing.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/python/aggregation/batchelements/',
  },
  'STEP:CoGroupByKey': {
    title: 'CoGroupByKey',
    description: 'Groups results from multiple collections by their common keys.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/aggregation/cogroupbykey/',
  },
  'CoGroupByKey': {
    title: 'CoGroupByKey',
    description: 'Groups results from multiple collections by their common keys.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/aggregation/cogroupbykey/',
  },
  'Co Group By Key': {
    title: 'Co Group By Key',
    description: 'Groups results from multiple collections by their common keys.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/aggregation/cogroupbykey/',
  },
  'STEP:Combine': {
    title: 'Combine',
    description: 'Combines elements in a collection using a global combine function.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/aggregation/combine/',
  },
  'Combine': {
    title: 'Combine',
    description: 'Combines elements in a collection using a global combine function.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/aggregation/combine/',
  },
  'STEP:CombineWithContext': {
    title: 'CombineWithContext',
    description: 'Combines elements in a collection using side inputs or contextual state.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/aggregation/combine/',
  },
  'CombineWithContext': {
    title: 'CombineWithContext',
    description: 'Combines elements in a collection using side inputs or contextual state.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/aggregation/combine/',
  },
  'Combine With Context': {
    title: 'Combine With Context',
    description: 'Combines elements in a collection using side inputs or contextual state.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/aggregation/combine/',
  },
  'STEP:Count': {
    title: 'Count',
    description: 'Counts the number of elements in a collection.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/aggregation/count/',
  },
  'Count': {
    title: 'Count',
    description: 'Counts the number of elements in a collection.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/aggregation/count/',
  },
  'STEP:Distinct': {
    title: 'Distinct',
    description: 'Removes duplicate elements from a collection.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/aggregation/distinct/',
  },
  'Distinct': {
    title: 'Distinct',
    description: 'Removes duplicate elements from a collection.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/aggregation/distinct/',
  },
  'STEP:GroupByKey': {
    title: 'GroupByKey',
    description: 'Groups key-value pairs by their keys.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/aggregation/groupbykey/',
  },
  'GroupByKey': {
    title: 'GroupByKey',
    description: 'Groups key-value pairs by their keys.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/aggregation/groupbykey/',
  },
  'Group By Key': {
    title: 'Group By Key',
    description: 'Groups key-value pairs by their keys.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/aggregation/groupbykey/',
  },
  'STEP:GroupIntoBatches': {
    title: 'GroupIntoBatches',
    description: 'Groups elements into batches of a specified size or duration.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/aggregation/groupintobatches/',
  },
  'GroupIntoBatches': {
    title: 'GroupIntoBatches',
    description: 'Groups elements into batches of a specified size or duration.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/aggregation/groupintobatches/',
  },
  'Group Into Batches': {
    title: 'Group Into Batches',
    description: 'Groups elements into batches of a specified size or duration.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/aggregation/groupintobatches/',
  },
  'STEP:Latest': {
    title: 'Latest',
    description: 'Obtains the latest element or value according to timestamps.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/aggregation/latest/',
  },
  'Latest': {
    title: 'Latest',
    description: 'Obtains the latest element or value according to timestamps.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/aggregation/latest/',
  },
  'STEP:Max': {
    title: 'Max',
    description: 'Computes the maximum element or value in a collection.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/aggregation/max/',
  },
  'Max': {
    title: 'Max',
    description: 'Computes the maximum element or value in a collection.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/aggregation/max/',
  },
  'STEP:Mean': {
    title: 'Mean',
    description: 'Computes the arithmetic mean of elements in a collection.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/aggregation/mean/',
  },
  'Mean': {
    title: 'Mean',
    description: 'Computes the arithmetic mean of elements in a collection.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/aggregation/mean/',
  },
  'STEP:Min': {
    title: 'Min',
    description: 'Computes the minimum element or value in a collection.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/aggregation/min/',
  },
  'Min': {
    title: 'Min',
    description: 'Computes the minimum element or value in a collection.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/aggregation/min/',
  },
  'STEP:Sample': {
    title: 'Sample',
    description: 'Takes a random sample of elements from a collection.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/aggregation/sample/',
  },
  'Sample': {
    title: 'Sample',
    description: 'Takes a random sample of elements from a collection.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/aggregation/sample/',
  },
  'STEP:Sum': {
    title: 'Sum',
    description: 'Computes the sum of elements in a collection.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/aggregation/sum/',
  },
  'Sum': {
    title: 'Sum',
    description: 'Computes the sum of elements in a collection.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/aggregation/sum/',
  },
  'STEP:Top': {
    title: 'Top',
    description: 'Finds the top elements in a collection according to a comparator.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/aggregation/top/',
  },
  'Top': {
    title: 'Top',
    description: 'Finds the top elements in a collection according to a comparator.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/aggregation/top/',
  },

  // =========================================================================
  // Other / Utility Transforms
  // =========================================================================
  'STEP:Flatten': {
    title: 'Flatten',
    description: 'Merges multiple PCollection objects of the same type into a single logical PCollection.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/other/flatten/',
  },
  'Flatten': {
    title: 'Flatten',
    description: 'Merges multiple PCollection objects of the same type into a single logical PCollection.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/other/flatten/',
  },
  'STEP:Reshuffle': {
    title: 'Reshuffle',
    description: 'Redistributes elements across workers by assigning temporary random keys to break fusion and balance load.',
    docsUrl: 'https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/transforms/Reshuffle.html',
  },
  'Reshuffle': {
    title: 'Reshuffle',
    description: 'Redistributes elements across workers by assigning temporary random keys to break fusion and balance load.',
    docsUrl: 'https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/transforms/Reshuffle.html',
  },
  'STEP:ReShuffle': {
    title: 'ReShuffle',
    description: 'Redistributes elements across workers by assigning temporary random keys to break fusion and balance load.',
    docsUrl: 'https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/transforms/Reshuffle.html',
  },
  'ReShuffle': {
    title: 'ReShuffle',
    description: 'Redistributes elements across workers by assigning temporary random keys to break fusion and balance load.',
    docsUrl: 'https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/transforms/Reshuffle.html',
  },
  'STEP:Keys': {
    title: 'Keys',
    description: 'Extracts the key from each KV<K, V> element in a PCollection.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/elementwise/keys/',
  },
  'Keys': {
    title: 'Keys',
    description: 'Extracts the key from each KV<K, V> element in a PCollection.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/elementwise/keys/',
  },
  'STEP:KvSwap': {
    title: 'KV Swap (KvSwap)',
    description: 'Swaps the key and value of each KV<K, V> element to produce KV<V, K>.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/elementwise/kvswap/',
  },
  'KvSwap': {
    title: 'KV Swap (KvSwap)',
    description: 'Swaps the key and value of each KV<K, V> element to produce KV<V, K>.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/elementwise/kvswap/',
  },
  'KV Swap': {
    title: 'KV Swap (KvSwap)',
    description: 'Swaps the key and value of each KV<K, V> element to produce KV<V, K>.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/elementwise/kvswap/',
  },
  'STEP:ToString': {
    title: 'ToString',
    description: 'Converts every element, key-value pair, or iterable in a PCollection to its String representation.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/elementwise/tostring/',
  },
  'ToString': {
    title: 'ToString',
    description: 'Converts every element, key-value pair, or iterable in a PCollection to its String representation.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/elementwise/tostring/',
  },
  'To String': {
    title: 'To String',
    description: 'Converts every element, key-value pair, or iterable in a PCollection to its String representation.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/elementwise/tostring/',
  },
  'STEP:Values': {
    title: 'Values',
    description: 'Extracts the value from each KV<K, V> element in a PCollection.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/elementwise/values/',
  },
  'Values': {
    title: 'Values',
    description: 'Extracts the value from each KV<K, V> element in a PCollection.',
    docsUrl: 'https://beam.apache.org/documentation/transforms/java/elementwise/values/',
  },
};
