/**
 * Unit tests for parseOrRepairJson and JSON repair forward-scanning logic (M10).
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Tests:
 * - findLastCompleteFileEndOffset: pure forward-scanning offset detection
 * - parseOrRepairJson: salvaging completed files from truncated responses,
 *   handling code blocks, escaped quotes, nested braces in strings,
 *   and rethrowing SyntaxError when unsalvageable.
 */

import { describe, it, expect, vi } from 'vitest';

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
            getConfiguration: vi.fn(() => ({ get: vi.fn() }))
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

import { parseOrRepairJson, findLastCompleteFileEndOffset } from '../extension';

describe('M10 — JSON Repair Forward Scanner (findLastCompleteFileEndOffset)', () => {
    it('returns offset of the closing brace for single complete file (simple case)', () => {
        const json = '{"files": [{"path": "main.py", "content": "print(\\"hello\\")"}]}';
        const offset = findLastCompleteFileEndOffset(json);
        expect(offset).toBe(json.indexOf('"}') + 1);
        expect(json[offset]).toBe('}');
    });

    it('returns offset of last complete file when last file is truncated (extreme case)', () => {
        const truncated = '{"files": [{"path": "a.py", "content": "A"}, {"path": "b.py", "content": "B';
        const offset = findLastCompleteFileEndOffset(truncated);
        expect(offset).toBeGreaterThan(0);
        // The offset must point to the '}' closing the first file object
        expect(truncated.substring(0, offset + 1)).toContain('"path": "a.py"');
        expect(truncated[offset]).toBe('}');
    });

    it('ignores braces inside string values (Python dict and Java method bodies)', () => {
        const truncated = '{"files": [{"path": "dict.py", "content": "def f():\\n    d = {\\"a\\": 1, \\"b\\": {\\"c\\": 2}}\\n    return d"}, {"path": "broken.py", "content": "class Broken {\\n    void m() {\\n';
        const offset = findLastCompleteFileEndOffset(truncated);
        expect(offset).toBeGreaterThan(0);
        expect(truncated[offset]).toBe('}');
        const candidate = truncated.substring(0, offset + 1) + ']}';
        const parsed = JSON.parse(candidate);
        expect(parsed.files).toHaveLength(1);
        expect(parsed.files[0].path).toBe('dict.py');
    });

    it('handles escaped quotes inside string values without prematurely ending the string', () => {
        const truncated = '{"files": [{"path": "quotes.py", "content": "s = \\"escaped \\\\\\"quote\\\\\\" in string\\"\\n"}, {"path": "trunc.py", "content": "x = \\"unfinished';
        const offset = findLastCompleteFileEndOffset(truncated);
        expect(offset).toBeGreaterThan(0);
        expect(truncated[offset]).toBe('}');
        const candidate = truncated.substring(0, offset + 1) + ']}';
        const parsed = JSON.parse(candidate);
        expect(parsed.files).toHaveLength(1);
        expect(parsed.files[0].path).toBe('quotes.py');
    });

    it('returns -1 when no complete file object exists (failure case)', () => {
        const truncatedBeforeFirstClose = '{"files": [{"path": "incomplete.py", "content": "print(1)';
        expect(findLastCompleteFileEndOffset(truncatedBeforeFirstClose)).toBe(-1);
    });

    it('returns -1 for empty or whitespace input', () => {
        expect(findLastCompleteFileEndOffset('')).toBe(-1);
        expect(findLastCompleteFileEndOffset('   ')).toBe(-1);
    });
});

