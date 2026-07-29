#!/usr/bin/env bash
cd "$(dirname "$0")"
pip install -q -r requirements.txt 2>/dev/null || true
DEMO_FAST=1 exec python3 -m daluyan.main
