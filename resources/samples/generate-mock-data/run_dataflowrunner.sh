#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID=$(gcloud config get-value project)
REGION="${REGION:-us-central1}"
SUBNETWORK="${SUBNETWORK:-regions/us-central1/subnetworks/default}"
GCS_STAGING_PATH="${GCS_STAGING_PATH:-gs://${PROJECT_ID}-dataflow/staging}"
IMAGE_NAME="generate-mock-data-pipeline"
IMAGE_TAG="${IMAGE_TAG:-latest}"
TEMPLATE_IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/beam-pipelines/${IMAGE_NAME}:${IMAGE_TAG}"
TEMPLATE_SPEC_PATH="${GCS_STAGING_PATH}/${IMAGE_NAME}-template.json"
STAGING_LOCATION="${GCS_STAGING_PATH}/staging"

PIPELINE_JOB_ID="${PIPELINE_JOB_ID:-generate-mock-data-pipeline}"
NUM_OBJECTS_PER_ITERATION="${NUM_OBJECTS_PER_ITERATION:-1}"
MACHINE_TYPE="${MACHINE_TYPE:-n1-standard-1}"
MIN_INSTANCES="${MIN_INSTANCES:-1}"
MAX_INSTANCES="${MAX_INSTANCES:-10}"

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
    --worker-machine-type "${MACHINE_TYPE}" \
    --num-workers "${MIN_INSTANCES}" \
    --max-workers "${MAX_INSTANCES}" \
    --subnetwork "https://www.googleapis.com/compute/v1/projects/${PROJECT_ID}/${SUBNETWORK}" \
    --parameters pipelineJobId="${PIPELINE_JOB_ID}",numObjectsPerIteration="${NUM_OBJECTS_PER_ITERATION}"
