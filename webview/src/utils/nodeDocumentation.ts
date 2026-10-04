/**
 * Node Documentation Metadata Utilities
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Centralizes documentation helpers, inline-docs detection, and external doc opening
 * for Source, Step, and Sink property panels. Re-exports documentation registry and constants
 * from the catalog/documentation module.
 */

import type { NodeDocMetadata } from '../catalog/documentation';
import {
  DEFAULT_BEAM_IO_DOCS_URL,
  DEFAULT_BEAM_TRANSFORMS_DOCS_URL,
  NODE_DOCUMENTATION_REGISTRY,
} from '../catalog/documentation';

export type { NodeDocMetadata };
export {
  DEFAULT_BEAM_IO_DOCS_URL,
  DEFAULT_BEAM_TRANSFORMS_DOCS_URL,
  NODE_DOCUMENTATION_REGISTRY,
};

/**
 * Opens an external documentation URL via the VS Code webview bridge.
 */
export function openNodeDocs(url: string): void {
  const vscode = (window as unknown as { vscode?: { postMessage?: (msg: unknown) => void } }).vscode;
  if (vscode && typeof vscode.postMessage === 'function') {
    vscode.postMessage({ command: 'openExternal', url });
  }
}

/**
 * Transforms whose property panels already render their own inline header card with a
 * description and a "Docs ↗" button. PropertyForm skips rendering a wrapper NodeDocsCard
 * for these transforms so the header card is never duplicated.
 */
export const SELF_DOCUMENTED_TRANSFORMS = new Set<string>([
  // 9 Community / Data Services Connectors
  'CloudBigtable',
  'CloudSQL',
  'CogniteDataFusion',
  'KineticaDB',
  'MySQL',
  'MySQLPostgreSQLOracleSQLServer',
  'Pyodbc',
  'Tinybird',
  'TrepWsIO',
  // ParDo (renders its own header + Side Inputs section inline — F1)
  'ParDo',
  // Aggregations (rendered inline by AggregationProperties)
  'ApproximateQuantiles',
  'Approximate Quantiles',
  'Approximate Quantile',
  'ApproximateUnique',
  'Approximate Unique',
  'BatchElements',
  'Batch Elements',
  'CoGroupByKey',
  'Co Group By Key',
  'Combine',
  'CombineWithContext',
  'Combine With Context',
  'Count',
  'Distinct',
  'GroupByKey',
  'Group By Key',
  'GroupIntoBatches',
  'Group Into Batches',
  'Latest',
  'Max',
  'Mean',
  'Min',
  'Sample',
  'Sum',
  'Top',
  // Other Transforms (rendered inline by OtherProperties)
  'Flatten',
  'Reshuffle',
  'ReShuffle',
  'Keys',
  'KvSwap',
  'KV Swap',
  'ToString',
  'To String',
  'Values',
]);

/**
 * Minimal node shape expected by documentation lookup functions.
 */
export interface NodeDocumentationTarget {
  data?: {
    beam_transform?: string;
    componentType?: string;
    type?: string;
    label?: string;
  };
}

/**
 * Returns true if the node's property component renders its own inline documentation header card.
 */
export function hasInlineNodeDocsCard(node?: NodeDocumentationTarget | null): boolean {
  const transform = (node?.data?.beam_transform || node?.data?.componentType || '') as string;
  return SELF_DOCUMENTED_TRANSFORMS.has(transform);
}

/**
 * Resolves documentation metadata (title, description, docsUrl) for a pipeline node.
 */
export function getNodeDocumentation(node?: NodeDocumentationTarget | null): NodeDocMetadata | undefined {
  const transform = (node?.data?.beam_transform || node?.data?.componentType || '') as string;
  const nodeType = ((node?.data?.type as string) || '').toUpperCase();
  const label = (node?.data?.label as string) || '';

  if (nodeType && transform) {
    const qualifiedKey = `${nodeType}:${transform}`;
    if (NODE_DOCUMENTATION_REGISTRY[qualifiedKey]) {
      return NODE_DOCUMENTATION_REGISTRY[qualifiedKey];
    }
  }

  if (transform && NODE_DOCUMENTATION_REGISTRY[transform]) {
    return NODE_DOCUMENTATION_REGISTRY[transform];
  }

  if (label && NODE_DOCUMENTATION_REGISTRY[label]) {
    return NODE_DOCUMENTATION_REGISTRY[label];
  }

  return undefined;
}
