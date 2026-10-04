/**
 * Unit Tests for the shared Side Input model (`src/shared/sideInputs.ts`)
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Verifies edge classification, identifier derivation, normalisation of persisted
 * `sideInputs` metadata, and the edge → binding reconciliation used by both the
 * extension host DAG validator and the webview canvas/property panel.
 */

import { describe, it, expect } from 'vitest';
import {
    SIDE_INPUT_HANDLE_ID,
    isSideInputEdge,
    isMainInputEdge,
    isParDoNodeData,
    toSideInputIdentifier,
    uniqueSideInputVariableName,
    createDefaultSideInputBinding,
    normalizeSideInputBindings,
    syncSideInputBindings,
    partitionIncomingEdges,
    DEFAULT_SIDE_INPUT_UPDATE_INTERVAL_SECONDS,
} from '../../shared/sideInputs';

describe('sideInputs: edge classification', () => {
    it('treats edges without a targetHandle as main inputs (backwards compatible)', () => {
        expect(isMainInputEdge({ source: 'a', target: 'b' })).toBe(true);
        expect(isMainInputEdge({ source: 'a', target: 'b', targetHandle: null })).toBe(true);
        expect(isMainInputEdge({ source: 'a', target: 'b', targetHandle: 'main' })).toBe(true);
        expect(isSideInputEdge({ source: 'a', target: 'b' })).toBe(false);
    });

    it('recognises side_input edges', () => {
        const edge = { source: 'a', target: 'b', targetHandle: SIDE_INPUT_HANDLE_ID };
        expect(isSideInputEdge(edge)).toBe(true);
        expect(isMainInputEdge(edge)).toBe(false);
    });

    it('handles null/undefined edges safely', () => {
        expect(isSideInputEdge(null)).toBe(false);
        expect(isMainInputEdge(undefined)).toBe(false);
    });

    it('identifies ParDo node data', () => {
        expect(isParDoNodeData({ type: 'STEP', beam_transform: 'ParDo' })).toBe(true);
        expect(isParDoNodeData({ type: 'STEP', beam_transform: 'Map' })).toBe(false);
        expect(isParDoNodeData(null)).toBe(false);
    });

    it('partitions incoming edges by handle for a given target', () => {
        const edges = [
            { id: 'e1', source: 'src', target: 'pardo' },
            { id: 'e2', source: 'lookup', target: 'pardo', targetHandle: 'side_input' },
            { id: 'e3', source: 'src', target: 'other' },
            { id: 'e4', source: 'x', target: 'pardo', targetHandle: 'main' },
        ];
        const { main, side } = partitionIncomingEdges('pardo', edges);
        expect(main.map((e) => e.id)).toEqual(['e1', 'e4']);
        expect(side.map((e) => e.id)).toEqual(['e2']);
    });
});

describe('sideInputs: identifier derivation', () => {
    it('derives lowerCamelCase identifiers from labels', () => {
        expect(toSideInputIdentifier('Lookup Table (BigQuery)')).toBe('lookupTableBigquery');
        expect(toSideInputIdentifier('country-codes')).toBe('countryCodes');
        expect(toSideInputIdentifier('Create')).toBe('create');
    });

    it('falls back to sideInput for empty labels and prefixes leading digits', () => {
        expect(toSideInputIdentifier('')).toBe('sideInput');
        expect(toSideInputIdentifier(undefined)).toBe('sideInput');
        expect(toSideInputIdentifier('2024 rates')).toBe('side2024Rates');
    });

    it('produces unique names by appending numeric suffixes', () => {
        expect(uniqueSideInputVariableName('rates', [])).toBe('rates');
        expect(uniqueSideInputVariableName('rates', ['rates'])).toBe('rates2');
        expect(uniqueSideInputVariableName('rates', ['rates', 'rates2'])).toBe('rates3');
    });

    it('creates a default binding with documented defaults', () => {
        const binding = createDefaultSideInputBinding('n1', 'Exchange Rates', ['exchangeRates']);
        expect(binding).toEqual({
            sourceNodeId: 'n1',
            sourceLabel: 'Exchange Rates',
            variableName: 'exchangeRates2',
            viewType: 'SINGLETON',
            hasDefaultValue: false,
            defaultValue: '',
            refreshPattern: 'STATIC',
            updateIntervalSeconds: DEFAULT_SIDE_INPUT_UPDATE_INTERVAL_SECONDS,
        });
    });
});

