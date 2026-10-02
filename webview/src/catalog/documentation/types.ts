/**
 * @fileoverview Type definitions and default documentation URL constants for node documentation metadata.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

/**
 * Metadata for a pipeline node's documentation card, including display title, description, and docs URL.
 */
export interface NodeDocMetadata {
  title: string;
  description: string;
  docsUrl: string;
}

/** Default documentation URL for Apache Beam I/O connectors. */
export const DEFAULT_BEAM_IO_DOCS_URL = 'https://beam.apache.org/documentation/io/connectors/';

/** Default documentation URL for Apache Beam transforms overview. */
export const DEFAULT_BEAM_TRANSFORMS_DOCS_URL = 'https://beam.apache.org/documentation/transforms/java/overview/';
