/**
 * @fileoverview Shared Side Input model for Apache Beam `ParDo` transforms.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * NOTE: Files in src/shared/ must stay strictly free of 'vscode', 'fs', 'path',
 * 'child_process', 'os', 'react', or any 'node:' module imports. This pure-TypeScript
 * module is compiled into both the VS Code extension host (CommonJS) and the
 * webview bundle (ESNext/Vite).
 *
 * Purpose:
 * Single source of truth for the Side Input (`PCollectionView` / `pvalue.As*`) binding
 * schema stored on `ParDo` nodes (`node.data.properties.sideInputs`), the canvas handle
 * identifier used to distinguish auxiliary side input edges from the primary (`main`)
 * input edge, and the reconciliation logic that keeps the `sideInputs` metadata in
 * lockstep with the edges connected to the `side_input` handle.
 *
 * Architectural Decisions:
 * - The primary input handle intentionally has NO id so every previously saved `.beam`
 *   file (edges without `targetHandle`) keeps working as a main input connection.
 *   Only the auxiliary handle carries `id="side_input"`.
 * - View types and refresh patterns mirror the official Beam documentation
 *   (https://beam.apache.org/documentation/programming-guide/#side-inputs and
 *   https://beam.apache.org/documentation/patterns/side-inputs/) — no invented options.
 * - `syncSideInputBindings` is a pure function returning the same array reference when
 *   nothing changed so React memoisation and `setNodes` short-circuits stay cheap.
 */

/** React Flow target handle id for auxiliary side input connections on `ParDo` nodes. */
export const SIDE_INPUT_HANDLE_ID = 'side_input';

/** React Flow target handle id accepted as an explicit alias for the primary input. */
export const MAIN_INPUT_HANDLE_ID = 'main';

/** Official Beam side input patterns documentation. */
export const SIDE_INPUT_DOCS_URL = 'https://beam.apache.org/documentation/patterns/side-inputs/';

/** Official Beam programming guide section on side inputs. */
export const SIDE_INPUT_PROGRAMMING_GUIDE_URL =
    'https://beam.apache.org/documentation/programming-guide/#side-inputs';

/**
 * Documented side input view materialisations.
 *
 * - `SINGLETON`: `View.asSingleton()` / `pvalue.AsSingleton(pcoll, default_value=...)`
 * - `ITERABLE`:  `View.asIterable()`  / `pvalue.AsIter(pcoll)`
 * - `LIST`:      `View.asList()`      / `pvalue.AsList(pcoll)`
 * - `MAP`:       `View.asMap()`       / `pvalue.AsDict(pcoll)` (requires `KV<K, V>` / `(k, v)` tuples, unique keys)
 * - `MULTIMAP`:  `View.asMultimap()`  / `GroupByKey` + `pvalue.AsDict(pcoll)` (duplicate keys allowed)
 */
export type SideInputViewType = 'SINGLETON' | 'ITERABLE' | 'LIST' | 'MAP' | 'MULTIMAP';

/**
 * Documented side input refresh patterns.
 *
 * - `STATIC`: standard bounded / window-matched side input.
 * - `SLOWLY_UPDATING_GLOBAL_WINDOW`: Pattern 1 — `GenerateSequence`/`PeriodicImpulse` →
 *   `GlobalWindows` + `Repeatedly(AfterProcessingTime)` + discarding panes.
 * - `SLOWLY_UPDATING_WINDOWED`: Pattern 2 — `PeriodicImpulse(...).applyWindowing()` so each
 *   impulse lands in its own fixed window aligned with the main input.
 */
export type SideInputRefreshPattern =
    | 'STATIC'
    | 'SLOWLY_UPDATING_GLOBAL_WINDOW'
    | 'SLOWLY_UPDATING_WINDOWED';

/** Ordered list of view types for dropdown rendering. */
export const SIDE_INPUT_VIEW_TYPES: readonly SideInputViewType[] = [
    'SINGLETON',
    'ITERABLE',
    'LIST',
    'MAP',
    'MULTIMAP',
] as const;

