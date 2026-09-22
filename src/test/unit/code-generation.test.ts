/**
 * Unit tests for Code Generation and Language Strategy Module (A3 Refactor).
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Tests:
 * - resolveLanguageStrategy: verification of language strategy resolution (Java, Python, fallbacks, case sensitivity).
 * - assemblePrompt: verification of {{...}} template substitution, complete placeholder coverage,
 *   and literal preservation of $& and $' within pipeline definitions.
 * - PYTHON_STRATEGY and JAVA_STRATEGY: verification of language-specific file filtering, routing,
 *   import adjustment, and pipeline file identification.
 */

import { describe, it, expect, vi } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';

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
            getConfiguration: vi.fn(() => ({ get: vi.fn() })),
        },
        Uri: {
            file: (p: string) => ({ fsPath: p, toString: () => p }),
            parse: (u: string) => ({ fsPath: u, toString: () => u }),
        },
        commands: {
            registerCommand: vi.fn(),
            executeCommand: vi.fn(),
        },
        window: {
            createWebviewPanel: vi.fn(),
            showErrorMessage: vi.fn(),
            showWarningMessage: vi.fn(),
            showInformationMessage: vi.fn(),
            withProgress: vi.fn(),
        },
        ProgressLocation: {
            Notification: 15,
        },
    };
});

import {
    resolveLanguageStrategy,
    assemblePrompt,
    handleRegenerateCode,
    PYTHON_STRATEGY,
    JAVA_STRATEGY,
    PromptAssemblyOptions,
} from '../../codeGeneration';

describe('A3 — resolveLanguageStrategy', () => {
    it('returns JAVA_STRATEGY for "java" (simple case)', () => {
        const strategy = resolveLanguageStrategy('java');
        expect(strategy).toBe(JAVA_STRATEGY);
        expect(strategy.langSubfolder).toBe('java');
        expect(strategy.promptFile).toBe('code-gen-prompt-java.txt');
        expect(strategy.fileExt).toBe('java');
    });

    it('returns JAVA_STRATEGY for "Java" and "JAVA" (case-insensitive)', () => {
        expect(resolveLanguageStrategy('Java')).toBe(JAVA_STRATEGY);
        expect(resolveLanguageStrategy('JAVA')).toBe(JAVA_STRATEGY);
        expect(resolveLanguageStrategy('jAvA')).toBe(JAVA_STRATEGY);
    });

    it('returns PYTHON_STRATEGY for "python" (simple case)', () => {
        const strategy = resolveLanguageStrategy('python');
        expect(strategy).toBe(PYTHON_STRATEGY);
        expect(strategy.langSubfolder).toBe('python');
        expect(strategy.promptFile).toBe('code-gen-prompt-python.txt');
        expect(strategy.fileExt).toBe('py');
    });

    it('returns PYTHON_STRATEGY for "Python" and "PYTHON" (case-insensitive)', () => {
        expect(resolveLanguageStrategy('Python')).toBe(PYTHON_STRATEGY);
        expect(resolveLanguageStrategy('PYTHON')).toBe(PYTHON_STRATEGY);
        expect(resolveLanguageStrategy('pYtHon')).toBe(PYTHON_STRATEGY);
    });

    it('returns PYTHON_STRATEGY for empty string (non-Java default)', () => {
        expect(resolveLanguageStrategy('')).toBe(PYTHON_STRATEGY);
    });

    it('returns PYTHON_STRATEGY for unknown language values (non-Java default)', () => {
        expect(resolveLanguageStrategy('scala')).toBe(PYTHON_STRATEGY);
        expect(resolveLanguageStrategy('go')).toBe(PYTHON_STRATEGY);
        expect(resolveLanguageStrategy('csharp')).toBe(PYTHON_STRATEGY);
        expect(resolveLanguageStrategy('unknown')).toBe(PYTHON_STRATEGY);
        expect(resolveLanguageStrategy('rust')).toBe(PYTHON_STRATEGY);
    });

    it('returns PYTHON_STRATEGY for extreme / edge inputs (partial match, whitespace, null/undefined)', () => {
        // Must not match prefix/substring
        expect(resolveLanguageStrategy('javascript')).toBe(PYTHON_STRATEGY);
        expect(resolveLanguageStrategy('java17')).toBe(PYTHON_STRATEGY);
        expect(resolveLanguageStrategy('java ')).toBe(PYTHON_STRATEGY);
        expect(resolveLanguageStrategy('   ')).toBe(PYTHON_STRATEGY);
        // Null / undefined type-cast failure cases
        expect(resolveLanguageStrategy(null as unknown as string)).toBe(PYTHON_STRATEGY);
        expect(resolveLanguageStrategy(undefined as unknown as string)).toBe(PYTHON_STRATEGY);
    });
});

