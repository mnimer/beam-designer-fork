/**
 * @fileoverview Request/response correlation helpers for asset discovery IPC.
 *
 * Asset lookups (BigQuery tables, Bigtable tables, Cloud SQL databases, ...)
 * are fire-and-forget messages: the webview posts `getTables { dataset }` and
 * the host later posts `tablesLoaded`. When the user changes the parent
 * selection quickly, or two panels ask for different parents, responses can
 * arrive out of order and a panel would show another request's items.
 *
 * The host echoes the parameters of the request that produced a response as
 * `requestParams`; the webview compares them with its current parameters and
 * ignores responses for a different request. Responses without
 * `requestParams` (older senders) are always accepted, so the echo is purely
 * additive and needs no change to the request message shape.
 *
 * Compiled by both the host and webview tsconfigs: keep it pure (no Node,
 * VS Code or React imports, no enums).
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

/** Name of the response field carrying the echoed request parameters. */
export const REQUEST_PARAMS_FIELD = 'requestParams';

/**
 * Returns the parameters of an IPC request message: every own property except
 * `command`. Non-object input yields an empty object.
 *
 * @param message The raw request message received from the webview.
 * @returns A shallow copy of the request parameters.
 */
export function extractRequestParams(message: unknown): Record<string, unknown> {
    if (!message || typeof message !== 'object') {
        return {};
    }
    const params: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(message as Record<string, unknown>)) {
        if (key !== 'command') {
            params[key] = value;
        }
    }
    return params;
}

/**
 * Serializes request parameters into a stable key: keys are sorted and
 * `undefined` values are dropped (they do not survive `postMessage`), so two
 * parameter objects that describe the same request produce the same key.
 *
 * @param params Request parameters.
 * @returns A deterministic string key.
 */
export function requestParamsKey(params: Record<string, unknown>): string {
    const entries = Object.keys(params)
        .filter((key) => params[key] !== undefined)
        .sort()
        .map((key) => [key, params[key]]);
    return JSON.stringify(entries);
}

/**
 * Decides whether a response belongs to the request described by
 * `currentParams`.
 *
 * @param response The response message posted by the host.
 * @param currentParams The parameters the listener most recently requested with.
 * @returns True when the response carries no echo (legacy sender) or its echo
 *     matches `currentParams`.
 */
export function isResponseForParams(response: unknown, currentParams: Record<string, unknown>): boolean {
    if (!response || typeof response !== 'object') {
        return true;
    }
    const echoed = (response as Record<string, unknown>)[REQUEST_PARAMS_FIELD];
    if (!echoed || typeof echoed !== 'object') {
        return true;
    }
    return requestParamsKey(echoed as Record<string, unknown>) === requestParamsKey(currentParams);
}
