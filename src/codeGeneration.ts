/**
 * Code generation module for Apache Beam pipelines using Gemini AI.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Refactor A3: Extracts the monolithic code-generation closure from extension.ts
 * into a modular, strategy-driven design.
 *
 * Encapsulates:
 * - Language-specific strategies (Python and Java)
 * - Pure prompt assembly with special-character protection
 * - End-to-end code generation pipeline with security controls (C1, C2, C3)
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as https from 'https';
import * as path from 'path';
import YAML from 'yaml';
import { GoogleGenAI } from '@google/genai';
import { DEFAULT_GEMINI_MODEL } from './constants';
import { getLatestBeamVersion, FALLBACK_BEAM_VERSION } from './beamVersion';
import { validateDagTopology } from './dagValidator';
import { resolveLanguageOrDefault } from './shared/language';
import { resolveOutputFolder } from './editor/outputFolder';
import type { TokenUsage } from './shared/types';
import type { HostToWebviewMessage } from './shared/protocol';

export type { TokenUsage };
import {
    redactPipelineYaml,
    buildRedactionPromptNotice,
} from './credentialRedaction';
import {
    resolveSafeOutputPath,
    isAllowedExecutableScript,
} from './security/scriptGuard';
import {
    executeScopedCleanup,
    writeGenerationManifest,
    resolvePipelineId,
    gateOutputFolder,
} from './generation/outputFolderGate';
import {
    getDefaultIgnoreFileContent,
    readResourceFile,
} from './resources/resourceLoader';
import { parseOrRepairJson } from './codegen/jsonRepair';
import { getGcloudProject } from './cli/gcloudClient';
import {
    StagedFile,
    stageFiles,
    commitStagedFiles,
    discardStagedFiles,
} from './generation/stagedWriter';

/**
 * Options for prompt template placeholder substitution.
 */
export interface PromptAssemblyOptions {
    /** Raw prompt template content containing {{...}} placeholders */
    promptTemplate: string;
    /** Target language name (e.g. 'python' or 'java') */
    language: string;
    /** Redacted pipeline YAML content */
    pipelineYaml: string;
    /** Dockerfile static template content */
    dockerfileTemplate: string;
    /** Direct runner script template content */
    directRunnerTemplate: string;
    /** Dataflow runner script template content */
    dataflowRunnerTemplate: string;
    /** Spark runner script template content (Java only, empty for Python) */
    sparkRunnerTemplate: string;
    /** Optional dynamically resolved Apache Beam SDK version */
    beamVersion?: string;
}

/**
 * Strategy interface capturing everything that differs between Python and Java
 * during code generation.
 */
export interface LanguageStrategy {
    /** Target language subfolder name under templates/ ('java' | 'python') */
    readonly langSubfolder: string;
    /** Prompt template resource filename */
    readonly promptFile: string;
    /** Relative path to the Spark runner template resource, or null if none */
    readonly sparkRunnerTemplatePath: string | null;
    /** Source file extension without leading dot ('py' | 'java') */
    readonly fileExt: string;
    /**
     * Checks if a generated candidate file should be skipped because it belongs to another language.
     *
     * @param fileNameOnly Basename of the generated file
     * @param normalizedFilename Full normalized relative path of the generated file
     * @returns True if the file should be skipped
     */
    isMismatchedArtifact(fileNameOnly: string, normalizedFilename: string): boolean;
    /**
     * Routes normalized relative filenames into project directory structure conventions.
     *
     * @param normalizedFilename Current normalized relative path
     * @param fileNameOnly Basename of the file
     * @param dirNameOnly Directory component of the file
     * @param baseName Pipeline base name
     * @returns Routed relative path
     */
    routeFilename(normalizedFilename: string, fileNameOnly: string, dirNameOnly: string, baseName: string): string;
    /**
     * Post-processes generated file content for language-specific module or package references.
     *
     * @param content Raw generated file content
     * @param baseName Pipeline base name
     * @returns Adjusted content
     */
    postProcessContent(content: string, baseName: string): string;
    /**
     * Determines whether a generated file qualifies as the primary pipeline source code.
     *
     * @param normalizedFilename Routed normalized relative path
     * @param baseName Pipeline base name
     * @param currentMain Existing main pipeline code already discovered, if any
     * @returns True if file content should become mainPipelineCode
     */
    isMainPipelineFile(normalizedFilename: string, baseName: string, currentMain: string): boolean;
    /**
     * Performs any language-specific post-generation filesystem operations.
     *
     * @param targetFolderPath Absolute destination directory path
     */
    postGeneration(targetFolderPath: string): Promise<void>;
}

/**
 * Python-specific code generation strategy implementation.
 */