describe('A3 — assemblePrompt Placeholder Substitution', () => {
    const defaultOptions: PromptAssemblyOptions = {
        promptTemplate: [
            'Target language: {{language}}',
            'Pipeline definition:',
            '{{pipeline}}',
            'Dockerfile:',
            '{{dockerfile_template}}',
            'Direct runner:',
            '{{run_directrunner_template}}',
            'Dataflow runner:',
            '{{run_dataflowrunner_template}}',
            'Spark runner:',
            '{{run_sparkrunner_template}}',
            'End of prompt for {{language}}.',
        ].join('\n'),
        language: 'python',
        pipelineYaml: 'pipeline:\n  name: TestPipeline',
        dockerfileTemplate: 'FROM apache/beam_python3.11_sdk:2.54.0',
        directRunnerTemplate: '#!/bin/bash\npython -m src.pipeline',
        dataflowRunnerTemplate: '#!/bin/bash\npython -m src.pipeline --runner DataflowRunner',
        sparkRunnerTemplate: '',
    };

    it('substitutes every {{...}} placeholder with no unreplaced "{{" remaining (simple case)', () => {
        const result = assemblePrompt(defaultOptions);

        expect(result).toContain('Target language: python');
        expect(result).toContain('pipeline:\n  name: TestPipeline');
        expect(result).toContain('FROM apache/beam_python3.11_sdk:2.54.0');
        expect(result).toContain('python -m src.pipeline');
        expect(result).toContain('python -m src.pipeline --runner DataflowRunner');
        expect(result).toContain('End of prompt for python.');

        // Verify zero unreplaced placeholders
        expect(result).not.toContain('{{');
        expect(result).not.toContain('}}');
    });

    it('replaces all multiple occurrences of {{language}} globally', () => {
        const template = '1: {{language}}, 2: {{language}}, 3: {{language}}';
        const result = assemblePrompt({
            ...defaultOptions,
            promptTemplate: template,
            language: 'java',
        });
        expect(result).toBe('1: java, 2: java, 3: java');
        expect(result).not.toContain('{{language}}');
    });

    it('handles empty strings for templates and pipeline cleanly (extreme case)', () => {
        const result = assemblePrompt({
            promptTemplate: '{{language}}|{{pipeline}}|{{dockerfile_template}}|{{run_directrunner_template}}|{{run_dataflowrunner_template}}|{{run_sparkrunner_template}}',
            language: '',
            pipelineYaml: '',
            dockerfileTemplate: '',
            directRunnerTemplate: '',
            dataflowRunnerTemplate: '',
            sparkRunnerTemplate: '',
        });
        expect(result).toBe('|||||');
        expect(result).not.toContain('{{');
    });

    it('preserves templates with no placeholders unchanged (failure / boundary case)', () => {
        const staticTemplate = 'Static prompt with no placeholders at all.';
        const result = assemblePrompt({
            ...defaultOptions,
            promptTemplate: staticTemplate,
        });
        expect(result).toBe(staticTemplate);
    });
});

