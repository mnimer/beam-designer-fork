#!/usr/bin/env bash
set -euo pipefail

# Dynamic Project Retrieval
PROJECT_ID=$(gcloud config get-value project)
REGION="${REGION:-us-central1}"
SUBNETWORK="${SUBNETWORK:-regions/us-central1/subnetworks/default}"
GCS_STAGING_PATH="${GCS_STAGING_PATH:-gs://${PROJECT_ID}-spark/staging}"
PIPELINE_NAME="{{pipeline_name}}"
MAIN_CLASS="com.example.{{pipeline_class_name}}"
GCS_JAR_URI="${GCS_STAGING_PATH}/${PIPELINE_NAME}.jar"

echo "==== Configurations ===="
echo "Project ID: ${PROJECT_ID}"
echo "Region: ${REGION}"
echo "Main Class: ${MAIN_CLASS}"
echo "GCS Jar URI: ${GCS_JAR_URI}"
echo "Subnetwork: ${SUBNETWORK}"
echo "========================"

# 1. Compile and package fat JAR
echo "Building package JAR..."
mvn clean package -DskipTests

# Determine built JAR path
if [ -f "target/main.jar" ]; then
    JAR_PATH="target/main.jar"
else
    JAR_PATH=$(find target -maxdepth 1 -name "*.jar" ! -name "original-*.jar" | head -n 1)
fi

if [ -z "${JAR_PATH:-}" ] || [ ! -f "${JAR_PATH}" ]; then
    echo "ERROR: Could not find built JAR in target/"
    exit 1
fi

echo "Found JAR: ${JAR_PATH}"

# 2. Upload JAR to GCS
echo "Uploading JAR to GCS staging..."
gcloud storage cp "${JAR_PATH}" "${GCS_JAR_URI}"

# 3. Submit Dataproc Serverless Spark Batch job
echo "Submitting Dataproc Serverless Spark Batch job..."
gcloud dataproc batches submit spark \
    --batch="${PIPELINE_NAME}-batch-$(date +%Y%m%d-%H%M%S)" \
    --region="${REGION}" \
    --version="1.2" \
    --jars="${GCS_JAR_URI}" \
    --class="${MAIN_CLASS}" \
    --subnet="projects/${PROJECT_ID}/${SUBNETWORK}" \
    -- \
    --runner=SparkRunner
