/**
 * @fileoverview Pure language normalization and resolution utilities for Apache Beam Designer.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

/**
 * Canonical SDK languages supported by the pipeline generator and UI.
 */
export type SupportedLanguage = 'Python' | 'Java';

/**
 * Normalizes any input value into a canonical SupportedLanguage ('Python' | 'Java'),
 * or null if the input cannot be recognized as a supported language.
 *
 * Recognizes:
 * - 'python', 'Python', 'PYTHON', ' pYtHoN ' -> 'Python'
 * - 'java', 'Java', 'JAVA', ' jAvA ' -> 'Java'
 * - Anything else (null, undefined, non-string, 'go', 'yaml', 'csharp', '') -> null
 *
 * @param value - Unknown input value to normalize.
 * @returns 'Python' | 'Java' | null
 */
export function normalizeLanguage(value: unknown): SupportedLanguage | null {
    if (typeof value !== 'string') {
        return null;
    }
    const lower = value.toLowerCase();
    if (lower === 'python') {
        return 'Python';
    }
    if (lower === 'java') {
        return 'Java';
    }
    return null;
}

/**
 * Resolves an unknown language value to a SupportedLanguage, falling back to a default
 * (defaults to 'Python') if the value cannot be recognized.
 *
 * @param value - Unknown input value to resolve.
 * @param fallback - Fallback SupportedLanguage if normalization returns null (default: 'Python').
 * @returns Resolved SupportedLanguage.
 */
export function resolveLanguageOrDefault(
    value: unknown,
    fallback: SupportedLanguage = 'Python'
): SupportedLanguage {
    return normalizeLanguage(value) ?? fallback;
}