describe('A3 — assemblePrompt Literal Text Replacement ($& and $\' Protection)', () => {
    const baseTemplate = 'Header\n{{pipeline}}\nFooter';

    it('treats "$&" in pipeline YAML as literal text and not match substitution', () => {
        // In String.prototype.replace(str, replacementString), "$&" inserts the matched pattern ("{{pipeline}}").
        // Our replacer function `() => pipelineYaml` must prevent this corruption.
        const pipelineWithMatchRef = 'transform:\n  query: "SELECT $& FROM dataset.table"';

        const result = assemblePrompt({
            promptTemplate: baseTemplate,
            language: 'python',
            pipelineYaml: pipelineWithMatchRef,
            dockerfileTemplate: '',
            directRunnerTemplate: '',
            dataflowRunnerTemplate: '',
            sparkRunnerTemplate: '',
        });

        // The exact literal "$&" must be present
        expect(result).toContain('SELECT $& FROM dataset.table');
        // It must NOT have inserted the matched token "{{pipeline}}"
        expect(result).not.toContain('SELECT {{pipeline}} FROM dataset.table');
    });

    it('treats "$\'" in pipeline YAML as literal text and not post-match substitution', () => {
        // In String.prototype.replace(str, replacementString), "$'" inserts the portion after the match ("\nFooter").
        const pipelineWithPostMatch = 'transform:\n  regex: "foo$\'bar"';

        const result = assemblePrompt({
            promptTemplate: baseTemplate,
            language: 'python',
            pipelineYaml: pipelineWithPostMatch,
            dockerfileTemplate: '',
            directRunnerTemplate: '',
            dataflowRunnerTemplate: '',
            sparkRunnerTemplate: '',
        });

        expect(result).toContain('regex: "foo$\'bar"');
        expect(result).not.toContain('foobar\nFooter');
    });

    it('treats "$`", "$1", "$$", and regex tokens as literal text across all templates (extreme case)', () => {
        const yamlWithSpecialChars = 'notes: "$`pre $1 group $$100 \\w+ \\d+ [A-Z]"';
        const dockerfileWithDollar = 'ENV PATH="$PATH:/opt/custom"';
        const directRunnerWithSpecial = 'echo "$1" && grep -E "\\$[0-9]+"';

        const template = '{{pipeline}}\n{{dockerfile_template}}\n{{run_directrunner_template}}';
        const result = assemblePrompt({
            promptTemplate: template,
            language: 'python',
            pipelineYaml: yamlWithSpecialChars,
            dockerfileTemplate: dockerfileWithDollar,
            directRunnerTemplate: directRunnerWithSpecial,
            dataflowRunnerTemplate: '',
            sparkRunnerTemplate: '',
        });

        expect(result).toContain(yamlWithSpecialChars);
        expect(result).toContain(dockerfileWithDollar);
        expect(result).toContain(directRunnerWithSpecial);
    });
});

