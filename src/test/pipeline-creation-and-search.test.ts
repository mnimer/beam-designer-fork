/**
 * Unit tests for Pipeline Creation YAML Serialization (A8) and
 * Narrowed Activation Events & Workspace Search Exclusions (M17).
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import YAML from 'yaml';

// Mock vscode module
const { mockFindFiles } = vi.hoisted(() => ({
    mockFindFiles: vi.fn().mockResolvedValue([])
}));

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
            workspaceFolders: [
                {
                    uri: { fsPath: '/workspace' },
                    name: 'workspace'
                }
            ],
            findFiles: mockFindFiles,
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

import {
    getInitialPipelineContent,
    PIPELINE_SEARCH_EXCLUDE_DIRS,
    PIPELINE_SEARCH_EXCLUDE_PATTERN,
    DataFlowTreeProvider,
    BEAM_EDITOR_VIEW_TYPE
} from '../extension';

describe('Finding A8 — Starter Pipeline YAML Serialization', () => {
    it('serializes new pipeline as YAML instead of JSON (simple case)', () => {
        const content = getInitialPipelineContent();
        // A JSON document starts with '{', YAML does not
        expect(content.trim().startsWith('{')).toBe(false);
        // Valid YAML document
        expect(content).toContain('nodes: []');
        expect(content).toContain('edges: []');
        expect(content).toContain('pipelineConfig:');
        expect(content).toContain('jobConfig:');
    });

    it('parses back with YAML.parse to exact expected shape and defaults (extreme case)', () => {
        const content = getInitialPipelineContent();
        const parsed = YAML.parse(content);

        expect(parsed).toEqual({
            nodes: [],
            edges: [],
            runtimeVariables: [],
            pipelineConfig: {
                language: 'Python',
                outputFolder: '',
                needsRebuild: false
            },
            jobConfig: {
                runner: 'DirectRunner',
                machineType: 'n1-standard-1',
                minInstances: 1,
                maxInstances: 10,
                gcsStagingPath: '',
                network: '',
                subnetwork: ''
            }
        });
    });

    it('emits keys in the same order as the webview PipelineState (consistency case)', () => {
        // NOTE: toEqual above is order-insensitive, but the point of A8 is that a brand new
        // file is byte-indistinguishable from a saved one. The webview serializes
        // PipelineState (webview/src/hooks/usePipelinePersistence.ts) with a plain
        // YAML.stringify, so key order is part of the contract, not cosmetic.
        const parsed = YAML.parse(getInitialPipelineContent());
        expect(Object.keys(parsed)).toEqual([
            'nodes',
            'edges',
            'runtimeVariables',
            'jobConfig',
            'pipelineConfig'
        ]);
    });

    it('is byte-identical when re-serialized with YAML.stringify (failure / consistency case)', () => {
        const content = getInitialPipelineContent();
        const parsed = YAML.parse(content);
        const reSerialized = YAML.stringify(parsed);
        expect(content).toBe(reSerialized);
    });
});

describe('Finding M17 — Activation Events and Workspace Search Exclusions', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('package.json activationEvents does not contain wildcard * (M17a)', () => {
        const packageJsonPath = path.resolve(__dirname, '../../package.json');
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

        expect(packageJson.activationEvents).not.toContain('*');
        expect(packageJson.activationEvents).toContain('onCustomEditor:dataflow-pipeline-builder.beamEditor');
        expect(packageJson.activationEvents).toContain('onView:dataflowExplorer');
    });

    it('PIPELINE_SEARCH_EXCLUDE_PATTERN excludes node_modules, .git, and build outputs without excluding .beam files (M17b)', () => {
        expect(PIPELINE_SEARCH_EXCLUDE_DIRS).toContain('node_modules');
        expect(PIPELINE_SEARCH_EXCLUDE_DIRS).toContain('.git');
        expect(PIPELINE_SEARCH_EXCLUDE_DIRS).toContain('.venv');
        expect(PIPELINE_SEARCH_EXCLUDE_DIRS).toContain('__pycache__');
        expect(PIPELINE_SEARCH_EXCLUDE_DIRS).toContain('target');
        expect(PIPELINE_SEARCH_EXCLUDE_DIRS).toContain('dist');
        expect(PIPELINE_SEARCH_EXCLUDE_DIRS).toContain('build');
        expect(PIPELINE_SEARCH_EXCLUDE_DIRS).toContain('out');

        // Must NOT exclude .beam files themselves
        expect(PIPELINE_SEARCH_EXCLUDE_DIRS).not.toContain('*.beam');
        expect(PIPELINE_SEARCH_EXCLUDE_DIRS).not.toContain('beam');
        expect(PIPELINE_SEARCH_EXCLUDE_PATTERN).not.toContain('*.beam');

        // Pattern must be a valid glob
        expect(PIPELINE_SEARCH_EXCLUDE_PATTERN).toContain('**/node_modules/**');
        expect(PIPELINE_SEARCH_EXCLUDE_PATTERN).toContain('**/.git/**');
    });

    it('DataFlowTreeProvider passes PIPELINE_SEARCH_EXCLUDE_PATTERN to findFiles (M17b)', async () => {
        const provider = new DataFlowTreeProvider();
        provider.refresh();

        // Wait a microtask turn for scanPipelines async execution
        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(mockFindFiles).toHaveBeenCalledWith(
            '**/*.beam',
            PIPELINE_SEARCH_EXCLUDE_PATTERN
        );
    });
});

