/**
 * NodeDocsCard Component
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Renders a header card at the top of property panels with the connector/transform title,
 * a "Docs ↗" link button to the corresponding Apache Beam documentation page, and a short
 * description explaining what the source, step, or sink does.
 */

import React from 'react';
import { getNodeDocumentation } from '../../utils/nodeDocumentation';
import { ExternalDocsLink } from './ExternalDocsLink';

/**
 * Props for the {@link NodeDocsCard} component.
 */
export interface NodeDocsCardProps {
  node?: any;
  title?: string;
  description?: string;
  docsUrl?: string;
  ariaLabel?: string;
}

/**
 * Header card rendering documentation links and descriptive summaries for selected pipeline nodes.
 *
 * @param props Component properties containing node data or explicit title, description, and documentation URL.
 * @returns Rendered documentation summary card or null when incomplete.
 */
export const NodeDocsCard: React.FC<NodeDocsCardProps> = ({
  node,
  title,
  description,
  docsUrl,
  ariaLabel,
}) => {
  const doc = node ? getNodeDocumentation(node) : undefined;
  const resolvedTitle = title ?? doc?.title;
  const resolvedDescription = description ?? doc?.description;
  const resolvedDocsUrl = docsUrl ?? doc?.docsUrl;

  if (!resolvedTitle || !resolvedDescription || !resolvedDocsUrl) {
    return null;
  }

  return (
    <div
      data-testid="node-docs-card"
      className="flex flex-col gap-1.5 p-2.5 rounded bg-slate-800/40 border border-slate-700/60 text-xs text-slate-300"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-slate-200">{resolvedTitle}</span>
        <ExternalDocsLink url={resolvedDocsUrl} ariaLabel={ariaLabel ?? `Open ${resolvedTitle} documentation`} />
      </div>
      <p className="text-slate-400">{resolvedDescription}</p>
    </div>
  );
};