export const PYTHON_STRATEGY: LanguageStrategy = {
    langSubfolder: 'python',
    promptFile: 'code-gen-prompt-python.txt',
    sparkRunnerTemplatePath: null,
    fileExt: 'py',

    isMismatchedArtifact(fileNameOnly: string, normalizedFilename: string): boolean {
        const lower = fileNameOnly.toLowerCase();
        return lower === 'pom.xml' || lower === 'run_sparkrunner.sh' || normalizedFilename.includes('target/');
    },

    routeFilename(normalizedFilename: string, fileNameOnly: string, dirNameOnly: string, baseName: string): string {
        const lowerName = fileNameOnly.toLowerCase();
        if (lowerName === 'pipeline.py' || lowerName === `${baseName.toLowerCase()}.py`) {
            return `src/${baseName}.py`;
        } else if (lowerName === 'pipeline_test.py' || lowerName === `${baseName.toLowerCase()}_test.py`) {
            return `src/${baseName}_test.py`;
        } else if (fileNameOnly.endsWith('.py')) {
            if (dirNameOnly === '.' || dirNameOnly === '') {
                return `src/${fileNameOnly}`;
            }
        }
        return normalizedFilename;
    },

    postProcessContent(content: string, baseName: string): string {
        // If the project language is Python and baseName is not 'pipeline', fix references to src.pipeline / pipeline in generated files
        if (baseName.toLowerCase() !== 'pipeline' && content) {
            return content
                .replace(/\bfrom\s+src\.pipeline\b/g, `from src.${baseName}`)
                .replace(/\bimport\s+src\.pipeline\b/g, `import src.${baseName}`)
                .replace(/\bfrom\s+pipeline\b/g, `from src.${baseName}`)
                .replace(/\bimport\s+pipeline\b/g, `import src.${baseName}`);
        }
        return content;
    },

    isMainPipelineFile(normalizedFilename: string, baseName: string, currentMain: string): boolean {
        const lowerNorm = normalizedFilename.toLowerCase();
        const lowerBase = path.basename(normalizedFilename).toLowerCase();
        if (lowerNorm.endsWith('.py') && !lowerNorm.includes('test') && !lowerBase.endsWith('__init__.py')) {
            return (
                lowerBase === `${baseName.toLowerCase()}.py` ||
                lowerBase === 'pipeline.py' ||
                normalizedFilename.startsWith('src/') ||
                !currentMain
            );
        }
        return false;
    },

    async postGeneration(targetFolderPath: string): Promise<void> {
        // Ensure src/__init__.py exists for Python projects so unittest recognizes src as a package
        const initPyPath = path.join(targetFolderPath, 'src', '__init__.py');
        // NOTE: inherently TOCTOU existence check
        const initPyExists = await fs.promises.stat(initPyPath).then(() => true).catch(() => false);
        if (!initPyExists) {
            const srcDir = path.dirname(initPyPath);
            await fs.promises.mkdir(srcDir, { recursive: true });
            await fs.promises.writeFile(initPyPath, '# Package init\n', 'utf-8');
        }
    }
};

/**
 * Java-specific code generation strategy implementation.
 */
export const JAVA_STRATEGY: LanguageStrategy = {
    langSubfolder: 'java',
    promptFile: 'code-gen-prompt-java.txt',
    sparkRunnerTemplatePath: path.join('templates', 'java', 'run_sparkrunner.sh'),
    fileExt: 'java',

    isMismatchedArtifact(fileNameOnly: string, _normalizedFilename: string): boolean {
        return fileNameOnly.toLowerCase() === 'requirements.txt';
    },

    routeFilename(normalizedFilename: string, fileNameOnly: string, _dirNameOnly: string, baseName: string): string {
        const pascalBaseName = baseName.charAt(0).toUpperCase() + baseName.slice(1);
        const lowerName = fileNameOnly.toLowerCase();
        if (lowerName === 'pipeline.java' || lowerName === `${baseName.toLowerCase()}.java` || lowerName === `${pascalBaseName.toLowerCase()}.java`) {
            return `src/main/java/com/example/${pascalBaseName}.java`;
        } else if (
            lowerName === 'pipelinetest.java' ||
            lowerName === 'pipeline_test.java' ||
            lowerName === `${baseName.toLowerCase()}test.java` ||
            lowerName === `${pascalBaseName.toLowerCase()}test.java`
        ) {
            return `src/test/java/com/example/${pascalBaseName}Test.java`;
        } else if (fileNameOnly.endsWith('.java')) {
            if (!normalizedFilename.startsWith('src/main/java/') && !normalizedFilename.startsWith('src/test/java/')) {
                return `src/main/java/com/example/${fileNameOnly}`;
            }
        }
        return normalizedFilename;
    },

    postProcessContent(content: string, _baseName: string): string {
        return content;
    },

    isMainPipelineFile(normalizedFilename: string, baseName: string, currentMain: string): boolean {
        const pascalBaseName = baseName.charAt(0).toUpperCase() + baseName.slice(1);
        const lowerNorm = normalizedFilename.toLowerCase();
        const lowerBase = path.basename(normalizedFilename).toLowerCase();
        if (lowerNorm.endsWith('.java') && !lowerNorm.includes('test')) {
            return (
                lowerBase === `${pascalBaseName.toLowerCase()}.java` ||
                lowerBase === `${baseName.toLowerCase()}.java` ||
                lowerBase === 'pipeline.java' ||
                normalizedFilename.startsWith('src/main/java/') ||
                !currentMain
            );
        }
        return false;
    },

    async postGeneration(_targetFolderPath: string): Promise<void> {
        // No-op for Java projects
    }
};

