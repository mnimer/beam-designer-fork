/**
 * @fileoverview Shared "Docs ↗" link button that opens external documentation
 * through the VS Code host (webviews cannot navigate to external URLs directly).
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Replaces the per-panel `openDocs` / `handleOpenDocs` helper copies in the
 * self-documented connector panels and is used by NodeDocsCard.
 */

import React from 'react';
import { openNodeDocs } from '../../utils/nodeDocumentation';

/** Default styling shared by every docs link button. */
export const EXTERNAL_DOCS_LINK_CLASS = 'text-blue-400 hover:text-blue-300 font-semibold cursor-pointer shrink-0';

/**
 * Props for the {@link ExternalDocsLink} component.
 */
export interface ExternalDocsLinkProps {
  /** Documentation URL opened in the user's browser via the host `openExternal` command. */
  url: string;
  /** Optional accessible label, e.g. "Open Cloud SQL connector documentation". */
  ariaLabel?: string;
  /** Optional class override; defaults to {@link EXTERNAL_DOCS_LINK_CLASS}. */
  className?: string;
  /** Link content; defaults to "Docs ↗". */
  children?: React.ReactNode;
}

/**
 * Button that asks the extension host to open `url` externally.
 *
 * @param props Link configuration.
 * @returns The docs link button.
 */
export const ExternalDocsLink: React.FC<ExternalDocsLinkProps> = ({
  url,
  ariaLabel,
  className = EXTERNAL_DOCS_LINK_CLASS,
  children = 'Docs ↗',
}) => (
  <button type="button" onClick={() => openNodeDocs(url)} aria-label={ariaLabel} className={className}>
    {children}
  </button>
);
