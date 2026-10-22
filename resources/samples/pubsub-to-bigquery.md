# Pub/Sub to BigQuery Streaming Pipeline

## Overview
An end-to-end streaming ETL pipeline in Apache Beam that ingests real-time messages from a Google Cloud **Pub/Sub** topic, parses and validates incoming payloads in a branched **Parse Message** transform, writes valid structured rows into a **BigQuery** table, and routes parsing failures to a **Log Message** dead-letter sink.

This sample can be generated and executed in either **Python** or **Java** using the **Generate Code** panel.

## Pipeline Architecture & Data Flow
`PubSub Connector` ➔ `Parse Message` ➔ `[BigQuery, Log Message]`

1. **PubSub Connector (`SOURCE`)**: Subscribes to an unbounded stream of messages from a Google Cloud Pub/Sub topic.
2. **Parse Message (`ParseMessage` / `ParDo`)**: Deserializes and validates each incoming message payload, emitting two branched outputs:
   - **`valid` branch**: Routed to the **BigQuery** sink for durable analytics storage.
   - **`error` branch**: Routed to the **Log Message** sink for dead-letter diagnostics and alerting.
3. **BigQuery (`SINK`)**: Streams validated records into the target BigQuery dataset and table.
4. **Log Message (`SINK`)**: Captures and logs malformed or unparseable payloads without halting the streaming job.

## Runtime Parameters
| Parameter | Default Value | Description |
|---|---|---|
| `JOB_ID` | `pubsub_to_bigquery` | Unique streaming job identifier |
| `topic` | *(required)* | Input Cloud Pub/Sub topic (`projects/<project>/topics/<topic>`) |
| `year` | *(optional)* | Partition or filter year parameter for downstream processing |

## Code Generation & Execution
1. Click **New File** to save a copy of `pubsub-to-bigquery.beam` in your workspace.
2. Configure the **PubSub Connector** topic and **BigQuery** table properties in the node inspector, or pass them via runtime variables.
3. Open the **Generate Code** tab, select **Python** or **Java**, and click **Generate Code**.
4. Execute locally or on your target runner:
```bash
# Run locally with DirectRunner
./run_directrunner.sh

# Run on Cloud Dataflow
export REGION="us-central1"
export GCS_STAGING_PATH="gs://your-bucket/staging"
./run_dataflowrunner.sh
```