/**
 * Resolves the LanguageStrategy for the given language value.
 *
 * NOTE: Preserves existing selection logic:
 * `languageVal.toLowerCase() === 'java' ? 'java' : 'python'`
 * Anything that is not Java becomes Python (default fallback).
 *
 * @param languageVal Raw language string from user or webview
 * @returns LanguageStrategy for the selected language
 */
export function resolveLanguageStrategy(languageVal: string): LanguageStrategy {
    // Default fallback: anything that is not Java becomes Python.
    return resolveLanguageOrDefault(languageVal) === 'Java' ? JAVA_STRATEGY : PYTHON_STRATEGY;
}

/**
 * Deduplicates generated files by filename, preserving the entry with the longest content
 * when a model emits an incomplete file object followed by a complete retry for the same path.
 */
export function deduplicateGeneratedFiles<T extends { filename?: string; content?: string }>(files: T[]): T[] {
    if (!Array.isArray(files)) {
        return [];
    }
    const byName = new Map<string, T>();
    for (const file of files) {
        if (!file || !file.filename || typeof file.content !== 'string') {
            continue;
        }
        const existing = byName.get(file.filename);
        if (!existing || file.content.length >= (existing.content?.length || 0)) {
            byName.set(file.filename, file);
        }
    }
    return Array.from(byName.values());
}

/**
 * Pure prompt assembly: substitutes {{...}} template placeholders with values.
 *
 * NOTE: Uses replacer functions `() => value` for all substitutions.
 * This guarantees that special replacement patterns like `$&` and `$'` within the
 * pipeline YAML or script templates are treated as literal strings and not expanded
 * by String.prototype.replace.
 *
 * @param options Assembly options with templates and variable content
 * @returns Assembled prompt string
 */
export function assemblePrompt(options: PromptAssemblyOptions): string {
    const {
        promptTemplate,
        language,
        pipelineYaml,
        dockerfileTemplate,
        directRunnerTemplate,
        dataflowRunnerTemplate,
        sparkRunnerTemplate,
        beamVersion,
    } = options;

    // F7: resolve the Beam version in every template BEFORE the user's pipeline YAML is
    // inserted. Substituting afterwards also rewrote `{{beam_version}}` / `2.76.0` strings
    // that happened to appear inside user-authored node properties.
    const applyBeamVersion = (text: string): string => {
        if (beamVersion) {
            let out = text.replace(/\{\{beam_version\}\}/g, () => beamVersion);
            if (beamVersion !== FALLBACK_BEAM_VERSION) {
                out = out.replace(/2\.76\.0/g, () => beamVersion);
            }
            return out;
        }
        return text.replace(/\{\{beam_version\}\}/g, () => FALLBACK_BEAM_VERSION);
    };

    return applyBeamVersion(promptTemplate)
        .replace(/\{\{language\}\}/g, () => language)
        .replace('{{pipeline}}', () => pipelineYaml)
        .replace('{{dockerfile_template}}', () => applyBeamVersion(dockerfileTemplate))
        .replace('{{run_directrunner_template}}', () => applyBeamVersion(directRunnerTemplate))
        .replace('{{run_dataflowrunner_template}}', () => applyBeamVersion(dataflowRunnerTemplate))
        .replace('{{run_sparkrunner_template}}', () => applyBeamVersion(sparkRunnerTemplate));
}

/**
 * Parameters for the core code generation execution pipeline.
 */
export interface ExecuteCodeGenerationOptions {
    /** Output directory destination */
    targetFolderPath: string;
    /** Pipeline definition YAML */
    yamlData: string;
    /** Target language name */
    languageVal: string;
    /** Pipeline base name without extension */
    baseName: string;
    /** Pipeline stable identifier for manifest */
    generationPipelineId: string;
    /** Result of folder gating check */
    folderGate: { ownership: string; manifest: any; mayClean: boolean };
    /** Extension context for loading resources */
    context: vscode.ExtensionContext;
    /** Safe post-message callback to communicate with webview */
    postToWebview: (message: HostToWebviewMessage) => boolean | Promise<boolean>;
    /** Optional output channel for logging overwrites */
    outputChannel?: vscode.OutputChannel;
    /** Optional project ID resolution override */
    getGcloudProjectFn?: () => Promise<string | undefined>;
    /**
     * Optional signal that cancels the run (F1). Forwarded to the Gemini SDK and checked
     * again immediately before any file in the output folder is deleted or written.
     */
    abortSignal?: AbortSignal;
}

