/**
 * Integration Test Runner and Multi-Agent Evaluation Harness for Apache Beam Codegen.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Coordinates live end-to-end integration tests by generating complete Apache Beam
 * pipelines using Gemini 3.7 Flash and evaluating the output using a multi-agent
 * evaluation harness (Deterministic Gate, BeamArchitectureAgent, SecurityAndHardeningAgent,
 * PackagingAndDeployabilityAgent, PipelineSpecificationAgent, and Lead Arbiter).
 *
 * Architectural decisions:
 * - Dynamically synchronizes pipelineConfig.language in the YAML specification to match
 *   the target generation language, eliminating language-mismatch cross-talk between tests.
 * - Replaces monolithic evaluation prompt with multi-agent specialist hierarchy.
 * - Emits actionable Prompt Remediation Directives targeting code-gen-prompt-python.txt
 *   and code-gen-prompt-java.txt when tests fail, rather than patching generated test code.
 */

import * as fs from 'fs';
import * as path from 'path';
import { execFile } from 'child_process';
import * as yaml from 'yaml';
import { GoogleGenAI } from '@google/genai';
import { DEFAULT_GEMINI_MODEL } from '../../constants';
import { runMultiAgentEvaluation, formatEvaluationReport } from './evaluators/multi-agent-evaluator';
import { MultiAgentEvaluationResult, generateContentWithRetry } from './evaluators/types';
import { recordAndSaveTestReport } from './test-reporter';

export interface GeneratedFile {
    filename: string;
    content: string;
    executable?: boolean;
}

export interface EvaluationResult {
    isGood: boolean;
    issues: string[];
    explanation: string;
    multiAgentResult?: MultiAgentEvaluationResult;
}

export interface PipelineTestConfig {
    testName: string;
    beamContent?: string;
    yamlContent?: string;
    languages?: ('Java' | 'Python')[];
}

function findFileRecursive(dir: string, filename: string): string | null {
    if (!fs.existsSync(dir)) return null;
    try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                const found = findFileRecursive(full, filename);
                if (found) return found;
            } else if (entry.isFile() && entry.name === filename) {
                return full;
            }
        }
    } catch {
        // Ignore read errors
    }
    return null;
}

/**
 * Loads a .beam pipeline definition file from disk given a relative or absolute path.
 */
export function loadBeamPipeline(filePath: string): string {
    const candidatePaths = [
        filePath,
        path.isAbsolute(filePath) ? filePath : path.join(__dirname, filePath),
        path.join(__dirname, filePath.endsWith('.beam') ? filePath : `${filePath}.beam`),
        path.join(process.cwd(), 'src', 'integration', filePath),
        path.join(process.cwd(), 'src', 'integration', filePath.endsWith('.beam') ? filePath : `${filePath}.beam`),
        path.join(process.cwd(), 'src', 'test', 'integration', filePath),
        path.join(process.cwd(), 'src', 'test', 'integration', filePath.endsWith('.beam') ? filePath : `${filePath}.beam`)
    ];

    for (const p of candidatePaths) {
        if (fs.existsSync(p) && fs.statSync(p).isFile()) {
            return fs.readFileSync(p, 'utf-8');
        }
    }

    const filename = path.basename(filePath).endsWith('.beam') ? path.basename(filePath) : `${path.basename(filePath)}.beam`;
    for (const searchRoot of [path.join(process.cwd(), 'src', 'integration'), path.join(process.cwd(), 'src', 'test', 'integration')]) {
        const found = findFileRecursive(searchRoot, filename);
        if (found) {
            return fs.readFileSync(found, 'utf-8');
        }
    }

    throw new Error(`Could not locate .beam pipeline file: ${filePath}`);
}

export function getGcloudProject(): Promise<string | undefined> {
    return new Promise((resolve) => {
        execFile('gcloud', ['config', 'get-value', 'project'], { timeout: 5000 }, (error, stdout) => {
            if (error || !stdout) {
                resolve(undefined);
            } else {
                resolve(stdout.trim() || undefined);
            }
        });
    });
}

export function getResourcesRoot(): string {
    const candidatePaths = [
        path.join(__dirname, '..', '..', 'resources'),
        path.join(__dirname, '..', '..', '..', 'resources'),
        path.join(process.cwd(), 'resources')
    ];
    for (const p of candidatePaths) {
        if (fs.existsSync(p)) {
            return p;
        }
    }
    throw new Error('Could not locate resources directory');
}

export function readResource(filePath: string): string {
    const resourcesRoot = getResourcesRoot();
    const fullPath = path.join(resourcesRoot, filePath);
    return fs.readFileSync(fullPath, 'utf-8');
}