/** Ordered list of refresh patterns for dropdown rendering. */
export const SIDE_INPUT_REFRESH_PATTERNS: readonly SideInputRefreshPattern[] = [
    'STATIC',
    'SLOWLY_UPDATING_GLOBAL_WINDOW',
    'SLOWLY_UPDATING_WINDOWED',
] as const;

/** Default view type applied to newly connected side inputs. */
export const DEFAULT_SIDE_INPUT_VIEW_TYPE: SideInputViewType = 'SINGLETON';

/** Default refresh pattern applied to newly connected side inputs. */
export const DEFAULT_SIDE_INPUT_REFRESH_PATTERN: SideInputRefreshPattern = 'STATIC';

/** Default refresh interval (seconds) for slowly-updating side input patterns. */
export const DEFAULT_SIDE_INPUT_UPDATE_INTERVAL_SECONDS = 3600;

/**
 * One side input binding persisted inside `node.data.properties.sideInputs` on a `ParDo` node.
 */
export interface SideInputBinding {
    /** Id of the upstream node whose output `PCollection` feeds this side input. */
    sourceNodeId: string;
    /** Display label of the upstream node (kept in sync for the property panel; informational only). */
    sourceLabel?: string;
    /**
     * Identifier for the `PCollectionView<T>` variable / `TupleTag` in Java (`c.sideInput(viewVar)`)
     * and the keyword argument name in Python (`def process(self, element, <variableName>)`).
     */
    variableName: string;
    /** Materialisation of the side input `PCollection`. */
    viewType: SideInputViewType;
    /** When `viewType === 'SINGLETON'`, whether `.withDefaultValue(...)` / `default_value=` is emitted. */
    hasDefaultValue?: boolean;
    /** Literal default value used when `hasDefaultValue` is true. */
    defaultValue?: string;
    /** Refresh strategy for the side input. */
    refreshPattern: SideInputRefreshPattern;
    /** Refresh interval in seconds, used when `refreshPattern !== 'STATIC'`. */
    updateIntervalSeconds?: number;
}

/**
 * Minimal edge shape consumed by the side input helpers (compatible with React Flow and DagEdge).
 */
export interface SideInputEdgeLike {
    source: string;
    target: string;
    targetHandle?: string | null;
    [key: string]: unknown;
}

/**
 * Returns true when the edge targets the auxiliary `side_input` handle.
 *
 * @param edge Edge to inspect.
 * @returns Whether the edge is a side input connection.
 */
export function isSideInputEdge(edge: SideInputEdgeLike | null | undefined): boolean {
    return edge != null && edge.targetHandle === SIDE_INPUT_HANDLE_ID;
}

/**
 * Returns true when the edge targets the primary (`main`) input handle.
 * Edges without a `targetHandle` are primary inputs for backwards compatibility.
 *
 * @param edge Edge to inspect.
 * @returns Whether the edge is a main input connection.
 */
export function isMainInputEdge(edge: SideInputEdgeLike | null | undefined): boolean {
    if (!edge) {
        return false;
    }
    return !edge.targetHandle || edge.targetHandle === MAIN_INPUT_HANDLE_ID;
}

/**
 * Returns true when the node data represents a `ParDo` step.
 *
 * @param data Node data payload.
 * @returns Whether the node is a `ParDo` transform.
 */
export function isParDoNodeData(
    data: { type?: string; beam_transform?: string } | null | undefined
): boolean {
    return data != null && data.beam_transform === 'ParDo';
}

/**
 * Converts an arbitrary node label into a safe, language-neutral identifier suitable for a
 * Java variable name or Python keyword argument (lowerCamelCase, no leading digit).
 *
 * @param label Human-readable node label (e.g. "Lookup Table (BigQuery)").
 * @returns Identifier such as `lookupTableBigquery`; falls back to `sideInput` when empty.
 */
