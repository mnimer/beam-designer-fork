#!/usr/bin/env bash
set -euo pipefail

# Dynamic Project Retrieval
PROJECT_ID=$(gcloud config get-value project)
REGION="${REGION:-us-central1}"
SUBNETWORK="${SUBNETWORK:-regions/us-central1/subnetworks/default}"
GCS_STAGING_PATH="${GCS_STAGING_PATH:-gs://${PROJECT_ID}-spark/staging}"
PIPELINE_NAME="{{pipeline_name}}"
MAIN_CLASS="com.example.{{pipeline_class_name}}"
JAR_PATH="target/${PIPELINE_NAME}-1.0.0.jar"
GCS_JAR_URI="${GCS_STAGING_PATH}/${PIPELINE_NAME}-1.0.0.jar"

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

# 2. Upload JAR to GCS
echo "Uploading JAR to GCS staging..."
gcloud storage cp "${JAR_PATH}" "${GCS_JAR_URI}"

# 3. Submit Dataproc Serverless Spark Batch job
echo "Submitting Dataproc Serverless Spark Batch job..."
gcloud dataproc batches submit spark "${PIPELINE_NAME}-batch-$(date +%Y%m%d-%H%M%S)" \
    --region="${REGION}" \
    --jars="${GCS_JAR_URI}" \
    --class="${MAIN_CLASS}" \
    --subnet="projects/${PROJECT_ID}/${SUBNETWORK}"
