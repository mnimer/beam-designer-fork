/**
 * Webview HTML Transformation and Content-Security-Policy (CSP) Builder
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Pure utility functions for generating secure webview HTML (finding M2):
 * - Content-Security-Policy (CSP) injection with cryptographic script nonce.
 * - Asset URI replacement for VS Code webview sandbox.
 * - Nonce injection into all <script> tags.
 */

import * as crypto from 'crypto';

/**
 * Options for configuring webview HTML transformation.
 */
export interface WebviewHtmlOptions {
    /** Resolved webview URI for the bundle JavaScript file */
    jsUri: string;
    /** Resolved webview URI for the bundle CSS stylesheet */
    cssUri: string;
    /** Origin scheme/source for webview resources (e.g. webview.cspSource) */
    cspSource: string;
    /** Cryptographic random nonce for script authorization */
    nonce: string;
}

/**
 * Generates a cryptographically secure random nonce for Content-Security-Policy.
 * Produces 32 hexadecimal characters (16 random bytes) using node:crypto.
 * 
 * @returns Cryptographically secure hex string nonce.
 */
export function getNonce(): string {
    return crypto.randomBytes(16).toString('hex');
}

/**
 * Transforms raw HTML into secure webview HTML by:
 * 1. Injecting a Content-Security-Policy <meta> tag into <head> (or document start if missing).
 * 2. Replacing relative asset paths ('./assets/index.js', './assets/index.css') with resolved URIs.
 * 3. Adding the nonce attribute to every <script> tag in the document.
 * 
 * CSP Policy directives:
 * - default-src 'none'
 * - script-src 'nonce-${nonce}' (unsafe-inline and unsafe-eval are prohibited)
 * - style-src ${cspSource} 'unsafe-inline' (NOTE: 'unsafe-inline' is REQUIRED for React Flow canvas node positioning)
 * - img-src ${cspSource} data:
 * - font-src ${cspSource} data:
 * - connect-src 'none'
 * - base-uri 'none'
 * - form-action 'none'
 * (frame-ancestors is intentionally omitted: it is ignored in <meta> CSP; VS Code controls webview framing.)
 * 
 * @param rawHtml The raw index.html template content.
 * @param opts Configuration options containing asset URIs, cspSource, and nonce.
 * @returns The transformed HTML string with CSP and nonces.
 */
export function buildWebviewHtml(rawHtml: string, opts: WebviewHtmlOptions): string {
    // Fail fast on invalid or missing options
    if (!opts) {
        throw new Error('buildWebviewHtml: opts is required');
    }
    if (!opts.nonce || typeof opts.nonce !== 'string' || opts.nonce.trim() === '') {
        throw new Error('buildWebviewHtml: opts.nonce must be a non-empty string');
    }
    if (!/^[A-Za-z0-9+/=_-]+$/.test(opts.nonce)) {
        throw new Error('buildWebviewHtml: opts.nonce contains invalid characters');
    }
    if (!opts.cspSource || typeof opts.cspSource !== 'string' || opts.cspSource.trim() === '') {
        throw new Error('buildWebviewHtml: opts.cspSource must be a non-empty string');
    }
    if (typeof opts.jsUri !== 'string') {
        throw new Error('buildWebviewHtml: opts.jsUri must be a string');
    }
    if (typeof opts.cssUri !== 'string') {
        throw new Error('buildWebviewHtml: opts.cssUri must be a string');
    }

    let html = rawHtml ?? '';

    // Step 1: Replace relative asset paths (preserving existing behaviour, replacing all occurrences)
    html = html.split('./assets/index.js').join(opts.jsUri);
    html = html.split('./assets/index.css').join(opts.cssUri);

    // Step 2: Inject nonce into every <script> tag (both inline and src-bearing)
    // Matches '<script' followed by attributes (or whitespace/nothing) up to '>'
    // NOTE: Does not match '</script>' closing tags.
    html = html.replace(/<script(\b[^>]*)?>/gi, (_match, attrs) => {
        if (!attrs || !attrs.trim()) {
            return `<script nonce="${opts.nonce}">`;
        }
        // If a nonce attribute already exists, replace it with the fresh cryptographic nonce
        const nonceRegex = /\bnonce=(["'])[^"']*\1|\bnonce=[^\s>]+/i;
        if (nonceRegex.test(attrs)) {
            return `<script${attrs.replace(nonceRegex, `nonce="${opts.nonce}"`)}>`;
        }
        // Ensure whitespace separation before existing attributes if needed
        const separator = /^\s/.test(attrs) ? '' : ' ';
        return `<script nonce="${opts.nonce}"${separator}${attrs}>`;
    });

    // Step 3: Construct CSP meta tag
    // NOTE: style-src requires 'unsafe-inline' because React Flow dynamically writes
    // inline transform/position styles on node DOM elements at runtime. Without it,
    // all canvas nodes silently collapse to (0, 0).
    const cspDirectives = [
        `default-src 'none'`,
        `script-src 'nonce-${opts.nonce}'`,
        `style-src ${opts.cspSource} 'unsafe-inline'`,
        `img-src ${opts.cspSource} data:`,
        `font-src ${opts.cspSource} data:`,
        `connect-src 'none'`,
        `base-uri 'none'`,
        `form-action 'none'`
    ];
    const cspContent = cspDirectives.join('; ') + ';';
    const cspMetaTag = `<meta http-equiv="Content-Security-Policy" content="${cspContent}">`;

    // Step 4: Inject CSP meta tag into <head> or prepend if <head> is not present
    const existingCspRegex = /<meta\s+http-equiv=["']Content-Security-Policy["'][^>]*>/i;
    const headRegex = /<head(?:\s+[^>]*)?>/i;

    if (existingCspRegex.test(html)) {
        html = html.replace(existingCspRegex, cspMetaTag);
    } else if (headRegex.test(html)) {
        html = html.replace(headRegex, (headMatch) => `${headMatch}\n    ${cspMetaTag}`);
    } else {
        html = `${cspMetaTag}\n${html}`;
    }

    return html;
}
