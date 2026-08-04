#!/usr/bin/env bash
set -euo pipefail

# Dynamic Project Retrieval
PROJECT_ID=$(gcloud config get-value project)
REGION="${REGION:-us-central1}"
SUBNETWORK="${SUBNETWORK:-regions/us-central1/subnetworks/default}"
GCS_STAGING_PATH="${GCS_STAGING_PATH:-gs://${PROJECT_ID}-dataflow/staging}"
IMAGE_NAME="{{pipeline_name}}"
TEMPLATE_IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/beam-pipelines/${IMAGE_NAME}:latest"
TEMPLATE_SPEC_PATH="${GCS_STAGING_PATH}/${IMAGE_NAME}-template.json"
STAGING_LOCATION="${GCS_STAGING_PATH}/staging"

echo "==== Configurations ===="
echo "Project ID: ${PROJECT_ID}"
echo "Region: ${REGION}"
echo "Template Image: ${TEMPLATE_IMAGE}"
echo "Template Spec: ${TEMPLATE_SPEC_PATH}"
echo "Staging Location: ${STAGING_LOCATION}"
echo "Subnetwork: ${SUBNETWORK}"
echo "========================"

# 1. Build and push container image using Cloud Build
echo "Building container image via Cloud Build..."
gcloud builds submit --tag "${TEMPLATE_IMAGE}" .

# 2. Build Flex Template spec file on GCS
echo "Building Flex Template Spec file..."
gcloud dataflow flex-template build "${TEMPLATE_SPEC_PATH}" \
    --image "${TEMPLATE_IMAGE}" \
    --sdk-language "JAVA" \
    --metadata-file "metadata.json"

# 3. Launch Flex Template Job on GCP Dataflow
echo "Launching Dataflow Flex Template Job..."
gcloud dataflow flex-template run "${IMAGE_NAME}-job-$(date +%Y%m%d-%H%M%S)" \
    --template-file-gcs-location "${TEMPLATE_SPEC_PATH}" \
    --region "${REGION}" \
    --staging-location "${STAGING_LOCATION}" \
    --subnetwork "https://www.googleapis.com/compute/v1/projects/${PROJECT_ID}/${SUBNETWORK}"
