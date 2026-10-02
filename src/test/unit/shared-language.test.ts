/**
 * @fileoverview Unit tests for shared language normalization utilities.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

import { describe, it, expect } from 'vitest';
import { normalizeLanguage, resolveLanguageOrDefault } from '../../shared/language';

describe('src/shared/language — normalizeLanguage', () => {
    it('normalizes Python in various casings', () => {
        expect(normalizeLanguage('Python')).toBe('Python');
        expect(normalizeLanguage('python')).toBe('Python');
        expect(normalizeLanguage('PYTHON')).toBe('Python');
        expect(normalizeLanguage('pYtHon')).toBe('Python');
    });

    it('normalizes Java in various casings', () => {
        expect(normalizeLanguage('Java')).toBe('Java');
        expect(normalizeLanguage('java')).toBe('Java');
        expect(normalizeLanguage('JAVA')).toBe('Java');
        expect(normalizeLanguage('jAvA')).toBe('Java');
    });

    it('returns null for unrecognized or unsupported languages', () => {
        expect(normalizeLanguage('go')).toBeNull();
        expect(normalizeLanguage('Go')).toBeNull();
        expect(normalizeLanguage('yaml')).toBeNull();
        expect(normalizeLanguage('typescript')).toBeNull();
        expect(normalizeLanguage('scala')).toBeNull();
        expect(normalizeLanguage('rust')).toBeNull();
        expect(normalizeLanguage('csharp')).toBeNull();
    });

    it('returns null for empty, whitespace-only, and non-string inputs', () => {
        expect(normalizeLanguage('')).toBeNull();
        expect(normalizeLanguage('   ')).toBeNull();
        expect(normalizeLanguage(null)).toBeNull();
        expect(normalizeLanguage(undefined)).toBeNull();
        expect(normalizeLanguage(123)).toBeNull();
        expect(normalizeLanguage(true)).toBeNull();
        expect(normalizeLanguage({})).toBeNull();
        expect(normalizeLanguage(['Python'])).toBeNull();
    });
});

describe('src/shared/language — resolveLanguageOrDefault', () => {
    it('resolves valid language strings to their canonical form', () => {
        expect(resolveLanguageOrDefault('python')).toBe('Python');
        expect(resolveLanguageOrDefault('JAVA')).toBe('Java');
    });

    it('falls back to Python by default when language cannot be recognized', () => {
        expect(resolveLanguageOrDefault('go')).toBe('Python');
        expect(resolveLanguageOrDefault('')).toBe('Python');
        expect(resolveLanguageOrDefault(null)).toBe('Python');
        expect(resolveLanguageOrDefault(undefined)).toBe('Python');
    });

    it('respects a custom fallback when provided', () => {
        expect(resolveLanguageOrDefault('unknown', 'Java')).toBe('Java');
        expect(resolveLanguageOrDefault(null, 'Java')).toBe('Java');
        expect(resolveLanguageOrDefault('python', 'Java')).toBe('Python');
    });
});