/** Filename of the per-generation request/response log written into the output folder. */
export const GEMINI_LOG_FILENAME = 'gemini.log';

/**
 * Raised internally when the user cancels a generation run.
 *
 * Distinguished from genuine failures so that cancellation produces no error toast and is
 * reported to the webview as `cancelled: true` rather than as an error.
 */
export class GenerationCancelledError extends Error {
    /** Creates the error with a fixed, user-presentable message. */
    constructor() {
        super('Code generation was cancelled.');
        this.name = 'GenerationCancelledError';
    }
}

/**
 * Throws {@link GenerationCancelledError} if the signal has been aborted.
 *
 * @param signal Optional cancellation signal.
 * @throws {GenerationCancelledError} When `signal.aborted` is true.
 */
function throwIfCancelled(signal?: AbortSignal): void {
    if (signal?.aborted) {
        throw new GenerationCancelledError();
    }
}

/**
 * Decides whether a caught error represents a user cancellation.
 *
 * NOTE: once the signal is aborted every subsequent failure is treated as a cancellation.
 * The SDK surfaces an aborted fetch as a generic `AbortError` (or occasionally as a
 * wrapped network error), and reporting either as a "Gemini error" after the user
 * pressed Stop would be misleading.
 *
 * @param err The caught error.
 * @param signal The run's cancellation signal, if any.
 * @returns True when the error should be reported as a cancellation.
 */
function isCancellation(err: unknown, signal?: AbortSignal): boolean {
    if (err instanceof GenerationCancelledError) {
        return true;
    }
    if (err && typeof err === 'object' && (err as { name?: unknown }).name === 'AbortError') {
        return true;
    }
    return signal?.aborted === true;
}

/**
 * Writes a log file readable only by the current user (S6).
 *
 * `gemini.log` contains the full prompt (the redacted pipeline) and the raw model response,
 * so it is created with mode 0o600. `writeFile`'s `mode` only applies when the file is
 * created, so any previous log is removed first rather than chmod'ed -- chmod calls are
 * reserved for the C1 executable allowlist and policed by security-wiring.test.ts.
 *
 * @param filePath Absolute path of the log file.
 * @param content Serialized log content.
 */
async function writePrivateLog(filePath: string, content: string): Promise<void> {
    await fs.promises.rm(filePath, { force: true });
    await fs.promises.writeFile(filePath, content, { encoding: 'utf-8', mode: 0o600 });
}

/**
 * Creates a `.gitignore` excluding `gemini.log` in the output folder when none exists (S6).
 *
 * An existing `.gitignore` is never modified -- it belongs to the user.
 *
 * @param targetFolderPath Output folder of the generated project.
 */
async function ensureGitignoreExcludesLog(targetFolderPath: string): Promise<void> {
    const gitignorePath = path.join(targetFolderPath, '.gitignore');
    // NOTE: inherently TOCTOU existence check; the 'wx' flag makes creation atomic anyway.
    try {
        await fs.promises.writeFile(gitignorePath, `${GEMINI_LOG_FILENAME}\n`, { encoding: 'utf-8', flag: 'wx' });
    } catch {
        // File already exists (EEXIST) or folder is not writable -- leave it alone.
    }
}

/**
 * Ensures the Node.js global HTTPS agent uses the system CA bundle (`/etc/ssl/cert.pem`)
 * when `NODE_EXTRA_CA_CERTS` is not set.
 *
 * Prevents `unable to get issuer certificate` errors when `google-auth-library` and
 * Vertex AI exchange OAuth2 tokens (`https://oauth2.googleapis.com/token`) inside a
 * VS Code Extension Host launched from the GUI without `--use-system-ca`.
 *
 * @param certPath Optional path to the system CA bundle (defaults to `/etc/ssl/cert.pem`).
 */
export function ensureSystemCaBundle(certPath = '/etc/ssl/cert.pem'): void {
    if (!process.env.NODE_EXTRA_CA_CERTS && fs.existsSync(certPath)) {
        https.globalAgent.options.ca = fs.readFileSync(certPath);
    }
}

/**
 * Executes the full code generation pipeline:
 * 1. Redacts sensitive credentials from the pipeline (C2)
 * 2. Assembles prompt with templates and sentinel instructions
 * 3. Calls Gemini API with structured JSON output schema
 * 4. Logs request/response to gemini.log
 * 5. Parses and repairs JSON response
 * 6. Executes scoped cleanup on managed output folders (C3)
 * 7. Writes files strictly within safe boundaries
 * 8. Applies chmod 755 only to allowlisted executable scripts (C1)
 * 9. Writes generation manifest for lifecycle ownership
 *
 * @param options Execution parameters
 */
