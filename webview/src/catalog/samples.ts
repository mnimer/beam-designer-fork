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
    runner: 'Dataflow',
    content: ''
  }
];