describe('A3 — Language Strategies: Python and Java Behaviors', () => {
    describe('PYTHON_STRATEGY', () => {
        it('identifies mismatched Java artifacts', () => {
            expect(PYTHON_STRATEGY.isMismatchedArtifact('pom.xml', 'pom.xml')).toBe(true);
            expect(PYTHON_STRATEGY.isMismatchedArtifact('run_sparkrunner.sh', 'run_sparkrunner.sh')).toBe(true);
            expect(PYTHON_STRATEGY.isMismatchedArtifact('App.class', 'target/classes/App.class')).toBe(true);
            expect(PYTHON_STRATEGY.isMismatchedArtifact('pipeline.py', 'pipeline.py')).toBe(false);
            expect(PYTHON_STRATEGY.isMismatchedArtifact('requirements.txt', 'requirements.txt')).toBe(false);
            expect(PYTHON_STRATEGY.isMismatchedArtifact('Dockerfile', 'Dockerfile')).toBe(false);
        });

        it('routes Python pipeline and test files correctly', () => {
            expect(PYTHON_STRATEGY.routeFilename('pipeline.py', 'pipeline.py', '.', 'my_pipeline')).toBe('src/my_pipeline.py');
            expect(PYTHON_STRATEGY.routeFilename('my_pipeline.py', 'my_pipeline.py', '.', 'my_pipeline')).toBe('src/my_pipeline.py');
            expect(PYTHON_STRATEGY.routeFilename('pipeline_test.py', 'pipeline_test.py', '.', 'my_pipeline')).toBe('src/my_pipeline_test.py');
            expect(PYTHON_STRATEGY.routeFilename('my_pipeline_test.py', 'my_pipeline_test.py', '.', 'my_pipeline')).toBe('src/my_pipeline_test.py');
            expect(PYTHON_STRATEGY.routeFilename('utils.py', 'utils.py', '.', 'my_pipeline')).toBe('src/utils.py');
            expect(PYTHON_STRATEGY.routeFilename('sub/nested.py', 'nested.py', 'sub', 'my_pipeline')).toBe('sub/nested.py');
        });

        it('post-processes Python content to rewrite pipeline import references', () => {
            const rawContent = [
                'from src.pipeline import create_pipeline',
                'import src.pipeline',
                'from pipeline import run',
                'import pipeline',
            ].join('\n');

            const updated = PYTHON_STRATEGY.postProcessContent(rawContent, 'custom_job');
            expect(updated).toContain('from src.custom_job import create_pipeline');
            expect(updated).toContain('import src.custom_job');
            expect(updated).toContain('from src.custom_job import run');
            expect(updated).toContain('import src.custom_job');

            // When baseName is 'pipeline', content is left untouched
            const unchanged = PYTHON_STRATEGY.postProcessContent(rawContent, 'pipeline');
            expect(unchanged).toBe(rawContent);
        });

        it('identifies main Python pipeline files', () => {
            expect(PYTHON_STRATEGY.isMainPipelineFile('src/custom_job.py', 'custom_job', '')).toBe(true);
            expect(PYTHON_STRATEGY.isMainPipelineFile('src/pipeline.py', 'custom_job', '')).toBe(true);
            expect(PYTHON_STRATEGY.isMainPipelineFile('src/helper.py', 'custom_job', '')).toBe(true);
            expect(PYTHON_STRATEGY.isMainPipelineFile('other/helper.py', 'custom_job', '')).toBe(true);
            expect(PYTHON_STRATEGY.isMainPipelineFile('other/helper.py', 'custom_job', 'existing_code')).toBe(false);
            expect(PYTHON_STRATEGY.isMainPipelineFile('src/custom_job_test.py', 'custom_job', '')).toBe(false);
            expect(PYTHON_STRATEGY.isMainPipelineFile('src/__init__.py', 'custom_job', '')).toBe(false);
        });
    });

    describe('JAVA_STRATEGY', () => {
        it('identifies mismatched Python artifacts', () => {
            expect(JAVA_STRATEGY.isMismatchedArtifact('requirements.txt', 'requirements.txt')).toBe(true);
            expect(JAVA_STRATEGY.isMismatchedArtifact('pom.xml', 'pom.xml')).toBe(false);
            expect(JAVA_STRATEGY.isMismatchedArtifact('run_sparkrunner.sh', 'run_sparkrunner.sh')).toBe(false);
            expect(JAVA_STRATEGY.isMismatchedArtifact('Dockerfile', 'Dockerfile')).toBe(false);
        });

        it('routes Java pipeline and test files correctly', () => {
            expect(JAVA_STRATEGY.routeFilename('pipeline.java', 'pipeline.java', '.', 'myPipeline')).toBe('src/main/java/com/example/MyPipeline.java');
            expect(JAVA_STRATEGY.routeFilename('mypipeline.java', 'mypipeline.java', '.', 'myPipeline')).toBe('src/main/java/com/example/MyPipeline.java');
            expect(JAVA_STRATEGY.routeFilename('pipelinetest.java', 'pipelinetest.java', '.', 'myPipeline')).toBe('src/test/java/com/example/MyPipelineTest.java');
            expect(JAVA_STRATEGY.routeFilename('pipeline_test.java', 'pipeline_test.java', '.', 'myPipeline')).toBe('src/test/java/com/example/MyPipelineTest.java');
            expect(JAVA_STRATEGY.routeFilename('Helper.java', 'Helper.java', '.', 'myPipeline')).toBe('src/main/java/com/example/Helper.java');
            expect(JAVA_STRATEGY.routeFilename('src/main/java/com/example/Custom.java', 'Custom.java', 'src/main/java/com/example', 'myPipeline')).toBe('src/main/java/com/example/Custom.java');
        });

        it('post-processes Java content without changes', () => {
            const javaCode = 'package com.example;\npublic class MyPipeline {}';
            expect(JAVA_STRATEGY.postProcessContent(javaCode, 'MyPipeline')).toBe(javaCode);
        });

        it('identifies main Java pipeline files', () => {
            expect(JAVA_STRATEGY.isMainPipelineFile('src/main/java/com/example/MyPipeline.java', 'myPipeline', '')).toBe(true);
            expect(JAVA_STRATEGY.isMainPipelineFile('src/main/java/com/example/Pipeline.java', 'myPipeline', '')).toBe(true);
            expect(JAVA_STRATEGY.isMainPipelineFile('src/test/java/com/example/MyPipelineTest.java', 'myPipeline', '')).toBe(false);
        });

        it('defines spark runner template path', () => {
            expect(JAVA_STRATEGY.sparkRunnerTemplatePath).toBe(path.join('templates', 'java', 'run_sparkrunner.sh'));
        });
    });
});

