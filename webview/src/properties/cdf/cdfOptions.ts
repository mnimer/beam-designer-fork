/**
 * @fileoverview Shared options and constants for Cognite Data Fusion (CDF) connector property panels.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

/**
 * Upstream documentation URL for the Cognite Data Fusion Beam connector.
 */
export const CDF_DOCS_URL = 'https://github.com/cognitedata/cdf-beam-connector-java';

/**
 * Authentication type option descriptor for Cognite Data Fusion.
 */
export interface CdfAuthTypeOption {
  value: 'clientCredentials' | 'apiKey';
  label: string;
}

/**
 * Supported authentication modes for Cognite Data Fusion.
 */
export const CDF_AUTH_TYPE_OPTIONS: ReadonlyArray<CdfAuthTypeOption> = [
  { value: 'clientCredentials', label: 'OpenID Connect (client credentials)' },
  { value: 'apiKey', label: 'API key (legacy)' },
];
