#!/usr/bin/env bash
set -euo pipefail

echo "Building and running Java Beam pipeline locally with DirectRunner..."
mvn compile exec:java \
    -Dexec.mainClass="com.example.{{pipeline_class_name}}" \
    -Dexec.args="--runner=DirectRunner"