/**
 * Regression guard for the latent bug this refactor closed.
 *
 * Before A3, the language decision was made TWICE, independently, with different
 * defaults:
 *
 *   const langSubfolder = languageVal.toLowerCase() === 'java' ? 'java' : 'python';
 *   const fileExt       = languageVal.toLowerCase() === 'python' ? 'py' : 'java';
 *
 * For 'Java' and 'Python' these agree. For anything else -- an unknown value, or a
 * hand-edited `.beam` whose pipelineConfig.language is something like 'Go' -- they
 * disagreed: the model was asked for PYTHON via the python prompt, but the response
 * scanner then looked for a file ending in `.java`. It found none, so mainPipelineCode
 * was silently left empty and the user got a successful-looking run with no pipeline
 * code.
 *
 * Collapsing both decisions into a single strategy object fixes this by construction.
 * These tests pin that property so it cannot drift apart again.
 */
describe('A3 — language strategy internal coherence (regression)', () => {
    const ALL_STRATEGIES = [
        { name: 'PYTHON_STRATEGY', strategy: PYTHON_STRATEGY, expectedExt: 'py' },
        { name: 'JAVA_STRATEGY', strategy: JAVA_STRATEGY, expectedExt: 'java' },
    ];

    it.each(ALL_STRATEGIES)(
        '$name targets one language consistently across promptFile, langSubfolder and fileExt',
        ({ strategy, expectedExt }) => {
            expect(strategy.fileExt).toBe(expectedExt);
            // The prompt file and the template subfolder must describe the SAME language
            // as the extension used to locate the generated pipeline file.
            expect(strategy.promptFile).toContain(strategy.langSubfolder);
        }
    );

    it('resolves a single strategy object, so prompt and extension can never disagree', () => {
        // The specific inputs that used to produce the incoherent python-prompt/.java-ext
        // combination. Each must now yield one internally consistent strategy.
        for (const value of ['', 'go', 'scala', 'rust', 'Kotlin', 'unknown']) {
            const strategy = resolveLanguageStrategy(value);
            expect(strategy.promptFile).toContain(strategy.langSubfolder);
            expect(strategy.fileExt).toBe('py');
            expect(strategy.langSubfolder).toBe('python');
        }
    });

    it('still routes the two languages the UI can actually produce', () => {
        // webview types pipelineConfig.language as 'Python' | 'Java'; these are the only
        // values reachable without hand-editing the .beam file.
        expect(resolveLanguageStrategy('Python').fileExt).toBe('py');
        expect(resolveLanguageStrategy('Java').fileExt).toBe('java');
    });
});

/**
 * Regression tests for the Java code-generation prompt's dependency guidance.
 *
 * Bug: a generated pipeline pinned `net.datafaker:datafaker:2.1.0` in pom.xml but called
 * `faker.timeAndDate()`, which does not exist in 2.1.0. Maven failed with
 * `cannot find symbol: method timeAndDate()`.
 *
 * Root cause: the prompt pinned every other library in a canonical pom.xml baseline but said
 * nothing about Datafaker, while separately instructing the model to "use the latest version of
 * all libraries". The model therefore invented a version AND chose an API from a different
 * release, with nothing tying the two together.
 *
 * These tests assert the *coherence invariant* -- the pinned version must expose the method the
 * prompt tells the model to call -- rather than merely asserting that some words are present.
 *
 * Verified against the real artifacts with `javap` at the time of writing:
 *   - datafaker 2.1.0: exposes `date()` -> DateAndTime only. No `timeAndDate()`, no TimeAndDate class.
 *   - datafaker 2.7.0: exposes BOTH `date()` -> DateAndTime and `timeAndDate()` -> TimeAndDate.
 */
