/**
 * @fileoverview Path containment and GCP region validation utilities.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

import * as path from 'path';

const GCP_REGION_REGEX = /^[a-z0-9-]{1,63}$/;

/**
 * Checks whether candidate path is identical to or contained within parentDir.
 *
 * Resolves both paths and checks the relative path between them to prevent
 * directory traversal attacks or sibling prefix confusion (e.g. /a/proj vs /a/proj-other).
 *
 * @param parentDir The base or parent directory that must contain candidate
 * @param candidate The target path to validate for containment
 * @returns True if candidate equals parentDir or is inside it, false otherwise
 */
export function isSubPath(parentDir: string, candidate: string): boolean {
    const resolvedParent = path.resolve(parentDir);
    const resolvedCandidate = path.resolve(candidate);
    const rel = path.relative(resolvedParent, resolvedCandidate);
    return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

/**
 * Validates whether a value is a well-formed GCP region identifier.
 *
 * GCP regions adhere to lower-case alphanumeric characters and hyphens,
 * up to 63 characters in length (e.g. 'us-central1', 'europe-west1').
 *
 * @param value The value to validate as a GCP region
 * @returns True if value is a valid GCP region string, false otherwise
 */
export function isValidGcpRegion(value: unknown): boolean {
    if (typeof value !== 'string') {
        return false;
    }
    return GCP_REGION_REGEX.test(value);
}
