/**
 * Packaging, Dependency, and Deployability Evaluator Sub-Agent.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Audits generated dependency manifests (pom.xml / requirements.txt), container
 * entrypoints, Flex Template metadata (metadata.json), cloudbuild.yaml, and runner scripts.
 */

import { GoogleGenAI } from '@google/genai';
import { DEFAULT_GEMINI_MODEL } from '../../../constants';
import { SpecialistAgentResult } from './types';
import { GeneratedFileCandidate } from './deterministic-gate';
import { formatFilesWithLineNumbers } from './format-utils';

/**
 * Runs the Packaging and Deployability Evaluator sub-agent.
 *
 * @param ai - Initialized GoogleGenAI client.
 * @param language - Target language ('Java' | 'Python').
 * @param files - All generated files.
 * @returns Specialist evaluation result.
 */
export async function evaluatePackagingAndDeployability(
    ai: GoogleGenAI,
    language: 'Java' | 'Python',
    files: GeneratedFileCandidate[]
): Promise<SpecialistAgentResult> {
    const prompt = `You are the Principal Packaging & Runtime Deployability Evaluator Agent.
Your responsibility is auditing Apache Beam build descriptors, dependency specifications, Flex Template metadata, Dockerfiles, and runner scripts for deployment readiness.

=== TARGET LANGUAGE ===
${language}
=======================

=== GENERATED SOURCE FILES & ARTIFACTS (LINE NUMBERED) ===
${formatFilesWithLineNumbers(files)}
==========================================================

Audit the code against the following Packaging & Deployment Checklist:
1. **Dependency Specifications & Manifests:**
   - In Java (\`pom.xml\`):
     - Are all required Beam SDK dependencies and IO connectors declared?
     - If mock data / Faker is used, is \`net.datafaker:datafaker\` pinned to \`2.7.0\` or higher (older versions like 2.1.0 lack \`timeAndDate()\` and fail compilation)?
     - Is the Maven Shade plugin or compiler plugin configured with appropriate Java version (11 or 17)?
   - In Python (\`requirements.txt\`):
     - Is \`apache-beam[gcp]\` declared?
     - Are all third-party imported libraries included with realistic version constraints?
2. **Dataflow Flex Template Metadata (\`metadata.json\`):**
   - Are parameters declared in \`metadata.json\` matching CLI arguments expected by the pipeline?
   - Is \`image\` or container path properly configured?
3. **Cloud Build Configuration (\`cloudbuild.yaml\`):**
   - Does Cloud Build specify valid docker build and push steps?
4. **Runner Scripts Integrity:**
   - Does \`run_directrunner.sh\` invoke the pipeline with \`DirectRunner\`?
   - Does \`run_dataflowrunner.sh\` build the flex template or submit to Google Cloud Dataflow with necessary flags (\`--runner=DataflowRunner\`, \`--project\`, \`--region\`, \`--tempLocation\`)?
   - Do scripts use \`set -euo pipefail\` for error safety?
5. **Dockerfile & Container Alignment:**
   - Does the Dockerfile WORKDIR match the runner script expectations?
   - Is the entrypoint configured to launch the exact generated pipeline artifact?

Severity Guidelines:
- CRITICAL: Incoherent dependency versions that cause compiler/runtime breakages, missing core Beam dependencies, runner script invoking non-existent main file, malformed metadata.json parameter definitions.
- MAJOR: Incomplete Dataflow runner flags, missing Cloud Build steps.
- MINOR: Non-standard formatting or missing comments.`;

    const schema = {
        type: "object",
        properties: {
            passed: {
                type: "boolean",
                description: "True if packaging and dependencies are valid and deployable"
            },
            summary: {
                type: "string",
                description: "Packaging assessment summary"
            },
            findings: {
                type: "array",
                items: {
                    type: "object",
                    properties: {
                        id: { type: "string" },
                        category: { type: "string", enum: ["PACKAGING", "SYNTAX"] },
                        severity: { type: "string", enum: ["CRITICAL", "MAJOR", "MINOR"] },
                        file: { type: "string" },
                        line: { type: "integer" },
                        evidence: { type: "string" },
                        description: { type: "string" },
                        rationale: { type: "string" }
                    },
                    required: ["id", "category", "severity", "file", "description", "rationale"]
                }
            }
        },
        required: ["passed", "summary", "findings"]
    };

    const response = await ai.models.generateContent({
        model: DEFAULT_GEMINI_MODEL,
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: schema,
            temperature: 0.1
        }
    });

    if (!response.text) {
        throw new Error('Empty response from PackagingAndDeployabilityAgent');
    }

    const parsed = JSON.parse(response.text);
    return {
        agentName: 'PackagingAndDeployabilityAgent',
        passed: parsed.passed,
        summary: parsed.summary,
        findings: parsed.findings || []
    };
}