describe('Java codegen prompt — Datafaker version/API coherence (regression)', () => {
    const PROMPT_PATH = path.join(__dirname, '..', '..', '..', 'resources', 'code-gen-prompt-java.txt');
    const prompt = fs.readFileSync(PROMPT_PATH, 'utf-8');

    // The lowest Datafaker release verified to expose `timeAndDate()`. 2.1.0 is verified NOT to.
    // The exact introduction version was not determined, so this is deliberately conservative:
    // it is the oldest version we actually inspected and confirmed working.
    const MIN_VERIFIED_TIME_AND_DATE = [2, 7, 0];

    /** Parses a dotted version string into numeric components for ordered comparison. */
    const parseVersion = (v: string): number[] => v.split('.').map(n => parseInt(n, 10));

    /** Returns true when `a` is greater than or equal to `b`, component by component. */
    const gte = (a: number[], b: number[]): boolean => {
        for (let i = 0; i < Math.max(a.length, b.length); i++) {
            const x = a[i] ?? 0;
            const y = b[i] ?? 0;
            if (x > y) { return true; }
            if (x < y) { return false; }
        }
        return true;
    };

    it('non-vacuity guard: the prompt is found, substantial, and actually mentions Datafaker', () => {
        // Without this guard every assertion below could pass trivially against an empty
        // string if the resource were moved or renamed.
        expect(prompt.length).toBeGreaterThan(1000);
        expect(prompt.toLowerCase()).toContain('datafaker');
    });

    it('no longer tells the model to use the "latest version of all libraries"', () => {
        // This directive is what licensed the model to invent a version number it could not
        // verify, while the rest of the prompt pins exact versions.
        expect(prompt).not.toMatch(/latest version of all libraries/i);
    });

    it('pins an explicit Datafaker version rather than leaving it to the model', () => {
        expect(prompt).toMatch(/<artifactId>\s*datafaker\s*<\/artifactId>/);
    });

    it('pins a Datafaker version that actually exposes the API the prompt recommends', () => {
        const pin = prompt.match(
            /net\.datafaker\s*<\/groupId>\s*<artifactId>\s*datafaker\s*<\/artifactId>\s*<version>\s*([0-9][0-9.]*)\s*<\/version>/
        );
        expect(pin, 'expected an explicit net.datafaker version pin in the prompt').not.toBeNull();
        // Narrows `pin` for the remainder of the test. The expect() above is what actually
        // reports the failure; this guard only keeps the type checker honest without a
        // non-null assertion.
        if (!pin) { return; }

        const version = pin[1];
        const pinned = parseVersion(version);

        // The coherence invariant. If the prompt recommends timeAndDate(), the pinned version
        // must be one that actually has it -- this is the exact pairing that broke the build.
        if (/timeAndDate\(\)/.test(prompt)) {
            expect(
                gte(pinned, MIN_VERIFIED_TIME_AND_DATE),
                `prompt recommends timeAndDate() but pins datafaker ${version}, which is older ` +
                `than the ${MIN_VERIFIED_TIME_AND_DATE.join('.')} verified to expose it`
            ).toBe(true);
        }
    });

    it('never pins the specific version that caused the reported build failure', () => {
        expect(prompt).not.toMatch(
            /<artifactId>\s*datafaker\s*<\/artifactId>\s*<version>\s*2\.1\.0\s*<\/version>/
        );
    });

    it('documents the failure mode so the model understands why the pairing matters', () => {
        // Stating the compiler error verbatim is what makes this guidance actionable rather
        // than an arbitrary rule the model may discard when improvising.
        expect(prompt).toContain('cannot find symbol: method timeAndDate()');
    });
});

/**
 * Regression tests for the Python codegen prompt.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Bug: a generated Python mock-data pipeline ran to completion but emitted nothing,
 * while the equivalent Java pipeline worked. Two independent defects, both traced to
 * this prompt:
 *
 *  1. The DoFn yielded `TaggedOutput(TAG_VALID, ...)` for its MAIN output while
 *     declaring `.with_outputs(TAG_ERRORS, main=TAG_VALID)`. Beam routes an
 *     unrecognised tag to a null receiver, so every element was silently discarded --
 *     no error, no warning, zero output. Verified empirically against Beam 2.76.0:
 *     the tagged form produced 0 elements, the bare form produced 3. The prompt gave
 *     no guidance on tagged outputs at all, so the model improvised this.
 *
 *  2. The prompt mandated the Java cross-language `GenerateSequence` for a periodic
 *     trigger. That needs an ~800MB expansion JAR plus a Docker daemon to host the
 *     Java SDK harness. Without Docker it emits confusing `KafkaIOInitializer` noise
 *     (KafkaIO is merely bundled in the IO shadowJar) and produces no elements.
 *     `PeriodicImpulse` is the native Python equivalent and needs neither.
 */