/**
 * Synchronizes the pipelineConfig.language property in the pipeline YAML
 * to match the target test language.
 *
 * @param yamlContent - Original YAML content.
 * @param targetLanguage - Target language ('Java' | 'Python').
 * @returns Synchronized YAML content string.
 */
export function synchronizePipelineLanguage(yamlContent: string, targetLanguage: 'Java' | 'Python'): string {
    if (!yamlContent) return yamlContent;
    try {
        const parsed = yaml.parse(yamlContent);
        if (parsed && typeof parsed === 'object') {
            if (!parsed.pipelineConfig) {
                parsed.pipelineConfig = {};
            }
            parsed.pipelineConfig.language = targetLanguage;
            return yaml.stringify(parsed);
        }
    } catch {
        return yamlContent.replace(/(language:\s*)[A-Za-z]+/g, `$1${targetLanguage}`);
    }
    return yamlContent;
}

/**
 * Builds the exact same prompt used by the extension for a given language and pipeline YAML.
 */
export function buildCodeGenPrompt(language: 'Java' | 'Python', yamlData: string): string {
    const langSubfolder = language.toLowerCase() === 'java' ? 'java' : 'python';
    const promptFile = langSubfolder === 'java' ? 'code-gen-prompt-java.txt' : 'code-gen-prompt-python.txt';
    const promptTemplate = readResource(promptFile);

    const dockerfileTemplate = readResource(path.join('templates', langSubfolder, 'Dockerfile'));
    const directRunnerTemplate = readResource(path.join('templates', langSubfolder, 'run_directrunner.sh'));
    const dataflowRunnerTemplate = readResource(path.join('templates', langSubfolder, 'run_dataflowrunner.sh'));

    let sparkRunnerSection = '';
    if (langSubfolder === 'java') {
        const sparkRunnerTemplate = readResource(path.join('templates', 'java', 'run_sparkrunner.sh'));
        sparkRunnerSection = `### 'run_sparkrunner.sh' Template\n\`\`\`\n${sparkRunnerTemplate}\n\`\`\``;
    }

    return promptTemplate
        .replace(/\{\{language\}\}/g, language)
        .replace('{{pipeline}}', yamlData)
        .replace('{{dockerfile_template}}', dockerfileTemplate)
        .replace('{{run_directrunner_template}}', directRunnerTemplate)
        .replace('{{run_dataflowrunner_template}}', dataflowRunnerTemplate)
        .replace('{{sparkrunner_template_section}}', sparkRunnerSection);
}

/**
 * Evaluates generated code using the Multi-Agent Evaluation Harness.
 *
 * @param ai - Initialized GoogleGenAI client.
 * @param codeGenPrompt - Full prompt template string.
 * @param files - Array of generated files.
 * @param language - Target language ('Java' | 'Python').
 * @param yamlContent - Original pipeline YAML.
 * @returns EvaluationResult with detailed scorecard and prompt directives.
 */
export async function evaluateGeneratedCode(
    ai: GoogleGenAI,
    codeGenPrompt: string,
    files: GeneratedFile[],
    language: 'Java' | 'Python' = 'Python',
    yamlContent = ''
): Promise<EvaluationResult> {
    const multiAgentResult = await runMultiAgentEvaluation(
        ai,
        language,
        yamlContent,
        codeGenPrompt,
        files
    );

    const report = formatEvaluationReport(multiAgentResult, language);
    console.log(report);

    return {
        isGood: multiAgentResult.isGood,
        issues: multiAgentResult.allFindings.map(
            f => `[${f.category}] ${f.severity}: ${f.description} (${f.file})`
        ),
        explanation: multiAgentResult.explanation,
        multiAgentResult
    };
}

/**
 * Initializes GoogleGenAI client with Vertex AI / active gcloud project.
 */
export async function createGeminiClient(): Promise<GoogleGenAI> {
    const projectId = (await getGcloudProject()) || process.env.GOOGLE_CLOUD_PROJECT || process.env.PROJECT_ID;
    const aiOptions: any = {};
    if (projectId) {
        aiOptions.vertexai = true;
        aiOptions.project = projectId;
        aiOptions.location = 'global';
    }
    return new GoogleGenAI(aiOptions);
}

/**
 * Executes an end-to-end code generation and validation test for a pipeline YAML across specified languages.
 */
