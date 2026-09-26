# Apache Beam Modular Integration Test Suite & Multi-Agent Evaluation Harness

> **Author:** Mike Nimer <mikenimer@google.com>  
> **Location:** `src/test/integration/`

This directory contains **live end-to-end integration tests** that validate the extension's AI code generation capabilities against Google Cloud Vertex AI using Gemini (`gemini-3.7-flash` in the `global` region). Tests generate complete Apache Beam repositories (Java & Python) and evaluate them using the specialist Multi-Agent Evaluation Harness.

---

## Directory Architecture

The integration test suite is partitioned into modular pipeline domains, each sub-divided into two execution target profiles: `agent-engine` (Vertex AI Agent Engine) and `cloud-run` (Cloud Run containerized services/jobs):

```
src/test/integration/
├── sources/
│   ├── agent-engine/     # 65 Source IO connector tests (Agent Engine runtime)
│   └── cloud-run/        # 65 Source IO connector tests (Cloud Run runtime)
├── sinks/
│   ├── agent-engine/     # 60 Sink IO connector tests (Agent Engine runtime)
│   └── cloud-run/        # 60 Sink IO connector tests (Cloud Run runtime)
├── steps/
│   ├── agent-engine/     # 9 Modular Step suites covering all 31 Step Types (Agent Engine)
│   └── cloud-run/        # 9 Modular Step suites covering all 31 Step Types (Cloud Run)
├── evaluators/           # Specialist multi-agent evaluators
├── codegen-runner.ts     # E2E test coordinator and dynamic pipeline loader
├── test-reporter.ts      # Markdown test scorecard and prompt directive generator
└── README.md             # This document
```

---

## Standardized Pipeline DAG Patterns

All integration test DAGs adhere to standardized topological contracts:

### 1. Source Integration Tests (`src/test/integration/sources/*`)
All source tests isolate a single ingestion connector writing to a minimal downstream pipeline:
$$\text{IO Connector} \longrightarrow \text{ParDo} \longrightarrow \text{Log Message}$$
- **Node 1 (Source):** The specific IO Connector under test (e.g., BigQuery, Kafka, PubSub, Kinesis).
- **Node 2 (Step):** `ParDo` DoFn data normalizer and validator.
- **Node 3 (Sink):** `LogMessage` structured audit logger.

### 2. Sink Integration Tests (`src/test/integration/sinks/*`)
All sink tests isolate a single destination writer receiving synthesized data:
- **Batch Sinks:**
  $$\text{Create} \longrightarrow \text{ParDo} \longrightarrow \text{Sink IO Connector}$$
  *(BigQueryIO, JdbcIO, FileIO, ParquetIO, AvroIO, TextIO, LogMessage)*
- **Streaming Sinks:**
  $$\text{GenerateSequence} \longrightarrow \text{ParDo (mock generator)} \longrightarrow \text{Sink IO Connector}$$
  *(PubSubIO, KafkaIO, KinesisIO, SnsIO, SqsIO, JmsIO, MqttIO)*

### 3. Step Node Integration Tests (`src/test/integration/steps/*`)
All step tests exercise multi-transform sequences to validate data manipulation, windowing, and aggregation:
$$\text{Create / GenerateSequence} \longrightarrow \langle\text{Combination of Step Nodes}\rangle \longrightarrow \text{Log Message / IO Connector}$$

---

## 100% Step Node Coverage Matrix

The 9 step pipeline suites under `src/test/integration/steps/` provide **100% coverage across all 31 Step Node Types** supported by the Beam Designer:

| # | Transform Name | Category | Primary Test Suite | Description |
|---|----------------|----------|--------------------|-------------|
| 1 | `ParDo` | Core Transforms | `windowing-kv-groupby`, `multi-branch-flatten` | Custom element-wise DoFn |
| 2 | `ParseMessage` | Message Parsers | `combine-and-context` | Parse structured JSON payload |
| 3 | `WithTimestamps` | Element Transforms | `windowing-kv-groupby` | Event timestamp assignment |
| 4 | `Filter` | Element Transforms | `text-tokenization-filtering` | Boolean predicate filtering |
| 5 | `FlatMap` | Element Transforms | `text-tokenization-filtering` | 1-to-N element mapping |
| 6 | `Keys` | Element Transforms | `key-value-manipulation` | Extract keys from KV pairs |
| 7 | `KVMapper` | Element Transforms | `windowing-kv-groupby` | Map elements to KV pairs |
| 8 | `KvSwap` | Element Transforms | `key-value-manipulation` | Swap key and value components |
| 9 | `Map` | Element Transforms | `text-tokenization-filtering` | 1-to-1 element projection |
| 10 | `ToString` | Element Transforms | `text-tokenization-filtering` | Convert elements to strings |
| 11 | `Values` | Element Transforms | `key-value-manipulation` | Extract values from KV pairs |
| 12 | `ApproximateQuantiles` | Aggregations | `statistical-aggregations-math` | Approximate distribution quantiles |
| 13 | `ApproximateUnique` | Aggregations | `distinct-sampling-approximate` | HyperLogLog cardinality estimate |
| 14 | `BatchElements` | Aggregations | `batching-and-grouping` | Dynamic batch bundling |
| 15 | `CoGroupByKey` | Aggregations | `relational-cogroupbykey-join` | Relational multi-stream join |
| 16 | `Combine` | Aggregations | `combine-and-context` | Associative combine function |
| 17 | `CombineWithContext` | Aggregations | `combine-and-context` | Combine with pipeline side context |
| 18 | `Count` | Aggregations | `text-tokenization-filtering` | Element occurrence counting |
| 19 | `Distinct` | Aggregations | `distinct-sampling-approximate` | Deduplication |
| 20 | `GroupByKey` | Aggregations | `windowing-kv-groupby` | Group KV pairs by key |
| 21 | `GroupIntoBatches` | Aggregations | `batching-and-grouping` | Sharded batch bundling |
| 22 | `Latest` | Aggregations | `distinct-sampling-approximate` | Latest timestamp element selection |
| 23 | `Max` | Aggregations | `statistical-aggregations-math` | Maximum value calculation |
| 24 | `Mean` | Aggregations | `statistical-aggregations-math` | Arithmetic mean calculation |
| 25 | `Min` | Aggregations | `statistical-aggregations-math` | Minimum value calculation |
| 26 | `Sample` | Aggregations | `distinct-sampling-approximate` | Uniform random sampling |
| 27 | `Sum` | Aggregations | `windowing-kv-groupby` | Numeric accumulation |
| 28 | `Top` | Aggregations | `key-value-manipulation` | Top-N elements extraction |
| 29 | `WindowInto` | Windows | `windowing-kv-groupby` | Fixed/Sliding/Session windowing |
| 30 | `Flatten` | Other Transforms | `multi-branch-flatten` | Merge multiple PCollections |
| 31 | `Reshuffle` | Other Transforms | `batching-and-grouping` | Redistribute across workers |