export async function executeCodeGeneration(options: ExecuteCodeGenerationOptions): Promise<void> {
    const {
        targetFolderPath,
        yamlData,
        languageVal,
        baseName,
        generationPipelineId,
        folderGate,
        context,
        postToWebview,
        outputChannel,
        getGcloudProjectFn,
        abortSignal,
    } = options;

    let promptText = '';
    try {
        ensureSystemCaBundle();

        const resolveProject = getGcloudProjectFn || getGcloudProject;
        const gcloudProjectId = await resolveProject();
        const beamVersion = await getLatestBeamVersion();

        const aiOptions: any = {};
        if (gcloudProjectId) {
            aiOptions.vertexai = true;
            aiOptions.project = gcloudProjectId;
            aiOptions.location = 'global';
        }

        const ai = new GoogleGenAI(aiOptions);

        // Determine target language strategy
        const strategy = resolveLanguageStrategy(languageVal);
        const promptFile = strategy.promptFile;
        const promptTemplate = readResourceFile(context, promptFile);

        // Load static file templates for Dockerfile and runner scripts
        const dockerfileTemplate = readResourceFile(context, path.join('templates', strategy.langSubfolder, 'Dockerfile'));
        const directRunnerTemplate = readResourceFile(context, path.join('templates', strategy.langSubfolder, 'run_directrunner.sh'));
        const dataflowRunnerTemplate = readResourceFile(context, path.join('templates', strategy.langSubfolder, 'run_dataflowrunner.sh'));

        let sparkRunnerTemplate = '';
        if (strategy.sparkRunnerTemplatePath) {
            sparkRunnerTemplate = readResourceFile(context, strategy.sparkRunnerTemplatePath);
        }

        // C2: Strip plaintext credentials out of the pipeline before it leaves the
        // machine. This is the single chokepoint for both outbound paths -- the
        // Gemini API call below and the gemini.log written from promptText -- so
        // redacting here covers both. Throws on unparseable YAML rather than
        // falling back to the raw text; see src/credentialRedaction.ts.
        const { value: redactedYaml, redactedPaths } = redactPipelineYaml(yamlData);
        if (redactedPaths.length > 0) {
            console.warn(
                `Redacted ${redactedPaths.length} credential value(s) before code generation: ${redactedPaths.join(', ')}`
            );
        }

        // Substitute placeholders, pipeline definitions, and templates into final prompt text.
        // NOTE: the pipeline is inserted via a replacer function so that any `$&`/`$'`
        // sequence inside the user's YAML is treated as literal text rather than as a
        // String.replace substitution pattern.
        promptText = assemblePrompt({
            promptTemplate,
            language: languageVal,
            pipelineYaml: redactedYaml,
            dockerfileTemplate,
            directRunnerTemplate,
            dataflowRunnerTemplate,
            sparkRunnerTemplate,
            beamVersion,
        });

        // Tell the model the placeholder is inert and must become an env-var read,
        // otherwise it faithfully embeds the sentinel as a string literal.
        promptText += buildRedactionPromptNotice(redactedPaths);

        const responseSchema = JSON.parse(readResourceFile(context, 'code-gen-schema.json'));

        const response = await ai.models.generateContent({
            model: DEFAULT_GEMINI_MODEL,
            contents: promptText,
            config: {
                responseMimeType: 'application/json',
                responseSchema: responseSchema,
                maxOutputTokens: 65536,
                abortSignal,
            },
        });

        const finishReason = response.candidates?.[0]?.finishReason;
        if (finishReason === 'MAX_TOKENS') {
            console.warn('[codeGeneration] Warning: Gemini generation reached MAX_TOKENS limit (65536).');
            outputChannel?.appendLine('[generation] Warning: Gemini response hit MAX_TOKENS limit.');
        }

        // Log successful request and usage data to gemini.log
        try {
            const logFilePath = path.join(targetFolderPath, GEMINI_LOG_FILENAME);
            const logData = {
                timestamp: new Date().toISOString(),
                model: DEFAULT_GEMINI_MODEL,
                prompt: promptText,
                responseSchema: responseSchema,
                tokenUsage: response.usageMetadata ? {
                    inputTokens: response.usageMetadata.promptTokenCount,
                    outputTokens: response.usageMetadata.candidatesTokenCount,
                    totalTokens: (response.usageMetadata.promptTokenCount || 0) + (response.usageMetadata.candidatesTokenCount || 0),
                } : 'Unavailable',
                rawResponse: response.text,
            };
            await writePrivateLog(logFilePath, JSON.stringify(logData, null, 2));
        } catch (logErr) {
            console.error('Failed to write request log to gemini.log', logErr);
        }

        // F1: AbortSignal is client-side only, so a request the user stopped can still
        // resolve. This is the last point before anything in the output folder is deleted or
        // written; past it the run commits, because stopping halfway through the write loop
        // would leave a mix of old and new files.
        throwIfCancelled(abortSignal);

        if (!response.text) {
            throw new Error('Empty response from Gemini model.');
        }
        const responseObj = parseOrRepairJson(response.text);

        let mainPipelineCode = '';
        const fileExt = strategy.fileExt;

        // Records every file written this run so the manifest can describe
        // exactly what we own, with hashes to detect later hand-edits.
        // Declared out here because the manifest is stamped after the payload
        // branch closes.
        const writtenForManifest: Array<{ path: string; content: string }> = [];

        if (responseObj.files && Array.isArray(responseObj.files)) {
            responseObj.files = deduplicateGeneratedFiles(responseObj.files);

            // F7 phase 1: resolve every destination and its final content in memory.
            // Nothing on disk changes until the whole payload has been validated.
            const plannedRaw: Array<StagedFile & { normalizedFilename: string; executableRequested: boolean; originalFilename: string }> = [];
            for (const file of responseObj.files) {
                if (!file.filename || file.content === undefined) {
                    continue;
                }

                // Normalize standard names to match diagrams and directory structure
                let normalizedFilename = file.filename;

                // Strip redundant top-level folder matching baseName if model included it (e.g. "foobar/Dockerfile" -> "Dockerfile")
                if (normalizedFilename.startsWith(`${baseName}/`)) {
                    normalizedFilename = normalizedFilename.substring(baseName.length + 1);
                }
                // Validate candidate filename against target directory containment before processing
                if (!resolveSafeOutputPath(targetFolderPath, normalizedFilename)) {
                    console.error(`[regenerateCode] Rejected out-of-bounds file: ${file.filename}`);
                    continue;
                }

                const fileNameOnly = path.basename(normalizedFilename);
                const dirNameOnly = path.dirname(normalizedFilename);

                // Filter out files mismatched with target language
                if (strategy.isMismatchedArtifact(fileNameOnly, normalizedFilename)) {
                    console.log(`[regenerateCode] Skipping artifact '${normalizedFilename}' for ${strategy.langSubfolder} project.`);
                    continue;
                }

                // Route pipeline code and test files to appropriate subfolders
                normalizedFilename = strategy.routeFilename(normalizedFilename, fileNameOnly, dirNameOnly, baseName);

                let fileContent = file.content;
                // Language-specific post-processing of file content
                fileContent = strategy.postProcessContent(fileContent, baseName);

                // Strictly verify path containment before writing to disk
                const filePath = resolveSafeOutputPath(targetFolderPath, normalizedFilename);
                if (!filePath) {
                    console.error(`[regenerateCode] Rejected out-of-bounds file: ${file.filename}`);
                    continue;
                }

                plannedRaw.push({
                    filePath,
                    content: fileContent,
                    normalizedFilename,
                    executableRequested: Boolean(file.executable),
                    originalFilename: file.filename,
                });
            }

            // F7 phase 2: stage every file beside its destination. stageFiles rolls back its
            // own partial output on failure, so an error here leaves the folder exactly as
            // it was before this run (old generated files included).
            // Two model entries can route to the same destination; the old sequential
            // writes let the last one win, so collapse to the last entry per path here --
            // staging or renaming the same path twice would fail mid-commit.
            const planned = [...new Map(plannedRaw.map(p => [p.filePath, p])).values()];
            await stageFiles(planned);

            try {
                // C3 layer 1: only now, with a validated payload in memory, is it
                // safe to delete. Scoped by the manifest -- never "everything in
                // the directory" -- so unknown user files survive by default.
                if (folderGate.mayClean && folderGate.manifest) {
                    const cleanup = executeScopedCleanup(
                        targetFolderPath,
                        folderGate.manifest,
                        languageVal
                    );
                    if (cleanup.modifiedFiles.length > 0) {
                        // Overwriting hand-edited generated files is documented
                        // behaviour, but list them so the user can recover from git.
                        outputChannel?.appendLine(
                            `[generation] Overwriting ${cleanup.modifiedFiles.length} generated file(s) you had edited: ${cleanup.modifiedFiles.join(', ')}`
                        );
                    }
                }

                // F7 phase 3: commit staged files with same-directory renames.
                await commitStagedFiles(planned);
            } catch (commitErr) {
                await discardStagedFiles(planned);
                throw commitErr;
            }

            for (const entry of planned) {
                const filePath = entry.filePath;
                // Record what we wrote, relative to the output folder and with
                // POSIX separators, so the manifest is portable and the hash
                // reflects the exact bytes on disk.
                writtenForManifest.push({
                    path: path.relative(targetFolderPath, filePath).split(path.sep).join('/'),
                    content: entry.content,
                });

                // Gate chmod 755 to allowlisted scripts rather than trusting model-controlled file.executable
                if (isAllowedExecutableScript(filePath)) {
                    try {
                        await fs.promises.chmod(filePath, '755');
                    } catch (e) {
                        console.error(`Failed to set executable permission on ${filePath}`, e);
                    }
                } else if (entry.executableRequested) {
                    console.warn(`[regenerateCode] Refusing chmod 755 on unapproved executable: ${entry.originalFilename}`);
                }

                if (strategy.isMainPipelineFile(entry.normalizedFilename, baseName, mainPipelineCode)) {
                    mainPipelineCode = entry.content;
                }
            }
        } else {
            throw new Error("Invalid response format from Gemini: 'files' array is missing.");
        }

        // Default code if the main pipeline file wasn't found in the generated list
        if (!mainPipelineCode && responseObj.files.length > 0) {
            const codeFile = responseObj.files.find((f: any) =>
                f.filename && f.filename.endsWith(`.${fileExt}`) && !f.filename.toLowerCase().includes('test')
            ) || responseObj.files.find((f: any) => f.filename && f.filename.endsWith(`.${fileExt}`));
            if (codeFile) {
                mainPipelineCode = codeFile.content;
            } else {
                mainPipelineCode = responseObj.files[0].content;
            }
        }

        // Language-specific post-generation setup (e.g. creating __init__.py for Python)
        await strategy.postGeneration(targetFolderPath);

        // Write default ignore files if not present in generated files
        const dockerIgnorePath = path.join(targetFolderPath, '.dockerignore');
        // NOTE: inherently TOCTOU existence check
        const dockerIgnoreExists = await fs.promises.stat(dockerIgnorePath).then(() => true).catch(() => false);
        if (!dockerIgnoreExists) {
            await fs.promises.writeFile(dockerIgnorePath, getDefaultIgnoreFileContent(), 'utf-8');
        }
        const gcloudIgnorePath = path.join(targetFolderPath, '.gcloudignore');
        // NOTE: inherently TOCTOU existence check
        const gcloudIgnoreExists = await fs.promises.stat(gcloudIgnorePath).then(() => true).catch(() => false);
        if (!gcloudIgnoreExists) {
            await fs.promises.writeFile(gcloudIgnorePath, getDefaultIgnoreFileContent(), 'utf-8');
        }
        // S6: keep the prompt/response log out of version control by default.
        await ensureGitignoreExcludesLog(targetFolderPath);

        // C3 layer 2: stamp the ownership marker. This is what lets the *next*
        // generation recognise the folder as ours and clean it safely. Without
        // it the next run classifies the folder as unowned and prompts, which
        // is the intended fail-safe direction.
        writeGenerationManifest(
            targetFolderPath,
            generationPipelineId,
            languageVal,
            writtenForManifest
        );

        vscode.window.showInformationMessage('Code files generated successfully by Gemini!');

        await postToWebview({
            command: 'codeRegenerated',
            success: true,
            code: mainPipelineCode,
            tokenUsage: response.usageMetadata ? {
                inputTokens: response.usageMetadata.promptTokenCount ?? 0,
                outputTokens: response.usageMetadata.candidatesTokenCount ?? 0,
                totalTokens: (response.usageMetadata.promptTokenCount || 0) + (response.usageMetadata.candidatesTokenCount || 0),
            } : undefined,
        });

    } catch (err: any) {
        const cancelled = isCancellation(err, abortSignal);
        // Record the failure or cancellation in gemini.log
        try {
            const logFilePath = path.join(targetFolderPath, GEMINI_LOG_FILENAME);
            const logData = {
                timestamp: new Date().toISOString(),
                model: DEFAULT_GEMINI_MODEL,
                prompt: promptText,
                error: cancelled ? 'Cancelled by user.' : err.message,
                stack: cancelled ? undefined : err.stack,
            };
            await writePrivateLog(logFilePath, JSON.stringify(logData, null, 2));
        } catch (logErr) {
            console.error('Failed to write failure details to gemini.log', logErr);
        }

        if (cancelled) {
            // No error toast because the user asked for this. The webview normally resets on
            // 'codeGenerationStopped' first; this message is the authoritative end of the run.
            outputChannel?.appendLine('[generation] Code generation cancelled; no generated files were written.');
            await postToWebview({ command: 'codeRegenerated', success: false, cancelled: true, error: 'Generation cancelled.' });
            return;
        }

        vscode.window.showErrorMessage(`Gemini Code Generation Error: ${err.message}`);
        await postToWebview({ command: 'codeRegenerated', success: false, error: err.message });
    }
}

