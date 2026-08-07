#!/usr/bin/env bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [ -d ".venv" ]; then
    if [ -f ".venv/bin/activate" ]; then
        source .venv/bin/activate
    elif [ -f ".venv/Scripts/activate" ]; then
        source .venv/Scripts/activate
    fi
fi

PYTHON="python3"
if ! command -v "$PYTHON" &>/dev/null; then
    PYTHON="python"
fi

"$PYTHON" -m pip install -q -r requirements.txt 2>/dev/null || true

DEMO_FAST=1 exec "$PYTHON" -m daluyan.main "$@"
