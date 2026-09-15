# Apache Beam Integration Tests & Multi-Agent Evaluation Harness

> **Author:** Mike Nimer <mikenimer@google.com>  
> **Location:** `src/test/integration/`

This directory contains **live end-to-end integration tests** that validate the extension's AI code generation capabilities against Google Cloud Vertex AI using Gemini (`gemini-3.7-flash` in the `global` region).

---

## Unit Tests vs. Integration Tests

| Test Suite | Location | Runner Command | Characteristics |
| :--- | :--- | :--- | :--- |
| **Extension Unit Tests** | `src/test/unit/*.test.ts` | `npm run test:unit` | Fast (< 1s), fully offline, mocks VS Code APIs and LLM calls. |
| **Webview Unit Tests** | `webview/src/**/*.test.tsx` | `npm run test:webview` | Fast (~6s), offline React Flow & DOM tests. |
| **Live Integration Tests** | `src/test/integration/*.test.ts` | `npm run test:integration` | Live network calls to Vertex AI, generates complete Beam repositories, and evaluates them with specialist sub-agents. |

---

## Prerequisites

1. **Google Cloud Project**:
   The test runner dynamically detects your active GCP project via:
   ```bash
   gcloud config get-value project
   ```
   Alternatively, set the environment variable:
   ```bash
   export GOOGLE_CLOUD_PROJECT="your-gcp-project-id"
   ```

2. **Application Default Credentials (ADC)**:
   Ensure your local environment is authenticated to Vertex AI:
   ```bash
   gcloud auth application-default login
   ```

3. **Vertex AI API**:
   The project must have `aiplatform.googleapis.com` enabled.

---

## Running Integration Tests

All integration tests are executed using Vitest with [`vitest.integration.config.mts`](file:///Users/mikenimer/Development/projects/apache-beam-designer/vitest.integration.config.mts) (which configures a 3-minute timeout to allow for LLM code generation and multi-agent evaluation).

### 1. Run All Integration Tests
```bash
npm run test:integration
```

### 2. Run a Specific Test Suite
```bash
# Run JDBC-to-JDBC pipeline test
npx vitest run --config vitest.integration.config.mts src/test/integration/jdbcio-to-jdbcio.test.ts

# Run Kafka-to-Kafka pipeline test
npx vitest run --config vitest.integration.config.mts src/test/integration/kafkaio-to-kafkaio.test.ts
```

### 3. Filter by Target Language
Run only the Java or Python test within a suite using `-t`:
```bash
# Run only Java tests
npx vitest run --config vitest.integration.config.mts src/test/integration/jdbcio-to-jdbcio.test.ts -t "Java"

# Run only Python tests
npx vitest run --config vitest.integration.config.mts src/test/integration/jdbcio-to-jdbcio.test.ts -t "Python"
```

### 4. Interactive Watch Mode
To keep Vitest open and re-run on changes:
```bash
npx vitest --config vitest.integration.config.mts src/test/integration/jdbcio-to-jdbcio.test.ts
```

### 5. Automated Test Report (`test-report.md`)
After every test execution, the harness updates [`test-report.md`](./test-report.md) in this directory.

This report provides:
- **Executive Summary Table**: Pass/fail status, overall score, hard veto indicators, and defect counts.
- **Failed Jobs & Defect Analysis**: Detailed explanations and severity-coded findings (🔴 CRITICAL, 🟠 MAJOR, 🟡 MINOR) for any failed pipeline.
- **Prompt Remediation Directives**: Ready-to-use rule additions for `resources/code-gen-prompt-python.txt` and `resources/code-gen-prompt-java.txt` to continuously improve prompt quality.
- **Detailed Scorecards & Generated File Lists**: Category rubric scores (Architecture, Security, Packaging, Maintainability).


---

## How the Multi-Agent Evaluation Harness Works

When an integration test runs, it executes a two-phase workflow:

```
[Pipeline YAML Spec]
         │
         ▼
1. Code Generation (Gemini 3.7 Flash)
   Translates visual DAG YAML into complete repository (code, pom.xml, Dockerfile, scripts)
         │
         ▼
2. Multi-Agent Evaluation Harness (src/test/integration/evaluators/)
   ├── Step A: Deterministic Pre-Flight Gate (deterministic-gate.ts)
   │   ├── Python syntax compilation (`python3 -m py_compile`) / Java structural check
   │   └── Regex plaintext secret scanner (detects hardcoded keys, passwords)
   │
   ├── Step B: Parallel Specialist Sub-Agents (Promise.all)
   │   ├── BeamArchitectureAgent: DAG fidelity, streaming windowing, DoFn tagged outputs, DLQ
   │   ├── SecurityAndHardeningAgent: Secret Manager usage, non-root Dockerfile, shell quoting
   │   └── PackagingAndDeployabilityAgent: Maven/PyPI deps, Datafaker 2.7.0, runner scripts
   │
   └── Step C: Lead Arbiter & Synthesizer Agent (arbiter-evaluator.ts)
       ├── Calculates multi-dimensional rubric scorecard (0-100)
       ├── Enforces hard vetoes on critical defects (syntax error, plaintext secrets)
       └── Generates Prompt Remediation Directives
```

### Prompt Remediation Directives (Fix the Generator, Not the Test Code)

Because integration tests validate the **AI Code Generator Prompt itself**, the evaluation harness **does not patch the generated code**. 

When a test fails or detects defects:
1. The Lead Arbiter diagnoses why the generator prompt allowed or induced the mistake.
2. It outputs structured **Prompt Remediation Directives** in the test report targeting:
   - [`resources/code-gen-prompt-python.txt`](file:///Users/mikenimer/Development/projects/apache-beam-designer/resources/code-gen-prompt-python.txt)
   - [`resources/code-gen-prompt-java.txt`](file:///Users/mikenimer/Development/projects/apache-beam-designer/resources/code-gen-prompt-java.txt)
3. You review and apply the recommended rules to the prompt files so the generator permanently stops making the error.

---

## Adding a New Integration Test

To add a new pipeline test case:

1. Create `src/test/integration/<pipeline-name>.test.ts`.
2. Define the pipeline YAML string (`nodes`, `edges`, `jobConfig`, `pipelineConfig`).
3. Call `runPipelineIntegrationTest`:

```typescript
import { describe, it, expect } from 'vitest';
import { runPipelineIntegrationTest } from './codegen-runner';

const MY_PIPELINE_YAML = `...`;

describe('My Pipeline Code Generation', () => {
    it('generates valid Java pipeline and passes multi-agent evaluation', async () => {
        const results = await runPipelineIntegrationTest({
            testName: 'My Pipeline (Java)',
            yamlContent: MY_PIPELINE_YAML,
            languages: ['Java']
        });
        expect(results.Java).toBe(true);
    }, 180000);

    it('generates valid Python pipeline and passes multi-agent evaluation', async () => {
        const results = await runPipelineIntegrationTest({
            testName: 'My Pipeline (Python)',
            yamlContent: MY_PIPELINE_YAML,
            languages: ['Python']
        });
        expect(results.Python).toBe(true);
    }, 180000);
});
```
