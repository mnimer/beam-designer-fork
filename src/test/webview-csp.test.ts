/**
 * Webview Content-Security-Policy (CSP) and HTML Builder Regression Tests (M2)
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Validates the fix for finding M2 in BeamEditorProvider:
 * - Ensures a strong Content-Security-Policy meta tag is injected into webview HTML.
 * - Enforces script execution protection via cryptographically secure nonces.
 * - Verifies style-src includes 'unsafe-inline' required by React Flow dynamic node transforms.
 * - Verifies relative asset paths are replaced with resolved VS Code webview URIs.
 * - Asserts robust handling of edge cases (missing <head>, empty HTML, multiple scripts).
 */

import { describe, it, expect, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// VS Code mock required for importing from extension module
vi.mock('vscode', () => {
    return {
        TreeItem: class {},
        TreeItemCollapsibleState: { None: 0, Collapsed: 1, Expanded: 2 },
        EventEmitter: class {
            public fire = vi.fn();
            public event = vi.fn();
        },
        ThemeIcon: class {},
        ThemeColor: class {},
        MarkdownString: class {},
        workspace: {
            workspaceFolders: [],
            findFiles: vi.fn().mockResolvedValue([]),
            getConfiguration: vi.fn(() => ({ get: vi.fn() })),
            onDidChangeTextDocument: vi.fn(() => ({ dispose: vi.fn() }))
        },
        Uri: {
            file: (p: string) => ({ fsPath: p, toString: () => p }),
            parse: (u: string) => ({ fsPath: u, toString: () => u })
        },
        commands: {
            registerCommand: vi.fn(),
            executeCommand: vi.fn()
        },
        window: {
            createWebviewPanel: vi.fn(),
            showErrorMessage: vi.fn()
        }
    };
});

import { buildWebviewHtml, getNonce, WebviewHtmlOptions, BeamEditorProvider } from '../extension';

describe('M2 — Cryptographic Nonce Generator (getNonce)', () => {
    it('returns a hex string of 32 or more characters containing only valid characters', () => {
        const nonce = getNonce();
        // Standard 16-byte randomBytes produces exactly 32 hex chars [0-9a-f]
        expect(nonce).toBeDefined();
        expect(nonce.length).toBeGreaterThanOrEqual(32);
        expect(/^[A-Za-z0-9]+$/.test(nonce)).toBe(true);
    });

    it('successive calls return different random values (high entropy check)', () => {
        const nonce1 = getNonce();
        const nonce2 = getNonce();
        expect(nonce1).not.toBe(nonce2);
    });
});

describe('M2 — Webview HTML Builder and CSP Enforcement (buildWebviewHtml)', () => {
    const mockOpts: WebviewHtmlOptions = {
        jsUri: 'vscode-webview://assets/index.js',
        cssUri: 'vscode-webview://assets/index.css',
        cspSource: 'vscode-webview:',
        nonce: 'fedcba0987654321fedcba0987654321'
    };

    const realisticViteHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="./favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>webview</title>
    <script type="module" crossorigin src="./assets/index.js"></script>
    <link rel="stylesheet" crossorigin href="./assets/index.css">
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`;

    it('injects Content-Security-Policy meta tag with default-src \'none\' (simple case)', () => {
        const result = buildWebviewHtml(realisticViteHtml, mockOpts);

        expect(result).toContain('<meta http-equiv="Content-Security-Policy"');
        expect(result).toContain("default-src 'none'");
    });

    it('script-src contains the exact nonce and prohibits \'unsafe-inline\' and \'unsafe-eval\'', () => {
        const result = buildWebviewHtml(realisticViteHtml, mockOpts);

        // Extract CSP content attribute
        const cspMatch = result.match(/<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]*)"/i);
        expect(cspMatch).not.toBeNull();
        const cspContent = cspMatch ? cspMatch[1] : '';

        // Extract script-src directive
        const scriptSrcMatch = cspContent.match(/script-src\s+([^;]+)/);
        expect(scriptSrcMatch).not.toBeNull();
        const scriptSrcDirective = scriptSrcMatch ? scriptSrcMatch[1] : '';

        // Must contain exact nonce
        expect(scriptSrcDirective).toContain(`'nonce-${mockOpts.nonce}'`);

        // MUST NOT contain unsafe-inline or unsafe-eval in script-src
        expect(scriptSrcDirective).not.toContain("'unsafe-inline'");
        expect(scriptSrcDirective).not.toContain("'unsafe-eval'");
    });

    it('style-src DOES contain \'unsafe-inline\' required for React Flow node positioning', () => {
        // NOTE: React Flow positions every pipeline node by dynamically writing inline
        // `style="transform: translate(...)"` attributes to DOM elements at runtime.
        // A CSP `style-src` directive WITHOUT 'unsafe-inline' blocks inline style attributes,
        // which causes the entire pipeline canvas to silently collapse (all nodes stack at 0,0).
        // Therefore, 'unsafe-inline' is mandatory for style-src and must not be removed.
        const result = buildWebviewHtml(realisticViteHtml, mockOpts);

        const cspMatch = result.match(/<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]*)"/i);
        expect(cspMatch).not.toBeNull();
        const cspContent = cspMatch ? cspMatch[1] : '';

        const styleSrcMatch = cspContent.match(/style-src\s+([^;]+)/);
        expect(styleSrcMatch).not.toBeNull();
        const styleSrcDirective = styleSrcMatch ? styleSrcMatch[1] : '';

        expect(styleSrcDirective).toContain(mockOpts.cspSource);
        expect(styleSrcDirective).toContain("'unsafe-inline'");
    });

    it('allows image and font resources from cspSource and data: URIs', () => {
        const result = buildWebviewHtml(realisticViteHtml, mockOpts);

        const cspMatch = result.match(/<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]*)"/i);
        expect(cspMatch).not.toBeNull();
        const cspContent = cspMatch ? cspMatch[1] : '';

        expect(cspContent).toContain(`img-src ${mockOpts.cspSource} data:`);
        expect(cspContent).toContain(`font-src ${mockOpts.cspSource} data:`);
        expect(cspContent).toContain("connect-src 'none'");
    });

    it('replaces relative asset paths with provided URIs', () => {
        const result = buildWebviewHtml(realisticViteHtml, mockOpts);

        expect(result).not.toContain('./assets/index.js');
        expect(result).not.toContain('./assets/index.css');
        expect(result).toContain(mockOpts.jsUri);
        expect(result).toContain(mockOpts.cssUri);
    });

    it('attaches nonce attribute to every <script> tag in the document', () => {
        const multiScriptHtml = `<!doctype html>
<html>
  <head>
    <script type="module" crossorigin src="./assets/index.js"></script>
    <script>
      console.log('inline initialization');
    </script>
    <script src="./assets/other.js"></script>
  </head>
  <body>
    <script>
      window.__PRELOADED_STATE__ = {};
    </script>
  </body>
</html>`;

        const result = buildWebviewHtml(multiScriptHtml, mockOpts);

        // Find all opening script tags
        const scriptOpeningTags = result.match(/<script(\b[^>]*)?>/gi) || [];
        expect(scriptOpeningTags.length).toBe(4);

        // Verify each script tag contains the nonce attribute
        for (const tag of scriptOpeningTags) {
            expect(tag).toContain(`nonce="${mockOpts.nonce}"`);
        }

        // Count occurrences of nonce attribute in entire output
        const nonceAttrMatches = result.match(new RegExp(`nonce="${mockOpts.nonce}"`, 'g')) || [];
        expect(nonceAttrMatches.length).toBe(scriptOpeningTags.length);
    });

    it('replaces existing nonce attribute if script tag already had one (extreme case)', () => {
        const htmlWithOldNonce = `<html><head><script nonce="old-nonce-12345" type="module" src="./assets/index.js"></script></head></html>`;
        const result = buildWebviewHtml(htmlWithOldNonce, mockOpts);

        expect(result).not.toContain('old-nonce-12345');
        expect(result).toContain(`nonce="${mockOpts.nonce}"`);

        const nonceAttrMatches = result.match(new RegExp(`nonce="${mockOpts.nonce}"`, 'g')) || [];
        expect(nonceAttrMatches.length).toBe(1);
    });

    it('handles multiline script tags and preserves attributes (extreme case)', () => {
        const htmlWithMultilineScript = `<html><head>
          <script
            type="module"
            crossorigin
            src="./assets/index.js">
          </script>
        </head></html>`;

        const result = buildWebviewHtml(htmlWithMultilineScript, mockOpts);
        const scriptOpeningTags = result.match(/<script(\b[^>]*)?>/gi) || [];
        expect(scriptOpeningTags.length).toBe(1);
        expect(scriptOpeningTags[0]).toContain(`nonce="${mockOpts.nonce}"`);
        expect(scriptOpeningTags[0]).toContain('crossorigin');
    });

    it('handles html with no <head> tag without throwing (extreme case)', () => {
        const htmlWithoutHead = `<!DOCTYPE html><html><body><div id="root"></div><script src="./assets/index.js"></script></body></html>`;

        let result = '';
        expect(() => {
            result = buildWebviewHtml(htmlWithoutHead, mockOpts);
        }).not.toThrow();

        expect(result).toContain('<meta http-equiv="Content-Security-Policy"');
        expect(result).toContain(`nonce="${mockOpts.nonce}"`);
    });

    it('handles empty string without throwing (extreme case)', () => {
        let result = '';
        expect(() => {
            result = buildWebviewHtml('', mockOpts);
        }).not.toThrow();

        expect(result).toContain('<meta http-equiv="Content-Security-Policy"');
        expect(result).toContain("default-src 'none'");
    });

    it('handles html with no script tags without throwing (extreme case)', () => {
        const htmlNoScripts = `<!DOCTYPE html><html><head><title>No Scripts</title></head><body><div>Content</div></body></html>`;

        let result = '';
        expect(() => {
            result = buildWebviewHtml(htmlNoScripts, mockOpts);
        }).not.toThrow();

        expect(result).toContain('<meta http-equiv="Content-Security-Policy"');
        const scriptTags = result.match(/<script(\b[^>]*)?>/gi);
        expect(scriptTags).toBeNull();
    });

    it('updates existing CSP meta tag if one is already present (extreme case)', () => {
        const htmlWithOldCsp = `<html><head><meta http-equiv="Content-Security-Policy" content="default-src 'self'"><script src="./assets/index.js"></script></head></html>`;

        const result = buildWebviewHtml(htmlWithOldCsp, mockOpts);
        const metaCspCount = (result.match(/Content-Security-Policy/gi) || []).length;
        expect(metaCspCount).toBe(1);
        expect(result).toContain(`script-src 'nonce-${mockOpts.nonce}'`);
        expect(result).not.toContain("default-src 'self'");
    });

    it('fails fast on missing or invalid options (failure cases)', () => {
        expect(() => buildWebviewHtml(realisticViteHtml, null as unknown as WebviewHtmlOptions)).toThrow('buildWebviewHtml: opts is required');
        expect(() => buildWebviewHtml(realisticViteHtml, { ...mockOpts, nonce: '' })).toThrow('opts.nonce must be a non-empty string');
        expect(() => buildWebviewHtml(realisticViteHtml, { ...mockOpts, nonce: '   ' })).toThrow('opts.nonce must be a non-empty string');
        expect(() => buildWebviewHtml(realisticViteHtml, { ...mockOpts, nonce: 'bad"nonce' })).toThrow('opts.nonce contains invalid characters');
        expect(() => buildWebviewHtml(realisticViteHtml, { ...mockOpts, cspSource: '' })).toThrow('opts.cspSource must be a non-empty string');
        expect(() => buildWebviewHtml(realisticViteHtml, { ...mockOpts, jsUri: null as unknown as string })).toThrow('opts.jsUri must be a string');
        expect(() => buildWebviewHtml(realisticViteHtml, { ...mockOpts, cssUri: null as unknown as string })).toThrow('opts.cssUri must be a string');
    });
});

describe('M2 — BeamEditorProvider Integration', () => {
    it('resolveCustomTextEditor generates CSP, replaces assets, and sets webview.html', async () => {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'beam-csp-test-'));
        try {
            const distDir = path.join(tempDir, 'webview', 'dist');
            const assetsDir = path.join(distDir, 'assets');
            fs.mkdirSync(assetsDir, { recursive: true });
            fs.writeFileSync(
                path.join(distDir, 'index.html'),
                `<html><head><script src="./assets/index.js"></script><link href="./assets/index.css"></head><body><div id="root"></div></body></html>`,
                'utf-8'
            );

            const mockWebview = {
                asWebviewUri: vi.fn((uri: { toString: () => string }) => `vscode-resource://${uri.toString()}`),
                cspSource: 'vscode-webview:',
                options: {},
                html: '',
                onDidReceiveMessage: vi.fn().mockReturnValue({ dispose: vi.fn() }),
                postMessage: vi.fn().mockReturnValue(true)
            };

            const mockPanel = {
                webview: mockWebview,
                onDidDispose: vi.fn()
            };

            const mockDocument = {
                uri: { scheme: 'file', fsPath: '/test/pipeline.beam', toString: () => 'file:///test/pipeline.beam' },
                getText: () => 'nodes: []\nedges: []\n'
            };

            const context = {
                extensionPath: tempDir
            };

            const provider = new BeamEditorProvider(context as unknown as import('vscode').ExtensionContext);
            await provider.resolveCustomTextEditor(
                mockDocument as unknown as import('vscode').TextDocument,
                mockPanel as unknown as import('vscode').WebviewPanel,
                {} as unknown as import('vscode').CancellationToken
            );

            expect(mockWebview.html).toContain('<meta http-equiv="Content-Security-Policy"');
            expect(mockWebview.html).toContain("default-src 'none'");
            expect(mockWebview.html).toContain("style-src vscode-webview: 'unsafe-inline'");
            expect(mockWebview.html).toContain('nonce=');
            expect(mockWebview.html).not.toContain('./assets/index.js');
            expect(mockWebview.html).toContain('vscode-resource://');
        } finally {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });
});

