/**
 * Formatting and inspection utilities for the Multi-Agent Evaluation Harness.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Formats generated files with 1-indexed line numbers to provide ground-truth
 * line references to LLM evaluators, eliminating hallucinated line numbers.
 */

import { GeneratedFileCandidate } from './deterministic-gate';

const formattedFilesCache = new WeakMap<GeneratedFileCandidate[], string>();

/**
 * Formats a list of generated file candidates into a structured string
 * where each file's content is prefixed with 1-indexed line numbers.
 *
 * @param files - Array of generated file candidates.
 * @returns Formatted string with line-numbered source listings.
 */
export function formatFilesWithLineNumbers(files: GeneratedFileCandidate[]): string {
    const cached = formattedFilesCache.get(files);
    if (cached !== undefined) {
        return cached;
    }

    const formatted = files.map(file => {
        const lines = file.content.split('\n');
        const numberedContent = lines
            .map((line, idx) => `${idx + 1}: ${line}`)
            .join('\n');
        return `--- FILE: ${file.filename} ---\n${numberedContent}\n`;
    }).join('\n');

    formattedFilesCache.set(files, formatted);
    return formatted;
}

