/** @fileoverview Sample pipeline definitions and types for the palette.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

import type { SamplePipeline } from '../utils/sharedTypes';

export type { SamplePipeline };

/**
 * Fallback sample pipeline definitions for standalone webview mode or offline rendering.
 */
export const DEFAULT_SAMPLES: SamplePipeline[] = [
  {
    id: 'generate-mock-data',
    filename: 'generate-mock-data.beam',
    title: 'Generate Mock Data',
    description: 'Pipeline flow: trigger ➔ generate mock data ➔ Log Message',
    category: 'Samples',
    badge: 'Java',
    language: 'Java',
    runner: 'DirectRunner',
    nodesCount: 3,
    readmeContent: [
      '# Generate Mock Data Pipeline',
      '',
      '## Overview',
      'A streaming Apache Beam pipeline that periodically triggers synthetic event generation using `GenerateSequence`, creates realistic JSON records matching a declarative schema inside a `ParDo` transform with built-in Dead Letter Queue (DLQ) error routing, and logs valid records downstream.',
      '',
      'This sample can be generated and executed in either **Python** or **Java** using the **Generate Code** panel.',
      '',
      '## Pipeline Architecture & Data Flow',
      '`trigger (GenerateSequence)` ➔ `generate mock data (ParDo)` ➔ `Log Message`',
      '',
      '1. **Trigger (`GenerateSequence`)**: Emits an unbounded sequence of integer ticks starting at `0` with a configurable rate limit (`1` tick per second).',
      '2. **Generate Mock Data (`ParDo`)**: Synthesizes mock user JSON objects matching a declarative schema with built-in `valid` / `error` TupleTag routing.',
      '3. **Log Message (`LogMessage`)**: Consumes the `valid` output tag from the `ParDo` step and writes structured log entries for inspection.',
      '',
      '## Runtime Parameters',
      '| Parameter | Default Value | Description |',
      '|---|---|---|',
      '| `JOB_ID` | `generate-mock-data-pipeline` | Unique pipeline job identifier |',
      '| `NUM_OBJECTS_PER_ITERATION` | `1` | Number of synthetic JSON records generated per trigger tick |',
    ].join('\n'),
    content: ''
  }
];