---

## Running Integration Tests

All integration tests are executed using Vitest with [`vitest.integration.config.mts`](file:///Users/mikenimer/Development/projects/apache-beam-designer/vitest.integration.config.mts) (which configures a 3-minute timeout to allow for LLM code generation and multi-agent evaluation).

### 1. Run Everything
Execute all integration test suites across all domains:
```bash
npm run test:integration
```

### 2. Run by Category (Sources, Sinks, or Steps)
Target an entire domain across both `agent-engine` and `cloud-run`:
```bash
# Run all Source tests (32 suites)
npm run test:integration:sources

# Run all Sink tests (28 suites)
npm run test:integration:sinks

# Run all Step tests (18 suites)
npm run test:integration:steps
```

### 3. Run by Target Environment (`agent-engine` vs. `cloud-run`)
Target an execution profile across all domains:
```bash
# Run all Agent Engine tests (sources, sinks, steps)
npm run test:integration:agent-engine

# Run all Cloud Run tests (sources, sinks, steps)
npm run test:integration:cloud-run
```

### 4. Run a Specific Sub-Folder
Target a specific domain and deployment profile combination:
```bash
# Sources
npm run test:integration:sources:agent-engine
npm run test:integration:sources:cloud-run

# Sinks
npm run test:integration:sinks:agent-engine
npm run test:integration:sinks:cloud-run

# Steps
npm run test:integration:steps:agent-engine
npm run test:integration:steps:cloud-run
```

### 5. Run a Single Test File
Run an individual connector or step pipeline directly:
```bash
# Run BigQuery Source test on Agent Engine
npx vitest run --config vitest.integration.config.mts src/test/integration/sources/agent-engine/bigquery-source.test.ts

# Run Kafka Sink test on Cloud Run
npx vitest run --config vitest.integration.config.mts src/test/integration/sinks/cloud-run/kafka-sink.test.ts

# Run Windowing & Grouping Steps test
npx vitest run --config vitest.integration.config.mts src/test/integration/steps/agent-engine/windowing-kv-groupby.test.ts
```

### 6. Filter by Target Language (`Java` or `Python`)
Use Vitest's `-t` flag to test only one language:
```bash
# Test only Java generation
npx vitest run --config vitest.integration.config.mts src/test/integration/sources/agent-engine/pubsub-source.test.ts -t "Java"

# Test only Python generation
npx vitest run --config vitest.integration.config.mts src/test/integration/sources/agent-engine/pubsub-source.test.ts -t "Python"
```

### 7. Interactive Watch Mode
Keep Vitest open and automatically re-evaluate upon file edits:
```bash
npm run test:integration:watch
```

---

## How the Multi-Agent Evaluation Harness Works

When an integration test runs, it executes a multi-phase evaluation workflow:

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
   │   ├── PipelineSpecificationAgent: YAML property completeness, custom node instructions, runtimeVariables, jobConfig
   │   ├── SecurityAndHardeningAgent: Secret Manager usage, non-root Dockerfile, shell quoting
   │   └── PackagingAndDeployabilityAgent: Maven/PyPI deps, Datafaker 2.7.0, runner scripts
   │
   └── Step C: Lead Arbiter & Synthesizer Agent (arbiter-evaluator.ts)
       ├── Calculates multi-dimensional rubric scorecard (0-100)
       ├── Enforces hard vetoes on critical defects (syntax error, plaintext secrets)
       └── Generates Prompt Remediation Directives
```

### Automated Test Report (`test-report.md`)
After test execution, the harness updates [`test-report.md`](./test-report.md) in this directory with:
- **Executive Summary Table**: Pass/fail status, overall score, hard veto indicators, and defect counts.
- **Failed Jobs & Defect Analysis**: Detailed explanations and severity-coded findings (🔴 CRITICAL, 🟠 MAJOR, 🟡 MINOR) for any failed pipeline.
- **Prompt Remediation Directives**: Ready-to-use rule additions for `resources/code-gen-prompt-python.txt` and `resources/code-gen-prompt-java.txt` to continuously improve prompt quality.
- **Detailed Scorecards & Generated File Lists**: Category rubric scores (Architecture, Security, Packaging, Maintainability).
