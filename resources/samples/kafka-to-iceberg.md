# Kafka to Apache Iceberg Lakehouse Pipeline

## Overview
A streaming lakehouse ingestion pipeline in Apache Beam that consumes real-time telemetry events from an **Apache Kafka** topic (`ReadFromKafka`), parses and validates incoming JSON payloads into structured schema rows using a branched `ParDo` transform, commits valid records to an **Apache Iceberg** table via a REST catalog (`IcebergIO`), and routes malformed payloads to a **Dead Letter Log** sink (`LogMessage`).

This sample can be generated and executed in either **Python** or **Java** using the **Generate Code** panel.

## Pipeline Architecture & Data Flow
`Kafka Telemetry Stream` ➔ `Parse & Validate JSON` ➔ `[Iceberg, Dead Letter Log]`

1. **Kafka Telemetry Stream (`ReadFromKafka` Source)**: Subscribes to the `telemetry_events` Kafka topic from the configured bootstrap servers (`localhost:9092`) and emits raw message bytes.
2. **Parse & Validate JSON (`ParDo` Step)**: Deserializes incoming JSON bytes into structured Beam `Row` records and splits execution into two tagged output `PCollection`s:
   - **`valid` branch**: Emits schema-validated records downstream to the **Iceberg** sink.
   - **`error` branch**: Captures malformed JSON payloads or schema validation failures and routes them to the **Dead Letter Log** sink.
3. **Iceberg (`IcebergIO` Sink)**: Writes validated streaming rows into an Apache Iceberg lakehouse table managed by a `rest` catalog (`org.apache.beam.sdk.io.iceberg.IcebergIO` / `apache_beam.io.iceberg`).
4. **Dead Letter Log (`LogMessage` Sink)**: Logs rejected records at `Warning` level so bad records never stall the streaming consumer.

## Runtime Parameters
| Parameter | Default Value | Description |
|---|---|---|
| `JOB_ID` | `kafka-to-iceberg-pipeline` | Unique streaming job identifier |

## Code Generation & Execution
1. Click **New File** to save a copy of `kafka-to-iceberg.beam` in your workspace.
2. Select the **Kafka Telemetry Stream** or **Iceberg** nodes on the canvas to customize your Kafka bootstrap servers, topic, Iceberg catalog URI, warehouse location, and table identifier.
3. Open the **Generate Code** tab, choose **Python** or **Java**, and click **Generate Code**.
4. Run locally with DirectRunner or deploy to Google Cloud Dataflow:
```bash
# Run locally with Apache Beam DirectRunner
./run_directrunner.sh

# Or deploy to Google Cloud Dataflow
export REGION="us-central1"
export GCS_STAGING_PATH="gs://your-bucket/staging"
./run_dataflowrunner.sh
```