export function toSideInputIdentifier(label: string | undefined | null): string {
    const words = String(label ?? '')
        .replace(/[^A-Za-z0-9]+/g, ' ')
        .trim()
        .split(/\s+/)
        .filter((w) => w.length > 0);

    if (words.length === 0) {
        return 'sideInput';
    }

    const camel = words
        .map((w, i) => {
            const lower = w.toLowerCase();
            return i === 0 ? lower : lower.charAt(0).toUpperCase() + lower.slice(1);
        })
        .join('');

    return /^[0-9]/.test(camel) ? `side${camel.charAt(0).toUpperCase()}${camel.slice(1)}` : camel;
}

/**
 * Produces a variable name unique among `taken`, appending a numeric suffix when required.
 *
 * @param base Preferred identifier.
 * @param taken Identifiers already in use.
 * @returns A unique identifier.
 */
export function uniqueSideInputVariableName(base: string, taken: Iterable<string>): string {
    const used = new Set(taken);
    if (!used.has(base)) {
        return base;
    }
    let i = 2;
    while (used.has(`${base}${i}`)) {
        i += 1;
    }
    return `${base}${i}`;
}

/**
 * Creates a fully-populated binding with documented defaults for a newly connected side input.
 *
 * @param sourceNodeId Upstream node id.
 * @param sourceLabel Upstream node label used to derive the variable name.
 * @param takenVariableNames Variable names already used by sibling bindings.
 * @returns A new {@link SideInputBinding}.
 */
export function createDefaultSideInputBinding(
    sourceNodeId: string,
    sourceLabel: string | undefined,
    takenVariableNames: Iterable<string> = []
): SideInputBinding {
    return {
        sourceNodeId,
        sourceLabel,
        variableName: uniqueSideInputVariableName(toSideInputIdentifier(sourceLabel), takenVariableNames),
        viewType: DEFAULT_SIDE_INPUT_VIEW_TYPE,
        hasDefaultValue: false,
        defaultValue: '',
        refreshPattern: DEFAULT_SIDE_INPUT_REFRESH_PATTERN,
        updateIntervalSeconds: DEFAULT_SIDE_INPUT_UPDATE_INTERVAL_SECONDS,
    };
}

/**
 * Normalises an unknown `sideInputs` property value into a typed binding array.
 * Invalid entries (missing `sourceNodeId`) are discarded.
 *
 * @param raw Value read from `node.data.properties.sideInputs`.
 * @returns Sanitised bindings (never null).
 */
export function normalizeSideInputBindings(raw: unknown): SideInputBinding[] {
    if (!Array.isArray(raw)) {
        return [];
    }
    const isRecord = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object';
    const isViewType = (v: unknown): v is SideInputViewType =>
        typeof v === 'string' && (SIDE_INPUT_VIEW_TYPES as readonly string[]).includes(v);
    const isRefreshPattern = (v: unknown): v is SideInputRefreshPattern =>
        typeof v === 'string' && (SIDE_INPUT_REFRESH_PATTERNS as readonly string[]).includes(v);

    return raw
        .filter((b): b is Record<string, unknown> => isRecord(b) && typeof b.sourceNodeId === 'string' && b.sourceNodeId.length > 0)
        .map((b) => {
            const sourceLabel = typeof b.sourceLabel === 'string' ? b.sourceLabel : undefined;
            const defaultValue =
                typeof b.defaultValue === 'string'
                    ? b.defaultValue
                    : b.defaultValue === undefined || b.defaultValue === null
                    ? ''
                    : String(b.defaultValue);
            return {
                sourceNodeId: b.sourceNodeId as string,
                sourceLabel,
                variableName:
                    typeof b.variableName === 'string' && b.variableName.length > 0
                        ? b.variableName
                        : toSideInputIdentifier(sourceLabel),
                viewType: isViewType(b.viewType) ? b.viewType : DEFAULT_SIDE_INPUT_VIEW_TYPE,
                hasDefaultValue: Boolean(b.hasDefaultValue),
                defaultValue,
                refreshPattern: isRefreshPattern(b.refreshPattern) ? b.refreshPattern : DEFAULT_SIDE_INPUT_REFRESH_PATTERN,
                updateIntervalSeconds:
                    typeof b.updateIntervalSeconds === 'number' && Number.isFinite(b.updateIntervalSeconds)
                        ? b.updateIntervalSeconds
                        : DEFAULT_SIDE_INPUT_UPDATE_INTERVAL_SECONDS,
            };
        });
}

