/** @fileoverview Provides JSON repair and parsing helpers for handling truncated or fenced Gemini model responses.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

/**
 * Scans a JSON string in a single forward pass to locate the character offset
 * where the last complete file object in the `files` array ends (its closing `}` character).
 * 
 * Accurately tracks string literals, backslash escape sequences, and structural
 * brace/bracket nesting so that `{` and `}` characters inside source code string
 * values (such as Python dict literals or Java class/method bodies) are never
 * misidentified as structural JSON delimiters.
 * 
 * @param jsonText Cleaned JSON text (without markdown code fences)
 * @returns 0-based character index of the closing `}` of the last complete file object
 *          in `files`, or -1 if no complete file object is found.
 */
export function findLastCompleteFileEndOffset(jsonText: string): number {
    if (!jsonText) {
        return -1;
    }

    let inString = false;
    let escaped = false;
    let braceDepth = 0;
    let bracketDepth = 0;

    let sawFilesKey = false;
    let sawColonAfterFiles = false;
    let inFilesArray = false;
    let filesBracketDepth = -1;

    let trackingKey = false;
    let currentKey = '';
    let lastCompleteElementEnd = -1;

    for (let i = 0; i < jsonText.length; i++) {
        const char = jsonText[i];

        // Section 1: Inside String Literal
        if (inString) {
            if (escaped) {
                // NOTE: Backslash escape sequence consumed.
                escaped = false;
                if (trackingKey) {
                    currentKey += char;
                }
            } else if (char === '\\') {
                escaped = true;
            } else if (char === '"') {
                // String literal ended
                inString = false;
                if (trackingKey) {
                    trackingKey = false;
                    if (currentKey === 'files') {
                        sawFilesKey = true;
                    }
                }
            } else if (trackingKey) {
                currentKey += char;
            }
            continue;
        }

        // Section 2: Entering String Literal
        if (char === '"') {
            inString = true;
            escaped = false;
            // Only track key contents when directly inside root object
            if (!inFilesArray && braceDepth === 1 && bracketDepth === 0) {
                trackingKey = true;
                currentKey = '';
            } else {
                trackingKey = false;
            }
            continue;
        }

        // Section 3: State machine for detecting entry into the root "files" array
        if (!inFilesArray) {
            if (sawFilesKey) {
                if (char === ':') {
                    sawColonAfterFiles = true;
                    sawFilesKey = false;
                    continue;
                } else if (!/\s/.test(char)) {
                    sawFilesKey = false;
                }
            }
            if (sawColonAfterFiles) {
                if (char === '[') {
                    sawColonAfterFiles = false;
                    inFilesArray = true;
                    bracketDepth++;
                    filesBracketDepth = bracketDepth;
                    continue;
                } else if (!/\s/.test(char)) {
                    sawColonAfterFiles = false;
                }
            }
        }

        // Section 4: Structural delimiter tracking outside strings
        if (char === '{') {
            braceDepth++;
        } else if (char === '}') {
            braceDepth--;
            // If we are directly inside the files array (bracketDepth === filesBracketDepth)
            // and braceDepth returns to 1, a top-level file object in `files` has just closed.
            if (inFilesArray && bracketDepth === filesBracketDepth && braceDepth === 1) {
                lastCompleteElementEnd = i;
            }
        } else if (char === '[') {
            bracketDepth++;
        } else if (char === ']') {
            if (inFilesArray && bracketDepth === filesBracketDepth) {
                inFilesArray = false;
                filesBracketDepth = -1;
            }
            bracketDepth--;
        }
    }

    return lastCompleteElementEnd;
}

/**
 * Safely parses JSON response string from Gemini model.
 * Handles markdown code fences and automatically repairs truncated JSON responses by
 * salvaging all completely generated file objects from the 'files' array in a single
 * forward pass.
 * 
 * @param rawText Raw output text from Gemini model.
 * @returns Parsed JSON object containing generated files array.
 */
export function parseOrRepairJson(rawText: string): any {
    if (!rawText || !rawText.trim()) {
        throw new Error("Empty response from Gemini model.");
    }

    // Strip markdown code fences if model wrapped response in ```json ... ```
    let cleaned = rawText.trim();
    if (cleaned.startsWith('```json')) {
        cleaned = cleaned.substring(7);
    } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.substring(3);
    }
    if (cleaned.endsWith('```')) {
        cleaned = cleaned.substring(0, cleaned.length - 3);
    }
    cleaned = cleaned.trim();

    try {
        return JSON.parse(cleaned);
    } catch (firstErr) {
        console.warn('[parseOrRepairJson] Standard JSON.parse failed on response. Attempting repair for truncated output...', firstErr);

        // Single forward pass to find where the last complete file object in 'files' ends
        const lastCompleteOffset = findLastCompleteFileEndOffset(cleaned);
        if (lastCompleteOffset > 0) {
            // Substring up to the closing '}' of the last complete file object,
            // then close the 'files' array (']') and root object ('}')
            const candidate = cleaned.substring(0, lastCompleteOffset + 1).trim() + ']}';
            try {
                const parsed = JSON.parse(candidate);
                if (parsed && Array.isArray(parsed.files) && parsed.files.length > 0) {
                    console.log(`[parseOrRepairJson] Successfully repaired truncated JSON response and salvaged ${parsed.files.length} file(s).`);
                    return parsed;
                }
            } catch (_) {
                // If candidate parsing fails, fall through to rethrow original error
            }
        }

        // If structural repair could not salvage any completed file objects, rethrow original syntax error
        throw firstErr;
    }
}