describe('sideInputs: normalisation', () => {
    it('returns an empty array for non-array input', () => {
        expect(normalizeSideInputBindings(undefined)).toEqual([]);
        expect(normalizeSideInputBindings('nope')).toEqual([]);
        expect(normalizeSideInputBindings({})).toEqual([]);
    });

    it('drops entries without sourceNodeId and fills missing fields with defaults', () => {
        const result = normalizeSideInputBindings([
            null,
            { foo: 'bar' },
            { sourceNodeId: 'n1', sourceLabel: 'Rates' },
            { sourceNodeId: 'n2', variableName: 'cfg', viewType: 'MAP', refreshPattern: 'SLOWLY_UPDATING_WINDOWED', updateIntervalSeconds: 60, hasDefaultValue: true, defaultValue: 7 },
            { sourceNodeId: 'n3', viewType: 'BOGUS', refreshPattern: 'BOGUS', updateIntervalSeconds: 'x' },
        ]);
        expect(result).toHaveLength(3);
        expect(result[0]).toMatchObject({ sourceNodeId: 'n1', variableName: 'rates', viewType: 'SINGLETON', refreshPattern: 'STATIC' });
        expect(result[1]).toMatchObject({ sourceNodeId: 'n2', variableName: 'cfg', viewType: 'MAP', refreshPattern: 'SLOWLY_UPDATING_WINDOWED', updateIntervalSeconds: 60, hasDefaultValue: true, defaultValue: '7' });
        expect(result[2]).toMatchObject({ sourceNodeId: 'n3', viewType: 'SINGLETON', refreshPattern: 'STATIC', updateIntervalSeconds: DEFAULT_SIDE_INPUT_UPDATE_INTERVAL_SECONDS });
    });
});

describe('sideInputs: syncSideInputBindings', () => {
    const labels: Record<string, string> = { n1: 'Rates', n2: 'Config', n3: 'Rates' };
    const labelFor = (id: string) => labels[id];

    it('creates default bindings for newly connected upstream nodes', () => {
        const { bindings, changed } = syncSideInputBindings(undefined, ['n1', 'n2'], labelFor);
        expect(changed).toBe(true);
        expect(bindings.map((b) => b.sourceNodeId)).toEqual(['n1', 'n2']);
        expect(bindings.map((b) => b.variableName)).toEqual(['rates', 'config']);
    });

    it('dedupes variable names when two upstream nodes share a label', () => {
        const { bindings } = syncSideInputBindings([], ['n1', 'n3'], labelFor);
        expect(bindings.map((b) => b.variableName)).toEqual(['rates', 'rates2']);
    });

    it('preserves user configuration for surviving bindings and drops removed ones', () => {
        const existing = [
            { sourceNodeId: 'n1', sourceLabel: 'Rates', variableName: 'fxRates', viewType: 'MAP', hasDefaultValue: false, defaultValue: '', refreshPattern: 'STATIC', updateIntervalSeconds: 3600 },
            { sourceNodeId: 'gone', sourceLabel: 'Old', variableName: 'old', viewType: 'LIST', hasDefaultValue: false, defaultValue: '', refreshPattern: 'STATIC', updateIntervalSeconds: 3600 },
        ];
        const { bindings, changed } = syncSideInputBindings(existing, ['n1', 'n2'], labelFor);
        expect(changed).toBe(true);
        expect(bindings).toHaveLength(2);
        expect(bindings[0]).toMatchObject({ sourceNodeId: 'n1', variableName: 'fxRates', viewType: 'MAP' });
        expect(bindings[1]).toMatchObject({ sourceNodeId: 'n2', variableName: 'config' });
    });

    it('refreshes the sourceLabel when the upstream node was renamed', () => {
        const existing = [
            { sourceNodeId: 'n1', sourceLabel: 'Stale', variableName: 'rates', viewType: 'SINGLETON', hasDefaultValue: false, defaultValue: '', refreshPattern: 'STATIC', updateIntervalSeconds: 3600 },
        ];
        const { bindings, changed } = syncSideInputBindings(existing, ['n1'], labelFor);
        expect(changed).toBe(true);
        expect(bindings[0].sourceLabel).toBe('Rates');
    });

    it('returns the same array reference when nothing changed', () => {
        const existing = [
            { sourceNodeId: 'n1', sourceLabel: 'Rates', variableName: 'rates', viewType: 'SINGLETON', hasDefaultValue: false, defaultValue: '', refreshPattern: 'STATIC', updateIntervalSeconds: 3600 },
        ];
        const { bindings, changed } = syncSideInputBindings(existing, ['n1'], labelFor);
        expect(changed).toBe(false);
        expect(bindings).toBe(existing);
    });

    it('reorders bindings to follow edge order and dedupes repeated source ids', () => {
        const existing = [
            { sourceNodeId: 'n2', sourceLabel: 'Config', variableName: 'config', viewType: 'SINGLETON', hasDefaultValue: false, defaultValue: '', refreshPattern: 'STATIC', updateIntervalSeconds: 3600 },
            { sourceNodeId: 'n1', sourceLabel: 'Rates', variableName: 'rates', viewType: 'SINGLETON', hasDefaultValue: false, defaultValue: '', refreshPattern: 'STATIC', updateIntervalSeconds: 3600 },
        ];
        const { bindings } = syncSideInputBindings(existing, ['n1', 'n2', 'n1'], labelFor);
        expect(bindings.map((b) => b.sourceNodeId)).toEqual(['n1', 'n2']);
    });

    it('clears bindings when all side input edges are removed', () => {
        const existing = [
            { sourceNodeId: 'n1', sourceLabel: 'Rates', variableName: 'rates', viewType: 'SINGLETON', hasDefaultValue: false, defaultValue: '', refreshPattern: 'STATIC', updateIntervalSeconds: 3600 },
        ];
        const { bindings, changed } = syncSideInputBindings(existing, [], labelFor);
        expect(changed).toBe(true);
        expect(bindings).toEqual([]);
    });
});
