#!/usr/bin/env bash
set -euo pipefail

# Find a compatible Python version (preferring python3.12 or python3.11)
echo "Searching for compatible Python version (3.12 or 3.11)..."
PYTHON_CMD=""
if command -v python3.12 &>/dev/null; then
    PYTHON_CMD="python3.12"
elif command -v python3.11 &>/dev/null; then
    PYTHON_CMD="python3.11"
else
    PYTHON_CMD="python3"
fi

echo "Using python command: $PYTHON_CMD"

# Initialize virtual environment if it does not exist
if [ ! -d "venv" ] && [ ! -d ".venv" ]; then
    echo "Creating virtual environment..."
    $PYTHON_CMD -m venv venv
fi

if [ -d "venv" ]; then
    VENV_DIR="venv"
else
    VENV_DIR=".venv"
fi

echo "Activating virtual environment..."
source "$VENV_DIR/bin/activate"

# Upgrade pip and install requirements from public PyPI
echo "Installing dependencies..."
pip install --upgrade pip --index-url https://pypi.org/simple
pip install -r requirements.txt --index-url https://pypi.org/simple

# Set PYTHONPATH to include root and src directories
export PYTHONPATH=.:src

# Run pipeline locally with DirectRunner
echo "Executing pipeline locally with DirectRunner..."
python "src/{{pipeline_name}}.py" --runner=DirectRunner