describe('M10 — parseOrRepairJson', () => {
    it('well-formed JSON parses normally (simple case)', () => {
        const input = JSON.stringify({
            files: [
                { path: 'main.py', content: 'print("hello world")' },
                { path: 'utils.py', content: 'def add(a, b): return a + b' }
            ]
        });
        const result = parseOrRepairJson(input);
        expect(result.files).toHaveLength(2);
        expect(result.files[0].path).toBe('main.py');
        expect(result.files[1].path).toBe('utils.py');
    });

    it('handles responses wrapped in markdown code fences', () => {
        const jsonContent = JSON.stringify({
            files: [{ path: 'app.py', content: 'print(1)' }]
        });
        const wrapped = '```json\n' + jsonContent + '\n```';
        const result = parseOrRepairJson(wrapped);
        expect(result.files).toHaveLength(1);
        expect(result.files[0].path).toBe('app.py');
    });

    it('a response truncated in the middle of the LAST file object still salvages earlier complete files', () => {
        const truncated = '{\n  "files": [\n    {\n      "path": "file1.py",\n      "content": "def run():\\n    print(\\"file1\\")"\n    },\n    {\n      "path": "file2.py",\n      "content": "def run():\\n    print(\\"trun';
        const result = parseOrRepairJson(truncated);
        expect(result.files).toHaveLength(1);
        expect(result.files[0].path).toBe('file1.py');
    });

    it('THE REGRESSION TEST THAT MATTERS: a truncated response whose file content values contain } and { characters inside the string is repaired correctly', () => {
        // Earlier complete file contains nested Python dict and Java class syntax inside content strings
        const truncated = '{\n  "files": [\n    {\n      "path": "Pipeline.java",\n      "content": "public class Pipeline {\\n    public static void main(String[] args) {\\n        Map<String, Object> map = new HashMap<>() {{\\n            put(\\"key\\", \\"val\\");\\n        }};\\n    }\\n}"\n    },\n    {\n      "path": "Broken.java",\n      "content": "public class Broken {\\n    void partial() {\\n        // cut off here\n';
        const result = parseOrRepairJson(truncated);
        expect(result.files).toHaveLength(1);
        expect(result.files[0].path).toBe('Pipeline.java');
        expect(result.files[0].content).toContain('Map<String, Object>');
    });

    it('escaped quotes inside content do not confuse the scanner', () => {
        const truncated = '{\n  "files": [\n    {\n      "path": "escaped.py",\n      "content": "data = {\\"msg\\": \\"She said: \\\\\\"hello world\\\\\\"\\"}"\n    },\n    {\n      "path": "next.py",\n      "content": "broken';
        const result = parseOrRepairJson(truncated);
        expect(result.files).toHaveLength(1);
        expect(result.files[0].path).toBe('escaped.py');
    });

    it('a response with nothing salvageable rethrows the original SyntaxError', () => {
        const unparseable = '{"files": [{"path": "bad.py", "content": "incomplete...';
        expect(() => parseOrRepairJson(unparseable)).toThrow(SyntaxError);
    });

    it('empty string / whitespace-only input throws descriptive error', () => {
        expect(() => parseOrRepairJson('')).toThrow('Empty response from Gemini model.');
        expect(() => parseOrRepairJson('   \n\t  ')).toThrow('Empty response from Gemini model.');
    });
});

describe('M10 - pathological truncation (performance regression barrier)', () => {
    it('salvages a brace-heavy truncated payload in a single pass', () => {
        // The old backward-rescan algorithm needed 11,998 JSON.parse attempts and ~1392ms
        // on this exact input, because truncation lands deep inside a file whose content
        // is full of braces, so every '}' in that content was rescanned with a fresh
        // substring + full parse. The forward scanner does it in one pass.
        const doc = JSON.stringify({
            files: [
                ...Array.from({ length: 5 }, (_, i) => ({ path: `small${i}.py`, content: 'x = 1' })),
                { path: 'huge.py', content: 'def f():\n    return {"a": {"b": {"c": [1,2,3]}}}\n'.repeat(4000) },
            ],
        });
        const truncated = doc.substring(0, doc.length - 60);

        const started = Date.now();
        const offset = findLastCompleteFileEndOffset(truncated);
        const elapsed = Date.now() - started;

        expect(offset).toBeGreaterThan(0);
        const parsed = JSON.parse(truncated.substring(0, offset + 1).trim() + ']}');
        expect(parsed.files).toHaveLength(5);
        // Generous bound: the point is to catch a reintroduction of quadratic behaviour,
        // not to assert a specific machine's speed.
        expect(elapsed).toBeLessThan(250);
    });

    it('is not fooled by a decoy "files" key inside file content', () => {
        const doc = JSON.stringify({
            files: [
                { path: 'a.py', content: '{"files": [{"path": "fake.py"}]}' },
                { path: 'real.py', content: 'ok' },
            ],
        });
        const truncated = doc.substring(0, doc.length - 18);
        const offset = findLastCompleteFileEndOffset(truncated);
        const parsed = JSON.parse(truncated.substring(0, offset + 1).trim() + ']}');

        expect(parsed.files).toHaveLength(1);
        expect(parsed.files[0].path).toBe('a.py');
    });

    it('treats an escaped backslash at the end of content as ending the string', () => {
        const doc = JSON.stringify({
            files: [
                { path: 'a.txt', content: 'ends with backslash \\\\' },
                { path: 'b.txt', content: 'second' },
            ],
        });
        const truncated = doc.substring(0, doc.length - 15);
        const offset = findLastCompleteFileEndOffset(truncated);
        const parsed = JSON.parse(truncated.substring(0, offset + 1).trim() + ']}');

        expect(parsed.files[0].content).toBe('ends with backslash \\\\');
    });
});