/**
 * These run against the REAL Vite build output rather than hand-written sample HTML.
 *
 * NOTE: the sample-based tests above can only prove the transformer behaves correctly on
 * markup we imagined. They cannot catch the case that actually matters -- Vite changing
 * what it emits. A Vite upgrade that starts inlining a module-preload polyfill as an
 * extra inline <script>, or that begins code-splitting into a second chunk, would slip
 * past every sample test while breaking the page at runtime under CSP.
 *
 * webview/dist is a build artifact and is not committed, so these are skipped when it is
 * absent (a fresh clone, or CI before the webview build step). This is a deliberate,
 * documented skip rather than a silent pass: run `npm --prefix webview run build` first
 * to exercise them.
 */
const DIST_INDEX = path.resolve(__dirname, '..', '..', 'webview', 'dist', 'index.html');
const distExists = fs.existsSync(DIST_INDEX);

describe.skipIf(!distExists)('M2 — real Vite build output', () => {
    const build = () => {
        const nonce = getNonce();
        const html = buildWebviewHtml(fs.readFileSync(DIST_INDEX, 'utf-8'), {
            jsUri: 'https://cdn.example/assets/index.js',
            cssUri: 'https://cdn.example/assets/index.css',
            cspSource: 'https://cdn.example',
            nonce,
        });
        return { nonce, html };
    };

    it('carries the nonce on EVERY script tag the real build emits', () => {
        const { nonce, html } = build();
        const scriptTags = html.match(/<script\b[^>]*>/gi) ?? [];
        expect(scriptTags.length).toBeGreaterThan(0);
        for (const tag of scriptTags) {
            expect(tag, `script tag emitted without a nonce: ${tag}`).toContain(`nonce="${nonce}"`);
        }
    });

    it('rewrites every relative asset reference the real build emits', () => {
        const { html } = build();
        expect(html).not.toContain('./assets/index.js');
        expect(html).not.toContain('./assets/index.css');
    });

    it('is idempotent -- re-running does not stack duplicate CSP meta tags', () => {
        const { html } = build();
        const again = buildWebviewHtml(html, {
            jsUri: 'a',
            cssUri: 'b',
            cspSource: 'https://cdn.example',
            nonce: getNonce(),
        });
        expect((again.match(/http-equiv="Content-Security-Policy"/gi) ?? []).length).toBe(1);
    });

    it('keeps the emitted policy free of script-src escape hatches', () => {
        const { nonce, html } = build();
        const meta = /<meta http-equiv="Content-Security-Policy"[^>]*>/i.exec(html);
        expect(meta).not.toBeNull();
        const content = /content="([^"]+)"/.exec(meta![0])![1];
        const directive = (name: string) =>
            content.split(';').map((d) => d.trim()).find((d) => d.startsWith(name));

        const scriptSrc = directive('script-src');
        expect(scriptSrc).toContain(`'nonce-${nonce}'`);
        expect(scriptSrc).not.toContain('unsafe-inline');
        expect(scriptSrc).not.toContain('unsafe-eval');

        // Verified against the source: the webview makes no fetch/XHR/WebSocket calls,
        // so connect-src can stay fully closed.
        expect(directive('connect-src')).toBe("connect-src 'none'");

        // DO NOT "harden" this by removing 'unsafe-inline'. React Flow positions every
        // canvas node with an inline style attribute, which style-src governs. Without
        // it the whole graph silently collapses to 0,0 with only a console warning.
        expect(directive('style-src')).toContain("'unsafe-inline'");
    });
});

