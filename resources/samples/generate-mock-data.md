# Generate Mock Data Pipeline

## Overview
A streaming Apache Beam pipeline that periodically triggers synthetic event generation using `GenerateSequence`, creates realistic JSON records matching a declarative schema inside a `ParDo` transform with built-in Dead Letter Queue (DLQ) error routing, and logs valid records downstream.

This sample can be generated and executed in either **Python** or **Java** using the **Generate Code** panel.

## Pipeline Architecture & Data Flow
`trigger (GenerateSequence)` ➔ `generate mock data (ParDo)` ➔ `Log Message`

1. **Trigger (`GenerateSequence`)**: Emits an unbounded sequence of integer ticks starting at `0` with a configurable rate limit (`1` tick per second).
2. **Generate Mock Data (`ParDo`)**: For each trigger tick, synthesizes `${NUM_OBJECTS_PER_ITERATION}` mock user JSON objects (`id`, `name`, `email`, `signup_date`) using **JSF / Faker** (Python) or **Datafaker** (Java). Wraps generation in a `try/catch` block and routes any malformed records to a separate error `PCollection`.
3. **Log Message (`LogMessage`)**: Consumes the `valid` output tag from the `ParDo` step and writes structured log entries for inspection.

## Runtime Parameters
| Parameter | Default Value | Description |
|---|---|---|
| `JOB_ID` | `generate-mock-data-pipeline` | Unique pipeline job identifier |
| `NUM_OBJECTS_PER_ITERATION` | `1` | Number of synthetic JSON records generated per trigger tick |

## Code Generation & Execution
1. Click **New File** to save a copy of `generate-mock-data.beam` in your workspace.
2. Open the **Generate Code** tab at the bottom, choose **Python** or **Java**, and click **Generate Code**.
3. Run locally with DirectRunner or deploy to Google Cloud Dataflow:
```bash
# Run locally with Apache Beam DirectRunner
./run_directrunner.sh

# Or deploy to Google Cloud Dataflow
export REGION="us-central1"
export GCS_STAGING_PATH="gs://your-bucket/staging"
./run_dataflowrunner.sh
```
