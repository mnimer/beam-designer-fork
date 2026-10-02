/**
 * Compatibility re-export shim for DAG topology validator.
 * Canonical implementation has moved to src/shared/dagValidator.ts.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

export * from './shared/dagValidator';
export type { DagNode, DagEdge, DagValidationResult } from './shared/dagValidator';
