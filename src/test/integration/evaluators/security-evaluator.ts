/**
 * Security and Container Hardening Evaluator Sub-Agent.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Audits generated code, Dockerfiles, parameter manifests, and runner scripts
 * for security vulnerabilities, credential leakage, unauthenticated resources,
 * and container hardening best practices.
 *
 * Architectural decisions:
 * - Dynamically resolves the security model: attempts 'gemini-3.8-flash-cyber'
 *   (via Google's Fairwind Program) and transparently falls back to 'gemini-3.8-flash'
 *   or DEFAULT_GEMINI_MODEL ('gemini-3.7-flash') for non-allowlisted developer environments.
 * - Injects 1-indexed line numbers into generated code to ensure finding citations
 *   have verifiable, ground-truth line references and verbatim evidence.
 * - Audits CWE-798 (hardcoded credentials), CWE-78 (shell injection), CWE-250 (root containers),
 *   CWE-89 (SQL injection in JDBC queries), and private VPC networking directives.
 */

import { GoogleGenAI } from '@google/genai';
import { DEFAULT_GEMINI_MODEL } from '../../../constants';
import { SpecialistAgentResult } from './types';
import { GeneratedFileCandidate } from './deterministic-gate';
import { formatFilesWithLineNumbers } from './format-utils';

let cachedSecurityModel: string | null = null;

/**
 * Resets the cached security model for unit testing purposes.
 */
export function resetResolvedSecurityModelForTesting(): void {
    cachedSecurityModel = null;
}

/**
 * Resolves the optimal Gemini model for security code evaluation.
 * Probes 'gemini-3.8-flash-cyber' first; falls back gracefully to
 * 'gemini-3.8-flash' and then DEFAULT_GEMINI_MODEL ('gemini-3.7-flash').
 *
 * @param ai - Initialized GoogleGenAI client.
 * @returns Resolved model identifier string.
 */
export async function resolveSecurityModel(ai: GoogleGenAI): Promise<string> {
    if (cachedSecurityModel) {
        return cachedSecurityModel;
    }

    const preferredModel = process.env.SECURITY_EVALUATOR_MODEL || 'gemini-3.8-flash-cyber';
    const fallbackModel = 'gemini-3.8-flash';
    const baseModel = DEFAULT_GEMINI_MODEL;

    // NOTE: Attempt preferred model (Fairwind program access)
    try {
        await ai.models.generateContent({
            model: preferredModel,
            contents: 'ping',
            config: { maxOutputTokens: 1 }
        });
        cachedSecurityModel = preferredModel;
        return preferredModel;
    } catch (err: any) {
        // Fallback to general gemini-3.8-flash or base model
        try {
            await ai.models.generateContent({
                model: fallbackModel,
                contents: 'ping',
                config: { maxOutputTokens: 1 }
            });
            cachedSecurityModel = fallbackModel;
            return fallbackModel;
        } catch {
            cachedSecurityModel = baseModel;
            return baseModel;
        }
    }
}

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
    const modelToUse = await resolveSecurityModel(ai);

    const prompt = `You are the Principal Security & Container Hardening Evaluator Agent.
Your responsibility is auditing generated Apache Beam code, runner scripts, build descriptors, parameter manifests, and Dockerfiles for security compliance and hardening.

=== TARGET LANGUAGE ===
${language}
=======================

=== GENERATED SOURCE FILES & ARTIFACTS (LINE NUMBERED) ===
${formatFilesWithLineNumbers(files)}
==========================================================

Audit the code against the following Security Checklist:
1. **Secret & Credential Management (CWE-798, CWE-312):**
   - Are database passwords, connection strings, auth tokens, and broker secrets retrieved from GCP Secret Manager (or dynamically resolved via PipelineOptions without default values)?
   - Verify there are NO hardcoded credentials, cleartext passwords, or unredacted bearer tokens in code, Dockerfiles, \`metadata.json\`, or shell script defaults.
   - For \`metadata.json\`, ensure sensitive parameters specify \`"isSecret": true\` and do NOT have default plaintext values.
2. **Container & Dockerfile Hardening (CWE-250):**
   - Does the Dockerfile run under an explicit non-root user (e.g. \`USER beam\` or non-root UID)?
   - Does the Dockerfile avoid copying unwanted build contexts, logs (\`*.log\`), or credential files?
3. **Shell Script Quoting & Command Safety (CWE-78):**
   - In \`run_directrunner.sh\` and \`run_dataflowrunner.sh\`, are all shell variables quoted properly (e.g. \`"\${TEMPLATE_IMAGE}"\`, \`"\${PROJECT_ID}"\`) to prevent shell injection or word-splitting?
   - Do scripts use \`set -euo pipefail\` to prevent running with unbound variables?
4. **Dataflow Query & Injection Safety (CWE-89):**
   - In \`JdbcIO\` or database queries, are queries parameterized rather than formatted using raw string concatenation with external variables?
5. **Private Networking & VPC Security:**
   - If custom network or subnetwork parameters are defined, are they passed cleanly without disabling security flags like \`--no_use_public_ips\`?

Severity Guidelines:
- CRITICAL: Plaintext credentials committed in code or scripts, shell command injection vectors, root user execution without dropping privileges.
- MAJOR: Unquoted shell variables in execution scripts, missing .dockerignore / build context filters, plaintext defaults in metadata.json.
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
                        line: { type: "integer", description: "1-indexed line number where the issue occurs" },
                        evidence: { type: "string", description: "Verbatim code snippet demonstrating the defect" },
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
        model: modelToUse,
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: schema,
            temperature: 0.1
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