/**
 * Reconciles persisted side input bindings against the upstream nodes currently connected to
 * the `side_input` handle.
 *
 * Rules:
 * - A binding whose `sourceNodeId` is still connected is preserved verbatim (user configuration
 *   wins), except `sourceLabel` which is refreshed from the live node label.
 * - A connected upstream node without a binding receives a default binding.
 * - A binding whose upstream node is no longer connected is dropped.
 * - Output order follows the order of `connectedSourceIds` for deterministic code generation.
 *
 * @param existing Current `properties.sideInputs` value (any shape; normalised internally).
 * @param connectedSourceIds Upstream node ids with an edge into the `side_input` handle (ordered).
 * @param labelFor Optional resolver returning the display label for an upstream node id.
 * @returns `{ bindings, changed }` — `bindings` is the SAME array reference as `existing` when no change was needed.
 */
export function syncSideInputBindings(
    existing: unknown,
    connectedSourceIds: readonly string[],
    labelFor: (nodeId: string) => string | undefined = () => undefined
): { bindings: SideInputBinding[]; changed: boolean } {
    const current = normalizeSideInputBindings(existing);
    const bySource = new Map(current.map((b) => [b.sourceNodeId, b] as const));

    // De-duplicate connected ids while preserving order (multiple edges from the same node map to one binding)
    const orderedIds: string[] = [];
    const seen = new Set<string>();
    for (const id of connectedSourceIds) {
        if (!seen.has(id)) {
            seen.add(id);
            orderedIds.push(id);
        }
    }

    const taken = new Set(current.map((b) => b.variableName));
    const next: SideInputBinding[] = orderedIds.map((id) => {
        const label = labelFor(id);
        const prior = bySource.get(id);
        if (prior) {
            return prior.sourceLabel === label ? prior : { ...prior, sourceLabel: label };
        }
        const created = createDefaultSideInputBinding(id, label, taken);
        taken.add(created.variableName);
        return created;
    });

    // Short-circuit (same reference) when the persisted value already matches the reconciled result
    const unchanged =
        Array.isArray(existing) &&
        existing.length === next.length &&
        next.every((b, i) => shallowBindingEquals(existing[i], b));

    if (unchanged) {
        return { bindings: existing as SideInputBinding[], changed: false };
    }
    return { bindings: next, changed: true };
}

/**
 * Shallow equality on the persisted binding fields (ignores unknown extra keys on `raw`).
 */
function shallowBindingEquals(raw: unknown, b: SideInputBinding): boolean {
    if (!raw || typeof raw !== 'object') {
        return false;
    }
    const r = raw as Record<string, unknown>;
    return (
        r.sourceNodeId === b.sourceNodeId &&
        r.sourceLabel === b.sourceLabel &&
        r.variableName === b.variableName &&
        r.viewType === b.viewType &&
        Boolean(r.hasDefaultValue) === Boolean(b.hasDefaultValue) &&
        (r.defaultValue ?? '') === (b.defaultValue ?? '') &&
        r.refreshPattern === b.refreshPattern &&
        r.updateIntervalSeconds === b.updateIntervalSeconds
    );
}

/**
 * Partitions the incoming edges of a node into primary (`main`) and `side_input` groups.
 *
 * @param nodeId Target node id.
 * @param edges All pipeline edges.
 * @returns `{ main, side }` edge arrays (order preserved).
 */
export function partitionIncomingEdges<E extends SideInputEdgeLike>(
    nodeId: string,
    edges: readonly E[]
): { main: E[]; side: E[] } {
    const main: E[] = [];
    const side: E[] = [];
    for (const edge of edges) {
        if (!edge || String(edge.target) !== String(nodeId)) {
            continue;
        }
        if (isSideInputEdge(edge)) {
            side.push(edge);
        } else if (isMainInputEdge(edge)) {
            main.push(edge);
        }
    }
    return { main, side };
}
