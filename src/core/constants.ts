/** @fileoverview Central configuration constants, pipeline defaults, and search exclude patterns.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

import YAML from 'yaml';
import { DEFAULT_IGNORE_PATTERNS } from '../resources/resourceLoader';

/**
 * View type of the custom Beam pipeline editor.
 *
 * MUST stay in sync with `contributes.customEditors[0].viewType` in package.json and with
 * the `onCustomEditor:` activation event. Centralised here because a typo in any one of
 * the call sites fails silently -- VS Code simply opens the file in the plain text editor
 * instead of the designer, with no error.
 */
export const BEAM_EDITOR_VIEW_TYPE = 'dataflow-pipeline-builder.beamEditor';

/**
 * Generates initial starter pipeline document content serialized in YAML format.
 * Ensures that newly created .beam pipeline files are byte-consistent with
 * pipelines saved from the designer.
 * 
 * @returns YAML-serialized starter pipeline content
 */
export function getInitialPipelineContent(): string {
    // NOTE: key order and key set deliberately mirror the webview's `PipelineState`
    // (webview/src/hooks/usePipelinePersistence.ts), which serializes with a plain
    // YAML.stringify. Matching both means a brand new pipeline is structurally
    // indistinguishable from one that has been saved once -- which is the entire point
    // of this fix. `runtimeVariables` in particular is part of every saved document;
    // the loader tolerates its absence by defaulting to [], but omitting it here would
    // leave new files subtly different from saved ones.
    return YAML.stringify({
        nodes: [],
        edges: [],
        runtimeVariables: [],
        jobConfig: {
            runner: 'DirectRunner',
            machineType: 'n1-standard-1',
            minInstances: 1,
            maxInstances: 10,
            gcsStagingPath: '',
            network: '',
            subnetwork: ''
        },
        pipelineConfig: {
            language: 'Python',
            outputFolder: '',
            needsRebuild: false
        }
    });
}

/**
 * Directory names to exclude when scanning workspace files for pipeline definitions.
 * Combines directory patterns from DEFAULT_IGNORE_PATTERNS with standard build output directories.
 */
export const PIPELINE_SEARCH_EXCLUDE_DIRS: readonly string[] = [
    ...DEFAULT_IGNORE_PATTERNS
        .filter(p => !p.startsWith('*') && !p.endsWith('.beam') && !p.endsWith('.tf') && !p.endsWith('.log'))
        .map(p => p.replace(/\/$/, '')),
    'dist',
    'build',
    'out'
];

/**
 * Glob pattern for excluding dependency, build, and VCS directories when scanning
 * workspace files for .beam pipelines.
 */
export const PIPELINE_SEARCH_EXCLUDE_PATTERN: string = `{${PIPELINE_SEARCH_EXCLUDE_DIRS.map(dir => `**/${dir}/**`).join(',')}}`;

/**
 * Directory names to skip when listing the files of a generated pipeline project
 * for display in the Source Code tab.
 *
 * The Source Code tab is meant to show the ~10 files the generator produced. Running the
 * pipeline once creates a virtualenv (`venv`, created by the generated run_directrunner.sh)
 * or a Maven `target/` directory, either of which adds thousands of entries and makes the
 * tab unusable.
 *
 * NOTE: the walker independently skips every dot-prefixed entry, which already covers
 * `.venv`, `.git` and friends. This list therefore exists for the directories that do NOT
 * start with a dot -- `venv` being the one that actually caused the reported bug. The
 * dot-prefixed names are still included so the list stays correct on its own terms if the
 * walker's dot rule is ever relaxed.
 */
export const GENERATED_FILE_LIST_EXCLUDE_DIRS: readonly string[] = PIPELINE_SEARCH_EXCLUDE_DIRS;
