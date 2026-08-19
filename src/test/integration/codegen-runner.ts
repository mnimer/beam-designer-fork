import * as fs from 'fs';
import * as path from 'path';
import { execFile } from 'child_process';
import { GoogleGenAI } from '@google/genai';
import { DEFAULT_GEMINI_MODEL } from '../../constants';

export interface GeneratedFile {
    filename: string;
    content: string;
    executable?: boolean;
}

export interface EvaluationResult {
    isGood: boolean;
    issues: string[];
    explanation: string;
}

export interface PipelineTestConfig {
    testName: string;
    yamlContent: string;
    languages?: ('Java' | 'Python')[];
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
 * Evaluates generated code against the EXACT prompt template used to generate it, with NO extra custom hints.
 */
export async function evaluateGeneratedCode(
    ai: GoogleGenAI,
    codeGenPrompt: string,
    files: GeneratedFile[]
): Promise<EvaluationResult> {
    const evaluationPrompt = `You are an expert Apache Beam automated code evaluator and QA validator.
Evaluate whether the generated files strictly adhere to all guidelines, rules, syntax specifications, and constraints defined in the following Code Generation Prompt and input pipeline YAML:

=== CODE GENERATION SYSTEM PROMPT & SPECIFICATION ===
${codeGenPrompt}
=====================================================

=== ALL GENERATED FILES ===
${files.map(f => `--- FILE: ${f.filename} ---\n${f.content}\n`).join('\n')}
===========================

TASK:
1. Thoroughly verify that the generated files satisfy all requirements and instructions contained in the system prompt above.
2. Verify that the code is valid, compilable, and free of syntax errors, type mismatches, or missing dependencies.
3. If the generated output is correct and complies with all prompt requirements, return \`isGood: true\` with an empty or minor \`issues\` list.
4. If there are any bugs, rule violations, missing dependencies, or defects, return \`isGood: false\` with the exact \`issues\` enumerated.`;

    const evaluationSchema = {
        type: "object",
        properties: {
            isGood: {
                type: "boolean",
                description: "Whether the generated code satisfies all prompt instructions and Beam standards without defects"
            },
            issues: {
                type: "array",
                items: { type: "string" },
                description: "List of issues, bugs, or prompt rule violations found in the generated output"
            },
            explanation: {
                type: "string",
                description: "Detailed explanation summarizing the evaluation results"
            }
        },
        required: ["isGood", "issues", "explanation"]
    };

    const evalResponse = await ai.models.generateContent({
        model: DEFAULT_GEMINI_MODEL,
        contents: evaluationPrompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: evaluationSchema
        }
    });

    if (!evalResponse.text) {
        throw new Error('Empty evaluation response received from Gemini');
    }

    return JSON.parse(evalResponse.text) as EvaluationResult;
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
            const prompt = buildCodeGenPrompt(language, config.yamlContent);
            const responseSchema = JSON.parse(readResource('code-gen-schema.json'));

            console.log(`1. Generating ${language} code via Gemini (${DEFAULT_GEMINI_MODEL})...`);
            const startTime = Date.now();
            const response = await ai.models.generateContent({
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
                console.log(mainFile.content);
            }

            console.log(`\n2. Evaluating generated ${language} code against prompt instructions via Gemini...`);
            const evalResult = await evaluateGeneratedCode(ai, prompt, files);

            console.log(`\n📋 Review Results for ${language}:`);
            console.log(`   Status: ${evalResult.isGood ? '✅ PASS' : '❌ FAIL'}`);
            console.log(`   Explanation: ${evalResult.explanation}`);
            if (evalResult.issues.length > 0) {
                console.log(`   Issues Reported:`);
                evalResult.issues.forEach((issue, idx) => console.log(`     ${idx + 1}. ${issue}`));
            }

            results[language] = evalResult.isGood;
        } catch (err: any) {
            console.error(`❌ Error during ${language} test:`, err.message || err);
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
