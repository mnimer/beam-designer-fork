# Generate Mock Data Pipeline

An Apache Beam streaming data pipeline in Java that periodically triggers data generation, creates realistic mock user data using Datafaker according to a defined JSON schema, routes errors to a Dead Letter Queue branch, and logs results.

## Prerequisites
- Java 17 JDK
- Apache Maven 3.9+
- Google Cloud SDK (`gcloud` CLI configured with credentials and project)
- Docker (for Flex Template container creation)

## Build
Compile and package the uber-jar:
```bash
mvn clean package
```

## Run Locally (DirectRunner)
Execute the pipeline locally using the DirectRunner script:
```bash
./run_directrunner.sh
```

## Deploy to GCP Dataflow
Build the container image, upload the Flex Template spec, and launch on Cloud Dataflow:
```bash
export REGION="us-central1"
export GCS_STAGING_PATH="gs://my-bucket/staging"
./run_dataflowrunner.sh
```

## Runtime Parameters
| Parameter | Description | Default |
|---|---|---|
| `--pipelineJobId` | Unique job identifier | `generate-mock-data-pipeline` |
| `--numObjectsPerIteration` | Number of mock records per trigger tick | `1` |
