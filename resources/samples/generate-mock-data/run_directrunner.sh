#!/usr/bin/env bash
set -euo pipefail

PIPELINE_JOB_ID="${PIPELINE_JOB_ID:-generate-mock-data-pipeline}"
NUM_OBJECTS_PER_ITERATION="${NUM_OBJECTS_PER_ITERATION:-1}"

echo "Building and running Java Beam pipeline locally with DirectRunner..."
mvn compile exec:java \
    -Dexec.mainClass="com.example.GenerateMockDataPipeline" \
    -Dexec.args="--runner=DirectRunner --streaming=true --pipelineJobId=\"${PIPELINE_JOB_ID}\" --numObjectsPerIteration=${NUM_OBJECTS_PER_ITERATION}"