describe('command wiring integrity', () => {
    // Regression: 'dataflow-pipeline-builder.openPipeline' was referenced twice
    // (by the showEditor command and by a DataItem tree node) but was never registered
    // anywhere. showEditor is advertised in the Command Palette, so invoking it always
    // failed with "command not found". These tests assert that every command the source
    // dispatches to, and every command package.json declares, actually exists.
    const rawSource = fs.readFileSync(
        path.join(__dirname, '..', 'extension.ts'), 'utf-8');
    const pkg = JSON.parse(fs.readFileSync(
        path.join(__dirname, '..', '..', 'package.json'), 'utf-8'));

    /**
     * Strips whole-line comments and line-start block comments so that only executable
     * code is scanned.
     *
     * NOTE: this matters in both directions. Historical notes in comments legitimately
     * name the dead `openPipeline` command, and must not trip the regression guard. More
     * importantly, a commented-out `registerCommand('x')` must NOT be counted as a live
     * registration -- otherwise these tests would happily pass while the command is
     * actually unreachable, which is the exact bug they exist to catch.
     *
     * HACK: this is line-based rather than a real tokenizer. The obvious regex approach
     * (`/\/\*[\s\S]*?\*\//g`) is actively WRONG on this file: glob literals such as
     * '**' + '/node_modules/**' contain a `/*` sequence, so the regex treats the inside
     * of a string as the start of a block comment and swallows hundreds of lines of real
     * code. That silently hid 3 of the 4 registerCommand calls when first attempted.
     * Only trailing comments are left in place, because stripping `//` mid-line would
     * corrupt URLs like https://... -- and a commented-out call site would occupy its
     * own line anyway.
     */
    const stripComments = (src: string): string => {
        let inBlock = false;
        return src
            .split('\n')
            .map((line) => {
                const trimmed = line.trim();
                if (inBlock) {
                    // A docblock terminator may share a line with nothing else of interest.
                    if (trimmed.includes('*/')) { inBlock = false; }
                    return '';
                }
                // Only treat `/*` as a comment opener when it begins the line; anywhere
                // else it is overwhelmingly likely to be inside a glob or a string.
                if (trimmed.startsWith('/*')) {
                    if (!trimmed.includes('*/')) { inBlock = true; }
                    return '';
                }
                if (trimmed.startsWith('//')) { return ''; }
                return line;
            })
            .join('\n');
    };

    const executableSource = stripComments(rawSource);

    /** Extracts every command id this extension registers at runtime. */
    const registeredCommands = (): Set<string> => {
        const ids = new Set<string>();
        const re = /registerCommand\(\s*'([^']+)'/g;
        let m: RegExpExecArray | null;
        while ((m = re.exec(executableSource)) !== null) { ids.add(m[1]); }
        return ids;
    };

    it('registers every command declared in package.json', () => {
        const registered = registeredCommands();
        const declared = pkg.contributes.commands.map((c: any) => c.command);
        for (const id of declared) {
            expect(registered, `package.json declares "${id}" but nothing registers it`).toContain(id);
        }
    });

    it('never dispatches to an unregistered first-party command', () => {
        const registered = registeredCommands();
        const dispatched = new Set<string>();
        const re = /executeCommand\(\s*'(dataflow-pipeline-builder\.[^']+)'/g;
        let m: RegExpExecArray | null;
        while ((m = re.exec(executableSource)) !== null) { dispatched.add(m[1]); }

        // Guard against vacuity: a for-loop over an empty set passes trivially, so if the
        // regex ever stops matching (renamed prefix, reformatted call site) this test
        // would go green while checking nothing at all.
        expect(dispatched.size, 'expected at least one first-party executeCommand call').toBeGreaterThan(0);

        for (const id of dispatched) {
            expect(registered, `source dispatches to "${id}" but nothing registers it`).toContain(id);
        }
    });

    it('does not reference the phantom openPipeline command in executable code', () => {
        // Scoped to executable code: the comments intentionally document why this
        // command no longer exists, and that history is worth keeping.
        const offenders = executableSource
            .split('\n')
            .map((line, i) => ({ line: line.trim(), n: i + 1 }))
            .filter(({ line }) => line.includes('dataflow-pipeline-builder.openPipeline'));

        // Report line numbers rather than the 138KB source blob on failure.
        expect(offenders.map((o) => `line ${o.n}: ${o.line}`)).toEqual([]);
    });

    it('uses one shared constant for the custom editor view type', () => {
        // A typo in any call site would silently open the plain text editor instead.
        expect(BEAM_EDITOR_VIEW_TYPE).toBe(pkg.contributes.customEditors[0].viewType);
        expect(pkg.activationEvents).toContain(`onCustomEditor:${BEAM_EDITOR_VIEW_TYPE}`);
    });
});