describe('Python codegen prompt — output routing and trigger selection (regression)', () => {
    const PROMPT_PATH = path.join(__dirname, '..', '..', '..', 'resources', 'code-gen-prompt-python.txt');
    const prompt = fs.readFileSync(PROMPT_PATH, 'utf-8');

    // Non-vacuity guard: every assertion below searches this string, so prove it loaded.
    it('the Python prompt file is readable and non-trivial', () => {
        expect(prompt.length).toBeGreaterThan(1000);
    });

    describe('tagged outputs', () => {
        it('warns that the main output must never be wrapped in TaggedOutput', () => {
            expect(prompt).toMatch(/NEVER wrap the main output in `TaggedOutput`/);
        });

        it('explains the silent-failure mode, which is what makes the rule stick', () => {
            // The danger here is not that it errors -- it is that it does NOT error.
            // A model that does not know this will treat the rule as stylistic.
            expect(prompt).toMatch(/null receiver/i);
            expect(prompt).toMatch(/silently (discards|dropped)/i);
        });

        it('shows the correct bare-yield form for the main output', () => {
            expect(prompt).toMatch(/yield transform\(element\)\s*#\s*CORRECT: main output, bare/);
        });

        it('shows the exact incorrect form that caused the bug', () => {
            expect(prompt).toMatch(/yield TaggedOutput\('valid', record\)\s*#\s*WRONG/);
        });

        it('clarifies that main= only names the read-side accessor', () => {
            expect(prompt).toMatch(/main=.{0,40}only sets the \*attribute name\*/);
        });
    });

    describe('periodic trigger selection', () => {
        it('directs the model to prefer PeriodicImpulse for periodic triggers', () => {
            expect(prompt).toMatch(/PREFER `PeriodicImpulse` FOR PERIODIC TRIGGERS/);
        });

        it('states the Docker requirement that makes cross-language fail locally', () => {
            expect(prompt).toMatch(/Docker daemon/);
        });

        it('names the KafkaIOInitializer symptom so the model can connect cause to effect', () => {
            // This is the exact log line the user saw. Without it the guidance reads as
            // an unexplained preference rather than a diagnosis.
            expect(prompt).toMatch(/KafkaIOInitializer/);
        });

        it('specifies fire_interval in seconds, not milliseconds', () => {
            // The cross-language form immediately below uses milliseconds, so the unit
            // mismatch is a live trap for the model.
            expect(prompt).toMatch(/fire_interval=period_seconds,\s*#\s*seconds, NOT milliseconds/);
        });

        it('still documents the cross-language escape hatch for real sequence consumers', () => {
            // Preferring PeriodicImpulse must not delete the legitimate use case where the
            // pipeline actually consumes the sequence values.
            expect(prompt).toMatch(/beam:external:java:generate_sequence:v1/);
            expect(prompt).toMatch(/consumes the \*\*sequence values themselves\*\*/);
        });

        it('records that None-valued payload keys are dropped rather than sent', () => {
            expect(prompt).toMatch(/silently drops any key whose value is `None`/);
        });
    });

    describe('handleRegenerateCode — DAG pre-flight topology validation', () => {
        it('aborts code generation early and posts failure when YAML DAG contains a cycle', async () => {
            const cyclicYaml = `
nodes:
  - id: n1
    data: { label: 'Node 1', type: 'STEP' }
  - id: n2
    data: { label: 'Node 2', type: 'STEP' }
edges:
  - id: e1
    source: n1
    target: n2
  - id: e2
    source: n2
    target: n1
`;
            const postToWebview = vi.fn().mockResolvedValue(true);
            const options: any = {
                message: {
                    data: cyclicYaml,
                    filename: 'test_pipeline.beam',
                    language: 'Python',
                    outputFolder: 'out',
                },
                context: {} as any,
                uri: { fsPath: '/path/test_pipeline.beam' } as any,
                postToWebview,
                outputChannel: { appendLine: vi.fn() } as any,
            };

            await handleRegenerateCode(options);

            expect(postToWebview).toHaveBeenCalledWith(
                expect.objectContaining({
                    command: 'codeRegenerated',
                    success: false,
                    error: expect.stringContaining('Cyclic dependency detected'),
                })
            );
        });
    });
});


