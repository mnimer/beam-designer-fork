/**
 * @fileoverview Aggregated node documentation registry and re-exports for the documentation catalog.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

import type { NodeDocMetadata } from './types';
import { SOURCE_DOCS } from './sources';
import { TRANSFORM_DOCS } from './transforms';
import { SINK_DOCS } from './sinks';

export * from './types';
export * from './sources';
export * from './transforms';
export * from './sinks';

/**
 * Registry of documentation metadata indexed by type-qualified key (`SOURCE:<transform>`,
 * `SINK:<transform>`, `STEP:<transform>`) or direct transform name.
 */
export const NODE_DOCUMENTATION_REGISTRY: Record<string, NodeDocMetadata> = {
  ...SOURCE_DOCS,
  ...TRANSFORM_DOCS,
  ...SINK_DOCS,
};
