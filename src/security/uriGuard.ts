/**
 * @fileoverview External URI validation utilities.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

/**
 * Validates whether an external URI is safe to open in an external application or browser.
 *
 * Enforces an allowlist of permitted protocols:
 * - 'https:' is always permitted.
 * - 'http:' is permitted only for local development ('localhost' or '127.0.0.1').
 * All other schemes (e.g. 'vscode:', 'command:', 'file:', 'javascript:', 'data:')
 * as well as malformed or non-string inputs are rejected.
 *
 * @param raw The URI string or unknown input to validate
 * @returns True if the URI is in the safe external URI allowlist, false otherwise
 */
export function isAllowedExternalUri(raw: unknown): boolean {
    if (typeof raw !== 'string') {
        return false;
    }
    try {
        const parsed = new URL(raw);
        if (parsed.protocol === 'https:') {
            return true;
        }
        if (parsed.protocol === 'http:') {
            return parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
        }
        return false;
    } catch {
        return false;
    }
}
