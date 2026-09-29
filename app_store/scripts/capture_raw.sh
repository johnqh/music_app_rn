#!/bin/bash
export APP_STORE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
export WORKFLOWS_DIR="$HOME/projects/workflows/app_store"
exec "$WORKFLOWS_DIR/capture_raw.sh" "$@"
