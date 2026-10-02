/**
 * @fileoverview Unit tests for output folder resolution and next available beam filename helpers.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

import { describe, it, expect } from 'vitest';
import * as path from 'path';
import {
    resolveOutputFolder,
    nextAvailableBeamFilename
} from '../../editor/outputFolder';

describe('resolveOutputFolder', () => {
    const ws = path.resolve('/workspace/project');

    it('returns empty string when no beam path and no override are provided', () => {
        const result = resolveOutputFolder(undefined, undefined, ws);
        expect(result).toBe('');
    });

    it('derives default folder from beam file path', () => {
        const beamPath = path.join('/a', 'b', 'my.beam');
        const expected = path.join('/a', 'b', 'my');
        const result = resolveOutputFolder(beamPath, undefined, ws);
        expect(result).toBe(expected);
    });

    it('returns absolute override directly', () => {
        const beamPath = path.join('/a', 'b', 'my.beam');
        const absoluteOverride = path.resolve('/custom/output/folder');
        const result = resolveOutputFolder(beamPath, absoluteOverride, ws);
        expect(result).toBe(absoluteOverride);
    });

    it('resolves relative override with workspace folder', () => {
        const beamPath = path.join('/a', 'b', 'my.beam');
        const relativeOverride = path.join('build', 'output');
        const expected = path.join(ws, relativeOverride);
        const result = resolveOutputFolder(beamPath, relativeOverride, ws);
        expect(result).toBe(expected);
    });

    it('falls back to default for relative override when workspace folder is undefined', () => {
        const beamPath = path.join('/a', 'b', 'my.beam');
        const relativeOverride = path.join('build', 'output');
        const expected = path.join('/a', 'b', 'my');
        const result = resolveOutputFolder(beamPath, relativeOverride, undefined);
        expect(result).toBe(expected);
    });

    it('falls back to default when override contains only whitespace', () => {
        const beamPath = path.join('/a', 'b', 'my.beam');
        const expected = path.join('/a', 'b', 'my');
        const result = resolveOutputFolder(beamPath, '   ', ws);
        expect(result).toBe(expected);
    });
});

describe('nextAvailableBeamFilename', () => {
    const dir = path.resolve('/workspace/project');

    it('returns base.beam when name is free', () => {
        const exists = (_p: string) => false;
        const result = nextAvailableBeamFilename(dir, 'pipeline', exists);
        expect(result).toBe('pipeline.beam');
    });

    it('returns pipeline-1.beam when pipeline.beam is taken', () => {
        const takenPath = path.join(dir, 'pipeline.beam');
        const exists = (p: string) => p === takenPath;
        const result = nextAvailableBeamFilename(dir, 'pipeline', exists);
        expect(result).toBe('pipeline-1.beam');
    });

    it('returns pipeline-2.beam when pipeline.beam and pipeline-1.beam are taken', () => {
        const taken = new Set([
            path.join(dir, 'pipeline.beam'),
            path.join(dir, 'pipeline-1.beam'),
        ]);
        const exists = (p: string) => taken.has(p);
        const result = nextAvailableBeamFilename(dir, 'pipeline', exists);
        expect(result).toBe('pipeline-2.beam');
    });

    it('handles baseName given with .beam suffix', () => {
        const taken = new Set([
            path.join(dir, 'sample.beam'),
        ]);
        const exists = (p: string) => taken.has(p);
        const result = nextAvailableBeamFilename(dir, 'sample.beam', exists);
        expect(result).toBe('sample-1.beam');
    });
});