/**
 * Options passed to the handleRegenerateCode message handler.
 */
export interface HandleRegenerateCodeOptions {
    /** Inbound webview message */
    message: any;
    /** Extension context */
    context: vscode.ExtensionContext;
    /** Active document, if available */
    document?: vscode.TextDocument;
    /** URI of the pipeline file, if available */
    uri?: vscode.Uri;
    /** Guarded post-message callback to webview (M5) */
    postToWebview: (message: HostToWebviewMessage) => boolean | Promise<boolean>;
    /** Optional extension output channel */
    outputChannel?: vscode.OutputChannel;
    /** Optional gcloud project resolution override */
    getGcloudProjectFn?: () => Promise<string | undefined>;
    /** Optional cancellation signal owned by the caller's editor session (F1). */
    abortSignal?: AbortSignal;
}

/**
 * Top-level handler for the 'regenerateCode' webview message command.
 *
 * Resolves destination paths, validates folder ownership, displays progress,
 * and delegates to executeCodeGeneration. The run is cancelled when either the caller's
 * `abortSignal` fires (webview Stop button) or the user cancels the progress notification.
 *
 * @param options Handler parameters
 */
export async function handleRegenerateCode(options: HandleRegenerateCodeOptions): Promise<void> {
    const { message, context, document, uri, postToWebview, outputChannel, getGcloudProjectFn, abortSignal } = options;
    const yamlData = message.data;

    // Headless pre-flight validation: reject code generation if the pipeline DAG has cycles or invalid topology
    if (yamlData) {
        try {
            const parsed = YAML.parse(yamlData);
            if (parsed && (Array.isArray(parsed.nodes) || Array.isArray(parsed.edges))) {
                const validation = validateDagTopology(parsed.nodes || [], parsed.edges || []);
                if (!validation.isValid) {
                    const errorMsg = validation.errors.join('; ');
                    vscode.window.showErrorMessage(`Cannot generate code: ${errorMsg}`);
                    await postToWebview({
                        command: 'codeRegenerated',
                        success: false,
                        error: errorMsg,
                    });
                    return;
                }
            }
        } catch {
            // Ignore parse errors here and allow downstream handlers to deal with malformed YAML
        }
    }

    const filenameVal = message.filename;
    const languageVal = message.language;
    const outputFolderVal = message.outputFolder;
    const targetActiveUri = document ? document.uri : uri;

    const targetFolderPath = resolveOutputFolder(
        targetActiveUri?.fsPath,
        outputFolderVal,
        vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
    );

    if (!targetFolderPath) {
        vscode.window.showErrorMessage('Could not determine output folder.');
        await postToWebview({ command: 'codeRegenerated', success: false, error: 'Could not determine output folder.' });
        return;
    }

    try {
        await fs.promises.mkdir(targetFolderPath, { recursive: true });
    } catch (e: any) {
        vscode.window.showErrorMessage(`Failed to create directory: ${targetFolderPath}`);
        await postToWebview({ command: 'codeRegenerated', success: false, error: `Failed to create directory: ${targetFolderPath}. ${e.message}` });
        return;
    }

    // NOTE: a missing filename used to throw a TypeError here, outside any try block,
    // surfacing as an unhandled rejection. Fall back to the output folder's name.
    const baseName = (typeof filenameVal === 'string' && filenameVal
        ? filenameVal
        : path.basename(targetFolderPath)
    ).replace(/\.beam$/, '');

    // C3: the folder is NOT cleaned here. Deleting before the model call meant a
    // timeout, rate-limit or unparseable response left the user with nothing.
    // We only establish *whether* we are allowed to clean, prompting when the
    // folder is not demonstrably ours; the deletion itself happens after a
    // validated payload is in memory.
    const generationPipelineId = resolvePipelineId(
        message.pipelineConfig,
        (document ? document.uri : uri)?.fsPath || targetFolderPath
    );
    const folderGate = await gateOutputFolder(targetFolderPath, generationPipelineId);
    if (!folderGate) {
        await postToWebview({ command: 'codeRegenerated', success: false, error: 'Generation cancelled.' });
        return;
    }

    // NOTE: the resolved language is surfaced in the progress title and the output channel.
    // A wrong-language generation is destructive -- it overwrites the previous project's
    // build files -- so the language in effect must be visible BEFORE the model is called,
    // not inferred afterwards from whatever landed on disk.
    const resolvedLanguage = resolveLanguageStrategy(languageVal).langSubfolder === 'java' ? 'Java' : 'Python';
    outputChannel?.appendLine(
        `[codegen] target language: ${resolvedLanguage} (requested: ${JSON.stringify(languageVal)}) -> ${targetFolderPath}`
    );

    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Generating ${resolvedLanguage} code using Gemini...`,
        cancellable: true,
    }, async (_progress, token) => {
        // Merge the two cancellation sources (webview Stop button and the notification's
        // Cancel button) into one AbortSignal for the SDK and the pre-write gate.
        const controller = new AbortController();
        const abort = () => controller.abort();
        if (abortSignal?.aborted) {
            abort();
        }
        abortSignal?.addEventListener('abort', abort, { once: true });
        const tokenSubscription = token?.onCancellationRequested?.(abort);
        try {
            await executeCodeGeneration({
                targetFolderPath,
                yamlData,
                languageVal,
                baseName,
                generationPipelineId,
                folderGate,
                context,
                postToWebview,
                outputChannel,
                getGcloudProjectFn,
                abortSignal: controller.signal,
            });
        } finally {
            abortSignal?.removeEventListener('abort', abort);
            tokenSubscription?.dispose();
        }
    });
}
