ARG IMAGE_PYTHON_VERSION=3.11

# --- Stage 1: Get Python Flex Template Launcher Binary ---
FROM gcr.io/dataflow-templates-base/python3-template-launcher-base:1.1 AS launcher

# --- Stage 2: Build Application Image ---
FROM apache/beam_python${IMAGE_PYTHON_VERSION}_sdk:2.55.0

# 1. Copy Flex Template launcher binary
COPY --from=launcher /opt/google/dataflow/python_template_launcher /opt/google/dataflow/python_template_launcher

# 2. Set working directory
WORKDIR /template

# 3. Copy application files
COPY requirements.txt .
COPY src/ ./src/

# 4. Install Python Dependencies
RUN pip install --no-cache-dir -r requirements.txt --index-url https://pypi.org/simple

# 5. Specify Pipeline Entrypoint
ENV FLEX_TEMPLATE_PYTHON_PY_FILE=/template/src/{{pipeline_name}}.py
