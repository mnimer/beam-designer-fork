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

# Determine virtual environment directory
VENV_DIR="venv"
if [ -d ".venv" ] && [ -f ".venv/bin/activate" ]; then
    VENV_DIR=".venv"
fi

# Initialize virtual environment if it does not exist or is incomplete/broken
if [ ! -f "$VENV_DIR/bin/activate" ] || [ ! -f "$VENV_DIR/bin/python" ]; then
    echo "Creating virtual environment ($VENV_DIR)..."
    rm -rf "$VENV_DIR"
    "$PYTHON_CMD" -m venv "$VENV_DIR" || "$PYTHON_CMD" -m venv --without-pip "$VENV_DIR"
fi

echo "Activating virtual environment..."
source "$VENV_DIR/bin/activate"

# Ensure pip is available inside the virtual environment
if ! "$VENV_DIR/bin/python" -m pip --version &>/dev/null; then
    echo "Bootstrapping pip inside virtual environment..."
    "$VENV_DIR/bin/python" -m ensurepip --upgrade || "$VENV_DIR/bin/python" -m ensurepip || true
fi

# Upgrade pip and install requirements from public PyPI
echo "Installing dependencies..."
"$VENV_DIR/bin/python" -m pip install --upgrade pip --index-url https://pypi.org/simple
"$VENV_DIR/bin/python" -m pip install -r requirements.txt --index-url https://pypi.org/simple

# Set PYTHONPATH to include root and src directories
export PYTHONPATH=.:src

# Run pipeline locally with DirectRunner
echo "Executing pipeline locally with DirectRunner..."
"$VENV_DIR/bin/python" "src/{{pipeline_name}}.py" --runner=DirectRunner "$@"
