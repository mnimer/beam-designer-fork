/**
 * Security and Container Hardening Evaluator Sub-Agent.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Audits generated code, Dockerfiles, and runner scripts for security vulnerabilities,
 * credential leakage, unauthenticated resources, and container hardening best practices.
 *
 * Architectural decisions:
 * - Enforces the findings established in C1 (path traversal), C2 (Secret Manager credentials),
 *   M3 (terminal injection quoting), and M15 (build context ignore files).
 * - Enforces least-privilege container execution (non-root Docker users) and secure parameter passing.
 */

import { GoogleGenAI } from '@google/genai';
import { DEFAULT_GEMINI_MODEL } from '../../../constants';
import { SpecialistAgentResult } from './types';
import { GeneratedFileCandidate } from './deterministic-gate';

/**
 * Runs the Security and Container Hardening Evaluator sub-agent.
 *
 * @param ai - Initialized GoogleGenAI client.
 * @param language - Target language ('Java' | 'Python').
 * @param files - All generated files.
 * @returns Specialist evaluation result.
 */
export async function evaluateSecurityAndHardening(
    ai: GoogleGenAI,
    language: 'Java' | 'Python',
    files: GeneratedFileCandidate[]
): Promise<SpecialistAgentResult> {
    const prompt = `You are the Principal Security & Container Hardening Evaluator Agent.
Your responsibility is auditing generated Apache Beam code, runner scripts, build descriptors, and Dockerfiles for security compliance and hardening.

=== TARGET LANGUAGE ===
${language}
=======================

=== GENERATED SOURCE FILES & ARTIFACTS ===
${files.map(f => `--- FILE: ${f.filename} ---\n${f.content}\n`).join('\n')}
=========================================

Audit the code against the following Security Checklist:
1. **Secret & Credential Management:**
   - Are database passwords, connection strings, auth tokens, and broker secrets retrieved from GCP Secret Manager (or dynamically resolved via PipelineOptions)?
   - Verify there are NO hardcoded credentials, cleartext passwords, or unredacted bearer tokens.
2. **Container & Dockerfile Hardening:**
   - Does the Dockerfile run under a non-root user (e.g. \`USER beam\` or non-root UID)?
   - Does the Dockerfile avoid copying unwanted build contexts, logs (\`*.log\`), or secrets?
3. **Shell Script Quoting & Command Safety:**
   - In \`run_directrunner.sh\` and \`run_dataflowrunner.sh\`, are all shell variables quoted properly (e.g. \`"\${TEMPLATE_IMAGE}"\`, \`"\${PROJECT_ID}"\`) to prevent shell injection or word-splitting?
4. **Filesystem & Path Traversal Safety:**
   - Are local or cloud storage paths constructed safely without path traversal vulnerabilities?

Severity Guidelines:
- CRITICAL: Plaintext credentials committed in code or scripts, shell command injection vectors, root user execution with host mount capabilities.
- MAJOR: Unquoted shell variables in execution scripts, missing .dockerignore / build context filters.
- MINOR: Non-pinned base image tags in Dockerfile (e.g. using :latest instead of specific tag/digest).`;

    const schema = {
        type: "object",
        properties: {
            passed: {
                type: "boolean",
                description: "True if no CRITICAL or blocking security issues are detected"
            },
            summary: {
                type: "string",
                description: "Security evaluation summary"
            },
            findings: {
                type: "array",
                items: {
                    type: "object",
                    properties: {
                        id: { type: "string" },
                        category: { type: "string", enum: ["SECURITY"] },
                        severity: { type: "string", enum: ["CRITICAL", "MAJOR", "MINOR"] },
                        file: { type: "string" },
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
            responseSchema: schema
        }
    });

    if (!response.text) {
        throw new Error('Empty response from SecurityAndHardeningAgent');
    }

    const parsed = JSON.parse(response.text);
    return {
        agentName: 'SecurityAndHardeningAgent',
        passed: parsed.passed,
        summary: parsed.summary,
        findings: parsed.findings || []
    };
}