export async function runPipelineIntegrationTest(config: PipelineTestConfig): Promise<{ [key: string]: boolean }> {
    const languages = config.languages || ['Java', 'Python'];
    const ai = await createGeminiClient();
    const results: { [key: string]: boolean } = {};

    console.log(`\n======================================================`);
    console.log(`🧪 Running Pipeline Integration Test: ${config.testName}`);
    console.log(`🤖 Using Gemini Model: ${DEFAULT_GEMINI_MODEL}`);
    console.log(`======================================================`);

    for (const language of languages) {
        console.log(`\n------------------------------------------------------`);
        console.log(`▶ Testing ${language} Pipeline Code Generation`);
        console.log(`------------------------------------------------------`);

        try {
            const rawContent = config.beamContent || config.yamlContent;
            if (!rawContent) {
                throw new Error(`Pipeline content is required (provide beamContent or yamlContent) for ${config.testName}`);
            }

            // Synchronize pipeline language with current target language
            const pipelineContent = synchronizePipelineLanguage(rawContent, language);
            const prompt = buildCodeGenPrompt(language, pipelineContent);
            const responseSchema = JSON.parse(readResource('code-gen-schema.json'));

            console.log(`1. Generating ${language} code via Gemini (${DEFAULT_GEMINI_MODEL})...`);
            const startTime = Date.now();
            const response = await generateContentWithRetry(ai, {
                model: DEFAULT_GEMINI_MODEL,
                contents: prompt,
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: responseSchema
                }
            });
            console.log(`   Generated in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);

            if (!response.text) {
                throw new Error(`Empty response received from Gemini during ${language} generation`);
            }

            const parsed = JSON.parse(response.text);
            const files: GeneratedFile[] = parsed.files || [];
            console.log(`   Generated ${files.length} files:`, files.map(f => f.filename).join(', '));

            const fileExt = language.toLowerCase() === 'python' ? '.py' : '.java';
            const mainFile = files.find(f => f.filename.endsWith(fileExt) && !f.filename.includes('test') && !f.filename.endsWith('__init__.py'));

            if (mainFile) {
                console.log(`\n📄 Generated Main File (${mainFile.filename}):\n`);
            }

            console.log(`\n2. Evaluating generated ${language} code via Multi-Agent Evaluation Harness...`);
            const evalResult = await evaluateGeneratedCode(ai, prompt, files, language, pipelineContent);

            console.log(`\n📋 Review Results for ${language}:`);
            console.log(`   Status: ${evalResult.isGood ? '✅ PASS' : '❌ FAIL'}`);
            console.log(`   Explanation: ${evalResult.explanation}`);
            if (evalResult.issues.length > 0) {
                console.log(`   Issues Reported:`);
                evalResult.issues.forEach((issue, idx) => console.log(`     ${idx + 1}. ${issue}`));
            }

            // Persist evaluation findings, scorecards, and prompt directives to test-report.md
            const reportPath = recordAndSaveTestReport({
                testName: config.testName,
                language: language,
                timestamp: new Date().toISOString(),
                passed: evalResult.isGood,
                durationMs: Date.now() - startTime,
                scorecard: evalResult.multiAgentResult?.scorecard,
                hardVetoTriggered: evalResult.multiAgentResult?.hardVetoTriggered,
                hardVetoReasons: evalResult.multiAgentResult?.hardVetoReasons,
                explanation: evalResult.explanation,
                findings: evalResult.multiAgentResult?.confirmedFindings || evalResult.multiAgentResult?.allFindings || [],
                promptRemediationDirectives: evalResult.multiAgentResult?.promptRemediationDirectives || [],
                generatedFiles: files.map(f => ({
                    filename: f.filename,
                    lines: f.content.split('\n').length
                }))
            });
            console.log(`\n📄 Test report updated: ${reportPath}`);

            results[language] = evalResult.isGood;
        } catch (err: any) {
            console.error(`❌ Error during ${language} test:`, err.message || err);
            const reportPath = recordAndSaveTestReport({
                testName: config.testName,
                language: language,
                timestamp: new Date().toISOString(),
                passed: false,
                explanation: `Execution error: ${err.message || err}`,
                findings: [],
                promptRemediationDirectives: [],
                generatedFiles: [],
                error: err.message || String(err)
            });
            console.log(`\n📄 Test report updated: ${reportPath}`);
            results[language] = false;
        }
    }

    console.log(`\n======================================================`);
    console.log(`📊 SUMMARY: ${config.testName}`);
    console.log(`======================================================`);
    for (const [lang, passed] of Object.entries(results)) {
        console.log(`${lang.padEnd(8)}: ${passed ? '✅ PASSED' : '❌ FAILED'}`);
    }

    const allPassed = Object.values(results).every(v => v === true);
    if (!allPassed) {
        throw new Error(`Integration test failed for ${config.testName}`);
    }

    return results;
}
