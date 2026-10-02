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

vi.mock('vscode', async () => (await import('./helpers/vscodeMock')).createVscodeMock({
    workspace: {
        workspaceFolders: []
    }
}));

import {
    resolveLanguageStrategy,
    assemblePrompt,
    deduplicateGeneratedFiles,
    handleRegenerateCode,
    PYTHON_STRATEGY,
    JAVA_STRATEGY,
    PromptAssemblyOptions,
} from '../../codeGeneration';
import {
    parseBeamVersionFromDownloadsHtml,
    parseBeamVersionFromPypiJson,
    getLatestBeamVersion,
    getCachedBeamVersion,
    resetBeamVersionCacheForTesting,
    FALLBACK_BEAM_VERSION,
} from '../../beamVersion';

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
 * Regression tests for the Java code-generation prompt's dependency & packaging guidance.
 *
 * Verifies that:
 * 1. The Java prompt specifies Maven coordinates, minimum verified baseline versions (`>=`),
 *    and shade plugin requirements (`main.jar`, `ServicesResourceTransformer`) concisely
 *    without embedding a verbose full `<project>` XML block.
 * 2. Sample-specific third-party libraries (such as Datafaker in `generate-mock-data.beam`)
 *    carry their minimum version constraint (`>= 2.7.0`) in the sample pipeline definition
 *    rather than bloating the global system prompt.
 */
describe('Java codegen prompt — dependency & pom.xml specification (regression)', () => {
    const PROMPT_PATH = path.join(__dirname, '..', '..', '..', 'resources', 'code-gen-prompt-java.txt');
    const SAMPLE_PATH = path.join(__dirname, '..', '..', '..', 'resources', 'samples', 'generate-mock-data.beam');
    const prompt = fs.readFileSync(PROMPT_PATH, 'utf-8');
    const sample = fs.readFileSync(SAMPLE_PATH, 'utf-8');

    it('specifies Maven coordinates and plugins concisely without a full <project> XML block', () => {
        expect(prompt.length).toBeGreaterThan(1000);
        expect(prompt).not.toContain('<project xmlns="http://maven.apache.org/POM/4.0.0"');
        expect(prompt).toContain('beam-sdks-java-core');
        expect(prompt).toContain('maven-shade-plugin');
        expect(prompt).toContain('${project.build.directory}/main.jar');
        expect(prompt).toContain('ServicesResourceTransformer');
    });

    it('instructs the model to treat baseline versions as minimum verified versions (>=) matching called API methods', () => {
        expect(prompt).not.toMatch(/latest version of all libraries/i);
        expect(prompt).toContain('minimum verified baseline versions (`>=`)');
        expect(prompt).toContain('exposes the exact API methods called in your Java code');
    });

    it('keeps sample-specific Datafaker >= 2.7.0 guidance in generate-mock-data.beam rather than the global prompt', () => {
        expect(prompt.toLowerCase()).not.toContain('datafaker');
        expect(sample).toContain('net.datafaker:datafaker >= 2.7.0');
    });
});

/**
 * Regression tests for the Python codegen prompt.
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


/**
 * Regression tests for connector facts added to the codegen prompts after the
 * 2026-09-24 integration run (54/61 passing).
 *
 * Context: the run's auto-generated remediation directives recommended API that does
 * not exist. Two were caught before they reached the prompts and are pinned here so a
 * future edit cannot reintroduce them:
 *
 *  1. XmlIO. The directive told the generator to chain
 *     `.withSuffix(...).withNumShards(...).withShardTemplate(...)` onto `XmlIO.write()`.
 *     Verified against the real Beam 2.53.0 source: `XmlIO.Write` exposes exactly four
 *     builder methods -- `to`, `withRecordClass`, `withRootElement`, `withCharset`. The
 *     `.xml` suffix is hardcoded inside `expand()`. Following that directive would have
 *     turned a passing-but-flagged test into an outright compile failure.
 *
 *  2. ParquetIO codec. The directive offered `'uncompressed'` as a spelling for no
 *     compression. Beam forwards `codec` straight to pyarrow, whose validator accepts
 *     only NONE/SNAPPY/GZIP/LZO/BROTLI/LZ4/ZSTD; `'uncompressed'` raises
 *     `ArrowException: Unsupported compression`.
 */
