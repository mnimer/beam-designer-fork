/**
 * Vite build configuration for the Apache Beam Designer webview.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Bundle layout contract with the extension host (see src/editor/BeamEditorProvider.ts
 * and src/webviewHtml.ts):
 *
 * - The host loads `webview/dist/index.html` and rewrites EXACTLY TWO asset references
 *   (`./assets/index.js` and `./assets/index.css`) to `vscode-webview://` URIs. Those two
 *   filenames must therefore stay stable (no content hash), and `index.html` must not
 *   reference any other asset -- an unrewritten relative URL would 404 inside the webview
 *   sandbox and, for scripts, be rejected by the nonce-based CSP.
 * - Every other chunk is loaded by the browser relative to `assets/index.js` (static
 *   `import` for vendor chunks, dynamic `import()` for lazily-loaded property forms), so
 *   those MAY carry a content hash and live under `assets/chunks/`. ES module imports
 *   inherit the parent script's CSP nonce, so no host-side changes are needed for them.
 *
 * The `hostContractGuard` plugin below fails the build if that contract is violated.
 */
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/** Asset references the extension host knows how to rewrite in index.html. */
const HOST_REWRITTEN_ASSETS = ['./assets/index.js', './assets/index.css'] as const

/**
 * Builds a chunk-group `test` that captures the JavaScript of the given npm packages
 * but deliberately leaves their CSS (e.g. `reactflow/dist/style.css`) with the importing
 * chunk. If vendor CSS were captured into a vendor chunk, Vite would emit a separate
 * `assets/vendor-*.css` and link it from index.html, which the host does not rewrite.
 *
 * @param packagePattern Regex source matching the package directory names.
 * @returns Predicate suitable for `codeSplitting.groups[].test`.
 */
function vendorScripts(packagePattern: string): (id: string) => boolean {
  const re = new RegExp(`node_modules[\\\\/](?:${packagePattern})[\\\\/]`)
  return (id) => re.test(id) && !/\.css(?:\?|$)/.test(id)
}

/**
 * Fails the build if the emitted `index.html` references any asset other than the two
 * the extension host rewrites. Catches, for example, Vite re-enabling modulepreload
 * `<link>` injection or a future entry rename.
 *
 * @returns Vite plugin enforcing the host asset contract.
 */
function hostContractGuard(): Plugin {
  return {
    name: 'beam-designer:host-contract-guard',
    enforce: 'post',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        const referenced = [...html.matchAll(/\b(?:src|href)=["']([^"']+)["']/g)].map((m) => m[1])
        const unexpected = referenced.filter(
          (ref) => !(HOST_REWRITTEN_ASSETS as readonly string[]).includes(ref)
        )
        if (unexpected.length > 0) {
          throw new Error(
            `[host-contract-guard] index.html references assets the extension host does not rewrite: ` +
              `${unexpected.join(', ')}. Only ${HOST_REWRITTEN_ASSETS.join(' and ')} are allowed; ` +
              `see src/webviewHtml.ts.`
          )
        }
        return html
      },
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), hostContractGuard()],
  base: './',
  build: {
    // Keep Vite's default 500 kB warning threshold. Do NOT raise it to silence warnings;
    // oversized chunks should be split instead (see codeSplitting below and the lazy
    // property-form registry in src/catalog/propertyFormRegistry.ts).
    chunkSizeWarningLimit: 500,
    // Disable modulepreload entirely:
    // - the static `<link rel="modulepreload">` tags Vite would inject into index.html are
    //   not rewritten by the extension host (see header comment), and
    // - the runtime preload helper would create nonce-less `<link>` elements that the CSP
    //   rejects. Plain `import()` is sufficient: chunks are served from local disk.
    modulePreload: false,
    rolldownOptions: {
      output: {
        // Stable, host-referenced filenames for the entry script and stylesheet.
        entryFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]',
        // Everything else is resolved relative to index.js and can be content-hashed,
        // which also avoids name collisions between e.g. source/KafkaIO and sink/KafkaIO.
        chunkFileNames: 'assets/chunks/[name]-[hash].js',
        codeSplitting: {
          groups: [
            // React runtime: changes rarely, shared by every other chunk.
            {
              name: 'vendor-react',
              test: vendorScripts('react|react-dom|scheduler'),
              priority: 30,
            },
            // React Flow canvas and its d3/zustand dependency tree.
            {
              name: 'vendor-reactflow',
              test: vendorScripts('reactflow|@reactflow|d3-[a-z-]+|zustand|classcat|use-sync-external-store'),
              priority: 20,
            },
            // Remaining third-party code (yaml, lucide icons, etc.).
            {
              name: 'vendor',
              test: vendorScripts('[^\\\\/]+'),
              priority: 10,
            },
          ],
        },
      },
    },
  },
})
