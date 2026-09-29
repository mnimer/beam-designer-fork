/**
 * Dynamic Apache Beam Release Version Resolver.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Resolves the latest official Apache Beam release version dynamically from
 * https://beam.apache.org/get-started/downloads/ (with fallback to PyPI JSON API
 * and a static baseline version) so that code generation prompts, Dockerfiles,
 * and evaluation agents always reference the real current Apache Beam release
 * without false-positive pre-cutoff rejections.
 */

import * as https from 'https';

export const FALLBACK_BEAM_VERSION = '2.76.0';
export const BEAM_DOWNLOADS_URL = 'https://beam.apache.org/get-started/downloads/';
export const BEAM_PYPI_JSON_URL = 'https://pypi.org/pypi/apache-beam/json';

let cachedBeamVersion: string | null = null;

/**
 * Resets the in-memory cached Apache Beam version (used in unit tests).
 */
export function resetBeamVersionCacheForTesting(): void {
    cachedBeamVersion = null;
}

/**
 * Returns the currently cached Apache Beam version or FALLBACK_BEAM_VERSION synchronously.
 */
export function getCachedBeamVersion(): string {
    return cachedBeamVersion || FALLBACK_BEAM_VERSION;
}

/**
 * Extracts the latest Apache Beam release version from the rendered HTML or Markdown
 * of https://beam.apache.org/get-started/downloads/.
 *
 * @param content HTML or Markdown text from the Apache Beam downloads page
 * @returns Semver string (e.g. '2.76.0') or null if not found
 */
export function parseBeamVersionFromDownloadsHtml(content: string): string | null {
    if (!content) {
        return null;
    }

    const patterns: RegExp[] = [
        /Beam\s+SDK\s+(\d+\.\d+\.\d+)\s+is\s+the\s+latest\s+released\s+version/i,
        /apache-beam-(\d+\.\d+\.\d+)-source-release\.zip/i,
        /apache-beam==(\d+\.\d+\.\d+)/i,
        /<artifactId>beam-sdks-java-core<\/artifactId>\s*<version>(\d+\.\d+\.\d+)<\/version>/i,
        /\/releases\/javadoc\/(\d+\.\d+\.\d+)\//i,
        /downloads\.apache\.org\/beam\/(\d+\.\d+\.\d+)\//i,
    ];

    for (const pattern of patterns) {
        const match = content.match(pattern);
        if (match && match[1]) {
            return match[1];
        }
    }

    return null;
}

/**
 * Extracts the latest Apache Beam release version from PyPI's JSON metadata response.
 *
 * @param jsonText Raw JSON string from https://pypi.org/pypi/apache-beam/json
 * @returns Semver string (e.g. '2.76.0') or null if invalid
 */
export function parseBeamVersionFromPypiJson(jsonText: string): string | null {
    if (!jsonText) {
        return null;
    }
    try {
        const parsed = JSON.parse(jsonText);
        const version = parsed?.info?.version;
        if (typeof version === 'string' && /^\d+\.\d+\.\d+$/.test(version.trim())) {
            return version.trim();
        }
    } catch {
        // Ignore malformed JSON
    }
    return null;
}

/**
 * Performs an HTTPS GET request with a strict timeout and redirect handling.
 */
function fetchUrlText(url: string, timeoutMs = 4000, maxRedirects = 3): Promise<string> {
    return new Promise((resolve, reject) => {
        const req = https.get(
            url,
            {
                timeout: timeoutMs,
                headers: {
                    'User-Agent': 'apache-beam-designer/1.0',
                    'Accept': 'text/html,application/json,*/*',
                },
            },
            (res) => {
                const statusCode = res.statusCode || 0;
                if (statusCode >= 300 && statusCode < 400 && res.headers.location && maxRedirects > 0) {
                    res.resume();
                    const redirectUrl = new URL(res.headers.location, url).toString();
                    fetchUrlText(redirectUrl, timeoutMs, maxRedirects - 1).then(resolve, reject);
                    return;
                }
                if (statusCode < 200 || statusCode >= 300) {
                    res.resume();
                    reject(new Error(`HTTP ${statusCode} fetching ${url}`));
                    return;
                }
                const chunks: Buffer[] = [];
                res.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
                res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
                res.on('error', reject);
            }
        );

        req.on('timeout', () => {
            req.destroy(new Error(`Timeout after ${timeoutMs}ms fetching ${url}`));
        });
        req.on('error', reject);
    });
}

/**
 * Resolves the latest official Apache Beam version from https://beam.apache.org/get-started/downloads/
 * with a secondary fallback to PyPI JSON API and a static fallback to FALLBACK_BEAM_VERSION ('2.76.0').
 * Caches the resolved version in memory for subsequent calls.
 *
 * @param forceRefresh Optional flag to bypass the in-memory cache
 * @returns Resolved Apache Beam version string (e.g. '2.76.0')
 */
export async function getLatestBeamVersion(
    forceRefreshOrFetcher?: boolean | ((url: string, timeoutMs?: number) => Promise<string>)
): Promise<string> {
    const forceRefresh = typeof forceRefreshOrFetcher === 'boolean' ? forceRefreshOrFetcher : Boolean(forceRefreshOrFetcher);
    const fetcher = typeof forceRefreshOrFetcher === 'function' ? forceRefreshOrFetcher : fetchUrlText;

    if (cachedBeamVersion && !forceRefresh) {
        return cachedBeamVersion;
    }

    try {
        const html = await fetcher(BEAM_DOWNLOADS_URL, 4000);
        const versionFromDownloads = parseBeamVersionFromDownloadsHtml(html);
        if (versionFromDownloads) {
            cachedBeamVersion = versionFromDownloads;
            return cachedBeamVersion;
        }
    } catch {
        // Fall through to PyPI JSON fallback
    }

    try {
        const pypiJson = await fetcher(BEAM_PYPI_JSON_URL, 3000);
        const versionFromPypi = parseBeamVersionFromPypiJson(pypiJson);
        if (versionFromPypi) {
            cachedBeamVersion = versionFromPypi;
            return cachedBeamVersion;
        }
    } catch {
        // Fall through to static fallback
    }

    cachedBeamVersion = FALLBACK_BEAM_VERSION;
    return cachedBeamVersion;
}