describe('Codegen prompts — connector API coherence (regression)', () => {
    const JAVA_PROMPT = fs.readFileSync(
        path.join(__dirname, '..', '..', '..', 'resources', 'code-gen-prompt-java.txt'), 'utf-8');
    const PYTHON_PROMPT = fs.readFileSync(
        path.join(__dirname, '..', '..', '..', 'resources', 'code-gen-prompt-python.txt'), 'utf-8');

    // Non-vacuity guard: every assertion below searches these strings, so prove they loaded.
    it('both prompt files are readable and non-trivial', () => {
        expect(JAVA_PROMPT.length).toBeGreaterThan(1000);
        expect(PYTHON_PROMPT.length).toBeGreaterThan(1000);
    });

    describe('XmlIO write surface', () => {
        it('documents XmlIO at all, so the model is not left to improvise it', () => {
            expect(JAVA_PROMPT).toContain('XmlIO');
        });

        it('never recommends the three builder methods XmlIO.Write does not have', () => {
            // Scoped to the XmlIO section: withSuffix/withNumShards are legitimate elsewhere
            // (TextIO, FileIO), so a naive whole-file search would be both wrong and vacuous.
            const section = JAVA_PROMPT.split('- **`XmlIO`**:')[1]?.split('\n- **`')[0] ?? '';
            expect(section, 'XmlIO section not found in the Java prompt').not.toBe('');

            // The prompt is allowed to *mention* these names to forbid them; what must never
            // appear is the chained-call form that reads as a recommendation.
            expect(section).not.toMatch(/XmlIO\.<T>write\(\)[^\n]*\.withSuffix\(/);
            expect(section).not.toMatch(/XmlIO\.<T>write\(\)[^\n]*\.withNumShards\(/);
            expect(section).not.toMatch(/XmlIO\.<T>write\(\)[^\n]*\.withShardTemplate\(/);
        });

        it('states plainly that the suffix is not configurable', () => {
            // Without the rationale the model tends to "helpfully" restore the missing call.
            expect(JAVA_PROMPT).toMatch(/no\b[^\n]*`withSuffix`/i);
        });
    });

    describe('ParquetIO codec vocabulary', () => {
        it('maps the UNCOMPRESSED node property to the only spelling pyarrow accepts', () => {
            expect(PYTHON_PROMPT).toMatch(/UNCOMPRESSED[^\n]*codec='none'/);
        });

        it('warns that the intuitive spelling is rejected', () => {
            expect(PYTHON_PROMPT).toContain("`'uncompressed'` is NOT a legal pyarrow value");
        });
    });

    /**
     * Iceberg is reachable only through Managed I/O, whose config map is validated at
     * construction — an unknown key fails the pipeline rather than being ignored. Two keys the
     * sink panel used to collect, `write_mode` and `create_table_if_not_exists`, do not exist
     * anywhere in the Beam tree (verified against `IcebergWriteSchemaTransformProvider`). The
     * panel fields were deleted; these assertions stop the prompts from reintroducing them.
     */
    describe('Iceberg Managed I/O surface', () => {
        it.each([
            ['Java', () => JAVA_PROMPT],
            ['Python', () => PYTHON_PROMPT],
        ])('%s prompt documents Iceberg rather than leaving the model to improvise', (_lang, get) => {
            expect(get()).toContain('IcebergIO');
            expect(get()).toContain('Managed I/O');
        });

        it.each([
            ['Java', () => JAVA_PROMPT],
            ['Python', () => PYTHON_PROMPT],
        ])('%s prompt names the two config keys that do not exist', (_lang, get) => {
            expect(get()).toContain('there is no `write_mode` and no `create_table_if_not_exists`');
            expect(get()).toContain('append-only');
        });

        it('Java prompt distinguishes the read output tag from the write snapshots tag', () => {
            // Both are PCollectionRowTuple, and using "output" on the write result is the
            // single easiest mistake to make here.
            const section = JAVA_PROMPT.split('- **`IcebergIO`**')[1]?.split('\n- **`')[0] ?? '';
            expect(section, 'IcebergIO section not found in the Java prompt').not.toBe('');
            expect(section).toContain('.get("output")');
            expect(section).toContain('"snapshots"');
        });

        it('Python prompt forbids the non-existent apache_beam.io.iceberg module', () => {
            // `ReadFromIceberg` / `WriteToIceberg` exist only as Beam YAML transform identifiers;
            // an earlier draft directive tried to import them as Python classes.
            expect(PYTHON_PROMPT).toContain('NO** `apache_beam.io.iceberg` module');
            expect(PYTHON_PROMPT).toContain('from apache_beam.transforms import managed');
        });

        it.each([
            ['Java', () => JAVA_PROMPT],
            ['Python', () => PYTHON_PROMPT],
        ])('%s prompt maps the camelCase panel keys onto snake_case config keys', (_lang, get) => {
            // The panel stores camelCase; Managed's schema is snake_case. Without the explicit
            // mapping the model passes `catalogName` straight through and construction fails.
            expect(get()).toContain('`catalogName` → `catalog_name`');
            expect(get()).toContain('`partition_fields`');
            // catalogType/warehouseLocation/catalogUri are nested, not top-level.
            expect(get()).toContain('NOT top-level keys');
        });
    });

    describe('Tier 2 connector API composition & vocabulary rules', () => {
        it('Java prompt routes TikaIO with* options via FileIO.readMatches -> TikaIO.parseFiles and delegates SINK:TikaIO to TextIO.write', () => {
            expect(JAVA_PROMPT).toContain('`TikaIO.parse().filepattern(filePattern)` has **NO** `.with*` builder methods');
            expect(JAVA_PROMPT).toContain('TikaIO.parseFiles()');
            expect(JAVA_PROMPT).toContain('There is **NO** `TikaIO.write()` class in Apache Beam');
        });

        it('Java prompt documents ThriftIO.readFiles composition and forbids write-only TSimpleJSONProtocol on read', () => {
            expect(JAVA_PROMPT).toContain('ThriftIO.readFiles(T.class).withProtocol(protocolFactory)');
            expect(JAVA_PROMPT).toContain('TSimpleJSONProtocol is a write only protocol');
            expect(JAVA_PROMPT).toContain('Never emit `TSimpleJSONProtocol` on read');
        });

        it('Java prompt warns against the broken ContextualTextIO.Read.watchForNewFiles javadoc and documents resourceId schema', () => {
            expect(JAVA_PROMPT).toContain('`ContextualTextIO.Read.watchForNewFiles(...)` does **NOT** exist');
            expect(JAVA_PROMPT).toContain('`resourceId`');
            expect(JAVA_PROMPT).toContain('`ContextualTextIO` has **NO** `write()` or `sink()` API');
        });

        it('Java prompt documents CsvIO.parseRows composition, mandatory header, and JsonIO write-only fallback to JsonToRow', () => {
            expect(JAVA_PROMPT).toContain('CsvIO.parseRows(schema, csvFormat)');
            expect(JAVA_PROMPT).toContain('`CsvIOParseHelpers.validateCsvFormat` **requires** a non-null, non-empty `.withHeader');
            expect(JAVA_PROMPT).toContain('`JsonIO` in Java is **write-only**');
            expect(JAVA_PROMPT).toContain('JsonToRow.withSchema(schema)');
        });

        it('Python prompt forbids passing compression= to ReadFromCsv/WriteToCsv/ReadFromJson/WriteToJson', () => {
            expect(PYTHON_PROMPT).toContain("raise NotImplementedError('compression')");
            expect(PYTHON_PROMPT).toContain('**Never pass `compression=`** to `ReadFromCsv` or `WriteToCsv`');
        });

        it('Java prompt forbids Compression.AUTO on TFRecordIO.write and Compression.XZ/TAR everywhere', () => {
            expect(JAVA_PROMPT).toContain('`Compression.AUTO.writeCompressed()` throws `UnsupportedOperationException`');
            expect(JAVA_PROMPT).toContain('`Compression` has **NO** `XZ` or `TAR` member');
        });

        it.each([
            ['Java', () => JAVA_PROMPT],
            ['Python', () => PYTHON_PROMPT],
        ])('%s prompt enforces azfs:// for AzureBlobStoreFileSystem and forbids abfss://', (_lang, get) => {
            expect(get()).toContain('ONLY `azfs://{account}/{container}/{blob}`');
            expect(get()).toContain('abfss://');
        });
    });

    describe('property completeness sweep', () => {
        // The single root cause behind 6 of the 7 failures in the run: a configured node
        // property was silently dropped. Both checklists previously enumerated four named
        // properties; every actual failure involved one that was not on that list.
        it.each([
            ['Java', JAVA_PROMPT],
            ['Python', PYTHON_PROMPT],
        ])('%s checklist requires every node property to be accounted for', (_lang, prompt) => {
            expect(prompt).toContain('Walk the `properties` map of EVERY node');
            expect(prompt).toContain('Silently dropping a configured property is a defect');
        });
    });

    /**
     * Beam version floor.
     *
     * The pins should track the newest Beam release; this suite deliberately asserts a
     * FLOOR rather than an exact version so routine upgrades do not require a test edit,
     * while a regression below the floor fails loudly.
     *
     * Why 2.65 and not something lower:
     *   - Managed I/O (`org.apache.beam.sdk.managed`) does not exist before Java 2.58 /
     *     Python 2.61. It is the only supported way to reach Iceberg.
     *   - The Iceberg config keys the UI collects (`partition_fields`, `table_properties`,
     *     `keep`/`drop`/`filter`) landed after 2.60. Managed I/O validates config keys at
     *     construction, so an unknown key is a pipeline construction failure, not a no-op.
     *   2.65 is the first floor that clears both.
     *
     * The prompts must keep pinning an EXPLICIT version. Telling the model to "use the
     * latest version" is what produced the Datafaker 2.1.0 / timeAndDate() build failure
     * guarded above: the model cannot resolve "latest" and invents a plausible number.
     */
    describe('Beam version floor', () => {
        const MIN_BEAM = [2, 65, 0];

        const parseVersion = (v: string): number[] => v.split('.').map(n => parseInt(n, 10));

        const gte = (a: number[], b: number[]): boolean => {
            for (let i = 0; i < Math.max(a.length, b.length); i++) {
                const x = a[i] ?? 0;
                const y = b[i] ?? 0;
                if (x > y) { return true; }
                if (x < y) { return false; }
            }
            return true;
        };

        it('the Java prompt pins a Beam version at or above the Managed I/O floor', () => {
            const pin = JAVA_PROMPT.match(/<beam\.version>\s*([0-9][0-9.]*)\s*<\/beam\.version>/);
            expect(pin, 'expected an explicit <beam.version> pin in the Java prompt').not.toBeNull();
            if (!pin) { return; }
            expect(
                gte(parseVersion(pin[1]), MIN_BEAM),
                `Java prompt pins Beam ${pin[1]}, below the ${MIN_BEAM.join('.')} floor required ` +
                `for Managed I/O and its Iceberg config keys`
            ).toBe(true);
        });

        it('the Python prompt pins a Beam version at or above the Managed I/O floor', () => {
            const pin = PYTHON_PROMPT.match(/apache-beam\[gcp\]>=\s*([0-9][0-9.]*)/);
            expect(pin, 'expected an explicit apache-beam[gcp] pin in the Python prompt').not.toBeNull();
            if (!pin) { return; }
            expect(
                gte(parseVersion(pin[1]), MIN_BEAM),
                `Python prompt pins Beam ${pin[1]}, below the ${MIN_BEAM.join('.')} floor required ` +
                `for Managed I/O and its Iceberg config keys`
            ).toBe(true);
        });

        it('the Python requirements pin and the Dockerfile base image agree', () => {
            // A mismatch here means the container ships one SDK while the job requests
            // another, which surfaces as confusing runtime errors rather than a build failure.
            const req = PYTHON_PROMPT.match(/apache-beam\[gcp\]>=\s*([0-9][0-9.]*)/);
            const img = PYTHON_PROMPT.match(/apache\/beam_python3\.11_sdk:([0-9][0-9.]*)/);
            expect(req).not.toBeNull();
            expect(img).not.toBeNull();
            if (!req || !img) { return; }
            expect(img[1]).toBe(req[1]);
        });
    });

    /**
     * Flex Template parameterization. §3A and checklist #17 previously contradicted each
     * other outright -- §3A said never expose non-sensitive properties as options, #17 said
     * every IO endpoint must be one. A generator satisfying either violated the other.
     */
    describe('deployment-varying property carve-out', () => {
        it.each([
            ['Java', JAVA_PROMPT],
            ['Python', PYTHON_PROMPT],
        ])('%s prompt exposes input and output locations as runtime options', (_lang, prompt) => {
            expect(prompt).toContain('DEPLOYMENT-VARYING PROPERTIES MUST BE RUNTIME OPTIONS');
            expect(prompt).toContain('**Input locations**');
            expect(prompt).toContain('**Output locations**');
        });

        it.each([
            ['Java', JAVA_PROMPT],
            ['Python', PYTHON_PROMPT],
        ])('%s prompt no longer blanket-forbids exposing non-sensitive properties', (_lang, prompt) => {
            // The exact sentence that contradicted checklist #17.
            expect(prompt).not.toContain('NEVER expose non-sensitive properties');
        });
    });

    /**
     * Integration test report remediation directives regression suite.
     * Validates Directives P1-P3 (Python), J1-J2 (Java), and runner scaling propagation rules.
     */
    describe('prompt remediation directives from integration test report (regression)', () => {
        // Python GenerateSequence rate-limiting
        it('Python prompt enforces rate-limited sequence generation and forbids silent property drops', () => {
            // NOTE: Must specify PeriodicImpulse with counter DoFn or explicit # NOTE: comment
            expect(PYTHON_PROMPT).toContain('ratePerSec');
            expect(PYTHON_PROMPT).toContain('elementsPerPeriod');
            expect(PYTHON_PROMPT).toContain('PeriodicImpulse');
            expect(PYTHON_PROMPT).toContain('# NOTE: ratePerSec = <val> is not supported directly in in-memory beam.Create batch execution');
            expect(PYTHON_PROMPT).toMatch(/NEVER silently drop or omit `ratePerSec`/);
        });

        // Python entrypoint quote consistency
        it('Python prompt mandates matching quotes in entrypoint guard to prevent SyntaxError', () => {
            // NOTE: Mismatched quotes like "__main__' trigger fatal SyntaxError: unterminated string literal
            expect(PYTHON_PROMPT).toContain("either `if __name__ == '__main__': run()` or `if __name__ == \"__main__\": run()`");
            expect(PYTHON_PROMPT).toContain('never mix quotation styles');
        });

        // Cloud Build tag pinning (Both languages)
        it.each([
            ['Java', JAVA_PROMPT],
            ['Python', PYTHON_PROMPT],
        ])('%s prompt pins docker builder image tag in cloudbuild.yaml', (_lang, prompt) => {
            // NOTE: Builders without tag trigger fatal container image pull failures in Cloud Build
            expect(prompt).toContain("'gcr.io/cloud-builders/docker:latest'");
        });

        // Java KafkaIO Exactly-Once Semantics (withEOS)
        it('Java prompt enforces withEOS on KafkaIO sink when useEOS: true is specified', () => {
            // NOTE: KafkaIO sink must configure withEOS or idempotent producer properties
            expect(JAVA_PROMPT).toContain('Exactly-Once Semantics (`useEOS`)');
            expect(JAVA_PROMPT).toContain('.withEOS(numShards > 0 ? numShards : 1, sinkGroupId != null ? sinkGroupId : "eos-sink-group")');
            expect(JAVA_PROMPT).toMatch(/NEVER silently omit EOS when specified in YAML/);
        });

        // Java Combiner Optimizations after GroupByKey
        it('Java prompt recommends Combine.groupedValues or Combine.perKey after GroupByKey', () => {
            // NOTE: GroupByKey followed by reduction should use Combine.groupedValues rather than manual loop
            expect(JAVA_PROMPT).toContain('Combiner Optimizations after `GroupByKey`');
            expect(JAVA_PROMPT).toContain('Combine.groupedValues');
        });

        // Worker Scaling Propagation (Both languages)
        it.each([
            ['Java', JAVA_PROMPT],
            ['Python', PYTHON_PROMPT],
        ])('%s prompt enforces propagating jobConfig machineType, minInstances, and maxInstances', (_lang, prompt) => {
            // NOTE: Runner script must propagate scaling parameters to Dataflow Flex Template execution
            expect(prompt).toContain('Job Configuration & Scaling Propagation');
            expect(prompt).toContain('--worker-machine-type="${MACHINE_TYPE:-<machineType>}"');
            expect(prompt).toContain('--num-workers="${MIN_INSTANCES:-<minInstances>}"');
            expect(prompt).toContain('--max-workers="${MAX_INSTANCES:-<maxInstances>}"');
        });

        // Truncation prevention: Java SchemaBuilder mandate & Python JSON-safe quoting
        it('Java prompt mandates SchemaBuilder and forbids multi-line JSON schema strings', () => {
            expect(JAVA_PROMPT).toContain('MANDATORY `SchemaBuilder` RULE — NO MULTI-LINE JSON SCHEMA STRINGS');
            expect(JAVA_PROMPT).toContain('SchemaBuilder.record("Record")');
        });

        it('Python prompt enforces JSON-safe quoting and avoids triple-quoted docstrings in _access_secret', () => {
            expect(PYTHON_PROMPT).toContain('# Reads the payload of a Secret Manager secret.');
            expect(PYTHON_PROMPT).not.toContain('"""Reads the payload of a Secret Manager secret."""');
            expect(PYTHON_PROMPT).toContain('JSON-SAFE QUOTING IN GENERATED CODE');
        });

        // ContextualTextIO and ElasticsearchIO Maven artifacts
        it('Java prompt specifies correct Maven artifacts for ContextualTextIO and ElasticsearchIO', () => {
            expect(JAVA_PROMPT).toContain('org.apache.beam:beam-sdks-java-extensions-contextual-text-io');
            expect(JAVA_PROMPT).toContain('org.apache.beam:beam-sdks-java-io-elasticsearch');
            expect(JAVA_PROMPT).toContain('NEVER `beam-sdks-java-io-elasticsearch-tests`');
        });

        // S3Options getter collision & MapElements.as() prohibition
        it('Java prompt forbids redeclaring String getAwsRegion() on S3Options and forbids MapElements.as()', () => {
            expect(JAVA_PROMPT).toContain('CRITICAL `S3Options` GETTER COLLISION RULE');
            expect(JAVA_PROMPT).toContain('No `.as(String)` Method on `MapElements`');
        });

        // Python FileIO prefix, JsonIO beam.Row, MongoDbIO, Pyodbc, and Flatten single-input rules
        it('Python prompt includes FileIO destination_prefix_naming, JsonIO beam.Row, MongoDbIO, Pyodbc, and Flatten rules', () => {
            expect(PYTHON_PROMPT).toContain('fileio.destination_prefix_naming(prefix=..., suffix=...)');
            expect(PYTHON_PROMPT).toContain('CRITICAL SCHEMA REQUIREMENT');
            expect(PYTHON_PROMPT).toContain('ReadFromMongoDB, WriteToMongoDB');
            expect(PYTHON_PROMPT).toContain('ODBC Connection String Braces Rule (CRITICAL)');
            expect(PYTHON_PROMPT).toContain("(upstream_pcoll,) | '<step_name>' >> beam.Flatten()");
        });

        // Anti-bloat guard: neither prompt should contain internal "(Directive J1/P1)" bookkeeping tags
        it.each([
            ['Java', JAVA_PROMPT],
            ['Python', PYTHON_PROMPT],
        ])('%s prompt is free of internal (Directive J/P) bookkeeping tags', (_lang, prompt) => {
            expect(prompt).not.toMatch(/\(Directives?\s+[PJ]\d+/);
        });

        it('Java prompt mandates PAssert.that(...) on every @Test method before p.run().waitUntilFinish()', () => {
            expect(JAVA_PROMPT).toContain('Every `@Test` method in `src/test/java/com/example/<PipelineName>Test.java` MUST validate output elements using `PAssert.that(...)` prior to calling `p.run().waitUntilFinish()`');
            expect(JAVA_PROMPT).toContain('never emit test methods that execute transforms without verifying the resulting `PCollection`');
        });

        it.each([
            ['Java', JAVA_PROMPT],
            ['Python', PYTHON_PROMPT],
        ])('%s prompt forbids YAML sequence syntax (- _TAG: ...) under substitutions in cloudbuild.yaml', (_lang, prompt) => {
            expect(prompt).toContain('NEVER use list/sequence syntax (`- _TAG: ...`) under `substitutions:`');
        });
    });

    describe('Dynamic Beam Version Resolution & File Deduplication', () => {
        it('parses latest Beam version from Apache Beam downloads HTML', () => {
            const sampleHtml = `
                <html><body>
                <h2>Latest Release</h2>
                <p><a href="/releases/javadoc/2.77.0/">2.77.0</a> (2026-10-01) - <a href="https://downloads.apache.org/beam/2.77.0/">Release Notes</a></p>
                <p>Previous: 2.76.0, 2.75.0</p>
                </body></html>
            `;
            expect(parseBeamVersionFromDownloadsHtml(sampleHtml)).toBe('2.77.0');
        });

        it('parses latest Beam version from PyPI JSON metadata', () => {
            const samplePypi = JSON.stringify({ info: { name: 'apache-beam', version: '2.78.0' } });
            expect(parseBeamVersionFromPypiJson(samplePypi)).toBe('2.78.0');
        });

        it('falls back to FALLBACK_BEAM_VERSION when network fetch fails', async () => {
            resetBeamVersionCacheForTesting();
            const failFetcher = async () => {
                throw new Error('Network offline');
            };
            const version = await getLatestBeamVersion(failFetcher);
            expect(version).toBe(FALLBACK_BEAM_VERSION);
            expect(getCachedBeamVersion()).toBe(FALLBACK_BEAM_VERSION);
        });

        it('replaces Beam version in assemblePrompt when a newer version is supplied', () => {
            const result = assemblePrompt({
                promptTemplate: 'beamVersion: {{beam_version}}, pin: 2.76.0, docker: {{dockerfile_template}}',
                language: 'python',
                pipelineYaml: 'nodes: []',
                dockerfileTemplate: 'FROM apache/beam_python3.11_sdk:2.76.0',
                directRunnerTemplate: '',
                dataflowRunnerTemplate: '',
                sparkRunnerTemplate: '',
                beamVersion: '2.79.0',
            });
            expect(result).toContain('beamVersion: 2.79.0');
            expect(result).toContain('pin: 2.79.0');
            expect(result).toContain('FROM apache/beam_python3.11_sdk:2.79.0');
        });

        it('does not rewrite version strings inside the user pipeline YAML (F7)', () => {
            const result = assemblePrompt({
                promptTemplate: 'v={{beam_version}} pin=2.76.0\n{{pipeline}}',
                language: 'python',
                pipelineYaml: 'note: "keep 2.76.0 and {{beam_version}} literally"',
                dockerfileTemplate: '',
                directRunnerTemplate: '',
                dataflowRunnerTemplate: '',
                sparkRunnerTemplate: '',
                beamVersion: '2.79.0',
            });
            expect(result).toContain('v=2.79.0 pin=2.79.0');
            expect(result).toContain('note: "keep 2.76.0 and {{beam_version}} literally"');
        });

        it('fallback version substitution also leaves the user pipeline YAML untouched', () => {
            const result = assemblePrompt({
                promptTemplate: 'v={{beam_version}}\n{{pipeline}}',
                language: 'python',
                pipelineYaml: 'note: "{{beam_version}}"',
                dockerfileTemplate: '',
                directRunnerTemplate: '',
                dataflowRunnerTemplate: '',
                sparkRunnerTemplate: '',
            });
            expect(result).toContain(`v=${FALLBACK_BEAM_VERSION}`);
            expect(result).toContain('note: "{{beam_version}}"');
        });

        it('deduplicateGeneratedFiles keeps the longest non-truncated entry per filename', () => {
            const rawFiles = [
                { filename: 'src/main/java/com/example/Pipe.java', content: 'package com.example;\npublic class Pipe {\n  public static void main(String[] args) {\n    System.out.println("complete");\n  }\n}\n' },
                { filename: 'pom.xml', content: '<project></project>' },
                { filename: 'src/main/java/com/example/Pipe.java', content: 'package com.example;\npublic class Pipe {\n  // truncated' },
            ];
            const deduped = deduplicateGeneratedFiles(rawFiles);
            expect(deduped).toHaveLength(2);
            expect(deduped[0].filename).toBe('src/main/java/com/example/Pipe.java');
            expect(deduped[0].content).toContain('System.out.println("complete");');
        });
    });
});




